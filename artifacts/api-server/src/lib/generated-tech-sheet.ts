import { eq } from "drizzle-orm";
import { db, isActiveListing, productsTable } from "@workspace/db";
import { getStoredFile } from "./app-storage";
import { logger } from "./logger";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Keep in step with artifacts/web/lib/tech-sheet-pdf.ts */
export const TECH_SHEET_REFRESH_HEADER = "x-tech-sheet-refresh";

export function generatedTechSheetKey(slug: string) {
  return `generated-tech-sheets/${slug}.pdf`;
}

function refreshToken() {
  return process.env.TECH_SHEET_REFRESH_TOKEN?.trim() || "local-tech-sheet-refresh";
}

const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

/** The web server on this machine may store a sheet. A configured token allows the same write when the two processes are not loopback peers. */
export function canStoreGeneratedTechSheet(remoteAddress: string | undefined, header: string | undefined) {
  if (LOOPBACK.has(remoteAddress ?? "")) return true;
  const configured = process.env.TECH_SHEET_REFRESH_TOKEN?.trim();
  return Boolean(configured) && header === configured;
}

/** Rebuild the stored PDF after publish. A failed render does not fail the publish. */
export async function scheduleGeneratedTechSheet(slug: string) {
  if (!SLUG.test(slug)) return false;
  const base = (process.env.WEB_BASE ?? "http://127.0.0.1:3000").replace(/\/+$/, "");
  try {
    const response = await fetch(`${base}/tech-sheets/${encodeURIComponent(slug)}`, {
      headers: { [TECH_SHEET_REFRESH_HEADER]: refreshToken() },
      signal: AbortSignal.timeout(90_000),
    });
    await response.body?.cancel();
    if (!response.ok) {
      logger.warn({ slug, status: response.status }, "Generated tech sheet was not stored");
      return false;
    }
    return true;
  } catch (error) {
    logger.warn({ slug, err: error }, "Generated tech sheet could not be started");
    return false;
  }
}

/** Stored sheets are created on publish. Fill in products that were already published. */
export async function backfillGeneratedTechSheets() {
  const products = await db.select().from(productsTable).where(eq(productsTable.publishStatus, "Published"));
  const missing: string[] = [];
  for (const product of products) {
    if (!isActiveListing(product) || !SLUG.test(product.slug)) continue;
    const stored = await getStoredFile(generatedTechSheetKey(product.slug));
    if (stored) continue;
    missing.push(product.slug);
  }
  if (missing.length === 0) {
    logger.info("Published products already have tech sheets");
    return { queued: 0, stored: 0, failed: 0 };
  }
  logger.info({ count: missing.length }, "Generating tech sheets for published products");
  let stored = 0;
  let failed = 0;
  for (const slug of missing) {
    if (await scheduleGeneratedTechSheet(slug)) stored += 1;
    else failed += 1;
  }
  logger.info({ stored, failed }, "Finished generating tech sheets for published products");
  return { queued: missing.length, stored, failed };
}
