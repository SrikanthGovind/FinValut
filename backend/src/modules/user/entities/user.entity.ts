import {
  Field,
  GraphQLISODateTime,
  ID,
  ObjectType,
  registerEnumType,
} from "type-graphql";
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

// Register enum with Type-GraphQL so it can be queried/mutated via GraphQL
registerEnumType(UserStatus, {
  name: "UserStatus",
  description: "Status of the user account",
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

  @Field(() => GraphQLISODateTime, { nullable: true })
  @Column({ type: "date", nullable: true })
  dateOfBirth?: Date;

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