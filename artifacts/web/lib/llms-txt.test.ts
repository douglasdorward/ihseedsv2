import assert from "node:assert/strict";
import test from "node:test";
import type { CatalogueCategory, CatalogueProduct } from "./catalogue";
import { buildLlmsTxt } from "./llms-txt";
import { PASTURE_SELECTOR_FAQS } from "./pasture-selector-faqs";

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

test("llms.txt names the site, the pasture FAQs, and only complete indexable FAQs", () => {
  const text = buildLlmsTxt({
    products: [
      product({
        details: {
          canonicalUrl: "/products/ryegrass/safeguard-annual-ryegrass",
          faqs: [
            { question: "  When do I sow it?  ", answer: "  On the break.  " },
            { question: "Missing answer" },
            { question: "", answer: "Missing question" },
          ],
        },
      }),
      product({
        id: 2,
        name: "Hidden ryegrass",
        slug: "hidden-ryegrass",
        details: {
          robotsIndex: false,
          faqs: [{ question: "Should this be listed?", answer: "No." }],
        },
      }),
      product({
        id: 3,
        name: "No FAQ ryegrass",
        slug: "no-faq",
        details: { faqs: [{ question: "Only a question" }] },
      }),
    ],
    categories: [
      {
        ...root,
        faqs: [
          { question: "What is annual ryegrass?", answer: "A one-season grass." },
          { question: "Blank", answer: "   " },
        ],
      },
      { ...root, id: 2, parentId: 1, slug: "annual", name: "Annual", faqs: [{ question: "Child?", answer: "No." }] },
      { ...root, id: 3, slug: "clovers", name: "Clovers", faqs: [] },
      { ...root, id: 4, slug: "other", name: "Other", active: false, productCount: 2, faqs: [{ question: "Inactive?", answer: "No." }] },
    ],
  });

  assert.match(text, /^# IH Seeds\n/);
  assert.match(text, /^> Western Australian pasture seed merchant/m);
  assert.match(text, /## Start here\n\n- \[Home\]\(https:\/\/www\.irwinhunter\.com\.au\/\)/);
  assert.match(text, /- \[Ryegrass\]\(https:\/\/www\.irwinhunter\.com\.au\/products\/ryegrass\)\n/);
  assert.match(text, /- \[Clovers\]\(https:\/\/www\.irwinhunter\.com\.au\/products\/clovers\)\n/);
  assert.equal(text.includes("/products/clovers#faqs"), false);
  assert.equal(text.includes("/products/annual"), false);
  assert.equal(text.includes("/products/other"), false);
  assert.match(
    text,
    /- \[Pasture selector\]\(https:\/\/www\.irwinhunter\.com\.au\/pasture-selector#faqs\): How do I know which pasture seed suits my paddock\?/,
  );
  assert.equal(text.includes(PASTURE_SELECTOR_FAQS[0].answer), false);
  assert.match(
    text,
    /- \[Ryegrass\]\(https:\/\/www\.irwinhunter\.com\.au\/products\/ryegrass#faqs\): What is annual ryegrass\?/,
  );
  assert.equal(text.includes("Blank"), false);
  assert.equal(text.includes("Child?"), false);
  assert.match(
    text,
    /- \[Safeguard\]\(https:\/\/www\.irwinhunter\.com\.au\/products\/ryegrass\/safeguard-annual-ryegrass#faqs\): When do I sow it\?/,
  );
  assert.equal(text.includes("Missing answer"), false);
  assert.equal(text.includes("Should this be listed?"), false);
  assert.equal(text.includes("Only a question"), false);
  assert.equal(text.includes("No FAQ ryegrass"), false);
  assert.equal(text.includes("On the break."), false);
});
