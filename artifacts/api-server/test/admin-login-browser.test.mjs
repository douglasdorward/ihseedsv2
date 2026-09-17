import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { after, before, test } from "node:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { clerkClient } from "@clerk/express";

/*
 * This is intentionally a browser-level auth regression.  The page is served
 * by the built application and the Clerk session is created by the actual
 * @clerk/react hook; no fake hook, provider, or session is injected.
 *
 * The fixture is created with Clerk's server-side API and its ledger row is
 * written directly to the test database.  Passwords stay in this process and
 * are never logged, asserted in messages, or written to a fixture file.
 */

const serverRoot = new URL("..", import.meta.url);
const runId = `browser-admin-login-${process.pid}-${Date.now()}`;
const fixture = {
  email: "",
  initialPassword: `IhLogin-${randomUUID()}-aA1!`,
  newPassword: `IhChanged-${randomUUID()}-aA1!`,
};
const chromeBin = process.env.CHROMIUM_BIN ?? "/repl/tools/bin/chromium";

let api;
let chrome;
let cdp;
let baseUrl;
let tempDir;
let clerkUserId;
let allowlistIdentifierId;
let testingToken;
let mailboxId;
let mailboxToken;
let mailboxPassword;

const mailApi = "https://api.mail.tm";

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : null;
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  assert.ok(port, "Expected a free local port");
  return port;
}

async function waitFor(check, label, attempts = 180) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const value = await check();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${label}${lastError ? `: ${lastError.message}` : ""}`);
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sql(query) {
  execFileSync("psql", [
    process.env.DATABASE_URL,
    "-X",
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    query,
  ], {
    encoding: "utf8",
    // Never expose database output (which could contain account data).
    stdio: ["ignore", "ignore", "ignore"],
  });
}

async function removeFixture() {
  if (allowlistIdentifierId) {
    await clerkClient.allowlistIdentifiers
      .deleteAllowlistIdentifier(allowlistIdentifierId)
      .catch(() => undefined);
    allowlistIdentifierId = undefined;
  }
  if (clerkUserId) {
    await clerkClient.users.deleteUser(clerkUserId).catch(() => undefined);
    clerkUserId = undefined;
  }
  if (process.env.DATABASE_URL) {
    sql(`DELETE FROM ih_admin_access_audit
      WHERE target_email = ${sqlString(fixture.email)}
         OR actor_email = ${sqlString(fixture.email)};
      DELETE FROM ih_admin_pending_approvals WHERE email = ${sqlString(fixture.email)};
      DELETE FROM ih_admin_revocations WHERE email = ${sqlString(fixture.email)};
      DELETE FROM ih_admin_users
      WHERE email = ${sqlString(fixture.email)}
         OR clerk_user_id = ${sqlString(clerkUserId ?? "")};`);
  }
  if (mailboxId && mailboxToken) {
    await fetch(`${mailApi}/accounts/${mailboxId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${mailboxToken}` },
    }).catch(() => undefined);
  }
  mailboxId = undefined;
  mailboxToken = undefined;
  mailboxPassword = undefined;
}

async function createMailbox() {
  const domainResponse = await fetch(`${mailApi}/domains?page=1`);
  assert.ok(domainResponse.ok, "Disposable mailbox domain lookup failed");
  const domains = await domainResponse.json();
  const domain = domains["hydra:member"]?.[0]?.domain;
  assert.ok(domain, "Disposable mailbox service returned no active domain");
  mailboxPassword = `Mailbox-${randomUUID()}-aA1!`;
  fixture.email = `${runId.replaceAll("-", "")}@${domain}`;
  const accountResponse = await fetch(`${mailApi}/accounts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address: fixture.email, password: mailboxPassword }),
  });
  assert.ok(accountResponse.ok, "Disposable mailbox creation failed");
  const account = await accountResponse.json();
  mailboxId = account.id;
  const tokenResponse = await fetch(`${mailApi}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address: fixture.email, password: mailboxPassword }),
  });
  assert.ok(tokenResponse.ok, "Disposable mailbox authentication failed");
  mailboxToken = (await tokenResponse.json()).token;
  assert.ok(mailboxToken, "Disposable mailbox did not return an access token");
}

async function readClientTrustCode() {
  const response = await fetch(`${mailApi}/messages`, {
    headers: { Authorization: `Bearer ${mailboxToken}` },
  });
  if (!response.ok) return false;
  const messages = await response.json();
  const message = messages["hydra:member"]?.[0];
  if (!message) return false;
  const detailResponse = await fetch(`${mailApi}/messages/${message.id}`, {
    headers: { Authorization: `Bearer ${mailboxToken}` },
  });
  if (!detailResponse.ok) return false;
  const detail = await detailResponse.json();
  const content = String(detail.text || detail.html || detail.intro || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
  const labelled = content.match(/(?:verification|security|sign.?in)[^0-9]{0,100}(\d{6})/i);
  return labelled?.[1] ?? content.match(/\b(\d{6})\b/)?.[1] ?? false;
}

async function createFixture() {
  assert.ok(process.env.DATABASE_URL, "DATABASE_URL is required");
  assert.ok(process.env.CLERK_SECRET_KEY, "CLERK_SECRET_KEY is required");
  assert.ok(process.env.VITE_CLERK_PUBLISHABLE_KEY, "VITE_CLERK_PUBLISHABLE_KEY is required");
  await createMailbox();

  // An allowlist entry is needed only while creating the disposable identity.
  // It is removed immediately; active users do not need a persistent entry.
  const allowed = await clerkClient.allowlistIdentifiers.createAllowlistIdentifier({
    identifier: fixture.email,
    notify: false,
  });
  allowlistIdentifierId = allowed.id;
  const user = await clerkClient.users.createUser({
    emailAddress: [fixture.email],
    password: fixture.initialPassword,
    skipLegalChecks: true,
  });
  clerkUserId = user.id;
  await clerkClient.allowlistIdentifiers.deleteAllowlistIdentifier(allowlistIdentifierId);
  allowlistIdentifierId = undefined;
  // Clerk testing tokens keep this real browser flow deterministic without
  // weakening the application or logging into a pre-existing account.
  testingToken = (await clerkClient.testingTokens.createTestingToken()).token;

  sql(`DELETE FROM ih_admin_users WHERE email = ${sqlString(fixture.email)};
    INSERT INTO ih_admin_users (clerk_user_id, email, role, must_change_password)
    VALUES (${sqlString(clerkUserId)}, ${sqlString(fixture.email)}, 'admin', true);`);
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 0;
    this.pending = new Map();
    ws.onmessage = ({ data }) => {
      const message = JSON.parse(data);
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      clearTimeout(pending.timer);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
    };
  }

  call(method, params = {}) {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (!this.pending.has(id)) return;
        this.pending.delete(id);
        reject(new Error(`CDP ${method} timed out`));
      }, 15000);
      this.pending.set(id, { resolve, reject, timer });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression, awaitPromise = false) {
    const result = await this.call("Runtime.evaluate", {
      expression,
      awaitPromise,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    }
    return result.result.value;
  }
}

function regexExpression(regex) {
  return `new RegExp(${JSON.stringify(regex.source)}, ${JSON.stringify(regex.flags)})`;
}

async function waitForVisibleText(regex, label = regex.toString()) {
  await waitFor(
    () => cdp.evaluate(`(() => {
      const pattern = ${regexExpression(regex)};
      return Array.from(document.querySelectorAll("body *")).some((element) =>
        (element.offsetParent || element.getClientRects().length)
          && pattern.test(element.textContent?.replace(/\\s+/g, " ").trim() || "")
      );
    })()`),
    label,
  );
}

async function waitForVisibleAlert(regex, label = `alert ${regex}`) {
  await waitFor(
    () => cdp.evaluate(`Array.from(document.querySelectorAll('[role="alert"]')).some((element) =>
      (element.offsetParent || element.getClientRects().length)
        && ${regexExpression(regex)}.test(element.textContent?.replace(/\\s+/g, " ").trim() || "")
    )`),
    label,
  );
}

async function waitForSelector(selector) {
  await waitFor(
    () => cdp.evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`),
    selector,
  );
}

async function setInput(selector, value, index = 0) {
  await waitForSelector(selector);
  await cdp.evaluate(`(() => {
    const input = document.querySelectorAll(${JSON.stringify(selector)})[${index}];
    if (!input) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  })()`);
}

async function clickSubmit(label) {
  await waitFor(
    () => cdp.evaluate(`(() => {
      const button = document.querySelector('button[type="submit"]');
      return Boolean(button && (button.offsetParent || button.getClientRects().length) && !button.disabled);
    })()`),
    `${label} submit button`,
  );
  await cdp.evaluate("document.querySelector('button[type=\"submit\"]')?.click()");
}

async function navigate(path) {
  await cdp.call("Page.navigate", { url: `${baseUrl}${path}` });
  await waitFor(
    () => cdp.evaluate('document.readyState === "complete" || document.readyState === "interactive"'),
    `navigation to ${path}`,
  );
}

async function reload() {
  await cdp.call("Page.reload", { ignoreCache: true });
  await waitFor(
    () => cdp.evaluate('document.readyState === "complete" || document.readyState === "interactive"'),
    "page reload",
  );
}

before(async () => {
  await createFixture();
  tempDir = mkdtempSync(join(tmpdir(), "ih-admin-login-browser-"));

  const apiPort = await freePort();
  baseUrl = `http://127.0.0.1:${apiPort}`;
  api = spawn(process.execPath, ["--enable-source-maps", "./dist/index.mjs"], {
    cwd: new URL(serverRoot).pathname,
    env: {
      ...process.env,
      NODE_ENV: "development",
      PORT: String(apiPort),
    },
    stdio: ["ignore", "ignore", "ignore"],
  });
  await waitFor(async () => (await fetch(`${baseUrl}/api/healthz`)).ok, "isolated API server");

  const chromePort = await freePort();
  chrome = spawn(chromeBin, [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    `--remote-debugging-port=${chromePort}`,
    `--user-data-dir=${join(tempDir, "chrome")}`,
    "about:blank",
  ], { stdio: "ignore" });
  const target = await waitFor(async () => {
    const response = await fetch(`http://127.0.0.1:${chromePort}/json/list`);
    const pages = await response.json();
    return pages.find((page) => page.type === "page");
  }, "Chromium CDP target");
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  cdp = new Cdp(ws);
  await cdp.call("Page.enable");
});

after(async () => {
  cdp?.ws.close();
  chrome?.kill("SIGTERM");
  api?.kill("SIGTERM");
  if (tempDir) rmSync(tempDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  await removeFixture();
});

test("real Clerk login enables, rejects invalid credentials, changes first password, and survives reload", async () => {
  await navigate(`/admin/sign-in?__clerk_testing_token=${encodeURIComponent(testingToken)}`);
  await waitForVisibleText(/Administrator login/i, "administrator login");

  // Regression guard: this was permanently disabled when the non-legacy hook
  // was imported while the component still used its legacy contract.
  await setInput('input[autocomplete="username"]', fixture.email);
  await setInput('input[autocomplete="current-password"]', "not-the-fixture-password");
  const buttonState = await cdp.evaluate(`(() => {
    const button = document.querySelector('button[type="submit"]');
    return { present: Boolean(button), disabled: Boolean(button?.disabled) };
  })()`);
  assert.deepEqual(buttonState, { present: true, disabled: false }, "Login button should enable after Clerk loads and fields are filled");

  await clickSubmit("invalid credential");
  await waitForVisibleAlert(/incorrect|invalid|password|sign in/i, "invalid credential error");
  await waitForVisibleText(/Administrator login/i, "login after invalid credentials");

  // The following submission crosses the real Clerk SDK and activates the
  // resulting browser session through the application's setActive call.
  await setInput('input[autocomplete="current-password"]', fixture.initialPassword);
  await clickSubmit("valid credential");
  const firstAuthState = await waitFor(
    () => cdp.evaluate(`(() => {
      if (document.querySelector('input[autocomplete="one-time-code"]')) return "client-trust";
      if (/Choose your password/i.test(document.body.textContent ?? "")) return "password-change";
      return false;
    })()`),
    "Clerk client-trust verification or password-change screen",
  );
  if (firstAuthState === "client-trust") {
    const verificationCode = await waitFor(
      readClientTrustCode,
      "client-trust email verification code",
      600,
    );
    await setInput('input[autocomplete="one-time-code"]', verificationCode);
    await clickSubmit("client-trust verification");
  }
  try {
    await waitForVisibleText(/Choose your password/i, "mandatory password change");
  } catch (error) {
    const diagnostics = await cdp.evaluate(`(() => ({
      href: location.pathname,
      visibleText: document.body.textContent?.replace(/\\s+/g, " ").trim().slice(0, 1200),
      alerts: Array.from(document.querySelectorAll('[role="alert"]')).map((element) => element.textContent?.replace(/\\s+/g, " ").trim()),
      buttons: Array.from(document.querySelectorAll("button")).filter((button) => button.offsetParent || button.getClientRects().length).map((button) => ({ text: button.textContent?.replace(/\\s+/g, " ").trim(), disabled: button.disabled })),
      inputMetadata: Array.from(document.querySelectorAll("input")).map((input) => ({ type: input.type, autocomplete: input.autocomplete, name: input.name, id: input.id })),
    }))()`);
    console.error("Safe valid-sign-in diagnostics", JSON.stringify({
      ...diagnostics,
    }));
    throw error;
  }

  await setInput('input[autocomplete="current-password"]', fixture.initialPassword);
  await setInput('input[autocomplete="new-password"]', fixture.newPassword, 0);
  await setInput('input[autocomplete="new-password"]', fixture.newPassword, 1);
  await clickSubmit("password change");
  await waitForVisibleText(/Good morning,\s*team/i, "admin dashboard after password change");

  const changedSession = await cdp.evaluate(
    'fetch("/api/auth/session", { credentials: "include", cache: "no-store" }).then(async (response) => ({ status: response.status, body: await response.json() }))',
    true,
  );
  assert.equal(changedSession.status, 200, "Changed-password session should be authorized");
  assert.equal(changedSession.body.authorized, true);
  assert.equal(changedSession.body.mustChangePassword, false);

  await reload();
  await waitForVisibleText(/Good morning,\s*team/i, "admin dashboard after reload");
  const reloadedSession = await cdp.evaluate(
    'fetch("/api/auth/session", { credentials: "include", cache: "no-store" }).then(async (response) => ({ status: response.status, body: await response.json() }))',
    true,
  );
  assert.equal(reloadedSession.status, 200, "Reloaded session should remain authorized");
  assert.equal(reloadedSession.body.authorized, true);
  assert.equal(reloadedSession.body.mustChangePassword, false);
});