import assert from "node:assert/strict";
import test from "node:test";
import type { CatalogueProduct } from "../../lib/catalogue";
import { getFactChips, LISTING_FACT_CHIP_MAX_LENGTH, productImageAlt } from "./product-card-facts.ts";

function product(name: string, photos: CatalogueProduct["details"]["photos"]): CatalogueProduct {
  return {
    id: 1,
    name,
    slug: "holdfast-gt",
    price: "",
    packSize: "",
    status: "in-stock",
    note: "",
    category: "Lucerne",
    details: { tagline: "", photos },
  };
}

test("productImageAlt prefers stored photo alt then the product name", () => {
  assert.equal(productImageAlt(product("Holdfast GT", [{ src: "/api/media/1", alt: "Cattle grazing Holdfast GT" }])), "Cattle grazing Holdfast GT");
  assert.equal(productImageAlt(product("Holdfast GT", [{ src: "/api/media/1" }])), "Holdfast GT");
  assert.equal(productImageAlt(product("Holdfast GT", [])), "Holdfast GT");
});

test("listing fact chips keep short labels and omit paragraph-length values", () => {
  const biological = product("BioNPK Powder S", []);
  biological.category = "Biologicals";
  biological.packSize = "1 kg";
  biological.details.productForm = "Powder";
  biological.details.applicationRate = "Soil spray (all crop types): 0.25 kg/ha, sprayed before/at sowing or until inter-row cover, diluted in 100-400 L water/ha.";

  assert.ok(biological.details.applicationRate.length > LISTING_FACT_CHIP_MAX_LENGTH);
  assert.deepEqual(getFactChips(biological), ["Powder", "1 kg"]);

  biological.details.applicationRate = "0.25 kg/ha";
  assert.deepEqual(getFactChips(biological), ["Powder", "0.25 kg/ha", "1 kg"]);
});

test("forage listing chips fall back to rainfall, persistency and sowing rate", () => {
  const mustard = product("Black Mustard", []);
  mustard.category = "Forage & Grain Crops";
  mustard.details.rainfallMinMm = 400;
  mustard.details.persistencyType = "Annual";
  mustard.details.sowingRates = [{ min: 6, max: 10, unit: "kg/ha", context: "General" }];

  assert.deepEqual(getFactChips(mustard), ["400 mm+", "Annual", "6–10 kg/ha"]);

  const sorghum = product("Bounty Forage Sorghum", []);
  sorghum.category = "Forage & Grain Crops";
  sorghum.details.growingSeason = "Summer";
  sorghum.details.weeksToFirstGrazing = 5;
  sorghum.details.rainfallMinMm = 350;
  sorghum.details.persistencyType = "Annual";
  sorghum.details.sowingRates = [{ min: 15, max: 20, unit: "kg/ha" }];

  assert.deepEqual(getFactChips(sorghum, "Sorghum"), ["Summer crop", "Graze 5 wks", "Sorghum"]);
});

test("listing fact chips still show the longest short agronomy labels", () => {
  const fescue = product("Flecha Max P", []);
  fescue.category = "Fescues & Other Grasses";
  fescue.details.endophyte = "MaxP";
  fescue.details.growthSeason = "Winter-active / Mediterranean";
  fescue.details.rainfallMinMm = 450;

  assert.ok(fescue.details.growthSeason.length <= LISTING_FACT_CHIP_MAX_LENGTH);
  assert.deepEqual(getFactChips(fescue), ["MaxP endophyte", "Winter-active / Mediterranean", "450 mm+"]);
});
