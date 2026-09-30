import {
  Arg,
  Args,
  Authorized,
  Ctx,
  ID,
  Mutation,
  Query,
  Resolver,
} from "type-graphql";
import { BankAccount, BankAccountStatus } from "../entities/bank.entity";
import {
  CreateBankAccountInput,
  UpdateBankAccountStatusInput,
} from "../dto/bank.dto";
import { User } from "../../user/entities/user.entity";
import { CAPABILITIES, hasPermission } from "../../../permissions";
import { AuditAction, AuditOutcome } from "../../audit/entities/audit-log.entity";
import { buildChanges, writeAuditLog } from "../../audit/services/audit.service";
import { AppDataSource } from "../../../config/database/data-source";
import { AuthContext } from "../../../middleware/authContext";

/**
 * Ownership helper. Resolves the caller, then confirms the account belongs to
 * them. Admins pass regardless of owner.
 *
 * Every query and mutation below routes through this or an equivalent
 * `ctx.user.userId` filter. A `WHERE userId = ctx.user.userId` on reads and an
 * explicit comparison on writes is the whole point: @Authorized() only proves
 * *someone* is logged in, never that it is the account's owner.
 */
@Resolver(() => BankAccount)
export class BankAccountResolver {
  private static requireUser(ctx: AuthContext): NonNullable<AuthContext["user"]> {
    if (!ctx.user) {
      throw new Error("Authentication required");
    }
    return ctx.user;
  }

  /**
   * Ownership check for reads.
   *
   * Reads are permitted for the holder, or for any role holding
   * ACCOUNT_READ_ANY (auditor, admin). Writes are not covered here: an
   * auditor may read an account without holding the right to close it.
   */
  private static assertCanAccess(
    ctx: AuthContext,
    account: BankAccount
  ): void {
    const caller = BankAccountResolver.requireUser(ctx);
    if (account.userId === caller.userId) {
      return;
    }
    if (hasPermission(caller.role, CAPABILITIES.ACCOUNT_READ_ANY)) {
      return;
    }
    // Deliberately identical to "not found": confirming the account exists
    // would let a caller probe for valid IDs.
    throw new Error(`Bank account with ID ${account.id} not found`);
  }

  // Query: All bank accounts across every user. Staff tooling only.
  @Query(() => [BankAccount], {
    description:
      "Get list of all bank accounts (auditor or admin)",
  })
  @Authorized(CAPABILITIES.ACCOUNT_READ_ANY)
  async getBankAccounts(): Promise<BankAccount[]> {
    return await AppDataSource.getRepository(BankAccount).find({
      order: { openedAt: "DESC" },
    });
  }

  // Query: Single bank account by ID, scoped to the caller
  @Query(() => BankAccount, {
    nullable: true,
    description:
      "Get a bank account by ID (own accounts only, unless the role holds ACCOUNT_READ_ANY)",
  })
  @Authorized(CAPABILITIES.ACCOUNT_READ)
  async getBankAccount(
    @Ctx() ctx: AuthContext,
    @Arg("id", () => ID) id: string
  ): Promise<BankAccount | null> {
    const account = await AppDataSource.getRepository(BankAccount).findOneBy({
      id,
    });

    if (!account) {
      return null;
    }

    // Deliberately identical to "not found": confirming the account exists
    // would let a caller probe for valid IDs.
    BankAccountResolver.assertCanAccess(ctx, account);

    return account;
  }

  // Query: All bank accounts of the current user
  @Query(() => [BankAccount], {
    description: "Get all bank accounts for the currently logged-in user",
  })
  @Authorized(CAPABILITIES.ACCOUNT_READ)
  async myBankAccounts(@Ctx() ctx: AuthContext): Promise<BankAccount[]> {
    const caller = BankAccountResolver.requireUser(ctx);
    return await AppDataSource.getRepository(BankAccount).find({
      where: { userId: caller.userId },
      order: { openedAt: "DESC" },
    });
  }

  // Query: Accounts for an arbitrary user. Staff tooling only.
  @Query(() => [BankAccount], {
    description:
      "Get all bank accounts belonging to a specific user ID (admin only)",
  })
  @Authorized(CAPABILITIES.ACCOUNT_READ_ANY)
  async getBankAccountsByUser(
    @Arg("userId", () => ID) userId: string
  ): Promise<BankAccount[]> {
    return await AppDataSource.getRepository(BankAccount).find({
      where: { userId },
      order: { openedAt: "DESC" },
    });
  }

  // Mutation: Open a new bank account, always owned by the caller
  @Mutation(() => BankAccount, { description: "Create a new bank account" })
  @Authorized()
  async createBankAccount(
    @Args() data: CreateBankAccountInput,
    @Ctx() ctx: AuthContext
  ): Promise<BankAccount> {
    const caller = BankAccountResolver.requireUser(ctx);
    const accountRepo = AppDataSource.getRepository(BankAccount);

    // The owner is always the caller. Never taken from input.
    const user = await AppDataSource.getRepository(User).findOneBy({
      id: caller.userId,
    });
    if (!user) {
      throw new Error("Authenticated user no longer exists");
    }

    // Auto-generate 12-digit account number if not provided
    const accountNumber =
      data.accountNumber ||
      Math.floor(100000000000 + Math.random() * 900000000000).toString();

    const existingAccount = await accountRepo.findOneBy({ accountNumber });
    if (existingAccount) {
      throw new Error(`Account number ${accountNumber} is already in use`);
    }

    // Auto-generate branch code (6-digit numeric) and IFSC (4-letter bank + 0 + branch)
    const branchCode = data.branchCode || this.generateBranchCode();
    const ifscCode = data.ifscCode || this.generateIfscCode(branchCode);

    const newAccount = accountRepo.create({
      accountNumber,
      accountType: data.accountType,
      balance: data.initialBalance ?? 0,
      currency: data.currency || "INR",
      branchCode,
      ifscCode,
      status: BankAccountStatus.ACTIVE,
      userId: caller.userId,
    });

    return await accountRepo.save(newAccount);
  }

  private generateBranchCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private generateIfscCode(branchCode: string): string {
    const bankCode = "FINT";
    return `${bankCode}0${branchCode}`;
  }

  // Mutation: Update account status (ACTIVE, DORMANT, FROZEN, CLOSED)
  @Mutation(() => BankAccount, {
    description:
      "Set a bank account's status (admin only). Customers cannot change status themselves.",
  })
  @Authorized(CAPABILITIES.ACCOUNT_UPDATE)
  async updateBankAccountStatus(
    @Ctx() ctx: AuthContext,
    @Arg("data") data: UpdateBankAccountStatusInput
  ): Promise<BankAccount> {
    BankAccountResolver.requireUser(ctx);

    const accountRepo = AppDataSource.getRepository(BankAccount);
    const account = await accountRepo.findOneBy({ id: data.accountId });

    if (!account) {
      throw new Error(`Bank account with ID ${data.accountId} not found`);
    }

    // Narrow the blanket status permission to the specific one for the target
    // state, so holding ACCOUNT_UPDATE does not silently also convey
    // ACCOUNT_DELETE.
    if (data.status === BankAccountStatus.CLOSED) {
      if (!hasPermission(ctx.user!.role, CAPABILITIES.ACCOUNT_DELETE)) {
        throw new Error("Closing an account requires ACCOUNT_DELETE");
      }
      if (account.balance !== 0) {
        throw new Error(
          `Account ${account.accountNumber} must have a zero balance before closing (currently ${account.balance})`
        );
      }
    }

    if (account.status === BankAccountStatus.CLOSED) {
      throw new Error("A closed account cannot change status");
    }

    const before = { status: account.status };
    account.status = data.status;
    if (data.status === BankAccountStatus.CLOSED) {
      account.closedAt = account.closedAt ?? new Date();
    } else {
      account.closedAt = null;
    }

    const saved = await accountRepo.save(account);

    await writeAuditLog({
      action: AuditAction.ACCOUNT_STATUS_CHANGED,
      outcome: AuditOutcome.SUCCESS,
      ctx,
      entityType: "BankAccount",
      entityId: saved.id,
      changes: buildChanges(before, { status: saved.status }, ["status"]),
    });

    return saved;
  }

  // Mutation: Close bank account shortcut
  @Mutation(() => BankAccount, {
    description: "Close a bank account (admin, or the holder of a zero-balance account)",
  })
  @Authorized()
  async closeBankAccount(
    @Ctx() ctx: AuthContext,
    @Arg("id", () => ID) id: string
  ): Promise<BankAccount> {
    BankAccountResolver.requireUser(ctx);

    const accountRepo = AppDataSource.getRepository(BankAccount);
    const account = await accountRepo.findOneBy({ id });

    if (!account) {
      throw new Error(`Bank account with ID ${id} not found`);
    }

    // A holder may close their own account, which is a normal customer action.
    // Anyone else needs the explicit close capability. Read access alone is
    // deliberately not enough: an auditor inspecting an account must not be
    // able to close it.
    if (account.userId !== ctx.user!.userId) {
      if (!hasPermission(ctx.user!.role, CAPABILITIES.ACCOUNT_DELETE)) {
        throw new Error(`Bank account with ID ${id} not found`);
      }
    }

    if (account.balance !== 0) {
      throw new Error(
        `Account ${account.accountNumber} must have a zero balance before closing (currently ${account.balance})`
      );
    }

    if (account.status === BankAccountStatus.CLOSED) {
      throw new Error(`Bank account ${account.accountNumber} is already closed`);
    }

    account.status = BankAccountStatus.CLOSED;
    account.closedAt = new Date();

    return await accountRepo.save(account);
  }
}
