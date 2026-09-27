import assert from "node:assert/strict";
import { test } from "node:test";
import { canonicalHostRedirects, canonicalPublicSiteUrl } from "../host-redirect.mjs";

test("both host variants resolve to the apex canonical", () => {
  assert.equal(canonicalPublicSiteUrl("").origin, "https://irwinhunter.com.au");
  assert.equal(canonicalPublicSiteUrl("https://irwinhunter.com.au").origin, "https://irwinhunter.com.au");
  assert.equal(canonicalPublicSiteUrl("https://www.irwinhunter.com.au/").origin, "https://irwinhunter.com.au");
});

test("www permanently redirects to apex with the path preserved", () => {
  const rules = canonicalHostRedirects("https://www.irwinhunter.com.au");
  assert.equal(rules.length, 1);
  const [rule] = rules;
  assert.equal(rule.source, "/:path*");
  assert.equal(rule.destination, "https://irwinhunter.com.au/:path*");
  assert.equal(rule.permanent, true);
  assert.deepEqual(rule.has, [{ type: "host", value: "www\\.irwinhunter\\.com\\.au" }]);
  assert.match("www.irwinhunter.com.au", new RegExp(`^${rule.has[0].value}$`));
  assert.doesNotMatch("irwinhunter.com.au", new RegExp(`^${rule.has[0].value}$`));
});

test("an apex PUBLIC_SITE_URL produces the same redirect", () => {
  const rules = canonicalHostRedirects("https://irwinhunter.com.au");
  assert.equal(rules[0]?.destination, "https://irwinhunter.com.au/:path*");
});

test("a non-www canonical host emits no host redirect", () => {
  assert.deepEqual(canonicalHostRedirects("http://localhost:3000"), []);
  assert.deepEqual(canonicalHostRedirects("https://preview.example.replit.app"), []);
});

test("an unsupported protocol is rejected", () => {
  assert.throws(() => canonicalHostRedirects("ftp://www.irwinhunter.com.au"), /http or https/);
});
