#!/usr/bin/env node
// Measures the images a visitor's browser downloads on key public pages.
//
//   node scripts/measure-images.mjs https://irwinhunter.com.au [/ /products ...]
//
// Each page is loaded at a phone and a desktop viewport and scrolled to the
// bottom so lazy images load. Reports image request count, distinct URLs,
// transferred bytes, optimiser cache hits/misses and per-image wait times.
import puppeteer from "puppeteer-core";
import { execFileSync } from "node:child_process";

const VIEWPORTS = {
  phone: { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1 },
};

const [base = "http://127.0.0.1:24722", ...pathArgs] = process.argv.slice(2);
const paths = pathArgs.length ? pathArgs : ["/", "/products"];

async function measure(browser, url, viewport) {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  await page.setCacheEnabled(false);
  const client = await page.createCDPSession();
  await client.send("Network.enable");
  const requests = new Map();
  client.on("Network.responseReceived", ({ requestId, type, response }) => {
    if (type !== "Image") return;
    requests.set(requestId, {
      url: response.url,
      cache: response.headers["x-nextjs-cache"] ?? response.headers["X-Nextjs-Cache"] ?? "",
      waitMs: response.timing ? response.timing.receiveHeadersEnd - response.timing.sendStart : 0,
      bytes: 0,
    });
  });
  client.on("Network.loadingFinished", ({ requestId, encodedDataLength }) => {
    const entry = requests.get(requestId);
    if (entry) entry.bytes = encodedDataLength;
  });
  await page.goto(url, { waitUntil: "networkidle2", timeout: 120000 });
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += window.innerHeight / 2) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  });
  await page.waitForNetworkIdle({ idleTime: 1000, timeout: 120000 }).catch(() => undefined);
  await page.close();
  const all = [...requests.values()];
  const optimised = all.filter((entry) => entry.url.includes("/_next/image"));
  const waits = optimised.map((entry) => entry.waitMs).sort((a, b) => a - b);
  return {
    images: all.length,
    distinctUrls: new Set(all.map((entry) => entry.url)).size,
    kb: Math.round(all.reduce((sum, entry) => sum + entry.bytes, 0) / 1024),
    optimised: optimised.length,
    hits: optimised.filter((entry) => entry.cache === "HIT").length,
    misses: optimised.filter((entry) => entry.cache === "MISS").length,
    medianWaitMs: waits.length ? Math.round(waits[Math.floor(waits.length / 2)]) : 0,
    maxWaitMs: waits.length ? Math.round(waits[waits.length - 1]) : 0,
    widths: [...new Set(optimised.map((entry) => new URL(entry.url).searchParams.get("w")))].sort((a, b) => a - b).join(","),
  };
}

const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || execFileSync("which", ["chromium"]).toString().trim(), args: ["--no-sandbox"] });
try {
  const rows = [];
  for (const path of paths) {
    for (const [name, viewport] of Object.entries(VIEWPORTS)) {
      rows.push({ page: path, viewport: name, ...await measure(browser, new URL(path, base).toString(), viewport) });
    }
  }
  console.table(rows);
} finally {
  await browser.close();
}
