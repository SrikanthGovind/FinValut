import { EntityManager } from "typeorm";
import { AppDataSource } from "../../../config/database/data-source";
import { AuthContext } from "../../../middleware/authContext";
import { AuditAction, AuditLog, AuditOutcome } from "../entities/audit-log.entity";

/**
 * Keys never written to the audit log, whatever the caller passes in. A
 * password hash or a full identity number has no business in an append-only
 * table that AUDITOR and ADMIN can read, and leaving them out also keeps the
 * log useful by making it contain only what actually changed.
 */
const REDACTED_KEYS = new Set([
  "password",
  "currentPassword",
  "newPassword",
  "accessToken",
  "aadharNumber",
  "panNumber",
  "token",
  "authorization",
]);

const REDACTED = "[REDACTED]";

export type AuditChange = Record<string, { from?: unknown; to?: unknown }>;

function scrub(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "object") {
    if (Array.isArray(value)) {
      return value.map(scrub);
    }
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = REDACTED_KEYS.has(key) ? REDACTED : scrub(val);
    }
    return out;
  }
  return value;
}

/**
 * Builds a field-level diff, dropping keys whose value did not actually change
 * so the log stays readable, and redacting sensitive keys from both sides.
 */
export function buildChanges(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
  fields?: string[]
): AuditChange | null {
  if (!before || !after) {
    return null;
  }

  const keys = fields ?? Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
  const changes: AuditChange = {};

  for (const key of keys) {
    const from = scrub(before[key]);
    const to = scrub(after[key]);
    if (JSON.stringify(from) !== JSON.stringify(to)) {
      changes[key] = { from, to };
    }
  }

  return Object.keys(changes).length > 0 ? changes : null;
}

export interface AuditInput {
  action: AuditAction;
  outcome: AuditOutcome;
  ctx?: AuthContext | null;
  actorId?: string | null;
  actorRole?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  changes?: AuditChange | null;
  reason?: string | null;
  /**
   * Pass the caller's transaction manager so the audit row commits or rolls
   * back with the operation it describes. Without this the entry is written
   * on a separate connection, so a later failure in the same transaction
   * leaves an audit record asserting a success that never happened.
   *
   * The trade-off is that an audit write failure inside the transaction would
   * abort the operation. That is the correct direction to fail: a denied
   * financial operation is recoverable, a silent one is not.
   */
  manager?: EntityManager | null;
}

/**
 * Appends one entry.
 *
 * Without a `manager`, this never throws: an audit write failing must not
 * roll back or mask the operation the user actually asked for, and a
 * financial operation is more important to the caller than its log entry.
 * The cost is that a dropped row is invisible, so failures are logged to
 * stderr for external monitoring rather than silently swallowed.
 *
 * With a `manager`, the write joins the caller's transaction and failures do
 * propagate, because an audit row that disagrees with the ledger is worse
 * than a rejected request.
 */
export async function writeAuditLog(input: AuditInput): Promise<void> {
  const req = input.ctx?.req;
  const actorId = input.actorId ?? input.ctx?.user?.userId ?? null;
  const actorRole = input.actorRole ?? input.ctx?.user?.role ?? null;

  const repo = input.manager
    ? input.manager.getRepository(AuditLog)
    : AppDataSource.getRepository(AuditLog);

  const row = {
      actorId,
      actorRole: actorRole ?? null,
      action: input.action,
      outcome: input.outcome,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      changes: input.changes ?? null,
      reason: input.reason ?? null,
      ipAddress: req?.ip ?? null,
    userAgent: (req?.headers?.["user-agent"] as string | undefined) ?? null,
  } as Partial<AuditLog>;

  if (input.manager) {
    await repo.save(row);
    return;
  }

  try {
    await repo.save(row);
  } catch (error) {
    console.error("Audit log write failed:", error);
  }
}

/** Convenience wrapper for a denied request. */
export async function writeAccessDenied(
  ctx: AuthContext | null,
  action: AuditAction,
  reason: string,
  entityType?: string,
  entityId?: string
): Promise<void> {
  await writeAuditLog({
    action,
    outcome: AuditOutcome.FAILURE,
    ctx,
    entityType,
    entityId,
    reason,
  });
}
