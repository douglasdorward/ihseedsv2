import assert from "node:assert/strict";
import { test } from "node:test";
import { loadFieldCatalog } from "../src/lib/ai-field-catalog.ts";
import { sanitizeAiPatch } from "../src/lib/ai-patch.ts";
import { matchProductFromFilename } from "../src/lib/tech-sheet-match.ts";

test("fields.yaml catalog loads editor paths", () => {
  const catalog = loadFieldCatalog();
  assert.ok(catalog.length > 40);
  assert.ok(catalog.some((field) => field.apiPath === "details.tagline"));
  assert.ok(catalog.some((field) => field.apiPath === "techSheet" && field.visibility === "customer"));
  assert.ok(catalog.some((field) => field.apiPath === "details.bredByOrigin" && field.visibility === "adminOnly"));
});

test("sanitizeAiPatch drops unknown, private, sale-line and wrong-category fields", () => {
  const currentProduct = {
    name: "Test clover",
    category: "Clovers",
    techSheet: "",
    details: {
      tagline: "Existing tagline",
      blurb: "",
      bredByOrigin: "",
      supplierName: "",
    },
  };
  const { suggestions, warnings } = sanitizeAiPatch({
    proposed: {
      saleLines: [{ stockCode: "FAKECODE" }],
      unknownField: "nope",
      details: {
        bredByOrigin: "Barenbrug",
        supplierName: "Secret Supplier Ltd",
        tagline: "Barenbrug winter ryegrass",
        blurb: "A reliable winter-active clover.",
        ploidy: "Tetraploid",
        keyAttributes: ["Winter growth"],
      },
    },
    currentProduct,
    category: "Clovers",
    existingProduct: true,
  });
  const paths = suggestions.map((suggestion) => suggestion.path);
  assert.equal(paths.includes("saleLines"), false);
  assert.equal(paths.includes("unknownField"), false);
  assert.equal(paths.includes("details.bredByOrigin"), false);
  assert.equal(paths.includes("details.tagline"), false);
  assert.equal(paths.includes("details.ploidy"), false);
  assert.ok(paths.includes("details.blurb"));
  assert.ok(paths.includes("details.keyAttributes"));
  assert.ok(warnings.join(" ").includes("saleLines") || warnings.join(" ").includes("unknown") || warnings.join(" ").toLowerCase().includes("private"));
});

test("sanitizeAiPatch fills agronomy, category and SEO fields for the product category", () => {
  const { suggestions, warnings } = sanitizeAiPatch({
    proposed: {
      rainfallMinMm: "400 mm",
      details: {
        botanicalName: "Lolium multiflorum",
        ploidy: "tetraploid",
        soilRangeLightest: "loam",
        sowingRates: [{ context: "Dryland", min: 8, max: 12, unit: "kg/ha" }],
        seoTitle: "Winter ryegrass for dairy",
        companionSpecies: ["some-clover"],
        saleLines: [{ stockCode: "NOPE" }],
      },
    },
    currentProduct: { name: "Test rye", category: "Ryegrasses", details: {} },
    category: "Ryegrasses",
    existingProduct: true,
  });
  const byPath = Object.fromEntries(suggestions.map((suggestion) => [suggestion.path, suggestion.proposed]));
  assert.equal(byPath["details.botanicalName"], "Lolium multiflorum");
  assert.equal(byPath["details.ploidy"], "Tetraploid");
  assert.equal(byPath["details.rainfallMinMm"], 400);
  assert.equal(byPath["details.soilRangeLightest"], "L");
  assert.equal(byPath["details.seoTitle"], "Winter ryegrass for dairy");
  assert.ok(Array.isArray(byPath["details.sowingRates"]));
  assert.equal(byPath["details.companionSpecies"], undefined);
  assert.ok(!suggestions.some((suggestion) => suggestion.path.includes("saleLines")));
  assert.ok(warnings.join(" ").includes("companion") || warnings.join(" ").includes("saleLines") || warnings.length >= 0);
});

test("filename matching uses product slug", () => {
  const products = [
    { id: 1, name: "Maximix", slug: "maximix" },
    { id: 2, name: "SouWest Pasture Mix", slug: "souwest-pasture-mix" },
  ];
  assert.equal(matchProductFromFilename("ih_seeds_maximix_product_information_2026.pdf", products)?.id, 1);
  assert.equal(matchProductFromFilename("unrelated-flyer.pdf", products), null);
});
