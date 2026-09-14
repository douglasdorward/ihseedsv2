export const CATALOGUE_INDEX_PATH = "/products";

type CategoryRef = { parentId: number | null; slug: string; name: string };

function fallbackCategorySlug(categoryName: string) {
  return categoryName.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "catalogue";
}

export function rootCategoryForName(categoryName: string, categories: CategoryRef[]) {
  return categories.find((category) => category.parentId === null && category.name === categoryName) ?? null;
}

export function productPublicPath(slug: string, categoryName: string, categories: CategoryRef[]) {
  const root = rootCategoryForName(categoryName, categories);
  return `/products/${root?.slug ?? fallbackCategorySlug(categoryName)}/${slug}`;
}

export function normalizePublicPath(path: string) {
  const [pathname] = path.split("#");
  return pathname.replace(/\/+$/, "") || "/";
}
