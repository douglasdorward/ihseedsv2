import assert from "node:assert/strict";
import test from "node:test";
import { IMAGE_FETCH_ORIGIN, optimizableSrc } from "./image-src.ts";

test("catalogue media paths are fetched from the local API for optimisation", () => {
  assert.equal(
    optimizableSrc("/api/media/5273ac33-d102-42bd-8070-2df96aefb1d6"),
    `${IMAGE_FETCH_ORIGIN}/api/media/5273ac33-d102-42bd-8070-2df96aefb1d6`,
  );
  assert.equal(
    optimizableSrc("/api/site/hero-videos/abc.webp"),
    `${IMAGE_FETCH_ORIGIN}/api/site/hero-videos/abc.webp`,
  );
});

test("public files and remote urls are left unchanged", () => {
  assert.equal(optimizableSrc("/ih-seeds-logo.png"), "/ih-seeds-logo.png");
  assert.equal(optimizableSrc("https://images.unsplash.com/photo"), "https://images.unsplash.com/photo");
});
