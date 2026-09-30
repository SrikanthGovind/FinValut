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
  /** Counter deposit of physical cash, performed by a TELLER. */
  CASH_DEPOSIT = "CASH_DEPOSIT",
  /** Counter withdrawal of physical cash, performed by a TELLER. */
  CASH_WITHDRAWAL = "CASH_WITHDRAWAL",
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

  /**
   * How the money moved: SELF_SERVICE for customer-initiated requests, COUNTER
   * for teller-handled cash. Absent for older rows, so nullable rather than
   * defaulted.
   *
   * An explicit varchar type is required: the `string | null` union defeats
   * TypeORM's reflect-metadata type inference and it otherwise tries to map the
   * column as "Object", which Postgres rejects.
   */
  @Field(() => String, { nullable: true })
  @Column({ type: "varchar", length: 32, nullable: true })
  channel?: string | null;

  /**
   * Staff member who performed a counter operation. Null for self-service.
   *
   * Indexed because the audit and reconciliation questions this answers are
   * always "everything this teller did", and the approval queue is reached
   * from here. The name is pinned rather than auto-generated so it matches the
   * index the migration created; an undeclared index makes `migration:generate`
   * emit a migration that drops it.
   */
  @Field(() => ID, { nullable: true })
  @Index("IDX_transaction_tellerId")
  @Column({ type: "uuid", nullable: true })
  tellerId?: string | null;

  /** Set when the transaction is awaiting admin approval. */
  @Field(() => GraphQLISODateTime, { nullable: true })
  @Column({ type: "timestamp", nullable: true })
  approvedAt?: Date | null;

  @Field(() => ID, { nullable: true })
  @Column({ type: "uuid", nullable: true })
  approvedById?: string | null;

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
