import assert from "node:assert/strict";
import test from "node:test";
import { imageWarmupEnabled, optimisedImageUrlsInHtml, selectWarmUrls, warmOptimisedImages, warmPagesLinkedFrom } from "./image-warmup.ts";

const img = (id: number, w: number) => `/_next/image?url=http%3A%2F%2F127.0.0.1%3A8080%2Fapi%2Fmedia%2F${id}%3Fsize%3Dcard&amp;w=${w}&amp;q=75`;
const html = `<img srcSet="${img(1, 256)} 256w, ${img(1, 384)} 384w, ${img(1, 828)} 828w, ${img(1, 828)} 1200w" src="${img(1, 828)}">
<a href="/products/mixes">Mixes</a><a href="/products/mixes/souwest">x</a><a href="/products?page=2">2</a><a href="/articles?page=2">a</a>`;

test("collects decoded optimiser URLs and keeps only common widths", () => {
  const urls = optimisedImageUrlsInHtml(html);
  assert.equal(urls.length, 3);
  assert.ok(urls.every((url) => !url.includes("&amp;")));
  assert.deepEqual(selectWarmUrls(urls).map((url) => new URL(url, "http://x").searchParams.get("w")), ["256", "384", "828"]);
});

test("follows category pages and the page's own pagination only", () => {
  assert.deepEqual(warmPagesLinkedFrom("/products", html).sort(), ["/products/mixes", "/products?page=2"]);
});

test("is on in production, opt-in for development, and can be switched off", () => {
  assert.equal(imageWarmupEnabled({ NODE_ENV: "production" }), true);
  assert.equal(imageWarmupEnabled({ NODE_ENV: "production", IMAGE_WARMUP: "0" }), false);
  assert.equal(imageWarmupEnabled({ NODE_ENV: "development" }), false);
  assert.equal(imageWarmupEnabled({ NODE_ENV: "development", IMAGE_WARMUP: "1" }), true);
});

test("failures are logged and never thrown", async () => {
  const logs: string[] = [];
  const requested: string[] = [];
  const fetchImpl = (async (url: string) => {
    requested.push(url);
    if (url.endsWith("/")) return new Response(html);
    if (url.includes("_next/image") && url.includes("w=384")) throw new Error("boom");
    if (url.includes("_next/image")) return new Response("ok");
    return new Response("missing", { status: 500 });
  }) as typeof fetch;
  await warmOptimisedImages({ origin: "http://s", fetchImpl, log: (m) => logs.push(m) });
  assert.ok(logs.some((m) => m.includes("w=384") && m.includes("boom")));
  assert.ok(logs.some((m) => m.includes("page /products failed")));
  assert.match(logs.at(-1)!, /prepared 2\/3 photos/);
  assert.ok(requested.includes("http://s/products/mixes"));
});
