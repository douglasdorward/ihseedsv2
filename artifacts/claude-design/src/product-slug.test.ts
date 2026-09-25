import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeSlugInput, slugify } from "./product-slug.ts";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

test("slugify builds a lowercase kebab-case slug from a product name", () => {
  assert.equal(slugify("SouWest™ Pasture Mix"), "souwest-pasture-mix");
  assert.equal(slugify("  Lucerne  (Dryland)  "), "lucerne-dryland");
  assert.equal(slugify("Café Ryegrass"), "cafe-ryegrass");
  assert.equal(slugify("Kikuyu 2.0"), "kikuyu-2-0");
  assert.equal(slugify("™"), "");
});

test("slugify output always matches the API slug pattern", () => {
  for (const name of ["Sub Clover", "Winter Wheat #2", "--Odd-- Name--", "A"]) {
    assert.match(slugify(name), SLUG_PATTERN);
  }
});

test("sanitizeSlugInput strips spaces and capitals while typing", () => {
  assert.equal(sanitizeSlugInput("Sou West"), "sou-west");
  assert.equal(sanitizeSlugInput("SOUWEST"), "souwest");
  assert.equal(sanitizeSlugInput("sou  west"), "sou-west");
  assert.equal(sanitizeSlugInput("sou--west"), "sou-west");
  assert.equal(sanitizeSlugInput("-souwest"), "souwest");
  assert.equal(sanitizeSlugInput("sou_west"), "sou-west");
});

test("sanitizeSlugInput keeps a trailing hyphen so a-b can be typed, slugify trims it", () => {
  assert.equal(sanitizeSlugInput("sou-"), "sou-");
  assert.equal(slugify("sou-"), "sou");
});

test("sanitizeSlugInput is a no-op on an already valid slug", () => {
  assert.equal(sanitizeSlugInput("souwest-pasture-mix"), "souwest-pasture-mix");
});
