import {
  Field,
  GraphQLISODateTime,
  ID,
  ObjectType,
  registerEnumType,
} from "type-graphql";
// type-graphql re-exports only the timestamp scalars, so the date-only scalar
// comes from graphql-scalars directly. It is already a transitive dependency of
// type-graphql, hence of this project.
import { GraphQLDate } from "graphql-scalars";
import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { BankAccount } from "../../bank/entities/bank.entity";
import { Transaction } from "../../Transactions/entities/transaction.entity";

export enum UserStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  BLOCKED = "BLOCKED",
}

export enum UserRole {
  CUSTOMER = "CUSTOMER",
  TELLER = "TELLER",
  AUDITOR = "AUDITOR",
  ADMIN = "ADMIN",
}

// Register enum with Type-GraphQL so it can be queried/mutated via GraphQL
registerEnumType(UserStatus, {
  name: "UserStatus",
  description: "Status of the user account",
});

registerEnumType(UserRole, {
  name: "UserRole",
  description: "Authorization role of the user account",
});

@Entity("User")
@ObjectType({ description: "User account object" })
export class User {
  @Field(() => ID)
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Field(() => String)
  @Column({ length: 100 })
  firstName!: string;

  @Field(() => String, { nullable: true })
  @Column({ length: 100, nullable: true })
  lastName?: string;

  @Field(() => String)
  @Column({ unique: true, length: 255 })
  email!: string;

  // Sensitive field: Not exposed via GraphQL @Field()
  @Column()
  password!: string;

  @Field(() => String, { nullable: true })
  @Column({ length: 20, nullable: true })
  phone?: string;

  // GraphQLDate, not GraphQLISODateTime: the column is a Postgres `date`, which
  // the driver hands back as "2000-01-02" — a bare date with no time. The
  // DateTime scalar rejects that ("DateTime cannot represent an invalid
  // date-time-string 2000-01-02"), so declaring the field as a timestamp made
  // it unreadable: any user who set a date of birth could no longer be
  // fetched, because every query selecting this field failed to serialize.
  @Field(() => GraphQLDate, { nullable: true })
  @Column({ type: "date", nullable: true })
  // Nullable, not merely optional: the column is nullable and `updateProfile`
  // sets this to null to clear it. Declaring it `Date | undefined` would make
  // that assignment a type error and hide the clearing path.
  dateOfBirth?: Date | null;

  @Field(() => String, { nullable: true })
  @Column({ length: 12, nullable: true, unique: true })
  aadharNumber?: string;

  @Field(() => String, { nullable: true })
  @Column({ length: 10, nullable: true, unique: true })
  panNumber?: string;

  @Field(() => UserStatus)
  @Column({
    type: "enum",
    enum: UserStatus,
    default: UserStatus.ACTIVE,
  })
  status!: UserStatus;

  // Role is never accepted from client input. Only setUserRole (ADMIN-gated)
  // may change it, so escalation is always an audited event.
  @Field(() => UserRole)
  @Column({ type: "enum", enum: UserRole, default: UserRole.CUSTOMER })
  role!: UserRole;

  @Field(() => GraphQLISODateTime)
  @CreateDateColumn()
  createdAt!: Date;

  @Field(() => GraphQLISODateTime)
  @UpdateDateColumn()
  updatedAt!: Date;

  @Field(() => [BankAccount], { nullable: true })
  @OneToMany(() => BankAccount, (bankAccount) => bankAccount.user)
  bankAccounts?: BankAccount[];

  @Field(() => [Transaction], { nullable: true })
  @OneToMany(() => Transaction, (transaction) => transaction.fromAccount)
  sentTransactions?: Transaction[];

  @Field(() => [Transaction], { nullable: true })
  @OneToMany(() => Transaction, (transaction) => transaction.toAccount)
  receivedTransactions?: Transaction[];
}