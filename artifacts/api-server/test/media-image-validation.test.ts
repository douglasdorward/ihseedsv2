import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import sharp from "sharp";
import { downloadedObjectBytes, putStoredFile, removeStoredFile } from "../src/lib/app-storage.ts";
import {
  CARD_MAX_EDGE,
  convertMediaVariants,
  convertToWebp,
  FULL_MAX_EDGE,
  isRefineCandidate,
  mediaVariantObjectPath,
  storedMediaVariant,
} from "../src/lib/media-image.ts";

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test("convertToWebp turns a PNG into usable WebP bytes", async () => {
  const converted = await convertToWebp(PNG_1X1);
  assert.equal(converted.contentType, "image/webp");
  assert.ok(converted.width >= 1);
  assert.ok(converted.height >= 1);
  assert.equal(converted.bytes.subarray(0, 4).toString(), "RIFF");
  assert.equal(converted.bytes.subarray(8, 12).toString(), "WEBP");
});

test("convertMediaVariants caps the full and card longest edges", async () => {
  const oversized = await sharp({
    create: { width: 2000, height: 1200, channels: 3, background: "#174e37" },
  }).png().toBuffer();
  const variants = await convertMediaVariants(oversized);
  assert.equal(variants.full.contentType, "image/webp");
  assert.equal(variants.card.contentType, "image/webp");
  assert.ok(Math.max(variants.full.width, variants.full.height) <= FULL_MAX_EDGE);
  assert.ok(Math.max(variants.card.width, variants.card.height) <= CARD_MAX_EDGE);
  assert.ok(variants.card.bytes.length < variants.full.bytes.length);
});

test("storedMediaVariant falls back to the master when the card is missing", async () => {
  const id = randomUUID();
  const objectPath = mediaVariantObjectPath(id, "full");
  const variants = await convertMediaVariants(PNG_1X1);
  await putStoredFile(objectPath, variants.full.bytes, "image/webp");
  try {
    const card = await storedMediaVariant({ id, objectPath }, "card");
    assert.ok(card);
    assert.deepEqual(card.bytes, variants.full.bytes);
    await putStoredFile(mediaVariantObjectPath(id, "card"), variants.card.bytes, "image/webp");
    const storedCard = await storedMediaVariant({ id, objectPath }, "card");
    assert.ok(storedCard);
    assert.deepEqual(storedCard.bytes, variants.card.bytes);
  } finally {
    await removeStoredFile(objectPath);
    await removeStoredFile(mediaVariantObjectPath(id, "card"));
  }
});

test("refine skips Failed and Pending assets and Ready assets without a file", () => {
  assert.equal(isRefineCandidate({ status: "Ready", objectPath: "media/a/image.webp" }), true);
  assert.equal(isRefineCandidate({ status: "Pending", objectPath: "media/a/original.png" }), false);
  assert.equal(isRefineCandidate({ status: "Failed", objectPath: "media/a/image.webp" }), false);
  assert.equal(isRefineCandidate({ status: "Ready", objectPath: null }), false);
});

test("Replit Object Storage download tuples expose their file bytes", () => {
  const downloaded = downloadedObjectBytes([PNG_1X1]);
  assert.ok(downloaded);
  assert.deepEqual(downloaded, PNG_1X1);
});
