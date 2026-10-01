/** Shape of the GraphQL types the server exposes. Mirrors the live schema. */

export type UserRole = "CUSTOMER" | "TELLER" | "AUDITOR" | "ADMIN";
export type UserStatus = "ACTIVE" | "INACTIVE" | "BLOCKED";

export type AccountType = "SAVINGS" | "CURRENT" | "SALARY" | "FIXED_DEPOSIT";
export type BankAccountStatus = "ACTIVE" | "DORMANT" | "FROZEN" | "CLOSED";

export type TransactionType =
  | "DEBIT"
  | "CREDIT"
  | "TRANSFER"
  | "CASH_DEPOSIT"
  | "CASH_WITHDRAWAL";

export type TransactionStatus = "PENDING" | "COMPLETED" | "FAILED" | "REVERSED";

export type AuditAction =
  | "REGISTER"
  | "LOGIN"
  | "LOGIN_FAILED"
  | "LOGOUT"
  | "PROFILE_UPDATED"
  | "PASSWORD_CHANGED"
  | "ROLE_CHANGED"
  | "USER_STATUS_CHANGED"
  | "ACCOUNT_OPENED"
  | "ACCOUNT_STATUS_CHANGED"
  | "ACCOUNT_CLOSED"
  | "TRANSACTION_CREATED"
  | "TRANSACTION_REVERSED"
  | "CASH_DEPOSIT"
  | "CASH_WITHDRAWAL"
  | "TRANSACTION_APPROVED"
  | "TRANSACTION_REJECTED"
  | "ACCESS_DENIED";

export type AuditOutcome = "SUCCESS" | "FAILURE";

export interface User {
  id: string;
  firstName: string;
  lastName?: string | null;
  email: string;
  phone?: string | null;
  dateOfBirth?: string | null;
  aadharNumber?: string | null;
  panNumber?: string | null;
  status: UserStatus;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface BankAccount {
  id: string;
  accountNumber: string;
  accountType: AccountType;
  balance: number;
  currency: string;
  branchCode: string;
  ifscCode: string;
  status: BankAccountStatus;
  openedAt: string;
  closedAt?: string | null;
  userId: string;
}

export interface Transaction {
  id: string;
  referenceNumber: string;
  transactionType: TransactionType;
  status: TransactionStatus;
  amount: number;
  currency: string;
  description?: string | null;
  fromAccountId?: string | null;
  toAccountId?: string | null;
  transactionDate: string;
  channel?: string | null;
  tellerId?: string | null;
  approvedAt?: string | null;
  approvedById?: string | null;
  createdAt: string;
  fromAccount?: { accountNumber: string } | null;
  toAccount?: { accountNumber: string } | null;
}

export interface AuditLog {
  id: string;
  actorId?: string | null;
  actorRole?: string | null;
  action: AuditAction;
  outcome: AuditOutcome;
  entityType?: string | null;
  entityId?: string | null;
  changes?: Record<string, { from?: unknown; to?: unknown }> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  reason?: string | null;
  createdAt: string;
}

export interface AuthPayload {
  message: string;
  accessToken: string;
  expiresAt: string;
  user: User;
}
