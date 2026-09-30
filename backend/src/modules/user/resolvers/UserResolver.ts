import bcrypt from "bcrypt";
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
import { User, UserRole, UserStatus } from "../entities/user.entity";
import { BankAccount } from "../../bank/entities/bank.entity";
import { Transaction } from "../../Transactions/entities/transaction.entity";
import { AppDataSource } from "../../../config/database/data-source";
import { AuthContext } from "../../../middleware/authContext";
import { CAPABILITIES, hasPermission } from "../../../permissions";
import { AuditAction, AuditOutcome } from "../../audit/entities/audit-log.entity";
import { buildChanges, writeAuditLog } from "../../audit/services/audit.service";
import {
  ChangePasswordInput,
  SetUserRoleInput,
  SetUserStatusInput,
  UpdateProfileInput,
} from "../dto/user.dto";

/**
 * Masks all but the last 4 characters.
 *
 * An auditor needs to confirm an identity document was recorded without
 * seeing it. Returning null for a missing value keeps the response shape
 * stable and avoids leaking "which records have no document".
 */
function maskIdentifier(value?: string | null): string | null {
  if (!value) {
    return null;
  }
  if (value.length <= 4) {
    return "*".repeat(value.length);
  }
  return "*".repeat(value.length - 4) + value.slice(-4);
}

@Resolver(() => User)
export class UserResolver {
  private static requireUser(ctx: AuthContext): NonNullable<AuthContext["user"]> {
    if (!ctx.user) {
      throw new Error("Authentication required");
    }
    return ctx.user;
  }

  // Query: Get the caller's own record by ID
  @Query(() => User, {
    nullable: true,
    description:
      "Get a user by ID (own record only, unless the role holds USER_READ)",
  })
  @Authorized()
  async getUser(
    @Ctx() ctx: AuthContext,
    @Arg("id", () => ID) id: string
  ): Promise<User | null> {
    const caller = UserResolver.requireUser(ctx);
    if (caller.userId !== id && !hasPermission(caller.role, CAPABILITIES.USER_READ)) {
      // null, not an error, so a caller cannot probe which user IDs exist.
      return null;
    }
    return await AppDataSource.getRepository(User).findOneBy({ id });
  }

  // Query: Get all users. Staff tooling only.
  @Query(() => [User], {
    description: "Get list of all users (auditor or admin)",
  })
  @Authorized(CAPABILITIES.USER_READ)
  async getUsers(): Promise<User[]> {
    return await AppDataSource.getRepository(User).find();
  }

  // Query: Get currently authenticated user
  @Query(() => User, { nullable: true, description: "Get currently authenticated user" })
  @Authorized()
  async me(@Ctx() ctx: AuthContext): Promise<User | null> {
    const caller = UserResolver.requireUser(ctx);
    return await AppDataSource.getRepository(User).findOneBy({
      id: caller.userId,
    });
  }

  // Query: Get all transactions of a user (both sent and received)
  @Query(() => [Transaction], {
    description: "Get all transactions of a user, sent and received",
  })
  @Authorized()
  async getUserTransactions(
    @Ctx() ctx: AuthContext,
    @Arg("userId", () => ID, { nullable: true }) userId?: string
  ): Promise<Transaction[]> {
    const caller = UserResolver.requireUser(ctx);
    const targetUserId = userId ?? caller.userId;

    if (
      targetUserId !== caller.userId &&
      !hasPermission(caller.role, CAPABILITIES.TRANSACTION_READ_ANY)
    ) {
      throw new Error("Not authorized to view another user's transactions");
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

  // Mutation: Update the caller's own profile
  @Mutation(() => User, {
    description: "Update your own profile (name, phone, date of birth)",
  })
  @Authorized(CAPABILITIES.USER_UPDATE_OWN)
  async updateProfile(
    @Ctx() ctx: AuthContext,
    @Args() data: UpdateProfileInput
  ): Promise<User> {
    const caller = UserResolver.requireUser(ctx);
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOneBy({ id: caller.userId });

    if (!user) {
      throw new Error("Authenticated user no longer exists");
    }

    // Only the fields named in the input are touched, so a partial update
    // cannot blank out a field the caller did not send.
    const before = {
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      dateOfBirth: user.dateOfBirth,
    };

    if (data.firstName !== undefined) user.firstName = data.firstName;
    if (data.lastName !== undefined) user.lastName = data.lastName;
    if (data.phone !== undefined) user.phone = data.phone;
    if (data.dateOfBirth !== undefined) {
      user.dateOfBirth = new Date(data.dateOfBirth);
    }

    const saved = await userRepo.save(user);

    await writeAuditLog({
      action: AuditAction.PROFILE_UPDATED,
      outcome: AuditOutcome.SUCCESS,
      ctx,
      entityType: "User",
      entityId: saved.id,
      changes: buildChanges(before, {
        firstName: saved.firstName,
        lastName: saved.lastName,
        phone: saved.phone,
        dateOfBirth: saved.dateOfBirth,
      }),
    });

    return saved;
  }

  // Mutation: Change the caller's own password
  @Mutation(() => User, {
    description: "Change your own password (requires the current password)",
  })
  @Authorized(CAPABILITIES.USER_UPDATE_OWN)
  async changePassword(
    @Ctx() ctx: AuthContext,
    @Args() data: ChangePasswordInput
  ): Promise<User> {
    const caller = UserResolver.requireUser(ctx);
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOneBy({ id: caller.userId });

    if (!user) {
      throw new Error("Authenticated user no longer exists");
    }

    const passwordMatches = await bcrypt.compare(
      data.currentPassword,
      user.password
    );

    if (!passwordMatches) {
      // Deliberately the same message as "no such user": confirming which
      // half was wrong would help an attacker probe the credential.
      await writeAuditLog({
        action: AuditAction.PASSWORD_CHANGED,
        outcome: AuditOutcome.FAILURE,
        ctx,
        entityType: "User",
        entityId: user.id,
        reason: "Current password did not match",
      });
      throw new Error("Current password is incorrect");
    }

    if (data.currentPassword === data.newPassword) {
      throw new Error("New password must be different from the current one");
    }

    user.password = await bcrypt.hash(data.newPassword, 10);
    const saved = await userRepo.save(user);

    // The diff intentionally records only that it happened: the password
    // itself is redacted by the audit service even if it were passed through.
    await writeAuditLog({
      action: AuditAction.PASSWORD_CHANGED,
      outcome: AuditOutcome.SUCCESS,
      ctx,
      entityType: "User",
      entityId: saved.id,
      changes: { password: { to: "[redacted]" } },
    });

    return saved;
  }

  // Mutation: Change a user's role (admin only)
  @Mutation(() => User, {
    description: "Set a user's role (admin only)",
  })
  @Authorized(CAPABILITIES.USER_UPDATE)
  async setUserRole(
    @Ctx() ctx: AuthContext,
    @Args() data: SetUserRoleInput
  ): Promise<User> {
    const caller = UserResolver.requireUser(ctx);
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOneBy({ id: data.userId });

    if (!user) {
      throw new Error(`User with ID ${data.userId} not found`);
    }

    // Validate before assigning: an unrecognised role must not be written,
    // because hasPermission treats an unknown role as holding nothing, which
    // would silently lock the user out of their own account.
    if (!Object.values(UserRole).includes(data.role as UserRole)) {
      throw new Error(
        `"${data.role}" is not a valid role. Valid roles: ${Object.values(UserRole).join(", ")}`
      );
    }

    const newRole = data.role as UserRole;

    if (newRole === user.role) {
      return user;
    }

    // Two ways to strand the system with no one able to administer it. Both
    // are self-inflicted lockout unless explicitly prevented here.
    if (user.id === caller.userId) {
      throw new Error("You cannot change your own role");
    }

    if (user.role === UserRole.ADMIN) {
      const remainingAdmins = await userRepo.countBy({ role: UserRole.ADMIN });
      if (remainingAdmins <= 1) {
        throw new Error(
          "Cannot demote the last remaining admin. Promote another user to admin first."
        );
      }
    }

    const before = { role: user.role };
    user.role = newRole;
    const saved = await userRepo.save(user);

    await writeAuditLog({
      action: AuditAction.ROLE_CHANGED,
      outcome: AuditOutcome.SUCCESS,
      ctx,
      entityType: "User",
      entityId: saved.id,
      changes: buildChanges(before, { role: saved.role }, ["role"]),
    });

    return saved;
  }

  // Mutation: Change a user's status (admin only)
  @Mutation(() => User, {
    description: "Set a user's status: ACTIVE, INACTIVE or BLOCKED (admin only)",
  })
  @Authorized(CAPABILITIES.USER_UPDATE)
  async setUserStatus(
    @Ctx() ctx: AuthContext,
    @Args() data: SetUserStatusInput
  ): Promise<User> {
    const caller = UserResolver.requireUser(ctx);
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOneBy({ id: data.userId });

    if (!user) {
      throw new Error(`User with ID ${data.userId} not found`);
    }

    if (!Object.values(UserStatus).includes(data.status as UserStatus)) {
      throw new Error(
        `"${data.status}" is not a valid status. Valid values: ${Object.values(UserStatus).join(", ")}`
      );
    }

    if (user.id === caller.userId) {
      throw new Error("You cannot change your own status");
    }

    if (
      user.role === UserRole.ADMIN &&
      data.status !== UserStatus.ACTIVE
    ) {
      const remainingAdmins = await userRepo.countBy({ role: UserRole.ADMIN });
      if (remainingAdmins <= 1) {
        throw new Error(
          "Cannot block the last remaining admin. Promote another user to admin first."
        );
      }
    }

    const newStatus = data.status as UserStatus;

    if (newStatus === user.status) {
      return user;
    }

    const before = { status: user.status };
    user.status = newStatus;
    const saved = await userRepo.save(user);

    await writeAuditLog({
      action: AuditAction.USER_STATUS_CHANGED,
      outcome: AuditOutcome.SUCCESS,
      ctx,
      entityType: "User",
      entityId: saved.id,
      changes: buildChanges(before, { status: saved.status }, ["status"]),
      reason: "Status set by administrator",
    });

    return saved;
  }

  // Field Resolver: Aadhaar, masked unless the role may read identity in full
  @FieldResolver(() => String, { nullable: true })
  async aadharNumber(
    @Root() user: User,
    @Ctx() ctx: AuthContext
  ): Promise<string | null> {
    if (hasPermission(ctx.user?.role, CAPABILITIES.USER_IDENTITY_READ_FULL)) {
      return user.aadharNumber ?? null;
    }
    return maskIdentifier(user.aadharNumber);
  }

  // Field Resolver: PAN, masked unless the role may read identity in full
  @FieldResolver(() => String, { nullable: true })
  async panNumber(
    @Root() user: User,
    @Ctx() ctx: AuthContext
  ): Promise<string | null> {
    if (hasPermission(ctx.user?.role, CAPABILITIES.USER_IDENTITY_READ_FULL)) {
      return user.panNumber ?? null;
    }
    return maskIdentifier(user.panNumber);
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
