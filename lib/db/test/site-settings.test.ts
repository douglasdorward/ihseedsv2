import assert from "node:assert/strict";
import test from "node:test";
import { cleanSocialLinks, DEFAULT_ABOUT_HERO_IMAGE, DEFAULT_HOMEPAGE_HERO_IMAGE, normalizeSocialLink, siteCompanySettingsSchema, siteHomepageSettingsSchema, withAboutDefaults, withCompanyDefaults, withHomepageDefaults } from "../src/schema/site-settings.ts";

test("withHomepageDefaults seeds heroImages from a legacy single hero photo", () => {
  const homepage = withHomepageDefaults({
    heroImageSrc: "https://example.com/hero.jpg",
    heroImageAssetId: "asset-1",
    heroEyebrow: "Western Australia's",
    heroHeading: "Pasture Seed Specialists",
    heroBody: "Introduction",
    bestSellerSlugs: [],
  });
  assert.deepEqual(homepage.heroImages, [{ src: "https://example.com/hero.jpg", assetId: "asset-1" }]);
  assert.equal(homepage.heroImageSrc, "https://example.com/hero.jpg");
  assert.equal(homepage.heroImageAssetId, "asset-1");
  assert.equal(homepage.heroSlideshow, false);
});

test("withHomepageDefaults syncs the first slide back to the canonical hero fields", () => {
  const homepage = withHomepageDefaults({
    heroImageSrc: "https://example.com/old.jpg",
    heroImageAssetId: "old",
    heroImages: [
      { src: "https://example.com/one.jpg", assetId: "one" },
      { src: "https://example.com/two.jpg", assetId: "two" },
    ],
    heroSlideshow: true,
  });
  assert.equal(homepage.heroImageSrc, "https://example.com/one.jpg");
  assert.equal(homepage.heroImageAssetId, "one");
  assert.equal(homepage.heroSlideshow, true);
  assert.equal(homepage.heroImages.length, 2);
});

test("withHomepageDefaults disables slideshow when only one photo remains", () => {
  const homepage = withHomepageDefaults({
    heroImages: [{ src: DEFAULT_HOMEPAGE_HERO_IMAGE, assetId: null }],
    heroSlideshow: true,
  });
  assert.equal(homepage.heroSlideshow, false);
});

test("withHomepageDefaults keeps video slides with their poster and length, and leaves photos untouched", () => {
  const homepage = withHomepageDefaults({
    heroImages: [
      { src: "https://example.com/one.jpg", assetId: "one" },
      { src: "/api/site/hero-videos/abc.mp4", assetId: "ignored", kind: "video", posterSrc: "/api/site/hero-videos/abc.webp", durationSeconds: 12.4 },
      { src: "", assetId: null, kind: "video", posterSrc: "/api/site/hero-videos/missing.webp" },
    ],
    heroSlideshow: true,
  });
  assert.deepEqual(homepage.heroImages[0], { src: "https://example.com/one.jpg", assetId: "one" });
  assert.deepEqual(homepage.heroImages[1], {
    src: "/api/site/hero-videos/abc.mp4",
    assetId: null,
    kind: "video",
    posterSrc: "/api/site/hero-videos/abc.webp",
    durationSeconds: 12.4,
  });
  assert.equal(homepage.heroImages.length, 2, "a video slide without a src is dropped");
  assert.equal(homepage.heroSlideshow, true);
});

test("withHomepageDefaults clamps an out-of-range video length", () => {
  const homepage = withHomepageDefaults({
    heroImages: [{ src: "/api/site/hero-videos/abc.mp4", assetId: null, kind: "video", posterSrc: "", durationSeconds: 900 }],
  });
  assert.equal(homepage.heroImages[0].durationSeconds, 31);
});

test("withHomepageDefaults fills the About Us blurb when it is missing", () => {
  const homepage = withHomepageDefaults({
    heroHeading: "Pasture Seed Specialists",
  });
  assert.match(homepage.aboutBody, /Irwin Hunter/);
});

test("homepage social image defaults are blank, independent of the hero, and preserve an explicit override", () => {
  const old = withHomepageDefaults({ heroImageSrc: "https://example.com/hero.jpg", heroImageAssetId: null });
  assert.equal(old.socialImageSrc, "");
  assert.equal(old.socialImageAssetId, null);
  const override = withHomepageDefaults({
    ...old, socialImageSrc: "/api/media/share", socialImageAssetId: "share",
  });
  assert.equal(override.socialImageSrc, "/api/media/share");
  assert.equal(override.socialImageAssetId, "share");
  const reset = withHomepageDefaults({ ...override, socialImageSrc: "", socialImageAssetId: null });
  assert.equal(reset.socialImageSrc, "");
  assert.equal(reset.socialImageAssetId, null);
  assert.ok(siteHomepageSettingsSchema.safeParse({
    ...old, socialImageSrc: undefined, socialImageAssetId: undefined,
  }).success, "older editors may omit sharing fields");
});

test("withAboutDefaults fills missing About page copy and pads values", () => {
  const about = withAboutDefaults({
    heroHeading: "Family owned,",
    heroHeadingEmphasis: "since 1966",
    values: [{ title: "Regional expertise", body: "Edited value." }],
  });
  assert.equal(about.heroHeading, "Family owned,");
  assert.match(about.storyLead, /Every paddock in Western Australia is different/);
  assert.equal(about.storyParagraphs.length, 4);
  assert.equal(about.values.length, 3);
  assert.equal(about.values[0].body, "Edited value.");
  assert.equal(about.values[1].title, "Proven performance");
  assert.equal(about.heroImageSrc, DEFAULT_ABOUT_HERO_IMAGE);
});

test("withCompanyDefaults fills identity fields and keeps a blank phone", () => {
  const company = withCompanyDefaults({
    tradingName: "IH Seeds WA",
    phone: "",
    abn: "12 345 678 901",
  });
  assert.equal(company.tradingName, "IH Seeds WA");
  assert.equal(company.legalName, "Irwin Hunter & Co");
  assert.equal(company.phone, "");
  assert.equal(company.email, "info@irwinhunter.com.au");
  assert.equal(company.abn, "12 345 678 901");
});

test("social links accept bare or full addresses, upgrade http, and reject everything else", () => {
  assert.equal(normalizeSocialLink("facebook.com/ihseeds"), "https://facebook.com/ihseeds");
  assert.equal(normalizeSocialLink(" http://www.linkedin.com/company/ih-seeds#top "), "https://www.linkedin.com/company/ih-seeds");
  assert.equal(normalizeSocialLink(""), null);
  assert.equal(normalizeSocialLink("ftp://example.com/x"), null);
  assert.equal(normalizeSocialLink("javascript:alert(1)"), null);
  assert.equal(normalizeSocialLink("localhost"), null);
  assert.equal(normalizeSocialLink("https://user:pass@example.com/"), null);
  assert.deepEqual(cleanSocialLinks(["facebook.com/a", "", "https://facebook.com/a", "nope nope", 5]), ["https://facebook.com/a"]);
  assert.deepEqual(cleanSocialLinks(undefined), []);
});

test("company settings validate and clean social links, and legacy records default to none", () => {
  const base = { legalName: "A", tradingName: "B", phone: "", email: "", address: "", officeHours: "", abn: "" };
  const ok = siteCompanySettingsSchema.safeParse({ ...base, socialLinks: ["facebook.com/ihseeds", "", "https://facebook.com/ihseeds"] });
  assert.equal(ok.success, true);
  assert.deepEqual(ok.success && ok.data.socialLinks, ["https://facebook.com/ihseeds"]);
  assert.equal(siteCompanySettingsSchema.safeParse({ ...base, socialLinks: ["not a link"] }).success, false);
  assert.equal(siteCompanySettingsSchema.safeParse({ ...base, socialLinks: Array.from({ length: 11 }, (_, i) => `https://example.com/${i}`) }).success, false);
  assert.equal(siteCompanySettingsSchema.safeParse(base).success && siteCompanySettingsSchema.parse(base).socialLinks, undefined);
  assert.deepEqual(withCompanyDefaults({ legalName: "A" }).socialLinks, []);
});
