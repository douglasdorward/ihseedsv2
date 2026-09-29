// Live check against running servers: a tech sheet download is drawn once,
// stored in App Storage under its content fingerprint, then served from storage.
// Usage: node scripts/check-tech-sheet-downloads.mjs [slug]
// WEB_URL and API_URL default to the local development servers.
import assert from "node:assert/strict";

const web = (process.env.WEB_URL ?? "http://127.0.0.1:24722").replace(/\/+$/, "");
const api = (process.env.API_URL ?? "http://127.0.0.1:8080").replace(/\/+$/, "");

async function firstPublishedSlug() {
  const response = await fetch(`${api}/api/products`);
  assert.equal(response.ok, true, `Product list failed (${response.status})`);
  const body = await response.json();
  const products = Array.isArray(body) ? body : body.products ?? body.items ?? [];
  assert.ok(products.length > 0, "No published products to check.");
  return products[0].slug;
}

async function download(slug, headers = {}) {
  const started = Date.now();
  const response = await fetch(`${web}/tech-sheets/${encodeURIComponent(slug)}`, { headers });
  const bytes = Buffer.from(await response.arrayBuffer());
  return { response, bytes, ms: Date.now() - started };
}

const slug = process.argv[2] ?? await firstPublishedSlug();
console.log(`Checking tech sheet for ${slug}`);

const first = await download(slug);
assert.equal(first.response.status, 200, `First download failed: ${first.bytes.toString().slice(0, 200)}`);
assert.equal(first.response.headers.get("content-type"), "application/pdf");
assert.equal(first.bytes.subarray(0, 5).toString(), "%PDF-");
const etag = first.response.headers.get("etag");
assert.match(etag ?? "", /^"[a-f0-9]{64}"$/, "Download should name its content fingerprint");
const version = etag.slice(1, -1);
console.log(`First download: ${first.bytes.length} bytes in ${first.ms}ms`);

const stored = await fetch(`${api}/api/generated-tech-sheets/${slug}/${version}`, { method: "HEAD" });
assert.equal(stored.status, 200, "The sheet should be stored in App Storage after the first download");

const second = await download(slug);
assert.equal(second.response.status, 200);
assert.equal(second.response.headers.get("etag"), etag);
assert.ok(second.bytes.equals(first.bytes), "The second download should be the stored PDF");
console.log(`Second download (from storage): ${second.ms}ms`);

const revalidated = await download(slug, { "if-none-match": etag });
assert.equal(revalidated.response.status, 304);

console.log("Tech sheet downloads are stored and served from App Storage.");
