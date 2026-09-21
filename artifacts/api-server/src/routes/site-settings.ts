import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  DEFAULT_ABOUT_SETTINGS,
  DEFAULT_COMPANY_SETTINGS,
  DEFAULT_HOMEPAGE_SETTINGS,
  DEFAULT_SEED_GUIDE_SETTINGS,
  SEED_GUIDE_PDF_STORAGE_KEY,
  SITE_SETTINGS_ID,
  db,
  seedGuidePdfInputSchema,
  seedGuidePublicPdfUrl,
  siteSettingsTable,
  updateSiteSettingsSchema,
  withAboutDefaults,
  withCompanyDefaults,
  withHomepageDefaults,
  withSeedGuideDefaults,
  type SiteAboutSettings,
  type SiteCompanySettings,
  type SiteHomepageSettings,
  type SiteSeedGuideSettings,
  type SiteSettingsRow,
} from "@workspace/db";
import { getStoredFile, putStoredFile } from "../lib/app-storage";
import { syncStaticSiteMediaReferences } from "../lib/media-usage";

const router: IRouter = Router();
const MAX_PDF_BYTES = 15 * 1024 * 1024;
const PDF_MAGIC = Buffer.from("%PDF");

function decodePdf(data: string, filename: string) {
  const buffer = Buffer.from(data.replace(/^data:[^;]+;base64,/, ""), "base64");
  if (!buffer.length || buffer.length > MAX_PDF_BYTES) {
    throw new Error(`“${filename}” must be a PDF between 1 byte and 15 MB.`);
  }
  if (!buffer.subarray(0, 4).equals(PDF_MAGIC)) {
    throw new Error(`“${filename}” is not a PDF.`);
  }
  return buffer;
}

function safePdfFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "seed-guide.pdf";
}

function toPublicHomepage(homepage: SiteHomepageSettings) {
  return {
    heroImageSrc: homepage.heroImageSrc,
    heroImageAssetId: homepage.heroImageAssetId,
    heroImages: homepage.heroImages,
    heroSlideshow: homepage.heroSlideshow,
    heroEyebrow: homepage.heroEyebrow,
    heroHeading: homepage.heroHeading,
    heroBody: homepage.heroBody,
    aboutBody: homepage.aboutBody,
    bestSellerSlugs: homepage.bestSellerSlugs,
  };
}

function toPublicSeedGuide(seedGuide: SiteSeedGuideSettings) {
  return {
    navTitle: seedGuide.navTitle,
    cardHeading: seedGuide.cardHeading,
    cardButtonLabel: seedGuide.cardButtonLabel,
    cardImageSrc: seedGuide.cardImageSrc,
    cardImageAssetId: seedGuide.cardImageAssetId,
    pdfFilename: seedGuide.pdfFilename,
    pdfPublicUrl: seedGuidePublicPdfUrl(seedGuide),
    pageTitle: seedGuide.pageTitle,
    pageIntro: seedGuide.pageIntro,
    pageButtonLabel: seedGuide.pageButtonLabel,
  };
}

function toPublicAbout(about: SiteAboutSettings) {
  return {
    heroEyebrow: about.heroEyebrow,
    heroHeading: about.heroHeading,
    heroHeadingEmphasis: about.heroHeadingEmphasis,
    heroIntro: about.heroIntro,
    heroImageSrc: about.heroImageSrc,
    heroImageAssetId: about.heroImageAssetId,
    storyLead: about.storyLead,
    storyParagraphs: about.storyParagraphs,
    valuesHeading: about.valuesHeading,
    valuesHeadingEmphasis: about.valuesHeadingEmphasis,
    values: about.values,
  };
}

function toPublicCompany(company: SiteCompanySettings) {
  return {
    legalName: company.legalName,
    tradingName: company.tradingName,
    phone: company.phone,
    email: company.email,
    address: company.address,
    officeHours: company.officeHours,
    abn: company.abn,
  };
}

function toPublicSettings(row: SiteSettingsRow) {
  const homepage = withHomepageDefaults(row.homepage);
  const seedGuide = withSeedGuideDefaults(row.seedGuide);
  const about = withAboutDefaults(row.about);
  const company = withCompanyDefaults(row.company);
  return {
    homepage: toPublicHomepage(homepage),
    seedGuide: toPublicSeedGuide(seedGuide),
    about: toPublicAbout(about),
    company: toPublicCompany(company),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function ensureSettings(): Promise<SiteSettingsRow> {
  const [existing] = await db.select().from(siteSettingsTable).where(eq(siteSettingsTable.id, SITE_SETTINGS_ID));
  if (existing) return existing;
  const [created] = await db.insert(siteSettingsTable).values({
    id: SITE_SETTINGS_ID,
    homepage: DEFAULT_HOMEPAGE_SETTINGS,
    seedGuide: DEFAULT_SEED_GUIDE_SETTINGS,
    about: DEFAULT_ABOUT_SETTINGS,
    company: DEFAULT_COMPANY_SETTINGS,
  }).onConflictDoNothing().returning();
  if (created) return created;
  const [retry] = await db.select().from(siteSettingsTable).where(eq(siteSettingsTable.id, SITE_SETTINGS_ID));
  if (!retry) throw new Error("Site settings could not be loaded.");
  return retry;
}

router.get("/site-settings", async (_req, res): Promise<void> => {
  res.json(toPublicSettings(await ensureSettings()));
});

router.get("/admin/site-settings", async (_req, res): Promise<void> => {
  res.json(toPublicSettings(await ensureSettings()));
});

router.put("/admin/site-settings", async (req, res): Promise<void> => {
  const parsed = updateSiteSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Please provide valid site settings." });
    return;
  }
  const current = await ensureSettings();
  const homepage = withHomepageDefaults(parsed.data.homepage);
  const seedGuide = withSeedGuideDefaults({
    ...parsed.data.seedGuide,
    pdfFilename: current.seedGuide?.pdfFilename || DEFAULT_SEED_GUIDE_SETTINGS.pdfFilename,
    pdfStorageKey: current.seedGuide?.pdfStorageKey || DEFAULT_SEED_GUIDE_SETTINGS.pdfStorageKey,
  });
  const about = withAboutDefaults(parsed.data.about ?? current.about);
  const company = withCompanyDefaults(parsed.data.company ?? current.company);
  const updated = await db.transaction(async (tx) => {
    const [saved] = await tx.update(siteSettingsTable).set({
      homepage,
      seedGuide,
      about,
      company,
      updatedAt: new Date(),
    }).where(eq(siteSettingsTable.id, SITE_SETTINGS_ID)).returning();
    await syncStaticSiteMediaReferences(homepage, seedGuide, about, tx);
    return saved;
  });
  res.json(toPublicSettings(updated ?? { ...current, homepage, seedGuide, about, company, updatedAt: new Date() }));
});

router.post("/admin/site-settings/seed-guide-pdf", async (req, res): Promise<void> => {
  const parsed = seedGuidePdfInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Upload a PDF file." });
    return;
  }
  let buffer: Buffer;
  try {
    buffer = decodePdf(parsed.data.data, parsed.data.filename);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Upload a PDF file." });
    return;
  }
  const current = await ensureSettings();
  const filename = safePdfFilename(parsed.data.filename);
  await putStoredFile(SEED_GUIDE_PDF_STORAGE_KEY, buffer, "application/pdf");
  const seedGuide = withSeedGuideDefaults({
    ...current.seedGuide,
    pdfFilename: filename,
    pdfStorageKey: SEED_GUIDE_PDF_STORAGE_KEY,
  });
  const homepage = withHomepageDefaults(current.homepage);
  const about = withAboutDefaults(current.about);
  const company = withCompanyDefaults(current.company);
  const updated = await db.transaction(async (tx) => {
    const [saved] = await tx.update(siteSettingsTable).set({
      seedGuide,
      updatedAt: new Date(),
    }).where(eq(siteSettingsTable.id, SITE_SETTINGS_ID)).returning();
    await syncStaticSiteMediaReferences(homepage, seedGuide, about, tx);
    return saved;
  });
  res.status(200).json(toPublicSettings(updated ?? { ...current, homepage, seedGuide, about, company, updatedAt: new Date() }));
});

router.get("/site/seed-guide.pdf", async (_req, res): Promise<void> => {
  const settings = withSeedGuideDefaults((await ensureSettings()).seedGuide);
  if (!settings.pdfStorageKey) {
    res.status(404).json({ error: "No seed guide PDF has been uploaded." });
    return;
  }
  const stored = await getStoredFile(settings.pdfStorageKey);
  if (!stored) {
    res.status(404).json({ error: "The seed guide PDF is no longer in storage." });
    return;
  }
  const filename = settings.pdfFilename || "IH-Seeds-Pasture-Seed-Guide.pdf";
  res.setHeader("content-type", stored.contentType || "application/pdf");
  res.setHeader("content-disposition", `attachment; filename="${filename.replace(/"/g, "")}"`);
  res.setHeader("cache-control", "public, max-age=300");
  res.send(stored.bytes);
});

export default router;
