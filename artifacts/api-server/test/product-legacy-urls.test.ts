import assert from "node:assert/strict";
import { test } from "node:test";
import {
  describeProductLegacyUrls,
  joinLegacyUrls,
  legacyWebsitePaths,
  PRODUCT_LEGACY_URL_LIMIT,
  splitLegacyUrls,
} from "../src/lib/product-legacy-urls.ts";

const A = "https://www.irwinhunter.com.au/product/maximix/";
const B = "https://www.irwinhunter.com.au/maximix-pasture-mix/";
const C = "https://irwinhunter.com.au/old/maximix";

test("addresses are split on the pipe and trimmed", () => {
  assert.deepEqual(splitLegacyUrls(`${A} | ${B}`), [A, B]);
  assert.deepEqual(splitLegacyUrls(`${A}|${B}`), [A, B]);
  assert.deepEqual(splitLegacyUrls(`  ${A}  |  |  ${B} | `), [A, B]);
  assert.deepEqual(splitLegacyUrls(""), []);
  assert.deepEqual(splitLegacyUrls(undefined), []);
});

test("the stored form joins addresses with a spaced pipe", () => {
  assert.equal(joinLegacyUrls(`${A}|${B}`), `${A} | ${B}`);
  assert.equal(joinLegacyUrls(`  ${A} |  | ${B}  `), `${A} | ${B}`);
  assert.equal(joinLegacyUrls(A), A);
  assert.equal(joinLegacyUrls(" | "), "");
});

test("a single address still validates as before", () => {
  const result = describeProductLegacyUrls(A, "/products/mixes/maximix");
  assert.equal(result.problem, null);
  assert.deepEqual(result.paths, ["/product/maximix"]);
});

test("several addresses give one path each, apex and www both accepted", () => {
  const result = describeProductLegacyUrls(`${A} | ${B} | ${C}`, "/products/mixes/maximix");
  assert.equal(result.problem, null);
  assert.deepEqual(result.paths, ["/product/maximix", "/maximix-pasture-mix", "/old/maximix"]);
});

test("a blank field is valid and has no paths", () => {
  const result = describeProductLegacyUrls("   ");
  assert.equal(result.problem, null);
  assert.deepEqual(result.paths, []);
});

test("an invalid address is named and rejects the whole field", () => {
  const single = describeProductLegacyUrls("not a URL");
  assert.match(single.problem ?? "", /^Legacy website URL must be an http\(s\) URL on www\.irwinhunter\.com\.au/);
  const several = describeProductLegacyUrls(`${A} | https://example.com/product/x | ${B}`);
  assert.match(several.problem ?? "", /"https:\/\/example\.com\/product\/x"/);
  assert.deepEqual(several.paths, []);
  assert.match(describeProductLegacyUrls(`${A} | ${B}?utm=1`).problem ?? "", /without a query or fragment/);
});

test("the same path twice is rejected, even written differently", () => {
  assert.match(describeProductLegacyUrls(`${A} | ${A}`).problem ?? "", /Duplicate legacy website path "\/product\/maximix"/);
  assert.match(
    describeProductLegacyUrls("https://www.irwinhunter.com.au/product/maximix | https://irwinhunter.com.au/product/maximix/").problem ?? "",
    /Duplicate legacy website path/,
  );
});

test("an address may not be the product's own new path", () => {
  const own = "https://www.irwinhunter.com.au/products/mixes/maximix";
  assert.match(
    describeProductLegacyUrls(`${A} | ${own}`, "/products/mixes/maximix").problem ?? "",
    /cannot already be the product's new canonical path/,
  );
});

test("more than the limit is rejected", () => {
  const many = Array.from({ length: PRODUCT_LEGACY_URL_LIMIT + 1 }, (_, i) => `https://www.irwinhunter.com.au/old/${i}`).join(" | ");
  assert.match(describeProductLegacyUrls(many).problem ?? "", /at most 12/);
  const ok = Array.from({ length: PRODUCT_LEGACY_URL_LIMIT }, (_, i) => `https://www.irwinhunter.com.au/old/${i}`).join(" | ");
  assert.equal(describeProductLegacyUrls(ok).problem, null);
});

test("legacyWebsitePaths skips anything invalid and removes repeats", () => {
  assert.deepEqual(
    legacyWebsitePaths(`${A} | nonsense | https://example.com/x | ${A} | ${B}`),
    ["/product/maximix", "/maximix-pasture-mix"],
  );
  assert.deepEqual(legacyWebsitePaths(""), []);
});
