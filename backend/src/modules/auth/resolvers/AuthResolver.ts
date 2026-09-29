import bcrypt from "bcrypt";
import { Args, Ctx, Mutation, Query, Resolver } from "type-graphql";
import { AppDataSource } from "../../../config/database/data-source";
import { AuthContext } from "../../../middleware/authContext";
import { User, UserStatus } from "../../user/entities/user.entity";
import { LoginInput, RegisterInput } from "../dto/auth.dto";
import { AuthPayload } from "../entities/auth.entity";
import { signAccessToken } from "../utils/jwt";

const SALT_ROUNDS = 10;

@Resolver(() => AuthPayload)
export class AuthResolver {
  // Mutation: Register a new user and issue an access token
  @Mutation(() => AuthPayload, {
    description: "Register a new user and return a signed access token",
  })
  async register(@Args() data: RegisterInput): Promise<AuthPayload> {
    const userRepo = AppDataSource.getRepository(User);

    const email = data.email.trim().toLowerCase();

    const existingUser = await userRepo.findOneBy({ email });
    if (existingUser) {
      throw new Error("An account with this email already exists");
    }

    const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);

    const user = userRepo.create({
      firstName: data.firstName.trim(),
      lastName: data.lastName?.trim(),
      email,
      password: passwordHash,
      phone: data.phone?.trim(),
      status: UserStatus.ACTIVE,
    });

    const savedUser = await userRepo.save(user);

    const { accessToken, expiresAt } = signAccessToken({
      userId: savedUser.id,
      email: savedUser.email,
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
  async login(@Args() data: LoginInput): Promise<AuthPayload> {
    const userRepo = AppDataSource.getRepository(User);

    const email = data.email.trim().toLowerCase();

    const user = await userRepo.findOneBy({ email });
    if (!user) {
      throw new Error("Invalid email or password");
    }

    const passwordMatches = await bcrypt.compare(data.password, user.password);
    if (!passwordMatches) {
      throw new Error("Invalid email or password");
    }

    if (user.status === UserStatus.BLOCKED) {
      throw new Error("Account is blocked. Contact support.");
    }

    if (user.status === UserStatus.INACTIVE) {
      throw new Error("Account is inactive. Contact support.");
    }

    const { accessToken, expiresAt } = signAccessToken({
      userId: user.id,
      email: user.email,
    });

    return { message: "Login successful", accessToken, expiresAt, user };
  }

  // Query: Re-issue an access token for the current session
  @Query(() => AuthPayload, {
    description: "Re-issue an access token for the authenticated user",
  })
  async refreshToken(@Ctx() ctx: AuthContext): Promise<AuthPayload> {
    if (!ctx.user) {
      throw new Error("Authentication required");
    }
    const user = await AppDataSource.getRepository(User).findOneBy({
      id: ctx.user.userId,
    });
    if (!user) {
      throw new Error("User not found");
    }
    const { accessToken, expiresAt } = signAccessToken({
      userId: user.id,
      email: user.email,
    });
    return { message: "Token refreshed", accessToken, expiresAt, user };
  }
}
