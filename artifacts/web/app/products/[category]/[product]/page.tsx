import type { Metadata } from "next";
import { getCategories } from "../../../../lib/catalogue";
import { findSubcategory } from "../../../../lib/catalogue-paths";
import { CategoryPage, categoryMetadata } from "../../category-page";
import { NestedProductPage, productMetadata } from "../../product-page";

type Props = { params: Promise<{ category: string; product: string }> };

/**
 * /products/{category}/{slug} is either a sub-category page or a product page.
 * Sub-categories are matched first (it is an in-memory lookup); the admin API
 * rejects any sub-category slug that equals a product slug, so they cannot clash.
 */
async function subcategoryParams({ category, product }: { category: string; product: string }) {
  const match = findSubcategory(await getCategories(), category, product);
  return match ? { category, sub: product } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resolved = await params;
  const sub = await subcategoryParams(resolved);
  return sub ? categoryMetadata(sub) : productMetadata(resolved);
}

export default async function ProductRoute({ params }: Props) {
  const resolved = await params;
  const sub = await subcategoryParams(resolved);
  return sub ? <CategoryPage params={sub} /> : <NestedProductPage params={resolved} />;
}
