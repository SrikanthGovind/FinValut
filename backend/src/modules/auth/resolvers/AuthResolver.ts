import bcrypt from "bcrypt";
import { Args, Authorized, Ctx, Mutation, Query, Resolver } from "type-graphql";
import { AppDataSource } from "../../../config/database/data-source";
import { AuthContext } from "../../../middleware/authContext";
import { User, UserRole, UserStatus } from "../../user/entities/user.entity";
import { LoginInput, RegisterInput } from "../dto/auth.dto";
import { AuthPayload } from "../entities/auth.entity";
import { signAccessToken } from "../utils/jwt";
import { AuditAction, AuditOutcome } from "../../audit/entities/audit-log.entity";
import { writeAuditLog } from "../../audit/services/audit.service";

const SALT_ROUNDS = 10;

@Resolver(() => AuthPayload)
export class AuthResolver {
  // Mutation: Register a new user and issue an access token
  @Mutation(() => AuthPayload, {
    description: "Register a new user and return a signed access token",
  })
  async register(
    @Ctx() ctx: AuthContext,
    @Args() data: RegisterInput
  ): Promise<AuthPayload> {
    const userRepo = AppDataSource.getRepository(User);

    const email = data.email.trim().toLowerCase();

    const existingUser = await userRepo.findOneBy({ email });
    if (existingUser) {
      throw new Error("An account with this email already exists");
    }

    if (data.email.length > 254) {
      throw new Error("Email is too long");
    }

    const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);

    const user = userRepo.create({
      firstName: data.firstName.trim(),
      lastName: data.lastName?.trim(),
      email,
      password: passwordHash,
      phone: data.phone?.trim(),
      status: UserStatus.ACTIVE,
      // Self-registration can never grant itself elevated rights.
      role: UserRole.CUSTOMER,
    });

    const savedUser = await userRepo.save(user);

    const { accessToken, expiresAt } = signAccessToken({
      userId: savedUser.id,
      email: savedUser.email,
      role: savedUser.role,
    });

    await writeAuditLog({
      action: AuditAction.REGISTER,
      outcome: AuditOutcome.SUCCESS,
      ctx,
      actorId: savedUser.id,
      actorRole: savedUser.role,
      entityType: "User",
      entityId: savedUser.id,
    });

    return {
      message: "Registration successful",
      accessToken,
      expiresAt,
      user: savedUser,
    };
  }

  // Mutation: Login with email + password
  @Mutation(() => AuthPayload, {
    description: "Authenticate with email and password",
  })
  async login(
    @Ctx() ctx: AuthContext,
    @Args() data: LoginInput
  ): Promise<AuthPayload> {
    const userRepo = AppDataSource.getRepository(User);

    const email = data.email.trim().toLowerCase();

    const user = await userRepo.findOneBy({ email });
    if (!user) {
      await writeAuditLog({
        action: AuditAction.LOGIN_FAILED,
        outcome: AuditOutcome.FAILURE,
        ctx,
        entityType: "User",
        reason: "No account for the supplied email",
      });
      throw new Error("Invalid email or password");
    }

    const passwordMatches = await bcrypt.compare(data.password, user.password);
    if (!passwordMatches) {
      await writeAuditLog({
        action: AuditAction.LOGIN_FAILED,
        outcome: AuditOutcome.FAILURE,
        ctx,
        actorId: user.id,
        actorRole: user.role,
        entityType: "User",
        entityId: user.id,
        reason: "Password did not match",
      });
      throw new Error("Invalid email or password");
    }

    if (user.status === UserStatus.BLOCKED) {
      await writeAuditLog({
        action: AuditAction.LOGIN_FAILED,
        outcome: AuditOutcome.FAILURE,
        ctx,
        actorId: user.id,
        actorRole: user.role,
        entityType: "User",
        entityId: user.id,
        reason: "Account is BLOCKED",
      });
      throw new Error("Account is blocked. Contact support.");
    }

    if (user.status === UserStatus.INACTIVE) {
      await writeAuditLog({
        action: AuditAction.LOGIN_FAILED,
        outcome: AuditOutcome.FAILURE,
        ctx,
        actorId: user.id,
        actorRole: user.role,
        entityType: "User",
        entityId: user.id,
        reason: "Account is INACTIVE",
      });
      throw new Error("Account is inactive. Contact support.");
    }

    const { accessToken, expiresAt } = signAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    await writeAuditLog({
      action: AuditAction.LOGIN,
      outcome: AuditOutcome.SUCCESS,
      ctx,
      actorId: user.id,
      actorRole: user.role,
      entityType: "User",
      entityId: user.id,
    });

    return { message: "Login successful", accessToken, expiresAt, user };
  }

  // Query: Re-issue an access token for the current session
  @Authorized()
  @Query(() => AuthPayload, {
    description: "Re-issue an access token for the authenticated user",
  })
  async refreshToken(@Ctx() ctx: AuthContext): Promise<AuthPayload> {
    if (!ctx.user) {
      throw new Error("Authentication required");
    }

    // Re-read the user rather than trusting the JWT claims. The token's role
    // can be up to JWT_EXPIRES_IN old, so a refresh is the natural point to
    // pick up a demotion, a block, or a deletion. This also means a refresh
    // cannot be used to keep a revoked session alive.
    const user = await AppDataSource.getRepository(User).findOneBy({
      id: ctx.user.userId,
    });
    if (!user) {
      throw new Error("User not found");
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new Error(
        user.status === UserStatus.BLOCKED
          ? "Account is blocked. Contact support."
          : "Account is inactive. Contact support."
      );
    }
    const { accessToken, expiresAt } = signAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });
    return { message: "Token refreshed", accessToken, expiresAt, user };
  }
}
