import assert from "node:assert/strict";
import test from "node:test";
import { techSheetVersion } from "./tech-sheet-version.ts";

const base = {
  product: { name: "Maximix", category: "Mixes", details: { tagline: "Hardy", photos: [{ src: "/api/media/a" }] }, status: "available" },
  productUrl: "https://ihseeds.com.au/products/mixes/maximix",
  year: 2026,
  build: "build-1",
};

test("the fingerprint ignores property order", () => {
  const reordered = {
    build: "build-1",
    year: 2026,
    productUrl: base.productUrl,
    product: { status: "available", details: { photos: [{ src: "/api/media/a" }], tagline: "Hardy" }, category: "Mixes", name: "Maximix" },
  };
  assert.equal(techSheetVersion(reordered), techSheetVersion(base));
  assert.match(techSheetVersion(base), /^[a-f0-9]{64}$/);
});

test("anything printed on the sheet changes the fingerprint, so a stale PDF is never served", () => {
  const original = techSheetVersion(base);
  const changes = [
    { ...base, product: { ...base.product, details: { ...base.product.details, tagline: "Hardier" } } },
    { ...base, product: { ...base.product, category: "Pasture mixes" } },
    { ...base, product: { ...base.product, status: "unavailable" } },
    { ...base, product: { ...base.product, details: { ...base.product.details, photos: [{ src: "/api/media/b" }] } } },
    { ...base, productUrl: "https://ihseeds.com.au/products/pasture-mixes/maximix" },
    { ...base, year: 2027 },
    { ...base, build: "build-2" },
  ];
  for (const change of changes) assert.notEqual(techSheetVersion(change), original);
});
