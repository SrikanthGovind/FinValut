import { ArgsType, Field, Float, ID } from "type-graphql";
import { IsOptional, Length, Min } from "class-validator";
import { TransactionType } from "../entities/transaction.entity";

@ArgsType()
export class CreateTransactionInput {
  @Field(() => ID, {
    nullable: true,
    description: "Source account. Required for DEBIT and TRANSFER.",
  })
  @IsOptional()
  fromAccountId?: string;

  @Field(() => ID, {
    nullable: true,
    description: "Destination account. Required for CREDIT and TRANSFER.",
  })
  @IsOptional()
  toAccountId?: string;

  @Field(() => TransactionType, { description: "Direction of the money movement" })
  transactionType!: TransactionType;

  @Field(() => Float, { description: "Positive amount, minimum 1" })
  @Min(1, { message: "Amount must be at least 1" })
  amount!: number;

  @Field(() => String, { defaultValue: "INR" })
  @Length(3, 3, { message: "Currency must be a 3-letter code" })
  currency!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @Length(1, 255)
  description?: string;
}
