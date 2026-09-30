import dotenv from "dotenv";
import { DataSource } from "typeorm";

dotenv.config();

/**
 * Migrations are glob-loaded on the same pattern as entities, so adding a
 * migration is a matter of dropping a timestamped file in src/migrations
 * rather than editing a list here. The filename timestamp is what TypeORM
 * sorts on, so the numeric prefix is load-bearing, not decoration.
 */
export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5000"),
  username: process.env.DB_USERNAME || "postgres",
  password: process.env.DB_PASSWORD || "password",
  database: process.env.DB_NAME || "FinVault",
  // Deliberately off. `synchronize` was the original setting, but it cannot
  // express the enum expansion this schema needs: on a database that still has
  // the old USER role, synchronize aborts startup with
  //   invalid input value for enum "User_role_enum": "USER"
  // leaving no way to run the migration that fixes it. Migrations are the only
  // path in, and running both is not merely redundant but conflicting.
  //
  // A developer with a genuinely empty database can set DB_SYNCHRONIZE=1 to
  // bootstrap one from the entities without writing a migration first.
  synchronize: process.env.DB_SYNCHRONIZE === "1",
  // Migrations never run as a side effect of starting the app. Auto-applying
  // schema changes on boot means an accidental boot against production runs
  // DDL that nobody reviewed at that moment, and a half-applied migration takes
  // the app down on the next start. Migrations are applied explicitly instead:
  //   npm run migration:show     # what is applied, what is pending
  //   npm run migration:run      # apply pending
  //   npm run migration:revert   # undo the last one
  //   npm run migration:generate -- src/migrations/describe_change
  // Startup does not repair the schema. An un-migrated database therefore fails
  // with a raw `relation "User" does not exist` from Postgres rather than a
  // hint, so `npm run migration:run` is the fix when that happens.
  migrationsRun: false,
  migrations: [__dirname + "/../../migrations/*.{ts,js}"],
  logging: false,
  entities: [__dirname + "/../../modules/**/entities/*.entity.{ts,js}"],
});
