import { Arg, Args, Authorized, Ctx, ID, Mutation, Query, Resolver } from "type-graphql";
import { AppDataSource } from "../../../config/database/data-source";
import { AuthContext } from "../../../middleware/authContext";
import { CAPABILITIES, hasPermission } from "../../../permissions";
import {
  AuditAction,
  AuditOutcome,
} from "../../audit/entities/audit-log.entity";
import { buildChanges, writeAuditLog } from "../../audit/services/audit.service";
import { BankAccount, BankAccountStatus } from "../../bank/entities/bank.entity";
import { User } from "../../user/entities/user.entity";
import {
  OpenAccountForCustomerInput,
  RejectTransactionInput,
} from "../../Transactions/dto/staff.dto";
import {
  Transaction,
  TransactionStatus,
} from "../../Transactions/entities/transaction.entity";
import {
  applyBalanceChange,
  assertAccountExists,
  assertSufficientFunds,
  lockAccounts,
  updateTransactionStatus,
} from "../../Transactions/services/transaction.service";

/**
 * Supervisory controls: account freezing, the approval queue, and opening
 * accounts on a customer's behalf.
 *
 * With BRANCH_MANAGER retired, every capability gated here is held only by
 * ADMIN, so these operations are admin-only. TELLER still holds
 * ACCOUNT_CREATE and is exercised in TellerResolver instead.
 *
 * These are the deliberate exceptions to the ownership rule that governs
 * customer-initiated operations. Each one is gated on a capability that
 * CUSTOMER and TELLER do not hold, so a teller's account-access at the counter
 * does not extend into freezing or approving.
 */
@Resolver()
export class ManagerResolver {
  private static requireUser(ctx: AuthContext): NonNullable<AuthContext["user"]> {
    if (!ctx.user) {
      throw new Error("Authentication required");
    }
    return ctx.user;
  }

  // Query: Transactions awaiting manager approval
  @Query(() => [Transaction], {
    description: "Get transactions awaiting approval (admin only)",
  })
  @Authorized(CAPABILITIES.TRANSACTION_APPROVE)
  async getPendingApprovals(): Promise<Transaction[]> {
    return await AppDataSource.getRepository(Transaction).find({
      where: { status: TransactionStatus.PENDING },
      order: { transactionDate: "ASC" },
    });
  }

  // Mutation: Approve a pending transaction, moving the money at that point
  @Mutation(() => Transaction, {
    description: "Approve a pending transaction (admin only)",
  })
  @Authorized(CAPABILITIES.TRANSACTION_APPROVE)
  async approveTransaction(
    @Ctx() ctx: AuthContext,
    @Arg("id", () => ID) id: string
  ): Promise<Transaction> {
    const caller = ManagerResolver.requireUser(ctx);

    return await AppDataSource.transaction(async (manager) => {
      const txnRepo = manager.getRepository(Transaction);

      const existing = await txnRepo
        .createQueryBuilder("transaction")
        .setLock("pessimistic_write")
        .where("transaction.id = :id", { id })
        .getOne();

      if (!existing) {
        throw new Error(`Transaction with ID ${id} not found`);
      }

      if (existing.status !== TransactionStatus.PENDING) {
        throw new Error(
          `Only PENDING transactions can be approved (this one is ${existing.status})`
        );
      }

      // Approving a cash withdrawal is what actually takes the money, so the
      // balance must still be there. Re-check under the same row lock the
      // balance write will use.
      if (existing.transactionType === "CASH_WITHDRAWAL") {
        const accounts = await lockAccounts(manager, existing.fromAccountId, null);
        assertAccountExists(accounts.fromAccount, existing.fromAccountId, "Source");
        assertSufficientFunds(accounts.fromAccount, existing.amount);
        await applyBalanceChange(manager, accounts, existing.amount);
      }

      const updated = await updateTransactionStatus(
        manager,
        existing,
        TransactionStatus.COMPLETED,
        caller.userId
      );

      await writeAuditLog({
        action: AuditAction.TRANSACTION_APPROVED,
        outcome: AuditOutcome.SUCCESS,
        ctx,
        entityType: "Transaction",
        entityId: id,
        changes: { status: { from: existing.status, to: TransactionStatus.COMPLETED } },
        manager,
      });

      return updated;
    });
  }

  // Mutation: Reject a pending transaction
  @Mutation(() => Transaction, {
    description: "Reject a pending transaction (admin only)",
  })
  @Authorized(CAPABILITIES.TRANSACTION_APPROVE)
  async rejectTransaction(
    @Ctx() ctx: AuthContext,
    @Args() data: RejectTransactionInput
  ): Promise<Transaction> {
    const caller = ManagerResolver.requireUser(ctx);
    void caller;

    return await AppDataSource.transaction(async (manager) => {
      const txnRepo = manager.getRepository(Transaction);

      const existing = await txnRepo
        .createQueryBuilder("transaction")
        .setLock("pessimistic_write")
        .where("transaction.id = :id", { id: data.transactionId })
        .getOne();

      if (!existing) {
        throw new Error(`Transaction with ID ${data.transactionId} not found`);
      }

      if (existing.status !== TransactionStatus.PENDING) {
        throw new Error(
          `Only PENDING transactions can be rejected (this one is ${existing.status})`
        );
      }

      // No balance was moved when the transaction was queued, so rejection is
      // a status change only.
      const updated = await updateTransactionStatus(
        manager,
        existing,
        TransactionStatus.FAILED
      );

      await writeAuditLog({
        action: AuditAction.TRANSACTION_REJECTED,
        outcome: AuditOutcome.SUCCESS,
        ctx,
        entityType: "Transaction",
        entityId: data.transactionId,
        reason: data.reason,
        manager,
      });

      return updated;
    });
  }

  // Mutation: Freeze a customer's account
  @Mutation(() => BankAccount, {
    description: "Freeze a bank account (admin only)",
  })
  @Authorized(CAPABILITIES.ACCOUNT_UPDATE)
  async freezeAccount(
    @Ctx() ctx: AuthContext,
    @Arg("id", () => ID) id: string
  ): Promise<BankAccount> {
    return await this.setStatus(ctx, id, BankAccountStatus.FROZEN, AuditAction.ACCOUNT_STATUS_CHANGED);
  }

  // Mutation: Unfreeze a previously frozen account
  @Mutation(() => BankAccount, {
    description: "Unfreeze a frozen bank account (admin only)",
  })
  @Authorized(CAPABILITIES.ACCOUNT_UPDATE)
  async unfreezeAccount(
    @Ctx() ctx: AuthContext,
    @Arg("id", () => ID) id: string
  ): Promise<BankAccount> {
    return await this.setStatus(ctx, id, BankAccountStatus.ACTIVE, AuditAction.ACCOUNT_STATUS_CHANGED);
  }

  private async setStatus(
    ctx: AuthContext,
    id: string,
    status: BankAccountStatus,
    action: AuditAction
  ): Promise<BankAccount> {
    ManagerResolver.requireUser(ctx);

    const accountRepo = AppDataSource.getRepository(BankAccount);
    const account = await accountRepo.findOneBy({ id });

    if (!account) {
      throw new Error(`Bank account with ID ${id} not found`);
    }

    if (account.status === BankAccountStatus.CLOSED) {
      throw new Error("A closed account cannot change status");
    }

    const before = { status: account.status };
    account.status = status;
    if (status === BankAccountStatus.ACTIVE) {
      account.closedAt = null;
    }

    const saved = await accountRepo.save(account);

    await writeAuditLog({
      action,
      outcome: AuditOutcome.SUCCESS,
      ctx,
      entityType: "BankAccount",
      entityId: id,
      changes: buildChanges(before, { status: saved.status }, ["status"]),
    });

    return saved;
  }

  // Mutation: Open an account on a customer's behalf
  @Mutation(() => BankAccount, {
    description: "Open a bank account for a customer (teller or above)",
  })
  @Authorized(CAPABILITIES.ACCOUNT_CREATE)
  async openAccountForCustomer(
    @Ctx() ctx: AuthContext,
    @Args() data: OpenAccountForCustomerInput
  ): Promise<BankAccount> {
    const caller = ManagerResolver.requireUser(ctx);

    if (!hasPermission(caller.role, CAPABILITIES.ACCOUNT_CREATE)) {
      throw new Error("You are not permitted to open accounts for customers");
    }

    const accountRepo = AppDataSource.getRepository(BankAccount);
    const customer = await AppDataSource.getRepository(User).findOneBy({
      id: data.customerId,
    });

    if (!customer) {
      throw new Error(`Customer with ID ${data.customerId} does not exist`);
    }

    // Self-service accounts take an initial balance from the customer, which
    // would be an unbounded money-printing primitive. Counter-opened accounts
    // are funded by the branch, so the balance starts at zero.
    const accountNumber = Math.floor(
      100000000000 + Math.random() * 900000000000
    ).toString();
    const branchCode = Math.floor(100000 + Math.random() * 900000).toString();

    const account = accountRepo.create({
      accountNumber,
      accountType: data.accountType,
      balance: 0,
      currency: data.currency || "INR",
      branchCode,
      ifscCode: `FINT0${branchCode}`,
      status: BankAccountStatus.ACTIVE,
      userId: data.customerId,
    });

    const saved = await accountRepo.save(account);

    await writeAuditLog({
      action: AuditAction.ACCOUNT_OPENED,
      outcome: AuditOutcome.SUCCESS,
      ctx,
      entityType: "BankAccount",
      entityId: saved.id,
      changes: {
        accountNumber: { to: saved.accountNumber },
        userId: { to: data.customerId },
        accountType: { to: data.accountType },
      },
      reason: "Opened on behalf of customer at branch",
    });

    return saved;
  }
}
