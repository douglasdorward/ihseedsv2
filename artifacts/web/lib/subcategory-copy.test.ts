import assert from "node:assert/strict";
import test from "node:test";
import {
  subcategoryDescription,
  subcategoryHeading,
  subcategoryIntro,
  subcategoryTitle,
} from "./subcategory-copy.ts";

const root = { name: "Clovers" };
const sub = { name: "Aerial-seeded annual", pageHeading: "", seoTitle: "", seoDescription: "", lead: "" };
const generated = { sentence: "They suit areas with 350 mm or more of annual rainfall.", productCount: 4 };

test("the heading uses the admin heading, else the sub name with its root", () => {
  assert.equal(subcategoryHeading(root, sub), "Aerial-seeded annual Clovers");
  assert.equal(subcategoryHeading(root, { ...sub, name: "Annual clovers" }), "Annual clovers");
  assert.equal(subcategoryHeading(root, { ...sub, pageHeading: "  Aerial Clover Seed " }), "Aerial Clover Seed");
});

test("the title uses the admin SEO title, else one built from the heading", () => {
  assert.equal(subcategoryTitle(root, sub), "Aerial-seeded annual Clovers Seed | IH Seeds");
  assert.equal(subcategoryTitle(root, { ...sub, seoTitle: "Aerial clover | IH Seeds" }), "Aerial clover | IH Seeds");
});

test("the intro and description fall back from admin copy to a generated summary", () => {
  assert.equal(
    subcategoryIntro(root, sub, generated),
    "IH Seeds aerial-seeded annual clovers: 4 lines in our range. They suit areas with 350 mm or more of annual rainfall.",
  );
  assert.equal(subcategoryIntro(root, { ...sub, lead: "Our own intro." }, generated), "Our own intro.");
  assert.equal(subcategoryDescription(root, { ...sub, lead: "Our own intro." }, generated), "Our own intro.");
  assert.equal(
    subcategoryDescription(root, { ...sub, lead: "Our own intro.", seoDescription: "Search copy." }, generated),
    "Search copy.",
  );
  assert.match(subcategoryIntro(root, sub, { sentence: "", productCount: 1 }), /1 line in our range/);
});

test("a long generated description is cut at a sentence", () => {
  const long = `${"A sentence about clover. ".repeat(20)}`.trim();
  const description = subcategoryDescription(root, { ...sub, seoDescription: long }, generated);
  assert.ok(description.length <= 300);
  assert.ok(description.endsWith("."));
});
