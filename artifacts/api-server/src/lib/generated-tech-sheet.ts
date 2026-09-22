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

/** Rebuild the stored PDF after publish. A failed render does not fail the publish. */
export function scheduleGeneratedTechSheet(slug: string) {
  if (!SLUG.test(slug)) return;
  const base = (process.env.WEB_BASE ?? "http://127.0.0.1:3000").replace(/\/+$/, "");
  void fetch(`${base}/tech-sheets/${encodeURIComponent(slug)}`, {
    headers: { [TECH_SHEET_REFRESH_HEADER]: refreshToken() },
    signal: AbortSignal.timeout(90_000),
  }).then((response) => {
    if (!response.ok) logger.warn({ slug, status: response.status }, "Generated tech sheet was not stored");
  }).catch((error) => {
    logger.warn({ slug, err: error }, "Generated tech sheet could not be started");
  });
}
