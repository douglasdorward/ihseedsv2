import { createHmac, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, isActiveListing, productsTable } from "@workspace/db";
import { listStoredFiles, removeStoredFile } from "./app-storage";
import { logger } from "./logger";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VERSION = /^[a-f0-9]{64}$/;

/** Keep in step with artifacts/web/lib/tech-sheet-pdf.ts */
export const TECH_SHEET_REFRESH_HEADER = "x-tech-sheet-refresh";

export function isTechSheetSlug(value: string) {
  return SLUG.test(value);
}

/** The web server names each stored sheet by a fingerprint of the content it was drawn from. */
export function isTechSheetVersion(value: string) {
  return VERSION.test(value);
}

/**
 * Development and the published site share one App Storage bucket, but their
 * catalogues differ. Separate folders stop each one deleting the other's sheets.
 */
function storageEnvironment(env: NodeJS.ProcessEnv = process.env) {
  return env.REPLIT_DEPLOYMENT ? "production" : "development";
}

export function generatedTechSheetPrefix(slug: string, env: NodeJS.ProcessEnv = process.env) {
  return `generated-tech-sheets/${storageEnvironment(env)}/${slug}/`;
}

export function generatedTechSheetKey(slug: string, version: string, env: NodeJS.ProcessEnv = process.env) {
  return `${generatedTechSheetPrefix(slug, env)}${version}.pdf`;
}

/** Sheets stored before versioned keys existed. They are never served. */
function unversionedTechSheetKey(slug: string) {
  return `generated-tech-sheets/${slug}.pdf`;
}

/**
 * Shared by the website and the API. The website's /api rewrite reaches the API
 * over loopback, so a loopback address alone is not proof a request is internal.
 */
export function techSheetStoreToken() {
  const configured = process.env.TECH_SHEET_REFRESH_TOKEN?.trim();
  if (configured) return configured;
  const secret = process.env.SESSION_SECRET?.trim();
  return secret ? createHmac("sha256", secret).update("tech-sheet-store").digest("hex") : null;
}

/** Only the website, which holds the shared token, may store a sheet. */
export function canStoreGeneratedTechSheet(header: string | undefined) {
  const token = techSheetStoreToken();
  if (!token || typeof header !== "string" || header.length !== token.length) return false;
  return timingSafeEqual(Buffer.from(header), Buffer.from(token));
}

/** Delete every stored sheet for a product except the one to keep. */
export async function removeGeneratedTechSheets(slug: string, keepVersion?: string) {
  if (!SLUG.test(slug)) return;
  const keep = keepVersion ? generatedTechSheetKey(slug, keepVersion) : null;
  const keys = await listStoredFiles(generatedTechSheetPrefix(slug));
  const stale = [...keys.filter((key) => key !== keep), unversionedTechSheetKey(slug)];
  await Promise.all(stale.map((key) => removeStoredFile(key)));
}

/** Where the API reaches the public website. Set per environment in the API artifact config. */
export function techSheetWebBase(env: NodeJS.ProcessEnv = process.env) {
  const base = env.WEB_BASE?.trim().replace(/\/+$/, "");
  return base || null;
}

let missingWebBaseLogged = false;

/**
 * Ask the website to make sure the current sheet is stored. This only speeds up
 * the first download; a sheet that is not ready is drawn when a customer asks.
 */
export async function prebuildGeneratedTechSheet(slug: string) {
  if (!SLUG.test(slug)) return false;
  const base = techSheetWebBase();
  const token = techSheetStoreToken();
  if (!base || !token) {
    if (!missingWebBaseLogged) {
      missingWebBaseLogged = true;
      logger.warn("WEB_BASE or SESSION_SECRET is not set, so tech sheets will be drawn on first download instead of in advance");
    }
    return false;
  }
  try {
    const response = await fetch(`${base}/tech-sheets/${encodeURIComponent(slug)}`, {
      headers: { [TECH_SHEET_REFRESH_HEADER]: token },
      signal: AbortSignal.timeout(120_000),
    });
    await response.body?.cancel();
    if (!response.ok) {
      logger.warn({ slug, status: response.status }, "Tech sheet was not prepared in advance");
      return false;
    }
    return true;
  } catch (error) {
    logger.warn({ slug, err: error }, "Tech sheet could not be prepared in advance");
    return false;
  }
}

const queued = new Set<string>();
let draining: Promise<void> | null = null;

async function drainQueue() {
  while (queued.size > 0) {
    const [slug] = queued;
    queued.delete(slug);
    await prebuildGeneratedTechSheet(slug);
  }
}

/** Prepare sheets in the background, one at a time. Never blocks or fails the caller. */
export function queueGeneratedTechSheets(slugs: Iterable<string>) {
  if (!techSheetWebBase()) return;
  for (const slug of slugs) if (SLUG.test(slug)) queued.add(slug);
  if (!draining && queued.size > 0) {
    draining = drainQueue().finally(() => {
      draining = null;
      if (queued.size > 0) queueGeneratedTechSheets([]);
    });
  }
}

async function publishedSlugs() {
  const products = await db.select().from(productsTable).where(eq(productsTable.publishStatus, "Published"));
  return products.filter((product) => isActiveListing(product) && SLUG.test(product.slug)).map((product) => product.slug);
}

/** For changes that can alter many sheets, such as a category rename or workbook import. */
export function queueAllPublishedTechSheets(reason: string) {
  if (!techSheetWebBase()) return;
  void publishedSlugs()
    .then((slugs) => {
      logger.info({ reason, count: slugs.length }, "Preparing updated tech sheets");
      queueGeneratedTechSheets(slugs);
    })
    .catch((err: unknown) => logger.warn({ err, reason }, "Could not list products for tech sheet updates"));
}

/** Remove a product's sheets when it leaves the public catalogue. */
export function discardGeneratedTechSheets(slug: string) {
  void removeGeneratedTechSheets(slug).catch((err: unknown) => {
    logger.warn({ err, slug }, "Old tech sheets could not be removed");
  });
}

async function waitForWebsite(base: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${base}/`, { method: "HEAD", signal: AbortSignal.timeout(10_000) });
      await response.body?.cancel();
      return true;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 3_000));
    }
  }
  return false;
}

/** Make sure every published product has a current stored sheet. The website skips sheets that are already current. */
export async function backfillGeneratedTechSheets({ waitMs = 180_000 } = {}) {
  const base = techSheetWebBase();
  if (!base) {
    logger.warn("WEB_BASE is not set, so tech sheets were not prepared at startup");
    return { checked: 0, ready: 0, failed: 0 };
  }
  if (!(await waitForWebsite(base, waitMs))) {
    logger.warn({ base }, "The website did not start in time, so tech sheets were not prepared at startup");
    return { checked: 0, ready: 0, failed: 0 };
  }
  const slugs = await publishedSlugs();
  logger.info({ count: slugs.length }, "Checking tech sheets for published products");
  let ready = 0;
  let failed = 0;
  for (const [index, slug] of slugs.entries()) {
    if (await prebuildGeneratedTechSheet(slug)) {
      ready += 1;
      continue;
    }
    failed += 1;
    // The website may be restarting; wait for it rather than failing every remaining sheet.
    if (!(await waitForWebsite(base, 60_000))) {
      failed += slugs.length - index - 1;
      logger.warn({ base }, "The website stopped responding, so the remaining tech sheets were not prepared");
      break;
    }
  }
  logger.info({ ready, failed }, "Finished checking tech sheets for published products");
  return { checked: slugs.length, ready, failed };
}
