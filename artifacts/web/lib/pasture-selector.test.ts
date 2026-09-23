import assert from "node:assert/strict";
import test from "node:test";
import type { CatalogueCategory, CatalogueProduct } from "./catalogue.ts";
import { EMPTY_FILTERS, filtersFromSearchParams } from "./product-filters.ts";
import {
  END_USE_GAP,
  MILD_TOLERANCE,
  PERSISTENCE_GAP,
  RAINFALL_GAP,
  SOIL_GAP,
  selectPastureProducts,
  selectorEnquiryPrefill,
} from "./pasture-selector.ts";

const categories: CatalogueCategory[] = [
  category({ id: 3, slug: "clovers", name: "Clovers" }),
  category({ id: 5, parentId: null, slug: "serradella", name: "Serradellas & Medics" }),
  category({ id: 34, parentId: 3, slug: "subterranean", name: "Subterranean" }),
  category({ id: 43, parentId: 5, slug: "serradella", name: "Serradella" }),
  category({ id: 45, parentId: 5, slug: "other-legume", name: "Other legume" }),
  category({ id: 2, slug: "ryegrass", name: "Ryegrasses" }),
  category({ id: 20, parentId: 2, slug: "annual-tetraploid", name: "Annual tetraploid" }),
  category({ id: 1, slug: "mixes", name: "Mixes" }),
  category({ id: 9, slug: "biologicals", name: "Biologicals" }),
];

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

function product(
  name: string,
  details: CatalogueProduct["details"],
  overrides: Partial<CatalogueProduct> = {},
): CatalogueProduct {
  return {
    id: name.length,
    name,
    slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    price: "",
    packSize: "",
    status: "in-stock",
    note: "",
    category: "Clovers",
    ...overrides,
    details: { tagline: "", ...details },
  };
}

function names(cards: { product: CatalogueProduct }[]) {
  return cards.map((card) => card.product.name);
}

test("a blank field keeps the product in may also suit and a known miss removes it", () => {
  const filters = filtersFromSearchParams(new URLSearchParams("rainfall=450&soil=S&endUse=Grazing&persistence=lasting"));
  const groups = selectPastureProducts([
    product("Fits", {
      rainfallMinMm: 400,
      soilRangeLightest: "S",
      soilRangeHeaviest: "H",
      endUse: ["Grazing"],
      persistencyType: "Perennial",
      sowingRates: [{ context: "General", min: 8, max: 12, unit: "kg/ha" }],
    }),
    product("Too dry", {
      rainfallMinMm: 600,
      soilRangeLightest: "S",
      soilRangeHeaviest: "L",
      endUse: ["Grazing"],
      persistencyType: "Perennial",
    }),
    product("Rainfall blank", {
      soilRangeLightest: "S",
      soilRangeHeaviest: "L",
      endUse: ["Grazing"],
      persistencyType: "Perennial",
    }),
    product("Soil blank", {
      rainfallMinMm: 350,
      endUse: ["Grazing"],
      persistencyType: "Perennial",
    }),
    product("Wrong soil", {
      rainfallMinMm: 350,
      soilRangeLightest: "H",
      soilRangeHeaviest: "H",
      endUse: ["Grazing"],
      persistencyType: "Perennial",
    }),
    product("Use blank", {
      rainfallMinMm: 350,
      soilRangeLightest: "S",
      soilRangeHeaviest: "L",
      persistencyType: "Perennial",
    }),
    product("Wrong use", {
      rainfallMinMm: 350,
      soilRangeLightest: "S",
      soilRangeHeaviest: "L",
      endUse: ["Hay"],
      persistencyType: "Perennial",
    }),
    product("Stand life blank", {
      rainfallMinMm: 350,
      soilRangeLightest: "S",
      soilRangeHeaviest: "L",
      endUse: ["Grazing"],
    }),
    product("Annual instead", {
      rainfallMinMm: 350,
      soilRangeLightest: "S",
      soilRangeHeaviest: "L",
      endUse: ["Grazing"],
      persistencyType: "Annual",
    }, { category: "Ryegrasses", subcategoryId: 20 }),
    product("Fails rain and soil is blank", {
      rainfallMinMm: 700,
      endUse: ["Grazing"],
      persistencyType: "Perennial",
    }),
  ], categories, filters);

  assert.deepEqual(names(groups.varieties), ["Fits"]);
  assert.equal(groups.varieties[0]?.why, "Suits 400 mm+, sand to clay, grazing, perennial");
  assert.equal(groups.varieties[0]?.sowingRate, "8–12 kg/ha");
  assert.deepEqual(names(groups.maybe), ["Rainfall blank", "Soil blank", "Stand life blank", "Use blank"]);
  assert.ok(groups.maybe.find((card) => card.product.name === "Rainfall blank")?.badges.some((badge) => badge.label === RAINFALL_GAP));
  assert.ok(groups.maybe.find((card) => card.product.name === "Soil blank")?.badges.some((badge) => badge.label === SOIL_GAP));
  assert.ok(groups.maybe.find((card) => card.product.name === "Use blank")?.badges.some((badge) => badge.label === END_USE_GAP));
  assert.ok(groups.maybe.find((card) => card.product.name === "Stand life blank")?.badges.some((badge) => badge.label === PERSISTENCE_GAP));
  assert.equal(names([...groups.mixes, ...groups.varieties, ...groups.maybe]).includes("Too dry"), false);
  assert.equal(names([...groups.mixes, ...groups.varieties, ...groups.maybe]).includes("Wrong soil"), false);
  assert.equal(names([...groups.mixes, ...groups.varieties, ...groups.maybe]).includes("Wrong use"), false);
  assert.equal(names([...groups.mixes, ...groups.varieties, ...groups.maybe]).includes("Annual instead"), false);
  assert.equal(names([...groups.mixes, ...groups.varieties, ...groups.maybe]).includes("Fails rain and soil is blank"), false);
});

test("tolerance and livestock promote matches and never remove the rest", () => {
  const filters = {
    ...EMPTY_FILTERS,
    rainfall: 450,
    tolerance: ["Waterlogging", "Low pH"],
    livestock: ["Equine"],
  };
  const groups = selectPastureProducts([
    product("Plain", { rainfallMinMm: 300, endUse: ["Grazing"] }),
    product("Wet mild", {
      rainfallMinMm: 400,
      tolerance: [{ name: "Waterlogging", mild: true }],
    }),
    product("Wet and horses", {
      rainfallMinMm: 350,
      tolerance: [{ name: "Waterlogging", mild: false }],
      livestock: ["Equine"],
    }),
    product("Acid by pH", { rainfallMinMm: 300, soilPhMin: 4.5 }),
    product("Not acid enough", { rainfallMinMm: 300, soilPhMin: 5.2 }),
  ], categories, filters);

  assert.deepEqual(names(groups.varieties), ["Wet and horses", "Acid by pH", "Wet mild", "Not acid enough", "Plain"]);
  const wet = groups.varieties.find((card) => card.product.name === "Wet and horses");
  assert.ok(wet?.badges.some((badge) => badge.label === "Suits wet ground"));
  const mild = groups.varieties.find((card) => card.product.name === "Wet mild");
  assert.ok(mild?.badges.some((badge) => badge.label === MILD_TOLERANCE));
  assert.equal(mild?.badges.some((badge) => badge.label === "Suits wet ground"), false);
  assert.ok(groups.varieties.find((card) => card.product.name === "Acid by pH")?.badges.some((badge) => badge.label === "Suits acid soil"));
  assert.equal(groups.varieties.find((card) => card.product.name === "Not acid enough")?.badges.some((badge) => badge.tone === "good"), false);
});

test("self-regenerating uses the subcategory, and mixes stay in their own group without a stand life", () => {
  const filters = { ...EMPTY_FILTERS, persistence: "self-regenerating" as const, rainfall: 450 };
  const groups = selectPastureProducts([
    product("Dalkeith", { rainfallMinMm: 350, persistencyType: "Annual" }, { subcategoryId: 34 }),
    product("Rye", { rainfallMinMm: 450, persistencyType: "Annual" }, { category: "Ryegrasses", subcategoryId: 20 }),
    product("Unknown clover", { rainfallMinMm: 400 }, { subcategoryId: 45 }),
    product("Blank sub", { rainfallMinMm: 400 }),
    product("Self Regeneration Mix", { rainfallMinMm: 350, recordType: "Mix" }, { category: "Mixes", subcategoryId: 1 }),
    product("SouWest Pasture Mix", { rainfallMinMm: 400, recordType: "Mix" }, { category: "Mixes" }),
    product("BioNPK", { rainfallMinMm: 0 }, { category: "Biologicals" }),
  ], categories, filters);

  assert.deepEqual(names(groups.varieties), ["Dalkeith"]);
  assert.equal(groups.varieties[0]?.why.includes("self-regenerating"), true);
  assert.deepEqual(names(groups.mixes), ["Self Regeneration Mix", "SouWest Pasture Mix"]);
  assert.equal(groups.mixes[0]?.persistenceRank, 1);
  assert.ok(groups.mixes[1]?.badges.some((badge) => badge.label === PERSISTENCE_GAP));
  assert.deepEqual(names(groups.maybe), ["Blank sub", "Unknown clover"]);
  assert.equal(names([...groups.mixes, ...groups.varieties, ...groups.maybe]).includes("Rye"), false);
  assert.equal(names([...groups.mixes, ...groups.varieties, ...groups.maybe]).includes("BioNPK"), false);
});

test("enquiry prefill uses the selector answers and ignores a normal contact visit", () => {
  assert.equal(selectorEnquiryPrefill(new URLSearchParams()), null);
  const prefill = selectorEnquiryPrefill(new URLSearchParams(
    "from=pasture-selector&rainfall=450&soil=S&soil=H&tolerance=Waterlogging&endUse=Grazing&livestock=Equine&persistence=lasting",
  ));
  assert.ok(prefill);
  assert.equal(prefill?.topic, "A sowing rate or mix recommendation");
  assert.equal(prefill?.soil, "Mixed / not sure");
  assert.equal(prefill?.rainfall, "450–550 mm");
  assert.match(prefill?.message ?? "", /Sand over loam \/ sandy/);
  assert.match(prefill?.message ?? "", /Horses/);
  assert.match(prefill?.message ?? "", /Several years/);
  assert.equal(filtersFromSearchParams(new URLSearchParams("persistence=perennial")).persistence, "lasting");
});
