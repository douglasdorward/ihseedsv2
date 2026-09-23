import assert from "node:assert/strict";
import test from "node:test";
import type { CatalogueArticle, CatalogueCategory, CatalogueProduct } from "./catalogue";
import { buildSearchDocuments, searchDocuments, type SearchTextPart } from "./site-search";

function visibleText(parts: SearchTextPart[] | undefined) {
  return (parts ?? []).map((part) => part.text).join("");
}

function matchedText(parts: SearchTextPart[] | undefined) {
  return (parts ?? []).filter((part) => part.match).map((part) => part.text);
}

function product(partial: Partial<CatalogueProduct> & Pick<CatalogueProduct, "id" | "name" | "slug">): CatalogueProduct {
  return {
    price: "",
    packSize: "",
    status: "in-stock",
    note: "",
    category: "Ryegrasses",
    ...partial,
    details: { tagline: "", ...partial.details },
  };
}

function category(partial: Partial<CatalogueCategory> & Pick<CatalogueCategory, "id" | "name" | "slug">): CatalogueCategory {
  return {
    parentId: null,
    groupLabel: "",
    lead: "",
    image: "",
    sortOrder: 0,
    active: true,
    pageHeading: "",
    seoTitle: "",
    seoDescription: "",
    ...partial,
  };
}

function article(partial: Partial<CatalogueArticle> & Pick<CatalogueArticle, "id" | "title" | "slug">): CatalogueArticle {
  return {
    excerpt: "",
    body: "",
    tags: [],
    heroImageSrc: "",
    relatedProductSlugs: [],
    publishedAt: "",
    seoTitle: "",
    seoDescription: "",
    socialTitle: "",
    socialDescription: "",
    socialImage: "",
    robotsIndex: true,
    updatedAt: "",
    ...partial,
  };
}

function documents(input: {
  products?: CatalogueProduct[];
  categories?: CatalogueCategory[];
  articles?: CatalogueArticle[];
}) {
  return buildSearchDocuments({
    products: input.products ?? [],
    categories: input.categories ?? [],
    articles: input.articles ?? [],
  });
}

test("exact product name ranks above the same phrase in body text", () => {
  const hits = searchDocuments("Holdfast GT", documents({
    products: [
      product({ id: 1, name: "Holdfast GT", slug: "holdfast-gt", category: "Ryegrasses" }),
      product({
        id: 2,
        name: "Valley mix",
        slug: "valley-mix",
        category: "Ryegrasses",
        details: { tagline: "", description: "Holdfast GT is one component of this mix." },
      }),
    ],
    categories: [category({ id: 9, name: "Ryegrasses", slug: "ryegrasses", lead: "Grasses for pasture." })],
  }));
  assert.equal(hits[0]?.id, "product:1");
  assert.equal(hits[0]?.href, "/products/ryegrasses/holdfast-gt");
  assert.equal(hits[0]?.kind, "product");
  assert.equal(hits[1]?.id, "product:2");
  assert.deepEqual(matchedText(hits[0]?.title), ["Holdfast", "GT"]);
  assert.deepEqual(matchedText(hits[1]?.title), []);
  assert.deepEqual(matchedText(hits[1]?.snippet), ["Holdfast", "GT"]);
});

test("a one-edit typo matches a longer product word", () => {
  const hits = searchDocuments("ryegras", documents({
    products: [
      product({
        id: 3,
        name: "Perennial ryegrass",
        slug: "perennial-ryegrass",
        details: { tagline: "A temperate grass" },
      }),
    ],
  }));
  assert.deepEqual(hits.map((hit) => hit.id), ["product:3"]);
  assert.deepEqual(matchedText(hits[0]?.title), ["ryegrass"]);
});

test("a partial product name matches, including one wrong letter", () => {
  const products = [
    product({ id: 20, name: "Achieve", slug: "achieve", category: "Ryegrasses" }),
    product({ id: 21, name: "Abundant", slug: "abundant", category: "Ryegrasses" }),
    product({
      id: 22,
      name: "Alpha 1 Lucerne",
      slug: "alpha-1-lucerne",
      category: "Lucerne",
      details: { tagline: "Winter active lucerne with a high leaf to stem ratio" },
    }),
  ];
  const prefix = searchDocuments("achi", documents({ products }));
  assert.deepEqual(prefix.map((hit) => hit.id), ["product:20"]);
  assert.deepEqual(matchedText(prefix[0]?.title), ["Achi"]);
  assert.equal(visibleText(prefix[0]?.title), "Achieve");

  const typo = searchDocuments("abunl", documents({ products }));
  assert.deepEqual(typo.map((hit) => hit.id), ["product:21"]);
  assert.deepEqual(matchedText(typo[0]?.title), ["Abund"]);
  assert.equal(visibleText(typo[0]?.title), "Abundant");
});

test("a phrase that exists only in a product FAQ finds that product", () => {
  const hits = searchDocuments("waterlogging in winter", documents({
    products: [
      product({
        id: 4,
        name: "Summit",
        slug: "summit",
        details: {
          tagline: "",
          faqs: [{ question: "Can it handle waterlogging in winter?", answer: "Yes, on drained paddocks." }],
        },
      }),
    ],
  }));
  assert.equal(hits[0]?.id, "product:4");
  assert.match(visibleText(hits[0]?.snippet), /waterlogging in winter/);
  assert.deepEqual(matchedText(hits[0]?.snippet), ["waterlogging", "in", "winter"]);
  assert.equal(hits[0]?.href, "/products/ryegrasses/summit");
});

test("a product FAQ question outranks the same phrase in another product description", () => {
  const hits = searchDocuments("waterlogging in winter", documents({
    products: [
      product({
        id: 5,
        name: "Valley",
        slug: "valley",
        details: { tagline: "", description: "Waterlogging in winter is common on this soil." },
      }),
      product({
        id: 4,
        name: "Summit",
        slug: "summit",
        details: {
          tagline: "",
          faqs: [{ question: "Can it handle waterlogging in winter?", answer: "Yes." }],
        },
      }),
    ],
  }));
  assert.deepEqual(hits.map((hit) => hit.id), ["product:4", "product:5"]);
});

test("a phrase that exists only in a category FAQ finds that category", () => {
  const hits = searchDocuments("hard seed level", documents({
    categories: [
      category({
        id: 7,
        name: "Clovers",
        slug: "clovers",
        faqs: [{ question: "What is hard seed level?", answer: "Seed that stays dormant after sowing." }],
      }),
    ],
    products: [product({ id: 8, name: "Balansa", slug: "balansa", category: "Clovers" })],
  }));
  assert.deepEqual(hits.map((hit) => hit.id), ["category:7"]);
  assert.equal(hits[0]?.kind, "category");
  assert.equal(hits[0]?.href, "/products/clovers");
});

test("a word inside article markdown matches the article", () => {
  const hits = searchDocuments("subterranean", documents({
    articles: [
      article({
        id: 11,
        title: "Autumn sowing notes",
        slug: "autumn-sowing-notes",
        body: "Grow **subterranean** clover before the break.",
        seoTitle: "unrelated-seo-title-token",
      }),
    ],
  }));
  assert.deepEqual(hits.map((hit) => hit.id), ["article:11"]);
  assert.equal(hits[0]?.href, "/resources/autumn-sowing-notes");
  assert.match(visibleText(hits[0]?.snippet), /subterranean/);
  assert.deepEqual(matchedText(hits[0]?.snippet), ["subterranean"]);
});

test("article snippets decode html entities", () => {
  const hits = searchDocuments("choice", documents({
    articles: [
      article({
        id: 13,
        title: "Pasture notes",
        slug: "pasture-notes",
        body: "A farmer&#8217;s choice &amp; a reliable mix.",
      }),
    ],
  }));
  assert.match(visibleText(hits[0]?.snippet), /farmer\u2019s choice & a reliable mix/i);
  assert.deepEqual(matchedText(hits[0]?.snippet), ["choice"]);
});

test("markdown and html markers are not searchable words", () => {
  const hits = searchDocuments("em", documents({
    articles: [
      article({
        id: 12,
        title: "Clover notes",
        slug: "clover-notes",
        body: "<em>clover</em>",
      }),
    ],
  }));
  assert.deepEqual(hits, []);
});

test("a three-letter query does not fuzzy-match a longer word", () => {
  const hits = searchDocuments("rye", documents({
    products: [
      product({
        id: 3,
        name: "Perennial ryegrass",
        slug: "perennial-ryegrass",
        details: { tagline: "" },
      }),
    ],
  }));
  assert.deepEqual(hits, []);
});

test("an empty query returns no hits", () => {
  const indexed = documents({
    products: [product({ id: 1, name: "Holdfast GT", slug: "holdfast-gt" })],
  });
  assert.deepEqual(searchDocuments("   ", indexed), []);
  assert.deepEqual(searchDocuments("", indexed), []);
});

test("categories without a lead or FAQs are omitted, along with inactive and child categories", () => {
  const hits = searchDocuments("clovers", documents({
    categories: [
      category({ id: 1, name: "Clovers", slug: "clovers" }),
      category({ id: 2, name: "Clovers hidden", slug: "clovers-hidden", active: false, lead: "Hidden clovers lead." }),
      category({ id: 3, name: "Clovers child", slug: "clovers-child", parentId: 1, lead: "Child clovers lead." }),
    ],
  }));
  assert.deepEqual(hits, []);
});

test("search results stop at twenty hits", () => {
  const hits = searchDocuments("pasture", documents({
    products: Array.from({ length: 25 }, (_item, index) => product({
      id: index + 1,
      name: `Pasture mix ${index + 1}`,
      slug: `pasture-mix-${index + 1}`,
    })),
  }));
  assert.equal(hits.length, 20);
});
