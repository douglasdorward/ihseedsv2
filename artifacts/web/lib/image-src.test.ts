import assert from "node:assert/strict";
import test from "node:test";
import { articleImageHtml, IMAGE_FETCH_ORIGIN, mediaVariantSrc, optimizableSrc } from "./image-src.ts";

test("catalogue media paths are fetched from the local API for optimisation", () => {
  assert.equal(
    optimizableSrc("/api/media/5273ac33-d102-42bd-8070-2df96aefb1d6"),
    `${IMAGE_FETCH_ORIGIN}/api/media/5273ac33-d102-42bd-8070-2df96aefb1d6`,
  );
  assert.equal(
    optimizableSrc("/api/media/5273ac33-d102-42bd-8070-2df96aefb1d6?size=card"),
    `${IMAGE_FETCH_ORIGIN}/api/media/5273ac33-d102-42bd-8070-2df96aefb1d6?size=card`,
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

test("mediaVariantSrc adds a card query on catalogue media paths", () => {
  assert.equal(
    mediaVariantSrc("/api/media/5273ac33-d102-42bd-8070-2df96aefb1d6", "card"),
    "/api/media/5273ac33-d102-42bd-8070-2df96aefb1d6?size=card",
  );
  assert.equal(
    mediaVariantSrc("/api/media/5273ac33-d102-42bd-8070-2df96aefb1d6?size=card", "full"),
    "/api/media/5273ac33-d102-42bd-8070-2df96aefb1d6",
  );
  assert.equal(mediaVariantSrc("/ih-seeds-logo.png", "card"), "/ih-seeds-logo.png");
  assert.equal(
    articleImageHtml("/api/media/4bb9e866-9848-4894-8bd3-95198eb7fb92", "Clover"),
    '<img src="/api/media/4bb9e866-9848-4894-8bd3-95198eb7fb92?size=card" alt="Clover" loading="lazy" decoding="async">',
  );
});
