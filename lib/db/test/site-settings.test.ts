import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_ABOUT_HERO_IMAGE, DEFAULT_HOMEPAGE_HERO_IMAGE, withAboutDefaults, withCompanyDefaults, withHomepageDefaults } from "../src/schema/site-settings.ts";

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

test("withHomepageDefaults fills the About Us blurb when it is missing", () => {
  const homepage = withHomepageDefaults({
    heroHeading: "Pasture Seed Specialists",
  });
  assert.match(homepage.aboutBody, /Irwin Hunter/);
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
