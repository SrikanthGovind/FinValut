import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Retires the BRANCH_MANAGER role, leaving CUSTOMER, TELLER, AUDITOR, ADMIN.
 *
 * Why this is a hand-written migration rather than `migration:generate`:
 *
 * Postgres has no `ALTER TYPE ... DROP VALUE` and no `RENAME VALUE`. Removing
 * an enum label therefore means recreating the type, which means the column has
 * to be cast onto a new type while rows still hold labels the new type rejects.
 * TypeORM's generator emits a bare cast with no mapping:
 *
 *     USING "role"::"text"::"User_role_enum"
 *
 * That cast throws on the first row still holding BRANCH_MANAGER, and it throws
 * *after* the old type has been renamed and the new one created. The column is
 * then left pointing at a type the next statement drops, with its default
 * already removed, and re-running fails on "type already exists" instead of
 * finishing the job. Postgres has no transactional DDL for enum swaps, so there
 * is no rollback to fall back on.
 *
 * The cast below maps labels explicitly instead. BRANCH_MANAGER is promoted to
 * ADMIN before the swap, so the mapping never has to invent a value. Any
 * survivor reaching the cast is a bug rather than an expected state, and the
 * statement aborts with the type untouched rather than half-swapped.
 *
 * Rows are promoted rather than rejected because a migration that runs
 * unattended should not strand a user who cannot log in. ADMIN is the intended
 * destination: it was the role that inherited every BRANCH_MANAGER capability
 * when the tier was retired from the code.
 */
export class RemoveBranchManagerRole1727200000000
  implements MigrationInterface
{
  name = "RemoveBranchManagerRole1727200000000";

  private static readonly ENUM = "User_role_enum";
  private static readonly SCRATCH = "User_role_enum_old";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Already applied, or this database never had the role. Re-running must be
    // a no-op rather than an error, because the swap below is not atomic.
    if (!(await this.hasLabel(queryRunner, "BRANCH_MANAGER"))) {
      return;
    }

    // Promote survivors before the column is retyped. The count is logged so a
    // silent role change is still visible in the migration output.
    //
    // queryRunner.query() returns [rows, rowCount] for INSERT/UPDATE/DELETE and
    // a plain rows array for SELECT, so the result has to be destructured.
    // Treating it as a rows array makes length permanently 2, which logs a
    // promotion that never happened.
    const [promoted] = await queryRunner.query(
      `UPDATE "User" SET "role" = 'ADMIN' WHERE "role" = 'BRANCH_MANAGER' RETURNING "id"`
    );
    if (promoted.length) {
      console.log(
        `  promoted ${promoted.length} BRANCH_MANAGER user(s) to ADMIN: ` +
          promoted.map((u: { id: string }) => u.id).join(", ")
      );
    }

    // Drop the default first: a column default cannot be cast to the new type
    // until the type exists, and leaving it in place means new rows would be
    // written with a default the column no longer has.
    await queryRunner.query(
      `ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT`
    );
    await queryRunner.query(
      `ALTER TYPE "${RemoveBranchManagerRole1727200000000.ENUM}" RENAME TO "${RemoveBranchManagerRole1727200000000.SCRATCH}"`
    );
    await queryRunner.query(
      `CREATE TYPE "${RemoveBranchManagerRole1727200000000.ENUM}" AS ENUM('CUSTOMER','TELLER','AUDITOR','ADMIN')`
    );

    // Explicit mapping. No BRANCH_MANAGER branch on purpose: a row that still
    // holds it should abort the migration here, with the old type still intact,
    // rather than be silently reinterpreted as something else.
    await queryRunner.query(
      `ALTER TABLE "User" ALTER COLUMN "role" TYPE "${RemoveBranchManagerRole1727200000000.ENUM}" ` +
        `USING (CASE "role"::text ` +
        `WHEN 'CUSTOMER' THEN 'CUSTOMER'::"${RemoveBranchManagerRole1727200000000.ENUM}" ` +
        `WHEN 'TELLER' THEN 'TELLER'::"${RemoveBranchManagerRole1727200000000.ENUM}" ` +
        `WHEN 'AUDITOR' THEN 'AUDITOR'::"${RemoveBranchManagerRole1727200000000.ENUM}" ` +
        `WHEN 'ADMIN' THEN 'ADMIN'::"${RemoveBranchManagerRole1727200000000.ENUM}" ` +
        `END)`
    );

    await queryRunner.query(
      `DROP TYPE "${RemoveBranchManagerRole1727200000000.SCRATCH}"`
    );
    await queryRunner.query(
      `ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'CUSTOMER'`
    );
  }

  /**
   * Restores the five-value type.
   *
   * Rows are left exactly as they are. Putting BRANCH_MANAGER back on former
   * managers would mean guessing, and there is no record of who used to hold
   * it: the promotion above was one-way. The label reappears unassigned, which
   * is reversible without inventing role history.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await this.hasLabel(queryRunner, "BRANCH_MANAGER")) {
      return;
    }

    await queryRunner.query(
      `ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT`
    );
    await queryRunner.query(
      `ALTER TYPE "${RemoveBranchManagerRole1727200000000.ENUM}" RENAME TO "${RemoveBranchManagerRole1727200000000.SCRATCH}"`
    );
    await queryRunner.query(
      `CREATE TYPE "${RemoveBranchManagerRole1727200000000.ENUM}" AS ENUM('CUSTOMER','TELLER','BRANCH_MANAGER','AUDITOR','ADMIN')`
    );
    await queryRunner.query(
      `ALTER TABLE "User" ALTER COLUMN "role" TYPE "${RemoveBranchManagerRole1727200000000.ENUM}" ` +
        `USING "role"::"text"::"${RemoveBranchManagerRole1727200000000.ENUM}"`
    );
    await queryRunner.query(
      `DROP TYPE "${RemoveBranchManagerRole1727200000000.SCRATCH}"`
    );
    await queryRunner.query(
      `ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'CUSTOMER'`
    );
  }

  /** True when the role type exists and carries the given label. */
  private async hasLabel(
    queryRunner: QueryRunner,
    label: string
  ): Promise<boolean> {
    const rows: Array<{ exists: boolean }> = await queryRunner.query(
      `SELECT EXISTS (
         SELECT 1 FROM pg_type t
         JOIN pg_enum e ON e.enumtypid = t.oid
         WHERE t.typname = $1 AND e.enumlabel = $2
       ) AS exists`,
      [RemoveBranchManagerRole1727200000000.ENUM, label]
    );
    return rows[0].exists;
  }
}
