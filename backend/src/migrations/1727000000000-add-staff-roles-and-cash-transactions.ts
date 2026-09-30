import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Expands the role and transaction-type vocabularies from the original
 * two-role prototype to the five-role model, and adds the counter/approval
 * columns on Transaction.
 *
 * Why this is a migration and not left to `synchronize`:
 *
 * TypeORM's `synchronize` cannot rename or remove a Postgres enum value. It
 * will happily try to recreate the type and fail on existing rows, leaving the
 * database in a state where the app cannot start:
 *
 *     invalid input value for enum "User_role_enum": "USER"
 *
 * Postgres has no `ALTER TYPE ... RENAME VALUE` at all, so the only way to
 * rename USER -> CUSTOMER is the create/copy/drop/swap dance below. Renaming
 * rather than dropping matters: existing rows keep a valid role instead of
 * being forced to NULL or deleted.
 *
 * USER is mapped to CUSTOMER. They are the same concept under the old name, so
 * every existing user keeps working as a customer rather than becoming
 * role-less and locked out of their own accounts.
 *
 * The new columns are all nullable, so the rebuild is non-destructive and old
 * rows simply read back as NULL (self-service, no teller, no approver).
 */
export class AddStaffRolesAndCashTransactions1727000000000
  implements MigrationInterface
{
  name = "AddStaffRolesAndCashTransactions1727000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- User.role: USER,ADMIN -> CUSTOMER,TELLER,BRANCH_MANAGER,AUDITOR,ADMIN ---
    //
    // Written to be resumable. Postgres has no transactional DDL for enum
    // swaps, so a failure part-way leaves the column pointing at the old type
    // with the default dropped, and re-running must be able to finish rather
    // than fail again on "type already exists". Each step checks for the state
    // it expects.
    //
    // The existing DEFAULT is the literal 'USER', which Postgres cannot cast to
    // the new type automatically, hence the explicit drop and re-set.
    //
    // The check below is on the enum's *values*, not on its name. An earlier
    // version of this guard compared `udt_name` against "User_role_enum", which
    // is always true on both sides of this migration: the old type is called
    // User_role_enum, and the swap below renames that to _old and then creates
    // a *new* type with the same name. So the guard was never false, the whole
    // block was skipped, and the role enum was left as USER,ADMIN. It went
    // unnoticed because this migration had already been applied to the
    // development database, so it never ran again -- the bug only became
    // visible when the chain was finally replayed from empty, where the column
    // stayed USER,ADMIN and every later insert of a CUSTOMER failed.
    const roleHasNewValues = await this.enumHasValues(queryRunner, "User_role_enum", [
      "CUSTOMER",
      "TELLER",
      "BRANCH_MANAGER",
      "AUDITOR",
      "ADMIN",
    ]);

    if (!roleHasNewValues) {
      await queryRunner.query(
        `ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT`
      );

      const oldTypeExists = await queryRunner.query(
        `SELECT 1 FROM pg_type WHERE typname = 'User_role_enum_old'`
      );
      if (oldTypeExists.length === 0) {
        await queryRunner.query(
          `ALTER TYPE "User_role_enum" RENAME TO "User_role_enum_old"`
        );
      }

      // A previous attempt may already have created the new type before
      // failing later, so only create it when it is genuinely absent.
      const newTypeExists = await queryRunner.query(
        `SELECT 1 FROM pg_type WHERE typname = 'User_role_enum'`
      );
      if (newTypeExists.length === 0) {
        await queryRunner.query(
          `CREATE TYPE "User_role_enum" AS ENUM('CUSTOMER','TELLER','BRANCH_MANAGER','AUDITOR','ADMIN')`
        );
      }

      // A plain `USING ("role"::text)::"User_role_enum"` fails on the rows that
      // hold USER, because the new type has no such value and Postgres 17
      // performs no implicit text->enum cast. USER was the old name for
      // CUSTOMER, so it is translated explicitly rather than dropped: an
      // unmapped value would abort the whole migration and leave every user
      // unable to start the app.
      //
      // The CASE has no ELSE, so an unrecognised legacy value raises an error
      // instead of being silently coerced into a role nobody chose.
      await queryRunner.query(
        `ALTER TABLE "User" ALTER COLUMN "role" TYPE "User_role_enum"
         USING (CASE "role"::text
           WHEN 'USER'   THEN 'CUSTOMER'::"User_role_enum"
           WHEN 'ADMIN'  THEN 'ADMIN'::"User_role_enum"
         END)`
      );

      await queryRunner.query(`DROP TYPE IF EXISTS "User_role_enum_old"`);

      await queryRunner.query(
        `ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'CUSTOMER'`
      );
    }

    // --- Transaction.transactionType: add the two counter operations ---
    // Same resumability treatment as the role enum above, and the same reason
    // for checking values rather than the type name.
    const txnTypeHasNewValues = await this.enumHasValues(
      queryRunner,
      "Transaction_transactiontype_enum",
      ["DEBIT", "CREDIT", "TRANSFER", "CASH_DEPOSIT", "CASH_WITHDRAWAL"]
    );

    if (!txnTypeHasNewValues) {
      const oldTxnExists = await queryRunner.query(
        `SELECT 1 FROM pg_type WHERE typname = 'Transaction_transactiontype_enum_old'`
      );
      if (oldTxnExists.length === 0) {
        await queryRunner.query(
          `ALTER TYPE "Transaction_transactiontype_enum" RENAME TO "Transaction_transactiontype_enum_old"`
        );
      }

      const newTxnExists = await queryRunner.query(
        `SELECT 1 FROM pg_type WHERE typname = 'Transaction_transactiontype_enum'`
      );
      if (newTxnExists.length === 0) {
        await queryRunner.query(
          `CREATE TYPE "Transaction_transactiontype_enum" AS ENUM('DEBIT','CREDIT','TRANSFER','CASH_DEPOSIT','CASH_WITHDRAWAL')`
        );
      }

      await queryRunner.query(
        `ALTER TABLE "Transaction" ALTER COLUMN "transactionType" TYPE "Transaction_transactiontype_enum" USING ("transactionType"::text)::"Transaction_transactiontype_enum"`
      );

      await queryRunner.query(`DROP TYPE IF EXISTS "Transaction_transactiontype_enum_old"`);
    }

    // --- Transaction: counter and approval metadata ---
    await queryRunner.query(
      `ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "channel" character varying(32)`
    );
    await queryRunner.query(
      `ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "tellerId" uuid`
    );
    await queryRunner.query(
      `ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "approvedAt" timestamp`
    );
    await queryRunner.query(
      `ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "approvedById" uuid`
    );

    // Backfill so existing rows are self-service rather than NULL. Nullable is
    // kept for genuinely unknown provenance.
    await queryRunner.query(
      `UPDATE "Transaction" SET "channel" = 'SELF_SERVICE' WHERE "channel" IS NULL`
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_transaction_tellerId" ON "Transaction" ("tellerId")`
    );

    // --- AuditLog: drop the actor FK ---
    //
    // See the note on AuditLog.actor. The constraint was created by
    // synchronize on an earlier build of the entity; it silently discarded
    // failed-login entries (no actor row exists) and would let a user delete
    // erase their own trail.
    //
    // InitialSchema1726000000000 creates AuditLog, which is what this statement
    // needs: `IF EXISTS` on a constraint says nothing about the table, so
    // without it the run aborts on a database where AuditLog is absent. On a
    // correctly built database the constraint is already gone, so this is a
    // no-op.
    await queryRunner.query(
      `ALTER TABLE "AuditLog" DROP CONSTRAINT IF EXISTS "FK_b2a9bd9e5c6b51df49d35b7822e"`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_transaction_tellerId"`
    );
    await queryRunner.query(`ALTER TABLE "Transaction" DROP COLUMN IF EXISTS "approvedById"`);
    await queryRunner.query(`ALTER TABLE "Transaction" DROP COLUMN IF EXISTS "approvedAt"`);
    await queryRunner.query(`ALTER TABLE "Transaction" DROP COLUMN IF EXISTS "tellerId"`);
    await queryRunner.query(`ALTER TABLE "Transaction" DROP COLUMN IF EXISTS "channel"`);

    // Cash rows cannot be represented in the old enum, so the down migration
    // refuses rather than silently dropping the money-movement history.
    const cashRows = await queryRunner.query(
      `SELECT count(*)::int AS c FROM "Transaction" WHERE "transactionType" IN ('CASH_DEPOSIT','CASH_WITHDRAWAL')`
    );
    if (cashRows[0].c > 0) {
      throw new Error(
        `Cannot revert: ${cashRows[0].c} CASH_* transaction(s) exist and the old enum has no value for them.`
      );
    }

    await queryRunner.query(
      `ALTER TYPE "Transaction_transactiontype_enum" RENAME TO "Transaction_transactiontype_enum_old"`
    );
    await queryRunner.query(
      `CREATE TYPE "Transaction_transactiontype_enum" AS ENUM('DEBIT','CREDIT','TRANSFER')`
    );
    await queryRunner.query(
      `ALTER TABLE "Transaction" ALTER COLUMN "transactionType" TYPE "Transaction_transactiontype_enum" USING ("transactionType"::text)::"Transaction_transactiontype_enum"`
    );
    await queryRunner.query(`DROP TYPE "Transaction_transactiontype_enum_old"`);

    // The UPDATE that used to sit here ran before the old type was recreated,
    // so it set every non-ADMIN role to 'USER' while the column still pointed
    // at the five-value type:
    //
    //     invalid input value for enum "User_role_enum": "USER"
    //
    // The down migration could therefore never complete. The mapping is already
    // expressed in full by the CASE below, so the UPDATE is not just moved, it
    // is deleted: running the swap converts every role to its old name in one
    // step, and doing it twice would either fail or depend on ordering.
    await queryRunner.query(
      `ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT`
    );
    await queryRunner.query(`ALTER TYPE "User_role_enum" RENAME TO "User_role_enum_old"`);
    await queryRunner.query(
      `CREATE TYPE "User_role_enum" AS ENUM('USER','ADMIN')`
    );
    await queryRunner.query(
      `ALTER TABLE "User" ALTER COLUMN "role" TYPE "User_role_enum"
       USING (CASE "role"::text
         WHEN 'CUSTOMER'       THEN 'USER'::"User_role_enum"
         WHEN 'TELLER'         THEN 'USER'::"User_role_enum"
         WHEN 'BRANCH_MANAGER' THEN 'USER'::"User_role_enum"
         WHEN 'AUDITOR'        THEN 'USER'::"User_role_enum"
         WHEN 'ADMIN'          THEN 'ADMIN'::"User_role_enum"
       END)`
    );
    await queryRunner.query(
      `ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'USER'`
    );
    await queryRunner.query(`DROP TYPE "User_role_enum_old"`);
  }

  /**
   * True when the named enum already contains every label in `expected`.
   *
   * Used instead of comparing type names to decide whether a swap is still
   * needed. The name check was the bug described above: this migration gives
   * the replacement type the same name as the original, so the name can never
   * distinguish "already migrated" from "not yet migrated". Comparing labels
   * can, and it also keeps re-running safe: once the new values are present
   * the block is skipped entirely.
   *
   * An absent type counts as "does not have the values", so a database where
   * the column is missing still goes down the create path.
   */
  private async enumHasValues(
    queryRunner: QueryRunner,
    typeName: string,
    expected: string[]
  ): Promise<boolean> {
    const rows = await queryRunner.query(
      `SELECT e.enumlabel AS label
       FROM pg_type t
       JOIN pg_enum e ON e.enumtypid = t.oid
       WHERE t.typname = $1`,
      [typeName]
    );
    const present = new Set<string>(rows.map((r: { label: string }) => r.label));
    return expected.every((v) => present.has(v));
  }
}
