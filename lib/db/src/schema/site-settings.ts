import { integer, jsonb, pgTable, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const SITE_SETTINGS_ID = 1;
export const BEST_SELLER_LIMIT = 4;
export const HERO_IMAGE_LIMIT = 6;
export const ABOUT_VALUE_LIMIT = 3;
export const ABOUT_STORY_LIMIT = 4;
export const DEFAULT_SEED_GUIDE_PDF_URL = "/IH-Seeds-2026-Pasture-Seed-Guide.pdf";
export const SEED_GUIDE_PDF_PUBLIC_PATH = "/api/site/seed-guide.pdf";
export const SEED_GUIDE_PDF_STORAGE_KEY = "site/seed-guide.pdf";

export const DEFAULT_HOMEPAGE_HERO_IMAGE =
  "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=900&q=80";
export const DEFAULT_SEED_GUIDE_CARD_IMAGE =
  "https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=900&q=80";
export const DEFAULT_ABOUT_HERO_IMAGE =
  "https://images.unsplash.com/photo-1530507629858-e4977d30e9e0?auto=format&fit=crop&w=900&q=80";

export const HERO_VIDEO_MAX_SECONDS = 30;
export const HERO_VIDEO_PUBLIC_PREFIX = "/api/site/hero-videos/";

export type SiteHeroSlideKind = "image" | "video";

/**
 * A homepage hero slide. Photos carry only `src`/`assetId`; video slides add
 * `kind: "video"`, a poster frame and the clip length so the public hero can
 * play the clip through before advancing.
 */
export type SiteHeroImage = {
  src: string;
  assetId: string | null;
  kind?: SiteHeroSlideKind;
  posterSrc?: string;
  durationSeconds?: number;
};

export type SiteHomepageSettings = {
  heroImageSrc: string;
  heroImageAssetId: string | null;
  heroImages: SiteHeroImage[];
  heroSlideshow: boolean;
  heroEyebrow: string;
  heroHeading: string;
  heroBody: string;
  aboutBody: string;
  bestSellerSlugs: string[];
};

export type SiteSeedGuideSettings = {
  navTitle: string;
  cardHeading: string;
  cardButtonLabel: string;
  cardImageSrc: string;
  cardImageAssetId: string | null;
  pdfFilename: string;
  pdfStorageKey: string;
  pageTitle: string;
  pageIntro: string;
  pageButtonLabel: string;
};

export type SiteAboutValue = {
  title: string;
  body: string;
};

export type SiteAboutSettings = {
  heroEyebrow: string;
  heroHeading: string;
  heroHeadingEmphasis: string;
  heroIntro: string;
  heroImageSrc: string;
  heroImageAssetId: string | null;
  storyLead: string;
  storyParagraphs: string[];
  valuesHeading: string;
  valuesHeadingEmphasis: string;
  values: SiteAboutValue[];
};

export type SiteCompanySettings = {
  legalName: string;
  tradingName: string;
  phone: string;
  email: string;
  address: string;
  officeHours: string;
  abn: string;
};

const DEFAULT_HERO_IMAGE: SiteHeroImage = {
  src: DEFAULT_HOMEPAGE_HERO_IMAGE,
  assetId: null,
};

export const DEFAULT_HOMEPAGE_SETTINGS: SiteHomepageSettings = {
  heroImageSrc: DEFAULT_HOMEPAGE_HERO_IMAGE,
  heroImageAssetId: null,
  heroImages: [DEFAULT_HERO_IMAGE],
  heroSlideshow: false,
  heroEyebrow: "Western Australia's",
  heroHeading: "Pasture Seed Specialists",
  heroBody: "Independently owned since 1966. We source, test and blend {productCount} for every region of the state — from Esperance to Derby.",
  aboutBody: "IH Seeds (Irwin Hunter & Co) has been Western Australian, family owned and operated since 1966. We supply true to type pasture seed from accredited growers, plus specialist mixes built for WA conditions. Our seed is available through rural stores across the state and backed by sound technical advice from our team.",
  bestSellerSlugs: [],
};

export const DEFAULT_SEED_GUIDE_SETTINGS: SiteSeedGuideSettings = {
  navTitle: "Seed Guide 2026",
  cardHeading: "Regional advice, sowing rates and seasonal planning in one place.",
  cardButtonLabel: "Download the 2026 Pasture Seed Guide (PDF)",
  cardImageSrc: DEFAULT_SEED_GUIDE_CARD_IMAGE,
  cardImageAssetId: null,
  pdfFilename: "",
  pdfStorageKey: "",
  pageTitle: "2026 Pasture Seed Guide",
  pageIntro: "The definitive resource for Western Australian pasture planning. Sowing rates, rainfall zones and species notes for every mix and variety we stock, in one download.",
  pageButtonLabel: "Download PDF Guide",
};

export const DEFAULT_ABOUT_VALUES: SiteAboutValue[] = [
  { title: "Regional expertise", body: "Local conditions, understood and applied. Our experience across Western Australia tells us which varieties and mixes deliver in your rainfall, your soil and your enterprise." },
  { title: "Proven performance", body: "Pasture varieties and mixes proven over generations and across Australia. Seed from accredited growers, true to type and consistent with its description." },
  { title: "Partnership", body: "Confidence before the order, support after it. We combine local experience with knowledge shared by farmers to give sound technical advice, through your local store or direct from our team." },
];

export const DEFAULT_ABOUT_SETTINGS: SiteAboutSettings = {
  heroEyebrow: "About IH Seeds",
  heroHeading: "Proudly Western Australian,",
  heroHeadingEmphasis: "since 1966",
  heroIntro: "Family owned and operated for 60 years, supplying proven pasture seed and specialist mixes to farms from Derby to Esperance.",
  heroImageSrc: DEFAULT_ABOUT_HERO_IMAGE,
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
  values: DEFAULT_ABOUT_VALUES,
};

export const DEFAULT_COMPANY_SETTINGS: SiteCompanySettings = {
  legalName: "Irwin Hunter & Co",
  tradingName: "IH Seeds",
  phone: "",
  email: "info@irwinhunter.com.au",
  address: "Unit 5, 75 Robinson Avenue, Belmont, WA 6104",
  officeHours: "Monday to Friday, 8am–5pm AWST",
  abn: "",
};

const emptyHomepage: SiteHomepageSettings = DEFAULT_HOMEPAGE_SETTINGS;
const emptySeedGuide: SiteSeedGuideSettings = DEFAULT_SEED_GUIDE_SETTINGS;
const emptyAbout: SiteAboutSettings = DEFAULT_ABOUT_SETTINGS;
const emptyCompany: SiteCompanySettings = DEFAULT_COMPANY_SETTINGS;

export const siteSettingsTable = pgTable("ih_site_settings", {
  id: integer("id").primaryKey(),
  homepage: jsonb("homepage").$type<SiteHomepageSettings>().notNull().default(emptyHomepage),
  seedGuide: jsonb("seed_guide").$type<SiteSeedGuideSettings>().notNull().default(emptySeedGuide),
  about: jsonb("about").$type<SiteAboutSettings>().notNull().default(emptyAbout),
  company: jsonb("company").$type<SiteCompanySettings>().notNull().default(emptyCompany),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

const nullableAssetId = z.string().trim().max(80).nullable().optional()
  .transform((value) => (value && value.length > 0 ? value : null));

const slugListSchema = z.array(z.string().trim().max(160)).max(BEST_SELLER_LIMIT).transform((items) => {
  const seen = new Set<string>();
  const slugs: string[] = [];
  for (const item of items) {
    if (!item || seen.has(item)) continue;
    seen.add(item);
    slugs.push(item);
    if (slugs.length >= BEST_SELLER_LIMIT) break;
  }
  return slugs;
});

const siteHeroImageSchema = z.object({
  src: z.string().trim().max(500),
  assetId: nullableAssetId,
  kind: z.enum(["image", "video"]).optional(),
  posterSrc: z.string().trim().max(500).optional(),
  durationSeconds: z.number().min(0).max(HERO_VIDEO_MAX_SECONDS + 1).optional(),
});

export const siteHomepageSettingsSchema = z.object({
  heroImageSrc: z.string().trim().max(500),
  heroImageAssetId: nullableAssetId,
  heroImages: z.array(siteHeroImageSchema).max(HERO_IMAGE_LIMIT).optional().default([]),
  heroSlideshow: z.boolean().optional().default(false),
  heroEyebrow: z.string().trim().max(120),
  heroHeading: z.string().trim().max(180),
  heroBody: z.string().trim().max(2000),
  aboutBody: z.string().trim().max(2000).optional(),
  bestSellerSlugs: slugListSchema,
});

export const siteSeedGuideSettingsSchema = z.object({
  navTitle: z.string().trim().max(80),
  cardHeading: z.string().trim().max(240),
  cardButtonLabel: z.string().trim().max(120),
  cardImageSrc: z.string().trim().max(500),
  cardImageAssetId: nullableAssetId,
  pdfFilename: z.string().trim().max(160).optional(),
  pdfStorageKey: z.string().trim().max(240).optional(),
  pageTitle: z.string().trim().max(180),
  pageIntro: z.string().trim().max(2000),
  pageButtonLabel: z.string().trim().max(120),
});

export const siteAboutValueSchema = z.object({
  title: z.string().trim().max(80),
  body: z.string().trim().max(500),
});

export const siteAboutSettingsSchema = z.object({
  heroEyebrow: z.string().trim().max(120),
  heroHeading: z.string().trim().max(180),
  heroHeadingEmphasis: z.string().trim().max(80),
  heroIntro: z.string().trim().max(500),
  heroImageSrc: z.string().trim().max(500),
  heroImageAssetId: nullableAssetId,
  storyLead: z.string().trim().max(2000),
  storyParagraphs: z.array(z.string().trim().max(4000)).max(ABOUT_STORY_LIMIT),
  valuesHeading: z.string().trim().max(80),
  valuesHeadingEmphasis: z.string().trim().max(80),
  values: z.array(siteAboutValueSchema).max(ABOUT_VALUE_LIMIT),
});

export const siteCompanySettingsSchema = z.object({
  legalName: z.string().trim().max(160),
  tradingName: z.string().trim().max(160),
  phone: z.string().trim().max(40),
  email: z.string().trim().max(180),
  address: z.string().trim().max(240),
  officeHours: z.string().trim().max(120),
  abn: z.string().trim().max(20),
});

export const updateSiteSettingsSchema = z.object({
  homepage: siteHomepageSettingsSchema,
  seedGuide: siteSeedGuideSettingsSchema,
  about: siteAboutSettingsSchema.optional(),
  company: siteCompanySettingsSchema.optional(),
});

export const seedGuidePdfInputSchema = z.object({
  filename: z.string().trim().min(1).max(160),
  data: z.string().min(1),
});

export type UpdateSiteSettings = z.infer<typeof updateSiteSettingsSchema>;
export type SiteSettingsRow = typeof siteSettingsTable.$inferSelect;

export function isHeroVideoSlide(image: Partial<SiteHeroImage> | null | undefined): boolean {
  return image?.kind === "video";
}

export function cleanHeroImage(image: Partial<SiteHeroImage> | null | undefined): SiteHeroImage | null {
  const src = image?.src?.trim() || "";
  const assetId = image?.assetId?.trim() || null;
  if (!src && !assetId) return null;
  if (!isHeroVideoSlide(image)) return { src, assetId };
  // Video slides always live at a public hero-video URL; a video needs a src.
  if (!src) return null;
  const duration = typeof image?.durationSeconds === "number" && Number.isFinite(image.durationSeconds)
    ? Math.max(0, Math.min(HERO_VIDEO_MAX_SECONDS + 1, image.durationSeconds))
    : undefined;
  return {
    src,
    assetId: null,
    kind: "video",
    posterSrc: image?.posterSrc?.trim() || "",
    ...(duration === undefined ? {} : { durationSeconds: duration }),
  };
}

export function normalizeHeroImages(value: Partial<SiteHomepageSettings> | null | undefined): SiteHeroImage[] {
  const fromList = Array.isArray(value?.heroImages)
    ? value.heroImages.map(cleanHeroImage).filter((image): image is SiteHeroImage => Boolean(image)).slice(0, HERO_IMAGE_LIMIT)
    : [];
  if (fromList.length) return fromList;
  return [cleanHeroImage({ src: value?.heroImageSrc, assetId: value?.heroImageAssetId }) ?? DEFAULT_HERO_IMAGE];
}

export function withHomepageDefaults(value: Partial<SiteHomepageSettings> | null | undefined): SiteHomepageSettings {
  const heroImages = normalizeHeroImages(value);
  const first = heroImages[0] ?? DEFAULT_HERO_IMAGE;
  return {
    ...DEFAULT_HOMEPAGE_SETTINGS,
    ...value,
    aboutBody: typeof value?.aboutBody === "string" ? value.aboutBody : DEFAULT_HOMEPAGE_SETTINGS.aboutBody,
    heroImages,
    heroImageSrc: first.src,
    heroImageAssetId: first.assetId,
    heroSlideshow: Boolean(value?.heroSlideshow) && heroImages.length > 1,
    bestSellerSlugs: Array.isArray(value?.bestSellerSlugs)
      ? value.bestSellerSlugs.map((slug) => slug.trim()).filter(Boolean).slice(0, BEST_SELLER_LIMIT)
      : [],
  };
}

export function withSeedGuideDefaults(value: Partial<SiteSeedGuideSettings> | null | undefined): SiteSeedGuideSettings {
  return {
    ...DEFAULT_SEED_GUIDE_SETTINGS,
    ...value,
    cardImageAssetId: value?.cardImageAssetId?.trim() || null,
    pdfFilename: value?.pdfFilename?.trim() || "",
    pdfStorageKey: value?.pdfStorageKey?.trim() || "",
  };
}

export function withCompanyDefaults(value: Partial<SiteCompanySettings> | null | undefined): SiteCompanySettings {
  return {
    legalName: value?.legalName?.trim() || DEFAULT_COMPANY_SETTINGS.legalName,
    tradingName: value?.tradingName?.trim() || DEFAULT_COMPANY_SETTINGS.tradingName,
    phone: typeof value?.phone === "string" ? value.phone.trim() : DEFAULT_COMPANY_SETTINGS.phone,
    email: value?.email?.trim() || DEFAULT_COMPANY_SETTINGS.email,
    address: value?.address?.trim() || DEFAULT_COMPANY_SETTINGS.address,
    officeHours: value?.officeHours?.trim() || DEFAULT_COMPANY_SETTINGS.officeHours,
    abn: typeof value?.abn === "string" ? value.abn.trim() : DEFAULT_COMPANY_SETTINGS.abn,
  };
}

export function withAboutDefaults(value: Partial<SiteAboutSettings> | null | undefined): SiteAboutSettings {
  const incomingValues = Array.isArray(value?.values) ? value.values : [];
  const storyParagraphs = Array.isArray(value?.storyParagraphs)
    ? value.storyParagraphs.map((item) => item.trim()).slice(0, ABOUT_STORY_LIMIT)
    : [...DEFAULT_ABOUT_SETTINGS.storyParagraphs];
  while (storyParagraphs.length < ABOUT_STORY_LIMIT) storyParagraphs.push("");
  return {
    ...DEFAULT_ABOUT_SETTINGS,
    ...value,
    heroImageSrc: value?.heroImageSrc?.trim() || DEFAULT_ABOUT_SETTINGS.heroImageSrc,
    heroImageAssetId: value?.heroImageAssetId?.trim() || null,
    storyParagraphs,
    values: DEFAULT_ABOUT_VALUES.map((fallback, index) => ({
      title: incomingValues[index]?.title?.trim() ?? fallback.title,
      body: incomingValues[index]?.body?.trim() ?? fallback.body,
    })),
  };
}

export function seedGuidePublicPdfUrl(settings: Pick<SiteSeedGuideSettings, "pdfStorageKey">) {
  return settings.pdfStorageKey.trim() ? SEED_GUIDE_PDF_PUBLIC_PATH : DEFAULT_SEED_GUIDE_PDF_URL;
}

export function expandProductCount(body: string, productCount: number) {
  const replacement = productCount > 0 ? `${productCount}+ varieties and mixes` : "improved pasture seed";
  return body.replaceAll("{productCount}", replacement);
}
