import assert from "node:assert/strict";
import test from "node:test";
import { moveProductPhoto, productPhotoFilledIndex, removeProductPhoto } from "./product-photos.ts";

function photo(src: string, slot = "") {
  return { slot, file: src, rating: "", src, assetId: src };
}

test("remove shifts the next photo into the hero slot", () => {
  const photos = [photo("/a", "Photo 1 · Hero"), photo("/b", "Photo 2"), photo("/c", "Photo 3")];
  const next = removeProductPhoto(photos, 0);
  assert.equal(next[0].src, "/b");
  assert.equal(next[0].slot, "Photo 1 · Hero");
  assert.equal(next[0].role, "hero");
  assert.equal(next[1].src, "/c");
  assert.equal(next[1].role, "gallery");
  assert.equal(next[2].src, "");
});

test("move down swaps neighbours and keeps empty slots last", () => {
  const photos = [photo("/a"), photo("/b"), { slot: "", file: "", rating: "", src: "" }];
  const next = moveProductPhoto(photos, 0, 1);
  assert.equal(next[0].src, "/b");
  assert.equal(next[0].role, "hero");
  assert.equal(next[1].src, "/a");
  assert.equal(next[1].slot, "Photo 2");
  assert.equal(next[2].src, "");
  assert.equal(productPhotoFilledIndex(photos, 0), 0);
  assert.equal(productPhotoFilledIndex(photos, 2), -1);
});
