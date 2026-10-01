/**
 * Front-end mirror of `backend/src/permissions.ts`.
 *
 * The UI uses this to decide what to *show*. It is deliberately a copy of the
 * server's table rather than an invention: the server remains the only
 * authority, and anything here is a hint that keeps a user from clicking a
 * button that would come back as "Not authorized". If a capability is added
 * server-side, add it here in the same commit.
 */

export const CAPABILITIES = {
  ACCOUNT_READ: "ACCOUNT_READ",
  ACCOUNT_READ_ANY: "ACCOUNT_READ_ANY",
  ACCOUNT_CREATE: "ACCOUNT_CREATE",
  ACCOUNT_UPDATE: "ACCOUNT_UPDATE",
  ACCOUNT_DELETE: "ACCOUNT_DELETE",

  TRANSACTION_CREATE: "TRANSACTION_CREATE",
  TRANSACTION_CREATE_ANY: "TRANSACTION_CREATE_ANY",
  TRANSACTION_READ: "TRANSACTION_READ",
  TRANSACTION_READ_ANY: "TRANSACTION_READ_ANY",
  TRANSACTION_CASH: "TRANSACTION_CASH",
  TRANSACTION_APPROVE: "TRANSACTION_APPROVE",
  TRANSACTION_REVERSE: "TRANSACTION_REVERSE",

  USER_READ: "USER_READ",
  USER_UPDATE: "USER_UPDATE",
  USER_UPDATE_OWN: "USER_UPDATE_OWN",
  USER_IDENTITY_READ_FULL: "USER_IDENTITY_READ_FULL",

  AUDIT_READ: "AUDIT_READ",
} as const;

export type Capability = (typeof CAPABILITIES)[keyof typeof CAPABILITIES];

export const ROLES = ["CUSTOMER", "TELLER", "AUDITOR", "ADMIN"] as const;
export type UserRole = (typeof ROLES)[number];

/** Ordering used by every role/permission view so columns never jump around. */
export const CAPABILITY_GROUPS: Array<{ label: string; capabilities: Capability[] }> = [
  {
    label: "Bank accounts",
    capabilities: [
      CAPABILITIES.ACCOUNT_READ,
      CAPABILITIES.ACCOUNT_READ_ANY,
      CAPABILITIES.ACCOUNT_CREATE,
      CAPABILITIES.ACCOUNT_UPDATE,
      CAPABILITIES.ACCOUNT_DELETE,
    ],
  },
  {
    label: "Transactions",
    capabilities: [
      CAPABILITIES.TRANSACTION_CREATE,
      CAPABILITIES.TRANSACTION_CREATE_ANY,
      CAPABILITIES.TRANSACTION_READ,
      CAPABILITIES.TRANSACTION_READ_ANY,
      CAPABILITIES.TRANSACTION_CASH,
      CAPABILITIES.TRANSACTION_APPROVE,
      CAPABILITIES.TRANSACTION_REVERSE,
    ],
  },
  {
    label: "Users",
    capabilities: [
      CAPABILITIES.USER_READ,
      CAPABILITIES.USER_UPDATE,
      CAPABILITIES.USER_UPDATE_OWN,
      CAPABILITIES.USER_IDENTITY_READ_FULL,
    ],
  },
  {
    label: "Audit",
    capabilities: [CAPABILITIES.AUDIT_READ],
  },
];

export const ROLE_CAPABILITIES: Record<UserRole, Capability[]> = {
  CUSTOMER: [
    CAPABILITIES.ACCOUNT_READ,
    CAPABILITIES.TRANSACTION_CREATE,
    CAPABILITIES.TRANSACTION_READ,
    CAPABILITIES.USER_UPDATE_OWN,
  ],
  TELLER: [
    CAPABILITIES.ACCOUNT_READ,
    CAPABILITIES.ACCOUNT_CREATE,
    CAPABILITIES.TRANSACTION_CREATE,
    CAPABILITIES.TRANSACTION_READ,
    CAPABILITIES.TRANSACTION_CASH,
    CAPABILITIES.USER_UPDATE_OWN,
  ],
  AUDITOR: [
    CAPABILITIES.ACCOUNT_READ,
    CAPABILITIES.ACCOUNT_READ_ANY,
    CAPABILITIES.TRANSACTION_READ,
    CAPABILITIES.TRANSACTION_READ_ANY,
    CAPABILITIES.USER_READ,
    CAPABILITIES.AUDIT_READ,
  ],
  ADMIN: Object.values(CAPABILITIES) as Capability[],
};

export function hasPermission(
  role: UserRole | string | null | undefined,
  capability: Capability
): boolean {
  if (!role) return false;
  const granted = ROLE_CAPABILITIES[role as UserRole];
  if (!granted) return false;
  return granted.includes(capability);
}

export function hasAnyPermission(
  role: UserRole | string | null | undefined,
  capabilities: readonly Capability[]
): boolean {
  return capabilities.some((c) => hasPermission(role, c));
}

/** Human-readable one-liner for a capability, shown in the matrix view. */
export const CAPABILITY_DESCRIPTIONS: Record<Capability, string> = {
  ACCOUNT_READ: "Read accounts the caller owns",
  ACCOUNT_READ_ANY: "Read any account in the system",
  ACCOUNT_CREATE: "Open an account on a customer's behalf",
  ACCOUNT_UPDATE: "Freeze, unfreeze or change account status",
  ACCOUNT_DELETE: "Close a bank account",
  TRANSACTION_CREATE: "Transfer between accounts the caller owns",
  TRANSACTION_CREATE_ANY: "Move money on accounts the caller does not own",
  TRANSACTION_READ: "Read transactions on accounts the caller owns",
  TRANSACTION_READ_ANY: "Read every transaction in the system",
  TRANSACTION_CASH: "Handle cash deposits and withdrawals at the counter",
  TRANSACTION_APPROVE: "Approve or reject queued transactions",
  TRANSACTION_REVERSE: "Reverse a completed transaction",
  USER_READ: "Read other users' records",
  USER_UPDATE: "Change another user's role or status",
  USER_UPDATE_OWN: "Edit own profile and password",
  USER_IDENTITY_READ_FULL: "Read Aadhaar / PAN unmasked",
  AUDIT_READ: "Read the audit trail",
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  CUSTOMER: "Owns accounts. Sees own data and transfers own money only.",
  TELLER: "Counter role. Opens accounts and handles cash, cannot freeze or approve.",
  AUDITOR: "Read-only across the whole system, including the audit trail.",
  ADMIN: "Full access, including role changes and the approval queue.",
};

export const ROLE_HOME: Record<UserRole, string> = {
  CUSTOMER: "/customer",
  TELLER: "/teller",
  AUDITOR: "/auditor",
  ADMIN: "/admin",
};
