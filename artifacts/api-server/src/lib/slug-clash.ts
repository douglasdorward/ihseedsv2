import { and, eq, isNotNull } from "drizzle-orm";
import { catalogueCategoriesTable, db, productsTable } from "@workspace/db";

/**
 * Sub-category pages and product pages share the /products/{root}/{slug}
 * address space, so a sub-category slug and a product slug must never match.
 * Product slugs are unique across the catalogue, so the check is catalogue-wide.
 */

export const PRODUCT_SLUG_CLASH_MESSAGE =
  "That slug is already used by a sub-category page. Choose a different product slug.";

export function subcategorySlugClashMessage(slug: string) {
  return `A product already uses the slug "${slug}". Sub-category pages share the same address space as products, so choose a different name.`;
}

export async function subcategoryUsesSlug(slug: string) {
  if (!slug) return false;
  const [match] = await db.select({ id: catalogueCategoriesTable.id }).from(catalogueCategoriesTable)
    .where(and(isNotNull(catalogueCategoriesTable.parentId), eq(catalogueCategoriesTable.slug, slug)))
    .limit(1);
  return Boolean(match);
}

export async function productUsesSlug(slug: string) {
  if (!slug) return false;
  const [match] = await db.select({ id: productsTable.id }).from(productsTable)
    .where(eq(productsTable.slug, slug))
    .limit(1);
  return Boolean(match);
}
