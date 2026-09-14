import type { CatalogueCategory, CatalogueProduct } from "./catalogue";

export const CATALOGUE_INDEX_PATH = "/products";

export function rootCategoryForProduct(
  product: Pick<CatalogueProduct, "category">,
  categories: CatalogueCategory[],
) {
  return categories.find((category) => category.parentId === null && category.name === product.category) ?? null;
}

export function categoryPublicPath(category: Pick<CatalogueCategory, "slug">) {
  return `/products/${category.slug}`;
}

export type NavCategory = Pick<CatalogueCategory, "name" | "slug">;

const FEATURED_NAV_LIMIT = 6;
const PINNED_NAV_SLUG = "mixes";

export function featuredNavCategories(categories: CatalogueCategory[]): NavCategory[] {
  const roots = categories.filter((category) => category.parentId === null && category.active);
  const pinned = roots.find((category) => category.slug === PINNED_NAV_SLUG);
  const rest = roots
    .filter((category) => category.slug !== PINNED_NAV_SLUG)
    .sort((a, b) => {
      const countDiff = (b.productCount ?? 0) - (a.productCount ?? 0);
      if (countDiff !== 0) return countDiff;
      const orderDiff = a.sortOrder - b.sortOrder;
      if (orderDiff !== 0) return orderDiff;
      return a.name.localeCompare(b.name);
    });
  return (pinned ? [pinned, ...rest] : rest)
    .slice(0, FEATURED_NAV_LIMIT)
    .map(({ name, slug }) => ({ name, slug }));
}

export function productPublicPath(
  product: Pick<CatalogueProduct, "slug" | "category">,
  categories: CatalogueCategory[],
) {
  const root = rootCategoryForProduct(product, categories);
  const categorySlug = root?.slug ?? (
    product.category.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "catalogue"
  );
  return `/products/${categorySlug}/${product.slug}`;
}
