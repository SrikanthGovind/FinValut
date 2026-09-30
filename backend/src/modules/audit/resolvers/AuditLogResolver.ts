import { Arg, Args, Authorized, Int, Query, Resolver } from "type-graphql";
import { FindOptionsWhere } from "typeorm";
import { AppDataSource } from "../../../config/database/data-source";
import { CAPABILITIES } from "../../../permissions";
import { AuditLogFilterInput } from "../dto/audit-log.dto";
import { AuditLog, AuditOutcome } from "../entities/audit-log.entity";

/**
 * Read-only by construction: this resolver declares queries and nothing else.
 * There is deliberately no mutation to amend or delete an entry, so the
 * append-only property of the table is enforced by the absence of code rather
 * than by a check someone could later weaken.
 */
@Resolver(() => AuditLog)
export class AuditLogResolver {
  // Query: Paginated audit trail, newest first
  @Query(() => [AuditLog], {
    description: "Get the audit trail (admin or auditor only)",
  })
  @Authorized(CAPABILITIES.AUDIT_READ)
  async getAuditLogs(
    @Args() filter: AuditLogFilterInput,
    @Arg("limit", () => Int, { defaultValue: 50 }) limit: number,
    @Arg("offset", () => Int, { defaultValue: 0 }) offset: number
  ): Promise<AuditLog[]> {
    const take = Math.min(Math.max(limit, 1), 200);
    const skip = Math.max(offset, 0);

    // Absent filters are dropped rather than passed through as undefined.
    // TypeORM throws on an undefined value in a where clause
    // ("Undefined value encountered in property ..."), so building the object
    // conditionally is what makes an unfiltered query work at all.
    const where: FindOptionsWhere<AuditLog> = {};
    if (filter?.action !== undefined) where.action = filter.action;
    if (filter?.outcome !== undefined) where.outcome = filter.outcome;
    if (filter?.actorId !== undefined) where.actorId = filter.actorId;
    if (filter?.entityType !== undefined) where.entityType = filter.entityType;
    if (filter?.entityId !== undefined) where.entityId = filter.entityId;

    return await AppDataSource.getRepository(AuditLog).find({
      where,
      order: { createdAt: "DESC" },
      take,
      skip,
    });
  }

  // Query: One entry by ID
  @Query(() => AuditLog, {
    nullable: true,
    description: "Get a single audit log entry by ID (admin or auditor only)",
  })
  @Authorized(CAPABILITIES.AUDIT_READ)
  async getAuditLog(@Arg("id") id: string): Promise<AuditLog | null> {
    return await AppDataSource.getRepository(AuditLog).findOneBy({ id });
  }

  // Query: Everything a given actor did. The per-actor view an investigator
  // usually wants first.
  @Query(() => [AuditLog], {
    description: "Get the audit trail for one actor (admin or auditor only)",
  })
  @Authorized(CAPABILITIES.AUDIT_READ)
  async getAuditLogsByActor(
    @Arg("actorId") actorId: string,
    @Arg("limit", () => Int, { defaultValue: 50 }) limit: number,
    @Arg("offset", () => Int, { defaultValue: 0 }) offset: number
  ): Promise<AuditLog[]> {
    return await AppDataSource.getRepository(AuditLog).find({
      where: { actorId },
      order: { createdAt: "DESC" },
      take: Math.min(Math.max(limit, 1), 200),
      skip: Math.max(offset, 0),
    });
  }

  // Query: Failed actions only. Rejected withdrawals and denied access are the
  // strongest fraud signal in the system, so they get a dedicated view.
  @Query(() => [AuditLog], {
    description: "Get failed or denied actions (admin or auditor only)",
  })
  @Authorized(CAPABILITIES.AUDIT_READ)
  async getFailedAuditLogs(
    @Arg("limit", () => Int, { defaultValue: 50 }) limit: number,
    @Arg("offset", () => Int, { defaultValue: 0 }) offset: number
  ): Promise<AuditLog[]> {
    return await AppDataSource.getRepository(AuditLog).find({
      where: { outcome: AuditOutcome.FAILURE },
      order: { createdAt: "DESC" },
      take: Math.min(Math.max(limit, 1), 200),
      skip: Math.max(offset, 0),
    });
  }
}
