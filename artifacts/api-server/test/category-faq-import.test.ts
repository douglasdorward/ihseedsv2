import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";
import {
  CATEGORY_FAQ_LIMIT,
  categoryFaqImportTemplate,
  planCategoryFaqImport,
  type CategoryFaqRoot,
} from "../src/lib/category-faq-import.ts";

const roots = [
  { id: 1, slug: "ryegrass", name: "Ryegrass", active: true, faqs: [] },
  { id: 2, slug: "clovers", name: "Clovers", active: true, faqs: [{ question: "Existing?", answer: "Yes." }] },
  { id: 3, slug: "mixes", name: "Mixes", active: false, faqs: [] },
];

function sheetRows(file: Buffer, name: string) {
  const book = XLSX.read(file, { type: "buffer" });
  const sheet = book.Sheets[name];
  assert.ok(sheet, `missing sheet ${name}`);
  return XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet, { defval: "" });
}

function workbook(rows: Array<Record<string, string>>) {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), "FAQs");
  return XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

test("template lists every root category for FAQ copy", () => {
  const file = categoryFaqImportTemplate(roots satisfies Array<CategoryFaqRoot & { id: number }>);
  const faqs = sheetRows(file, "FAQs");
  const listed = sheetRows(file, "Root categories");

  assert.deepEqual(faqs.map((row) => row.slug), ["ryegrass", "clovers", "mixes"]);
  assert.deepEqual(faqs.map((row) => row.category_name), ["Ryegrass", "Clovers", "Mixes"]);
  assert.ok(faqs.every((row) => row.question === "" && row.answer === ""));
  assert.deepEqual(listed.map((row) => [row.slug, row.path, row.active, row.faq_count]), [
    ["ryegrass", "/products/ryegrass", "yes", 0],
    ["clovers", "/products/clovers", "yes", 1],
    ["mixes", "/products/mixes", "no", 0],
  ]);
});

test("filled rows replace only the categories they name", () => {
  const file = workbook([
    { slug: "ryegrass", category_name: "Ryegrass", question: "", answer: "" },
    { slug: "clovers", category_name: "Clovers", question: "When do I sow clover?", answer: "Sow in autumn with the opening rains." },
    { slug: "clovers", category_name: "Clovers", question: "Which livestock suit clover?", answer: "Sheep and cattle both graze it well." },
  ]);
  const report = planCategoryFaqImport(file, roots);

  assert.equal(report.issues.length, 0);
  assert.equal(report.updated, 1);
  assert.equal(report.skipped, 1);
  assert.deepEqual(report.planned.map((item) => item.slug), ["clovers"]);
  assert.equal(report.planned[0]?.faqs.length, 2);
  assert.match(report.plannedChanges[0] ?? "", /Replace 2 FAQs on Clovers/);
});

test("unknown slugs, partial rows and too many FAQs are rejected", () => {
  const tooMany = Array.from({ length: CATEGORY_FAQ_LIMIT + 1 }, (_, index) => ({
    slug: "ryegrass",
    category_name: "Ryegrass",
    question: `Question ${index + 1}`,
    answer: `Answer ${index + 1}`,
  }));
  const overflow = planCategoryFaqImport(workbook(tooMany), roots);
  assert.equal(overflow.updated, 0);
  assert.match(overflow.issues[0]?.problem ?? "", /maximum is 10/);

  const unknown = planCategoryFaqImport(workbook([
    { slug: "herbs", category_name: "Herbs", question: "What is a herb?", answer: "A small-seeded pasture species." },
  ]), roots);
  assert.match(unknown.issues[0]?.problem ?? "", /not a root category/);

  const partial = planCategoryFaqImport(workbook([
    { slug: "ryegrass", category_name: "Ryegrass", question: "When do I sow?", answer: "" },
  ]), roots);
  assert.match(partial.issues[0]?.problem ?? "", /both a question and an answer/);
});
