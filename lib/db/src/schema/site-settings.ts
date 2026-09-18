import { integer, jsonb, pgTable, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const SITE_SETTINGS_ID = 1;
export const BEST_SELLER_LIMIT = 4;
export const DEFAULT_SEED_GUIDE_PDF_URL = "/IH-Seeds-2026-Pasture-Seed-Guide.pdf";
export const SEED_GUIDE_PDF_PUBLIC_PATH = "/api/site/seed-guide.pdf";
export const SEED_GUIDE_PDF_STORAGE_KEY = "site/seed-guide.pdf";

export const DEFAULT_HOMEPAGE_HERO_IMAGE =
  "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=900&q=80";
export const DEFAULT_SEED_GUIDE_CARD_IMAGE =
  "https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=900&q=80";

export type SiteHomepageSettings = {
  heroImageSrc: string;
  heroImageAssetId: string | null;
  heroEyebrow: string;
  heroHeading: string;
  heroBody: string;
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

export const DEFAULT_HOMEPAGE_SETTINGS: SiteHomepageSettings = {
  heroImageSrc: DEFAULT_HOMEPAGE_HERO_IMAGE,
  heroImageAssetId: null,
  heroEyebrow: "Western Australia's",
  heroHeading: "Pasture Seed Specialists",
  heroBody: "Independently owned since 1966. We source, test and blend {productCount} for every region of the state — from Esperance to Derby.",
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

const emptyHomepage: SiteHomepageSettings = DEFAULT_HOMEPAGE_SETTINGS;
const emptySeedGuide: SiteSeedGuideSettings = DEFAULT_SEED_GUIDE_SETTINGS;

export const siteSettingsTable = pgTable("ih_site_settings", {
  id: integer("id").primaryKey(),
  homepage: jsonb("homepage").$type<SiteHomepageSettings>().notNull().default(emptyHomepage),
  seedGuide: jsonb("seed_guide").$type<SiteSeedGuideSettings>().notNull().default(emptySeedGuide),
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

export const siteHomepageSettingsSchema = z.object({
  heroImageSrc: z.string().trim().max(500),
  heroImageAssetId: nullableAssetId,
  heroEyebrow: z.string().trim().max(120),
  heroHeading: z.string().trim().max(180),
  heroBody: z.string().trim().max(2000),
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

export const updateSiteSettingsSchema = z.object({
  homepage: siteHomepageSettingsSchema,
  seedGuide: siteSeedGuideSettingsSchema,
});

export const seedGuidePdfInputSchema = z.object({
  filename: z.string().trim().min(1).max(160),
  data: z.string().min(1),
});

export type UpdateSiteSettings = z.infer<typeof updateSiteSettingsSchema>;
export type SiteSettingsRow = typeof siteSettingsTable.$inferSelect;

export function withHomepageDefaults(value: Partial<SiteHomepageSettings> | null | undefined): SiteHomepageSettings {
  return {
    ...DEFAULT_HOMEPAGE_SETTINGS,
    ...value,
    heroImageAssetId: value?.heroImageAssetId?.trim() || null,
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

export function seedGuidePublicPdfUrl(settings: Pick<SiteSeedGuideSettings, "pdfStorageKey">) {
  return settings.pdfStorageKey.trim() ? SEED_GUIDE_PDF_PUBLIC_PATH : DEFAULT_SEED_GUIDE_PDF_URL;
}

export function expandProductCount(body: string, productCount: number) {
  const replacement = productCount > 0 ? `${productCount}+ varieties and mixes` : "improved pasture seed";
  return body.replaceAll("{productCount}", replacement);
}
