import assert from "node:assert/strict";
import { test } from "node:test";
import { legacyRedirectConflict } from "../src/lib/product-path.ts";

const live = new Set(["/products/lucerne/alpha-1", "/products/ryegrass/avalon"]);

test("an unused legacy path can be claimed", () => {
  assert.equal(legacyRedirectConflict(null, "/products/lucerne/alpha-1", live), null);
  assert.equal(legacyRedirectConflict(undefined, "/products/lucerne/alpha-1", live), null);
});

test("a leftover product page can be pointed at the imported product", () => {
  assert.equal(
    legacyRedirectConflict("/products/lucerne/alpha-1-old", "/products/lucerne/alpha-1", live),
    null,
  );
  assert.equal(
    legacyRedirectConflict("/products/clovers#catalogue", "/products/clovers/persian-clover", live),
    null,
  );
});

test("a redirect that already reaches the imported product is not a conflict", () => {
  assert.equal(
    legacyRedirectConflict("/products/lucerne/alpha-1", "/products/lucerne/alpha-1", live),
    null,
  );
});

test("a blog article keeps its legacy path", () => {
  assert.equal(
    legacyRedirectConflict("/articles/winter-feed", "/products/lucerne/alpha-1", live),
    "article",
  );
});

test("another live product keeps its legacy path", () => {
  assert.equal(
    legacyRedirectConflict("/products/ryegrass/avalon", "/products/lucerne/alpha-1", live),
    "other-product",
  );
});
