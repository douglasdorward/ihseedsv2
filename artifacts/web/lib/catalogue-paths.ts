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
const FEATURED_NAV_ORDER = [
  /mixes/,
  /ryegrass/,
  /clover/,
  /serradella/,
  /forage/,
  /sub[- ]?tropical/,
];

function featuredNavRank(category: Pick<CatalogueCategory, "slug" | "name">) {
  const key = `${category.slug} ${category.name}`.toLowerCase();
  const index = FEATURED_NAV_ORDER.findIndex((pattern) => pattern.test(key));
  return index === -1 ? FEATURED_NAV_ORDER.length : index;
}

function compareNavCategories(a: CatalogueCategory, b: CatalogueCategory) {
  const rankDiff = featuredNavRank(a) - featuredNavRank(b);
  if (rankDiff !== 0) return rankDiff;
  const orderDiff = a.sortOrder - b.sortOrder;
  if (orderDiff !== 0) return orderDiff;
  return a.name.localeCompare(b.name);
}

export function allNavCategories(categories: CatalogueCategory[]): NavCategory[] {
  return categories
    .filter((category) => category.parentId === null && category.active && (category.productCount ?? 0) > 0)
    .sort(compareNavCategories)
    .map(({ name, slug }) => ({ name, slug }));
}

export function featuredNavCategories(categories: CatalogueCategory[]): NavCategory[] {
  return categories
    .filter((category) => category.parentId === null && category.active)
    .sort(compareNavCategories)
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
