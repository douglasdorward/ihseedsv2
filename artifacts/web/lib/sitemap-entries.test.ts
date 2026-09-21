import assert from "node:assert/strict";
import test from "node:test";
import type { CatalogueArticle, CatalogueCategory, CatalogueProduct } from "./catalogue";
import { buildPublicSitemap } from "./sitemap-entries";

const root: CatalogueCategory = {
  id: 1,
  parentId: null,
  slug: "ryegrass",
  name: "Ryegrass",
  groupLabel: "",
  lead: "",
  image: "",
  sortOrder: 1,
  active: true,
  pageHeading: "",
  seoTitle: "",
  seoDescription: "",
  productCount: 1,
};

function lastmod(entry: { lastModified?: string | Date }) {
  return entry.lastModified instanceof Date
    ? entry.lastModified.toISOString()
    : entry.lastModified;
}

function product(overrides: Omit<Partial<CatalogueProduct>, "details"> & {
  details?: Partial<CatalogueProduct["details"]>;
} = {}): CatalogueProduct {
  return {
    id: 1,
    name: "Safeguard",
    slug: "safeguard-annual-ryegrass",
    price: "",
    packSize: "",
    status: "in-stock",
    note: "",
    category: "Ryegrass",
    ...overrides,
    details: { tagline: "", ...overrides.details },
  };
}

test("public sitemap uses the product page canonical and article lastmod", () => {
  const article: CatalogueArticle = {
    id: 9,
    slug: "autumn-sowing",
    title: "Autumn sowing",
    excerpt: "",
    body: "",
    tags: [],
    heroImageSrc: "",
    relatedProductSlugs: [],
    publishedAt: "2026-09-01T00:00:00.000Z",
    seoTitle: "",
    seoDescription: "",
    socialTitle: "",
    socialDescription: "",
    socialImage: "",
    robotsIndex: true,
    updatedAt: "2026-09-18T04:00:00.000Z",
  };
  const entries = buildPublicSitemap({
    products: [
      product({ details: { canonicalUrl: "/products/ryegrass/safeguard-annual-ryegrass" } }),
      product({ id: 2, slug: "hidden-ryegrass", details: { robotsIndex: false } }),
    ],
    categories: [root, { ...root, id: 2, parentId: 1, slug: "annual", name: "Annual", productCount: 1 }],
    articles: [article, { ...article, id: 10, slug: "private-note", robotsIndex: false }],
    productDates: [{ slug: "safeguard-annual-ryegrass", lastModified: "2026-09-17T12:00:00.000Z" }],
  });
  const urls = entries.map((entry) => entry.url);
  assert.equal(urls.includes("https://www.irwinhunter.com.au/privacy"), true);
  assert.equal(urls.includes("https://www.irwinhunter.com.au/terms-and-conditions"), true);
  assert.equal(urls.includes("https://www.irwinhunter.com.au/products/ryegrass"), true);
  assert.equal(urls.includes("https://www.irwinhunter.com.au/products/ryegrass/annual"), false);
  assert.equal(urls.includes("https://www.irwinhunter.com.au/products/ryegrass/hidden-ryegrass"), false);
  assert.equal(urls.includes("https://www.irwinhunter.com.au/resources/private-note"), false);
  const productEntry = entries.find((entry) => entry.url.endsWith("/products/ryegrass/safeguard-annual-ryegrass"));
  assert.ok(productEntry);
  assert.equal(lastmod(productEntry), "2026-09-17T12:00:00.000Z");
  const articleEntry = entries.find((entry) => entry.url.endsWith("/resources/autumn-sowing"));
  assert.ok(articleEntry);
  assert.equal(lastmod(articleEntry), "2026-09-18T04:00:00.000Z");
});
