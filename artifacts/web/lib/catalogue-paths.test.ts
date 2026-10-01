import assert from "node:assert/strict";
import test from "node:test";
import type { CatalogueCategory } from "./catalogue";
import { allNavCategories, featuredNavCategories } from "./catalogue-paths.ts";

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
