import type { AuditAction } from "../graphql/types";

/**
 * Builds the variable map for `GET_AUDIT_LOGS`.
 *
 * Absent filters must be *omitted*, never sent as `null`. The server builds a
 * TypeORM `where` clause from the filters it received and drops anything
 * `undefined`, but an explicit `null` survives that check and reaches
 * `where.action = null`, which TypeORM rejects outright:
 *
 *   Null value encountered in property 'AuditLog.action' of a where condition.
 *   To match with SQL NULL, the IsNull() operator must be used.
 *
 * That turns the audit trail into a 500 the moment a user clears a filter — the
 * exact moment the page is most likely to be used. So every empty filter is
 * dropped here rather than being passed as `null`, and the unfiltered query
 * returns every row the operator is entitled to see.
 *
 * Kept next to the audit types rather than inside one page because the admin
 * and auditor views are deliberately the same query, and the admin page only
 * sends two of the five filters.
 */
export interface AuditLogFilters {
  action?: AuditAction | "";
  outcome?: string;
  actorId?: string;
  entityType?: string;
  entityId?: string;
}

export interface AuditLogPageVariables extends AuditLogFilters {
  limit: number;
  offset: number;
}

export function auditLogVariables(
  filters: AuditLogFilters,
  limit: number,
  offset: number
): AuditLogPageVariables {
  const variables: AuditLogPageVariables = { limit, offset };
  if (filters.action) variables.action = filters.action;
  if (filters.outcome) variables.outcome = filters.outcome;
  // Trimmed because the actor box is free text and a stray space is a filter
  // the server would happily apply as a literal match on nothing.
  if (filters.actorId?.trim()) variables.actorId = filters.actorId.trim();
  if (filters.entityType) variables.entityType = filters.entityType;
  if (filters.entityId) variables.entityId = filters.entityId;
  return variables;
}
