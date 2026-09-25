import assert from "node:assert/strict";
import { test } from "node:test";
import { canonicalHostRedirects, canonicalPublicSiteUrl } from "../host-redirect.mjs";

test("the default canonical host is www.irwinhunter.com.au", () => {
  assert.equal(canonicalPublicSiteUrl(undefined).origin, "https://www.irwinhunter.com.au");
  assert.equal(canonicalPublicSiteUrl("https://irwinhunter.com.au").origin, "https://www.irwinhunter.com.au");
  assert.equal(canonicalPublicSiteUrl("https://www.irwinhunter.com.au/").origin, "https://www.irwinhunter.com.au");
});

test("the apex host 301s to www with the path preserved", () => {
  const rules = canonicalHostRedirects("https://www.irwinhunter.com.au");
  assert.equal(rules.length, 1);
  const [rule] = rules;
  assert.equal(rule.source, "/:path*");
  assert.equal(rule.destination, "https://www.irwinhunter.com.au/:path*");
  assert.equal(rule.permanent, true);
  assert.deepEqual(rule.has, [{ type: "host", value: "irwinhunter\\.com\\.au" }]);
  assert.match("irwinhunter.com.au", new RegExp(`^${rule.has[0].value}$`));
  assert.doesNotMatch("www.irwinhunter.com.au", new RegExp(`^${rule.has[0].value}$`));
});

test("an apex PUBLIC_SITE_URL still produces the www redirect", () => {
  const rules = canonicalHostRedirects("https://irwinhunter.com.au");
  assert.equal(rules[0]?.destination, "https://www.irwinhunter.com.au/:path*");
});

test("a non-www canonical host emits no host redirect", () => {
  assert.deepEqual(canonicalHostRedirects("http://localhost:3000"), []);
  assert.deepEqual(canonicalHostRedirects("https://preview.example.replit.app"), []);
});

test("an unsupported protocol is rejected", () => {
  assert.throws(() => canonicalHostRedirects("ftp://www.irwinhunter.com.au"), /http or https/);
});
