import assert from "node:assert/strict";
import test from "node:test";
import { imageUsageLine, imageUsageSentence } from "../src/image-usage-line.ts";

const unused = { total: 0, draft: 0, published: 0 };

test("unused assets say they are not used on any page", () => {
  assert.equal(imageUsageSentence(unused), "Not used on any page");
  assert.equal(
    imageUsageLine({ width: 1200, height: 800, usageSummary: unused }),
    "1200×800 · Not used on any page",
  );
});

test("named products appear in the sentence", () => {
  assert.equal(
    imageUsageSentence({ total: 1, draft: 1, published: 0 }, ["Margurita French Serradella"]),
    "Appears on Margurita French Serradella",
  );
});

test("draft plus published is called out", () => {
  assert.equal(
    imageUsageSentence({ total: 2, draft: 1, published: 1 }, ["Margurita French Serradella"]),
    "Appears on Margurita French Serradella (draft + published)",
  );
});

test("nameless references fall back to a page count or area", () => {
  assert.equal(imageUsageSentence({ total: 3, draft: 0, published: 3 }), "Appears on 3 pages");
  assert.equal(imageUsageSentence({ total: 1, draft: 0, published: 1, static: 1 }), "Appears on homepage");
  assert.equal(imageUsageSentence({ total: 1, draft: 1, published: 0, article: 1 }), "Appears on an article");
});
