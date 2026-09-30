import "reflect-metadata";
import { graphql, GraphQLSchema } from "graphql";
import bcrypt from "bcrypt";
import createGraphqlScheme from "../src/loaders/graphql.loader";
import { initializeDatabase } from "../src/loaders/database.loader";
import { AppDataSource } from "../src/config/database/data-source";
import { User, UserRole, UserStatus } from "../src/modules/user/entities/user.entity";
import { BankAccount, BankAccountStatus, AccountType } from "../src/modules/bank/entities/bank.entity";

/**
 * End-to-end authorization test against the real schema and a real database.
 *
 * The point is not that resolvers return data, it is that a role which should
 * be refused actually is refused. Every allow-case is checked alongside a
 * deny-case so a missing guard shows up as a failure rather than as an
 * untested path.
 */

let schema!: GraphQLSchema;
const pass: string[] = [];
const fail: string[] = [];

function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    pass.push(name);
  } else {
    fail.push(`${name}${detail ? " :: " + detail : ""}`);
  }
}

/**
 * Executes an operation as a given role, exactly as the HTTP layer would.
 *
 * The context is built by hand rather than through authContext so the test can
 * assert on individual capabilities. Token signature is not re-checked here
 * because authChecker reads the same ctx.user this function populates; the
 * signature path is exercised by the running server, not by this file.
 */
interface GqlResult {
  data?: Record<string, unknown>;
  errors?: readonly { message: string }[];
}

async function as(
  role: UserRole,
  query: string,
  variables: Record<string, unknown> = {},
  userId?: string
): Promise<GqlResult> {
  return (await graphql({
    schema,
    source: query,
    variableValues: variables,
    contextValue: {
      user: userId ? { userId, email: "t@t.com", role } : null,
      req: { ip: "127.0.0.1", headers: { "user-agent": "authtest" } },
    },
  })) as GqlResult;
}

/** Narrow an arbitrary GraphQL response field without sprinkling casts. */
function field(result: GqlResult, key: string): Record<string, unknown> | undefined {
  const value = result.data?.[key];
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

/**
 * True when the operation was refused and returned nothing.
 *
 * `data` is checked for null *or* undefined, not just undefined: every one of
 * these operations returns a non-null root field, so GraphQL propagates the
 * authorization error to the root and sets `data` to null. Testing only for
 * `undefined` would silently pass a leak straight through.
 *
 * The error text is deliberately not matched. A resolver may word its refusal
 * any way, and pinning the exact string would break on a copy edit while still
 * passing if the error had come from somewhere unintended. Where a check
 * depends on which specific rule fired, the assertion states it inline.
 */
const denied = (r: GqlResult): boolean => {
  if (!r.errors?.length) {
    return false;
  }
  if (r.data === undefined || r.data === null) {
    return true;
  }
  // A nullable root field that a resolver refuses still reports
  // `data: { field: null }` alongside the error, because the error is
  // contained rather than propagated to the root. Requiring every top-level
  // field to be null catches that, and also catches the case that matters
  // most: an authorization error that was logged while the data leaked.
  return Object.values(r.data).every((v) => v === null || v === undefined);
};

// Module scope, not inside the IIFE, so the .catch() at the bottom can still
// reach it. Cleanup used to be a block at the end of the run, which meant any
// throw skipped it and left every fixture in the database permanently. That is
// not hypothetical: an interrupted run left six users behind, one of them
// holding BRANCH_MANAGER, which later made an enum migration take a different
// path than expected.
const tag = `at${Date.now().toString(36).slice(-10)}`;

/**
 * Removes this run's fixtures, located by tag rather than by captured ids.
 *
 * Tag-driven lookups mean this still works when a resolver throws before the
 * ids it would otherwise depend on were ever assigned.
 */
const cleanupFixtures = async (): Promise<void> => {
  if (!AppDataSource.isInitialized) {
    return;
  }
  const like = `${tag}%`;
  await AppDataSource.transaction(async (em) => {
    await em.query(
      `DELETE FROM "Transaction"
        WHERE "fromAccountId" IN (SELECT id FROM "BankAccount" WHERE "accountNumber" LIKE $1)
           OR "toAccountId"   IN (SELECT id FROM "BankAccount" WHERE "accountNumber" LIKE $1)`,
      [like]
    );
    await em.query(
      `DELETE FROM "AuditLog" WHERE "actorId" IN (SELECT id FROM "User" WHERE "lastName" = $1)`,
      [tag]
    );
    await em.query(`DELETE FROM "BankAccount" WHERE "accountNumber" LIKE $1`, [like]);
    await em.query(`DELETE FROM "User" WHERE "lastName" = $1`, [tag]);
  });
};

(async () => {
  await initializeDatabase();
  schema = await createGraphqlScheme();
  console.log("SCHEMA_BUILT\n");

  const userRepo = AppDataSource.getRepository(User);
  const acctRepo = AppDataSource.getRepository(BankAccount);

  // Isolated fixtures, all prefixed so cleanup is exact.
  const mk = async (role: UserRole, label: string) => {
    const u = await userRepo.save(
      userRepo.create({
        firstName: label,
        lastName: tag,
        email: `${label}.${tag}@test.com`,
        password: await bcrypt.hash("Passw0rd!23", 10),
        status: UserStatus.ACTIVE,
        role,
      })
    );
    return u;
  };

  // Supervision, approval, freezing and role administration all require
  // capabilities that only ADMIN holds now that BRANCH_MANAGER is gone, so
  // these are exercised through the single admin fixture.
  const admin = await mk(UserRole.ADMIN, "admin");
  const teller = await mk(UserRole.TELLER, "teller");
  const auditor = await mk(UserRole.AUDITOR, "auditor");
  const customer = await mk(UserRole.CUSTOMER, "customer");
  const other = await mk(UserRole.CUSTOMER, "other");

  const acct = async (userId: string, balance: number) =>
    acctRepo.save(
      acctRepo.create({
        accountNumber: `${tag}${Math.floor(Math.random() * 1e7)}`,
        accountType: AccountType.SAVINGS,
        balance,
        currency: "INR",
        branchCode: "000001",
        ifscCode: "FINT0000001",
        status: BankAccountStatus.ACTIVE,
        userId,
      })
    );

  const custAcct = await acct(customer.id, 200_000);
  const otherAcct = await acct(other.id, 50_000);

  // ---------------------------------------------------------------- section 1
  console.log("1. Query authorization by role");

  let r = await as(UserRole.ADMIN, `{ getUsers { id } }`, {}, admin.id);
  check("ADMIN can list users", !r.errors?.length, r.errors?.[0]?.message);

  r = await as(UserRole.AUDITOR, `{ getUsers { id } }`, {}, auditor.id);
  check("AUDITOR can list users", !r.errors?.length, r.errors?.[0]?.message);

  r = await as(UserRole.TELLER, `{ getUsers { id } }`, {}, teller.id);
  check("TELLER denied user list", denied(r), r.errors?.[0]?.message);

  r = await as(UserRole.CUSTOMER, `{ getUsers { id } }`, {}, customer.id);
  check("CUSTOMER denied user list", denied(r), r.errors?.[0]?.message);

  r = await as(UserRole.ADMIN, `{ getBankAccounts { id } }`, {}, admin.id);
  check("ADMIN can list all accounts", !r.errors?.length, r.errors?.[0]?.message);

  r = await as(UserRole.AUDITOR, `{ getTransactions { id } }`, {}, auditor.id);
  check("AUDITOR can read all transactions", !r.errors?.length, r.errors?.[0]?.message);

  r = await as(UserRole.CUSTOMER, `{ getTransactions { id } }`, {}, customer.id);
  check("CUSTOMER denied all-transactions", denied(r), r.errors?.[0]?.message);

  r = await as(UserRole.CUSTOMER, `{ myTransactions { id } }`, {}, customer.id);
  check("CUSTOMER can read own transactions", !r.errors?.length, r.errors?.[0]?.message);

  r = await as(UserRole.AUDITOR, `{ getAuditLogs { id action } }`, {}, auditor.id);
  check("AUDITOR can read audit log", !r.errors?.length, r.errors?.[0]?.message);

  r = await as(UserRole.CUSTOMER, `{ getAuditLogs { id } }`, {}, customer.id);
  check("CUSTOMER denied audit log", denied(r), r.errors?.[0]?.message);

  r = await as(UserRole.TELLER, `{ getPendingApprovals { id } }`, {}, teller.id);
  check("TELLER denied approval queue", denied(r), r.errors?.[0]?.message);

  r = await as(UserRole.ADMIN, `{ getPendingApprovals { id } }`, {}, admin.id);
  check("ADMIN can read approval queue", !r.errors?.length, r.errors?.[0]?.message);

  // ---------------------------------------------------------------- section 2
  console.log("2. Ownership enforcement");

  r = await as(UserRole.CUSTOMER, `query($id:ID!){ getBankAccount(id:$id){ id } }`,
    { id: custAcct.id }, customer.id);
  check("CUSTOMER reads own account", !r.errors?.length, r.errors?.[0]?.message);

  r = await as(UserRole.CUSTOMER, `query($id:ID!){ getBankAccount(id:$id){ id } }`,
    { id: otherAcct.id }, customer.id);
  check("CUSTOMER denied other's account (IDOR)", denied(r), r.errors?.[0]?.message);

  r = await as(UserRole.AUDITOR, `query($id:ID!){ getBankAccount(id:$id){ id } }`,
    { id: otherAcct.id }, auditor.id);
  check("AUDITOR can read any account", !r.errors?.length, r.errors?.[0]?.message);

  // ---------------------------------------------------------------- section 3
  console.log("3. Counter operations");

  const before = (await acctRepo.findOneBy({ id: custAcct.id }))!.balance;

  r = await as(UserRole.TELLER,
    `mutation($a:ID!,$amt:Float!){ cashDeposit(accountId:$a, amount:$amt){ id status amount transactionType } }`,
    { a: custAcct.id, amt: 5000 }, teller.id);
  check("TELLER can deposit cash", !r.errors?.length, r.errors?.[0]?.message);
  check("deposit marked COMPLETED", field(r, "cashDeposit")?.status === "COMPLETED",
    JSON.stringify(field(r, "cashDeposit")));
  check("deposit typed CASH_DEPOSIT", field(r, "cashDeposit")?.transactionType === "CASH_DEPOSIT",
    JSON.stringify(field(r, "cashDeposit")));

  const afterDeposit = (await acctRepo.findOneBy({ id: custAcct.id }))!.balance;
  check("deposit credited exactly once (+5000)", afterDeposit === before + 5000,
    `before=${before} after=${afterDeposit}`);

  r = await as(UserRole.CUSTOMER,
    `mutation($a:ID!,$amt:Float!){ cashDeposit(accountId:$a, amount:$amt){ id } }`,
    { a: custAcct.id, amt: 100 }, customer.id);
  check("CUSTOMER denied cashDeposit", denied(r), r.errors?.[0]?.message);

  r = await as(UserRole.AUDITOR,
    `mutation($a:ID!,$amt:Float!){ cashWithdrawal(accountId:$a, amount:$amt){ id } }`,
    { a: custAcct.id, amt: 100 }, auditor.id);
  check("AUDITOR denied cashWithdrawal (read-only role)", denied(r), r.errors?.[0]?.message);

  // Small withdrawal settles immediately and debits.
  const beforeW = (await acctRepo.findOneBy({ id: custAcct.id }))!.balance;
  r = await as(UserRole.TELLER,
    `mutation($a:ID!,$amt:Float!){ cashWithdrawal(accountId:$a, amount:$amt){ id status } }`,
    { a: custAcct.id, amt: 2000 }, teller.id);
  check("TELLER small withdrawal COMPLETED", field(r, "cashWithdrawal")?.status === "COMPLETED",
    JSON.stringify(r.data) + " " + (r.errors?.[0]?.message ?? ""));
  const afterW = (await acctRepo.findOneBy({ id: custAcct.id }))!.balance;
  check("small withdrawal debited (-2000)", afterW === beforeW - 2000,
    `before=${beforeW} after=${afterW}`);

  // Over-limit withdrawal must park in PENDING and NOT move money.
  const beforeBig = (await acctRepo.findOneBy({ id: custAcct.id }))!.balance;
  r = await as(UserRole.TELLER,
    `mutation($a:ID!,$amt:Float!){ cashWithdrawal(accountId:$a, amount:$amt){ id status amount } }`,
    { a: custAcct.id, amt: 90_000 }, teller.id);
  const big = field(r, "cashWithdrawal");
  check("over-limit withdrawal PENDING", big?.status === "PENDING", JSON.stringify(r.data));
  const afterBig = (await acctRepo.findOneBy({ id: custAcct.id }))!.balance;
  check("pending withdrawal did NOT debit", afterBig === beforeBig,
    `before=${beforeBig} after=${afterBig}`);

  // Teller must not be able to approve their own request.
  r = await as(UserRole.TELLER, `mutation($id:ID!){ approveTransaction(id:$id){ id } }`,
    { id: big?.id }, teller.id);
  check("TELLER cannot approve own request", denied(r), r.errors?.[0]?.message);

  // Manager approves: now the money moves.
  const beforeApprove = (await acctRepo.findOneBy({ id: custAcct.id }))!.balance;
  r = await as(UserRole.ADMIN, `mutation($id:ID!){ approveTransaction(id:$id){ id status } }`,
    { id: big?.id }, admin.id);
  check("ADMIN can approve", field(r, "approveTransaction")?.status === "COMPLETED",
    JSON.stringify(r.data) + " " + (r.errors?.[0]?.message ?? ""));
  const afterApprove = (await acctRepo.findOneBy({ id: custAcct.id }))!.balance;
  check("approval moved the money (-90000)", afterApprove === beforeApprove - 90_000,
    `before=${beforeApprove} after=${afterApprove}`);

  // Double approval must be refused.
  r = await as(UserRole.ADMIN, `mutation($id:ID!){ approveTransaction(id:$id){ id } }`,
    { id: big?.id }, admin.id);
  check("double approval refused", denied(r), r.errors?.[0]?.message);

  // Rejection path.
  r = await as(UserRole.TELLER,
    `mutation($a:ID!,$amt:Float!){ cashWithdrawal(accountId:$a, amount:$amt){ id } }`,
    { a: custAcct.id, amt: 95_000 }, teller.id);
  const toReject = field(r, "cashWithdrawal")?.id;
  r = await as(UserRole.ADMIN,
    `mutation($id:ID!,$reason:String!){ rejectTransaction(transactionId:$id, reason:$reason){ id status } }`,
    { id: toReject, reason: "limits exceeded" }, admin.id);
  check("ADMIN can reject", field(r, "rejectTransaction")?.status === "FAILED",
    JSON.stringify(r.data) + " " + (r.errors?.[0]?.message ?? ""));

  // ---------------------------------------------------------------- section 4
  console.log("4. Privilege boundaries");

  r = await as(UserRole.CUSTOMER, `mutation($id:ID!){ freezeAccount(id:$id){ id } }`,
    { id: custAcct.id }, customer.id);
  check("CUSTOMER cannot freeze own account", denied(r), r.errors?.[0]?.message);

  r = await as(UserRole.ADMIN, `mutation($id:ID!){ freezeAccount(id:$id){ id status } }`,
    { id: custAcct.id }, admin.id);
  check("ADMIN can freeze", field(r, "freezeAccount")?.status === "FROZEN",
    JSON.stringify(r.data) + " " + (r.errors?.[0]?.message ?? ""));

  r = await as(UserRole.ADMIN, `mutation($id:ID!){ unfreezeAccount(id:$id){ id status } }`,
    { id: custAcct.id }, admin.id);
  check("ADMIN can unfreeze", field(r, "unfreezeAccount")?.status === "ACTIVE",
    JSON.stringify(r.data) + " " + (r.errors?.[0]?.message ?? ""));

  // Auditor has read-any but must not be able to close.
  r = await as(UserRole.AUDITOR, `mutation($id:ID!){ closeBankAccount(id:$id){ id } }`,
    { id: custAcct.id }, auditor.id);
  check("AUDITOR denied close (read != write)", denied(r), r.errors?.[0]?.message);

  // Role escalation.
  r = await as(UserRole.CUSTOMER, `mutation($id:ID!,$role:String!){ setUserRole(userId:$id, role:$role){ id } }`,
    { id: other.id, role: "ADMIN" }, customer.id);
  check("CUSTOMER cannot escalate", denied(r), r.errors?.[0]?.message);

  // Escalation denial now uses TELLER. This used to be BRANCH_MANAGER, which
  // was the sharpest case because it sat between TELLER and ADMIN; with that
  // tier gone, TELLER is the strongest role that still lacks USER_ROLE_SET.
  r = await as(UserRole.TELLER, `mutation($id:ID!,$role:String!){ setUserRole(userId:$id, role:$role){ id } }`,
    { id: other.id, role: "ADMIN" }, teller.id);
  check("TELLER cannot escalate (no USER_ROLE_SET)", denied(r), r.errors?.[0]?.message);

  r = await as(UserRole.ADMIN, `mutation($id:ID!,$role:String!){ setUserRole(userId:$id, role:$role){ id role } }`,
    { id: other.id, role: "TELLER" }, admin.id);
  check("ADMIN can set role", field(r, "setUserRole")?.role === "TELLER",
    JSON.stringify(r.data) + " " + (r.errors?.[0]?.message ?? ""));

  r = await as(UserRole.ADMIN, `mutation($id:ID!,$role:String!){ setUserRole(userId:$id, role:$role){ id } }`,
    { id: other.id, role: "SUPERUSER" }, admin.id);
  check("invalid role rejected", denied(r), r.errors?.[0]?.message);

  r = await as(UserRole.ADMIN, `mutation($id:ID!,$role:String!){ setUserRole(userId:$id, role:$role){ id } }`,
    { id: admin.id, role: "CUSTOMER" }, admin.id);
  check("self-demotion blocked", denied(r), r.errors?.[0]?.message);

  r = await as(UserRole.ADMIN, `mutation($id:ID!){ setUserStatus(userId:$id, status:"BLOCKED"){ id } }`,
    { id: admin.id }, admin.id);
  check("admin cannot block self", denied(r), r.errors?.[0]?.message);

  // ---------------------------------------------------------------- section 5
  console.log("5. PII masking");

  await userRepo.update({ id: auditor.id }, { aadharNumber: "123456789012", panNumber: "ABCDE1234F" });
  r = await as(UserRole.AUDITOR, `{ getUser(id: $id) { aadharNumber panNumber } }`.replace("$id", `"` + auditor.id + `"`),
    {}, auditor.id);
  const maskedPan = field(r, "getUser")?.panNumber;
  check("AUDITOR sees masked PAN", typeof maskedPan === "string" && maskedPan.startsWith("****"),
    String(maskedPan));

  r = await as(UserRole.ADMIN, `{ getUser(id: "${auditor.id}") { panNumber } }`, {}, admin.id);
  check("ADMIN sees full PAN", field(r, "getUser")?.panNumber === "ABCDE1234F",
    String(field(r, "getUser")?.panNumber));

  // ---------------------------------------------------------------- section 5b
  console.log("5b. Failed-login capture (the reason the audit FK was dropped)");

  const beforeFailed = await AppDataSource.query(
    `SELECT count(*)::int c FROM "AuditLog" WHERE action = 'LOGIN_FAILED'`
  );
  // An email matching no account has no actor row, which is exactly the case
  // the old foreign key constraint silently discarded.
  r = await graphql({
    schema,
    source: `mutation{ login(email:"ghost@nonexistent.invalid", password:"Wrong1!pass"){ message } }`,
    contextValue: {
      user: null,
      req: { ip: "203.0.113.7", headers: { "user-agent": "bruteforce" } },
    },
  });
  check("unknown-email login is rejected", denied(r), r.errors?.[0]?.message);

  const afterFailed = await AppDataSource.query(
    `SELECT count(*)::int c FROM "AuditLog" WHERE action = 'LOGIN_FAILED'`
  );
  check(
    "failed login for unknown email IS recorded",
    afterFailed[0].c === beforeFailed[0].c + 1,
    `before=${beforeFailed[0].c} after=${afterFailed[0].c}`
  );

  const ghost = await AppDataSource.query(
    `SELECT "ipAddress", "userAgent", reason FROM "AuditLog"
     WHERE action='LOGIN_FAILED' ORDER BY "createdAt" DESC LIMIT 1`
  );
  check("failed-login entry keeps IP for correlation",
    ghost[0]?.ipAddress === "203.0.113.7", JSON.stringify(ghost[0]));

  await AppDataSource.query(
    `DELETE FROM "AuditLog" WHERE "userAgent" = 'bruteforce'`
  );

  // ---------------------------------------------------------------- section 6
  console.log("6. Money conservation");

  const totals = await acctRepo.query(
    `SELECT COALESCE(SUM(balance),0)::numeric AS t FROM "BankAccount"`
  );
  console.log("   total balance across all accounts:", totals[0].t);

  // ---------------------------------------------------------------- cleanup
  await cleanupFixtures();
  console.log("\ncleanup done");

  console.log(`\n=== ${pass.length} passed, ${fail.length} failed ===`);
  if (fail.length) {
    console.log("\nFAILURES:");
    for (const f of fail) console.log("  FAIL: " + f);
  }
  for (const p of pass) console.log("  ok: " + p);

  await AppDataSource.destroy();
  process.exit(fail.length ? 1 : 0);
})().catch(async (e) => {
  console.error("TEST_HARNESS_ERROR:", e);
  // Best effort: never exit 2 while fixtures are still in the database.
  await cleanupFixtures().catch((cleanupError) =>
    console.error("CLEANUP_FAILED:", cleanupError)
  );
  await AppDataSource.destroy().catch(() => undefined);
  process.exit(2);
});
