import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Baseline: creates the original User / BankAccount / Transaction schema.
 *
 * These three tables were originally created by `synchronize`, never by a
 * migration, so the chain had no way to build a database from nothing.
 * `migration:run` against an empty database failed at the first migration with
 * `relation "User" does not exist`. That is invisible on any machine that
 * already has a database, which is why it went unnoticed: the development
 * database was created long before the first migration existed.
 *
 * This file is timestamped *before* AddStaffRolesAndCashTransactions1727000000000
 * so the chain replays in the order the schema actually evolved:
 *
 *   1726000000000  this file      original two-role prototype
 *   1727000000000  enum/columns   USER -> CUSTOMER, adds cash transaction types
 *   1727100000000  audit log      creates AuditLog, drops its actor FK
 *
 * It therefore creates the *old* state on purpose: `User_role_enum` is
 * USER,ADMIN with a default of 'USER', and Transaction has no channel/tellerId/
 * approvedAt/approvedById columns. The next migration is what transforms that.
 * Writing the current five-role shape here instead would make the enum
 * migration a no-op on a fresh database and leave a gap in environments that
 * still hold legacy USER rows.
 *
 * Every statement is guarded so that applying this to an existing database is
 * a no-op. The enum guards matter most: CREATE TYPE has no IF NOT EXISTS in
 * Postgres, so each is wrapped in a DO block checking pg_type. On a database
 * that already has the newer enums, those blocks skip and the table/index
 * guards skip, so nothing is touched.
 *
 * Constraint and index names are written out explicitly rather than left
 * auto-generated. TypeORM derives those names from a hash, so hardcoding them
 * is what keeps a database built by these migrations byte-identical to one
 * built by `synchronize` -- which in turn is what keeps `migration:generate`
 * from reporting drift on a freshly created database.
 */
export class InitialSchema1726000000000 implements MigrationInterface {
  name = "InitialSchema1726000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // uuid_generate_v4() is used for every primary key below. The extension is
    // not present on a truly empty database, and this is the only place that
    // depends on it.
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // --- enums, in the original two-role prototype form ---
    await this.createEnumIfMissing(queryRunner, "User_role_enum", ["USER", "ADMIN"]);
    await this.createEnumIfMissing(queryRunner, "User_status_enum", ["ACTIVE", "INACTIVE", "BLOCKED"]);
    await this.createEnumIfMissing(queryRunner, "BankAccount_accounttype_enum", ["SAVINGS", "CURRENT", "SALARY", "FIXED_DEPOSIT"]);
    // Label order matches the entity declaration. The development database has
    // ACTIVE,FROZEN,CLOSED,DORMANT because it was built before DORMANT was
    // inserted, and Postgres only ever appends to an enum. Matching the
    // declaration here means a migration-built database and a synchronize-built
    // one are structurally identical, so neither reports the other as drift.
    await this.createEnumIfMissing(queryRunner, "BankAccount_status_enum", ["ACTIVE", "DORMANT", "FROZEN", "CLOSED"]);
    await this.createEnumIfMissing(queryRunner, "Transaction_status_enum", ["PENDING", "COMPLETED", "FAILED", "REVERSED"]);
    await this.createEnumIfMissing(queryRunner, "Transaction_transactiontype_enum", ["DEBIT", "CREDIT", "TRANSFER"]);

    // --- User ---
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "User" (
         "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
         "email" character varying(255) NOT NULL,
         "password" character varying NOT NULL,
         "firstName" character varying(100) NOT NULL,
         "lastName" character varying(100),
         "phone" character varying(20),
         "aadharNumber" character varying(12),
         "panNumber" character varying(10),
         "dateOfBirth" date,
         "role" "User_role_enum" NOT NULL DEFAULT 'USER',
         "status" "User_status_enum" NOT NULL DEFAULT 'ACTIVE',
         "createdAt" timestamp NOT NULL DEFAULT now(),
         "updatedAt" timestamp NOT NULL DEFAULT now(),
         CONSTRAINT "PK_9862f679340fb2388436a5ab3e4" PRIMARY KEY ("id")
       )`
    );
    await this.addConstraintIfMissing(queryRunner, "User", "UQ_4a257d2c9837248d70640b3e36e", `UNIQUE ("email")`);
    await this.addConstraintIfMissing(queryRunner, "User", "UQ_8ddb4fd4292d428c8325725b0f0", `UNIQUE ("aadharNumber")`);
    await this.addConstraintIfMissing(queryRunner, "User", "UQ_010ce12fa2efe117c80a8e314d0", `UNIQUE ("panNumber")`);

    // --- BankAccount ---
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "BankAccount" (
         "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
         "accountNumber" character varying(30) NOT NULL,
         "accountType" "BankAccount_accounttype_enum" NOT NULL DEFAULT 'SAVINGS',
         "balance" numeric(14,2) NOT NULL DEFAULT 0,
         "currency" character varying(10) NOT NULL DEFAULT 'INR',
         "branchCode" character varying(20) NOT NULL,
         "ifscCode" character varying(20) NOT NULL,
         "status" "BankAccount_status_enum" NOT NULL DEFAULT 'ACTIVE',
         "openedAt" timestamp NOT NULL DEFAULT now(),
         "closedAt" timestamp,
         "userId" uuid NOT NULL,
         CONSTRAINT "PK_fce8325b4e12b2dfa89a48f6b96" PRIMARY KEY ("id")
       )`
    );
    // Named to match what TypeORM's own synchronizer emits for this relation
    // (a hash of table, columns and onDelete). Any other name is equivalent as
    // a constraint but shows up as spurious drift in migration:generate.
    await this.addConstraintIfMissing(queryRunner, "BankAccount", "FK_413b93e5b00c28b70a93f364597", `FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE`);
    await this.addConstraintIfMissing(queryRunner, "BankAccount", "UQ_c014b81e3c4bc9d1fce2a0986a9", `UNIQUE ("accountNumber")`);

    // --- Transaction ---
    // No channel/tellerId/approvedAt/approvedById: those are added by
    // AddStaffRolesAndCashTransactions1727000000000.
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "Transaction" (
         "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
         "referenceNumber" character varying(24) NOT NULL,
         "transactionType" "Transaction_transactiontype_enum" NOT NULL,
         "amount" numeric(14,2) NOT NULL,
         "currency" character varying(10) NOT NULL DEFAULT 'INR',
         "description" character varying(255),
         "status" "Transaction_status_enum" NOT NULL DEFAULT 'PENDING',
         "transactionDate" timestamp NOT NULL DEFAULT now(),
         "createdAt" timestamp NOT NULL DEFAULT now(),
         "fromAccountId" uuid,
         "toAccountId" uuid,
         CONSTRAINT "PK_21eda4daffd2c60f76b81a270e9" PRIMARY KEY ("id"),
         CONSTRAINT "UQ_5073421d0db060f27f97291164e" UNIQUE ("referenceNumber")
       )`
    );
    // The entity carries both `@Index({ unique: true })` and a unique
    // constraint on referenceNumber, so the schema has two distinct indexes
    // over the column: the explicitly named one below, and the one the
    // constraint creates. Both exist on the development database for the same
    // reason, and omitting either shows up as drift.
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_5073421d0db060f27f97291164" ON "Transaction" USING btree ("referenceNumber")`
    );
    await this.addConstraintIfMissing(queryRunner, "Transaction", "FK_38ff2b6f1794a6bf70af843bbdf", `FOREIGN KEY ("fromAccountId") REFERENCES "BankAccount"("id") ON DELETE CASCADE`);
    await this.addConstraintIfMissing(queryRunner, "Transaction", "FK_34776fce19b74df1d6bd0767a6b", `FOREIGN KEY ("toAccountId") REFERENCES "BankAccount"("id") ON DELETE CASCADE`);

    // --- AuditLog ---
    //
    // Created here, without the actor foreign key, because the table has to
    // exist before AddStaffRolesAndCashTransactions1727000000000 runs. That
    // migration's `ALTER TABLE "AuditLog" DROP CONSTRAINT IF EXISTS` fails
    // outright on a database where the table is absent -- IF EXISTS on the
    // constraint says nothing about the table -- and that is exactly what
    // happened the first time the chain was replayed from empty.
    //
    // The FK is not recreated even in this original-schema migration. It is
    // added by the chain, not inherited by it: the development database had it
    // removed by synchronize long before this file existed, and re-adding it
    // here would put back a constraint the codebase deliberately does without
    // (see the note on AuditLog.actor -- it discards failed-login entries and
    // lets a deleted user's history vanish). The next migration's DROP
    // CONSTRAINT IF EXISTS is then a no-op, which is the correct end state.
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "AuditLog" (
         "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
         "actorId" uuid,
         "actorRole" character varying(40),
         "action" character varying(40) NOT NULL,
         "outcome" character varying(20) NOT NULL,
         "entityType" character varying(64),
         "entityId" character varying(64),
         "changes" jsonb,
         "ipAddress" character varying(64),
         "userAgent" character varying(255),
         "reason" character varying(255),
         "createdAt" timestamp NOT NULL DEFAULT now(),
         CONSTRAINT "PK_1a89a74497128c612dbda3fe042" PRIMARY KEY ("id")
       )`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_f38e41677c2ecb1eb07a0f434a" ON "AuditLog" USING btree ("action")`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_0eacb9148bf283269549e921c1" ON "AuditLog" USING btree ("outcome")`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_65b27f08b12242b53af5ee1d83" ON "AuditLog" USING btree ("createdAt")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Refuses rather than dropping. The foreign keys cascade, so a naive drop
    // would silently delete every account and transaction row along with the
    // tables, and a mis-typed `migration:revert` should not be able to do that
    // to a database holding real balances.
    const counts = await queryRunner.query(
      `SELECT
         (SELECT count(*)::int FROM "User")       AS users,
         (SELECT count(*)::int FROM "BankAccount") AS accounts,
         (SELECT count(*)::int FROM "Transaction") AS transactions`
    );
    const [row] = counts;
    if (row.users > 0 || row.accounts > 0 || row.transactions > 0) {
      throw new Error(
        `Cannot revert InitialSchema1726000000000: the database still holds data ` +
          `(${row.users} user(s), ${row.accounts} account(s), ${row.transactions} transaction(s)). ` +
          `The foreign keys are ON DELETE CASCADE, so reverting would destroy it.`
      );
    }

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_5073421d0db060f27f97291164"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "AuditLog"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "Transaction"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "BankAccount"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "User"`);

    // Only drop the enums this migration owns. On a database where the later
    // migrations have already been reverted, the *_old types it renames into
    // place will not exist and the DROP IF EXISTS covers that.
    for (const type of [
      "Transaction_transactiontype_enum",
      "Transaction_status_enum",
      "BankAccount_status_enum",
      "BankAccount_accounttype_enum",
      "User_status_enum",
      "User_role_enum",
    ]) {
      await queryRunner.query(`DROP TYPE IF EXISTS "${type}"`);
    }
  }

  /**
   * Postgres has no CREATE TYPE IF NOT EXISTS, so guard on pg_type instead.
   * DO blocks cannot take a bind parameter for an identifier, hence the
   * string interpolation -- the values are literals in this file, never user
   * input.
   */
  private async createEnumIfMissing(
    queryRunner: QueryRunner,
    name: string,
    values: string[]
  ): Promise<void> {
    const labels = values.map((v) => `'${v}'`).join(", ");
    await queryRunner.query(
      `DO $$
       BEGIN
         IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '${name}') THEN
           CREATE TYPE "${name}" AS ENUM(${labels});
         END IF;
       END
       $$`
    );
  }

  private async addConstraintIfMissing(
    queryRunner: QueryRunner,
    table: string,
    name: string,
    definition: string
  ): Promise<void> {
    await queryRunner.query(
      `DO $$
       BEGIN
         IF NOT EXISTS (
           SELECT 1 FROM pg_constraint WHERE conname = '${name}'
         ) THEN
           ALTER TABLE "${table}" ADD CONSTRAINT "${name}" ${definition};
         END IF;
       END
       $$`
    );
  }
}
