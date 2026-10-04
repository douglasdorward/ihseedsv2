import assert from "node:assert/strict";
import test from "node:test";
import type { CatalogueCategory } from "./catalogue";
import {
  activeSubcategories,
  allNavCategories,
  featuredNavCategories,
  findSubcategory,
  isSubcategoryIndexable,
  subcategoryForProduct,
  subcategoryPublicPath,
} from "./catalogue-paths.ts";

function category(overrides: Partial<CatalogueCategory> & Pick<CatalogueCategory, "id" | "slug" | "name">): CatalogueCategory {
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
    ...overrides,
  };
}

test("allNavCategories lists every active root category with products, in catalogue order", () => {
  const categories = [
    category({ id: 3, slug: "clovers", name: "Clovers", sortOrder: 2, productCount: 4 }),
    category({ id: 11, slug: "other", name: "Other Products", sortOrder: 10, active: false, productCount: 2 }),
    category({ id: 1, slug: "mixes", name: "Mixes", sortOrder: 0, productCount: 6 }),
    category({ id: 62, slug: "sadza", name: "Sadza", sortOrder: 0, productCount: 0 }),
    category({ id: 34, parentId: 3, slug: "subterranean", name: "Subterranean", sortOrder: 1, productCount: 3 }),
    category({ id: 9, slug: "biologicals", name: "Biologicals", sortOrder: 8, productCount: 1 }),
  ];

  assert.deepEqual(allNavCategories(categories), [
    { name: "Mixes", slug: "mixes" },
    { name: "Clovers", slug: "clovers" },
    { name: "Biologicals", slug: "biologicals" },
  ]);
});

test("featuredNavCategories lists Mixes, Ryegrasses, Clovers, Serradellas, Forage, then Subtropical", () => {
  const categories = [
    category({ id: 8, slug: "biologicals", name: "Biologicals", sortOrder: 1, productCount: 20 }),
    category({ id: 7, slug: "sub-tropical-grasses", name: "Sub-Tropical Grasses", sortOrder: 2, productCount: 3 }),
    category({ id: 4, slug: "fescues-other-grasses", name: "Fescues & Other Grasses", sortOrder: 3, productCount: 18 }),
    category({ id: 9, slug: "forage-grain-crops", name: "Forage & Grain Crops", sortOrder: 4, productCount: 8 }),
    category({ id: 5, slug: "serradella", name: "Serradellas & Medics", sortOrder: 5, productCount: 12 }),
    category({ id: 3, slug: "clovers", name: "Clovers", sortOrder: 6, productCount: 15 }),
    category({ id: 2, slug: "ryegrass", name: "Ryegrasses", sortOrder: 7, productCount: 9 }),
    category({ id: 1, slug: "mixes", name: "Mixes", sortOrder: 8, productCount: 2 }),
  ];

  assert.deepEqual(featuredNavCategories(categories), [
    { name: "Mixes", slug: "mixes" },
    { name: "Ryegrasses", slug: "ryegrass" },
    { name: "Clovers", slug: "clovers" },
    { name: "Serradellas & Medics", slug: "serradella" },
    { name: "Forage & Grain Crops", slug: "forage-grain-crops" },
    { name: "Sub-Tropical Grasses", slug: "sub-tropical-grasses" },
  ]);
});

const subTree = [
  category({ id: 3, slug: "clovers", name: "Clovers", productCount: 5 }),
  category({ id: 4, slug: "ryegrass", name: "Ryegrass", productCount: 5 }),
  category({ id: 30, parentId: 3, slug: "annual", name: "Annual", sortOrder: 2, productCount: 3 }),
  category({ id: 31, parentId: 3, slug: "perennial", name: "Perennial", sortOrder: 1, productCount: 2 }),
  category({ id: 32, parentId: 3, slug: "retired", name: "Retired", active: false }),
  category({ id: 40, parentId: 4, slug: "annual", name: "Annual", productCount: 1 }),
];

test("a sub-category page is found by root slug and sub slug together", () => {
  const found = findSubcategory(subTree, "clovers", "annual");
  assert.equal(found?.sub.id, 30);
  assert.equal(found?.root.id, 3);
  assert.equal(findSubcategory(subTree, "ryegrass", "annual")?.sub.id, 40);
  assert.equal(findSubcategory(subTree, "clovers", "retired"), null);
  assert.equal(findSubcategory(subTree, "clovers", "safeguard-annual-ryegrass"), null);
  assert.equal(findSubcategory(subTree, "mixes", "annual"), null);
  assert.equal(subcategoryPublicPath({ slug: "clovers" }, { slug: "annual" }), "/products/clovers/annual");
});

test("activeSubcategories lists only active children in admin order", () => {
  assert.deepEqual(activeSubcategories(subTree, 3).map((item) => item.slug), ["perennial", "annual"]);
});

test("a product's sub-category resolves to its active child and root", () => {
  assert.equal(subcategoryForProduct({ subcategoryId: 31, category: "Clovers" }, subTree)?.sub.slug, "perennial");
  assert.equal(subcategoryForProduct({ subcategoryId: 31, category: "Clovers" }, subTree)?.root.slug, "clovers");
  assert.equal(subcategoryForProduct({ subcategoryId: 32, category: "Clovers" }, subTree), null);
  assert.equal(subcategoryForProduct({ subcategoryId: 3, category: "Clovers" }, subTree), null);
  assert.equal(subcategoryForProduct({ subcategoryId: null, category: "Clovers" }, subTree), null);
});

test("only active sub-categories with products are indexable", () => {
  assert.equal(isSubcategoryIndexable({ active: true, productCount: 1 }), true);
  assert.equal(isSubcategoryIndexable({ active: true, productCount: 0 }), false);
  assert.equal(isSubcategoryIndexable({ active: true }), false);
  assert.equal(isSubcategoryIndexable({ active: false, productCount: 4 }), false);
});
