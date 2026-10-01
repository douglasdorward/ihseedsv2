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

/**
 * A legacy path may be claimed by the product being imported when nothing else
 * still owns it. Article redirects stay put. A redirect that still lands on
 * another live product stays put too. An old product page with no live owner
 * can be pointed at the imported product.
 */
export function legacyRedirectConflict(
  existingToPath: string | null | undefined,
  nextToPath: string,
  liveProductPaths: ReadonlySet<string>,
): "article" | "other-product" | null {
  if (!existingToPath) return null;
  if (existingToPath.startsWith("/articles/")) return "article";
  const existingPath = normalizePublicPath(existingToPath);
  if (existingPath !== nextToPath && liveProductPaths.has(existingPath)) return "other-product";
  return null;
}

export function legacyWebsitePath(value: unknown) {
  const raw = typeof value === "string" ? value.trim() : String(value ?? "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    if (!["http:", "https:"].includes(url.protocol) || hostname !== "irwinhunter.com.au" ||
      url.username || url.password || url.search || url.hash) return null;
    return normalizePublicPath(url.pathname);
  } catch {
    return null;
  }
}

export const REQUIRED_LEGACY_PRODUCT_ALIASES = [
  { fromPath: "/product/souwest-pasture-mix", slug: "souwest-pasture-mix" },
] as const;

export function requiredLegacyRedirects(
  products: { slug: string; category: string }[],
  categories: CategoryRef[],
) {
  return REQUIRED_LEGACY_PRODUCT_ALIASES.flatMap((alias) => {
    const product = products.find((item) => item.slug === alias.slug);
    if (!product) return [];
    const toPath = productPublicPath(product.slug, product.category, categories);
    return alias.fromPath === toPath ? [] : [{ fromPath: alias.fromPath, toPath }];
  });
}
