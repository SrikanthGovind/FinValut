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
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { BankAccount } from "../../bank/entities/bank.entity";

export enum TransactionType {
  DEBIT = "DEBIT",
  CREDIT = "CREDIT",
  TRANSFER = "TRANSFER",
}

export enum TransactionStatus {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  REVERSED = "REVERSED",
}

registerEnumType(TransactionType, {
  name: "TransactionType",
  description: "Direction of the money movement",
});

registerEnumType(TransactionStatus, {
  name: "TransactionStatus",
  description: "Lifecycle status of the transaction",
});

@Entity("Transaction")
@ObjectType({ description: "Bank transaction object" })
export class Transaction {
  @Field(() => ID)
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Field(() => String)
  @Index({ unique: true })
  @Column({ unique: true, length: 24 })
  referenceNumber!: string;

  @Field(() => TransactionType)
  @Column({ type: "enum", enum: TransactionType })
  transactionType!: TransactionType;

  @Field(() => TransactionStatus)
  @Column({ type: "enum", enum: TransactionStatus, default: TransactionStatus.PENDING })
  status!: TransactionStatus;

  @Field(() => Float)
  @Column({
    type: "decimal",
    precision: 14,
    scale: 2,
    transformer: {
      to: (val: number) => val,
      from: (val: string) => (val ? parseFloat(val) : 0),
    },
  })
  amount!: number;

  @Field(() => String)
  @Column({ length: 10, default: "INR" })
  currency!: string;

  @Field(() => String, { nullable: true })
  @Column({ type: "varchar", length: 255, nullable: true })
  description?: string | null;

  @Field(() => ID, { nullable: true })
  @Column({ type: "uuid", nullable: true })
  fromAccountId?: string | null;

  @Field(() => ID, { nullable: true })
  @Column({ type: "uuid", nullable: true })
  toAccountId?: string | null;

  @Field(() => GraphQLISODateTime)
  @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  transactionDate!: Date;

  @Field(() => GraphQLISODateTime)
  @CreateDateColumn({ type: "timestamp" })
  createdAt!: Date;

  @ManyToOne(() => BankAccount, { onDelete: "CASCADE", nullable: true })
  @JoinColumn({ name: "fromAccountId" })
  fromAccount?: BankAccount;

  @ManyToOne(() => BankAccount, { onDelete: "CASCADE", nullable: true })
  @JoinColumn({ name: "toAccountId" })
  toAccount?: BankAccount;
}
