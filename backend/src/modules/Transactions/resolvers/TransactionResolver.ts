import {
  Arg,
  Args,
  Authorized,
  Ctx,
  FieldResolver,
  ID,
  Mutation,
  Query,
  Resolver,
  Root,
} from "type-graphql";
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from "../entities/transaction.entity";
import { CreateTransactionInput } from "../dto/transaction.dto";
import { BankAccount } from "../../bank/entities/bank.entity";
import { AppDataSource } from "../../../config/database/data-source";
import { AuthContext } from "../../../middleware/authContext";
import { CAPABILITIES, hasPermission } from "../../../permissions";
import {
  AuditAction,
  AuditOutcome,
} from "../../audit/entities/audit-log.entity";
import { writeAuditLog } from "../../audit/services/audit.service";
import { TRANSFER_APPROVAL_THRESHOLD } from "../dto/staff.dto";
import {
  applyBalanceChange,
  assertAccountExists,
  assertActive,
  assertSufficientFunds,
  lockAccounts,
  recordTransaction,
} from "../services/transaction.service";

/** Resolve one of the two locked accounts by ID. */
function accountsByIdOf(
  accounts: { fromAccount: BankAccount | null; toAccount: BankAccount | null },
  accountId: string
): BankAccount | null {
  if (accounts.fromAccount?.id === accountId) {
    return accounts.fromAccount;
  }
  if (accounts.toAccount?.id === accountId) {
    return accounts.toAccount;
  }
  return null;
}

@Resolver(() => Transaction)
export class TransactionResolver {
  private static requireUser(ctx: AuthContext): NonNullable<AuthContext["user"]> {
    if (!ctx.user) {
      throw new Error("Authentication required");
    }
    return ctx.user;
  }

  /**
   * Guards the money-moving paths.
   *
   * The capability is passed in rather than assumed, because "may act on any
   * account" is not one permission: a TELLER may serve an account at the
   * counter but may not reverse transactions on it, and an AUDITOR may read
   * one but may not transfer from it. Hard-coding an admin bypass here
   * is what previously let one role's rights leak into unrelated operations.
   */
  private static assertAccountAccess(
    caller: NonNullable<AuthContext["user"]>,
    account: BankAccount | null,
    label: string,
    capability: (typeof CAPABILITIES)[keyof typeof CAPABILITIES]
  ): void {
    if (!account) {
      return;
    }
    if (account.userId === caller.userId) {
      return;
    }
    if (hasPermission(caller.role, capability)) {
      return;
    }
    throw new Error(
      `${label} account ${account.accountNumber} does not belong to the authenticated user`
    );
  }

  // Query: Get all transactions. Staff tooling only.
  @Query(() => [Transaction], {
    description: "Get list of all transactions (auditor or admin)",
  })
  @Authorized(CAPABILITIES.TRANSACTION_READ_ANY)
  async getTransactions(): Promise<Transaction[]> {
    return await AppDataSource.getRepository(Transaction).find({
      order: { transactionDate: "DESC" },
    });
  }

  // Query: Get single transaction by ID, scoped to the caller's accounts
  @Query(() => Transaction, {
    nullable: true,
    description:
      "Get a transaction by ID (own accounts only, unless admin)",
  })
  @Authorized(CAPABILITIES.TRANSACTION_READ)
  async getTransaction(
    @Ctx() ctx: AuthContext,
    @Arg("id", () => ID) id: string
  ): Promise<Transaction | null> {
    const caller = TransactionResolver.requireUser(ctx);
    const transaction = await AppDataSource.getRepository(Transaction).findOneBy(
      { id }
    );

    if (!transaction) {
      return null;
    }

    if (hasPermission(caller.role, CAPABILITIES.TRANSACTION_READ_ANY)) {
      return transaction;
    }

    const accounts = await AppDataSource.getRepository(BankAccount)
      .createQueryBuilder("account")
      .where("account.id IN (:...ids)", {
        ids: [transaction.fromAccountId, transaction.toAccountId].filter(
          (accountId): accountId is string => !!accountId
        ),
      })
      .getMany();

    const isParticipant = accounts.some(
      (account) => account.userId === caller.userId
    );

    return isParticipant ? transaction : null;
  }

  // Query: Get all transactions for the currently authenticated user
  @Query(() => [Transaction], {
    description: "Get all transactions for the currently logged-in user",
  })
  @Authorized(CAPABILITIES.TRANSACTION_READ)
  async myTransactions(@Ctx() ctx: AuthContext): Promise<Transaction[]> {
    const caller = TransactionResolver.requireUser(ctx);
    return await AppDataSource.getRepository(Transaction)
      .createQueryBuilder("transaction")
      .leftJoin(
        BankAccount,
        "account",
        "account.id = transaction.fromAccountId"
      )
      .leftJoin(
        BankAccount,
        "counterparty",
        "counterparty.id = transaction.toAccountId"
      )
      .where("account.userId = :userId", { userId: caller.userId })
      .orWhere("counterparty.userId = :userId", { userId: caller.userId })
      .orderBy("transaction.transactionDate", "DESC")
      .getMany();
  }

  // Query: Get all transactions on a specific bank account
  @Query(() => [Transaction], {
    description:
      "Get all transactions for a specific bank account ID (own accounts only, unless admin)",
  })
  @Authorized()
  async getTransactionsByAccount(
    @Ctx() ctx: AuthContext,
    @Arg("accountId", () => ID) accountId: string
  ): Promise<Transaction[]> {
    const caller = TransactionResolver.requireUser(ctx);

    const account = await AppDataSource.getRepository(BankAccount).findOneBy({
      id: accountId,
    });

    if (!account) {
      throw new Error(`Bank account with ID ${accountId} not found`);
    }

    TransactionResolver.assertAccountAccess(
      caller,
      account,
      "Source",
      CAPABILITIES.TRANSACTION_READ_ANY
    );

    return await AppDataSource.getRepository(Transaction)
      .createQueryBuilder("transaction")
      .where("transaction.fromAccountId = :accountId", { accountId })
      .orWhere("transaction.toAccountId = :accountId", { accountId })
      .orderBy("transaction.transactionDate", "DESC")
      .getMany();
  }

  // Mutation: Record a transaction and move the balance atomically
  @Mutation(() => Transaction, {
    description: "Record a transaction between two bank accounts",
  })
  @Authorized(CAPABILITIES.TRANSACTION_CREATE)
  async createTransaction(
    @Ctx() ctx: AuthContext,
    @Args() data: CreateTransactionInput
  ): Promise<Transaction> {
    const caller = TransactionResolver.requireUser(ctx);

    if (!data.fromAccountId && !data.toAccountId) {
      throw new Error("At least one of fromAccountId or toAccountId is required");
    }

    if (
      data.transactionType === TransactionType.TRANSFER &&
      (!data.fromAccountId || !data.toAccountId)
    ) {
      throw new Error("TRANSFER requires both fromAccountId and toAccountId");
    }

    if (
      data.transactionType === TransactionType.DEBIT &&
      !data.fromAccountId
    ) {
      throw new Error("DEBIT requires fromAccountId");
    }

    if (data.transactionType === TransactionType.CREDIT && !data.toAccountId) {
      throw new Error("CREDIT requires toAccountId");
    }

    if (data.fromAccountId && data.fromAccountId === data.toAccountId) {
      throw new Error("Source and destination accounts must be different");
    }

    // Large transfers wait for an admin rather than settling immediately.
    // The money is not moved until approveTransaction runs, so a queued
    // transfer does not freeze the sender's balance.
    const needsApproval =
      data.transactionType === TransactionType.TRANSFER &&
      data.amount > TRANSFER_APPROVAL_THRESHOLD;

    try {
      return await AppDataSource.transaction(async (manager) => {
      const accounts = await lockAccounts(manager, data.fromAccountId, data.toAccountId);

      assertAccountExists(accounts.fromAccount, data.fromAccountId, "Source");
      assertAccountExists(accounts.toAccount, data.toAccountId, "Destination");
      assertActive(accounts.fromAccount, "Source");
      assertActive(accounts.toAccount, "Destination");

      // Money leaves the source account, so the caller must own it unless the
      // role holds an explicit "act on any account" capability. The destination
      // may belong to anyone: that is what a transfer is for. A CREDIT has no
      // source, so the destination is the caller's own account.
      if (data.transactionType === TransactionType.CREDIT) {
        TransactionResolver.assertAccountAccess(
          caller,
          accounts.toAccount,
          "Destination",
          CAPABILITIES.TRANSACTION_CREATE_ANY
        );
      } else {
        TransactionResolver.assertAccountAccess(
          caller,
          accounts.fromAccount,
          "Source",
          CAPABILITIES.TRANSACTION_CREATE_ANY
        );
      }

      assertSufficientFunds(accounts.fromAccount, data.amount);

      if (!needsApproval) {
        await applyBalanceChange(manager, accounts, data.amount);
      }

      return await recordTransaction(manager, {
        transactionType: data.transactionType,
        fromAccountId: data.fromAccountId,
        toAccountId: data.toAccountId,
        amount: data.amount,
        currency: data.currency,
        description: data.description,
        status: needsApproval
          ? TransactionStatus.PENDING
          : TransactionStatus.COMPLETED,
        channel: "SELF_SERVICE",
      });
      });
    } catch (error) {
      // Recorded outside the transaction deliberately: the write must survive
      // the rollback that the failure caused.
      await writeAuditLog({
        action: AuditAction.TRANSACTION_CREATED,
        outcome: AuditOutcome.FAILURE,
        ctx,
        entityType: "AccountPair",
        reason: (error as Error).message,
      });
      throw error;
    }
  }

  // Mutation: Reverse a completed transaction and restore the balance
  @Mutation(() => Transaction, { description: "Reverse a completed transaction" })
  @Authorized()
  async reverseTransaction(
    @Ctx() ctx: AuthContext,
    @Arg("id", () => ID) id: string
  ): Promise<Transaction> {
    const caller = TransactionResolver.requireUser(ctx);
    return await AppDataSource.transaction(async (manager) => {
      const transactionRepo = manager.getRepository(Transaction);

      // Lock the transaction row first so two concurrent reversals of the same
      // transaction cannot both see status COMPLETED.
      const existing = await transactionRepo
        .createQueryBuilder("transaction")
        .setLock("pessimistic_write")
        .where("transaction.id = :id", { id })
        .getOne();

      if (!existing) {
        throw new Error(`Transaction with ID ${id} not found`);
      }

      if (existing.status === TransactionStatus.REVERSED) {
        throw new Error("Transaction is already reversed");
      }

      if (existing.status !== TransactionStatus.COMPLETED) {
        throw new Error("Only COMPLETED transactions can be reversed");
      }

      // Reversal credits the source and debits the destination, so it can move
      // money out of someone else's account. Only the participant who sent the
      // money, or a role holding TRANSACTION_REVERSE, may trigger it.
      const accounts = await lockAccounts(
        manager,
        existing.fromAccountId,
        existing.toAccountId
      );

      const originatingAccountId = existing.fromAccountId ?? existing.toAccountId;

      if (originatingAccountId) {
        const originatingAccount = accountsByIdOf(accounts, originatingAccountId);
        if (!originatingAccount) {
          // Fail closed: a missing row must not be treated as "no owner to
          // check against", which would let anyone reverse the transaction.
          throw new Error(
            `Originating account with ID ${originatingAccountId} not found`
          );
        }
        TransactionResolver.assertAccountAccess(
          caller,
          originatingAccount,
          "Originating",
          CAPABILITIES.TRANSACTION_REVERSE
        );
      }

      // The destination is on the debit side of a reversal. If the funds are
      // gone (customer already spent a credited deposit), refuse rather than
      // clamp at zero: silently writing 0 hides the shortfall and the ledger
      // stops reconciling. The rejection is auditable, the invented balance is
      // not.
      assertSufficientFunds(accounts.toAccount, existing.amount);

      // Negative amount inverts the direction: source is credited.
      await applyBalanceChange(manager, accounts, -existing.amount);

      existing.status = TransactionStatus.REVERSED;

      await writeAuditLog({
        action: AuditAction.TRANSACTION_REVERSED,
        outcome: AuditOutcome.SUCCESS,
        ctx,
        entityType: "Transaction",
        entityId: id,
        changes: { status: { from: TransactionStatus.COMPLETED, to: TransactionStatus.REVERSED } },
        reason: "Reversal requested by account participant or privileged role",
        manager,
      });

      return await transactionRepo.save(existing);
    });
  }

  // Field Resolver: Fetch source account on-demand
  @FieldResolver(() => BankAccount, { nullable: true })
  async fromAccount(@Root() transaction: Transaction): Promise<BankAccount | null> {
    if (!transaction.fromAccountId) {
      return null;
    }
    return await AppDataSource.getRepository(BankAccount).findOneBy({
      id: transaction.fromAccountId,
    });
  }

  // Field Resolver: Fetch destination account on-demand
  @FieldResolver(() => BankAccount, { nullable: true })
  async toAccount(@Root() transaction: Transaction): Promise<BankAccount | null> {
    if (!transaction.toAccountId) {
      return null;
    }
    return await AppDataSource.getRepository(BankAccount).findOneBy({
      id: transaction.toAccountId,
    });
  }
}
