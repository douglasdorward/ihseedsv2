import { existsSync } from "node:fs";
import puppeteer, { type Browser } from "puppeteer-core";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Keep in step with artifacts/api-server/src/lib/generated-tech-sheet.ts */
export const TECH_SHEET_REFRESH_HEADER = "x-tech-sheet-refresh";

function refreshToken() {
  return process.env.TECH_SHEET_REFRESH_TOKEN?.trim() || "local-tech-sheet-refresh";
}

export function isTechSheetRefresh(header: string | null) {
  return header === refreshToken();
}

function apiBase() {
  const base = process.env.API_BASE?.replace(/\/+$/, "");
  if (!base) throw new Error("API_BASE environment variable is required.");
  return base;
}

function chromeExecutable() {
  const configured = process.env.CHROMIUM_PATH?.trim();
  if (configured) return configured;
  if (process.platform === "darwin") {
    const mac = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
    if (existsSync(mac)) return mac;
  }
  return "chromium";
}

let browserPromise: Promise<Browser> | null = null;
let printChain: Promise<unknown> = Promise.resolve();

function browser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      executablePath: chromeExecutable(),
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    }).catch((error: unknown) => {
      browserPromise = null;
      throw error;
    });
  }
  return browserPromise;
}

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = printChain.then(task, task);
  printChain = run.then(() => undefined, () => undefined);
  return run;
}

async function renderTechSheetPdf(slug: string) {
  return enqueue(async () => {
    const port = process.env.PORT || "3000";
    const chrome = await browser();
    const page = await chrome.newPage();
    try {
      await page.goto(`http://127.0.0.1:${port}/internal/pdf/tech-sheet/${encodeURIComponent(slug)}`, {
        waitUntil: "networkidle0",
        timeout: 45_000,
      });
      await page.waitForSelector("[data-pdf-ready='true']", { timeout: 20_000 });
      await page.emulateMediaType("print");
      const pdf = await page.pdf({
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: "0", right: "0", bottom: "0", left: "0" },
      });
      return Buffer.from(pdf);
    } finally {
      await page.close();
    }
  });
}

export function techSheetDownloadName(name: string) {
  const safe = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${safe || "tech-sheet"}-tech-sheet.pdf`;
}

async function readStored(slug: string) {
  const response = await fetch(`${apiBase()}/api/generated-tech-sheets/${encodeURIComponent(slug)}`, { cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Stored tech sheet lookup failed (${response.status}).`);
  return Buffer.from(await response.arrayBuffer());
}

async function writeStored(slug: string, bytes: Buffer) {
  const response = await fetch(`${apiBase()}/api/generated-tech-sheets/${encodeURIComponent(slug)}`, {
    method: "PUT",
    headers: { "content-type": "application/pdf" },
    body: new Uint8Array(bytes),
  });
  if (!response.ok) throw new Error(`Stored tech sheet write failed (${response.status}).`);
}

const pending = new Map<string, Promise<Buffer>>();

export async function techSheetPdf(slug: string, refresh: boolean) {
  if (!SLUG.test(slug)) return null;
  if (!refresh) {
    const stored = await readStored(slug);
    if (stored) return stored;
  }
  let job = pending.get(slug);
  if (!job) {
    job = (async () => {
      if (!refresh) {
        const again = await readStored(slug);
        if (again) return again;
      }
      const bytes = await renderTechSheetPdf(slug);
      await writeStored(slug, bytes);
      return bytes;
    })().finally(() => {
      pending.delete(slug);
    });
    pending.set(slug, job);
  }
  return job;
}
