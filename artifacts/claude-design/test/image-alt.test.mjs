import assert from "node:assert/strict";
import test from "node:test";
import { imageAltFromContext, resolveImageAlt } from "../src/image-alt.ts";

test("client helper matches owner context then filename fallback", () => {
  assert.equal(imageAltFromContext({ ownerName: "Holdfast GT", filename: "IMG_1234.jpg" }), "Holdfast GT");
  assert.equal(imageAltFromContext({ filename: "seed_guide_cover.png" }), "Seed Guide Cover");
  assert.equal(resolveImageAlt({
    currentAlt: "Holdfast Gt",
    ownerName: "2026 Pasture Seed Guide",
    filename: "holdfast-gt.jpg",
  }), "2026 Pasture Seed Guide");
});
