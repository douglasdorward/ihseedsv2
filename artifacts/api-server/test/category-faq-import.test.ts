import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";
import {
  CATEGORY_FAQ_LIMIT,
  categoryFaqExport,
  planCategoryFaqImport,
  type CategoryFaqRoot,
} from "../src/lib/category-faq-import.ts";
import { CATEGORY_FAQ_SHEET_HEADERS, categoryFaqColumnGuideGaps } from "../src/lib/category-faq-column-guide.ts";
import { COLUMN_GUIDE_HEADERS, COLUMN_GUIDE_SHEET } from "../src/lib/product-column-guide.ts";

const roots = [
  { id: 1, slug: "ryegrass", name: "Ryegrass", active: true, pageHeading: "Ryegrass Seed for Pasture", seoTitle: "Ryegrass Seed | IH Seeds", seoDescription: "Perennial and annual ryegrass.", socialTitle: "Ryegrass seed, shared", socialDescription: "", socialImage: "/images/ryegrass-share.jpg", faqs: [] },
  { id: 2, slug: "clovers", name: "Clovers", active: true, pageHeading: "", seoTitle: "", seoDescription: "", socialTitle: "", socialDescription: "", socialImage: "", faqs: [{ question: "Existing?", answer: "Yes." }] },
  { id: 3, slug: "mixes", name: "Mixes", active: false, pageHeading: "", seoTitle: "", seoDescription: "", socialTitle: "", socialDescription: "", socialImage: "", faqs: [] },
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

test("export opens with a column guide that explains every column", () => {
  assert.deepEqual(categoryFaqColumnGuideGaps(), []);
  const file = categoryFaqExport(roots satisfies Array<CategoryFaqRoot & { id: number }>);
  const book = XLSX.read(file, { type: "buffer" });
  assert.deepEqual(book.SheetNames, [COLUMN_GUIDE_SHEET, "FAQs", "Categories", "Agent prompt"]);

  const guide = XLSX.utils.sheet_to_json<string[]>(book.Sheets[COLUMN_GUIDE_SHEET], { header: 1, defval: "" });
  assert.deepEqual(guide[0], [...COLUMN_GUIDE_HEADERS]);
  const documented = new Set(guide.slice(1).map((row) => `${row[0]}\t${row[1]}`));
  for (const [sheet, columns] of Object.entries(CATEGORY_FAQ_SHEET_HEADERS)) {
    for (const column of columns) assert.equal(documented.has(`${sheet}\t${column}`), true, `${sheet}.${column}`);
  }
  assert.ok(guide.some((row) => row[1] === "Identity and replacement"));
});

test("export lists stored FAQs and a starter row for each root without any", () => {
  const file = categoryFaqExport(roots satisfies Array<CategoryFaqRoot & { id: number }>);
  const faqs = sheetRows(file, "FAQs");
  const listed = sheetRows(file, "Categories");

  assert.deepEqual(faqs.map((row) => row.slug), ["ryegrass", "clovers", "mixes"]);
  assert.deepEqual(faqs.map((row) => row.category_name), ["Ryegrass", "Clovers", "Mixes"]);
  assert.deepEqual(faqs.map((row) => [row.question, row.answer]), [["", ""], ["Existing?", "Yes."], ["", ""]]);
  assert.deepEqual(listed.map((row) => [row.slug, row.path, row.active, row.faq_count]), [
    ["ryegrass", "/products/ryegrass", "yes", 0],
    ["clovers", "/products/clovers", "yes", 1],
    ["mixes", "/products/mixes", "no", 0],
  ]);
});

test("export carries the current search and page copy", () => {
  const listed = sheetRows(categoryFaqExport(roots), "Categories");
  assert.deepEqual(listed.map((row) => [row.page_heading, row.seo_title, row.seo_description]), [
    ["Ryegrass Seed for Pasture", "Ryegrass Seed | IH Seeds", "Perennial and annual ryegrass."],
    ["", "", ""],
    ["", "", ""],
  ]);
  assert.deepEqual(listed.map((row) => [row.social_title, row.social_description, row.social_image]), [
    ["Ryegrass seed, shared", "", "/images/ryegrass-share.jpg"],
    ["", "", ""],
    ["", "", ""],
  ]);
});

test("edited social sharing copy is planned, cleaned and validated", () => {
  const base = { slug: "ryegrass", page_heading: "Ryegrass Seed for Pasture", seo_title: "Ryegrass Seed | IH Seeds", seo_description: "Perennial and annual ryegrass." };
  const report = planCategoryFaqImport(withRootsSheet([
    { ...base, social_title: "Ryegrass™ seed", social_description: "Shared description", social_image: "" },
  ]), roots);
  assert.equal(report.issues.length, 0);
  assert.deepEqual(report.planned.find((item) => item.slug === "ryegrass")?.copy, {
    socialTitle: "Ryegrass seed",
    socialDescription: "Shared description",
    socialImage: "",
  });
  assert.match(report.plannedChanges.find((change) => change.startsWith("Ryegrass")) ?? "", /update social title, social description; clear social image/);

  const bad = planCategoryFaqImport(withRootsSheet([
    { ...base, social_title: "x".repeat(181), social_description: "", social_image: "javascript:alert(1)" },
    { slug: "clovers", social_title: "", social_description: "", social_image: "//evil.example/x.jpg" },
  ]), roots);
  assert.deepEqual(bad.issues.map((issue) => issue.column), ["Categories → social_title", "Categories → social_image", "Categories → social_image"]);
});

function withRootsSheet(rows: Array<Record<string, string>>) {
  const book = XLSX.read(categoryFaqExport(roots), { type: "buffer" });
  book.Sheets["Categories"] = XLSX.utils.json_to_sheet(rows);
  return XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

test("edited search and page copy is planned only where it differs", () => {
  const report = planCategoryFaqImport(withRootsSheet([
    { slug: "ryegrass", page_heading: "Ryegrass Seed for Pasture", seo_title: "Ryegrass Seed™ | IH Seeds", seo_description: "" },
    { slug: "clovers", page_heading: "Clover Seed", seo_title: "", seo_description: "" },
  ]), roots);

  assert.equal(report.issues.length, 0);
  assert.deepEqual(report.planned.map((item) => [item.slug, item.copy]), [
    ["clovers", { pageHeading: "Clover Seed" }],
    ["ryegrass", { seoDescription: "" }],
  ]);
  assert.ok(report.plannedChanges.some((change) => /Ryegrass .*: clear SEO description/.test(change)));
  assert.ok(report.plannedChanges.some((change) => /Clovers .*: update page heading/.test(change)));
});

test("copy changes and replaced FAQs combine on one category", () => {
  const book = XLSX.read(withRootsSheet([
    { slug: "clovers", page_heading: "Clover Seed", seo_title: "", seo_description: "" },
  ]), { type: "buffer" });
  book.Sheets["FAQs"] = XLSX.utils.json_to_sheet([
    { slug: "clovers", category_name: "Clovers", question: "When do I sow?", answer: "In autumn." },
  ]);
  const report = planCategoryFaqImport(XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer, roots);

  assert.equal(report.issues.length, 0);
  assert.equal(report.updated, 1);
  assert.deepEqual(report.planned[0]?.copy, { pageHeading: "Clover Seed" });
  assert.deepEqual(report.planned[0]?.faqs, [{ question: "When do I sow?", answer: "In autumn." }]);
  assert.match(report.plannedChanges[0] ?? "", /Clovers .*: update page heading; replace 1 FAQ\./);
});

test("copy rows with unknown slugs, repeats or over-long values are rejected", () => {
  const report = planCategoryFaqImport(withRootsSheet([
    { slug: "herbs", page_heading: "Herbs", seo_title: "", seo_description: "" },
    { slug: "ryegrass", page_heading: "x".repeat(181), seo_title: "", seo_description: "" },
    { slug: "ryegrass", page_heading: "", seo_title: "", seo_description: "" },
  ]), roots);

  assert.equal(report.updated, 0);
  assert.deepEqual(report.issues.map((issue) => issue.problem.replace(/".*?"/, "X").slice(0, 28)), [
    "X is not a category. Copy sl",
    "Page heading must be 180 cha",
    "X is listed more than once.",
  ]);
});

test("a Categories sheet without copy columns changes no copy", () => {
  const report = planCategoryFaqImport(withRootsSheet([
    { slug: "ryegrass", name: "Ryegrass", path: "/products/ryegrass", active: "yes", faq_count: "0" },
  ]), roots);
  assert.equal(report.issues.length, 0);
  assert.ok(report.planned.every((item) => item.copy === undefined));
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
  assert.match(report.plannedChanges[0] ?? "", /Clovers \(\/products\/clovers\): replace 2 FAQs/);
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
  assert.match(unknown.issues[0]?.problem ?? "", /is not a category/);

  const partial = planCategoryFaqImport(workbook([
    { slug: "ryegrass", category_name: "Ryegrass", question: "When do I sow?", answer: "" },
  ]), roots);
  assert.match(partial.issues[0]?.problem ?? "", /both a question and an answer/);
});

test("an unedited export imports back without issues and skips the guide sheet", () => {
  const exported = categoryFaqExport(roots satisfies Array<CategoryFaqRoot & { id: number }>);
  const report = planCategoryFaqImport(exported, roots);

  assert.equal(report.issues.length, 0);
  assert.deepEqual(report.planned.map((item) => item.slug), ["clovers"]);
  assert.deepEqual(report.planned[0]?.faqs, [{ question: "Existing?", answer: "Yes." }]);
  assert.equal(report.planned[0]?.copy, undefined);
  assert.equal(report.skipped, 2);
});

const withSubs = [
  ...roots,
  { id: 10, slug: "aerial-seeded-annual", parentSlug: "clovers", name: "Aerial-seeded annual", active: true, lead: "Annual clovers for aerial sowing.", pageHeading: "", seoTitle: "", seoDescription: "", socialTitle: "", socialDescription: "", socialImage: "", faqs: [] },
  { id: 11, slug: "aerial-seeded-annual", parentSlug: "ryegrass", name: "Aerial-seeded annual", active: true, lead: "", pageHeading: "", seoTitle: "", seoDescription: "", socialTitle: "", socialDescription: "", socialImage: "", faqs: [{ question: "Why?", answer: "Because." }] },
] satisfies Array<CategoryFaqRoot & { id: number }>;

test("export lists sub-categories with their root, level, path and intro", () => {
  const file = categoryFaqExport(withSubs);
  const listed = sheetRows(file, "Categories");
  assert.deepEqual(listed.slice(3).map((row) => [row.slug, row.parent_slug, row.level, row.path, row.intro]), [
    ["aerial-seeded-annual", "clovers", "sub", "/products/clovers/aerial-seeded-annual", "Annual clovers for aerial sowing."],
    ["aerial-seeded-annual", "ryegrass", "sub", "/products/ryegrass/aerial-seeded-annual", ""],
  ]);
  assert.deepEqual(listed.slice(0, 3).map((row) => [row.parent_slug, row.level]), [["", "root"], ["", "root"], ["", "root"]]);
  const faqs = sheetRows(file, "FAQs");
  assert.deepEqual(faqs.slice(3).map((row) => [row.slug, row.parent_slug, row.question]), [
    ["aerial-seeded-annual", "clovers", ""],
    ["aerial-seeded-annual", "ryegrass", "Why?"],
  ]);
  assert.deepEqual(categoryFaqColumnGuideGaps(), []);
});

test("an unedited export with sub-categories imports back with only the stored FAQs", () => {
  const report = planCategoryFaqImport(categoryFaqExport(withSubs), withSubs);
  assert.equal(report.issues.length, 0);
  assert.deepEqual(report.planned.map((item) => `${item.parentSlug}/${item.slug}`), ["/clovers", "ryegrass/aerial-seeded-annual"]);
  assert.ok(report.planned.every((item) => item.copy === undefined));
});

test("sub-category FAQs and copy are matched by root and slug, not slug alone", () => {
  const book = XLSX.read(categoryFaqExport(withSubs), { type: "buffer" });
  book.Sheets["FAQs"] = XLSX.utils.json_to_sheet([
    { slug: "aerial-seeded-annual", parent_slug: "clovers", category_name: "Aerial-seeded annual", question: "When do I sow?", answer: "Autumn." },
  ]);
  book.Sheets["Categories"] = XLSX.utils.json_to_sheet([
    { slug: "aerial-seeded-annual", parent_slug: "clovers", page_heading: "Aerial Clovers", intro: "New intro.", seo_title: "", seo_description: "" },
  ]);
  const report = planCategoryFaqImport(XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer, withSubs);

  assert.equal(report.issues.length, 0);
  assert.equal(report.planned.length, 1);
  assert.equal(report.planned[0]?.id, 10);
  assert.deepEqual(report.planned[0]?.copy, { pageHeading: "Aerial Clovers", lead: "New intro." });
  assert.deepEqual(report.planned[0]?.faqs, [{ question: "When do I sow?", answer: "Autumn." }]);
  assert.match(report.plannedChanges[0] ?? "", /\(\/products\/clovers\/aerial-seeded-annual\): update page heading, intro; replace 1 FAQ\./);
});

test("a sub-category slug without its parent, or under the wrong root, is rejected", () => {
  const missingParent = planCategoryFaqImport(workbook([
    { slug: "aerial-seeded-annual", category_name: "Aerial-seeded annual", question: "When?", answer: "Autumn." },
  ]), withSubs);
  assert.match(missingParent.issues[0]?.problem ?? "", /is a sub-category\. Fill parent_slug/);

  const wrongRoot = planCategoryFaqImport(workbook([
    { slug: "aerial-seeded-annual", parent_slug: "mixes", category_name: "x", question: "When?", answer: "Autumn." },
  ]), withSubs);
  assert.match(wrongRoot.issues[0]?.problem ?? "", /"mixes\/aerial-seeded-annual" is not a category/);
});

test("an intro that is too long is rejected", () => {
  const book = XLSX.read(categoryFaqExport(withSubs), { type: "buffer" });
  book.Sheets["Categories"] = XLSX.utils.json_to_sheet([
    { slug: "aerial-seeded-annual", parent_slug: "clovers", intro: "x".repeat(1001) },
  ]);
  const report = planCategoryFaqImport(XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer, withSubs);
  assert.match(report.issues[0]?.problem ?? "", /Intro must be 1000 characters or fewer/);
});

test("a workbook exported before sub-categories existed still imports", () => {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet([
    { slug: "clovers", category_name: "Clovers", question: "When do I sow?", answer: "Autumn." },
  ]), "FAQs");
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet([
    { slug: "clovers", name: "Clovers", page_heading: "Clover Seed", seo_title: "", seo_description: "" },
  ]), "Root categories");
  const report = planCategoryFaqImport(XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer, withSubs);
  assert.equal(report.issues.length, 0);
  assert.deepEqual(report.planned.map((item) => [item.slug, item.copy, item.faqs]), [
    ["clovers", { pageHeading: "Clover Seed" }, [{ question: "When do I sow?", answer: "Autumn." }]],
  ]);
});
