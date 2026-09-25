import { Router, type IRouter, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  DEFAULT_ABOUT_SETTINGS,
  DEFAULT_COMPANY_SETTINGS,
  DEFAULT_HOMEPAGE_SETTINGS,
  DEFAULT_SEED_GUIDE_SETTINGS,
  HERO_VIDEO_PUBLIC_PREFIX,
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
  type SiteHeroImage,
  type SiteHomepageSettings,
  type SiteSeedGuideSettings,
  type SiteSettingsRow,
} from "@workspace/db";
import { getStoredFile, heroVideoStorageKey, putStoredFile, removeStoredFile } from "../lib/app-storage";
import { HeroVideoError, transcodeHeroVideo } from "../lib/hero-video";
import { syncStaticSiteMediaReferences } from "../lib/media-usage";

const router: IRouter = Router();
const MAX_PDF_BYTES = 15 * 1024 * 1024;
const PDF_MAGIC = Buffer.from("%PDF");
const HERO_VIDEO_ID = /^[a-f0-9-]{36}$/;

export function heroVideoPublicSrc(id: string) {
  return `${HERO_VIDEO_PUBLIC_PREFIX}${id}.mp4`;
}

export function heroVideoPosterSrc(id: string) {
  return `${HERO_VIDEO_PUBLIC_PREFIX}${id}.webp`;
}

/** Extract the storage id from a hero-video slide src, or null for anything else. */
export function heroVideoIdFromSrc(src: string | undefined | null) {
  const value = (src ?? "").trim();
  if (!value.startsWith(HERO_VIDEO_PUBLIC_PREFIX)) return null;
  const id = value.slice(HERO_VIDEO_PUBLIC_PREFIX.length).replace(/\.(mp4|webp)$/, "");
  return HERO_VIDEO_ID.test(id) ? id : null;
}

function heroVideoIds(homepage: Pick<SiteHomepageSettings, "heroImages">) {
  const ids = new Set<string>();
  for (const image of homepage.heroImages ?? []) {
    if (image.kind !== "video") continue;
    const id = heroVideoIdFromSrc(image.src);
    if (id) ids.add(id);
  }
  return ids;
}

/** Delete stored clips that were on the homepage before this save but are not any more. */
async function removeOrphanedHeroVideos(previous: SiteHomepageSettings, next: SiteHomepageSettings, log: Request["log"]) {
  const keep = heroVideoIds(next);
  for (const id of heroVideoIds(previous)) {
    if (keep.has(id)) continue;
    try {
      await removeStoredFile(heroVideoStorageKey(id, "video.mp4"));
      await removeStoredFile(heroVideoStorageKey(id, "poster.webp"));
    } catch (error) {
      log.warn({ err: error, heroVideoId: id }, "Orphaned hero video could not be removed");
    }
  }
}

/** Serve a stored file with byte-range support so Safari and iOS will stream `<video>`. */
function sendStoredWithRanges(req: Request, res: Response, bytes: Buffer, contentType: string) {
  res.setHeader("content-type", contentType);
  res.setHeader("accept-ranges", "bytes");
  res.setHeader("cache-control", "public, max-age=31536000, immutable");
  const range = req.headers.range;
  const total = bytes.length;
  if (!range || !/^bytes=/.test(range)) {
    res.setHeader("content-length", String(total));
    if (req.method === "HEAD") { res.end(); return; }
    res.send(bytes);
    return;
  }
  const [startRaw, endRaw] = range.replace(/^bytes=/, "").split(",")[0].split("-");
  let start = startRaw ? Number(startRaw) : Number.NaN;
  let end = endRaw ? Number(endRaw) : total - 1;
  if (Number.isNaN(start)) {
    // Suffix range: bytes=-500
    const suffix = Number(endRaw);
    if (!Number.isFinite(suffix) || suffix <= 0) { res.status(416).setHeader("content-range", `bytes */${total}`).end(); return; }
    start = Math.max(0, total - suffix);
    end = total - 1;
  }
  if (!Number.isFinite(end) || end >= total) end = total - 1;
  if (!Number.isFinite(start) || start < 0 || start > end || start >= total) {
    res.status(416).setHeader("content-range", `bytes */${total}`).end();
    return;
  }
  res.status(206);
  res.setHeader("content-range", `bytes ${start}-${end}/${total}`);
  res.setHeader("content-length", String(end - start + 1));
  if (req.method === "HEAD") { res.end(); return; }
  res.end(bytes.subarray(start, end + 1));
}

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
  await removeOrphanedHeroVideos(withHomepageDefaults(current.homepage), homepage, req.log);
  res.json(toPublicSettings(updated ?? { ...current, homepage, seedGuide, about, company, updatedAt: new Date() }));
});

router.put("/admin/site-settings/hero-video", async (req, res): Promise<void> => {
  const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
  const filename = typeof req.headers["x-filename"] === "string" ? req.headers["x-filename"].slice(0, 200) : "";
  let converted;
  try {
    converted = await transcodeHeroVideo(body);
  } catch (error) {
    if (error instanceof HeroVideoError) {
      if (error.status === 503) req.log.error({ err: error }, "Hero video processing unavailable");
      res.status(error.status).json({ error: error.message });
      return;
    }
    req.log.error({ err: error, filename }, "Hero video transcode failed");
    res.status(500).json({ error: "The video could not be processed. Please try again." });
    return;
  }
  const id = randomUUID();
  try {
    await putStoredFile(heroVideoStorageKey(id, "video.mp4"), converted.mp4, converted.contentType);
    await putStoredFile(heroVideoStorageKey(id, "poster.webp"), converted.poster, converted.posterContentType);
  } catch (error) {
    req.log.error({ err: error, heroVideoId: id }, "Hero video storage upload failed");
    await removeStoredFile(heroVideoStorageKey(id, "video.mp4")).catch(() => undefined);
    res.status(503).json({ error: "Video storage is temporarily unavailable. Please try the upload again." });
    return;
  }
  const slide: SiteHeroImage = {
    src: heroVideoPublicSrc(id),
    assetId: null,
    kind: "video",
    posterSrc: heroVideoPosterSrc(id),
    durationSeconds: converted.durationSeconds,
  };
  req.log.info({ heroVideoId: id, filename, bytes: converted.mp4.length, durationSeconds: converted.durationSeconds }, "Hero video stored");
  res.status(201).json(slide);
});

router.get("/site/hero-videos/:file", async (req, res): Promise<void> => {
  const file = String(req.params.file ?? "");
  const match = /^([a-f0-9-]{36})\.(mp4|webp)$/.exec(file);
  if (!match) {
    res.status(404).json({ error: "Hero video not found." });
    return;
  }
  const id = match[1];
  const wantsPoster = match[2] === "webp";
  const stored = await getStoredFile(heroVideoStorageKey(id, wantsPoster ? "poster.webp" : "video.mp4"));
  if (!stored?.bytes?.length) {
    res.status(404).json({ error: "Hero video not found." });
    return;
  }
  sendStoredWithRanges(req, res, stored.bytes, wantsPoster ? "image/webp" : "video/mp4");
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
