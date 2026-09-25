import assert from "node:assert/strict";
import test from "node:test";
import type { CatalogueArticle, CatalogueCategory, CatalogueProduct, CatalogueResellerBrand } from "./catalogue";
import { buildLlmsFullTxt, buildLlmsTxt, type LlmsInput, type LlmsSettings } from "./llms-txt";
import { PASTURE_SELECTOR_FAQS } from "./pasture-selector-faqs";

const ryegrass: CatalogueCategory = {
  id: 2,
  parentId: null,
  slug: "ryegrass",
  name: "Ryegrass",
  groupLabel: "",
  lead: "Annual and perennial ryegrass.",
  image: "",
  sortOrder: 2,
  active: true,
  pageHeading: "",
  seoTitle: "",
  seoDescription: "",
  productCount: 1,
};

const clovers: CatalogueCategory = {
  ...ryegrass,
  id: 1,
  slug: "clovers",
  name: "Clovers",
  lead: "Annual clovers for WA.",
  sortOrder: 1,
  faqs: [
    { question: "What is hard seed?", answer: "Seed that stays dormant." },
    { question: "Blank", answer: "   " },
  ],
};

function product(overrides: Omit<Partial<CatalogueProduct>, "details"> & {
  details?: Partial<CatalogueProduct["details"]>;
} = {}): CatalogueProduct {
  return {
    id: 1,
    name: "Safeguard",
    slug: "safeguard",
    price: "$18.00",
    packSize: "",
    status: "in-stock",
    note: "",
    category: "Ryegrass",
    ...overrides,
    details: { tagline: "A tough annual ryegrass.", ...overrides.details },
  };
}

function article(overrides: Partial<CatalogueArticle> = {}): CatalogueArticle {
  return {
    id: 1,
    slug: "autumn-sowing",
    title: "Autumn sowing",
    excerpt: "Sow on the break.",
    body: "<p>Secret HTML body</p>",
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
    updatedAt: "",
    ...overrides,
  };
}

function settings(overrides: Partial<LlmsSettings["company"]> = {}, aboutBody = "We list {productCount}."): LlmsSettings {
  return {
    company: {
      legalName: "Irwin Hunter & Co",
      tradingName: "IH Seeds",
      phone: "(08) 9383 4708",
      email: "sales@irwinhunter.com.au",
      address: "Unit 5, 75 Robinson Avenue, Belmont, WA 6104",
      officeHours: "Monday to Friday, 8am–5pm AWST",
      abn: "",
      ...overrides,
    },
    homepage: { aboutBody },
    seedGuide: { pageTitle: "2026 Pasture Seed Guide", pdfPublicUrl: "/guide.pdf" },
  };
}

function input(overrides: Partial<LlmsInput> = {}): LlmsInput {
  return {
    products: [],
    categories: [clovers, ryegrass],
    articles: [],
    settings: settings(),
    ...overrides,
  };
}

const elders: CatalogueResellerBrand = {
  id: 1,
  name: "Elders",
  kind: "elders",
  website: "",
  logoSrc: "",
  logoAssetId: null,
  outlets: [{ id: 1, name: "Belmont", address: "", suburb: "", postcode: "", region: "", phone: "", email: "", mapsUrl: "", latitude: null, longitude: null }],
};

test("business block uses settings, expands the product count, and skips blank contact fields", () => {
  const text = buildLlmsTxt(input({
    products: [product(), product({ id: 2, name: "Second", slug: "second", category: "Clovers" })],
    settings: settings({ phone: "", abn: "" }),
    resellers: [elders, { ...elders, id: 2, name: "Local", kind: "independent", outlets: [] }],
  }));
  assert.match(text, /^# Irwin Hunter & Co \(IH Seeds\)\n/);
  assert.match(text, /based in Belmont, WA/);
  assert.match(text, /We list 2\+ varieties and mixes/);
  assert.equal(text.includes("Phone"), false);
  assert.equal(text.includes("ABN"), false);
  assert.match(text, /Email sales@irwinhunter.com.au/);
  assert.match(text, /Elders \(1 outlets\) and 1 independent stores/);
  assert.match(text, /2026 Pasture Seed Guide \(PDF\)/);
});

test("products are grouped by public category, with canonical URLs and soil when pH is missing", () => {
  const text = buildLlmsTxt(input({
    products: [
      product({
        name: "Crimson Clover",
        slug: "crimson-clover",
        category: "Clovers",
        saleLines: [{ stockCode: "CAP-441", priceDisplay: "Contact for pricing" }],
        details: {
          tagline: "Attractive crimson flowers and highly palatable",
          botanicalName: "Trifolium incarnatum",
          persistencyType: "Annual",
          rainfallMinMm: 500,
          soilRangeLightest: "S",
          soilRangeHeaviest: "H",
          endUse: ["Grazing", "Hay"],
          sowingRates: [{ min: 10, max: null, unit: "kg/ha", context: "Monoculture" }],
          canonicalUrl: "/products/clovers/crimson-clover",
          faqs: [{ question: "When?", answer: "On the break." }, { question: "Missing answer" }],
        },
      }),
      product({
        id: 2,
        name: "Hidden ryegrass",
        slug: "hidden",
        details: { robotsIndex: false, tagline: "Do not list" },
      }),
      product({
        id: 3,
        name: "Orphan",
        slug: "orphan",
        category: "Retired",
        details: { tagline: "Still public." },
      }),
      product({
        id: 4,
        name: "Bare",
        slug: "bare",
        category: "Clovers",
        details: { tagline: "Just a tagline" },
      }),
      product({ id: 5, name: "Safeguard", slug: "safeguard", details: { tagline: "Rye." } }),
    ],
    categories: [
      clovers,
      ryegrass,
      { ...ryegrass, id: 9, slug: "retired", name: "Retired", active: false, productCount: 1 },
    ],
    articles: [
      article({ publishedAt: "2026-01-01T00:00:00.000Z", title: "Older", slug: "older", excerpt: "First." }),
      article({ id: 2, publishedAt: "2026-09-18T00:00:00.000Z", title: "Newer", slug: "newer", excerpt: "Second." }),
      article({ id: 3, slug: "private", title: "Private", robotsIndex: false, excerpt: "Hidden article." }),
    ],
  }));

  const cloverHeading = text.indexOf("### Clovers");
  const ryeHeading = text.indexOf("### Ryegrass");
  const otherHeading = text.indexOf("### Other");
  assert.ok(cloverHeading >= 0 && cloverHeading < ryeHeading && ryeHeading < otherHeading);
  assert.match(text, /Annual clovers for WA\./);
  assert.match(
    text,
    /- \[Crimson Clover\]\(https:\/\/www\.irwinhunter\.com\.au\/products\/clovers\/crimson-clover\): Trifolium incarnatum\. Attractive crimson flowers and highly palatable\. Annual · 500 mm\+ rainfall · Sand to Heavy · Grazing, Hay · Sowing rate 10 kg\/ha Monoculture/,
  );
  assert.match(text, /- \[Bare\]\(https:\/\/www\.irwinhunter\.com\.au\/products\/clovers\/bare\): Just a tagline\./);
  assert.equal(text.includes(" · \n"), false);
  assert.equal(/Just a tagline\. ·/.test(text), false);
  assert.match(text, /### Other\n\n- \[Orphan\]/);
  assert.equal(text.includes("Hidden ryegrass"), false);
  assert.equal(text.includes("Do not list"), false);
  assert.equal(text.includes("Private"), false);
  assert.equal(text.includes("Hidden article"), false);
  assert.equal(text.includes("CAP-441"), false);
  assert.equal(text.includes("Contact for pricing"), false);
  assert.equal(text.includes("$18.00"), false);
  const newer = text.indexOf("/resources/newer");
  const older = text.indexOf("/resources/older");
  assert.ok(newer >= 0 && newer < older);
  assert.match(text, /\/resources\/newer\): Second\./);
  assert.match(text, /Clovers\]\(https:\/\/www\.irwinhunter\.com\.au\/products\/clovers#faqs\): 1 question/);
  assert.equal(text.includes("Blank"), false);
  assert.match(text, new RegExp(`Pasture selector.*${PASTURE_SELECTOR_FAQS.length} questions`));
});

test("the full file includes FAQ answers and quick facts, and omits prices and stock codes", () => {
  const full = buildLlmsFullTxt(input({
    products: [
      product({
        name: "Crimson Clover",
        slug: "crimson-clover",
        category: "Clovers",
        price: "$18.00",
        saleLines: [{ stockCode: "CAP-441", priceDisplay: "Contact for pricing" }],
        details: {
          tagline: "Attractive crimson flowers.",
          blurb: "A grazing clover.",
          botanicalName: "Trifolium incarnatum",
          persistencyType: "Annual",
          rainfallMinMm: 500,
          keyAttributes: ["Palatable"],
          description: "Grows quickly.",
          grazingManagementNotes: "Graze lightly.",
          components: [{ speciesName: "Crimson", inclusionRate: 10, unit: "kg/ha", description: "The clover." }],
          faqs: [{ question: "When?", answer: "On the break." }, { question: "No answer" }],
          canonicalUrl: "/products/clovers/crimson-clover",
        },
      }),
      product({ id: 2, name: "Hidden", slug: "hidden", details: { robotsIndex: false, tagline: "Secret" } }),
    ],
    articles: [article({ body: "<p>Do not print the HTML body</p>" })],
  }));
  assert.match(full, /#### When\?\n\nOn the break\./);
  assert.match(full, /#### What is hard seed\?\n\nSeed that stays dormant\./);
  assert.match(full, /- Type & persistency: Annual/);
  assert.match(full, /- Min rainfall: 500 mm\+/);
  assert.match(full, /\*\*Key attributes\*\*\n\n- Palatable/);
  assert.match(full, /- Crimson 10 kg\/ha: The clover\./);
  assert.match(full, /Graze lightly\./);
  assert.match(full, /2026-09-01/);
  assert.equal(full.includes("No answer"), false);
  assert.equal(full.includes("Secret"), false);
  assert.equal(full.includes("CAP-441"), false);
  assert.equal(full.includes("Contact for pricing"), false);
  assert.equal(full.includes("$18.00"), false);
  assert.equal(full.includes("Do not print the HTML body"), false);
  assert.equal(full.includes("stockCode"), false);
});
