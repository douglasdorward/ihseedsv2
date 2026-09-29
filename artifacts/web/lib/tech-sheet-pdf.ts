import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Browser } from "puppeteer-core";
import { getCategories, getProductBySlug, type CatalogueProduct } from "./catalogue";
import { productPublicPath } from "./catalogue-paths";
import { launchTechSheetBrowser } from "./chrome-executable";
import { absoluteSiteUrl } from "./site-url";
import { techSheetVersion } from "./tech-sheet-version";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Keep in step with artifacts/api-server/src/lib/generated-tech-sheet.ts */
export const TECH_SHEET_REFRESH_HEADER = "x-tech-sheet-refresh";

/**
 * Shared by the website and the API. The website's /api rewrite reaches the API
 * over loopback, so a loopback address alone is not proof a request is internal.
 */
function refreshToken() {
  const configured = process.env.TECH_SHEET_REFRESH_TOKEN?.trim();
  if (configured) return configured;
  const secret = process.env.SESSION_SECRET?.trim();
  return secret ? createHmac("sha256", secret).update("tech-sheet-store").digest("hex") : null;
}

export function isTechSheetRefresh(header: string | null) {
  const token = refreshToken();
  return Boolean(token) && header === token;
}

function apiBase() {
  const base = process.env.API_BASE?.replace(/\/+$/, "");
  if (!base) throw new Error("API_BASE environment variable is required.");
  return base;
}

let buildId: string | null = null;

/** Each publish has a new Next build id, so stored sheets drawn with an older design are replaced. */
function currentBuild() {
  if (buildId === null) {
    try {
      buildId = readFileSync(path.join(process.cwd(), ".next", "BUILD_ID"), "utf8").trim() || "development";
    } catch {
      buildId = "development";
    }
  }
  return buildId;
}

export type TechSheetTarget = { product: CatalogueProduct; version: string };

/** The product as the sheet page will draw it, and the fingerprint that names its stored PDF. */
export async function currentTechSheet(slug: string): Promise<TechSheetTarget | null> {
  if (!SLUG.test(slug)) return null;
  const [product, categories] = await Promise.all([getProductBySlug(slug), getCategories()]);
  if (!product) return null;
  const version = techSheetVersion({
    product,
    productUrl: absoluteSiteUrl(productPublicPath(product, categories)),
    year: new Date().getFullYear(),
    build: currentBuild(),
  });
  return { product, version };
}

let browserPromise: Promise<Browser> | null = null;
let printChain: Promise<unknown> = Promise.resolve();

function browser() {
  if (!browserPromise) {
    browserPromise = launchTechSheetBrowser()
      .then(({ browser: launched, executablePath, failures }) => {
        for (const failure of failures) {
          console.error(`Tech sheet browser failed to launch: ${failure.executablePath} (${failure.error})`);
        }
        console.log(`Tech sheet browser started: ${executablePath}`);
        launched.on("disconnected", () => {
          browserPromise = null;
        });
        return launched;
      })
      .catch((error: unknown) => {
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

function storedUrl(slug: string, version: string) {
  return `${apiBase()}/api/generated-tech-sheets/${encodeURIComponent(slug)}/${version}`;
}

async function storedExists(slug: string, version: string) {
  const response = await fetch(storedUrl(slug, version), { method: "HEAD", cache: "no-store" });
  if (response.status === 404) return false;
  if (!response.ok) throw new Error(`Stored tech sheet lookup failed (${response.status}).`);
  return true;
}

async function readStored(slug: string, version: string) {
  const response = await fetch(storedUrl(slug, version), { cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Stored tech sheet lookup failed (${response.status}).`);
  return Buffer.from(await response.arrayBuffer());
}

async function writeStored(slug: string, version: string, bytes: Buffer) {
  const token = refreshToken();
  if (!token) throw new Error("SESSION_SECRET or TECH_SHEET_REFRESH_TOKEN is required to store tech sheets.");
  const response = await fetch(storedUrl(slug, version), {
    method: "PUT",
    headers: {
      "content-type": "application/pdf",
      [TECH_SHEET_REFRESH_HEADER]: token,
    },
    body: new Uint8Array(bytes),
  });
  if (!response.ok) throw new Error(`Stored tech sheet write failed (${response.status}).`);
}

type DrawResult = { bytes: Buffer; stored: boolean; changed: boolean };

const pending = new Map<string, Promise<DrawResult>>();

/**
 * Draw the sheet and store it under its fingerprint. If the product changed
 * while drawing, the PDF may not match the fingerprint, so it is neither
 * stored nor served; the caller draws the new content instead.
 */
function drawAndStore(slug: string, version: string) {
  const key = `${slug}/${version}`;
  let job = pending.get(key);
  if (!job) {
    job = (async () => {
      const bytes = await renderTechSheetPdf(slug);
      const after = await currentTechSheet(slug);
      if (after?.version !== version) {
        console.warn(`Tech sheet for ${slug} changed while it was drawn; drawing it again.`);
        return { bytes, stored: false, changed: true };
      }
      try {
        await writeStored(slug, version, bytes);
        return { bytes, stored: true, changed: false };
      } catch (error) {
        console.error(`Tech sheet for ${slug} was drawn but not stored`, error);
        return { bytes, stored: false, changed: false };
      }
    })().finally(() => {
      pending.delete(key);
    });
    pending.set(key, job);
  }
  return job;
}

async function drawCurrent(slug: string, first: TechSheetTarget) {
  let target: TechSheetTarget | null = first;
  for (let attempt = 0; attempt < 2 && target; attempt += 1) {
    const result = await drawAndStore(slug, target.version);
    if (!result.changed) return { target, result };
    target = await currentTechSheet(slug);
  }
  if (!target) return null;
  throw new Error(`Tech sheet for ${slug} kept changing while it was drawn.`);
}

/**
 * The PDF for the current product content: from App Storage when stored,
 * otherwise drawn now. Returns the fingerprint the bytes actually match, or
 * null if the product left the catalogue meanwhile.
 */
export async function techSheetPdf(slug: string, sheet: TechSheetTarget) {
  try {
    const stored = await readStored(slug, sheet.version);
    if (stored) return { bytes: stored, sheet };
  } catch (error) {
    console.error(`Stored tech sheet for ${slug} could not be read; drawing it instead`, error);
  }
  const drawn = await drawCurrent(slug, sheet);
  return drawn ? { bytes: drawn.result.bytes, sheet: drawn.target } : null;
}

/** Make sure the current sheet is in App Storage. Used to prepare sheets before anyone asks for them. */
export async function ensureTechSheetStored(slug: string, sheet: TechSheetTarget) {
  if (await storedExists(slug, sheet.version)) return "current" as const;
  const drawn = await drawCurrent(slug, sheet);
  if (!drawn) return "removed" as const;
  if (!drawn.result.stored) throw new Error(`Tech sheet for ${slug} was drawn but could not be stored.`);
  return "stored" as const;
}
