import assert from "node:assert/strict";
import test from "node:test";
import { buildCategoryComparison, summariseCategoryProducts } from "./category-summary";
import type { ListingProduct } from "./product-listing";

function product(id: number, name: string, details: ListingProduct["details"]): ListingProduct {
  return { id, name, slug: name.toLowerCase(), status: "Available", category: "Ryegrasses", packSize: "", details } as ListingProduct;
}

const products = [
  product(1, "Alpha", {
    tagline: "",
    persistencyType: "Annual",
    rainfallMinMm: 450,
    soilRangeLightest: "S",
    soilRangeHeaviest: "L",
    soilPhMin: 5,
    soilPhScale: "CaCl₂",
    sowingRates: [{ min: 15, max: 25, unit: "kg/ha" }],
    tolerance: [{ name: "Waterlogging" }],
    endUse: ["Grazing", "Hay"],
    livestock: ["Sheep"],
    ploidy: "Diploid",
    headingDate: "Early",
  }),
  product(2, "Beta", {
    tagline: "",
    persistencyType: "Perennial",
    rainfallMinMm: 700,
    soilRangeLightest: "L",
    soilRangeHeaviest: "H",
    soilPhMin: 4.5,
    soilPhScale: "CaCl₂",
    sowingRates: [{ min: 20, max: 30, unit: "kg/ha" }],
    tolerance: [{ name: "Waterlogging" }, { name: "Frost", mild: true }],
    endUse: ["Grazing"],
    livestock: ["Dairy", "Sheep"],
    ploidy: "Tetraploid",
    headingDate: "Late",
  }),
];

test("summary aggregates ranges across products", () => {
  const summary = summariseCategoryProducts(products, "Ryegrasses");
  const byLabel = Object.fromEntries(summary.facts.map((fact) => [fact.label, fact.value]));
  assert.equal(summary.productCount, 2);
  assert.equal(byLabel["Type & persistency"], "Annual, Perennial");
  assert.equal(byLabel.Rainfall, "450–700 mm+ annual rainfall, depending on variety");
  assert.equal(byLabel["Soil range"], "Sand to Heavy");
  assert.equal(byLabel["Soil pH"], "pH 4.5+ (CaCl₂)");
  assert.equal(byLabel["Sowing rate"], "15–30 kg/ha");
  assert.equal(byLabel.Tolerances, "Waterlogging (2), Frost (1)");
  assert.equal(byLabel["End use"], "Grazing (2), Hay (1)");
  assert.equal(byLabel.Livestock, "Sheep (2), Dairy (1)");
  assert.equal(byLabel.Ploidy, "Diploid, Tetraploid");
  assert.equal(byLabel["Heading date"], "Early, Late");
  assert.match(summary.sentence, /^Our ryegrasses range has 2 lines, covering annual and perennial types\./);
  assert.match(summary.sentence, /from 450 mm up to 700 mm or more/);
});

test("summary ignores missing data and falls back to stored rainfall", () => {
  const summary = summariseCategoryProducts([product(3, "Gamma", { tagline: "" })], "Mixes", { storedRainfall: "500–900+ mm" });
  assert.deepEqual(summary.facts, [{ label: "Rainfall", value: "500–900+ mm", icon: "cloud-rain" }]);
  const empty = summariseCategoryProducts([], "Mixes");
  assert.deepEqual(empty.facts, []);
  assert.equal(empty.sentence, "");
});

test("a single rainfall value is not shown as a range", () => {
  const summary = summariseCategoryProducts([products[0]], "Mixes");
  assert.equal(summary.facts.find((fact) => fact.label === "Rainfall")?.value, "450 mm+ annual rainfall");
});

test("comparison drops empty columns and sorts by name", () => {
  const comparison = buildCategoryComparison([products[1], products[0]], "Ryegrasses");
  assert.deepEqual(comparison.columns, ["Product", "Persistency", "Ploidy", "Heading date", "Min rainfall"]);
  assert.deepEqual(comparison.rows.map((row) => row.cells), [
    ["Annual", "Diploid", "Early", "450 mm+"],
    ["Perennial", "Tetraploid", "Late", "700 mm+"],
  ]);
  const generic = buildCategoryComparison(products, "Mixes");
  assert.deepEqual(generic.columns, ["Product", "Persistency", "Min rainfall", "Soil range", "Sowing rate"]);
});

test("a sub-category keeps its root's category-specific facts and columns but its own wording", () => {
  const clovers = [
    product(7, "Arrowleaf", { tagline: "", persistencyType: "Annual", rainfallMinMm: 450, maturityDays: 90, hardSeedLevel: "High" }),
    product(8, "Balansa", { tagline: "", persistencyType: "Annual", rainfallMinMm: 400, maturityDays: 110, hardSeedLevel: "Medium" }),
  ];
  const summary = summariseCategoryProducts(clovers, "Aerial-seeded annual Clovers", { rootName: "Clovers" });
  const byLabel = Object.fromEntries(summary.facts.map((fact) => [fact.label, fact.value]));
  assert.equal(byLabel["Days to flowering"], "90–110 days");
  assert.equal(byLabel["Hard seed level"], "High, Medium");
  assert.match(summary.sentence, /^Our aerial-seeded annual clovers range has 2 lines/);

  // Without the root name a sub-category name selects no category-specific facts.
  const plain = summariseCategoryProducts(clovers, "Aerial-seeded annual Clovers");
  assert.equal(plain.facts.some((fact) => fact.label === "Days to flowering"), false);

  const comparison = buildCategoryComparison(clovers, "Aerial-seeded annual Clovers", "Clovers");
  assert.deepEqual(comparison.columns, ["Product", "Persistency", "Days to flowering", "Hard seed", "Min rainfall"]);
});
