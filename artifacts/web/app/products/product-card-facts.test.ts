import assert from "node:assert/strict";
import test from "node:test";
import type { CatalogueProduct } from "../../lib/catalogue";
import { productImageAlt } from "./product-card-facts.ts";

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
