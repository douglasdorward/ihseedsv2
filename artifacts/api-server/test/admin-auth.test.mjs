import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createServer as createHttpServer } from "node:http";
import { createServer } from "node:net";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { build } from "esbuild";

let baseUrl;
let roleModule;
let accessModule;
let httpHarness;
let httpServer;
let httpBaseUrl;
let originalNodeEnv;
const roleBundle = join(
  new URL("../../../lib/db", import.meta.url).pathname,
  `.admin-role-test-${process.pid}.mjs`,
);
const accessBundle = join(
  new URL("../../../lib/db", import.meta.url).pathname,
  `.admin-access-test-${process.pid}.mjs`,
);
const httpHarnessBundle = join(
  new URL("../../../lib/db", import.meta.url).pathname,
  `.admin-http-harness-test-${process.pid}.mjs`,
);

function sql(query, env = process.env) {
  return execFileSync("psql", [process.env.DATABASE_URL, "-X", "-v", "ON_ERROR_STOP=1", "-c", query], {
    encoding: "utf8",
    env,
  });
}

async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : null;
  await new Promise((resolve) => server.close(resolve));
  assert.ok(port);
  return port;
}

before(async () => {
  assert.ok(process.env.CLERK_SECRET_KEY, "CLERK_SECRET_KEY is required");
  assert.ok(process.env.CLERK_PUBLISHABLE_KEY, "CLERK_PUBLISHABLE_KEY is required");
  await build({
    entryPoints: [new URL("../src/lib/admin-role.ts", import.meta.url).pathname],
    bundle: true,
    platform: "node",
    format: "esm",
    external: ["pg", "pg-cloudflare"],
    outfile: roleBundle,
  });
  await build({
    entryPoints: [new URL("../src/lib/admin-access.ts", import.meta.url).pathname],
    bundle: true,
    platform: "node",
    format: "esm",
    external: ["pg", "pg-cloudflare"],
    outfile: accessBundle,
  });
  roleModule = await import(`${new URL(`file://${roleBundle}`).href}?v=${Date.now()}`);
  accessModule = await import(`${new URL(`file://${accessBundle}`).href}?v=${Date.now()}`);
  originalNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  await build({
    entryPoints: [new URL("./admin-http-harness.ts", import.meta.url).pathname],
    bundle: true,
    platform: "node",
    format: "esm",
    external: ["pg", "pg-cloudflare"],
    outfile: httpHarnessBundle,
    banner: {
      js: `import { createRequire as __testCreateRequire } from "node:module";
globalThis.require = __testCreateRequire(import.meta.url);`,
    },
    plugins: [{
      name: "mock-clerk-provider",
      setup(buildContext) {
        buildContext.onResolve({ filter: /^@clerk\/express$/ }, () => ({
          path: new URL("./clerk-express-mock.ts", import.meta.url).pathname,
        }));
        buildContext.onResolve({ filter: /^sharp$/ }, () => ({
          path: new URL("./sharp-mock.ts", import.meta.url).pathname,
        }));
      },
    }],
  });
  httpHarness = await import(`${new URL(`file://${httpHarnessBundle}`).href}?v=${Date.now()}`);
  const httpPort = await freePort();
  httpBaseUrl = `http://127.0.0.1:${httpPort}`;
  httpServer = createHttpServer(httpHarness.default);
  await new Promise((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(httpPort, "127.0.0.1", resolve);
  });
  baseUrl = httpBaseUrl;
});

after(async () => {
  await rm(roleBundle, { force: true });
  await rm(accessBundle, { force: true });
  await rm(httpHarnessBundle, { force: true });
  httpHarness?.setTestClerkIdentity(null);
  httpHarness?.resetTestClerkOperations();
  if (httpServer) await new Promise((resolve) => httpServer.close(resolve));
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
});

function httpRequest(method, path, body) {
  return fetch(`${httpBaseUrl}${path}`, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function clerkIdentity(userId, primaryEmailAddressId, emailAddresses) {
  return { userId, primaryEmailAddressId, emailAddresses };
}

test("legacy empty-ledger databases execute the admin migration", () => {
  const schema = `auth_migration_${process.pid}`;
  const scopedEnv = { ...process.env, PGOPTIONS: `-c search_path=${schema}` };
  sql(`CREATE SCHEMA ${schema};
    CREATE TABLE ${schema}.ih_products (listing_override text);
    CREATE TABLE ${schema}.ih_product_drafts (id integer);
    CREATE TABLE ${schema}.ih_catalogue_categories (seo_description text);
    CREATE TABLE ${schema}.ih_sale_lines (availability text);
    CREATE TABLE ${schema}.ih_redirects (id integer);`);
  try {
    execFileSync("pnpm", ["--filter", "@workspace/db", "run", "migrate"], {
      cwd: new URL("../../..", import.meta.url),
      env: scopedEnv,
      encoding: "utf8",
    });
    const result = sql(
      "SELECT to_regclass('ih_admin_users') IS NOT NULL, "
        + "to_regclass('ih_admin_pending_approvals') IS NOT NULL, "
        + "to_regclass('ih_admin_revocations') IS NOT NULL, "
        + "to_regclass('ih_admin_access_audit') IS NOT NULL, "
        + "(SELECT count(*) FROM ih_schema_migrations WHERE name = '0017_admin_access_management.sql');",
      scopedEnv,
    );
    assert.match(result, /t\s*\|\s*t\s*\|\s*t\s*\|\s*t\s*\|\s*1/);
  } finally {
    sql(`DROP SCHEMA ${schema} CASCADE`);
  }
});

test("admin bootstrap requires an explicitly allowed verified email", async () => {
  const id = `auth-test-bootstrap-${process.pid}`;
  const email = `auth-test-${process.pid}@example.test`;
  await sql(`DELETE FROM ih_admin_users WHERE clerk_user_id = '${id}'`);
  await sql(`DELETE FROM ih_admin_pending_approvals WHERE email = '${email}'`);
  await sql(`DELETE FROM ih_admin_revocations WHERE email = '${email}'`);
  await sql(`DELETE FROM ih_admin_access_audit WHERE actor_email = '${email}' OR target_email = '${email}'`);
  const previous = process.env.ADMIN_BOOTSTRAP_EMAILS;
  try {
    process.env.ADMIN_BOOTSTRAP_EMAILS = "different@example.test";
    assert.equal(await roleModule.resolveAdminIdentity(id, email), null);
    assert.equal(await roleModule.resolveAdminIdentity(id, null), null);

    process.env.ADMIN_BOOTSTRAP_EMAILS = ` other@example.test, ${email.toUpperCase()} `;
    const bootstrapped = await roleModule.resolveAdminIdentity(id, email);
    assert.equal(bootstrapped.role, "admin");
    assert.equal(bootstrapped.email, email);

    delete process.env.ADMIN_BOOTSTRAP_EMAILS;
    assert.equal(await roleModule.resolveAdminIdentity(id, null), null);
    assert.equal(await roleModule.resolveAdminIdentity(id, "changed@example.test"), null);
    const persisted = await roleModule.resolveAdminIdentity(id, email);
    assert.equal(persisted.role, "admin");

    await sql(`DELETE FROM ih_admin_users WHERE clerk_user_id = '${id}'`);
    assert.equal(await roleModule.resolveAdminIdentity(id, email), null);
  } finally {
    await sql(`DELETE FROM ih_admin_users WHERE clerk_user_id = '${id}'`);
    await sql(`DELETE FROM ih_admin_pending_approvals WHERE email = '${email}'`);
    await sql(`DELETE FROM ih_admin_revocations WHERE email = '${email}'`);
    await sql(`DELETE FROM ih_admin_access_audit WHERE actor_email = '${email}' OR target_email = '${email}'`);
    if (previous === undefined) delete process.env.ADMIN_BOOTSTRAP_EMAILS;
    else process.env.ADMIN_BOOTSTRAP_EMAILS = previous;
  }
});

test("pending approval is claimed only by the exact verified primary email", async () => {
  const actorId = `auth-test-actor-${process.pid}`;
  const actorEmail = `actor-${process.pid}@example.test`;
  const pendingEmail = `pending-${process.pid}@example.test`;
  const wrongEmail = `other-${process.pid}@example.test`;
  const previous = process.env.ADMIN_BOOTSTRAP_EMAILS;
  try {
    process.env.ADMIN_BOOTSTRAP_EMAILS = "";
    sql(`DELETE FROM ih_admin_access_audit WHERE actor_email IN ('${actorEmail}', '${pendingEmail}') OR target_email IN ('${actorEmail}', '${pendingEmail}')`);
    sql(`DELETE FROM ih_admin_pending_approvals WHERE email = '${pendingEmail}'`);
    sql(`DELETE FROM ih_admin_revocations WHERE email = '${pendingEmail}'`);
    sql(`DELETE FROM ih_admin_users WHERE clerk_user_id IN ('${actorId}', 'auth-test-pending-${process.pid}')`);
    sql(`INSERT INTO ih_admin_users (clerk_user_id, email, role) VALUES ('${actorId}', '${actorEmail}', 'admin')`);
    const actor = { userId: actorId, email: actorEmail, role: "admin" };
    assert.equal(roleModule.verifiedPrimaryEmail({
      primaryEmailAddressId: "unverified-primary",
      emailAddresses: [
        { id: "unverified-primary", emailAddress: pendingEmail, verification: { status: "unverified" } },
        { id: "verified-secondary", emailAddress: wrongEmail, verification: { status: "verified" } },
      ],
    }), "");
    assert.equal(roleModule.verifiedPrimaryEmail({
      primaryEmailAddressId: "verified-primary",
      emailAddresses: [{ id: "verified-primary", emailAddress: pendingEmail.toUpperCase(), verification: { status: "verified" } }],
    }), pendingEmail);
    assert.deepEqual(await accessModule.createAdministratorApproval(actor, pendingEmail), { ok: true });
    assert.equal(await roleModule.resolveAdminIdentity(`auth-test-pending-${process.pid}`, wrongEmail), null);
    assert.equal(await roleModule.resolveAdminIdentity(`auth-test-pending-${process.pid}`, null), null);
    const claimed = await roleModule.resolveAdminIdentity(`auth-test-pending-${process.pid}`, pendingEmail.toUpperCase());
    assert.equal(claimed?.email, pendingEmail);
    assert.equal(claimed?.userId, `auth-test-pending-${process.pid}`);
  } finally {
    sql(`DELETE FROM ih_admin_access_audit WHERE actor_email IN ('${actorEmail}', '${pendingEmail}') OR target_email IN ('${actorEmail}', '${pendingEmail}')`);
    sql(`DELETE FROM ih_admin_pending_approvals WHERE email = '${pendingEmail}'`);
    sql(`DELETE FROM ih_admin_revocations WHERE email = '${pendingEmail}'`);
    sql(`DELETE FROM ih_admin_users WHERE clerk_user_id IN ('${actorId}', 'auth-test-pending-${process.pid}')`);
    if (previous === undefined) delete process.env.ADMIN_BOOTSTRAP_EMAILS;
    else process.env.ADMIN_BOOTSTRAP_EMAILS = previous;
  }
});

test("revocation and cancelled approval tombstones block stale bootstrap", async () => {
  const actorId = `auth-test-tombstone-actor-${process.pid}`;
  const actorEmail = `tombstone-actor-${process.pid}@example.test`;
  const bootstrapId = `auth-test-tombstone-target-${process.pid}`;
  const bootstrapEmail = `tombstone-target-${process.pid}@example.test`;
  const cancelledEmail = `tombstone-cancelled-${process.pid}@example.test`;
  const previous = process.env.ADMIN_BOOTSTRAP_EMAILS;
  try {
    process.env.ADMIN_BOOTSTRAP_EMAILS = `${bootstrapEmail},${cancelledEmail}`;
    sql(`DELETE FROM ih_admin_access_audit WHERE actor_email IN ('${actorEmail}', '${bootstrapEmail}', '${cancelledEmail}') OR target_email IN ('${actorEmail}', '${bootstrapEmail}', '${cancelledEmail}')`);
    sql(`DELETE FROM ih_admin_pending_approvals WHERE email IN ('${bootstrapEmail}', '${cancelledEmail}')`);
    sql(`DELETE FROM ih_admin_revocations WHERE email IN ('${bootstrapEmail}', '${cancelledEmail}')`);
    sql(`DELETE FROM ih_admin_users WHERE clerk_user_id IN ('${actorId}', '${bootstrapId}', 'auth-test-cancelled-${process.pid}')`);
    sql(`INSERT INTO ih_admin_users (clerk_user_id, email, role) VALUES ('${actorId}', '${actorEmail}', 'admin')`);
    const actor = { userId: actorId, email: actorEmail, role: "admin" };
    assert.equal((await roleModule.resolveAdminIdentity(bootstrapId, bootstrapEmail))?.userId, bootstrapId);
    assert.deepEqual(await accessModule.revokeAdministratorAccess(actor, bootstrapId), { ok: true });
    assert.equal(await roleModule.resolveAdminIdentity(bootstrapId, bootstrapEmail), null);

    assert.deepEqual(await accessModule.createAdministratorApproval(actor, cancelledEmail), { ok: true });
    assert.deepEqual(await accessModule.cancelAdministratorApproval(actor, cancelledEmail), { ok: true });
    assert.equal(await roleModule.resolveAdminIdentity(`auth-test-cancelled-${process.pid}`, cancelledEmail), null);
  } finally {
    sql(`DELETE FROM ih_admin_access_audit WHERE actor_email IN ('${actorEmail}', '${bootstrapEmail}', '${cancelledEmail}') OR target_email IN ('${actorEmail}', '${bootstrapEmail}', '${cancelledEmail}')`);
    sql(`DELETE FROM ih_admin_pending_approvals WHERE email IN ('${bootstrapEmail}', '${cancelledEmail}')`);
    sql(`DELETE FROM ih_admin_revocations WHERE email IN ('${bootstrapEmail}', '${cancelledEmail}')`);
    sql(`DELETE FROM ih_admin_users WHERE clerk_user_id IN ('${actorId}', '${bootstrapId}', 'auth-test-cancelled-${process.pid}')`);
    if (previous === undefined) delete process.env.ADMIN_BOOTSTRAP_EMAILS;
    else process.env.ADMIN_BOOTSTRAP_EMAILS = previous;
  }
});

test("concurrent revocations leave an active administrator", async () => {
  const ids = ["a", "b"].map((suffix) => `auth-test-race-${suffix}-${process.pid}`);
  const emails = ["a", "b"].map((suffix) => `race-${suffix}-${process.pid}@example.test`);
  try {
    sql(`DELETE FROM ih_admin_access_audit WHERE actor_email IN ('${emails.join("','")}') OR target_email IN ('${emails.join("','")}')`);
    sql(`DELETE FROM ih_admin_revocations WHERE email IN ('${emails.join("','")}')`);
    sql(`DELETE FROM ih_admin_users WHERE clerk_user_id IN ('${ids.join("','")}')`);
    sql(`INSERT INTO ih_admin_users (clerk_user_id, email, role) VALUES ('${ids[0]}', '${emails[0]}', 'admin'), ('${ids[1]}', '${emails[1]}', 'admin')`);
    const actorA = { userId: ids[0], email: emails[0], role: "admin" };
    const actorB = { userId: ids[1], email: emails[1], role: "admin" };
    const outcomes = await Promise.all([
      accessModule.revokeAdministratorAccess(actorA, ids[1]),
      accessModule.revokeAdministratorAccess(actorB, ids[0]),
    ]);
    assert.equal(outcomes.filter((result) => result.ok).length, 1);
    assert.ok(outcomes.some((result) => !result.ok && result.reason === "actor-revoked"));
    const remaining = sql(`SELECT count(*) FROM ih_admin_users WHERE clerk_user_id IN ('${ids.join("','")}')`);
    assert.match(remaining, /\s1\s/);
  } finally {
    sql(`DELETE FROM ih_admin_access_audit WHERE actor_email IN ('${emails.join("','")}') OR target_email IN ('${emails.join("','")}')`);
    sql(`DELETE FROM ih_admin_pending_approvals WHERE email IN ('${emails.join("','")}')`);
    sql(`DELETE FROM ih_admin_revocations WHERE email IN ('${emails.join("','")}')`);
    sql(`DELETE FROM ih_admin_users WHERE clerk_user_id IN ('${ids.join("','")}')`);
  }
});

test("public catalogue stays anonymous", async () => {
  const response = await fetch(`${baseUrl}/api/products`);
  assert.equal(response.status, 200);
});

test("unsigned requests cannot access administrator routes", async () => {
  const session = await fetch(`${baseUrl}/api/auth/session`);
  assert.equal(session.status, 401);
  assert.deepEqual(await session.json(), { signedIn: false, authorized: false });

  const untrustedPreflight = await fetch(`${baseUrl}/api/admin/products`, {
    method: "OPTIONS",
    headers: {
      origin: "https://attacker.example",
      "access-control-request-method": "GET",
    },
  });
  assert.equal(untrustedPreflight.headers.get("access-control-allow-origin"), null);

  const admin = await fetch(`${baseUrl}/api/admin/products`);
  assert.equal(admin.status, 401);

  const mutation = await fetch(`${baseUrl}/api/admin/categories`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  assert.equal(mutation.status, 401);

  const protectedRoutes = [
    ["GET", "/api/admin/summary"],
    ["GET", "/api/admin/categories"],
    ["POST", "/api/admin/categories"],
    ["GET", "/api/admin/import/export"],
  ];
  for (const [method, path] of protectedRoutes) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: method === "POST" ? { "content-type": "application/json" } : undefined,
      body: method === "POST" ? "{}" : undefined,
    });
    assert.equal(response.status, 401, `${method} ${path} must require authentication`);
  }
});

test("production HTTP administrator routes reject anonymous and unapproved callers", async () => {
  const requests = [
    ["GET", "/api/admin/administrators"],
    ["POST", "/api/admin/administrators/approvals", { email: `pending-${process.pid}@example.test` }],
    ["DELETE", "/api/admin/administrators/approvals", { email: `pending-${process.pid}@example.test` }],
    ["DELETE", "/api/admin/administrators/access", { clerkUserId: `user-${process.pid}` }],
  ];
  httpHarness.setTestClerkIdentity(null);
  for (const [method, path, body] of requests) {
    const response = await httpRequest(method, path, body);
    assert.equal(response.status, 401, `${method} ${path} must reject anonymous callers`);
    assert.deepEqual(await response.json(), { error: "Sign in is required." });
  }

  httpHarness.setTestClerkIdentity(clerkIdentity(
    `auth-test-unapproved-${process.pid}`,
    "primary",
    [{ id: "primary", emailAddress: `unapproved-${process.pid}@example.test`, verification: { status: "verified" } }],
  ));
  for (const [method, path, body] of requests) {
    const response = await httpRequest(method, path, body);
    assert.equal(response.status, 403, `${method} ${path} must reject signed-in unapproved callers`);
    assert.deepEqual(await response.json(), { error: "Administrator access is required." });
  }
  httpHarness.setTestClerkIdentity(null);
});

test("production HTTP administrator management rechecks Clerk primary email and authorizes approved mutations", async () => {
  const actorId = `auth-http-actor-${process.pid}`;
  const actorEmail = `http-actor-${process.pid}@example.test`;
  const targetId = `auth-http-target-${process.pid}`;
  const targetEmail = `http-target-${process.pid}@example.test`;
  const claimId = `auth-http-claim-${process.pid}`;
  const claimEmail = `http-claim-${process.pid}@example.test`;
  const pendingEmail = `http-pending-${process.pid}@example.test`;
  const otherEmail = `http-other-${process.pid}@example.test`;
  const allEmails = [actorEmail, targetEmail, claimEmail, pendingEmail, otherEmail];
  const allIds = [actorId, targetId, claimId];
  const previous = process.env.ADMIN_BOOTSTRAP_EMAILS;
  try {
    httpHarness.resetTestClerkOperations();
    process.env.ADMIN_BOOTSTRAP_EMAILS = "";
    sql(`DELETE FROM ih_admin_access_audit WHERE actor_email IN ('${allEmails.join("','")}') OR target_email IN ('${allEmails.join("','")}')`);
    sql(`DELETE FROM ih_admin_pending_approvals WHERE email IN ('${allEmails.join("','")}')`);
    sql(`DELETE FROM ih_admin_revocations WHERE email IN ('${allEmails.join("','")}')`);
    sql(`DELETE FROM ih_admin_users WHERE clerk_user_id IN ('${allIds.join("','")}')`);
    sql(`INSERT INTO ih_admin_users (clerk_user_id, email, role) VALUES ('${actorId}', '${actorEmail}', 'admin'), ('${targetId}', '${targetEmail}', 'admin')`);

    httpHarness.setTestClerkIdentity(clerkIdentity(
      actorId,
      "actor-primary",
      [{ id: "actor-primary", emailAddress: actorEmail, verification: { status: "verified" } }],
    ));
    const list = await httpRequest("GET", "/api/admin/administrators");
    assert.equal(list.status, 200);
    const listed = await list.json();
    assert.equal(listed.currentUserId, actorId);
    assert.ok(listed.administrators.some((administrator) => administrator.clerkUserId === actorId));

    const approval = await httpRequest("POST", "/api/admin/administrators/approvals", { email: pendingEmail });
    assert.equal(approval.status, 200);
    assert.deepEqual(await approval.json(), { success: true });
    let clerkOperations = httpHarness.getTestClerkOperations();
    assert.ok(clerkOperations.allowlistIdentifiers.some((entry) => entry.identifier === pendingEmail));
    assert.ok(clerkOperations.invitations.some((invitation) =>
      invitation.emailAddress === pendingEmail && invitation.status === "pending"));
    const cancellation = await httpRequest("DELETE", "/api/admin/administrators/approvals", { email: pendingEmail });
    assert.equal(cancellation.status, 200);
    assert.deepEqual(await cancellation.json(), { success: true });
    clerkOperations = httpHarness.getTestClerkOperations();
    assert.ok(!clerkOperations.allowlistIdentifiers.some((entry) => entry.identifier === pendingEmail));
    assert.ok(clerkOperations.invitations.some((invitation) =>
      invitation.emailAddress === pendingEmail && invitation.status === "revoked"));
    const revoke = await httpRequest("DELETE", "/api/admin/administrators/access", { clerkUserId: targetId });
    assert.equal(revoke.status, 200);
    assert.deepEqual(await revoke.json(), { success: true });

    const claimApproval = await httpRequest("POST", "/api/admin/administrators/approvals", { email: claimEmail });
    assert.equal(claimApproval.status, 200);
    httpHarness.setTestClerkIdentity(clerkIdentity(
      claimId,
      "unverified-primary",
      [
        { id: "unverified-primary", emailAddress: claimEmail, verification: { status: "unverified" } },
        { id: "verified-secondary", emailAddress: otherEmail, verification: { status: "verified" } },
      ],
    ));
    assert.equal((await httpRequest("GET", "/api/admin/administrators")).status, 403);
    let noClaim = sql(`SELECT count(*) FROM ih_admin_users WHERE clerk_user_id = '${claimId}'`);
    assert.match(noClaim, /\s0\s/);

    httpHarness.setTestClerkIdentity(clerkIdentity(
      claimId,
      "verified-primary",
      [
        { id: "verified-primary", emailAddress: otherEmail, verification: { status: "verified" } },
        { id: "verified-secondary", emailAddress: claimEmail, verification: { status: "verified" } },
      ],
    ));
    assert.equal((await httpRequest("GET", "/api/admin/administrators")).status, 403);
    noClaim = sql(`SELECT count(*) FROM ih_admin_users WHERE clerk_user_id = '${claimId}'`);
    assert.match(noClaim, /\s0\s/);

    httpHarness.setTestClerkIdentity(clerkIdentity(
      claimId,
      "verified-primary",
      [{ id: "verified-primary", emailAddress: claimEmail, verification: { status: "verified" } }],
    ));
    const claimed = await httpRequest("GET", "/api/admin/administrators");
    assert.equal(claimed.status, 200);
    const claimedBody = await claimed.json();
    assert.equal(claimedBody.currentUserId, claimId);
    assert.ok(claimedBody.administrators.some((administrator) => administrator.clerkUserId === claimId));
    const audit = claimedBody.audit.filter((entry) => entry.targetEmail === claimEmail);
    assert.ok(audit.some((entry) => entry.action === "approval_claimed"));
  } finally {
    httpHarness.setTestClerkIdentity(null);
    sql(`DELETE FROM ih_admin_access_audit WHERE actor_email IN ('${allEmails.join("','")}') OR target_email IN ('${allEmails.join("','")}')`);
    sql(`DELETE FROM ih_admin_pending_approvals WHERE email IN ('${allEmails.join("','")}')`);
    sql(`DELETE FROM ih_admin_revocations WHERE email IN ('${allEmails.join("','")}')`);
    sql(`DELETE FROM ih_admin_users WHERE clerk_user_id IN ('${allIds.join("','")}')`);
    if (previous === undefined) delete process.env.ADMIN_BOOTSTRAP_EMAILS;
    else process.env.ADMIN_BOOTSTRAP_EMAILS = previous;
  }
});