import { eq } from "drizzle-orm";
import { catalogueCategoriesTable, db, isActiveListing, productsTable, redirectsTable } from "@workspace/db";
import { CATALOGUE_INDEX_PATH, normalizePublicPath, productPublicPath } from "./product-path";

function productSlugFromPath(fromPath: string) {
  const match = /^\/product\/([^/]+)$/.exec(fromPath);
  return match?.[1] ?? null;
}

async function liveProductPath(slug: string) {
  const [product] = await db.select().from(productsTable).where(eq(productsTable.slug, slug));
  if (!product || product.publishStatus !== "Published" || !isActiveListing(product)) return null;
  const categories = await db.select({
    parentId: catalogueCategoriesTable.parentId,
    slug: catalogueCategoriesTable.slug,
    name: catalogueCategoriesTable.name,
  }).from(catalogueCategoriesTable);
  return productPublicPath(product.slug, product.category, categories);
}

export async function publicRedirectTo(fromPath: string) {
  const path = normalizePublicPath(fromPath);
  const slug = productSlugFromPath(path);
  if (slug) {
    const canonical = await liveProductPath(slug);
    if (canonical) return canonical;
  }
  const [redirect] = await db.select().from(redirectsTable)
    .where(eq(redirectsTable.fromPath, path));
  if (!redirect) return null;
  const destination = normalizePublicPath(redirect.toPath.replace(/#catalogue$/, "")) || CATALOGUE_INDEX_PATH;
  const destinationSlug = productSlugFromPath(destination);
  if (destinationSlug) {
    const canonical = await liveProductPath(destinationSlug);
    if (canonical) return canonical;
  }
  if (destination === "/products/categories") return CATALOGUE_INDEX_PATH;
  return destination === path ? null : destination;
}
