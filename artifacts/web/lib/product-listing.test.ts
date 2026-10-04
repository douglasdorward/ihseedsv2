import assert from "node:assert/strict";
import test from "node:test";
import type { CatalogueCategory, CatalogueProduct } from "./catalogue";
import { toListingProduct } from "./product-listing.ts";
import { catalogueFilterOptions, EMPTY_FILTERS, productMatchesFilters } from "./product-filters.ts";
import { getFactChips, hasProductPhoto, productCardImage, productImageAlt } from "../app/products/product-card-facts.ts";

const CATEGORY_NAMES = [
  "Ryegrasses", "Clovers", "Serradellas & Medics", "Lucerne", "Fescues & Other Grasses",
  "Sub-Tropical Grasses", "Herbs", "Forage & Grain Crops", "Mixes", "Biologicals",
];

const categories = CATEGORY_NAMES.map((name, index) => ({
  id: index + 1, parentId: null, slug: name.toLowerCase().replace(/[^a-z]+/g, "-"), name, groupLabel: "Pasture",
  lead: "", image: "", sortOrder: index, active: true, pageHeading: "", seoTitle: "", seoDescription: "",
})) as CatalogueCategory[];

function fullProduct(category: string, index: number): CatalogueProduct {
  return {
    id: index + 1, name: `Product ${index}`, slug: `product-${index}`, price: "$10", packSize: "20 kg",
    status: "in-stock", note: "Note", category, subcategoryId: 7, techSheet: "sheet.pdf", listingState: "New",
    saleLines: [{ stockCode: "A1", priceDisplay: "$10" }, { seedForm: "Coated", stockCode: "A2", packKg: 20 }],
    details: {
      tagline: "Tagline", blurb: "Long blurb ".repeat(50), description: "Long description ".repeat(200),
      seoTitle: "SEO", seoDescription: "SEO description", faqs: [{ question: "Q", answer: "A" }],
      ploidy: "Tetraploid", headingDate: "Mid", rainfallMinMm: 350, maturityDays: 120, hardSeedLevel: "High",
      flowerColour: "White", maturityMeasure: "Winter activity rating", winterActivity: 7,
      sowingRates: [{ context: "Pasture", min: 10, max: 20, unit: "kg/ha" }, { context: "Turf", min: 30, max: 40, unit: "kg/ha" }],
      endophyte: "AR37", growthSeason: "Winter", persistencyType: "Perennial", growingSeason: "Summer",
      weeksToFirstGrazing: 6, floweringWindow: "Spring", productForm: "Liquid", applicationRate: "2 L/ha",
      soilRangeLightest: "S", soilRangeHeaviest: "C", soilPhMin: 5.5, soilPhScale: "CaCl2",
      tolerance: [{ name: "Waterlogging" }, { name: "Salinity", mild: true }],
      endUse: ["Grazing"], livestock: ["Sheep", "Cattle"],
      photos: [
        { slot: "Photo 1 · Hero", file: "", rating: "", src: "" },
        { slot: "Photo 2", file: "hero.webp", rating: "5", src: "/api/media/abc?x=1", alt: "Paddock", width: 1600, height: 900 },
        { slot: "Photo 3", src: "/api/media/def" },
      ],
    },
  };
}

const products = CATEGORY_NAMES.map(fullProduct);

test("listing records keep everything the cards, chips and filters show", () => {
  for (const product of products) {
    const listing = toListingProduct(product);
    assert.deepEqual(getFactChips(listing, "Sub"), getFactChips(product, "Sub"), product.category);
    assert.equal(hasProductPhoto(listing), hasProductPhoto(product));
    assert.equal(productCardImage(listing), productCardImage(product));
    assert.equal(productImageAlt(listing), productImageAlt(product));
  }
  const listings = products.map(toListingProduct);
  assert.deepEqual(catalogueFilterOptions(listings, categories), catalogueFilterOptions(products, categories));
  const filterCases = [
    EMPTY_FILTERS,
    { ...EMPTY_FILTERS, category: [categories[1].slug] },
    { ...EMPTY_FILTERS, livestock: ["Sheep"], tolerance: ["Salinity"], endUse: ["Grazing"] },
    { ...EMPTY_FILTERS, rainfall: 300 },
    { ...EMPTY_FILTERS, soil: ["L"], sowing: ["Turf"] },
  ];
  for (const filters of filterCases) {
    assert.deepEqual(
      listings.map((item) => productMatchesFilters(item, filters, categories)),
      products.map((item) => productMatchesFilters(item, filters, categories)),
    );
  }
});

test("listing records drop the heavy product-page fields", () => {
  const listing = toListingProduct(products[0]) as unknown as Record<string, unknown> & { details: Record<string, unknown> };
  for (const field of ["price", "note", "techSheet"]) assert.equal(field in listing, false, field);
  for (const field of ["blurb", "description", "seoTitle", "seoDescription", "faqs"]) assert.equal(field in listing.details, false, field);
  assert.deepEqual(listing.details.photos, [{ src: "/api/media/abc?x=1", alt: "Paddock" }]);
  assert.deepEqual(listing.saleLines, [{ seedForm: undefined }, { seedForm: "Coated" }]);
  assert.ok(JSON.stringify(listing).length < JSON.stringify(products[0]).length / 4);
});
