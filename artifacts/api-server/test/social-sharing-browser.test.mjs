import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNg+M8AAAICAQB7CYF4AAAAAElFTkSuQmCC", "base64");
const UPLOAD_PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVQImWP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==", "base64");
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function freePort() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function waitFor(fn, label) {
  let last;
  for (let i = 0; i < 150; i += 1) {
    try {
      const result = await fn();
      if (result) return result;
    } catch (error) { last = error; }
    await pause(100);
  }
  throw new Error(`Timed out waiting for ${label}${last ? `: ${last.message}` : ""}`);
}

test("mobile social sharing editor persists library/upload selections, reset, stale edits and errors", { timeout: 90000 }, async () => {
  if (!/^ih_catalogue_test_\d+_\d+$/.test(process.env.CATALOGUE_TEST_DATABASE ?? "")
    || !process.env.DATABASE_URL || new URL(process.env.DATABASE_URL).pathname !== `/${process.env.CATALOGUE_TEST_DATABASE}`) {
    throw new Error("Run only via scripts/run-social-sharing-browser-tests.mjs against its isolated database");
  }
  const dir = mkdtempSync(join(tmpdir(), "ih-social-browser-"));
  const imagePath = join(dir, "browser-share.png");
  writeFileSync(imagePath, UPLOAD_PNG);
  let api, chrome, ws;
  let base;
  const assetIds = [];
  try {
    const port = await freePort();
    base = `http://127.0.0.1:${port}`;
    api = spawn(process.execPath, ["--enable-source-maps", "./dist/index.mjs"], {
      cwd: root, env: { ...process.env, NODE_ENV: "test", ADMIN_TEST_BYPASS: "1", APP_STORAGE_BACKEND: "local", APP_UPLOADS_DIR: join(dir, "uploads"), PORT: String(port) },
      stdio: "ignore",
    });
    await waitFor(async () => {
      if (api.exitCode !== null) throw new Error(`API exited ${api.exitCode}`);
      return (await fetch(`${base}/api/healthz`)).ok;
    }, "isolated API");

    async function request(method, path, body, contentType) {
      const response = await fetch(`${base}/api${path}`, {
        method, headers: body === undefined ? undefined : { "content-type": contentType ?? "application/json" },
        body: body === undefined ? undefined : contentType ? body : JSON.stringify(body),
      });
      const text = await response.text();
      assert.ok(response.ok, `${method} ${path}: HTTP ${response.status} ${text.slice(0, 300)}`);
      return text ? JSON.parse(text) : null;
    }
    const settings = () => request("GET", "/admin/site-settings");
    const save = (s) => request("PUT", "/admin/site-settings", { homepage: s.homepage, seedGuide: s.seedGuide });
    const initial = await settings();
    assert.equal(initial.homepage.socialImageSrc, "", "isolated DB starts with default image");
    const sentinel = "/browser-sentinel-social.jpg";
    await save({ ...initial, homepage: { ...initial.homepage, socialImageSrc: sentinel, socialImageAssetId: null } });

    // Seed a real completed media asset through the same supported three-step API as the editor.
    const filename = `library-share-${process.pid}-${Date.now()}.png`;
    const upload = await request("POST", "/admin/media/upload-request", {
      originalFilename: filename, contentType: "image/png", bytes: PNG.length,
    });
    assetIds.push(upload.assetId);
    await request("PUT", `/admin/media/${upload.assetId}/object`, PNG, "image/png");
    await request("POST", `/admin/media/${upload.assetId}/complete`);

    const chromePort = await freePort();
    chrome = spawn(process.env.CHROMIUM_BIN ?? "/repl/tools/bin/chromium", [
      "--headless=new", "--no-sandbox", "--disable-gpu", `--remote-debugging-port=${chromePort}`,
      `--user-data-dir=${join(dir, "chromium")}`, "about:blank",
    ], { stdio: "ignore" });
    const target = await waitFor(async () => (await (await fetch(`http://127.0.0.1:${chromePort}/json/list`)).json())
      .find((entry) => entry.type === "page"), "Chromium CDP");
    ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
    let nextId = 0;
    const pending = new Map();
    const listeners = [];
    ws.onmessage = ({ data }) => {
      const msg = JSON.parse(data);
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject, timer } = pending.get(msg.id);
        pending.delete(msg.id); clearTimeout(timer);
        if (msg.error) reject(new Error(msg.error.message)); else resolve(msg.result);
      } else if (msg.method === "Fetch.requestPaused") {
        for (const listener of listeners) listener(msg.params);
      }
    };
    function call(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = ++nextId;
        const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP ${method} timeout`)); }, 10000);
        pending.set(id, { resolve, reject, timer });
        ws.send(JSON.stringify({ id, method, params }));
      });
    }
    async function evaluate(expression) {
      const result = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
      return result.result.value;
    }
    const text = (selector) => evaluate(`document.querySelector(${JSON.stringify(selector)})?.textContent || ""`);
    const exists = (selector) => evaluate(`!!document.querySelector(${JSON.stringify(selector)})`);
    async function click(label) {
      const expression = `[...document.querySelectorAll("button")].find(b => b.textContent.trim() === ${JSON.stringify(label)} && !b.disabled)`;
      await waitFor(() => evaluate(`!!${expression}`), `enabled ${label}`);
      assert.equal(await evaluate(`${expression}.click(); true`), true);
    }
    async function navigate(path) {
      await call("Page.navigate", { url: base + path });
    }
    async function reload() { await call("Page.reload", { ignoreCache: true }); }
    const state = () => text('[data-testid="social-site-state"]');
    const preview = () => evaluate('document.querySelector(".admin-social-card-image")?.style.backgroundImage || ""');
    await call("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await navigate("/admin/site-settings/social");
    await waitFor(async () => (await state()).includes(sentinel), "saved URL on mobile");
    await click("Choose from library");
    await waitFor(() => exists('[role="dialog"]'), "library picker");
    await click(filename);
    await waitFor(async () => /Images library/.test(await state()), "selected library image");
    assert.ok((await preview()).includes(`/api/admin/media/${upload.assetId}/preview`));
    await click("Save social sharing");
    await waitFor(async () => (await settings()).homepage.socialImageAssetId === upload.assetId, "saved library image");
    assert.equal((await request("GET", "/site-settings")).homepage.socialImageSrc, `/api/media/${upload.assetId}`);
    await reload();
    await waitFor(async () => /Images library/.test(await state()), "reopened library image");

    // The effective preview in the article editor has no hero yet and must use the saved site image.
    await navigate("/admin/blog/new");
    await waitFor(async () => (await text('[data-testid="social-image-source"]')).includes("Site-wide sharing image"), "article effective preview");
    assert.ok((await evaluate('document.querySelector(".admin-social-thumb")?.style.backgroundImage || ""'))
      .includes(`/api/media/${upload.assetId}`), "article preview displays saved public asset");

    await navigate("/admin/products/new");
    await click("Product page");
    await waitFor(async () => (await text('[data-testid="social-image-source"]')).includes("Site-wide sharing image"), "new product effective preview");
    assert.ok((await evaluate('document.querySelector(".admin-social-thumb")?.style.backgroundImage || ""'))
      .includes(`/api/media/${upload.assetId}`), "product preview displays saved public asset");
    await navigate("/admin/site-settings/social");
    await waitFor(async () => /Images library/.test(await state()), "return to social settings");

    // Exercise the actual browser file input, not only a fixture uploaded via the API.
    const { root: documentNode } = await call("DOM.getDocument");
    const { nodeId } = await call("DOM.querySelector", { nodeId: documentNode.nodeId, selector: 'input[type="file"]' });
    assert.ok(nodeId, "social upload input exists");
    await call("DOM.setFileInputFiles", { nodeId, files: [imagePath] });
    await waitFor(async () => /Images library/.test(await state()) && (await preview()).includes("/api/admin/media/")
      && !(await preview()).includes(upload.assetId), "uploaded browser image selected");
    const uploadedId = /\/api\/admin\/media\/([^/]+)\/preview/.exec(await preview())?.[1];
    assert.ok(uploadedId, "browser upload produced preview asset");
    assetIds.push(uploadedId);
    await click("Save social sharing");
    await waitFor(async () => (await settings()).homepage.socialImageAssetId === uploadedId, "browser upload saved");
    await reload();
    await waitFor(async () => (await preview()).includes(uploadedId), "browser upload reopened");

    const marker = `Stale guard ${Date.now()}`;
    const latest = await settings();
    await save({ ...latest, homepage: { ...latest.homepage, heroEyebrow: marker } });
    await click("Reset to default");
    await waitFor(async () => /default sharing image/.test(await state()), "default preview before save");
    assert.ok((await preview()).includes("/social-share-default.jpg"));
    await click("Save social sharing");
    await waitFor(async () => (await settings()).homepage.socialImageSrc === "", "reset persisted");
    assert.equal((await settings()).homepage.heroEyebrow, marker, "unrelated concurrent edit preserved");
    await reload();
    await waitFor(async () => /default sharing image/.test(await state()), "default after reopen");
    assert.equal(await evaluate('[...document.querySelectorAll("button")].some(b => b.textContent.trim() === "Reset to default")'), false);

    const current = await settings();
    await save({ ...current, homepage: { ...current.homepage, socialImageSrc: sentinel, socialImageAssetId: null } });
    await reload();
    await waitFor(async () => (await state()).includes(sentinel), "error setup");
    let intercepted = false;
    listeners.push((event) => {
      if (event.request.method === "PUT" && !intercepted) {
        intercepted = true;
        void call("Fetch.fulfillRequest", {
          requestId: event.requestId, responseCode: 500,
          responseHeaders: [{ name: "Content-Type", value: "application/json" }],
          body: Buffer.from('{"error":"Simulated failure"}').toString("base64"),
        });
      } else void call("Fetch.continueRequest", { requestId: event.requestId });
    });
    await call("Fetch.enable", { patterns: [{ urlPattern: "*/api/admin/site-settings*", requestStage: "Request" }] });
    await click("Reset to default");
    await click("Save social sharing");
    await waitFor(() => exists('[role="alert"]'), "failed save alert");
    assert.equal(intercepted, true);
    assert.match(await text('[role="alert"]'), /Simulated failure|failed|error/i);
    assert.equal((await settings()).homepage.socialImageSrc, sentinel, "failed save did not persist");
    assert.equal(await evaluate('[...document.querySelectorAll("button")].some(b => b.textContent.trim() === "Save social sharing" && !b.disabled)'), true, "dirty state can retry");
  } finally {
    ws?.close();
    if (base && api?.exitCode === null) {
      for (const id of assetIds) {
        await fetch(`${base}/api/admin/media/${id}`, {
          method: "DELETE", headers: { "content-type": "application/json" }, body: '{"confirm":true}',
        }).catch(() => {});
      }
    }
    chrome?.kill();
    api?.kill();
    rmSync(dir, { recursive: true, force: true });
  }
});