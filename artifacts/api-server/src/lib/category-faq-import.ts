import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import * as XLSX from "xlsx";
import { catalogueCategoriesTable, db, forSearchMetadata, type CatalogueCategoryFaq } from "@workspace/db";
import {
  appendCategoryFaqColumnGuide,
  CATEGORY_FAQ_ANSWER_MAX,
  CATEGORY_FAQ_LIMIT,
  CATEGORY_FAQ_QUESTION_MAX,
  CATEGORY_LEAD_MAX,
  CATEGORY_PAGE_HEADING_MAX,
  CATEGORY_SEO_DESCRIPTION_MAX,
  CATEGORY_SEO_TITLE_MAX,
  CATEGORY_SOCIAL_DESCRIPTION_MAX,
  CATEGORY_SOCIAL_IMAGE_MAX,
  CATEGORY_SOCIAL_TITLE_MAX,
  CATEGORY_FAQ_CATEGORIES_SHEET,
  CATEGORY_FAQ_LEGACY_CATEGORIES_SHEET,
  CATEGORY_FAQ_SHEET,
  CATEGORY_FAQ_SHEET_HEADERS,
} from "./category-faq-column-guide.ts";
import { COLUMN_GUIDE_SHEET } from "./product-column-guide.ts";

export { CATEGORY_FAQ_ANSWER_MAX, CATEGORY_FAQ_LIMIT, CATEGORY_FAQ_QUESTION_MAX };

export const CATEGORY_FAQ_HEADERS = CATEGORY_FAQ_SHEET_HEADERS[CATEGORY_FAQ_SHEET];
const FAQ_SHEET = CATEGORY_FAQ_SHEET;
const CATEGORIES_SHEET = CATEGORY_FAQ_CATEGORIES_SHEET;
const AGENT_PROMPT_SHEET = "Agent prompt";
// "Instructions" is the guide sheet of workbooks downloaded before the export existed.
// "Root categories" is the categories sheet of workbooks exported before sub-categories were included.
const LOOKUP_SHEETS = new Set([
  COLUMN_GUIDE_SHEET,
  CATEGORIES_SHEET,
  CATEGORY_FAQ_LEGACY_CATEGORIES_SHEET,
  "Instructions",
  AGENT_PROMPT_SHEET,
]);
const CATEGORY_HEADERS = CATEGORY_FAQ_SHEET_HEADERS[CATEGORIES_SHEET];

export const CATEGORY_FAQ_AGENT_PROMPT = `You are preparing an IH Seeds category import workbook for Admin → Site settings → Category pages → Import Categories. Every root category and every sub-category has its own public page, so write for both.

OUTPUT
- Start from a current Export Categories file. Return an .xlsx with sheets: Column guide (optional), FAQs (required), Categories (required), and Agent prompt (optional).
- The Column guide sheet explains every column and the rules for replacing values. Read it first. It is not imported.
- The FAQs sheet MUST use these exact header names in row 1, in this order:
  slug, parent_slug, category_name, question, answer
- The Categories sheet MUST use these exact header names in row 1, in this order:
  slug, parent_slug, level, name, path, active, page_heading, intro, seo_title, seo_description, social_title, social_description, social_image, faq_count
- The workbook already holds every value stored today: the search and page copy on Categories, and one FAQ per row on FAQs. A category with no FAQs has one blank starter row.
- Only edit the cells you mean to change. Do not rename sheets or headers, and do not add columns.
- Do not put formulas in any cell. Do not start a cell with =.

IDENTITY
- A root category is identified by its slug, with parent_slug blank.
- A sub-category is identified by its slug AND the slug of its root in parent_slug (for example parent_slug clovers, slug aerial-seeded-annual). Two roots can each have a sub-category with the same slug, so always copy both cells exactly. Never invent either.

SEARCH, SOCIAL AND PAGE COPY (Categories sheet)
- slug and parent_slug: copy them exactly, never change them. level, name, path, active and faq_count are labels and are not imported.
- page_heading (max ${CATEGORY_PAGE_HEADING_MAX} characters): the H1 of the category page. Example: Ryegrass Seed, or Aerial-seeded annual Clovers for a sub-category.
- intro (max ${CATEGORY_LEAD_MAX} characters): the short introduction. On a sub-category page it is the paragraph under the H1. Write it for that sub-category alone, so it does not repeat its root's intro.
- seo_title (max ${CATEGORY_SEO_TITLE_MAX} characters, about 60 recommended): the browser tab and Google title. No ™ or ® symbols.
- seo_description (max ${CATEGORY_SEO_DESCRIPTION_MAX} characters, about 155 recommended): the Google description. Plain text, no ™ or ® symbols.
- social_title (max ${CATEGORY_SOCIAL_TITLE_MAX} characters): the title on the link card when the page is shared on Facebook, LinkedIn, X or messaging apps. Blank uses the SEO title. No ™ or ® symbols.
- social_description (max ${CATEGORY_SOCIAL_DESCRIPTION_MAX} characters): the description on that link card. Blank uses the meta description. Plain text.
- social_image (max ${CATEGORY_SOCIAL_IMAGE_MAX} characters): a public image address, either a full https:// URL or a site path starting with /. About 1200 by 630 pixels. Blank uses the Site settings sharing image. Only change it when you have a real image address.
- Every category listed on the sheet is set to exactly what these seven cells say. A blank cell clears that field so the page uses its default. Delete a category's row to leave its copy untouched.

FAQS (FAQs sheet)
- One FAQ per row. Duplicate a category's slug (and parent_slug) for each extra question, up to ${CATEGORY_FAQ_LIMIT} rows per category.
- category_name is a label copied from the category name. It is not imported and must not be used to rename a category.
- Leave question and answer blank to skip that row. A category is updated only when the file contains at least one complete question and answer for it. Those rows replace that category's stored FAQs, so keep every existing FAQ you still want. Categories omitted from the file, or listed only with blank question and answer cells, keep their current FAQs.
- question: plain text, max ${CATEGORY_FAQ_QUESTION_MAX} characters. No HTML.
- answer: plain text, max ${CATEGORY_FAQ_ANSWER_MAX} characters. No HTML. Short paragraphs a customer can read on the category page.

WHICH CATEGORIES TO WRITE
- Write copy and FAQs for every active category on the Categories sheet (active = yes), root categories and sub-categories.
- Use path for the public page, such as /products/ryegrass or /products/clovers/aerial-seeded-annual.
- faq_count is how many complete FAQs are already published. A count of 0 means that page still needs a set.
- Leave inactive categories unchanged unless the user explicitly asks for them.
- Up to ${CATEGORY_FAQ_LIMIT} FAQs per category. Prefer 6–10 practical questions when the page has none.

QUALITY
- Australian English. Practical pasture and seed advice for that category, not generic marketing.
- Questions a grower would actually ask: sowing window, rainfall, soil, livestock fit, how this category differs from a neighbour category.
- A sub-category page must read differently from its root and from its sibling sub-categories. Answer for that sub-category's own products, not the whole root.
- Do not invent product variety claims. These FAQs sit on the category landing, above the product list.
- Each question unique within a category.
- Keep answers self-contained. The public page shows them as plain text.

Return the .xlsx and a short summary of each category (slug and parent_slug), what you changed in its search, social and page copy, how many FAQs you wrote, and any category you left unchanged.`;

type Header = (typeof CATEGORY_FAQ_HEADERS)[number];
type SourceRow = Record<Header, string>;

const COPY_FIELDS = [
  { column: "page_heading", key: "pageHeading", label: "page heading", max: CATEGORY_PAGE_HEADING_MAX },
  { column: "intro", key: "lead", label: "intro", max: CATEGORY_LEAD_MAX },
  { column: "seo_title", key: "seoTitle", label: "SEO title", max: CATEGORY_SEO_TITLE_MAX },
  { column: "seo_description", key: "seoDescription", label: "SEO description", max: CATEGORY_SEO_DESCRIPTION_MAX },
  { column: "social_title", key: "socialTitle", label: "social title", max: CATEGORY_SOCIAL_TITLE_MAX },
  { column: "social_description", key: "socialDescription", label: "social description", max: CATEGORY_SOCIAL_DESCRIPTION_MAX },
  { column: "social_image", key: "socialImage", label: "social image", max: CATEGORY_SOCIAL_IMAGE_MAX },
] as const;
type CopyKey = (typeof COPY_FIELDS)[number]["key"];
type CategoryCopy = Record<CopyKey, string>;
type CopyChange = Partial<CategoryCopy>;

/** A root category (no parentSlug) or a sub-category (parentSlug is its root's slug). */
export type CategoryFaqRoot = {
  slug: string;
  /** Slug of the root category when this is a sub-category; omitted or blank for a root. */
  parentSlug?: string;
  name: string;
  active: boolean;
  /** Intro text. Omitted workbooks and fixtures are treated as blank. */
  lead?: string;
  pageHeading: string;
  seoTitle: string;
  seoDescription: string;
  socialTitle: string;
  socialDescription: string;
  socialImage: string;
  faqs: CatalogueCategoryFaq[];
};

export type CategoryFaqImportIssue = {
  row: number;
  column: string;
  problem: string;
};

export type CategoryFaqImportReport = {
  token: string;
  rows: number;
  created: number;
  updated: number;
  skipped: number;
  issues: CategoryFaqImportIssue[];
  plannedChanges: string[];
};

type PlannedCategoryFaqs = {
  id: number;
  slug: string;
  parentSlug: string;
  name: string;
  faqs?: CatalogueCategoryFaq[];
  copy?: CopyChange;
};

type CategoryFaqPlan = CategoryFaqImportReport & {
  planned: PlannedCategoryFaqs[];
};

function tokenFor(file: Buffer) {
  return createHash("sha256").update(file).digest("hex");
}

function cellText(value: unknown) {
  if (value == null) return "";
  return String(value).trim();
}

function headerKey(value: unknown) {
  return cellText(value).toLowerCase().replace(/[\s-]+/g, "_");
}

function publicPath(slug: string, parentSlug = "") {
  return parentSlug ? `/products/${parentSlug}/${slug}` : `/products/${slug}`;
}

/** Sub-category slugs repeat across roots, so identity is always root/sub. */
function categoryKey(slug: string, parentSlug = "") {
  return parentSlug ? `${parentSlug}/${slug}` : slug;
}

function completeCount(faqs: CatalogueCategoryFaq[]) {
  return faqs.filter((faq) => faq.question.trim() && faq.answer.trim()).length;
}

/** One row per stored FAQ. A category with none gets a blank starter row so every page is listed. */
function exportFaqRows(categories: CategoryFaqRoot[]): SourceRow[] {
  return categories.flatMap((category) => {
    const parent_slug = category.parentSlug ?? "";
    const complete = category.faqs.filter((faq) => faq.question.trim() && faq.answer.trim());
    return complete.length
      ? complete.map((faq) => ({ slug: category.slug, parent_slug, category_name: category.name, question: faq.question.trim(), answer: faq.answer.trim() }))
      : [{ slug: category.slug, parent_slug, category_name: category.name, question: "", answer: "" }];
  });
}

function workbookFromRows(faqRows: SourceRow[], categories: CategoryFaqRoot[]) {
  const book = XLSX.utils.book_new();
  appendCategoryFaqColumnGuide(book);
  const sheetRows = faqRows.length
    ? faqRows
    : [{ slug: "", parent_slug: "", category_name: "", question: "", answer: "" }];
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(sheetRows, { header: [...CATEGORY_FAQ_HEADERS] }), FAQ_SHEET);
  const categoryRows = categories.length
    ? categories.map((category) => ({
      slug: category.slug,
      parent_slug: category.parentSlug ?? "",
      level: category.parentSlug ? "sub" : "root",
      name: category.name,
      path: publicPath(category.slug, category.parentSlug),
      active: category.active ? "yes" : "no",
      page_heading: category.pageHeading,
      intro: category.lead ?? "",
      seo_title: category.seoTitle,
      seo_description: category.seoDescription,
      social_title: category.socialTitle,
      social_description: category.socialDescription,
      social_image: category.socialImage,
      faq_count: completeCount(category.faqs),
    }))
    : [{ slug: "", parent_slug: "", level: "", name: "", path: "", active: "", page_heading: "", intro: "", seo_title: "", seo_description: "", social_title: "", social_description: "", social_image: "", faq_count: "" }];
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(categoryRows, { header: [...CATEGORY_HEADERS] }), CATEGORIES_SHEET);
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([
    ["Copy this prompt into another agent. Attach this workbook so it can see the root categories and sub-categories, their search and page copy, and their FAQs."],
    [CATEGORY_FAQ_AGENT_PROMPT],
  ]), AGENT_PROMPT_SHEET);
  return XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function categoryFaqExport(categories: CategoryFaqRoot[]) {
  return workbookFromRows(exportFaqRows(categories), categories);
}

function categoriesSheet(book: XLSX.WorkBook) {
  return book.Sheets[CATEGORIES_SHEET] ?? book.Sheets[CATEGORY_FAQ_LEGACY_CATEGORIES_SHEET];
}

function faqsSheet(book: XLSX.WorkBook) {
  if (book.Sheets[FAQ_SHEET]) return book.Sheets[FAQ_SHEET];
  const name = book.SheetNames.find((sheet) => !LOOKUP_SHEETS.has(sheet));
  return name ? book.Sheets[name] : undefined;
}

type CopyRow = { row: number; slug: string; parentSlug: string; values: Partial<Record<CopyKey, string>> };

function parseCopyRows(sheet: XLSX.WorkSheet | undefined): CopyRow[] {
  if (!sheet) return [];
  const table = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, { header: 1, defval: "", raw: false });
  const indexes = new Map<string, number>();
  (table[0] ?? []).forEach((header, index) => {
    const key = headerKey(header);
    if (key && !indexes.has(key)) indexes.set(key, index);
  });
  const slugColumn = indexes.get("slug");
  const parentColumn = indexes.get("parent_slug");
  const fields = COPY_FIELDS.filter((field) => indexes.has(field.column));
  // Workbooks exported before the copy columns existed carry neither, so they change nothing here.
  if (slugColumn == null || !fields.length) return [];
  const rows: CopyRow[] = [];
  for (let index = 1; index < table.length; index += 1) {
    const source = table[index] ?? [];
    const slug = cellText(source[slugColumn]);
    const parentSlug = parentColumn == null ? "" : cellText(source[parentColumn]);
    const values: CopyRow["values"] = {};
    for (const field of fields) values[field.key] = cellText(source[indexes.get(field.column)!]);
    if (!slug && !parentSlug && Object.values(values).every((value) => !value)) continue;
    rows.push({ row: index + 1, slug, parentSlug, values });
  }
  return rows;
}

function parseRows(file: Buffer) {
  let book: XLSX.WorkBook;
  try {
    book = XLSX.read(file, { type: "buffer" });
  } catch {
    return { rows: [] as SourceRow[], copyRows: [] as CopyRow[], issues: [{ row: 1, column: "slug", problem: "The file is not a valid Excel workbook." }] };
  }
  const copyRows = parseCopyRows(categoriesSheet(book));
  const sheet = faqsSheet(book);
  if (!sheet) {
    if (copyRows.length) return { rows: [] as SourceRow[], copyRows, issues: [] as CategoryFaqImportIssue[] };
    return { rows: [] as SourceRow[], copyRows, issues: [{ row: 1, column: "slug", problem: "The workbook has no FAQs sheet." }] };
  }
  const table = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, { header: 1, defval: "", raw: false });
  const headerRow = table[0] ?? [];
  const indexes = new Map<string, number>();
  headerRow.forEach((header, index) => {
    const key = headerKey(header);
    if (key && !indexes.has(key)) indexes.set(key, index);
  });
  // parent_slug is optional so workbooks exported before sub-categories were included still import.
  const missing = ["slug", "question", "answer"].filter((header) => !indexes.has(header));
  if (missing.length) {
    return { rows: [] as SourceRow[], copyRows, issues: [{ row: 1, column: missing[0] ?? "slug", problem: `Missing columns: ${missing.join(", ")}.` }] };
  }
  const rows: SourceRow[] = [];
  for (let index = 1; index < table.length; index += 1) {
    const source = table[index] ?? [];
    const row = Object.fromEntries(CATEGORY_FAQ_HEADERS.map((header) => {
      const column = indexes.get(header);
      return [header, column == null ? "" : cellText(source[column])];
    })) as SourceRow;
    rows.push(row);
  }
  return { rows, copyRows, issues: [] as CategoryFaqImportIssue[] };
}

export function planCategoryFaqImport(file: Buffer, categories: Array<CategoryFaqRoot & { id: number }>): CategoryFaqPlan {
  const { rows, copyRows, issues } = parseRows(file);
  const categoriesByKey = new Map(categories.map((category) => [categoryKey(category.slug, category.parentSlug), category]));
  const grouped = new Map<string, { faqs: CatalogueCategoryFaq[]; firstRow: number }>();
  let skipped = 0;

  /** Finds the category a row names, or records why it cannot. */
  const lookup = (slug: string, parentSlug: string, row: number, column: string) => {
    if (!slug) {
      issues.push({ row, column, problem: "Category slug is required." });
      return null;
    }
    const category = categoriesByKey.get(categoryKey(slug, parentSlug));
    if (category) return category;
    const label = parentSlug ? `${parentSlug}/${slug}` : slug;
    const isSubWithoutParent = !parentSlug && categories.some((item) => item.slug === slug && item.parentSlug);
    issues.push({
      row,
      column,
      problem: isSubWithoutParent
        ? `"${slug}" is a sub-category. Fill parent_slug with its root category's slug.`
        : `"${label}" is not a category. Copy slug (and parent_slug for a sub-category) from the Categories sheet.`,
    });
    return null;
  };

  if (!issues.length) {
    rows.forEach((row, index) => {
      const rowNumber = index + 2;
      const question = row.question;
      const answer = row.answer;
      if (!question && !answer) {
        skipped += 1;
        return;
      }
      const category = lookup(row.slug, row.parent_slug, rowNumber, "slug");
      if (!category) return;
      if (!question || !answer) {
        issues.push({
          row: rowNumber,
          column: question ? "answer" : "question",
          problem: "Each FAQ needs both a question and an answer.",
        });
        return;
      }
      if (question.length > CATEGORY_FAQ_QUESTION_MAX) {
        issues.push({ row: rowNumber, column: "question", problem: `Question must be ${CATEGORY_FAQ_QUESTION_MAX} characters or fewer.` });
      }
      if (answer.length > CATEGORY_FAQ_ANSWER_MAX) {
        issues.push({ row: rowNumber, column: "answer", problem: `Answer must be ${CATEGORY_FAQ_ANSWER_MAX} characters or fewer.` });
      }
      const key = categoryKey(category.slug, category.parentSlug);
      const current = grouped.get(key) ?? { faqs: [], firstRow: rowNumber };
      current.faqs.push({ question, answer });
      grouped.set(key, current);
    });

    for (const [key, group] of grouped) {
      if (group.faqs.length > CATEGORY_FAQ_LIMIT) {
        issues.push({
          row: group.firstRow,
          column: "question",
          problem: `"${key}" has ${group.faqs.length} FAQs; maximum is ${CATEGORY_FAQ_LIMIT}.`,
        });
      }
    }
  }

  const copyByKey = new Map<string, CopyChange>();
  const seen = new Set<string>();
  {
    for (const copyRow of copyRows) {
      const sheetColumn = (column: string) => `${CATEGORIES_SHEET} → ${column}`;
      const category = lookup(copyRow.slug, copyRow.parentSlug, copyRow.row, sheetColumn("slug"));
      if (!category) continue;
      const key = categoryKey(category.slug, category.parentSlug);
      if (seen.has(key)) {
        issues.push({ row: copyRow.row, column: sheetColumn("slug"), problem: `"${key}" is listed more than once.` });
        continue;
      }
      seen.add(key);
      const change: CopyChange = {};
      for (const field of COPY_FIELDS) {
        const raw = copyRow.values[field.key];
        if (raw === undefined) continue;
        const next = field.key === "pageHeading" || field.key === "socialImage" || field.key === "lead"
          ? raw.trim()
          : forSearchMetadata(raw);
        if (field.key === "socialImage" && next && !/^(https?:\/\/\S+|\/(?![\\/])\S*)$/i.test(next)) {
          issues.push({ row: copyRow.row, column: sheetColumn(field.column), problem: "Social image must be a full https:// address or a site path starting with /." });
          continue;
        }
        if (next.length > field.max) {
          issues.push({ row: copyRow.row, column: sheetColumn(field.column), problem: `${field.label[0]!.toUpperCase()}${field.label.slice(1)} must be ${field.max} characters or fewer.` });
          continue;
        }
        if (next !== (category[field.key] ?? "").trim()) change[field.key] = next;
      }
      if (Object.keys(change).length) copyByKey.set(key, change);
    }
  }

  const plannedByKey = new Map<string, PlannedCategoryFaqs>();
  if (!issues.length) {
    const base = (key: string) => {
      const category = categoriesByKey.get(key)!;
      return { id: category.id, slug: category.slug, parentSlug: category.parentSlug ?? "", name: category.name };
    };
    for (const [key, group] of grouped) {
      plannedByKey.set(key, { ...base(key), faqs: group.faqs });
    }
    for (const [key, copy] of copyByKey) {
      plannedByKey.set(key, { ...(plannedByKey.get(key) ?? base(key)), copy });
    }
  }
  const planned = [...plannedByKey.values()];

  const describe = (item: PlannedCategoryFaqs) => {
    const parts: string[] = [];
    if (item.copy) {
      const fields = COPY_FIELDS.filter((field) => item.copy![field.key] !== undefined);
      const cleared = fields.filter((field) => item.copy![field.key] === "").map((field) => field.label);
      const changed = fields.filter((field) => item.copy![field.key] !== "").map((field) => field.label);
      if (changed.length) parts.push(`update ${changed.join(", ")}`);
      if (cleared.length) parts.push(`clear ${cleared.join(", ")}`);
    }
    if (item.faqs) parts.push(`replace ${item.faqs.length} FAQ${item.faqs.length === 1 ? "" : "s"}`);
    return `${item.name} (${publicPath(item.slug, item.parentSlug)}): ${parts.join("; ")}.`;
  };

  return {
    token: tokenFor(file),
    rows: rows.length,
    created: 0,
    updated: planned.length,
    skipped,
    issues,
    plannedChanges: planned.map(describe),
    planned,
  };
}

/** Every category in page order: each root followed by its sub-categories. */
async function loadCategories() {
  const all = await db.select().from(catalogueCategoriesTable);
  const byOrder = (left: (typeof all)[number], right: (typeof all)[number]) =>
    left.sortOrder - right.sortOrder || left.name.localeCompare(right.name) || left.id - right.id;
  const roots = all.filter((category) => category.parentId === null).sort(byOrder);
  const ordered = roots.flatMap((root) => [
    { category: root, parentSlug: "" },
    ...all.filter((category) => category.parentId === root.id).sort(byOrder)
      .map((category) => ({ category, parentSlug: root.slug })),
  ]);
  return ordered.map(({ category, parentSlug }) => ({
    id: category.id,
    slug: category.slug,
    parentSlug,
    name: category.name,
    active: category.active,
    lead: category.lead,
    pageHeading: category.pageHeading,
    seoTitle: category.seoTitle,
    seoDescription: category.seoDescription,
    socialTitle: category.socialTitle,
    socialDescription: category.socialDescription,
    socialImage: category.socialImage,
    faqs: category.faqs ?? [],
  }));
}

export async function dryRunCategoryFaqImport(file: Buffer): Promise<CategoryFaqImportReport> {
  const { planned: _planned, ...report } = planCategoryFaqImport(file, await loadCategories());
  return report;
}

export async function categoryFaqExportFile() {
  const categories = await loadCategories();
  return categoryFaqExport(categories);
}

export async function commitCategoryFaqImport(file: Buffer, token: string) {
  const plan = planCategoryFaqImport(file, await loadCategories());
  if (token !== plan.token) throw new Error("This workbook has changed since the dry run. Run the dry run again.");
  if (plan.issues.length) throw new Error(plan.issues.map((issue) => `Row ${issue.row}: ${issue.problem}`).join(" "));

  const now = new Date();
  await db.transaction(async (tx) => {
    for (const item of plan.planned) {
      await tx.update(catalogueCategoriesTable)
        .set({ ...(item.faqs ? { faqs: item.faqs } : {}), ...item.copy, updatedAt: now })
        .where(eq(catalogueCategoriesTable.id, item.id));
    }
  });
  const { planned: _planned, ...report } = plan;
  return report;
}
