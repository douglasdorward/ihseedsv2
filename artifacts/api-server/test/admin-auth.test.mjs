import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createServer as createHttpServer } from "node:http";
import { createServer } from "node:net";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { build } from "esbuild";

let roleModule;
let httpHarness;
let httpServer;
let httpBaseUrl;
let originalNodeEnv;
const roleBundle = join(new URL("../../../lib/db", import.meta.url).pathname, `.admin-role-test-${process.pid}.mjs`);
const httpHarnessBundle = join(new URL("../../../lib/db", import.meta.url).pathname, `.admin-http-harness-test-${process.pid}.mjs`);

function sql(query, env = process.env) {
  return execFileSync("psql", [process.env.DATABASE_URL, "-X", "-v", "ON_ERROR_STOP=1", "-At", "-c", query], {
    encoding: "utf8",
    env,
  }).trim();
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
  assert.ok(process.env.CLERK_SECRET_KEY);
  assert.ok(process.env.CLERK_PUBLISHABLE_KEY);
  await build({
    entryPoints: [new URL("../src/lib/admin-role.ts", import.meta.url).pathname],
    bundle: true,
    platform: "node",
    format: "esm",
    external: ["pg", "pg-cloudflare"],
    outfile: roleBundle,
  });
  roleModule = await import(`${new URL(`file://${roleBundle}`).href}?v=${Date.now()}`);
  originalNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  await build({
    entryPoints: [new URL("./admin-http-harness.ts", import.meta.url).pathname],
    bundle: true,
    platform: "node",
    format: "esm",
    external: ["pg", "pg-cloudflare"],
    outfile: httpHarnessBundle,
    banner: { js: `import { createRequire as __testCreateRequire } from "node:module"; globalThis.require = __testCreateRequire(import.meta.url);` },
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
  const port = await freePort();
  httpBaseUrl = `http://127.0.0.1:${port}`;
  httpServer = createHttpServer(httpHarness.default);
  await new Promise((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(port, "127.0.0.1", resolve);
  });
});

after(async () => {
  await rm(roleBundle, { force: true });
  await rm(httpHarnessBundle, { force: true });
  httpHarness?.setTestClerkIdentity(null);
  httpHarness?.resetTestClerkOperations();
  if (httpServer) await new Promise((resolve) => httpServer.close(resolve));
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
});

function request(method, path, body) {
  return fetch(`${httpBaseUrl}${path}`, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function identity(userId, email, verified = true) {
  return {
    userId,
    primaryEmailAddressId: "primary",
    emailAddresses: [{
      id: "primary",
      emailAddress: email,
      verification: { status: verified ? "verified" : "unverified" },
    }],
  };
}

function cleanup(ids, emails) {
  sql(`DELETE FROM ih_admin_access_audit WHERE actor_email IN ('${emails.join("','")}') OR target_email IN ('${emails.join("','")}')`);
  sql(`DELETE FROM ih_admin_users WHERE clerk_user_id IN ('${ids.join("','")}')`);
}

test("legacy databases execute the simple administrator migration", () => {
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
    assert.equal(sql("SELECT password_operation_id FROM ih_admin_users LIMIT 0; SELECT count(*) FROM ih_schema_migrations WHERE name IN ('0022_simple_admin_accounts.sql', '0023_admin_password_operation_lock.sql');", scopedEnv), "2");
  } finally {
    sql(`DROP SCHEMA ${schema} CASCADE`);
  }
});

test("the ledger requires an exact verified, active administrator identity", async () => {
  const id = `auth-role-${process.pid}`;
  const email = `role-${process.pid}@example.test`;
  try {
    cleanup([id], [email]);
    sql(`INSERT INTO ih_admin_users (clerk_user_id, email, role, must_change_password) VALUES ('${id}', '${email}', 'admin', false)`);
    assert.equal((await roleModule.resolveAdminIdentity(id, email))?.role, "admin");
    assert.equal(await roleModule.resolveAdminIdentity(id, `wrong-${email}`), null);
    assert.equal(roleModule.verifiedPrimaryEmail(identity(id, email, false)), "");
    sql(`UPDATE ih_admin_users SET disabled_at = now() WHERE clerk_user_id = '${id}'`);
    assert.equal(await roleModule.resolveAdminIdentity(id, email), null);
  } finally {
    cleanup([id], [email]);
  }
});

test("public catalogue stays anonymous and unsigned callers cannot use administrator routes", async () => {
  assert.equal((await request("GET", "/api/products")).status, 200);
  const session = await request("GET", "/api/auth/session");
  assert.equal(session.status, 401);
  assert.deepEqual(await session.json(), { signedIn: false, authorized: false });
  assert.equal((await request("GET", "/api/admin/products")).status, 401);
  assert.equal((await request("GET", "/api/admin/administrators")).status, 401);
});

test("ordinary administrators cannot manage accounts and temporary passwords block catalogue access", async () => {
  const id = `auth-admin-${process.pid}`;
  const email = `admin-${process.pid}@example.test`;
  try {
    cleanup([id], [email]);
    sql(`INSERT INTO ih_admin_users (clerk_user_id, email, role, must_change_password) VALUES ('${id}', '${email}', 'admin', false)`);
    httpHarness.setTestClerkIdentity(identity(id, email));
    assert.equal((await request("GET", "/api/admin/products")).status, 200);
    assert.equal((await request("GET", "/api/admin/administrators")).status, 403);
    sql(`UPDATE ih_admin_users SET must_change_password = true WHERE clerk_user_id = '${id}'`);
    assert.equal((await request("GET", "/api/admin/products")).status, 428);
  } finally {
    httpHarness.setTestClerkIdentity(null);
    cleanup([id], [email]);
  }
});

test("Superadmin creates, disables, restores, and resets an administrator", async () => {
  const actorId = `auth-super-${process.pid}`;
  const actorEmail = `super-${process.pid}@example.test`;
  const targetEmail = `target-${process.pid}@example.test`;
  let targetId = "";
  const configuredSuperadmin = process.env.ADMIN_SUPERADMIN_EMAIL?.toLowerCase();
  try {
    cleanup([actorId], [actorEmail, targetEmail]);
    sql("UPDATE ih_admin_users SET role = 'admin' WHERE role = 'superadmin'");
    sql(`INSERT INTO ih_admin_users (clerk_user_id, email, role, must_change_password) VALUES ('${actorId}', '${actorEmail}', 'superadmin', false)`);
    httpHarness.resetTestClerkOperations();
    httpHarness.setTestClerkIdentity(identity(actorId, actorEmail));

    const list = await request("GET", "/api/admin/administrators");
    assert.equal(list.status, 200);
    assert.equal((await list.json()).currentUserId, actorId);

    const created = await request("POST", "/api/admin/administrators", { email: targetEmail });
    assert.equal(created.status, 201);
    const createdBody = await created.json();
    assert.equal(createdBody.success, true);
    assert.ok(createdBody.temporaryPassword.length >= 15);
    targetId = sql(`SELECT clerk_user_id FROM ih_admin_users WHERE email = '${targetEmail}'`);
    assert.ok(targetId);
    assert.equal(sql(`SELECT role || ':' || must_change_password FROM ih_admin_users WHERE clerk_user_id = '${targetId}'`), "admin:true");

    assert.equal((await request("PATCH", `/api/admin/administrators/${targetId}/status`, { disabled: true })).status, 200);
    assert.ok(sql(`SELECT disabled_at IS NOT NULL FROM ih_admin_users WHERE clerk_user_id = '${targetId}'`) === "t");
    assert.equal(httpHarness.getTestClerkOperations().users.find((user) => user.id === targetId)?.banned, true);

    assert.equal((await request("PATCH", `/api/admin/administrators/${targetId}/status`, { disabled: false })).status, 200);
    assert.equal(httpHarness.getTestClerkOperations().users.find((user) => user.id === targetId)?.banned, false);

    const reset = await request("POST", `/api/admin/administrators/${targetId}/temporary-password`);
    assert.equal(reset.status, 200);
    assert.ok((await reset.json()).temporaryPassword.length >= 15);
    assert.equal(httpHarness.getTestClerkOperations().users.find((user) => user.id === targetId)?.passwordUpdated, true);
    assert.equal(
      httpHarness.getTestClerkOperations().userUpdates.find((update) => update.userId === targetId)?.signOutOfOtherSessions,
      true,
    );

    assert.equal((await request("PATCH", `/api/admin/administrators/${actorId}/status`, { disabled: true })).status, 409);

    sql(`UPDATE ih_admin_users SET must_change_password = true WHERE clerk_user_id = '${actorId}'`);
    sql(`UPDATE ih_admin_users SET password_operation_id = 'reset-in-progress' WHERE clerk_user_id = '${actorId}'`);
    assert.equal((await request("POST", "/api/auth/password", {
      currentPassword: "Temporary-password-123!",
      newPassword: "A-new-secure-password-123!",
    })).status, 400);
    sql(`UPDATE ih_admin_users SET password_operation_id = null WHERE clerk_user_id = '${actorId}'`);
    assert.equal((await request("POST", "/api/auth/password", {
      currentPassword: "Temporary-password-123!",
      newPassword: "A-new-secure-password-123!",
    })).status, 200);
    assert.equal(
      httpHarness.getTestClerkOperations().userUpdates
        .filter((update) => update.userId === actorId)
        .at(-1)?.signOutOfOtherSessions,
      undefined,
    );
    assert.equal(sql(`SELECT must_change_password FROM ih_admin_users WHERE clerk_user_id = '${actorId}'`), "f");
    assert.equal((await request("POST", "/api/auth/password", {
      currentPassword: "A-new-secure-password-123!",
      newPassword: "Another-secure-password-123!",
    })).status, 409);
  } finally {
    httpHarness.setTestClerkIdentity(null);
    cleanup([actorId, targetId || "none"], [actorEmail, targetEmail]);
    if (configuredSuperadmin) {
      sql(`UPDATE ih_admin_users SET role = 'superadmin' WHERE email = '${configuredSuperadmin.replaceAll("'", "''")}'`);
    }
  }
});