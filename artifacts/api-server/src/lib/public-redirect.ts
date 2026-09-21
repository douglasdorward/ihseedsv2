import { eq } from "drizzle-orm";
import {
  catalogueCategoriesTable,
  db,
  isActiveListing,
  productsTable,
  redirectsTable,
} from "@workspace/db";
import { normalizePublicPath, productPublicPath } from "./product-path";

async function liveProductPublicPaths() {
  const [products, categories] = await Promise.all([
    db.select().from(productsTable).where(eq(productsTable.publishStatus, "Published")),
    db.select({
      parentId: catalogueCategoriesTable.parentId,
      slug: catalogueCategoriesTable.slug,
      name: catalogueCategoriesTable.name,
    }).from(catalogueCategoriesTable),
  ]);
  return new Set(
    products
      .filter((product) => isActiveListing(product))
      .map((product) => productPublicPath(product.slug, product.category, categories)),
  );
}

export async function publicRedirectTo(fromPath: string) {
  const path = normalizePublicPath(fromPath);
  if ((await liveProductPublicPaths()).has(path)) return null;
  const [redirect] = await db.select().from(redirectsTable)
    .where(eq(redirectsTable.fromPath, path));
  if (!redirect) return null;
  const destination = normalizePublicPath(redirect.toPath);
  return destination === path ? null : destination;
}
