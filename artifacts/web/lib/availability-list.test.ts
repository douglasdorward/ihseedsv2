import assert from "node:assert/strict";
import test from "node:test";
import type { CatalogueCategory, CatalogueProduct } from "./catalogue";
import { listAvailability } from "./availability-list";

function product(partial: Partial<CatalogueProduct> & Pick<CatalogueProduct, "id" | "name" | "category">): CatalogueProduct {
  return {
    slug: partial.name.toLowerCase().replace(/\s+/g, "-"),
    price: "",
    packSize: "",
    status: "in-stock",
    note: "",
    ...partial,
    details: { tagline: "", ...partial.details },
  };
}

function category(partial: Partial<CatalogueCategory> & Pick<CatalogueCategory, "id" | "name" | "slug" | "sortOrder">): CatalogueCategory {
  return {
    parentId: null,
    groupLabel: "",
    lead: "",
    image: "",
    active: true,
    pageHeading: "",
    seoTitle: "",
    seoDescription: "",
    ...partial,
  };
}

const categories = [
  category({ id: 2, name: "Clovers", slug: "clovers", sortOrder: 2 }),
  category({ id: 1, name: "Ryegrasses", slug: "ryegrasses", sortOrder: 1 }),
  category({ id: 3, name: "Retired", slug: "retired", sortOrder: 0, active: false }),
  category({ id: 4, name: "Annual", slug: "annual", sortOrder: 1, parentId: 1 }),
];

const products = [
  product({ id: 1, name: "Zulu", category: "Ryegrasses", details: { tagline: "Late heading" } }),
  product({ id: 2, name: "Arrow", category: "Ryegrasses", details: { tagline: "Early vigour" } }),
  product({ id: 3, name: "Balansa", category: "Clovers", details: { tagline: "Hard seed" } }),
  product({ id: 4, name: "Legacy line", category: "Retired", details: { tagline: "Old stock" } }),
];

test("groups products under active root categories in catalogue order", () => {
  const sections = listAvailability({ products, categories, view: "category", query: "" });
  assert.deepEqual(sections.map((section) => ({
    name: section.heading?.name,
    href: section.heading?.href,
    products: section.products.map((item) => item.name),
  })), [
    { name: "Ryegrasses", href: "/products/ryegrasses", products: ["Arrow", "Zulu"] },
    { name: "Clovers", href: "/products/clovers", products: ["Balansa"] },
    { name: "Other", href: null, products: ["Legacy line"] },
  ]);
});

test("search matches name or tagline and drops empty groups", () => {
  const sections = listAvailability({ products, categories, view: "category", query: "  LATE  " });
  assert.deepEqual(sections.map((section) => section.products.map((item) => item.name)), [["Zulu"]]);
  assert.equal(sections[0]?.heading?.name, "Ryegrasses");
});

test("alphabetical view is one flat list with no headings", () => {
  const sections = listAvailability({ products, categories, view: "alpha", query: "" });
  assert.equal(sections.length, 1);
  assert.equal(sections[0]?.heading, null);
  assert.deepEqual(sections[0]?.products.map((item) => item.name), ["Arrow", "Balansa", "Legacy line", "Zulu"]);
});

test("an empty search match returns no sections", () => {
  assert.deepEqual(listAvailability({ products, categories, view: "category", query: "sorghum" }), []);
  assert.deepEqual(listAvailability({ products, categories, view: "alpha", query: "sorghum" }), []);
});
