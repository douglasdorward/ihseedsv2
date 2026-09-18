import assert from "node:assert/strict";
import test from "node:test";
import { expandProductCount, resolveBestSellers } from "../src/site-settings.ts";

test("expandProductCount replaces the live variety token", () => {
  assert.equal(
    expandProductCount("We blend {productCount} for the state.", 120),
    "We blend 120+ varieties and mixes for the state.",
  );
  assert.equal(
    expandProductCount("We blend {productCount} for the state.", 0),
    "We blend improved pasture seed for the state.",
  );
});

test("resolveBestSellers keeps chosen published slugs and fills empty slots", () => {
  const products = [
    { slug: "alpha" },
    { slug: "bravo" },
    { slug: "charlie" },
    { slug: "delta" },
    { slug: "echo" },
  ];
  assert.deepEqual(
    resolveBestSellers(["bravo", "missing", "echo"], products).map((item) => item.slug),
    ["bravo", "echo", "alpha", "charlie"],
  );
  assert.deepEqual(
    resolveBestSellers([], products).map((item) => item.slug),
    ["alpha", "bravo", "charlie", "delta"],
  );
});
