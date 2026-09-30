import { ArgsType, Field, ID } from "type-graphql";
import {
  IsDate,
  IsEmail,
  IsOptional,
  Length,
  Matches,
  MinLength,
} from "class-validator";

/**
 * @deprecated CreateUserInput is no longer reachable from any resolver.
 * It existed to let staff mint accounts with a chosen password, which is an
 * account-takeover primitive: anyone who can call it can set a known password
 * on an arbitrary account. Use `register` for self-service signup and
 * `openAccountForCustomer` for a customer who has already signed up.
 */
@ArgsType()
export class CreateUserInput {
  @Field(() => String, { nullable: false })
  @Length(1, 100)
  firstName!: string;

  @Field(() => String, { nullable: false })
  @Length(1, 100)
  lastName!: string;

  @Field(() => String, { nullable: false })
  @IsEmail()
  email!: string;

  @Field(() => String, { nullable: false })
  @MinLength(8, { message: "Password must be at least 8 characters" })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])/, {
    message:
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
  })
  password!: string;

  @Field(() => String, { nullable: false })
  @Length(10, 20)
  phone!: string;
}

/**
 * Every field is optional and the resolver applies only the ones present.
 * That distinction matters: an absent field means "leave it alone", whereas an
 * explicit null is how a user clears a value.
 */
@ArgsType()
export class UpdateProfileInput {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @Length(1, 100)
  firstName?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @Length(1, 100)
  lastName?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @Length(10, 20)
  phone?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsDate()
  dateOfBirth?: string;
}

@ArgsType()
export class SetUserRoleInput {
  @Field(() => ID, { description: "User whose role is changing" })
  userId!: string;

  @Field(() => String, {
    description: "New role: CUSTOMER, TELLER, AUDITOR or ADMIN",
  })
  @Length(1, 40)
  role!: string;
}

@ArgsType()
export class SetUserStatusInput {
  @Field(() => ID, { description: "User whose status is changing" })
  userId!: string;

  @Field(() => String, { description: "New status: ACTIVE, INACTIVE or BLOCKED" })
  @Length(1, 20)
  status!: string;
}

@ArgsType()
export class ChangePasswordInput {
  @Field(() => String, { description: "The password currently on the account" })
  @Length(1, 128)
  currentPassword!: string;

  @Field(() => String)
  @MinLength(8, { message: "New password must be at least 8 characters" })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])/, {
    message:
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
  })
  newPassword!: string;
}
