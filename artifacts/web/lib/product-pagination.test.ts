import assert from "node:assert/strict";
import test from "node:test";
import { pageFromSearchParams, pageHref, pageNumbers, paginate, PRODUCTS_PER_PAGE } from "./product-pagination.ts";
import { searchParamsFromFilters, EMPTY_FILTERS } from "./product-filters.ts";

const items = Array.from({ length: 111 }, (_, index) => index + 1);

test("pages hold 24 products and report the full total", () => {
  assert.equal(PRODUCTS_PER_PAGE, 24);
  const first = paginate(items, 1);
  assert.deepEqual([first.page, first.pageCount, first.items.length, first.first, first.last, first.total], [1, 5, 24, 1, 24, 111]);
  const last = paginate(items, 5);
  assert.deepEqual([last.items.length, last.first, last.last], [15, 97, 111]);
});

test("out-of-range pages show the last valid page", () => {
  assert.equal(paginate(items, 9).page, 5);
  assert.equal(paginate(items.slice(0, 10), 3).page, 1);
  assert.equal(paginate(items, 0).page, 1);
  const empty = paginate([], 4);
  assert.deepEqual([empty.page, empty.pageCount, empty.items.length, empty.first, empty.last], [1, 1, 0, 0, 0]);
});

test("the page number is read defensively from the URL", () => {
  assert.equal(pageFromSearchParams(new URLSearchParams("page=3")), 3);
  for (const bad of ["", "page=", "page=0", "page=-2", "page=2.5", "page=abc", "page=1e3"]) {
    assert.equal(pageFromSearchParams(new URLSearchParams(bad)), 1, bad);
  }
});

test("page links keep filters, and page 1 matches the canonical URL", () => {
  const params = new URLSearchParams("category=clovers&livestock=Sheep&page=3");
  assert.equal(pageHref("/products", params, 2), "/products?category=clovers&livestock=Sheep&page=2");
  assert.equal(pageHref("/products", params, 1), "/products?category=clovers&livestock=Sheep");
  assert.equal(pageHref("/products", new URLSearchParams("page=4"), 1), "/products");
});

test("changing a filter drops the page, returning to page 1", () => {
  const next = searchParamsFromFilters({ ...EMPTY_FILTERS, category: ["clovers"] });
  assert.equal(next.has("page"), false);
  assert.equal(pageFromSearchParams(next), 1);
});

test("long page lists collapse around the current page", () => {
  assert.deepEqual(pageNumbers(1, 5), [1, 2, 3, 4, 5]);
  assert.deepEqual(pageNumbers(6, 12), [1, null, 5, 6, 7, null, 12]);
  assert.deepEqual(pageNumbers(1, 12), [1, 2, null, 12]);
  assert.deepEqual(pageNumbers(12, 12), [1, null, 11, 12]);
});
