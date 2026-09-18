import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { after, before, test } from "node:test";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

/*
 * This is deliberately a component harness rather than an authenticated
 * application login. It mounts the real Admin component in Chromium, uses a
 * harmless in-memory summary response for the dashboard, and supplies a
 * callback that records sign-out clicks. No Clerk or creator credentials are
 * used.
 */

const claudeDesignRoot = fileURLToPath(new URL("..", import.meta.url));
const viteBin = join(claudeDesignRoot, "node_modules/.bin/vite");
const chromeBin = process.env.CHROMIUM_BIN ?? "/repl/tools/bin/chromium";

let harnessRoot;
let vite;
let chrome;
let cdp;
let baseUrl;
let chromeTempDir;

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
      const result = await check();
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${label}${lastError ? `: ${lastError.message}` : ""}`);
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

async function setViewport(width, height) {
  await cdp.call("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 800,
  });
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

async function clickSelector(selector, touch = false, domClick = false) {
  const rect = await waitFor(
    () => cdp.evaluate(`(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height) return false;
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    })()`),
    `visible ${selector}`,
  );
  if (domClick) {
    await cdp.evaluate(`document.querySelector(${JSON.stringify(selector)})?.click()`);
    return;
  }
  if (touch) {
    await cdp.call("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ id: 1, x: rect.x, y: rect.y }],
    });
    await cdp.call("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    return;
  }
  await cdp.call("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: rect.x,
    y: rect.y,
  });
  await cdp.call("Input.dispatchMouseEvent", {
    type: "mousePressed",
    button: "left",
    clickCount: 1,
    x: rect.x,
    y: rect.y,
  });
  await cdp.call("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    button: "left",
    clickCount: 1,
    x: rect.x,
    y: rect.y,
  });
}

async function sidebarButtonMetrics() {
  return cdp.evaluate(`(() => {
    const button = document.querySelector(".admin-sidebar-signout");
    const rect = button?.getBoundingClientRect();
    const style = button ? getComputedStyle(button) : null;
    return {
      present: Boolean(button),
      visible: Boolean(button && (button.offsetParent || button.getClientRects().length)),
      width: rect?.width ?? 0,
      height: rect?.height ?? 0,
      right: rect?.right ?? 0,
      bottom: rect?.bottom ?? 0,
      display: style?.display ?? "",
    };
  })()`);
}

before(async () => {
  harnessRoot = mkdtempSync(join(claudeDesignRoot, "test", "admin-sidebar-harness-"));
  const harnessName = basename(harnessRoot);
  writeFileSync(join(harnessRoot, "index.html"), `<!doctype html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body><div id="root"></div><script type="module" src="/test/${harnessName}/entry.tsx"></script></body></html>
`);
  writeFileSync(join(harnessRoot, "entry.tsx"), `import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Admin from "../../src/pages/Admin";
import "../../src/styles.css";

window.__harnessErrors = [];
window.__signOutCalls = 0;
window.addEventListener("error", (event) => window.__harnessErrors.push(String(event.error?.stack || event.message)));
window.addEventListener("unhandledrejection", (event) => window.__harnessErrors.push(String(event.reason?.stack || event.reason)));

const summary = {
  totalProducts: 0,
  publishedProducts: 0,
  pendingDrafts: 0,
  lowStockProducts: 0,
  missingTechSheets: 0,
  recentProducts: [],
};
window.fetch = async (input) => {
  const url = String(input);
  const emptyList = url.includes("/articles") || url.includes("/products") || url.includes("/categories") || url.includes("/media") || url.includes("/resellers");
  return new Response(JSON.stringify(url.includes("/summary") ? summary : emptyList ? [] : {}), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
createRoot(document.getElementById("root")).render(
  <QueryClientProvider client={queryClient}>
    <Admin
      role="admin"
      accountName="browser.fixture@example.test"
      onSignOut={async () => { window.__signOutCalls += 1; }}
    />
  </QueryClientProvider>,
);
`);

  const vitePort = await freePort();
  baseUrl = `http://127.0.0.1:${vitePort}`;
  vite = spawn(viteBin, ["--host", "127.0.0.1", "--port", String(vitePort)], {
    cwd: claudeDesignRoot,
    env: { ...process.env, PORT: String(vitePort) },
    stdio: ["ignore", "ignore", "ignore"],
  });
  await waitFor(async () => (await fetch(`${baseUrl}/test/${harnessName}/`)).ok, "temporary Vite harness");

  chromeTempDir = mkdtempSync(join(tmpdir(), "ih-admin-sidebar-browser-"));
  const chromePort = await freePort();
  chrome = spawn(chromeBin, [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    `--remote-debugging-port=${chromePort}`,
    `--user-data-dir=${join(chromeTempDir, "chrome")}`,
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
  await cdp.call("Runtime.enable");
});

after(async () => {
  cdp?.ws.close();
  chrome?.kill("SIGTERM");
  vite?.kill("SIGTERM");
  if (chromeTempDir) rmSync(chromeTempDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  if (harnessRoot) rmSync(harnessRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});

test("sign-out footer stays reachable across sidebar breakpoints and invokes its callback", async () => {
  await setViewport(1280, 800);
  await navigate(`/test/${basename(harnessRoot)}/`);
  await waitFor(() => cdp.evaluate('Boolean(document.querySelector(".admin-sidebar-signout"))'), "sign-out footer");

  const expanded = await sidebarButtonMetrics();
  assert.equal(expanded.present, true);
  assert.equal(expanded.visible, true, "Expanded desktop sign-out icon should be visible");
  assert.ok(expanded.width >= 44 && expanded.height >= 44, "Expanded desktop sign-out target should be at least 44px");

  await clickSelector(".admin-sidebar-signout");
  await waitFor(() => cdp.evaluate("window.__signOutCalls === 1"), "expanded desktop sign-out callback");

  await clickSelector(".admin-sidebar-toggle");
  await waitFor(() => cdp.evaluate('document.querySelector(".admin-sidebar")?.classList.contains("is-collapsed")'), "collapsed desktop sidebar");
  const collapsed = await sidebarButtonMetrics();
  assert.equal(collapsed.visible, true, "Collapsed desktop sign-out icon should remain visible");
  assert.ok(collapsed.width >= 44 && collapsed.height >= 44, "Collapsed desktop sign-out target should be at least 44px");

  await clickSelector(".admin-sidebar-signout");
  await waitFor(() => cdp.evaluate("window.__signOutCalls === 2"), "collapsed desktop sign-out callback");

  await cdp.evaluate("localStorage.removeItem('ih-admin-sidebar')");
  await setViewport(390, 700);
  await reload();
  await waitFor(() => cdp.evaluate('Boolean(document.querySelector(".admin-mobile-toggle"))'), "mobile navigation toggle");
  await clickSelector(".admin-mobile-toggle", true);
  await waitFor(() => cdp.evaluate('document.querySelector(".admin-sidebar")?.classList.contains("is-open")'), "mobile drawer");
  const mobile = await sidebarButtonMetrics();
  assert.equal(mobile.visible, true, "Mobile drawer sign-out icon should be visible");
  assert.ok(mobile.width >= 44 && mobile.height >= 44, "Mobile sign-out target should be at least 44px");
  assert.ok(mobile.right <= 390 && mobile.bottom <= 700, "Mobile sign-out target should remain inside the 390x700 viewport");

  await clickSelector(".admin-sidebar-signout", false, true);
  await waitFor(
    () => cdp.evaluate("window.__signOutCalls === 1"),
    "mobile sign-out callback",
  );

  await setViewport(390, 500);
  await reload();
  await clickSelector(".admin-mobile-toggle", true);
  await waitFor(() => cdp.evaluate('document.querySelector(".admin-sidebar")?.classList.contains("is-open")'), "short mobile drawer");
  const shortMobile = await sidebarButtonMetrics();
  assert.equal(shortMobile.visible, true, "Short mobile drawer sign-out icon should be visible");
  assert.ok(shortMobile.width >= 44 && shortMobile.height >= 44, "Short mobile sign-out target should be at least 44px");
  assert.ok(shortMobile.right <= 390 && shortMobile.bottom <= 500, "Short mobile sign-out target should remain inside the 390x500 viewport");

  await clickSelector(".admin-sidebar-signout", false, true);
  await waitFor(() => cdp.evaluate("window.__signOutCalls === 1"), "short mobile sign-out callback");

  const errors = await cdp.evaluate("window.__harnessErrors");
  assert.deepEqual(errors, [], "The sidebar harness should not emit runtime errors");
});

test("site settings is enabled and opens the hub", async () => {
  await setViewport(1280, 800);
  await navigate(`/test/${basename(harnessRoot)}/`);
  await waitFor(() => cdp.evaluate('Boolean(document.querySelector("#admin-sidebar-nav"))'), "admin navigation");
  const siteSettings = await cdp.evaluate(`(() => {
    const button = [...document.querySelectorAll("#admin-sidebar-nav button")].find((item) => item.textContent.includes("Site settings"));
    return {
      present: Boolean(button),
      disabled: Boolean(button?.disabled),
      soon: Boolean(button?.querySelector("small")),
    };
  })()`);
  assert.equal(siteSettings.present, true);
  assert.equal(siteSettings.disabled, false);
  assert.equal(siteSettings.soon, false);
  await cdp.evaluate(`[...document.querySelectorAll("#admin-sidebar-nav button")].find((item) => item.textContent.includes("Site settings"))?.click()`);
  await waitFor(
    () => cdp.evaluate('Boolean([...document.querySelectorAll("button")].find((item) => item.textContent.includes("Edit home page")))'),
    "site settings hub",
  );
});

test("blog is enabled and opens the article list", async () => {
  await setViewport(1280, 800);
  await navigate(`/test/${basename(harnessRoot)}/`);
  await waitFor(() => cdp.evaluate('Boolean(document.querySelector("#admin-sidebar-nav"))'), "admin navigation");
  const blog = await cdp.evaluate(`(() => {
    const button = [...document.querySelectorAll("#admin-sidebar-nav button")].find((item) => item.textContent.includes("Blog"));
    return {
      present: Boolean(button),
      disabled: Boolean(button?.disabled),
      soon: Boolean(button?.querySelector("small")),
    };
  })()`);
  assert.equal(blog.present, true);
  assert.equal(blog.disabled, false);
  assert.equal(blog.soon, false);
  await cdp.evaluate(`[...document.querySelectorAll("#admin-sidebar-nav button")].find((item) => item.textContent.includes("Blog"))?.click()`);
  await waitFor(
    () => cdp.evaluate('Boolean([...document.querySelectorAll("button")].find((item) => item.textContent.includes("New article")))'),
    "blog article list",
  );
});

test("resellers is enabled and opens the store list", async () => {
  await setViewport(1280, 800);
  await navigate(`/test/${basename(harnessRoot)}/`);
  await waitFor(() => cdp.evaluate('Boolean(document.querySelector("#admin-sidebar-nav"))'), "admin navigation");
  const resellers = await cdp.evaluate(`(() => {
    const button = [...document.querySelectorAll("#admin-sidebar-nav button")].find((item) => item.textContent.includes("Resellers"));
    return {
      present: Boolean(button),
      disabled: Boolean(button?.disabled),
      soon: Boolean(button?.querySelector("small")),
    };
  })()`);
  assert.equal(resellers.present, true);
  assert.equal(resellers.disabled, false);
  assert.equal(resellers.soon, false);
  await cdp.evaluate(`[...document.querySelectorAll("#admin-sidebar-nav button")].find((item) => item.textContent.includes("Resellers"))?.click()`);
  await waitFor(
    () => cdp.evaluate('Boolean([...document.querySelectorAll("button")].find((item) => item.textContent.includes("Add a store")))'),
    "reseller store list",
  );
});