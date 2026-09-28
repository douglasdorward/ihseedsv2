import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_SOCIAL_IMAGE, resolveSocialImage } from "../../../lib/api-client-react/src/social-sharing";

test("social image precedence is override, hero, site asset, site URL, bundled default", () => {
  const values = { override: "/override.jpg", hero: "/hero.jpg", siteImage: "/site.jpg", siteAssetId: "asset-1" };
  assert.deepEqual(resolveSocialImage(values), { src: "/override.jpg", source: "override" });
  assert.deepEqual(resolveSocialImage({ ...values, override: "" }), { src: "/hero.jpg", source: "hero" });
  assert.deepEqual(resolveSocialImage({ ...values, override: "", hero: "" }), { src: "/api/media/asset-1", source: "site" });
  assert.deepEqual(resolveSocialImage({ siteImage: " /site.jpg " }), { src: "/site.jpg", source: "site" });
  assert.deepEqual(resolveSocialImage({}), { src: DEFAULT_SOCIAL_IMAGE, source: "default" });
});

test("clearing overrides follows the latest hero or site image and rejects unsafe URLs", () => {
  assert.equal(resolveSocialImage({ override: " ", hero: "/new-hero.jpg" }).src, "/new-hero.jpg");
  assert.equal(resolveSocialImage({ override: "javascript:alert(1)", hero: "//other.test/x", siteImage: "/new-site.jpg" }).src, "/new-site.jpg");
  assert.equal(resolveSocialImage({ siteImage: "data:image/png;base64,x" }).src, DEFAULT_SOCIAL_IMAGE);
});