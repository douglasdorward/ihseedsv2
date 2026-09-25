import assert from "node:assert/strict";
import test from "node:test";
import { sortMediaAssets } from "../src/image-sort.ts";

const items = [
  { id: "c", originalFilename: "zeta.jpg", createdAt: "2026-03-01T00:00:00.000Z" },
  { id: "a", originalFilename: "Alpha-10.jpg", createdAt: "2026-02-01T00:00:00.000Z" },
  { id: "b", originalFilename: "alpha-2.jpg", createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "d", originalFilename: "alpha-2.jpg", createdAt: "2026-04-01T00:00:00.000Z" },
];

test("newest keeps the API order untouched", () => {
  const sorted = sortMediaAssets(items, "newest");
  assert.deepEqual(sorted.map((item) => item.id), ["c", "a", "b", "d"]);
  assert.equal(sorted, items);
});

test("file name sorts case-insensitively with numeric awareness", () => {
  const sorted = sortMediaAssets(items, "filename");
  assert.deepEqual(sorted.map((item) => item.id), ["d", "b", "a", "c"]);
  assert.notEqual(sorted, items);
  assert.deepEqual(items.map((item) => item.id), ["c", "a", "b", "d"]);
});
