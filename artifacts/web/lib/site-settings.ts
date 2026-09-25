import { getSiteSettings, type CatalogueProduct, type PublicSiteHeroImage, type PublicSiteHomepage, type PublicSiteSettings } from "./catalogue";
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
    aboutBody: "IH Seeds (Irwin Hunter & Co) has been Western Australian, family owned and operated since 1966. We supply true to type pasture seed from accredited growers, plus specialist mixes built for WA conditions. Our seed is available through rural stores across the state and backed by sound technical advice from our team.",
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
    heroEyebrow: "About IH Seeds",
    heroHeading: "Proudly Western Australian,",
    heroHeadingEmphasis: "since 1966",
    heroIntro: "Family owned and operated for 60 years, supplying proven pasture seed and specialist mixes to farms from Derby to Esperance.",
    heroImageSrc: "https://images.unsplash.com/photo-1530507629858-e4977d30e9e0?auto=format&fit=crop&w=900&q=80",
    heroImageAssetId: null,
    storyLead: "Every paddock in Western Australia is different. For 60 years, our job has been knowing which pasture seed will perform in yours.",
    storyParagraphs: [
      "IH Seeds (Irwin Hunter & Co) was established in 1966 and has been Western Australian, family owned and operated ever since. In 2026 we celebrate 60 years of supplying high-quality pasture seed across the state's agricultural and rangelands areas, from Derby in the north to Esperance in the south.",
      "Western Australia's conditions are unlike anywhere else. Rainfall swings between the coast and inland, the sowing window after the autumn break is tight, and soils run from acidic sands to heavy clays. We work with domestic and international seed companies to source temperate and sub-tropical species suited to those conditions, and partner with specialist seed growers under accredited domestic and international certification programs. That protects the varietal and genetic integrity of every line we sell, so the seed you sow is true to type, consistent in quality and reliable in performance.",
      "We range {productCount}, including our own specialist pasture and cover crop mixes, the Equi1st range for horse properties and Mix & Match custom mixes. Our customers include beef, sheep and dairy producers, hay growers, horse owners and small landholders, and many of them come to us after seeing how a pasture has performed on a neighbour's farm.",
      "You can buy our seed through an extensive network of rural retail stores throughout Western Australia, and our team is always available for technical advice. Tell us your location, rainfall, soil type and pH, and we will help you choose the variety or mix that suits your paddock. As a member of the Australian Seed Federation, we follow its Code of Practice.",
    ],
    valuesHeading: "What we",
    valuesHeadingEmphasis: "stand for",
    values: [
      { title: "Regional expertise", body: "Local conditions, understood and applied. Our experience across Western Australia tells us which varieties and mixes deliver in your rainfall, your soil and your enterprise." },
      { title: "Proven performance", body: "Pasture varieties and mixes proven over generations and across Australia. Seed from accredited growers, true to type and consistent with its description." },
      { title: "Partnership", body: "Confidence before the order, support after it. We combine local experience with knowledge shared by farmers to give sound technical advice, through your local store or direct from our team." },
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

export type HeroSlide = {
  kind: "image" | "video";
  src: string;
  posterSrc: string;
};

function toHeroSlide(image: PublicSiteHeroImage): HeroSlide | null {
  if (image.kind === "video") {
    const src = image.src?.trim() || "";
    if (!src) return null;
    return { kind: "video", src, posterSrc: image.posterSrc?.trim() || "" };
  }
  const src = publicMediaSrc(image);
  return src ? { kind: "image", src, posterSrc: src } : null;
}

export function resolveHomepageHeroSlides(homepage: PublicSiteHomepage): HeroSlide[] {
  const slides = (homepage.heroImages ?? [])
    .map(toHeroSlide)
    .filter((slide): slide is HeroSlide => Boolean(slide));
  if (slides.length) return slides;
  const fallback = toHeroSlide({ src: homepage.heroImageSrc, assetId: homepage.heroImageAssetId });
  return fallback ? [fallback] : [];
}

export async function loadSiteSettings() {
  try {
    return await getSiteSettings();
  } catch {
    return FALLBACK_SITE_SETTINGS;
  }
}
