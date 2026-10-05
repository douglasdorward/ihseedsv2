import { asc, sql } from "drizzle-orm";
import {
  articlesTable,
  db,
  productsTable,
  redirectsTable,
} from "@workspace/db";
import { legacyWebsitePaths } from "./product-legacy-urls";
import { legacyWebsitePath } from "./product-path";
import { productPathSets } from "./public-redirect";
import {
  planRedirectImport,
  redirectImportReport,
  tokenFor,
  type RedirectImportContext,
  type RedirectImportReport,
} from "./redirect-import-plan";

export { REDIRECT_IMPORT_TEMPLATE } from "./redirect-import-plan";

/** Product and article editors own the addresses in their Legacy website URL fields. */
export async function loadManagedRedirectSources() {
  const [products, articles] = await Promise.all([
    db.select({ websiteUrlLegacy: productsTable.websiteUrlLegacy }).from(productsTable),
    db.select({ websiteUrlLegacy: articlesTable.websiteUrlLegacy }).from(articlesTable),
  ]);
  const product = new Set(products.flatMap((item) => legacyWebsitePaths(item.websiteUrlLegacy)));
  const article = new Set(articles.flatMap((item) =>
    (item.websiteUrlLegacy ?? []).flatMap((url) => {
      const path = legacyWebsitePath(url);
      return path ? [path] : [];
    })));
  return { product, article };
}

async function loadContext(): Promise<RedirectImportContext> {
  const [stored, managed, { live }] = await Promise.all([
    db.select({ fromPath: redirectsTable.fromPath, toPath: redirectsTable.toPath }).from(redirectsTable),
    loadManagedRedirectSources(),
    productPathSets(),
  ]);
  return {
    existing: new Map(stored.map((item) => [item.fromPath, item.toPath])),
    managed: new Set([...managed.product, ...managed.article]),
    liveProductPaths: live,
  };
}

export async function dryRunRedirectImport(csvText: string): Promise<RedirectImportReport> {
  return redirectImportReport(csvText, planRedirectImport(csvText, await loadContext()));
}

export async function commitRedirectImport(csvText: string, token: string) {
  if (token !== tokenFor(csvText)) throw new Error("IMPORT_TOKEN_MISMATCH");
  const plan = planRedirectImport(csvText, await loadContext());
  if (plan.issues.length) {
    throw new Error(plan.issues.slice(0, 5).map((issue) => `Row ${issue.row}: ${issue.problem}`).join(" "));
  }
  await db.transaction(async (tx) => {
    for (let start = 0; start < plan.planned.length; start += 500) {
      const batch = plan.planned.slice(start, start + 500);
      await tx.insert(redirectsTable)
        .values(batch.map((item) => ({ fromPath: item.fromPath, toPath: item.toPath, source: "uploaded" })))
        .onConflictDoUpdate({
          target: redirectsTable.fromPath,
          set: { toPath: sql`excluded.to_path`, source: "uploaded", updatedAt: new Date() },
        });
    }
  });
  return redirectImportReport(csvText, plan);
}

export async function listRedirects() {
  const [rows, managed] = await Promise.all([
    db.select().from(redirectsTable).orderBy(asc(redirectsTable.fromPath)),
    loadManagedRedirectSources(),
  ]);
  return rows.map((row) => ({
    id: row.id,
    fromPath: row.fromPath,
    toPath: row.toPath,
    source: (managed.product.has(row.fromPath)
      ? "product"
      : managed.article.has(row.fromPath)
        ? "article"
        : row.source === "uploaded" ? "uploaded" : "catalogue") as "uploaded" | "catalogue" | "product" | "article",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export function redirectImportCsvFromBody(body: unknown) {
  if (!body || typeof body !== "object") return "";
  const csvText = "csvText" in body ? body.csvText : null;
  return typeof csvText === "string" ? csvText : "";
}
