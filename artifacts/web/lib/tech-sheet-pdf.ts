import puppeteer, { type Browser } from "puppeteer-core";
import { chromeExecutableCandidates } from "./chrome-executable";

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

const launchArgs = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
  "--no-first-run",
];

let browserPromise: Promise<Browser> | null = null;
let printChain: Promise<unknown> = Promise.resolve();

async function launchBrowser() {
  const candidates = chromeExecutableCandidates();
  if (candidates.length === 0) {
    throw new Error("No Chromium binary is available to render tech sheets.");
  }
  let lastError: unknown;
  for (const executablePath of candidates) {
    try {
      const args = process.platform === "linux" ? [...launchArgs, "--no-zygote"] : launchArgs;
      return await withTimeout(puppeteer.launch({
        executablePath,
        headless: true,
        args,
      }), 20_000, "Tech sheet browser launch");
    } catch (error) {
      lastError = error;
      console.error(`Tech sheet browser failed to launch: ${executablePath}`, error);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Tech sheet browser failed to launch.");
}

function browser() {
  if (!browserPromise) {
    browserPromise = launchBrowser().catch((error: unknown) => {
      browserPromise = null;
      throw error;
    });
  }
  return browserPromise;
}

function withTimeout<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms.`)), ms);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
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
        waitUntil: "domcontentloaded",
        timeout: 45_000,
      });
      await page.waitForSelector("[data-pdf-ready='true']", { timeout: 20_000 });
      await page.emulateMediaType("print");
      const pdf = await withTimeout(page.pdf({
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: "0", right: "0", bottom: "0", left: "0" },
      }), 30_000, "Tech sheet print");
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
    headers: {
      "content-type": "application/pdf",
      [TECH_SHEET_REFRESH_HEADER]: refreshToken(),
    },
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
      try {
        await writeStored(slug, bytes);
      } catch (error) {
        console.error(`Tech sheet for ${slug} was rendered but not stored`, error);
      }
      return bytes;
    })().finally(() => {
      pending.delete(slug);
    });
    pending.set(slug, job);
  }
  return job;
}
