import { Arg, Args, Ctx, FieldResolver, ID, Mutation, Query, Resolver, Root } from "type-graphql";
import { User } from "../entities/user.entity";
import { CreateUserInput } from "../dto/user.dto";
import { BankAccount } from "../../bank/entities/bank.entity";
import { Transaction } from "../../Transactions/entities/transaction.entity";
import { AppDataSource } from "../../../config/database/data-source";
import { AuthContext } from "../../../middleware/authContext";

@Resolver(() => User)
export class UserResolver {
  // Get a user by ID
  @Query(() => User, { nullable: true, description: "Get a user by ID" })
  async getUser(
    @Arg("id", () => ID) id: string
  ): Promise<User | null> {
    return await AppDataSource.getRepository(User).findOneBy({ id });
  }

  // Get all users
  @Query(() => [User], { description: "Get list of all users" })
  async getUsers(): Promise<User[]> {
    return await AppDataSource.getRepository(User).find();
  }

  // Get currently authenticated user
  @Query(() => User, { nullable: true, description: "Get currently authenticated user" })
  async me(@Ctx() ctx: AuthContext): Promise<User | null> {
    if (!ctx.user) {
      return null;
    }
    return await AppDataSource.getRepository(User).findOneBy({
      id: ctx.user.userId,
    });
  }

  // Create a new user
  @Mutation(() => String)
  async createUser(
    @Args() data: CreateUserInput
  ): Promise<string> {
    await AppDataSource.getRepository(User).save(
      AppDataSource.getRepository(User).create(data)
    )
    return 'User Created Successfully';
  }

  // Get all transactions of a user (both sent and received)
  @Query(() => [Transaction], {
    description: "Get all transactions of a user, sent and received",
  })
  async getUserTransactions(
    @Ctx() ctx: AuthContext,
    @Arg("userId", () => ID, { nullable: true }) userId?: string
  ): Promise<Transaction[]> {
    const targetUserId = userId ?? ctx.user?.userId;
    if (!targetUserId) {
      throw new Error("A valid userId or authenticated session is required");
    }

    return await AppDataSource.getRepository(Transaction)
      .createQueryBuilder("transaction")
      .leftJoin(
        BankAccount,
        "fromAccount",
        "fromAccount.id = transaction.fromAccountId"
      )
      .leftJoin(
        BankAccount,
        "toAccount",
        "toAccount.id = transaction.toAccountId"
      )
      .where("fromAccount.userId = :userId", { userId: targetUserId })
      .orWhere("toAccount.userId = :userId", { userId: targetUserId })
      .orderBy("transaction.transactionDate", "DESC")
      .getMany();
  }

  // Field Resolver: Fetch bank accounts for user on-demand
  @FieldResolver(() => [BankAccount])
  async bankAccounts(@Root() user: User): Promise<BankAccount[]> {
    return await AppDataSource.getRepository(BankAccount).find({
      where: { userId: user.id },
      order: { openedAt: "DESC" },
    });
  }

  // Field Resolver: Fetch transactions sent by the user
  @FieldResolver(() => [Transaction])
  async sentTransactions(@Root() user: User): Promise<Transaction[]> {
    return await AppDataSource.getRepository(Transaction).find({
      where: { fromAccount: { userId: user.id } },
      order: { transactionDate: "DESC" },
      relations: { fromAccount: true },
    });
  }

  // Field Resolver: Fetch transactions received by the user
  @FieldResolver(() => [Transaction])
  async receivedTransactions(@Root() user: User): Promise<Transaction[]> {
    return await AppDataSource.getRepository(Transaction).find({
      where: { toAccount: { userId: user.id } },
      order: { transactionDate: "DESC" },
      relations: { toAccount: true },
    });
  }
}

