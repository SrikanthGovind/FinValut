import type { Transaction } from "../graphql/types";
import type { MoneyDirection } from "../components/domain/TransactionDetailDialog";

/**
 * Which side of a movement the viewer is standing on.
 *
 * The transaction row only records from/to account IDs, so "money in" versus
 * "money out" is only knowable once you know which accounts the viewer holds.
 * Passing the viewer's own account IDs is what makes the ledger readable from
 * a customer's side rather than only from the bank's.
 */
export function directionFor(
  transaction: Transaction,
  ownedAccountIds: Set<string>
): MoneyDirection {
  if (transaction.status === "REVERSED") return "neutral";
  const isSource = Boolean(
    transaction.fromAccountId && ownedAccountIds.has(transaction.fromAccountId)
  );
  const isTarget = Boolean(
    transaction.toAccountId && ownedAccountIds.has(transaction.toAccountId)
  );

  if (isSource && isTarget) return "neutral"; // internal move between own accounts
  if (isSource) return "out";
  if (isTarget) return "in";
  return "neutral";
}

/** Signed effect of a transaction on a given set of accounts. */
export function signedAmount(
  transaction: Transaction,
  ownedAccountIds: Set<string>
): number {
  const direction = directionFor(transaction, ownedAccountIds);
  if (direction === "in") return transaction.amount;
  if (direction === "out") return -transaction.amount;
  return 0;
}

/** accountId -> accountNumber, for turning IDs into something a person can read. */
export function accountNumberMap(
  accounts: Array<{ id: string; accountNumber: string }>
): Map<string, string> {
  return new Map(accounts.map((account) => [account.id, account.accountNumber]));
}

export function describeCounterparty(
  transaction: Transaction,
  numbers: Map<string, string>,
  ownedAccountIds: Set<string>
): string {
  if (transaction.transactionType === "CASH_DEPOSIT") return "Cash deposit (counter)";
  if (transaction.transactionType === "CASH_WITHDRAWAL") return "Cash withdrawal (counter)";

  const fromNumber = transaction.fromAccountId
    ? numbers.get(transaction.fromAccountId) ?? transaction.fromAccountId
    : null;
  const toNumber = transaction.toAccountId
    ? numbers.get(transaction.toAccountId) ?? transaction.toAccountId
    : null;

  if (fromNumber && toNumber) {
    const fromOwned = ownedAccountIds.has(transaction.fromAccountId ?? "");
    return fromOwned ? `To ${toNumber}` : `From ${fromNumber}`;
  }
  if (toNumber) return `To ${toNumber}`;
  if (fromNumber) return `From ${fromNumber}`;
  return "—";
}

/** Counts used by several dashboards. */
export function sumBy<T>(rows: T[], pick: (row: T) => number): number {
  return rows.reduce((total, row) => total + (pick(row) || 0), 0);
}

export function isToday(value: string | Date, now: Date = new Date()): boolean {
  const date = new Date(value);
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}
