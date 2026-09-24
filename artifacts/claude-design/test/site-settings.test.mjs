import assert from "node:assert/strict";
import test from "node:test";
import { aboutHeroDisplaySrc, aboutStorySlots, expandProductCount, homepageHeroImages, resolveBestSellers, withHomepageHeroImages } from "../src/site-settings.ts";

test("expandProductCount replaces the live variety token", () => {
  assert.equal(
    expandProductCount("We blend {productCount} for the state.", 120),
    "We blend 120+ varieties and mixes for the state.",
  );
  assert.equal(
    expandProductCount("We blend {productCount} for the state.", 0),
    "We blend improved pasture seed for the state.",
  );
});

test("resolveBestSellers keeps chosen published slugs and fills empty slots", () => {
  const products = [
    { slug: "alpha" },
    { slug: "bravo" },
    { slug: "charlie" },
    { slug: "delta" },
    { slug: "echo" },
  ];
  assert.deepEqual(
    resolveBestSellers(["bravo", "missing", "echo"], products).map((item) => item.slug),
    ["bravo", "echo", "alpha", "charlie"],
  );
  assert.deepEqual(
    resolveBestSellers([], products).map((item) => item.slug),
    ["alpha", "bravo", "charlie", "delta"],
  );
});

test("homepageHeroImages falls back to the canonical hero fields", () => {
  assert.deepEqual(
    homepageHeroImages({
      heroImageSrc: "https://example.com/hero.jpg",
      heroImageAssetId: "asset-1",
      heroImages: [],
    }),
    [{ src: "https://example.com/hero.jpg", assetId: "asset-1" }],
  );
});

test("withHomepageHeroImages keeps extras when slideshow is off and disables it for one photo", () => {
  const homepage = {
    heroImageSrc: "https://example.com/one.jpg",
    heroImageAssetId: "one",
    heroImages: [{ src: "https://example.com/one.jpg", assetId: "one" }],
    heroSlideshow: true,
    heroEyebrow: "",
    heroHeading: "",
    heroBody: "",
    aboutBody: "",
    bestSellerSlugs: [],
  };
  const two = withHomepageHeroImages(homepage, [
    { src: "https://example.com/one.jpg", assetId: "one" },
    { src: "https://example.com/two.jpg", assetId: "two" },
  ], false);
  assert.equal(two.heroSlideshow, false);
  assert.equal(two.heroImages.length, 2);
  const one = withHomepageHeroImages(two, [two.heroImages[0]], true);
  assert.equal(one.heroSlideshow, false);
  assert.equal(one.heroImageSrc, "https://example.com/one.jpg");
});

test("aboutStorySlots pads the About page story to four editable paragraphs", () => {
  assert.deepEqual(aboutStorySlots(["One paragraph"]), ["One paragraph", "", "", ""]);
  assert.equal(aboutStorySlots(["a", "b", "c", "d", "e"]).length, 4);
});

test("aboutHeroDisplaySrc uses the admin preview path for uploaded assets", () => {
  assert.equal(aboutHeroDisplaySrc({ src: "/api/media/asset-1", assetId: "asset-1" }, true), "/api/admin/media/asset-1/preview");
  assert.match(aboutHeroDisplaySrc({ src: "", assetId: null }), /unsplash/);
});
