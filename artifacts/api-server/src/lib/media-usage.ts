import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  articlesTable,
  mediaReferencesTable,
  productsTable,
  resellerBrandsTable,
  siteSettingsTable,
  SITE_SETTINGS_ID,
  withHomepageDefaults,
  withSeedGuideDefaults,
  type Article,
  type Product,
  type ProductPhoto,
  type ResellerBrand,
  type SiteHomepageSettings,
  type SiteSeedGuideSettings,
} from "@workspace/db";

type DbLike = Pick<typeof db, "delete" | "insert" | "select">;

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
  return PHOTO_SLOTS.map((meta, index) => {
    const photo = shifted[index];
    if (!photo) return { slot: meta.slot, file: "", rating: "", src: "", role: meta.role };
    return { ...photo, slot: meta.slot, role: meta.role, rating: photo.rating ?? "" };
  });
}

export function mediaUsageState(publishStatus: string): "Draft" | "Published" {
  return publishStatus === "Published" ? "Published" : "Draft";
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

const STATIC_OWNER_IDS = ["homepage", "seed-guide"] as const;

export async function syncStaticSiteMediaReferences(
  homepage: SiteHomepageSettings,
  seedGuide: SiteSeedGuideSettings,
  tx: DbLike = db,
) {
  await tx.delete(mediaReferencesTable).where(and(
    eq(mediaReferencesTable.ownerType, "static"),
    inArray(mediaReferencesTable.ownerId, [...STATIC_OWNER_IDS]),
  ));
  const rows = [
    homepage.heroImageAssetId?.trim()
      ? {
          assetId: homepage.heroImageAssetId.trim(),
          ownerType: "static" as const,
          ownerId: "homepage",
          ownerName: "Home page",
          field: "heroImage",
          role: "hero",
          usageState: "Published" as const,
          editPath: "/admin/site-settings/home",
          metadata: {},
        }
      : null,
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
  );
  return { products: products.length, articles: articles.length, resellers: brands.length };
}
