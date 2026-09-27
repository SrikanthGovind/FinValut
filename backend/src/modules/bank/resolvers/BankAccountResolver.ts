import {
  Arg,
  Args,
  Ctx,
  ID,
  Mutation,
  Query,
  Resolver,
  Root,
} from "type-graphql";
import { BankAccount, BankAccountStatus } from "../entities/bank.entity";
import {
  CreateBankAccountInput,
  UpdateBankAccountStatusInput,
} from "../dto/bank.dto";
import { User } from "../../user/entities/user.entity";
import { AppDataSource } from "../../../config/database/data-source";
import { AuthContext } from "../../../middleware/authContext";

@Resolver(() => BankAccount)
export class BankAccountResolver {
  // Query: Get all bank accounts
  @Query(() => [BankAccount], { description: "Get list of all bank accounts" })
  async getBankAccounts(): Promise<BankAccount[]> {
    return await AppDataSource.getRepository(BankAccount).find({
      order: { openedAt: "DESC" },
    });
  }

  // Query: Get single bank account by ID
  @Query(() => BankAccount, {
    nullable: true,
    description: "Get a bank account by ID",
  })
  async getBankAccount(
    @Arg("id", () => ID) id: string
  ): Promise<BankAccount | null> {
    return await AppDataSource.getRepository(BankAccount).findOneBy({ id });
  }

  // Query: Get all bank accounts of current authenticated user
  @Query(() => [BankAccount], {
    description: "Get all bank accounts for the currently logged-in user",
  })
  async myBankAccounts(@Ctx() ctx: AuthContext): Promise<BankAccount[]> {
    if (!ctx.user) {
      throw new Error("Authentication required");
    }
    return await AppDataSource.getRepository(BankAccount).find({
      where: { userId: ctx.user.userId },
      order: { openedAt: "DESC" },
    });
  }

  // Query: Get all bank accounts for a specific user
  @Query(() => [BankAccount], {
    description: "Get all bank accounts belonging to a specific user ID",
  })
  async getBankAccountsByUser(
    @Arg("userId", () => ID) userId: string
  ): Promise<BankAccount[]> {
    return await AppDataSource.getRepository(BankAccount).find({
      where: { userId },
      order: { openedAt: "DESC" },
    });
  }

  // Mutation: Open a new bank account
  @Mutation(() => BankAccount, { description: "Create a new bank account" })
  async createBankAccount(
    @Args() data: CreateBankAccountInput,
    @Ctx() ctx: AuthContext
  ): Promise<BankAccount> {
    const accountRepo = AppDataSource.getRepository(BankAccount);
    const userRepo = AppDataSource.getRepository(User);

    const targetUserId =
      data.userId || (ctx.user ? ctx.user.userId : null);

    if (!targetUserId) {
      throw new Error("A valid userId or authenticated session is required");
    }

    const user = await userRepo.findOneBy({ id: targetUserId });
    if (!user) {
      throw new Error(`User with ID ${targetUserId} does not exist`);
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
      userId: targetUserId,
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
    description: "Update the status of a bank account",
  })
  async updateBankAccountStatus(
    @Arg("data") data: UpdateBankAccountStatusInput
  ): Promise<BankAccount> {
    const accountRepo = AppDataSource.getRepository(BankAccount);
    const account = await accountRepo.findOneBy({ id: data.accountId });

    if (!account) {
      throw new Error(`Bank account with ID ${data.accountId} not found`);
    }

    account.status = data.status;
    if (data.status === BankAccountStatus.CLOSED && !account.closedAt) {
      account.closedAt = new Date();
    } else if (data.status !== BankAccountStatus.CLOSED) {
      account.closedAt = null;
    }

    return await accountRepo.save(account);
  }

  // Mutation: Close bank account shortcut
  @Mutation(() => BankAccount, { description: "Close a bank account" })
  async closeBankAccount(
    @Arg("id", () => ID) id: string
  ): Promise<BankAccount> {
    const accountRepo = AppDataSource.getRepository(BankAccount);
    const account = await accountRepo.findOneBy({ id });

    if (!account) {
      throw new Error(`Bank account with ID ${id} not found`);
    }

    account.status = BankAccountStatus.CLOSED;
    account.closedAt = new Date();

    return await accountRepo.save(account);
  }

}
