import assert from "node:assert/strict";
import { test } from "node:test";
import { convertToWebp } from "../src/lib/media-image.ts";

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
