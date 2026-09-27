import { ArgsType, Field, Float, ID, InputType } from "type-graphql";
import { Min } from "class-validator";
import { AccountType, BankAccountStatus } from "../entities/bank.entity";

@ArgsType()
export class CreateBankAccountInput {
  @Field(() => String, {
    nullable: true,
    description: "Optional custom account number. Auto-generated if not provided.",
  })
  accountNumber?: string;

  @Field(() => AccountType, { description: "Type of account" })
  accountType!: AccountType;

  @Field(() => Float, { description: "Minimum 1000 required" })
  @Min(1000, { message: "Initial balance must be at least 1000" })
  initialBalance!: number;

  @Field(() => String, { defaultValue: "INR" })
  currency!: string;

  @Field(() => String, {
    nullable: true,
    description: "Auto-generated if not provided.",
  })
  branchCode?: string;

  @Field(() => String, {
    nullable: true,
    description: "Auto-generated if not provided.",
  })
  ifscCode?: string;

  @Field(() => ID)
  userId!: string;
}

@InputType({ description: "Input data to update account status" })
export class UpdateBankAccountStatusInput {
  @Field(() => String)
  accountId!: string;

  @Field(() => BankAccountStatus)
  status!: BankAccountStatus;
}
