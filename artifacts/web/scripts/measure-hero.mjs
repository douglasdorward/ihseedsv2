#!/usr/bin/env node
// Measures how soon a page's hero photo appears.
//
//   node scripts/measure-hero.mjs <base> <path> [runs]
//
// Loads the page at a phone viewport (slow 4G, 4x CPU slowdown) and a desktop
// viewport (no throttling), with the browser cache off. For each run it reports
// when the hero image request started, when it finished, and the page's
// Largest Contentful Paint, all in ms from navigation start. Prints medians.
import puppeteer from "puppeteer-core";
import { execFileSync } from "node:child_process";

const VIEWPORTS = {
  phone: {
    viewport: { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
    network: { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 },
    cpu: 4,
  },
  desktop: { viewport: { width: 1440, height: 900, deviceScaleFactor: 1 }, network: null, cpu: 1 },
};

const [base, path, runsArg = "5"] = process.argv.slice(2);
if (!base || !path) {
  console.error("usage: measure-hero.mjs <base> <path> [runs]");
  process.exit(1);
}
const runs = Number(runsArg);
const HERO_SELECTOR = ".product-hero img.cover-image, .article-hero img.cover-image, main img.cover-image";

async function once(browser, url, { viewport, network, cpu }) {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  await page.setCacheEnabled(false);
  const client = await page.createCDPSession();
  await client.send("Network.enable");
  if (network) await client.send("Network.emulateNetworkConditions", network);
  if (cpu > 1) await client.send("Emulation.setCPUThrottlingRate", { rate: cpu });
  await page.evaluateOnNewDocument(() => {
    window.__lcp = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) window.__lcp = entry.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
  });
  await page.goto(url, { waitUntil: "load", timeout: 120000 });
  await new Promise((resolve) => setTimeout(resolve, 1500));
  const result = await page.evaluate((selector) => {
    const img = document.querySelector(selector);
    const src = img?.currentSrc ?? "";
    const entry = src ? performance.getEntriesByName(src)[0] : undefined;
    return {
      loading: img?.getAttribute("loading") ?? "(none)",
      preloaded: [...document.querySelectorAll('link[rel="preload"][as="image"]')].some((link) => (link.getAttribute("imagesrcset") ?? link.getAttribute("href") ?? "").includes("/_next/image")),
      width: Number(new URL(src || "http://x/", location.href).searchParams.get("w")) || 0,
      start: entry ? Math.round(entry.startTime) : null,
      end: entry ? Math.round(entry.responseEnd) : null,
      lcp: Math.round(window.__lcp),
    };
  }, HERO_SELECTOR);
  await page.close();
  return result;
}

const median = (values) => {
  const sorted = values.filter((value) => value != null).sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
};

const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || execFileSync("which", ["chromium"]).toString().trim(), args: ["--no-sandbox"] });
try {
  for (const [name, settings] of Object.entries(VIEWPORTS)) {
    const samples = [];
    for (let i = 0; i < runs; i += 1) samples.push(await once(browser, base + path, settings));
    const first = samples[0];
    console.log(JSON.stringify({
      path,
      viewport: name,
      loading: first.loading,
      preloaded: first.preloaded,
      width: first.width,
      heroRequestStartMs: median(samples.map((s) => s.start)),
      heroLoadedMs: median(samples.map((s) => s.end)),
      lcpMs: median(samples.map((s) => s.lcp)),
    }));
  }
} finally {
  await browser.close();
}
