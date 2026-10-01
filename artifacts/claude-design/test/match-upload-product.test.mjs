import assert from "node:assert/strict";
import test from "node:test";
import { matchUploadToArticle, matchUploadToProduct, normalizeUploadStem } from "../src/match-upload-product.ts";

const products = [
  { id: 1, name: "Astound", slug: "astound" },
  { id: 2, name: "SouWest Pasture Mix", slug: "souwest-pasture-mix" },
  { id: 3, name: "Achieve", slug: "achieve" },
  { id: 4, name: "Ryegrass One", slug: "ryegrass-one" },
];

test("normalizes camera-style names and second-shot suffixes", () => {
  assert.equal(normalizeUploadStem("astound-2.jpg"), "astound");
  assert.equal(normalizeUploadStem("Astound Pasture.JPG"), "astound-pasture");
  assert.equal(normalizeUploadStem("IMG_1234.JPG"), "img-1234");
});

test("exact slug filenames select silently", () => {
  const match = matchUploadToProduct("astound.jpg", products);
  assert.equal(match.productId, "1");
  assert.equal(match.unsure, false);
  assert.equal(match.score, 1);
});

test("second-shot slug filenames select silently", () => {
  const match = matchUploadToProduct("astound-2.webp", products);
  assert.equal(match.productId, "1");
  assert.equal(match.unsure, false);
});

test("random camera names stay unmatched", () => {
  const match = matchUploadToProduct("DSC_0091.jpg", products);
  assert.equal(match.productId, "");
  assert.equal(match.unsure, false);
});

test("close-but-weak guesses are selected with Unsure", () => {
  const match = matchUploadToProduct("ryegr.jpg", products);
  assert.equal(match.productId, "4");
  assert.equal(match.unsure, true);
  assert.ok(match.score >= 0.35);
  assert.ok(match.score <= 0.5);
});

const articles = [
  { id: 11, title: "Spring sowing notes", slug: "spring-sowing-notes" },
  { id: 12, title: "Clover establishment", slug: "clover-establishment" },
];

test("exact article slug filenames select silently", () => {
  const match = matchUploadToArticle("spring-sowing-notes.jpg", articles);
  assert.equal(match.articleId, "11");
  assert.equal(match.unsure, false);
  assert.equal(match.score, 1);
});

test("close-but-weak article title guesses are selected with Unsure", () => {
  const match = matchUploadToArticle("clover.jpg", articles);
  assert.equal(match.articleId, "12");
  assert.equal(match.unsure, true);
  assert.ok(match.score >= 0.35);
  assert.ok(match.score <= 0.5);
});

test("random camera names stay unmatched for articles", () => {
  const match = matchUploadToArticle("DSC_0091.jpg", articles);
  assert.equal(match.articleId, "");
  assert.equal(match.unsure, false);
});
