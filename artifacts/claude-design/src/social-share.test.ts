import assert from "node:assert/strict";
import test from "node:test";
import { siteSocialPreviewSrc, siteSocialState, socialDimensionWarning, socialSourceLabel } from "./social-share.ts";

test("source labels", () => {
  assert.equal(socialSourceLabel("override"), "Custom sharing image");
  assert.equal(socialSourceLabel("hero"), "First product photo");
  assert.equal(socialSourceLabel("hero", "article"), "Article hero image");
  assert.match(socialSourceLabel("site"), /Site settings/);
  assert.match(socialSourceLabel("default"), /default/);
});

test("site state prefers asset id, then url, then default", () => {
  assert.equal(siteSocialState("/x.jpg", "abc"), "asset");
  assert.equal(siteSocialState(" /x.jpg ", null), "url");
  assert.equal(siteSocialState("", null), "default");
  assert.equal(siteSocialState(undefined, undefined), "default");
});

test("site preview src", () => {
  assert.equal(siteSocialPreviewSrc("/x.jpg", "abc"), "/api/admin/media/abc/preview");
  assert.equal(siteSocialPreviewSrc("/x.jpg", null), "/x.jpg");
  assert.equal(siteSocialPreviewSrc("", null), "/social-share-default.jpg");
});

test("dimension warnings", () => {
  assert.equal(socialDimensionWarning(1200, 630), "");
  assert.equal(socialDimensionWarning(), "");
  assert.match(socialDimensionWarning(800, 400), /at least 1200/);
  assert.match(socialDimensionWarning(2000, 2000), /crop/);
});
