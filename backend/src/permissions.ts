import { UserRole } from "./modules/user/entities/user.entity";

/**
 * Central authorization vocabulary.
 *
 * A capability is a verb on a resource: what a role may DO, never which tier
 * it sits in. Resolvers never compare roles directly; they name a capability
 * and this table decides. Adding a role means adding a row here.
 *
 * A flat verb alone cannot express scope, so the few capabilities that grant
 * power over records the caller does not own carry an explicit suffix:
 *
 *   - _ANY   staff-wide read, or a write against someone else's record
 *   - _OWN   the caller's own record only
 *
 * Those suffixes are not decoration. AUDITOR and TELLER both hold the plain
 * read verbs, so without ACCOUNT_READ_ANY a customer could call
 * getBankAccounts and enumerate every account in the system. Ownership for
 * plain reads is enforced structurally instead, by comparing
 * `account.userId === caller.userId` in the resolver.
 */
export const CAPABILITIES = {
  // --- Accounts ---
  /** Read an account the caller owns. Ownership is checked in the resolver. */
  ACCOUNT_READ: "ACCOUNT_READ",
  /** Read any account in the system, not just the caller's own. */
  ACCOUNT_READ_ANY: "ACCOUNT_READ_ANY",
  /** Open an account on a customer's behalf at the counter. */
  ACCOUNT_CREATE: "ACCOUNT_CREATE",
  /** Change status, freeze or unfreeze an account. */
  ACCOUNT_UPDATE: "ACCOUNT_UPDATE",
  /** Close an account. */
  ACCOUNT_DELETE: "ACCOUNT_DELETE",

  // --- Transactions ---
  /** Move money between accounts the caller owns. */
  TRANSACTION_CREATE: "TRANSACTION_CREATE",
  /** Move money to or from an account the caller does not own. */
  TRANSACTION_CREATE_ANY: "TRANSACTION_CREATE_ANY",
  /** Read transactions on accounts the caller owns. */
  TRANSACTION_READ: "TRANSACTION_READ",
  /** Read every transaction in the system. */
  TRANSACTION_READ_ANY: "TRANSACTION_READ_ANY",
  /** Counter operations. Never available to CUSTOMER. */
  TRANSACTION_CASH: "TRANSACTION_CASH",
  /** Clear the approval queue, approve or reject. */
  TRANSACTION_APPROVE: "TRANSACTION_APPROVE",
  TRANSACTION_REVERSE: "TRANSACTION_REVERSE",

  // --- Users and roles ---
  /** Read a user record other than the caller's own. */
  USER_READ: "USER_READ",
  /** Set another user's role or status. */
  USER_UPDATE: "USER_UPDATE",
  /**
   * Edit the caller's own profile or password. Held by every role except
   * AUDITOR, which is what keeps a read-only role read-only.
   */
  USER_UPDATE_OWN: "USER_UPDATE_OWN",
  /** Read identity documents (Aadhaar/PAN) in full rather than masked. */
  USER_IDENTITY_READ_FULL: "USER_IDENTITY_READ_FULL",

  // --- Audit ---
  AUDIT_READ: "AUDIT_READ",
} as const;

export type Capability = (typeof CAPABILITIES)[keyof typeof CAPABILITIES];

/**
 * Capability set per role.
 *
 * Lower tiers are repeated explicitly rather than inherited at runtime. An
 * explicit list is auditable in one glance and cannot silently change meaning
 * if a role is reordered later; `hasPermission` stays a flat lookup.
 */
export const ROLE_CAPABILITIES: Record<UserRole, Capability[]> = {
  // Own records only. Note the absence of ACCOUNT_READ_ANY and
  // TRANSACTION_READ_ANY: a customer sees their own data and nothing else.
  [UserRole.CUSTOMER]: [
    CAPABILITIES.ACCOUNT_READ,
    CAPABILITIES.TRANSACTION_CREATE,
    CAPABILITIES.TRANSACTION_READ,
    CAPABILITIES.USER_UPDATE_OWN,
  ],

  // Counter role. Adds opening accounts for customers and handling cash. Still
  // no *_ANY, so a teller cannot move money out of an account they do not own.
  [UserRole.TELLER]: [
    CAPABILITIES.ACCOUNT_READ,
    CAPABILITIES.ACCOUNT_CREATE,
    CAPABILITIES.TRANSACTION_CREATE,
    CAPABILITIES.TRANSACTION_READ,
    CAPABILITIES.TRANSACTION_CASH,
    CAPABILITIES.USER_UPDATE_OWN,
  ],

  // Read-only across the whole system. Intentionally holds no capability that
  // mutates state, and neither USER_UPDATE nor USER_UPDATE_OWN: an auditor
  // inspects, it does not transact or administer, even on its own record.
  [UserRole.AUDITOR]: [
    CAPABILITIES.ACCOUNT_READ,
    CAPABILITIES.ACCOUNT_READ_ANY,
    CAPABILITIES.TRANSACTION_READ,
    CAPABILITIES.TRANSACTION_READ_ANY,
    CAPABILITIES.USER_READ,
    CAPABILITIES.AUDIT_READ,
  ],

  [UserRole.ADMIN]: Object.values(CAPABILITIES),
};

/**
 * The single authority on whether a role may perform an action.
 *
 * An unknown role returns false rather than throwing, so a forged or stale
 * role claim in a JWT fails closed instead of accidentally matching nothing.
 */
export function hasPermission(
  role: UserRole | string | null | undefined,
  capability: Capability
): boolean {
  if (!role) {
    return false;
  }
  const granted = ROLE_CAPABILITIES[role as UserRole];
  if (!granted) {
    return false;
  }
  return granted.includes(capability);
}

export function hasAnyPermission(
  role: UserRole | string | null | undefined,
  capabilities: readonly Capability[]
): boolean {
  return capabilities.some((capability) => hasPermission(role, capability));
}
