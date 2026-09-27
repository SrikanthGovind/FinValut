import {
  Arg,
  Args,
  Ctx,
  FieldResolver,
  ID,
  Mutation,
  Query,
  Resolver,
  Root,
} from "type-graphql";
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from "../entities/transaction.entity";
import { CreateTransactionInput } from "../dto/transaction.dto";
import { BankAccount, BankAccountStatus } from "../../bank/entities/bank.entity";
import { AppDataSource } from "../../../config/database/data-source";
import { AuthContext } from "../../../middleware/authContext";

@Resolver(() => Transaction)
export class TransactionResolver {
  // Query: Get all transactions
  @Query(() => [Transaction], { description: "Get list of all transactions" })
  async getTransactions(): Promise<Transaction[]> {
    return await AppDataSource.getRepository(Transaction).find({
      order: { transactionDate: "DESC" },
    });
  }

  // Query: Get single transaction by ID
  @Query(() => Transaction, {
    nullable: true,
    description: "Get a transaction by ID",
  })
  async getTransaction(
    @Arg("id", () => ID) id: string
  ): Promise<Transaction | null> {
    return await AppDataSource.getRepository(Transaction).findOneBy({ id });
  }

  // Query: Get all transactions for the currently authenticated user
  @Query(() => [Transaction], {
    description: "Get all transactions for the currently logged-in user",
  })
  async myTransactions(@Ctx() ctx: AuthContext): Promise<Transaction[]> {
    if (!ctx.user) {
      throw new Error("Authentication required");
    }
    return await AppDataSource.getRepository(Transaction)
      .createQueryBuilder("transaction")
      .leftJoin(
        BankAccount,
        "account",
        "account.id = transaction.fromAccountId"
      )
      .leftJoin(
        BankAccount,
        "counterparty",
        "counterparty.id = transaction.toAccountId"
      )
      .where("account.userId = :userId", { userId: ctx.user.userId })
      .orWhere("counterparty.userId = :userId", { userId: ctx.user.userId })
      .orderBy("transaction.transactionDate", "DESC")
      .getMany();
  }

  // Query: Get all transactions on a specific bank account
  @Query(() => [Transaction], {
    description: "Get all transactions for a specific bank account ID",
  })
  async getTransactionsByAccount(
    @Arg("accountId", () => ID) accountId: string
  ): Promise<Transaction[]> {
    return await AppDataSource.getRepository(Transaction)
      .createQueryBuilder("transaction")
      .where("transaction.fromAccountId = :accountId", { accountId })
      .orWhere("transaction.toAccountId = :accountId", { accountId })
      .orderBy("transaction.transactionDate", "DESC")
      .getMany();
  }

  // Mutation: Record a transaction and move the balance atomically
  @Mutation(() => Transaction, {
    description: "Record a transaction between two bank accounts",
  })
  async createTransaction(
    @Args() data: CreateTransactionInput
  ): Promise<Transaction> {
    if (!data.fromAccountId && !data.toAccountId) {
      throw new Error("At least one of fromAccountId or toAccountId is required");
    }

    if (
      data.transactionType === TransactionType.TRANSFER &&
      (!data.fromAccountId || !data.toAccountId)
    ) {
      throw new Error("TRANSFER requires both fromAccountId and toAccountId");
    }

    if (
      data.transactionType === TransactionType.DEBIT &&
      !data.fromAccountId
    ) {
      throw new Error("DEBIT requires fromAccountId");
    }

    if (data.transactionType === TransactionType.CREDIT && !data.toAccountId) {
      throw new Error("CREDIT requires toAccountId");
    }

    if (data.fromAccountId && data.fromAccountId === data.toAccountId) {
      throw new Error("Source and destination accounts must be different");
    }

    return await AppDataSource.transaction(async (manager) => {
      const accountRepo = manager.getRepository(BankAccount);

      // Lock every participating row with SELECT ... FOR UPDATE, in a stable
      // sorted order. Without FOR UPDATE two concurrent transactions both read
      // the same balance and both write it back (lost update / money created).
      // Sorted IDs stop A->B and B->A from deadlocking on each other.
      const accountIds = [data.fromAccountId, data.toAccountId]
        .filter((accountId): accountId is string => !!accountId)
        .sort();

      const lockedAccounts = await accountRepo
        .createQueryBuilder("account")
        .setLock("pessimistic_write")
        .where("account.id IN (:...accountIds)", { accountIds })
        .getMany();

      const accountsById = new Map(
        lockedAccounts.map((account) => [account.id, account])
      );

      const fromAccount = data.fromAccountId
        ? accountsById.get(data.fromAccountId) ?? null
        : null;
      const toAccount = data.toAccountId
        ? accountsById.get(data.toAccountId) ?? null
        : null;

      if (data.fromAccountId && !fromAccount) {
        throw new Error(`Bank account with ID ${data.fromAccountId} not found`);
      }

      if (data.toAccountId && !toAccount) {
        throw new Error(`Bank account with ID ${data.toAccountId} not found`);
      }

      if (fromAccount && fromAccount.status !== BankAccountStatus.ACTIVE) {
        throw new Error(`Source account ${fromAccount.accountNumber} is not ACTIVE`);
      }

      if (toAccount && toAccount.status !== BankAccountStatus.ACTIVE) {
        throw new Error(`Destination account ${toAccount.accountNumber} is not ACTIVE`);
      }

      if (fromAccount && fromAccount.balance < data.amount) {
        throw new Error("Insufficient balance in the source account");
      }

      if (fromAccount) {
        fromAccount.balance = Number(
          (fromAccount.balance - data.amount).toFixed(2)
        );
        await accountRepo.save(fromAccount);
      }

      if (toAccount) {
        toAccount.balance = Number((toAccount.balance + data.amount).toFixed(2));
        await accountRepo.save(toAccount);
      }

      const newTransaction = manager.getRepository(Transaction).create({
        referenceNumber: `TXN${Date.now()}${Math.floor(Math.random() * 10000)
          .toString()
          .padStart(4, "0")}`,
        transactionType: data.transactionType,
        status: TransactionStatus.COMPLETED,
        amount: data.amount,
        currency: data.currency || "INR",
        description: data.description ?? null,
        fromAccountId: data.fromAccountId ?? null,
        toAccountId: data.toAccountId ?? null,
        transactionDate: new Date(),
      });

      return await manager.getRepository(Transaction).save(newTransaction);
    });
  }

  // Mutation: Reverse a completed transaction and restore the balance
  @Mutation(() => Transaction, { description: "Reverse a completed transaction" })
  async reverseTransaction(
    @Arg("id", () => ID) id: string
  ): Promise<Transaction> {
    return await AppDataSource.transaction(async (manager) => {
      const transactionRepo = manager.getRepository(Transaction);
      const accountRepo = manager.getRepository(BankAccount);

      // Lock the transaction row first so two concurrent reversals of the same
      // transaction cannot both see status COMPLETED.
      const existing = await transactionRepo
        .createQueryBuilder("transaction")
        .setLock("pessimistic_write")
        .where("transaction.id = :id", { id })
        .getOne();

      if (!existing) {
        throw new Error(`Transaction with ID ${id} not found`);
      }

      if (existing.status === TransactionStatus.REVERSED) {
        throw new Error("Transaction is already reversed");
      }

      if (existing.status !== TransactionStatus.COMPLETED) {
        throw new Error("Only COMPLETED transactions can be reversed");
      }

      const accountIds = [existing.fromAccountId, existing.toAccountId]
        .filter((accountId): accountId is string => !!accountId)
        .sort();

      const lockedAccounts = await accountRepo
        .createQueryBuilder("account")
        .setLock("pessimistic_write")
        .where("account.id IN (:...accountIds)", { accountIds })
        .getMany();

      const accountsById = new Map(
        lockedAccounts.map((account) => [account.id, account])
      );

      const fromAccount = existing.fromAccountId
        ? accountsById.get(existing.fromAccountId) ?? null
        : null;

      if (fromAccount) {
        fromAccount.balance = Number(
          (fromAccount.balance + existing.amount).toFixed(2)
        );
        await accountRepo.save(fromAccount);
      }

      const toAccount = existing.toAccountId
        ? accountsById.get(existing.toAccountId) ?? null
        : null;

      if (toAccount) {
        toAccount.balance = Number(
          Math.max(0, toAccount.balance - existing.amount).toFixed(2)
        );
        await accountRepo.save(toAccount);
      }

      existing.status = TransactionStatus.REVERSED;
      return await transactionRepo.save(existing);
    });
  }

  // Field Resolver: Fetch source account on-demand
  @FieldResolver(() => BankAccount, { nullable: true })
  async fromAccount(@Root() transaction: Transaction): Promise<BankAccount | null> {
    if (!transaction.fromAccountId) {
      return null;
    }
    return await AppDataSource.getRepository(BankAccount).findOneBy({
      id: transaction.fromAccountId,
    });
  }

  // Field Resolver: Fetch destination account on-demand
  @FieldResolver(() => BankAccount, { nullable: true })
  async toAccount(@Root() transaction: Transaction): Promise<BankAccount | null> {
    if (!transaction.toAccountId) {
      return null;
    }
    return await AppDataSource.getRepository(BankAccount).findOneBy({
      id: transaction.toAccountId,
    });
  }
}
