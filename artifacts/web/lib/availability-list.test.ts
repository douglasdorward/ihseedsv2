import assert from "node:assert/strict";
import test from "node:test";
import type { CatalogueCategory, CatalogueProduct } from "./catalogue";
import { listAvailability } from "./availability-list.ts";

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

test("mixes follow the commercial lineup and other categories stay alphabetical", () => {
  const mixCategories = [
    ...categories,
    category({ id: 5, name: "Mixes", slug: "mixes", sortOrder: 0 }),
  ];
  const mixes = [
    product({ id: 20, name: "WA Northern Perennial Pasture Mix", category: "Mixes" }),
    product({ id: 21, name: "Green Manure Mix", category: "Mixes" }),
    product({ id: 22, name: "NITRO MIX", category: "Mixes" }),
    product({ id: 23, name: "Gentle Graze Pasture Mix", category: "Mixes" }),
    product({ id: 24, name: "Mix & Match Custom Pasture Blends", category: "Mixes" }),
    product({ id: 25, name: "Western Annual Mix", category: "Mixes" }),
    product({ id: 26, name: "MaxiMix Pasture Mix", category: "Mixes" }),
    product({ id: 27, name: "Cover Crop Plus Summer Mix", category: "Mixes" }),
    product({ id: 28, name: "SouWest Pasture Mix", category: "Mixes" }),
    product({ id: 29, name: "Silahay Pasture Mix™", category: "Mixes" }),
    product({ id: 30, name: "Self Regeneration Mix", category: "Mixes" }),
    product({ id: 31, name: "Equi1st Pasture Mix", category: "Mixes" }),
    product({ id: 32, name: "Cover Crop Plus Winter Mix", category: "Mixes" }),
    product({ id: 33, name: "Interow Mix", category: "Mixes" }),
    product({ id: 34, name: "IH Dairy Select Mix", category: "Mixes" }),
    product({ id: 35, name: "Irrigation Mix", category: "Mixes" }),
    product({ id: 36, name: "WA Southern Perennial Pasture Mix", category: "Mixes" }),
  ];
  const sections = listAvailability({
    products: [...products, ...mixes],
    categories: mixCategories,
    view: "category",
    query: "",
  });
  const mixesSection = sections.find((section) => section.heading?.name === "Mixes");
  assert.deepEqual(mixesSection?.products.map((item) => item.name), [
    "Mix & Match Custom Pasture Blends",
    "SouWest Pasture Mix",
    "Silahay Pasture Mix™",
    "Self Regeneration Mix",
    "MaxiMix Pasture Mix",
    "Equi1st Pasture Mix",
    "Western Annual Mix",
    "Cover Crop Plus Winter Mix",
    "Cover Crop Plus Summer Mix",
    "NITRO MIX",
    "Interow Mix",
    "IH Dairy Select Mix",
    "Irrigation Mix",
    "Green Manure Mix",
    "Gentle Graze Pasture Mix",
    "WA Northern Perennial Pasture Mix",
    "WA Southern Perennial Pasture Mix",
  ]);
  assert.deepEqual(
    sections.find((section) => section.heading?.name === "Ryegrasses")?.products.map((item) => item.name),
    ["Arrow", "Zulu"],
  );
});

test("local spellings of the same mixes keep the live lineup", () => {
  const mixCategories = [category({ id: 5, name: "Mixes", slug: "mixes", sortOrder: 0 })];
  const mixes = [
    product({ id: 1, name: "NITROMIX", category: "Mixes" }),
    product({ id: 2, name: "SouWest™ Pasture Mix", category: "Mixes" }),
    product({ id: 3, name: "Silahay Pasture Mix", category: "Mixes" }),
    product({ id: 4, name: "MaxiMix Pasture Mix", category: "Mixes" }),
  ];
  const sections = listAvailability({ products: mixes, categories: mixCategories, view: "category", query: "" });
  assert.deepEqual(sections[0]?.products.map((item) => item.name), [
    "SouWest™ Pasture Mix",
    "Silahay Pasture Mix",
    "MaxiMix Pasture Mix",
    "NITROMIX",
  ]);
});

test("alphabetical view keeps mixes in name order", () => {
  const mixCategories = [
    category({ id: 5, name: "Mixes", slug: "mixes", sortOrder: 0 }),
  ];
  const mixes = [
    product({ id: 21, name: "SouWest Pasture Mix", category: "Mixes" }),
    product({ id: 22, name: "Equi1st Pasture Mix", category: "Mixes" }),
  ];
  const sections = listAvailability({ products: mixes, categories: mixCategories, view: "alpha", query: "" });
  assert.deepEqual(sections[0]?.products.map((item) => item.name), ["Equi1st Pasture Mix", "SouWest Pasture Mix"]);
});

test("an empty search match returns no sections", () => {
  assert.deepEqual(listAvailability({ products, categories, view: "category", query: "sorghum" }), []);
  assert.deepEqual(listAvailability({ products, categories, view: "alpha", query: "sorghum" }), []);
});
