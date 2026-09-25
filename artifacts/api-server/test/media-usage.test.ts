import assert from "node:assert/strict";
import { after, test } from "node:test";

process.env.DATABASE_URL ??= "postgres://127.0.0.1:5432/ih_media_usage_unit_test";

const {
  aboutWithoutAssets,
  assetIdFromPhoto,
  detailsWithoutAssets,
  homepageWithoutAssets,
  isProductHeroPhoto,
  isProductHeroReference,
  isProtectedMediaReference,
  photosWithoutAssets,
  seedGuideWithoutAssets,
} = await import("../src/lib/media-usage.ts");
const {
  DEFAULT_ABOUT_HERO_IMAGE,
  DEFAULT_HOMEPAGE_HERO_IMAGE,
  DEFAULT_SEED_GUIDE_CARD_IMAGE,
  pool,
  withAboutDefaults,
  withHomepageDefaults,
  withSeedGuideDefaults,
} = await import("@workspace/db");

after(async () => {
  await pool.end();
});

test("assetIdFromPhoto reads a library id from src when assetId was not stored", () => {
  assert.equal(assetIdFromPhoto({ src: "/api/media/4bb9e866-9848-4894-8bd3-95198eb7fb92" }), "4bb9e866-9848-4894-8bd3-95198eb7fb92");
  assert.equal(assetIdFromPhoto({ assetId: "kept", src: "/api/media/other" }), "kept");
  assert.equal(assetIdFromPhoto({ src: "https://example.com/photo.jpg" }), "");
});

test("product hero references and first-slot photos are protected", () => {
  assert.equal(isProtectedMediaReference({
    ownerType: "product",
    role: "hero",
    field: "details.photos[0]",
    metadata: { slot: "Photo 1 · Hero", index: 0 },
  }), true);
  assert.equal(isProductHeroReference({ ownerType: "product", role: "hero" }), true);
  assert.equal(isProductHeroReference({
    ownerType: "product",
    role: "gallery",
    field: "details.photos[0]",
    metadata: { slot: "Photo 2", index: 0 },
  }), true);
  assert.equal(isProductHeroPhoto({
    slot: "Photo 1 · Hero", file: "", rating: "", src: "/api/media/1", role: "hero",
  }, 0), true);
});

test("product gallery slots are not protected, including slot-name roles", () => {
  assert.equal(isProtectedMediaReference({
    ownerType: "product",
    role: "gallery",
    field: "details.photos[1]",
    metadata: { slot: "Photo 2", index: 1 },
  }), false);
  assert.equal(isProtectedMediaReference({
    ownerType: "product",
    role: "Photo 2",
    field: "details.photos[1]",
    metadata: { slot: "Photo 2", index: 1 },
  }), false);
  assert.equal(isProductHeroPhoto({
    slot: "Photo 2", file: "", rating: "", src: "/api/media/2",
  }, 1), false);
});

test("article, site, and reseller usages stay protected", () => {
  assert.equal(isProtectedMediaReference({ ownerType: "article", role: "hero" }), true);
  assert.equal(isProtectedMediaReference({ ownerType: "static", role: "hero" }), true);
  assert.equal(isProtectedMediaReference({ ownerType: "reseller", role: "logo" }), true);
  assert.equal(isProtectedMediaReference({ ownerType: "category", role: "" }), true);
});

test("photosWithoutAssets compacts remaining photos into hero slots", () => {
  const photos = [
    { slot: "Photo 1 · Hero", file: "a.webp", rating: "", src: "/api/media/hero", assetId: "hero", role: "hero" as const },
    { slot: "Photo 2", file: "b.webp", rating: "", src: "/api/media/gallery", assetId: "gallery", role: "gallery" as const },
    { slot: "Photo 3", file: "", rating: "", src: "", role: "gallery" as const },
  ];
  const next = photosWithoutAssets(photos, ["hero"]);
  assert.equal(next[0].assetId, "gallery");
  assert.equal(next[0].role, "hero");
  assert.equal(next[0].slot, "Photo 1 · Hero");
  assert.equal(next[1].src, "");
  assert.equal(next[2].src, "");
});

test("photosWithoutAssets drops duplicate asset ids and keeps three slots", () => {
  const photos = [
    { slot: "Photo 1 · Hero", file: "a.webp", rating: "", src: "/api/media/a", assetId: "a", role: "hero" as const },
    { slot: "Photo 2", file: "b.webp", rating: "", src: "/api/media/b", assetId: "b", role: "gallery" as const },
    { slot: "Photo 3", file: "c.webp", rating: "", src: "/api/media/c", assetId: "c", role: "gallery" as const },
  ];
  const next = photosWithoutAssets(photos, ["a", "b"]);
  assert.equal(next.length, 3);
  assert.equal(next[0].assetId, "c");
  assert.equal(next[1].src, "");
});

test("detailsWithoutAssets clears socialImage when it points at a deleted asset", () => {
  const details = detailsWithoutAssets({
    socialImage: "/api/media/social",
    photos: [{ slot: "Photo 1 · Hero", file: "", rating: "", src: "/api/media/social", assetId: "social" }],
  } as any, ["social"]);
  assert.equal(details.socialImage, "");
  assert.equal(details.photos[0].src, "");
});

test("homepageWithoutAssets falls back to the default hero when the last library slide is removed", () => {
  const homepage = homepageWithoutAssets(withHomepageDefaults({
    heroImages: [{ src: "/api/media/one", assetId: "one" }],
    heroSlideshow: false,
  }), ["one"]);
  assert.equal(homepage.heroImageAssetId, null);
  assert.equal(homepage.heroImageSrc, DEFAULT_HOMEPAGE_HERO_IMAGE);
});

test("aboutWithoutAssets falls back to the default About hero", () => {
  const about = aboutWithoutAssets(withAboutDefaults({
    heroImageSrc: "/api/media/about",
    heroImageAssetId: "about",
  }), ["about"]);
  assert.equal(about.heroImageAssetId, null);
  assert.equal(about.heroImageSrc, DEFAULT_ABOUT_HERO_IMAGE);
});

test("seedGuideWithoutAssets falls back to the default card image", () => {
  const seedGuide = seedGuideWithoutAssets(withSeedGuideDefaults({
    cardImageSrc: "/api/media/guide",
    cardImageAssetId: "guide",
  }), ["guide"]);
  assert.equal(seedGuide.cardImageAssetId, null);
  assert.equal(seedGuide.cardImageSrc, DEFAULT_SEED_GUIDE_CARD_IMAGE);
});
