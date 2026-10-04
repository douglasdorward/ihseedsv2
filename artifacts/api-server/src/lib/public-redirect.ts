import { eq } from "drizzle-orm";
import {
  catalogueCategoriesTable,
  db,
  isActiveListing,
  productsTable,
  redirectsTable,
} from "@workspace/db";
import { normalizePublicPath, productCategoryPath, productPublicPath } from "./product-path";

async function productPathSets() {
  const [products, categories] = await Promise.all([
    db.select().from(productsTable).where(eq(productsTable.publishStatus, "Published")),
    db.select({
      parentId: catalogueCategoriesTable.parentId,
      slug: catalogueCategoriesTable.slug,
      name: catalogueCategoriesTable.name,
      active: catalogueCategoriesTable.active,
    }).from(catalogueCategoriesTable),
  ]);
  const live = new Set<string>();
  // Published Legacy product page -> its category page.
  const retired = new Map<string, string>();
  for (const product of products) {
    const path = productPublicPath(product.slug, product.category, categories);
    if (isActiveListing(product)) live.add(path);
    else retired.set(path, productCategoryPath(product.category, categories));
  }
  return { live, retired };
}

export type PublicRedirect = { toPath: string; permanent: boolean };

/**
 * Resolve a public path to its redirect, if any. Redirects that land on a
 * Legacy product's category page are temporary (302) because a product can
 * return to Active or New; registered redirects are permanent (301).
 */
export async function publicRedirect(fromPath: string): Promise<PublicRedirect | null> {
  const path = normalizePublicPath(fromPath);
  const { live, retired } = await productPathSets();
  if (live.has(path)) return null;
  const [redirect] = await db.select().from(redirectsTable)
    .where(eq(redirectsTable.fromPath, path));
  // A registered redirect wins. Without one, a Legacy product page falls back
  // to its category page.
  const registered = redirect ? normalizePublicPath(redirect.toPath) : null;
  // An old-site URL registered to a product that has since gone Legacy goes
  // straight to the category rather than through the dead product page.
  const retiredTarget = registered ? retired.get(registered) : retired.get(path);
  if (retiredTarget) return retiredTarget === path ? null : { toPath: retiredTarget, permanent: false };
  return registered && registered !== path ? { toPath: registered, permanent: true } : null;
}