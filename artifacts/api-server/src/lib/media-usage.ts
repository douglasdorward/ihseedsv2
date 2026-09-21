import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  articlesTable,
  DEFAULT_SEED_GUIDE_CARD_IMAGE,
  mediaAssetsTable,
  mediaReferencesTable,
  productsTable,
  resellerBrandsTable,
  siteSettingsTable,
  SITE_SETTINGS_ID,
  withAboutDefaults,
  withHomepageDefaults,
  withSeedGuideDefaults,
  type Article,
  type MediaAsset,
  type Product,
  type ProductPhoto,
  type ResellerBrand,
  type SiteAboutSettings,
  type SiteHomepageSettings,
  type SiteSeedGuideSettings,
} from "@workspace/db";

type DbLike = Pick<typeof db, "delete" | "insert" | "select" | "update">;

type MediaRefLike = {
  ownerType: string;
  field?: string | null;
  role?: string | null;
  metadata?: Record<string, unknown> | null;
};

const PHOTO_SLOTS: Array<{ slot: string; role: NonNullable<ProductPhoto["role"]> }> = [
  { slot: "Photo 1 · Hero", role: "hero" },
  { slot: "Photo 2", role: "gallery" },
  { slot: "Photo 3", role: "gallery" },
];

export function photoSlotFilled(photo: ProductPhoto | undefined) {
  return Boolean(photo?.src?.trim() || photo?.assetId);
}

export function insertHeroPhoto(photos: ProductPhoto[] | undefined, incoming: ProductPhoto): ProductPhoto[] {
  const incomingId = incoming.assetId?.trim();
  const incomingSrc = incoming.src?.trim();
  const filled = (photos ?? []).filter((photo) => {
    if (!photoSlotFilled(photo)) return false;
    if (incomingId && photo.assetId?.trim() === incomingId) return false;
    if (!incomingId && incomingSrc && photo.src?.trim() === incomingSrc) return false;
    return true;
  });
  const shifted = [incoming, ...filled].slice(0, 3);
  return slotPhotos(shifted);
}

function assetIdSet(ids: Iterable<string>) {
  return new Set([...ids].map((id) => id.trim()).filter(Boolean));
}

function publicSrcs(ids: Set<string>) {
  return new Set([...ids].map((id) => `/api/media/${id}`));
}

function matchesAsset(
  assetId: string | null | undefined,
  src: string | null | undefined,
  ids: Set<string>,
  srcs: Set<string>,
) {
  const id = assetId?.trim();
  if (id && ids.has(id)) return true;
  const value = src?.trim();
  return Boolean(value && srcs.has(value));
}

function slotPhotos(filled: ProductPhoto[]): ProductPhoto[] {
  return PHOTO_SLOTS.map((meta, index) => {
    const photo = filled[index];
    if (!photo) return { slot: meta.slot, file: "", rating: "", src: "", role: meta.role };
    return { ...photo, slot: meta.slot, role: meta.role, rating: photo.rating ?? "" };
  });
}

export function photosWithoutAssets(photos: ProductPhoto[] | undefined, assetIds: Iterable<string>): ProductPhoto[] {
  const ids = assetIdSet(assetIds);
  const srcs = publicSrcs(ids);
  const filled = (photos ?? []).filter((photo) => {
    if (!photoSlotFilled(photo)) return false;
    return !matchesAsset(photo.assetId, photo.src, ids, srcs);
  });
  return slotPhotos(filled);
}

export function detailsWithoutAssets(details: Product["details"], assetIds: Iterable<string>): Product["details"] {
  const ids = assetIdSet(assetIds);
  const srcs = publicSrcs(ids);
  const photos = photosWithoutAssets(details.photos, ids);
  const socialImage = matchesAsset(null, details.socialImage, ids, srcs) ? "" : details.socialImage;
  return { ...details, photos, socialImage };
}

export function homepageWithoutAssets(
  homepage: SiteHomepageSettings,
  assetIds: Iterable<string>,
): SiteHomepageSettings {
  const ids = assetIdSet(assetIds);
  const srcs = publicSrcs(ids);
  const current = homepage.heroImages?.length
    ? homepage.heroImages
    : [{ src: homepage.heroImageSrc, assetId: homepage.heroImageAssetId }];
  const remaining = current.filter((image) => !matchesAsset(image.assetId, image.src, ids, srcs));
  return withHomepageDefaults({
    ...homepage,
    heroImages: remaining,
    heroImageSrc: remaining[0]?.src ?? "",
    heroImageAssetId: remaining[0]?.assetId ?? null,
  });
}

export function aboutWithoutAssets(about: SiteAboutSettings, assetIds: Iterable<string>): SiteAboutSettings {
  const ids = assetIdSet(assetIds);
  const srcs = publicSrcs(ids);
  if (!matchesAsset(about.heroImageAssetId, about.heroImageSrc, ids, srcs)) return about;
  return withAboutDefaults({ ...about, heroImageSrc: "", heroImageAssetId: null });
}

export function seedGuideWithoutAssets(
  seedGuide: SiteSeedGuideSettings,
  assetIds: Iterable<string>,
): SiteSeedGuideSettings {
  const ids = assetIdSet(assetIds);
  const srcs = publicSrcs(ids);
  if (!matchesAsset(seedGuide.cardImageAssetId, seedGuide.cardImageSrc, ids, srcs)) return seedGuide;
  return withSeedGuideDefaults({
    ...seedGuide,
    cardImageSrc: DEFAULT_SEED_GUIDE_CARD_IMAGE,
    cardImageAssetId: null,
  });
}

export function articleFieldsWithoutAssets(
  article: Pick<Article, "heroImageSrc" | "heroImageAssetId" | "socialImage">,
  assetIds: Iterable<string>,
) {
  const ids = assetIdSet(assetIds);
  const srcs = publicSrcs(ids);
  const heroMatches = matchesAsset(article.heroImageAssetId, article.heroImageSrc, ids, srcs);
  return {
    heroImageSrc: heroMatches ? "" : article.heroImageSrc,
    heroImageAssetId: heroMatches ? null : article.heroImageAssetId,
    socialImage: matchesAsset(null, article.socialImage, ids, srcs) ? "" : article.socialImage,
  };
}

export function resellerLogoWithoutAssets(
  brand: Pick<ResellerBrand, "logoSrc" | "logoAssetId">,
  assetIds: Iterable<string>,
) {
  const ids = assetIdSet(assetIds);
  const srcs = publicSrcs(ids);
  if (!matchesAsset(brand.logoAssetId, brand.logoSrc, ids, srcs)) return brand;
  return { logoSrc: "", logoAssetId: null };
}

export function mediaUsageState(publishStatus: string): "Draft" | "Published" {
  return publishStatus === "Published" ? "Published" : "Draft";
}

function metadataSlot(metadata: Record<string, unknown> | null | undefined) {
  return typeof metadata?.slot === "string" ? metadata.slot : "";
}

function metadataIndex(metadata: Record<string, unknown> | null | undefined) {
  return typeof metadata?.index === "number" ? metadata.index : undefined;
}

export function isProductHeroPhoto(photo: ProductPhoto | undefined, index: number) {
  if (index === 0) return true;
  if (photo?.role === "hero") return true;
  return /hero/i.test(photo?.slot ?? "");
}

export function isProductHeroReference(ref: MediaRefLike) {
  if (ref.ownerType !== "product") return false;
  if (ref.role === "hero") return true;
  if (ref.field === "details.photos[0]") return true;
  if (metadataIndex(ref.metadata) === 0) return true;
  return /hero/i.test(metadataSlot(ref.metadata));
}

export function isProtectedMediaReference(ref: MediaRefLike) {
  if (ref.ownerType !== "product") return true;
  return isProductHeroReference(ref);
}

function photosLookEqual(left: ProductPhoto[] | undefined, right: ProductPhoto[]) {
  const current = left ?? [];
  if (current.length !== right.length) return false;
  return current.every((photo, index) => (
    (photo.assetId?.trim() || "") === (right[index]?.assetId?.trim() || "")
    && (photo.src?.trim() || "") === (right[index]?.src?.trim() || "")
  ));
}

export async function unlinkAndDeleteMediaRecords(ids: string[]): Promise<MediaAsset[]> {
  const unique = [...assetIdSet(ids)];
  if (!unique.length) return [];
  const assets = await db.select().from(mediaAssetsTable).where(inArray(mediaAssetsTable.id, unique));
  if (!assets.length) return [];
  const idSet = new Set(assets.map((asset) => asset.id));

  await db.transaction(async (tx) => {
    const products = await tx.select({
      id: productsTable.id,
      name: productsTable.name,
      publishStatus: productsTable.publishStatus,
      details: productsTable.details,
    }).from(productsTable);
    for (const product of products) {
      const details = detailsWithoutAssets(product.details, idSet);
      if (photosLookEqual(product.details.photos, details.photos) && details.socialImage === product.details.socialImage) continue;
      const [saved] = await tx.update(productsTable).set({
        details,
        updatedAt: new Date(),
      }).where(eq(productsTable.id, product.id)).returning();
      await syncProductMediaReferences(saved ?? { ...product, details }, details.photos, tx);
    }

    const articles = await tx.select().from(articlesTable);
    for (const article of articles) {
      const next = articleFieldsWithoutAssets(article, idSet);
      if (
        next.heroImageSrc === article.heroImageSrc
        && next.heroImageAssetId === article.heroImageAssetId
        && next.socialImage === article.socialImage
      ) continue;
      const [saved] = await tx.update(articlesTable).set({
        heroImageSrc: next.heroImageSrc,
        heroImageAssetId: next.heroImageAssetId,
        socialImage: next.socialImage,
        updatedAt: new Date(),
      }).where(eq(articlesTable.id, article.id)).returning();
      await syncArticleMediaReferences(saved ?? { ...article, ...next }, tx);
    }

    const brands = await tx.select().from(resellerBrandsTable);
    for (const brand of brands) {
      const next = resellerLogoWithoutAssets(brand, idSet);
      if (next.logoSrc === brand.logoSrc && next.logoAssetId === brand.logoAssetId) continue;
      const [saved] = await tx.update(resellerBrandsTable).set({
        logoSrc: next.logoSrc,
        logoAssetId: next.logoAssetId,
        updatedAt: new Date(),
      }).where(eq(resellerBrandsTable.id, brand.id)).returning();
      await syncResellerMediaReferences(saved ?? { ...brand, ...next }, tx);
    }

    const [settings] = await tx.select().from(siteSettingsTable).where(eq(siteSettingsTable.id, SITE_SETTINGS_ID));
    if (settings) {
      const currentHomepage = withHomepageDefaults(settings.homepage);
      const currentSeedGuide = withSeedGuideDefaults(settings.seedGuide);
      const currentAbout = withAboutDefaults(settings.about);
      const homepage = homepageWithoutAssets(currentHomepage, idSet);
      const seedGuide = seedGuideWithoutAssets(currentSeedGuide, idSet);
      const about = aboutWithoutAssets(currentAbout, idSet);
      const homepageChanged = homepage.heroImageSrc !== currentHomepage.heroImageSrc
        || homepage.heroImageAssetId !== currentHomepage.heroImageAssetId
        || homepage.heroImages.length !== currentHomepage.heroImages.length
        || homepage.heroImages.some((image, index) => (
          image.src !== currentHomepage.heroImages[index]?.src
          || image.assetId !== currentHomepage.heroImages[index]?.assetId
        ));
      const changed = homepageChanged
        || seedGuide.cardImageSrc !== currentSeedGuide.cardImageSrc
        || seedGuide.cardImageAssetId !== currentSeedGuide.cardImageAssetId
        || about.heroImageSrc !== currentAbout.heroImageSrc
        || about.heroImageAssetId !== currentAbout.heroImageAssetId;
      if (changed) {
        await tx.update(siteSettingsTable).set({
          homepage,
          seedGuide,
          about,
          updatedAt: new Date(),
        }).where(eq(siteSettingsTable.id, SITE_SETTINGS_ID));
        await syncStaticSiteMediaReferences(homepage, seedGuide, about, tx);
      }
    }

    await tx.delete(mediaAssetsTable).where(inArray(mediaAssetsTable.id, [...idSet]));
  });

  return assets;
}

export async function syncProductMediaReferences(
  product: Pick<Product, "id" | "name" | "publishStatus">,
  photos: ProductPhoto[] | undefined,
  tx: DbLike = db,
) {
  const ownerId = String(product.id);
  await tx.delete(mediaReferencesTable).where(and(
    eq(mediaReferencesTable.ownerType, "product"),
    eq(mediaReferencesTable.ownerId, ownerId),
  ));
  const rows = (photos ?? [])
    .map((photo, index) => {
      const assetId = photo.assetId?.trim();
      if (!assetId) return null;
      return {
        assetId,
        ownerType: "product" as const,
        ownerId,
        ownerName: product.name,
        field: `details.photos[${index}]`,
        role: photo.role || (index === 0 ? "hero" : photo.slot || ""),
        usageState: mediaUsageState(product.publishStatus),
        editPath: `/admin/products/${product.id}`,
        metadata: { slot: photo.slot, index },
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
  if (rows.length) await tx.insert(mediaReferencesTable).values(rows);
}

export async function clearProductMediaReferences(productId: number, tx: DbLike = db) {
  await tx.delete(mediaReferencesTable).where(and(
    eq(mediaReferencesTable.ownerType, "product"),
    eq(mediaReferencesTable.ownerId, String(productId)),
  ));
}

export async function syncArticleMediaReferences(
  article: Pick<Article, "id" | "title" | "publishStatus" | "heroImageAssetId">,
  tx: DbLike = db,
) {
  const ownerId = String(article.id);
  await tx.delete(mediaReferencesTable).where(and(
    eq(mediaReferencesTable.ownerType, "article"),
    eq(mediaReferencesTable.ownerId, ownerId),
  ));
  const assetId = article.heroImageAssetId?.trim();
  if (!assetId) return;
  await tx.insert(mediaReferencesTable).values({
    assetId,
    ownerType: "article",
    ownerId,
    ownerName: article.title,
    field: "heroImage",
    role: "hero",
    usageState: mediaUsageState(article.publishStatus),
    editPath: `/admin/blog/${article.id}`,
    metadata: {},
  });
}

export async function clearArticleMediaReferences(articleId: number, tx: DbLike = db) {
  await tx.delete(mediaReferencesTable).where(and(
    eq(mediaReferencesTable.ownerType, "article"),
    eq(mediaReferencesTable.ownerId, String(articleId)),
  ));
}

export async function syncResellerMediaReferences(
  brand: Pick<ResellerBrand, "id" | "name" | "active" | "logoAssetId">,
  tx: DbLike = db,
) {
  const ownerId = String(brand.id);
  await tx.delete(mediaReferencesTable).where(and(
    eq(mediaReferencesTable.ownerType, "reseller"),
    eq(mediaReferencesTable.ownerId, ownerId),
  ));
  const assetId = brand.logoAssetId?.trim();
  if (!assetId) return;
  await tx.insert(mediaReferencesTable).values({
    assetId,
    ownerType: "reseller",
    ownerId,
    ownerName: brand.name,
    field: "logo",
    role: "logo",
    usageState: brand.active ? "Published" : "Draft",
    editPath: `/admin/resellers/${brand.id}`,
    metadata: {},
  });
}

export async function clearResellerMediaReferences(brandId: number, tx: DbLike = db) {
  await tx.delete(mediaReferencesTable).where(and(
    eq(mediaReferencesTable.ownerType, "reseller"),
    eq(mediaReferencesTable.ownerId, String(brandId)),
  ));
}

const STATIC_OWNER_IDS = ["homepage", "seed-guide", "about"] as const;

export async function syncStaticSiteMediaReferences(
  homepage: SiteHomepageSettings,
  seedGuide: SiteSeedGuideSettings,
  about: SiteAboutSettings,
  tx: DbLike = db,
) {
  await tx.delete(mediaReferencesTable).where(and(
    eq(mediaReferencesTable.ownerType, "static"),
    inArray(mediaReferencesTable.ownerId, [...STATIC_OWNER_IDS]),
  ));
  const heroImages = homepage.heroImages?.length
    ? homepage.heroImages
    : [{ src: homepage.heroImageSrc, assetId: homepage.heroImageAssetId }];
  const seenHeroAssets = new Set<string>();
  const heroRows = heroImages.flatMap((image, index) => {
    const assetId = image.assetId?.trim();
    if (!assetId || seenHeroAssets.has(assetId)) return [];
    seenHeroAssets.add(assetId);
    return [{
      assetId,
      ownerType: "static" as const,
      ownerId: "homepage",
      ownerName: "Home page",
      field: index === 0 ? "heroImage" : `heroImage:${index}`,
      role: "hero",
      usageState: "Published" as const,
      editPath: "/admin/site-settings/home",
      metadata: {},
    }];
  });
  const rows = [
    ...heroRows,
    seedGuide.cardImageAssetId?.trim()
      ? {
          assetId: seedGuide.cardImageAssetId.trim(),
          ownerType: "static" as const,
          ownerId: "seed-guide",
          ownerName: "Seed guide",
          field: "cardImage",
          role: "hero",
          usageState: "Published" as const,
          editPath: "/admin/site-settings/seed-guide",
          metadata: {},
        }
      : null,
    about.heroImageAssetId?.trim()
      ? {
          assetId: about.heroImageAssetId.trim(),
          ownerType: "static" as const,
          ownerId: "about",
          ownerName: "About us",
          field: "heroImage",
          role: "hero",
          usageState: "Published" as const,
          editPath: "/admin/site-settings/about",
          metadata: {},
        }
      : null,
  ].filter((row): row is NonNullable<typeof row> => Boolean(row));
  if (rows.length) await tx.insert(mediaReferencesTable).values(rows);
}

export async function backfillMediaUsage() {
  const products = await db.select({
    id: productsTable.id,
    name: productsTable.name,
    publishStatus: productsTable.publishStatus,
    details: productsTable.details,
  }).from(productsTable);
  const ids = products.map((product) => String(product.id));
  if (ids.length) {
    await db.delete(mediaReferencesTable).where(and(
      eq(mediaReferencesTable.ownerType, "product"),
      inArray(mediaReferencesTable.ownerId, ids),
    ));
  }
  for (const product of products) {
    await syncProductMediaReferences(product, product.details?.photos);
  }
  const articles = await db.select({
    id: articlesTable.id,
    title: articlesTable.title,
    publishStatus: articlesTable.publishStatus,
    heroImageAssetId: articlesTable.heroImageAssetId,
  }).from(articlesTable);
  const articleIds = articles.map((article) => String(article.id));
  if (articleIds.length) {
    await db.delete(mediaReferencesTable).where(and(
      eq(mediaReferencesTable.ownerType, "article"),
      inArray(mediaReferencesTable.ownerId, articleIds),
    ));
  }
  for (const article of articles) {
    await syncArticleMediaReferences(article);
  }
  const brands = await db.select({
    id: resellerBrandsTable.id,
    name: resellerBrandsTable.name,
    active: resellerBrandsTable.active,
    logoAssetId: resellerBrandsTable.logoAssetId,
  }).from(resellerBrandsTable);
  const brandIds = brands.map((brand) => String(brand.id));
  if (brandIds.length) {
    await db.delete(mediaReferencesTable).where(and(
      eq(mediaReferencesTable.ownerType, "reseller"),
      inArray(mediaReferencesTable.ownerId, brandIds),
    ));
  }
  for (const brand of brands) {
    await syncResellerMediaReferences(brand);
  }
  const [settings] = await db.select().from(siteSettingsTable).where(eq(siteSettingsTable.id, SITE_SETTINGS_ID));
  await syncStaticSiteMediaReferences(
    withHomepageDefaults(settings?.homepage),
    withSeedGuideDefaults(settings?.seedGuide),
    withAboutDefaults(settings?.about),
  );
  return { products: products.length, articles: articles.length, resellers: brands.length };
}
