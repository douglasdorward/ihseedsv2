import assert from "node:assert/strict";
import test from "node:test";
import { socialMetadata, siteSocialMetadata } from "./social-metadata";

const apex = "https://irwinhunter.com.au";

test("page-specific titles, descriptions and URLs survive nested OG/Twitter overrides", () => {
  const metadata = socialMetadata("Ryegrass | IH Seeds", "A ryegrass description", "/products/ryegrass", {
    override: "/api/media/product-share",
    hero: "/api/media/hero",
    siteImage: "/site-image.jpg",
  });
  assert.equal(metadata.openGraph?.title, "Ryegrass | IH Seeds");
  assert.equal(metadata.openGraph?.description, "A ryegrass description");
  assert.equal(metadata.openGraph?.url, `${apex}/products/ryegrass`);
  assert.deepEqual(metadata.openGraph?.images, [{ url: `${apex}/api/media/product-share`, alt: "Ryegrass | IH Seeds" }]);
  assert.equal(metadata.twitter?.title, "Ryegrass | IH Seeds");
  assert.deepEqual(metadata.twitter?.images, [`${apex}/api/media/product-share`]);
  assert.equal(metadata.twitter?.card, "summary_large_image");
});

test("product and article precedence is override, hero, site asset, then bundled default", () => {
  const hero = socialMetadata("Article", "Description", "/articles/story", {
    override: "javascript:alert(1)",
    hero: "/article-hero.jpg",
    siteAssetId: "site-asset",
    type: "article",
  });
  assert.deepEqual(hero.twitter?.images, [`${apex}/article-hero.jpg`]);
  assert.equal(hero.openGraph?.type, "article");
  const site = socialMetadata("Product", "Description", "/products/product", { siteAssetId: "site-asset" });
  assert.deepEqual(site.twitter?.images, [`${apex}/api/media/site-asset`]);
  const fallback = socialMetadata("Contact", "Contact details", "/contact");
  assert.deepEqual(fallback.twitter?.images, [`${apex}/social-share-default.jpg`]);
});

test("global pages read the configured homepage sharing asset at request time", async (t) => {
  const previousBase = process.env.API_BASE;
  process.env.API_BASE = "http://catalogue.test";
  t.after(() => {
    if (previousBase === undefined) delete process.env.API_BASE;
    else process.env.API_BASE = previousBase;
  });
  t.mock.method(globalThis, "fetch", async (url) => {
    assert.equal(url, "http://catalogue.test/api/site-settings");
    return Response.json({ homepage: { socialImageSrc: "/site.jpg", socialImageAssetId: "brand-share" } });
  });
  const metadata = await siteSocialMetadata("About IH Seeds", "Our story", "/about");
  assert.equal(metadata.openGraph?.url, `${apex}/about`);
  assert.equal(metadata.openGraph?.description, "Our story");
  assert.deepEqual(metadata.twitter?.images, [`${apex}/api/media/brand-share`]);
});

test("public route metadata keeps each page's own title and description in both social previews", async (t) => {
  const previousBase = process.env.API_BASE;
  process.env.API_BASE = "http://catalogue.test";
  t.after(() => {
    if (previousBase === undefined) delete process.env.API_BASE;
    else process.env.API_BASE = previousBase;
  });
  t.mock.method(globalThis, "fetch", async () => Response.json({ homepage: { socialImageSrc: "/configured-share.jpg" } }));
  const { generateMetadata: homepage } = await import("../app/page");
  const { generateMetadata: availability } = await import("../app/availability/page");
  const { generateMetadata: articles } = await import("../app/articles/page");
  const { generateMetadata: techSheets } = await import("../app/tech-sheets/page");
  const { generateMetadata: contact } = await import("../app/contact/page");
  for (const [metadata, path] of await Promise.all([
    homepage().then((value) => [value, "/"]),
    availability().then((value) => [value, "/availability"]),
    articles().then((value) => [value, "/articles"]),
    techSheets().then((value) => [value, "/tech-sheets"]),
    contact().then((value) => [value, "/contact"]),
  ] as const)) {
    assert.equal(metadata.openGraph?.title, metadata.title);
    assert.equal(metadata.twitter?.description, metadata.description);
    assert.equal(metadata.openGraph?.url, `${apex}${path}`);
    assert.deepEqual(metadata.twitter?.images, [`${apex}/configured-share.jpg`]);
  }
});

test("published article route falls back to its hero and retains article-specific share copy", async (t) => {
  const previousBase = process.env.API_BASE;
  process.env.API_BASE = "http://catalogue.test";
  t.after(() => {
    if (previousBase === undefined) delete process.env.API_BASE;
    else process.env.API_BASE = previousBase;
  });
  t.mock.method(globalThis, "fetch", async (url) => Response.json(
    String(url).includes("/api/articles/slug/")
      ? {
          slug: "soil-health",
          title: "Soil health",
          seoTitle: "Soil health | IH Seeds",
          seoDescription: "Improve your soil.",
          socialTitle: "Healthy soil, healthy pasture",
          socialDescription: "Read our soil tips.",
          socialImage: "",
          heroImageSrc: "/api/media/article-hero",
          publishedAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-02T00:00:00Z",
        }
      : { homepage: { socialImageSrc: "/configured-share.jpg" } },
  ));
  const { generateMetadata } = await import("../app/articles/[slug]/page");
  const metadata = await generateMetadata({ params: Promise.resolve({ slug: "soil-health" }) });
  assert.equal(metadata.title, "Soil health | IH Seeds");
  assert.equal(metadata.description, "Improve your soil.");
  assert.equal(metadata.openGraph?.title, "Healthy soil, healthy pasture");
  assert.equal(metadata.openGraph?.description, "Read our soil tips.");
  assert.equal(metadata.openGraph?.url, `${apex}/articles/soil-health`);
  assert.deepEqual(metadata.twitter?.images, [`${apex}/api/media/article-hero`]);
  assert.equal(metadata.openGraph?.type, "article");
});