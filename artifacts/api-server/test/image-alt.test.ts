import assert from "node:assert/strict";
import { test } from "node:test";
import {
  humanizeImageFilename,
  imageAltFromContext,
  resolveImageAlt,
  shouldReplaceGeneratedAlt,
} from "../src/lib/image-alt.ts";

test("humanizeImageFilename strips the extension and title-cases the stem", () => {
  assert.equal(humanizeImageFilename("holdfast-gt-hero.jpg"), "Holdfast Gt Hero");
  assert.equal(humanizeImageFilename("/tmp/seed_guide_cover.PNG"), "Seed Guide Cover");
  assert.equal(humanizeImageFilename(""), "");
});

test("imageAltFromContext prefers the owner name over the filename", () => {
  assert.equal(imageAltFromContext({ ownerName: "Holdfast GT", filename: "IMG_1234.jpg" }), "Holdfast GT");
  assert.equal(imageAltFromContext({ ownerName: "Holdfast GT", role: "gallery" }), "Holdfast GT — gallery");
  assert.equal(imageAltFromContext({ ownerName: "Holdfast GT", role: "hero" }), "Holdfast GT");
  assert.equal(imageAltFromContext({ filename: "holdfast-gt-hero.jpg" }), "Holdfast Gt Hero");
});

test("resolveImageAlt keeps editor-typed alt and upgrades filename defaults", () => {
  assert.equal(shouldReplaceGeneratedAlt("", "holdfast-gt.jpg"), true);
  assert.equal(shouldReplaceGeneratedAlt("Holdfast Gt", "holdfast-gt.jpg"), true);
  assert.equal(shouldReplaceGeneratedAlt("Cattle grazing Holdfast GT", "holdfast-gt.jpg"), false);
  assert.equal(resolveImageAlt({
    currentAlt: "Holdfast Gt",
    ownerName: "Holdfast GT",
    filename: "holdfast-gt.jpg",
  }), "Holdfast GT");
  assert.equal(resolveImageAlt({
    currentAlt: "Cattle grazing Holdfast GT",
    ownerName: "Holdfast GT",
    filename: "holdfast-gt.jpg",
  }), "Cattle grazing Holdfast GT");
});
