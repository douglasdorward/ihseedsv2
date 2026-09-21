import { integer, jsonb, pgTable, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const SITE_SETTINGS_ID = 1;
export const BEST_SELLER_LIMIT = 4;
export const HERO_IMAGE_LIMIT = 6;
export const ABOUT_VALUE_LIMIT = 3;
export const ABOUT_STORY_LIMIT = 3;
export const DEFAULT_SEED_GUIDE_PDF_URL = "/IH-Seeds-2026-Pasture-Seed-Guide.pdf";
export const SEED_GUIDE_PDF_PUBLIC_PATH = "/api/site/seed-guide.pdf";
export const SEED_GUIDE_PDF_STORAGE_KEY = "site/seed-guide.pdf";

export const DEFAULT_HOMEPAGE_HERO_IMAGE =
  "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=900&q=80";
export const DEFAULT_SEED_GUIDE_CARD_IMAGE =
  "https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=900&q=80";
export const DEFAULT_ABOUT_HERO_IMAGE =
  "https://images.unsplash.com/photo-1530507629858-e4977d30e9e0?auto=format&fit=crop&w=900&q=80";

export type SiteHeroImage = {
  src: string;
  assetId: string | null;
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
  aboutBody: "Irwin Hunter & Co has been Western Australian owned and operated since 1966. We supply true to type seed from credible growers, blended into mixes that suit the paddock they are going into. Our long history across the state means we know which varieties perform in every region.",
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
  { title: "Regional expertise", body: "Local conditions, understood and applied. Sixty years of sowing across every WA rainfall zone." },
  { title: "Proven performance", body: "Varieties and mixes proven over generations across Australia, with trial data behind them." },
  { title: "Partnership", body: "Confidence before the order. Support after it — through your local rural reseller." },
];

export const DEFAULT_ABOUT_SETTINGS: SiteAboutSettings = {
  heroEyebrow: "About Us",
  heroHeading: "Western Australian owned,",
  heroHeadingEmphasis: "since 1966",
  heroIntro: "Three generations of the Hunter family, one paddock question at a time: what will actually grow here.",
  heroImageSrc: DEFAULT_ABOUT_HERO_IMAGE,
  heroImageAssetId: null,
  storyLead: "It started with a question every farmer in the south-west was asking: which seed will actually perform on my ground, in my rainfall, under my grazing plan.",
  storyParagraphs: [
    "Irwin Hunter & Co was founded in 1966 by growers who were tired of buying seed blended for somewhere else. They started sourcing, testing and blending pasture seed for Western Australian conditions specifically — not the eastern states, not overseas trial data, but paddocks from Esperance to Derby.",
    "Sixty years on, the company is still independently owned and run by the same family. We have watched varieties come and go, rainfall patterns shift, and three generations of resellers build their businesses alongside ours. What has not changed is the question we start with: what will actually grow here.",
    "Today we supply through rural resellers across the state — from the wheatbelt to the Kimberley — with true to type seed across {productCount} from credible growers, and the technical advice to back it. We are an Australian Seed Federation member, and every mix we blend still gets tested against the same standard the founders set: would we sow it on our own place.",
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

function cleanHeroImage(image: Partial<SiteHeroImage> | null | undefined): SiteHeroImage | null {
  const src = image?.src?.trim() || "";
  const assetId = image?.assetId?.trim() || null;
  if (!src && !assetId) return null;
  return { src, assetId };
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
