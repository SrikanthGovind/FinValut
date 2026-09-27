import {
  Field,
  Float,
  GraphQLISODateTime,
  ID,
  ObjectType,
  registerEnumType,
} from "type-graphql";
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { User } from "../../user/entities/user.entity";

export enum AccountType {
  SAVINGS = "SAVINGS",
  CURRENT = "CURRENT",
  SALARY = "SALARY",
  FIXED_DEPOSIT = "FIXED_DEPOSIT",
}

export enum BankAccountStatus {
  ACTIVE = "ACTIVE",
  DORMANT = "DORMANT",
  FROZEN = "FROZEN",
  CLOSED = "CLOSED",
}

registerEnumType(AccountType, {
  name: "AccountType",
  description: "Type of bank account",
});

registerEnumType(BankAccountStatus, {
  name: "BankAccountStatus",
  description: "Operational status of the bank account",
});

@Entity("BankAccount")
@ObjectType({ description: "Bank account entity" })
export class BankAccount {
  @Field(() => ID)
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Field(() => String)
  @Column({ unique: true, length: 30 })
  accountNumber!: string;

  @Field(() => AccountType)
  @Column({
    type: "enum",
    enum: AccountType,
    default: AccountType.SAVINGS,
  })
  accountType!: AccountType;

  @Field(() => Float)
  @Column({
    type: "decimal",
    precision: 14,
    scale: 2,
    default: 0.0,
    transformer: {
      to: (val: number) => val,
      from: (val: string) => (val ? parseFloat(val) : 0),
    },
  })
  balance!: number;

  @Field(() => String)
  @Column({ length: 10, default: "INR" })
  currency!: string;

  @Field(() => String)
  @Column({ length: 20 })
  branchCode!: string;

  @Field(() => String)
  @Column({ length: 20 })
  ifscCode!: string;

  @Field(() => BankAccountStatus)
  @Column({
    type: "enum",
    enum: BankAccountStatus,
    default: BankAccountStatus.ACTIVE,
  })
  status!: BankAccountStatus;

  @Field(() => GraphQLISODateTime)
  @CreateDateColumn({ type: "timestamp" })
  openedAt!: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  @Column({ type: "timestamp", nullable: true })
  closedAt?: Date | null;

  @Field(() => ID)
  @Column({ type: "uuid" })
  userId!: string;

  @ManyToOne(() => User, (user) => user.bankAccounts, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user?: User;
}
