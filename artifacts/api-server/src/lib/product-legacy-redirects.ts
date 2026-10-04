import { and, eq, inArray } from "drizzle-orm";
import {
  catalogueCategoriesTable,
  db,
  productsTable,
  redirectsTable,
} from "@workspace/db";
import { describeProductLegacyUrls, legacyWebsitePaths } from "./product-legacy-urls";
import { legacyRedirectConflict, productPublicPath } from "./product-path";

type RedirectDb = Pick<typeof db, "delete" | "insert" | "select">;

type LegacyProductRef = { slug: string; category: string; websiteUrlLegacy: string };

export class ProductLegacyUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductLegacyUrlError";
  }
}

/**
 * Makes `ih_redirects` match the product's legacy address list when it is
 * published. Addresses dropped since the previous version stop redirecting
 * (only when they still point at this product); every current address is
 * pointed at the product's public path. Throws ProductLegacyUrlError when an
 * address is invalid or already belongs to an article or another product.
 */
export async function syncProductLegacyRedirects(
  executor: RedirectDb,
  previous: LegacyProductRef | null,
  next: LegacyProductRef & { id: number },
) {
  const categories = await executor.select({
    parentId: catalogueCategoriesTable.parentId,
    slug: catalogueCategoriesTable.slug,
    name: catalogueCategoriesTable.name,
  }).from(catalogueCategoriesTable);
  const toPath = productPublicPath(next.slug, next.category, categories);
  const described = describeProductLegacyUrls(next.websiteUrlLegacy, toPath);
  if (described.problem) throw new ProductLegacyUrlError(described.problem);

  const nextPaths = new Set(described.paths);
  const previousTo = previous ? productPublicPath(previous.slug, previous.category, categories) : null;
  const previousPaths = previous ? legacyWebsitePaths(previous.websiteUrlLegacy) : [];

  const products = await executor.select({
    id: productsTable.id,
    slug: productsTable.slug,
    category: productsTable.category,
    publishStatus: productsTable.publishStatus,
    websiteUrlLegacy: productsTable.websiteUrlLegacy,
  }).from(productsTable);
  const liveProductPaths = new Set(products
    .filter((product) => product.publishStatus === "Published")
    .map((product) => productPublicPath(product.slug, product.category, categories)));

  if (nextPaths.size) {
    const claimedByOthers = new Set(products
      .filter((product) => product.id !== next.id)
      .flatMap((product) => legacyWebsitePaths(product.websiteUrlLegacy)));
    const existing = await executor.select({
      fromPath: redirectsTable.fromPath,
      toPath: redirectsTable.toPath,
    }).from(redirectsTable).where(inArray(redirectsTable.fromPath, [...nextPaths]));
    const existingByPath = new Map(existing.map((redirect) => [redirect.fromPath, redirect.toPath]));
    for (const fromPath of nextPaths) {
      if (claimedByOthers.has(fromPath)) {
        throw new ProductLegacyUrlError(`Legacy website path "${fromPath}" is already used by another product`);
      }
      const conflict = legacyRedirectConflict(existingByPath.get(fromPath), toPath, liveProductPaths);
      if (conflict === "article") {
        throw new ProductLegacyUrlError(`Legacy website path "${fromPath}" is already used by a blog article`);
      }
      if (conflict === "other-product") {
        throw new ProductLegacyUrlError(`Legacy website path "${fromPath}" already points at another product`);
      }
    }
  }

  const removed = previousPaths.filter((path) => !nextPaths.has(path));
  if (removed.length && previousTo) {
    await executor.delete(redirectsTable).where(and(
      inArray(redirectsTable.fromPath, removed),
      eq(redirectsTable.toPath, previousTo),
    ));
  }

  for (const fromPath of nextPaths) {
    await executor.insert(redirectsTable).values({ fromPath, toPath }).onConflictDoUpdate({
      target: redirectsTable.fromPath,
      set: { toPath, updatedAt: new Date() },
    });
  }
}
