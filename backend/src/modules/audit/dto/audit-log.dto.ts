import { ArgsType, Field } from "type-graphql";
import { IsEnum, IsOptional, IsString, IsUUID } from "class-validator";
import { AuditAction, AuditOutcome } from "../entities/audit-log.entity";

/**
 * ArgsType, not InputType: this is spread directly into the query with
 * @Args(() => AuditLogFilterInput). type-graphql requires an ArgsType there and
 * only rejects the mismatch at schema build time, not at typecheck time.
 */
@ArgsType()
export class AuditLogFilterInput {
  @Field(() => AuditAction, { nullable: true })
  @IsOptional()
  @IsEnum(AuditAction)
  action?: AuditAction;

  @Field(() => AuditOutcome, { nullable: true })
  @IsOptional()
  @IsEnum(AuditOutcome)
  outcome?: AuditOutcome;

  @Field(() => String, { nullable: true, description: "Actor user ID" })
  @IsOptional()
  @IsUUID()
  actorId?: string;

  @Field(() => String, { nullable: true, description: "e.g. BankAccount, Transaction" })
  @IsOptional()
  @IsString()
  entityType?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  entityId?: string;
}
