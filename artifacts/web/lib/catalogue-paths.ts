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

export function subcategoryPublicPath(
  root: Pick<CatalogueCategory, "slug">,
  sub: Pick<CatalogueCategory, "slug">,
) {
  return `/products/${root.slug}/${sub.slug}`;
}

/** The active root category with this slug, or null. */
export function findRootCategory(categories: CatalogueCategory[], rootSlug: string) {
  return categories.find(
    (category) => category.parentId === null && category.active && category.slug === rootSlug,
  ) ?? null;
}

/** Active sub-categories of a root, in admin order. */
export function activeSubcategories(categories: CatalogueCategory[], rootId: number) {
  return categories
    .filter((category) => category.parentId === rootId && category.active)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

/**
 * Resolves /products/{rootSlug}/{subSlug} to a sub-category page target.
 * Sub-category slugs are only unique within their root, so both are required.
 */
export function findSubcategory(categories: CatalogueCategory[], rootSlug: string, subSlug: string) {
  const root = findRootCategory(categories, rootSlug);
  if (!root) return null;
  const sub = categories.find(
    (category) => category.parentId === root.id && category.active && category.slug === subSlug,
  );
  return sub ? { root, sub } : null;
}

/** The active sub-category a product is filed under, with its root. */
export function subcategoryForProduct(
  product: Pick<CatalogueProduct, "subcategoryId" | "category">,
  categories: CatalogueCategory[],
) {
  if (product.subcategoryId == null) return null;
  const sub = categories.find((category) => category.id === product.subcategoryId && category.active);
  if (!sub || sub.parentId === null) return null;
  const root = categories.find((category) => category.id === sub.parentId && category.active);
  return root ? { root, sub } : null;
}

/**
 * The single place that decides whether a sub-category page is offered to
 * search engines (sitemap, llms.txt, robots meta). An empty page is never
 * indexed; tighten this one function to add further guards.
 */
export function isSubcategoryIndexable(sub: Pick<CatalogueCategory, "active" | "productCount">) {
  return sub.active && (sub.productCount ?? 0) > 0;
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
