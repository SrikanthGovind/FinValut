import { ArgsType, Field, Float, ID } from "type-graphql";
import { IsOptional, IsString, Length, Min } from "class-validator";
import { AccountType } from "../../bank/entities/bank.entity";

/**
 * Teller and supervisory inputs. Kept separate from the customer-facing DTOs
 * because every field here either requires a staff capability or has a
 * tighter bound than its self-service equivalent.
 */

/**
 * Teller ceiling on a single cash withdrawal without approval.
 * Above this the transaction is parked in PENDING for admin review.
 */
export const CASH_WITHDRAWAL_APPROVAL_THRESHOLD = 50_000;

/** Same ceiling for customer-initiated transfers. */
export const TRANSFER_APPROVAL_THRESHOLD = 1_00_000;

@ArgsType()
export class CashDepositInput {
  @Field(() => ID, { description: "Customer account receiving the cash" })
  accountId!: string;

  @Field(() => Float, { description: "Positive amount, minimum 1" })
  @Min(1, { message: "Amount must be at least 1" })
  amount!: number;

  @Field(() => String, { nullable: true, description: "Counter or till reference" })
  @IsOptional()
  @Length(1, 64)
  tellerReference?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @Length(1, 255)
  description?: string;
}

@ArgsType()
export class CashWithdrawalInput {
  @Field(() => ID, { description: "Customer account paying out the cash" })
  accountId!: string;

  @Field(() => Float, {
    description:
      "Positive amount, minimum 1. Above the threshold the transaction waits for admin approval.",
  })
  @Min(1, { message: "Amount must be at least 1" })
  amount!: number;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @Length(1, 64)
  tellerReference?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @Length(1, 255)
  description?: string;
}

@ArgsType()
export class OpenAccountForCustomerInput {
  @Field(() => ID, { description: "Customer who will own the new account" })
  customerId!: string;

  @Field(() => AccountType)
  accountType!: AccountType;

  /**
   * No initialBalance field, deliberately.
   *
   * Self-service opening takes the opening balance from the customer, so the
   * money already exists. A counter-opened account is funded by the branch,
   * not by the customer standing there, and letting a caller set an opening
   * balance would be a request to mint money that never passed through any
   * account. The new account therefore always starts at zero and is funded by
   * a cashDeposit, which is an audited, attributable movement.
   */
  @Field(() => String, { defaultValue: "INR" })
  @IsString()
  currency!: string;
}

@ArgsType()
export class RejectTransactionInput {
  @Field(() => ID)
  transactionId!: string;

  @Field(() => String, { description: "Why the admin is rejecting this" })
  @Length(3, 255)
  reason!: string;
}

@ArgsType()
export class SetUserRoleInput {
  @Field(() => ID, { description: "User whose role is changing" })
  userId!: string;

  @Field(() => String, { description: "New role" })
  @IsString()
  role!: string;
}

@ArgsType()
export class SetUserStatusInput {
  @Field(() => ID)
  userId!: string;

  @Field(() => String, { description: "ACTIVE, INACTIVE or BLOCKED" })
  @IsString()
  status!: string;
}

@ArgsType()
export class ChangePasswordInput {
  @Field(() => String, { description: "The password currently on the account" })
  @IsString()
  currentPassword!: string;

  @Field(() => String)
  @Length(8, 128, { message: "Password must be at least 8 characters" })
  newPassword!: string;
}
