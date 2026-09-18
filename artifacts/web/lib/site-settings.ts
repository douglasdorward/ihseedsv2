import { getSiteSettings, type CatalogueProduct, type PublicSiteSettings } from "./catalogue";

export const BEST_SELLER_LIMIT = 4;

export const FALLBACK_SITE_SETTINGS: PublicSiteSettings = {
  homepage: {
    heroImageSrc: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=900&q=80",
    heroImageAssetId: null,
    heroEyebrow: "Western Australia's",
    heroHeading: "Pasture Seed Specialists",
    heroBody: "Independently owned since 1966. We source, test and blend {productCount} for every region of the state — from Esperance to Derby.",
    bestSellerSlugs: [],
  },
  seedGuide: {
    navTitle: "Seed Guide 2026",
    cardHeading: "Regional advice, sowing rates and seasonal planning in one place.",
    cardButtonLabel: "Download the 2026 Pasture Seed Guide (PDF)",
    cardImageSrc: "https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=900&q=80",
    cardImageAssetId: null,
    pdfFilename: "",
    pdfPublicUrl: "/IH-Seeds-2026-Pasture-Seed-Guide.pdf",
    pageTitle: "2026 Pasture Seed Guide",
    pageIntro: "The definitive resource for Western Australian pasture planning. Sowing rates, rainfall zones and species notes for every mix and variety we stock, in one download.",
    pageButtonLabel: "Download PDF Guide",
  },
  updatedAt: "",
};

export function expandProductCount(body: string, productCount: number) {
  const replacement = productCount > 0 ? `${productCount}+ varieties and mixes` : "improved pasture seed";
  return body.replaceAll("{productCount}", replacement);
}

export function resolveBestSellers(chosenSlugs: readonly string[] | undefined, products: CatalogueProduct[]) {
  const bySlug = new Map<string, CatalogueProduct>();
  for (const product of products) {
    if (product.slug && !bySlug.has(product.slug)) bySlug.set(product.slug, product);
  }
  const chosen: CatalogueProduct[] = [];
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

export function publicMediaSrc(image: { src?: string; assetId?: string | null }) {
  const assetId = image.assetId?.trim();
  if (assetId) return `/api/media/${assetId}`;
  return image.src?.trim() || "";
}

export async function loadSiteSettings() {
  try {
    return await getSiteSettings();
  } catch {
    return FALLBACK_SITE_SETTINGS;
  }
}
