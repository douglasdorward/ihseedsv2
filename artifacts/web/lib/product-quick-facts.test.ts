import assert from "node:assert/strict";
import test from "node:test";
import type { CatalogueProduct } from "./catalogue";
import { formatSoilAndPh, formatSoilPh, formatSoilRange, getProductQuickFacts } from "./product-quick-facts";

test("public formatter expands distinct soil endpoints", () => {
  assert.equal(formatSoilAndPh({
    soilRangeLightest: "LS",
    soilRangeHeaviest: "L",
    soilPhMin: 5.5,
    soilPhScale: "water",
  }), "Soil range: Light sand to Loam · pH 5.5+ (water)");
});

test("public formatter shows an equal endpoint once", () => {
  assert.equal(formatSoilAndPh({
    soilRangeLightest: "H",
    soilRangeHeaviest: "H",
    soilPhMin: 5,
    soilPhScale: "CaCl₂",
  }), "Soil range: Heavy · pH 5+ (CaCl₂)");
});

test("soil range and pH format on their own", () => {
  assert.equal(formatSoilRange({ soilRangeLightest: "LS", soilRangeHeaviest: "L" }), "Light sand to Loam");
  assert.equal(formatSoilRange({ soilRangeLightest: "H", soilRangeHeaviest: "H" }), "Heavy");
  assert.equal(formatSoilRange({ soilRangeLightest: "S" }), null);
  assert.equal(formatSoilPh({ soilPhMin: 4.5, soilPhScale: "CaCl₂" }), "pH 4.5+ (CaCl₂)");
  assert.equal(formatSoilPh({ soilPhMin: 4.5 }), null);
});

test("carbon credit is the last overview row, and only when flagged", () => {
  const product = {
    category: "Ryegrasses",
    details: { tagline: "", persistencyType: "Annual", rainfallMinMm: 450 },
  } as CatalogueProduct;
  assert.equal(getProductQuickFacts(product).some((fact) => fact.icon === "carbon"), false);
  const facts = getProductQuickFacts({ ...product, details: { ...product.details, carbonCreditEligible: true } });
  const fact = facts.at(-1);
  assert.equal(facts[0]?.label, "Type & persistency");
  assert.equal(fact?.label, "Carbon credit");
  assert.equal(fact?.value, "Eligible");
  assert.equal(fact?.icon, "carbon");
});

test("public formatter omits incomplete values", () => {
  assert.equal(formatSoilAndPh({
    soilRangeLightest: "S",
    soilRangeHeaviest: "H",
    soilPhMin: null,
    soilPhScale: "CaCl₂",
  }), null);
});