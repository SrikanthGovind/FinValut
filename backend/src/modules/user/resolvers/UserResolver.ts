import { Arg, Args, Ctx, FieldResolver, ID, Mutation, Query, Resolver, Root } from "type-graphql";
import { User } from "../entities/user.entity";
import { CreateUserInput } from "../dto/user.dto";
import { BankAccount } from "../../bank/entities/bank.entity";
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

  // Field Resolver: Fetch bank accounts for user on-demand
  @FieldResolver(() => [BankAccount])
  async bankAccounts(@Root() user: User): Promise<BankAccount[]> {
    return await AppDataSource.getRepository(BankAccount).find({
      where: { userId: user.id },
      order: { openedAt: "DESC" },
    });
  }
}

