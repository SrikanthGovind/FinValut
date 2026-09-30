import { Args, Authorized, Ctx, Mutation, Resolver } from "type-graphql";
import { AppDataSource } from "../../../config/database/data-source";
import { AuthContext } from "../../../middleware/authContext";
import { CAPABILITIES } from "../../../permissions";
import {
  AuditAction,
  AuditOutcome,
} from "../../audit/entities/audit-log.entity";
import { writeAuditLog } from "../../audit/services/audit.service";
import {
  CASH_WITHDRAWAL_APPROVAL_THRESHOLD,
  CashDepositInput,
  CashWithdrawalInput,
} from "../../Transactions/dto/staff.dto";
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from "../../Transactions/entities/transaction.entity";
import {
  applyBalanceChange,
  assertAccountExists,
  assertActive,
  assertSufficientFunds,
  lockAccounts,
  recordTransaction,
} from "../../Transactions/services/transaction.service";

/**
 * Counter operations for bank staff.
 *
 * Every mutation here acts on an account the caller does NOT own, which is
 * legitimate for staff at a counter and is exactly what the earlier ownership
 * checks were built to forbid. The distinction is the capability:
 * TRANSACTION_CASH and TRANSACTION_CASH are held by TELLER and above, never
 * by CUSTOMER, so a customer cannot reach these mutations at all.
 *
 * Large cash withdrawals are parked in PENDING for admin approval rather
 * than paid out immediately, which is the usual branch-control requirement. The
 * balance is only debited at approval time, so a queued withdrawal does not
 * freeze the customer's funds.
 */
@Resolver(() => Transaction)
export class TellerResolver {
  private static requireUser(ctx: AuthContext): NonNullable<AuthContext["user"]> {
    if (!ctx.user) {
      throw new Error("Authentication required");
    }
    return ctx.user;
  }

  // Mutation: Counter cash deposit into a customer's account
  @Mutation(() => Transaction, {
    description: "Accept a cash deposit at the counter (teller or above)",
  })
  @Authorized(CAPABILITIES.TRANSACTION_CASH)
  async cashDeposit(
    @Ctx() ctx: AuthContext,
    @Args() data: CashDepositInput
  ): Promise<Transaction> {
    const caller = TellerResolver.requireUser(ctx);

    try {
      return await AppDataSource.transaction(async (manager) => {
        const accounts = await lockAccounts(manager, null, data.accountId);

        assertAccountExists(accounts.toAccount, data.accountId, "Destination");
        assertActive(accounts.toAccount, "Destination");

        // Direction is decided by which slot the account occupies, not by the
        // sign of the amount: a deposit has no source account, so the target
        // is reached with a positive amount and is credited.
        await applyBalanceChange(manager, accounts, data.amount);

        return await recordTransaction(manager, {
          transactionType: TransactionType.CASH_DEPOSIT,
          fromAccountId: null,
          toAccountId: data.accountId,
          amount: data.amount,
          currency: "INR",
          description: data.description ?? data.tellerReference ?? null,
          status: TransactionStatus.COMPLETED,
          channel: "COUNTER",
          tellerId: caller.userId,
        });
      });
    } catch (error) {
      await writeAuditLog({
        action: AuditAction.CASH_DEPOSIT,
        outcome: AuditOutcome.FAILURE,
        ctx,
        entityType: "BankAccount",
        entityId: data.accountId,
        reason: (error as Error).message,
      });
      throw error;
    }
  }

  // Mutation: Counter cash withdrawal from a customer's account
  @Mutation(() => Transaction, {
    description:
      "Pay out a cash withdrawal at the counter (teller or above). Amounts above the threshold wait for admin approval.",
  })
  @Authorized(CAPABILITIES.TRANSACTION_CASH)
  async cashWithdrawal(
    @Ctx() ctx: AuthContext,
    @Args() data: CashWithdrawalInput
  ): Promise<Transaction> {
    const caller = TellerResolver.requireUser(ctx);

    const needsApproval = data.amount > CASH_WITHDRAWAL_APPROVAL_THRESHOLD;

    try {
      return await AppDataSource.transaction(async (manager) => {
        const accounts = await lockAccounts(manager, data.accountId, null);

        assertAccountExists(accounts.fromAccount, data.accountId, "Source");
        assertActive(accounts.fromAccount, "Source");
        assertSufficientFunds(accounts.fromAccount, data.amount);

        // Above the threshold the money does not move yet. An admin must
        // approve first, and approveTransaction performs the debit.
        if (!needsApproval) {
          await applyBalanceChange(manager, accounts, data.amount);
        }

        return await recordTransaction(manager, {
          transactionType: TransactionType.CASH_WITHDRAWAL,
          fromAccountId: data.accountId,
          toAccountId: null,
          amount: data.amount,
          currency: "INR",
          description: data.description ?? data.tellerReference ?? null,
          status: needsApproval
            ? TransactionStatus.PENDING
            : TransactionStatus.COMPLETED,
          channel: "COUNTER",
          tellerId: caller.userId,
        });
      });
    } catch (error) {
      await writeAuditLog({
        action: AuditAction.CASH_WITHDRAWAL,
        outcome: AuditOutcome.FAILURE,
        ctx,
        entityType: "BankAccount",
        entityId: data.accountId,
        reason: (error as Error).message,
      });
      throw error;
    }
  }
}
