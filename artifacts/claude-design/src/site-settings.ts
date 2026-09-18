export const BEST_SELLER_LIMIT = 4;
export const ROOT_FAQ_LIMIT = 10;
export const PRODUCT_COUNT_TOKEN = "{productCount}";

const DEFAULT_HERO_IMAGE =
  "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=900&q=80";
const DEFAULT_GUIDE_IMAGE =
  "https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=900&q=80";

export function expandProductCount(body: string, productCount: number) {
  const replacement = productCount > 0 ? `${productCount}+ varieties and mixes` : "improved pasture seed";
  return body.replaceAll(PRODUCT_COUNT_TOKEN, replacement);
}

export function heroDisplaySrc(image: { src?: string; assetId?: string | null }, forAdmin = false) {
  const assetId = image.assetId?.trim();
  if (assetId) return forAdmin ? `/api/admin/media/${assetId}/preview` : `/api/media/${assetId}`;
  return image.src?.trim() || DEFAULT_HERO_IMAGE;
}

export function guideCardDisplaySrc(image: { src?: string; assetId?: string | null }, forAdmin = false) {
  const assetId = image.assetId?.trim();
  if (assetId) return forAdmin ? `/api/admin/media/${assetId}/preview` : `/api/media/${assetId}`;
  return image.src?.trim() || DEFAULT_GUIDE_IMAGE;
}

export function resolveBestSellers<T extends { slug: string }>(chosenSlugs: readonly string[] | undefined, products: T[]) {
  const bySlug = new Map<string, T>();
  for (const product of products) {
    if (product.slug && !bySlug.has(product.slug)) bySlug.set(product.slug, product);
  }
  const chosen: T[] = [];
  const used = new Set<string>();
  for (const raw of chosenSlugs ?? []) {
    const slug = raw.trim();
    const product = bySlug.get(slug);
    if (!product || used.has(product.slug)) continue;
    chosen.push(product);
    used.add(product.slug);
    if (chosen.length >= BEST_SELLER_LIMIT) return chosen;
  }
  for (const product of products) {
    if (used.has(product.slug)) continue;
    chosen.push(product);
    used.add(product.slug);
    if (chosen.length >= BEST_SELLER_LIMIT) break;
  }
  return chosen;
}
