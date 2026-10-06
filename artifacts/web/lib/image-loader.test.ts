import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { CARD_MAX_WIDTH, cappedWidth, FULL_MAX_WIDTH, IMAGE_DEVICE_SIZES, IMAGE_SMALL_SIZES, optimisedImageUrl } from "./image-loader.ts";

const card = "http://127.0.0.1:8080/api/media/12?size=card";
const full = "http://127.0.0.1:8080/api/media/12";

test("card copies are never requested wider than their stored 800px copy", () => {
  assert.equal(cappedWidth(card, 384), 384);
  assert.equal(cappedWidth(card, 1200), CARD_MAX_WIDTH);
  assert.equal(cappedWidth(card, 2048), CARD_MAX_WIDTH);
});

test("full copies are capped at 1600px; other sources are left alone", () => {
  assert.equal(cappedWidth(full, 1200), 1200);
  assert.equal(cappedWidth(full, 2048), FULL_MAX_WIDTH);
  assert.equal(cappedWidth("/ih-seeds-logo.png", 2048), 2048);
  assert.equal(cappedWidth("http://127.0.0.1:8080/api/site/hero.jpg", 2048), 2048);
  assert.equal(cappedWidth("https://images.unsplash.com/photo-1?auto=format&w=900&q=80", 2048), 1200);
});

test("URLs match the built-in optimiser format so caches are shared", () => {
  assert.equal(optimisedImageUrl(card, 1600), `/_next/image?url=${encodeURIComponent(card)}&w=828&q=75`);
});

test("caps are allowed widths and the lists match next.config.mjs", () => {
  assert.ok(IMAGE_DEVICE_SIZES.includes(CARD_MAX_WIDTH));
  assert.ok(IMAGE_DEVICE_SIZES.includes(FULL_MAX_WIDTH));
  const config = readFileSync(new URL("../next.config.mjs", import.meta.url), "utf8");
  assert.match(config, new RegExp(`deviceSizes: \\[${IMAGE_DEVICE_SIZES.join(", ")}\\]`));
  assert.match(config, new RegExp(`imageSizes: \\[${IMAGE_SMALL_SIZES.join(", ")}\\]`));
});
