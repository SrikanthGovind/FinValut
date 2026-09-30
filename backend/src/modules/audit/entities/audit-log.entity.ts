import { GraphQLScalarType, Kind, ValueNode } from "graphql";
import { Field, GraphQLISODateTime, ID, ObjectType, registerEnumType } from "type-graphql";
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";
import { UserRole } from "../../user/entities/user.entity";

/**
 * JSON scalar for the `changes` field.
 *
 * The obvious `@Field(() => [String])` is wrong: the resolver returns an
 * object keyed by field name, so GraphQL would try to iterate a non-iterable
 * and fail at serialization time, not at build time. `graphql-type-json` is
 * not a dependency, so this declares the scalar directly.
 *
 * The field is read-only in practice: it is produced by the audit service
 * (already redacted) and there is no input type that accepts it, so nothing a
 * client sends is ever written to the log.
 */
function parseLiteralNode(ast: ValueNode): unknown {
  switch (ast.kind) {
    case Kind.STRING:
    case Kind.BOOLEAN:
      return ast.value;
    case Kind.INT:
    case Kind.FLOAT:
      return Number(ast.value);
    case Kind.OBJECT: {
      const out: Record<string, unknown> = {};
      for (const field of ast.fields) {
        out[field.name.value] = parseLiteralNode(field.value);
      }
      return out;
    }
    case Kind.LIST:
      return ast.values.map((value) => parseLiteralNode(value));
    case Kind.NULL:
      return null;
    default:
      return null;
  }
}

export const GraphQLJSONScalar = new GraphQLScalarType({
  name: "JSON",
  description: "Arbitrary JSON value",

  serialize(value: unknown): unknown {
    return value;
  },

  parseValue(value: unknown): unknown {
    return value;
  },

  parseLiteral(ast: ValueNode): unknown {
    return parseLiteralNode(ast);
  },
});

export enum AuditAction {
  REGISTER = "REGISTER",
  LOGIN = "LOGIN",
  LOGIN_FAILED = "LOGIN_FAILED",
  LOGOUT = "LOGOUT",
  PROFILE_UPDATED = "PROFILE_UPDATED",
  PASSWORD_CHANGED = "PASSWORD_CHANGED",
  ROLE_CHANGED = "ROLE_CHANGED",
  USER_STATUS_CHANGED = "USER_STATUS_CHANGED",
  ACCOUNT_OPENED = "ACCOUNT_OPENED",
  ACCOUNT_STATUS_CHANGED = "ACCOUNT_STATUS_CHANGED",
  ACCOUNT_CLOSED = "ACCOUNT_CLOSED",
  TRANSACTION_CREATED = "TRANSACTION_CREATED",
  TRANSACTION_REVERSED = "TRANSACTION_REVERSED",
  CASH_DEPOSIT = "CASH_DEPOSIT",
  CASH_WITHDRAWAL = "CASH_WITHDRAWAL",
  TRANSACTION_APPROVED = "TRANSACTION_APPROVED",
  TRANSACTION_REJECTED = "TRANSACTION_REJECTED",
  ACCESS_DENIED = "ACCESS_DENIED",
}

export enum AuditOutcome {
  SUCCESS = "SUCCESS",
  FAILURE = "FAILURE",
}

registerEnumType(AuditAction, {
  name: "AuditAction",
  description: "The privileged operation that was attempted",
});

registerEnumType(AuditOutcome, {
  name: "AuditOutcome",
  description: "Whether the attempted operation succeeded",
});

/**
 * Append-only record of privileged actions.
 *
 * This table has no update mutation and no delete mutation, by design. That
 * absence is the tamper-resistance argument: there is no code path in the
 * application that can rewrite an entry, so the log is usable as evidence
 * rather than just a convenient history table. Note this is tamper-resistance
 * against the API, not the database: a direct SQL connection or a privileged
 * DB role can still UPDATE or DELETE rows. Enforce immutability with a
 * database-level rule or revoke UPDATE/DELETE before relying on this as
 * evidence in a dispute.
 *
 * Failures are recorded alongside successes. A rejected withdrawal is a
 * stronger fraud signal than a completed one, and an operator watching the
 * log should be able to see the probing, not just the hits.
 */
@Entity("AuditLog")
@ObjectType({ description: "Append-only audit trail entry" })
export class AuditLog {
  @Field(() => ID)
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  /** Null for actions taken by an anonymous caller, e.g. a failed login. */
  @Field(() => ID, { nullable: true })
  @Column({ type: "uuid", nullable: true })
  actorId?: string | null;

  /**
   * The role the actor held at the time of the event, not their current role.
   *
   * Stored as varchar rather than as the UserRole enum on purpose: this is
   * historical evidence. A Postgres enum column can only hold values in the
   * current type, so removing or renaming a role would either corrupt the log
   * or force a migration that rewrites history.
   */
  @Field(() => String, { nullable: true })
  @Column({ type: "varchar", length: 40, nullable: true })
  actorRole?: UserRole | string | null;

  @Field(() => AuditAction)
  @Index()
  @Column({ type: "varchar", length: 40 })
  action!: AuditAction;

  @Field(() => AuditOutcome)
  @Index()
  @Column({ type: "varchar", length: 20 })
  outcome!: AuditOutcome;

  @Field(() => String, { nullable: true })
  @Column({ type: "varchar", length: 64, nullable: true })
  entityType?: string | null;

  @Field(() => String, { nullable: true })
  @Column({ type: "varchar", length: 64, nullable: true })
  entityId?: string | null;

  /**
   * Field-level diff of the change, already redacted at write time. Stored as
   * JSONB so it can be filtered on later.
   *
   * Deliberately a diff rather than whole before/after entity snapshots: a
   * snapshot of a User would drag the password hash and full Aadhaar/PAN into
   * the log, which is both a leak and noise that obscures the actual change.
   */
  @Field(() => GraphQLJSONScalar, { nullable: true })
  @Column({ type: "jsonb", nullable: true })
  changes?: Record<string, { from?: unknown; to?: unknown }> | null;

  @Field(() => String, { nullable: true })
  @Column({ type: "varchar", length: 64, nullable: true })
  ipAddress?: string | null;

  @Field(() => String, { nullable: true })
  @Column({ type: "varchar", length: 255, nullable: true })
  userAgent?: string | null;

  /** Why a FAILURE happened. Also used for the reason on a successful change. */
  @Field(() => String, { nullable: true })
  @Column({ type: "varchar", length: 255, nullable: true })
  reason?: string | null;

  @Field(() => GraphQLISODateTime)
  @Index()
  @CreateDateColumn({ type: "timestamp" })
  createdAt!: Date;

  /**
   * Denormalized, deliberately without a foreign key.
   *
   * An FK on actorId looks tidier and is actively harmful here:
   *
   *  - A failed login for an email that matches no account has no actor to
   *    reference, so the insert violates the constraint and the entry is
   *    lost. That is precisely the brute-force signal an audit log exists to
   *    capture.
   *  - Deleting a user would cascade or null out the record of everything
   *    they did, so an administrator could erase their own trail by removing
   *    an account.
   *
   * A plain UUID column keeps entries even when the actor no longer exists,
   * which is the behaviour evidence requires. Callers that pass a user ID
   * which is not a real row must therefore expect the write to succeed.
   */
  actor?: { id: string; email: string } | null;
}
