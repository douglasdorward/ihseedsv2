import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import nextConfig, { DAILY_PUBLIC_FILES, IMMUTABLE_PUBLIC_FILES } from "../next.config.mjs";

test("every cached site image exists in public/", () => {
  for (const file of [...IMMUTABLE_PUBLIC_FILES, ...DAILY_PUBLIC_FILES]) {
    assert.ok(existsSync(new URL(`../public/${file}`, import.meta.url)), `${file} is missing from public/`);
  }
});

test("the logo is kept long-term and favicons for a day", async () => {
  const rules = await nextConfig.headers();
  const cacheFor = (source: string) => rules.find((rule: { source: string }) => rule.source === source)
    ?.headers.find((header: { key: string }) => header.key === "Cache-Control")?.value;
  assert.match(cacheFor("/ih-seeds-logo.png"), /max-age=31536000, immutable/);
  assert.match(cacheFor("/ih-seeds-logo-716.webp"), /max-age=31536000, immutable/);
  assert.equal(cacheFor("/favicon.ico"), "public, max-age=86400");
});
