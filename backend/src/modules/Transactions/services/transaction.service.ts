import { EntityManager } from "typeorm";
import { BankAccount, BankAccountStatus } from "../../bank/entities/bank.entity";
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from "../entities/transaction.entity";

/**
 * Balance mutation primitives shared by every money-moving resolver.
 *
 * These live in one place deliberately. The locking discipline below is the
 * part that is easy to get subtly wrong, and duplicating it across
 * createTransaction, cashDeposit, cashWithdrawal and approveTransaction would
 * mean four opportunities to drop a FOR UPDATE and reintroduce a lost-update
 * bug that creates or destroys money.
 */
export interface ApplyBalanceChange {
  fromAccountId?: string | null;
  toAccountId?: string | null;
  amount: number;
}

export interface LockedAccounts {
  fromAccount: BankAccount | null;
  toAccount: BankAccount | null;
}

/**
 * Loads participating accounts under a row-level write lock.
 *
 * FOR UPDATE is what stops two concurrent transactions from reading the same
 * balance and both writing it back. IDs are sorted first so opposing
 * transfers (A->B and B->A) acquire locks in the same order and cannot
 * deadlock against each other.
 */
export async function lockAccounts(
  manager: EntityManager,
  fromAccountId?: string | null,
  toAccountId?: string | null
): Promise<LockedAccounts> {
  const accountRepo = manager.getRepository(BankAccount);

  const accountIds = [fromAccountId, toAccountId]
    .filter((accountId): accountId is string => !!accountId)
    .sort();

  if (accountIds.length === 0) {
    return { fromAccount: null, toAccount: null };
  }

  const locked = await accountRepo
    .createQueryBuilder("account")
    .setLock("pessimistic_write")
    .where("account.id IN (:...accountIds)", { accountIds })
    .getMany();

  const byId = new Map(locked.map((account) => [account.id, account]));

  return {
    fromAccount: fromAccountId ? byId.get(fromAccountId) ?? null : null,
    toAccount: toAccountId ? byId.get(toAccountId) ?? null : null,
  };
}

export function assertAccountExists(
  account: BankAccount | null,
  accountId: string | null | undefined,
  label: string
): void {
  if (accountId && !account) {
    throw new Error(`${label} account with ID ${accountId} not found`);
  }
}

export function assertActive(account: BankAccount | null, label: string): void {
  if (account && account.status !== BankAccountStatus.ACTIVE) {
    throw new Error(
      `${label} account ${account.accountNumber} is not ACTIVE (currently ${account.status})`
    );
  }
}

export function assertSufficientFunds(
  fromAccount: BankAccount | null,
  amount: number
): void {
  if (fromAccount && fromAccount.balance < amount) {
    throw new Error(
      `Insufficient balance in account ${fromAccount.accountNumber}`
    );
  }
}

/**
 * Moves money between two locked accounts. Callers must have already locked
 * the rows via lockAccounts, or concurrent operations can interleave.
 */
export async function applyBalanceChange(
  manager: EntityManager,
  accounts: LockedAccounts,
  amount: number
): Promise<void> {
  const accountRepo = manager.getRepository(BankAccount);

  if (accounts.fromAccount) {
    accounts.fromAccount.balance = Number(
      (accounts.fromAccount.balance - amount).toFixed(2)
    );
    await accountRepo.save(accounts.fromAccount);
  }

  if (accounts.toAccount) {
    accounts.toAccount.balance = Number(
      (accounts.toAccount.balance + amount).toFixed(2)
    );
    await accountRepo.save(accounts.toAccount);
  }
}

let referenceCounter = 0;

export function generateReferenceNumber(): string {
  referenceCounter = (referenceCounter + 1) % 10000;
  return `TXN${Date.now()}${referenceCounter.toString().padStart(4, "0")}`;
}

export interface RecordTransactionInput extends ApplyBalanceChange {
  transactionType: TransactionType;
  amount: number;
  currency?: string;
  description?: string | null;
  status?: TransactionStatus;
  channel?: string | null;
  tellerId?: string | null;
  approvedAt?: Date | null;
  approvedById?: string | null;
}

export async function recordTransaction(
  manager: EntityManager,
  input: RecordTransactionInput
): Promise<Transaction> {
  const txnRepo = manager.getRepository(Transaction);

  return await txnRepo.save(
    txnRepo.create({
      referenceNumber: generateReferenceNumber(),
      transactionType: input.transactionType,
      status: input.status ?? TransactionStatus.COMPLETED,
      amount: input.amount,
      currency: input.currency ?? "INR",
      description: input.description ?? null,
      fromAccountId: input.fromAccountId ?? null,
      toAccountId: input.toAccountId ?? null,
      transactionDate: new Date(),
      channel: input.channel ?? null,
      tellerId: input.tellerId ?? null,
      approvedAt: input.approvedAt ?? null,
      approvedById: input.approvedById ?? null,
    })
  );
}

/**
 * Rolls a status-only change (approve/reject) without touching balances.
 * The caller is responsible for having already applied any balance movement.
 */
export async function updateTransactionStatus(
  manager: EntityManager,
  transaction: Transaction,
  status: TransactionStatus,
  approvedById?: string | null
): Promise<Transaction> {
  const txnRepo = manager.getRepository(Transaction);
  transaction.status = status;
  if (status === TransactionStatus.COMPLETED) {
    transaction.approvedAt = new Date();
    transaction.approvedById = approvedById ?? null;
  }
  return await txnRepo.save(transaction);
}
