import assert from "node:assert/strict";
import test from "node:test";
import { absoluteSiteUrl, publicSiteUrl } from "./site-url";
import { productCanonicalUrl } from "./product-url";
import { publicSiteBaseUrl } from "../../api-server/src/lib/public-site-url";

test("frontend, API, and stored www overrides use the apex", () => {
  assert.equal(publicSiteUrl.origin, "https://irwinhunter.com.au");
  assert.equal(publicSiteBaseUrl(), "https://irwinhunter.com.au");
  const path = productCanonicalUrl("https://www.irwinhunter.com.au/products/ryegrass/example", "/");
  assert.equal(absoluteSiteUrl(path), "https://irwinhunter.com.au/products/ryegrass/example");
});