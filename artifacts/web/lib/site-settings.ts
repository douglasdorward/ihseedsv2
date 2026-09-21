import { getSiteSettings, type CatalogueProduct, type PublicSiteHomepage, type PublicSiteSettings } from "./catalogue";
import { DEFAULT_COMPANY } from "./company";

export const BEST_SELLER_LIMIT = 4;

export const FALLBACK_SITE_SETTINGS: PublicSiteSettings = {
  homepage: {
    heroImageSrc: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=900&q=80",
    heroImageAssetId: null,
    heroImages: [{
      src: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=900&q=80",
      assetId: null,
    }],
    heroSlideshow: false,
    heroEyebrow: "Western Australia's",
    heroHeading: "Pasture Seed Specialists",
    heroBody: "Independently owned since 1966. We source, test and blend {productCount} for every region of the state — from Esperance to Derby.",
    aboutBody: "Irwin Hunter & Co has been Western Australian owned and operated since 1966. We supply true to type seed from credible growers, blended into mixes that suit the paddock they are going into. Our long history across the state means we know which varieties perform in every region.",
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
  about: {
    heroEyebrow: "About Us",
    heroHeading: "Western Australian owned,",
    heroHeadingEmphasis: "since 1966",
    heroIntro: "Three generations of the Hunter family, one paddock question at a time: what will actually grow here.",
    heroImageSrc: "https://images.unsplash.com/photo-1530507629858-e4977d30e9e0?auto=format&fit=crop&w=900&q=80",
    heroImageAssetId: null,
    storyLead: "It started with a question every farmer in the south-west was asking: which seed will actually perform on my ground, in my rainfall, under my grazing plan.",
    storyParagraphs: [
      "Irwin Hunter & Co was founded in 1966 by growers who were tired of buying seed blended for somewhere else. They started sourcing, testing and blending pasture seed for Western Australian conditions specifically — not the eastern states, not overseas trial data, but paddocks from Esperance to Derby.",
      "Sixty years on, the company is still independently owned and run by the same family. We have watched varieties come and go, rainfall patterns shift, and three generations of resellers build their businesses alongside ours. What has not changed is the question we start with: what will actually grow here.",
      "Today we supply through rural resellers across the state — from the wheatbelt to the Kimberley — with true to type seed across {productCount} from credible growers, and the technical advice to back it. We are an Australian Seed Federation member, and every mix we blend still gets tested against the same standard the founders set: would we sow it on our own place.",
    ],
    valuesHeading: "What we",
    valuesHeadingEmphasis: "stand for",
    values: [
      { title: "Regional expertise", body: "Local conditions, understood and applied. Sixty years of sowing across every WA rainfall zone." },
      { title: "Proven performance", body: "Varieties and mixes proven over generations across Australia, with trial data behind them." },
      { title: "Partnership", body: "Confidence before the order. Support after it — through your local rural reseller." },
    ],
  },
  company: DEFAULT_COMPANY,
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

export function resolveHomepageHeroImages(homepage: PublicSiteHomepage) {
  const images = (homepage.heroImages ?? [])
    .map((image) => publicMediaSrc(image))
    .filter(Boolean);
  if (images.length) return images;
  const fallback = publicMediaSrc({ src: homepage.heroImageSrc, assetId: homepage.heroImageAssetId });
  return fallback ? [fallback] : [];
}

export async function loadSiteSettings() {
  try {
    return await getSiteSettings();
  } catch {
    return FALLBACK_SITE_SETTINGS;
  }
}
