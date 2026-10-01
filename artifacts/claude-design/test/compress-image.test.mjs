import assert from "node:assert/strict";
import test from "node:test";
import { compressImageForUpload, IMAGE_MAX_BYTES, IMAGE_MAX_EDGE } from "../src/compress-image.ts";

function photo(bytes, name = "paddock.png", type = "image/png") {
  return new File([new Uint8Array(bytes)], name, { type });
}

function compressor({ width, height, sizes }) {
  const calls = [];
  return {
    calls,
    decode: async () => ({ width, height }),
    encode: async (_image, encodedWidth, encodedHeight, quality) => {
      calls.push({ width: encodedWidth, height: encodedHeight, quality });
      const size = sizes[calls.length - 1];
      if (!size) return null;
      return new Blob([new Uint8Array(size)], { type: "image/webp" });
    },
  };
}

test("a wide photo is resized to the longest-edge limit and kept when smaller", async () => {
  const encoded = compressor({ width: 4800, height: 2400, sizes: [800] });
  const result = await compressImageForUpload(photo(2000), encoded);
  assert.equal(result.name, "paddock.webp");
  assert.equal(result.type, "image/webp");
  assert.equal(result.size, 800);
  assert.deepEqual(encoded.calls[0], { width: IMAGE_MAX_EDGE, height: 1200, quality: 0.8 });
});

test("an already small photo is uploaded unchanged", async () => {
  const encoded = compressor({ width: 800, height: 600, sizes: [3000] });
  const original = photo(2000, "logo.jpg", "image/jpeg");
  const result = await compressImageForUpload(original, encoded);
  assert.equal(result, original);
  assert.equal(encoded.calls.length, 3);
});

test("a file over 12 MB is retried at a lower quality until it fits", async () => {
  const encoded = compressor({
    width: 1000,
    height: 1000,
    sizes: [IMAGE_MAX_BYTES + 1, IMAGE_MAX_BYTES - 10],
  });
  const result = await compressImageForUpload(photo(IMAGE_MAX_BYTES + 50), encoded);
  assert.equal(result.size, IMAGE_MAX_BYTES - 10);
  assert.deepEqual(encoded.calls.map((call) => call.quality), [0.8, 0.65]);
});

test("a file that stays over 12 MB is rejected", async () => {
  const encoded = compressor({
    width: 1000,
    height: 1000,
    sizes: [IMAGE_MAX_BYTES + 20, IMAGE_MAX_BYTES + 20, IMAGE_MAX_BYTES + 20],
  });
  await assert.rejects(
    () => compressImageForUpload(photo(IMAGE_MAX_BYTES + 50), encoded),
    /still over 12 MB/,
  );
});

test("a photo the browser cannot decode is left unchanged", async () => {
  const original = photo(2000);
  const result = await compressImageForUpload(original, {
    decode: async () => null,
    encode: async () => { throw new Error("encode should not run"); },
  });
  assert.equal(result, original);
});
