import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { clerkClient } from "@clerk/express";

const root = new URL("..", import.meta.url);
const mailApi = "https://api.mail.tm";
const runId = `browser-admin-recovery-${process.pid}-${Date.now()}`;
const fixture = {
  email: "",
  initialPassword: `IhRecovery-${randomUUID()}-aA1!`,
  newPassword: `IhRecovered-${randomUUID()}-aA1!`,
};
const chromeBin = process.env.CHROMIUM_BIN ?? "/repl/tools/bin/chromium";
let clerkUserId;
let allowlistId;
let mailboxId;
let mailboxToken;
let mailboxPassword;
let testingToken;
let api;
let chrome;
let cdp;
let tempDir;
let baseUrl;

const sqlString = (value) => `'${String(value).replaceAll("'", "''")}'`;
const sql = (query) => execFileSync("psql", [
  process.env.DATABASE_URL, "-X", "-v", "ON_ERROR_STOP=1", "-c", query,
], { encoding: "utf8", stdio: ["ignore", "ignore", "ignore"] });
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const port = address?.port;
  await new Promise((resolve) => server.close(resolve));
  assert.ok(port);
  return port;
}

async function waitFor(check, label, attempts = 180) {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
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

async function createMailbox() {
  const domains = await (await fetch(`${mailApi}/domains?page=1`)).json();
  const domain = domains["hydra:member"]?.[0]?.domain;
  assert.ok(domain, "Disposable mailbox has no available domain");
  fixture.email = `${runId.replaceAll("-", "")}@${domain}`;
  mailboxPassword = `Mailbox-${randomUUID()}-aA1!`;
  const account = await fetch(`${mailApi}/accounts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address: fixture.email, password: mailboxPassword }),
  });
  assert.ok(account.ok, "Disposable mailbox creation failed");
  mailboxId = (await account.json()).id;
  const token = await fetch(`${mailApi}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address: fixture.email, password: mailboxPassword }),
  });
  assert.ok(token.ok, "Disposable mailbox authentication failed");
  mailboxToken = (await token.json()).token;
}

async function readMailCode() {
  const list = await fetch(`${mailApi}/messages`, { headers: { Authorization: `Bearer ${mailboxToken}` } });
  if (!list.ok) return false;
  const messages = (await list.json())["hydra:member"] ?? [];
  const message = messages[0];
  if (!message) return false;
  const detail = await fetch(`${mailApi}/messages/${message.id}`, { headers: { Authorization: `Bearer ${mailboxToken}` } });
  if (!detail.ok) return false;
  const body = await detail.json();
  const text = `${body.subject || ""} ${body.text || body.html || body.intro || ""}`
    .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  return [...new Set([
    text.match(/(?:verification|security|reset|code)[^0-9]{0,100}(\d{6})/i)?.[1],
    ...[...text.matchAll(/\b(\d{6})\b/g)].map((match) => match[1]),
  ].filter(Boolean))];
}

async function clearMailbox() {
  const list = await fetch(`${mailApi}/messages`, { headers: { Authorization: `Bearer ${mailboxToken}` } });
  if (!list.ok) return;
  const messages = (await list.json())["hydra:member"] ?? [];
  await Promise.all(messages.map((message) => fetch(`${mailApi}/messages/${message.id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${mailboxToken}` },
  }).catch(() => undefined)));
}

async function createFixture() {
  await createMailbox();
  const allowed = await clerkClient.allowlistIdentifiers.createAllowlistIdentifier({
    identifier: fixture.email,
    notify: false,
  });
  allowlistId = allowed.id;
  const user = await clerkClient.users.createUser({
    emailAddress: [fixture.email],
    password: fixture.initialPassword,
    skipLegalChecks: true,
  });
  clerkUserId = user.id;
  await clerkClient.allowlistIdentifiers.deleteAllowlistIdentifier(allowlistId);
  allowlistId = undefined;
  testingToken = (await clerkClient.testingTokens.createTestingToken()).token;
  sql(`DELETE FROM ih_admin_users WHERE email = ${sqlString(fixture.email)};
    INSERT INTO ih_admin_users (clerk_user_id, email, role, must_change_password)
    VALUES (${sqlString(clerkUserId)}, ${sqlString(fixture.email)}, 'admin', true);`);
}

async function removeFixture() {
  if (allowlistId) await clerkClient.allowlistIdentifiers.deleteAllowlistIdentifier(allowlistId).catch(() => undefined);
  if (clerkUserId) await clerkClient.users.deleteUser(clerkUserId).catch(() => undefined);
  sql(`DELETE FROM ih_admin_access_audit WHERE target_email = ${sqlString(fixture.email)} OR actor_email = ${sqlString(fixture.email)};
    DELETE FROM ih_admin_users WHERE email = ${sqlString(fixture.email)};`);
  if (mailboxId && mailboxToken) await fetch(`${mailApi}/accounts/${mailboxId}`, {
    method: "DELETE", headers: { Authorization: `Bearer ${mailboxToken}` },
  }).catch(() => undefined);
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.onmessage = ({ data }) => {
      const message = JSON.parse(data);
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      clearTimeout(pending.timer);
      message.error ? pending.reject(new Error(message.error.message)) : pending.resolve(message.result);
    };
  }
  call(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`CDP ${method} timed out`)), 15000);
      this.pending.set(id, { resolve, reject, timer });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression, awaitPromise = false) {
    const result = await this.call("Runtime.evaluate", { expression, awaitPromise, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  }
}

async function visibleText(regex, label) {
  await waitFor(() => cdp.evaluate(`Array.from(document.querySelectorAll("body *")).some((element) =>
    (element.offsetParent || element.getClientRects().length)
    && ${regex.toString()}.test(element.textContent?.replace(/\\s+/g, " ").trim() || ""))`), label);
}
async function setInput(selector, value, index = 0) {
  await waitFor(() => cdp.evaluate(`Boolean(document.querySelectorAll(${JSON.stringify(selector)})[${index}])`), selector);
  await cdp.evaluate(`(() => {
    const input = document.querySelectorAll(${JSON.stringify(selector)})[${index}];
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);
}
async function clickButton(text) {
  await waitFor(() => cdp.evaluate(`Array.from(document.querySelectorAll("button")).some((button) =>
    !button.disabled && (button.offsetParent || button.getClientRects().length)
    && ${text.toString()}.test(button.textContent?.trim() || ""))`), `button ${text}`);
  await cdp.evaluate(`Array.from(document.querySelectorAll("button")).find((button) =>
    !button.disabled && ${text.toString()}.test(button.textContent?.trim() || ""))?.click()`);
}
async function navigate(path) {
  await cdp.call("Page.navigate", { url: `${baseUrl}${path}` });
  await waitFor(() => cdp.evaluate("document.readyState === 'complete'"), "page load");
}

before(async () => {
  await createFixture();
  tempDir = mkdtempSync(join(tmpdir(), "ih-admin-recovery-browser-"));
  const apiPort = await freePort();
  baseUrl = `http://127.0.0.1:${apiPort}`;
  api = spawn(process.execPath, ["--enable-source-maps", "./dist/index.mjs"], {
    cwd: new URL(root).pathname,
    env: { ...process.env, NODE_ENV: "development", PORT: String(apiPort) },
    stdio: ["ignore", "ignore", "ignore"],
  });
  await waitFor(async () => (await fetch(`${baseUrl}/api/healthz`)).ok, "isolated API");
  const chromePort = await freePort();
  chrome = spawn(chromeBin, ["--headless=new", "--no-sandbox", "--disable-gpu",
    `--remote-debugging-port=${chromePort}`, `--user-data-dir=${join(tempDir, "chrome")}`, "about:blank"], { stdio: "ignore" });
  const target = await waitFor(async () => (await (await fetch(`http://127.0.0.1:${chromePort}/json/list`)).json())
    .find((page) => page.type === "page"), "Chromium");
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  cdp = new Cdp(ws);
  await cdp.call("Page.enable");
  await cdp.call("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
});

after(async () => {
  cdp?.ws.close();
  chrome?.kill("SIGTERM");
  api?.kill("SIGTERM");
  if (tempDir) rmSync(tempDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  await removeFixture();
});

test("real Clerk forgot-password flow verifies code, changes password, and denies disabled accounts", async () => {
  await navigate(`/admin/sign-in?__clerk_testing_token=${encodeURIComponent(testingToken)}`);
  await visibleText(/Administrator login/i, "administrator login");
  await clickButton(/forgot password/i);
  await visibleText(/Reset your password|Forgot password/i, "password recovery");
  await setInput('input[type="email"]', fixture.email);
  await clearMailbox();
  await clickButton(/send|continue|reset/i);
  await visibleText(/verification code|check your email/i, "verification code");

  await setInput('input[autocomplete="one-time-code"], input[inputmode="numeric"]', "000000");
  await clickButton(/verify|continue|reset/i);
  await waitFor(() => cdp.evaluate(`Array.from(document.querySelectorAll('[role="alert"]')).some((element) =>
    /invalid|incorrect|expired|code/i.test(element.textContent || ""))`), "invalid recovery-code error");

  let codes = await waitFor(async () => {
    const result = await readMailCode();
    return result.length ? result : false;
  }, "password recovery email code", 600);
  let recoveryCompleted = false;
  for (const code of codes) {
    await setInput('input[autocomplete="one-time-code"], input[inputmode="numeric"]', code);
    await clickButton(/verify|continue|reset/i);
    recoveryCompleted = await cdp.evaluate(`Array.from(document.querySelectorAll("input")).some((input) =>
      input.autocomplete === "new-password")`);
    if (recoveryCompleted) break;
    await delay(250);
  }
  if (!recoveryCompleted) {
    const cooldownState = await cdp.evaluate(`(() => {
      const button = Array.from(document.querySelectorAll("button")).find((candidate) =>
        /resend code/i.test(candidate.textContent || ""));
      return { text: button?.textContent?.trim(), disabled: Boolean(button?.disabled) };
    })()`);
    if (cooldownState.disabled) {
      assert.match(cooldownState.text ?? "", /resend code in \d+s/i);
      await clickButton(/back to login/i);
      await clickButton(/forgot password/i);
      await setInput('input[type="email"]', fixture.email);
      await clearMailbox();
      await clickButton(/send recovery code/i);
      await visibleText(/verification code|check your email/i, "resent recovery-code form");
    } else {
      await clearMailbox();
      await clickButton(/resend code/i);
      await visibleText(/verification code|check your email/i, "resent recovery-code form");
    }
    codes = await waitFor(async () => {
      const result = await readMailCode();
      return result.length ? result : false;
    }, "resent password recovery email code", 600);
    for (const code of codes) {
      await setInput('input[autocomplete="one-time-code"], input[inputmode="numeric"]', code);
      await clickButton(/verify|continue|reset/i);
      recoveryCompleted = await cdp.evaluate(`Array.from(document.querySelectorAll("input")).some((input) =>
        input.autocomplete === "new-password")`);
      if (recoveryCompleted) break;
      await delay(250);
    }
  }
  try {
    await visibleText(/new password|choose your password/i, "new password form");
  } catch (error) {
    const diagnostics = await cdp.evaluate(`(() => ({
      path: location.pathname,
      text: document.body.textContent?.replace(/\\s+/g, " ").trim().slice(0, 1400),
      alerts: Array.from(document.querySelectorAll('[role="alert"]')).map((element) => element.textContent?.trim()),
      buttons: Array.from(document.querySelectorAll("button")).filter((button) => button.offsetParent || button.getClientRects().length)
        .map((button) => ({ text: button.textContent?.trim(), disabled: button.disabled })),
      inputs: Array.from(document.querySelectorAll("input")).map((input) => ({ type: input.type, autocomplete: input.autocomplete, valueLength: input.value.length })),
    }))()`);
    console.error("Safe recovery-code diagnostics", JSON.stringify(diagnostics));
    throw error;
  }
  assert.equal(recoveryCompleted, true, "A valid recovery email code should open the new-password step");
  await setInput('input[autocomplete="new-password"]', fixture.newPassword, 0);
  await setInput('input[autocomplete="new-password"]', "Mismatch-Recovery-Password-aA1!", 1);
  await clickButton(/set new password|reset password|save|continue/i);
  await waitFor(() => cdp.evaluate(`Array.from(document.querySelectorAll('[role="alert"]')).some((element) =>
    /match|different|same/i.test(element.textContent || ""))`), "mismatched recovery-password error");
  await setInput('input[autocomplete="new-password"]', fixture.newPassword, 1);
  await clickButton(/set new password|reset password|save|continue/i);
  try {
    await visibleText(/administrator login|good morning|dashboard/i, "post-reset destination");
  } catch (error) {
    const diagnostics = await cdp.evaluate(`(() => ({
      path: location.pathname,
      text: document.body.textContent?.replace(/\\s+/g, " ").trim().slice(0, 1200),
      alerts: Array.from(document.querySelectorAll('[role="alert"]')).map((element) => element.textContent?.trim()),
      buttons: Array.from(document.querySelectorAll("button")).filter((button) => button.offsetParent || button.getClientRects().length)
        .map((button) => ({ text: button.textContent?.trim(), disabled: button.disabled })),
    }))()`);
    console.error("Safe post-reset diagnostics", JSON.stringify(diagnostics));
    throw error;
  }

  await navigate("/admin/sign-in");
  await setInput('input[autocomplete="username"]', fixture.email);
  await setInput('input[autocomplete="current-password"]', fixture.initialPassword);
  await clickButton(/log in/i);
  await waitFor(() => cdp.evaluate(`Array.from(document.querySelectorAll('[role="alert"]')).some((element) =>
    /incorrect|invalid|password|sign in/i.test(element.textContent || ""))`), "old password rejection");

  await setInput('input[autocomplete="current-password"]', fixture.newPassword);
  await clickButton(/log in/i);
  await visibleText(/good morning|dashboard|choose your password/i, "new password sign-in");
  const recovered = await cdp.evaluate('fetch("/api/auth/session",{credentials:"include",cache:"no-store"}).then(async r=>({status:r.status,body:await r.json()}))', true);
  assert.equal(recovered.status, 200);
  assert.equal(recovered.body.authorized, true);
  assert.equal(recovered.body.mustChangePassword, false);

  sql(`UPDATE ih_admin_users SET disabled_at = now() WHERE clerk_user_id = ${sqlString(clerkUserId)};`);
  const disabled = await cdp.evaluate('fetch("/api/auth/session",{credentials:"include",cache:"no-store"}).then(async r=>({status:r.status,body:await r.json()}))', true);
  assert.equal(disabled.status, 401, "disabled ledger users must not retain admin access");
});