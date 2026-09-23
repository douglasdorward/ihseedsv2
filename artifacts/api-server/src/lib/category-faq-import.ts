import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import * as XLSX from "xlsx";
import { catalogueCategoriesTable, db, type CatalogueCategoryFaq } from "@workspace/db";

export const CATEGORY_FAQ_LIMIT = 10;
export const CATEGORY_FAQ_QUESTION_MAX = 200;
export const CATEGORY_FAQ_ANSWER_MAX = 2000;

export const CATEGORY_FAQ_HEADERS = ["slug", "category_name", "question", "answer"] as const;
const FAQ_SHEET = "FAQs";
const ROOTS_SHEET = "Root categories";
const INSTRUCTIONS_SHEET = "Instructions";
const AGENT_PROMPT_SHEET = "Agent prompt";
const LOOKUP_SHEETS = new Set([ROOTS_SHEET, INSTRUCTIONS_SHEET, AGENT_PROMPT_SHEET]);
const ROOT_HEADERS = ["slug", "name", "path", "active", "faq_count"] as const;

export const CATEGORY_FAQ_AGENT_PROMPT = `You are preparing an IH Seeds root-category FAQ import workbook for Admin → Site settings → Root categories → Import.

OUTPUT
- Create an .xlsx with sheets: FAQs (required), Root categories (lookup), Instructions (optional), and Agent prompt (optional).
- The FAQs sheet MUST use these exact header names in row 1, in this order:
  slug, category_name, question, answer
- One FAQ per row. Duplicate a category's slug for each extra question, up to 10 rows per slug.
- The Root categories sheet lists every current root category. It is the checklist of pages that need FAQ copy. Do not put FAQ rows there; it is not imported.
- category_name is a label copied from the category name. It is not imported and must not be used to rename a category.
- Leave question and answer blank to skip that row. A category is updated only when the file contains at least one complete question and answer for its slug. Those rows replace that category's stored FAQs. Categories omitted from the file, or listed only with blank question and answer cells, keep their current FAQs.
- Do not put formulas in any cell. Do not start a cell with =.

COLUMN RULES
- slug (required when question or answer is filled): copy the slug exactly from the Root categories sheet. Example: ryegrass
- category_name: display name only. Example: Ryegrass
- question (required with answer): plain text, max ${CATEGORY_FAQ_QUESTION_MAX} characters. No HTML.
- answer (required with question): plain text, max ${CATEGORY_FAQ_ANSWER_MAX} characters. No HTML. Short paragraphs a customer can read on the category page.

WHICH CATEGORIES TO WRITE
- Write FAQs for every active root category on the Root categories sheet (active = yes).
- Use path for the public page, such as /products/ryegrass.
- faq_count is how many complete FAQs are already published. A count of 0 means that page still needs a set.
- Leave inactive categories blank unless the user explicitly asks for them.
- Up to ${CATEGORY_FAQ_LIMIT} FAQs per category. Prefer 6–10 practical questions when the page has none.

QUALITY
- Australian English. Practical pasture and seed advice for that category, not generic marketing.
- Questions a grower would actually ask: sowing window, rainfall, soil, livestock fit, how this category differs from a neighbour category.
- Do not invent product variety claims. These FAQs sit on the category landing, above the product list.
- Each question unique within a category.
- Keep answers self-contained. The public page shows them as plain text.

Return the .xlsx and a short summary of each category slug, how many FAQs you wrote, and any category you left blank.`;

const INSTRUCTION_ROWS: Array<[string, string]> = [
  ["Topic", "Detail"],
  ["What to write", "The Root categories sheet lists every root category. Write FAQs for each active row. faq_count 0 means that page has no FAQs yet."],
  ["FAQs sheet", "One question per row. Copy slug from Root categories. Duplicate the row for each extra FAQ, up to 10 per category."],
  ["category_name", "A label only. It is not imported and does not rename the category."],
  ["Blank rows", "Rows with an empty question and answer are ignored. They do not clear existing FAQs."],
  ["Replace", "A category is updated only when at least one row has both a question and an answer. Those complete rows replace that category's stored FAQs. Other categories stay as they are."],
  ["Limits", `Question max ${CATEGORY_FAQ_QUESTION_MAX} characters. Answer max ${CATEGORY_FAQ_ANSWER_MAX} characters. Maximum ${CATEGORY_FAQ_LIMIT} FAQs per root category.`],
  ["Format", "Plain text only. Excel formatting and HTML are not imported. Do not start a cell with =."],
  ["Roots only", "Subcategory slugs are rejected. Use the slug column from Root categories."],
  ["Agent prompt", "The Agent prompt sheet is a copyable brief for another agent. Attach this workbook so it can see which categories need copy."],
];

type Header = (typeof CATEGORY_FAQ_HEADERS)[number];
type SourceRow = Record<Header, string>;

export type CategoryFaqRoot = {
  slug: string;
  name: string;
  active: boolean;
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
  name: string;
  faqs: CatalogueCategoryFaq[];
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

function publicPath(slug: string) {
  return `/products/${slug}`;
}

function completeCount(faqs: CatalogueCategoryFaq[]) {
  return faqs.filter((faq) => faq.question.trim() && faq.answer.trim()).length;
}

function workbookFromRows(faqRows: SourceRow[], roots: CategoryFaqRoot[]) {
  const book = XLSX.utils.book_new();
  const rows = faqRows.length
    ? faqRows
    : roots.map((root) => ({ slug: root.slug, category_name: root.name, question: "", answer: "" }));
  const sheetRows = rows.length
    ? rows
    : [{ slug: "", category_name: "", question: "", answer: "" }];
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(sheetRows, { header: [...CATEGORY_FAQ_HEADERS] }), FAQ_SHEET);
  const rootRows = roots.length
    ? roots.map((root) => ({
      slug: root.slug,
      name: root.name,
      path: publicPath(root.slug),
      active: root.active ? "yes" : "no",
      faq_count: completeCount(root.faqs),
    }))
    : [{ slug: "", name: "", path: "", active: "", faq_count: "" }];
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rootRows, { header: [...ROOT_HEADERS] }), ROOTS_SHEET);
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(INSTRUCTION_ROWS), INSTRUCTIONS_SHEET);
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([
    ["Copy this prompt into another agent. Attach this workbook so it can see the root categories."],
    [CATEGORY_FAQ_AGENT_PROMPT],
  ]), AGENT_PROMPT_SHEET);
  return XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function categoryFaqImportTemplate(roots: CategoryFaqRoot[]) {
  return workbookFromRows([], roots);
}

function faqsSheet(book: XLSX.WorkBook) {
  if (book.Sheets[FAQ_SHEET]) return book.Sheets[FAQ_SHEET];
  const name = book.SheetNames.find((sheet) => !LOOKUP_SHEETS.has(sheet));
  return name ? book.Sheets[name] : undefined;
}

function parseRows(file: Buffer) {
  let book: XLSX.WorkBook;
  try {
    book = XLSX.read(file, { type: "buffer" });
  } catch {
    return { rows: [] as SourceRow[], issues: [{ row: 1, column: "slug", problem: "The file is not a valid Excel workbook." }] };
  }
  const sheet = faqsSheet(book);
  if (!sheet) {
    return { rows: [] as SourceRow[], issues: [{ row: 1, column: "slug", problem: "The workbook has no FAQs sheet." }] };
  }
  const table = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, { header: 1, defval: "", raw: false });
  const headerRow = table[0] ?? [];
  const indexes = new Map<string, number>();
  headerRow.forEach((header, index) => {
    const key = headerKey(header);
    if (key && !indexes.has(key)) indexes.set(key, index);
  });
  const missing = ["slug", "question", "answer"].filter((header) => !indexes.has(header));
  if (missing.length) {
    return { rows: [] as SourceRow[], issues: [{ row: 1, column: missing[0] ?? "slug", problem: `Missing columns: ${missing.join(", ")}.` }] };
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
  return { rows, issues: [] as CategoryFaqImportIssue[] };
}

export function planCategoryFaqImport(file: Buffer, roots: Array<CategoryFaqRoot & { id: number }>): CategoryFaqPlan {
  const { rows, issues } = parseRows(file);
  const rootsBySlug = new Map(roots.map((root) => [root.slug, root]));
  const grouped = new Map<string, { faqs: CatalogueCategoryFaq[]; firstRow: number }>();
  let skipped = 0;

  if (!issues.length) {
    rows.forEach((row, index) => {
      const rowNumber = index + 2;
      const question = row.question;
      const answer = row.answer;
      if (!question && !answer) {
        skipped += 1;
        return;
      }
      if (!row.slug) {
        issues.push({ row: rowNumber, column: "slug", problem: "Root category slug is required." });
        return;
      }
      const root = rootsBySlug.get(row.slug);
      if (!root) {
        issues.push({ row: rowNumber, column: "slug", problem: `"${row.slug}" is not a root category. Copy the slug from the Root categories sheet.` });
        return;
      }
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
      const current = grouped.get(root.slug) ?? { faqs: [], firstRow: rowNumber };
      current.faqs.push({ question, answer });
      grouped.set(root.slug, current);
    });

    for (const [slug, group] of grouped) {
      if (group.faqs.length > CATEGORY_FAQ_LIMIT) {
        issues.push({
          row: group.firstRow,
          column: "question",
          problem: `"${slug}" has ${group.faqs.length} FAQs; maximum is ${CATEGORY_FAQ_LIMIT}.`,
        });
      }
    }
  }

  const planned: PlannedCategoryFaqs[] = issues.length
    ? []
    : [...grouped.entries()].map(([slug, group]) => {
      const root = rootsBySlug.get(slug)!;
      return { id: root.id, slug, name: root.name, faqs: group.faqs };
    });

  return {
    token: tokenFor(file),
    rows: rows.length,
    created: 0,
    updated: planned.length,
    skipped,
    issues,
    plannedChanges: planned.map((item) => `Replace ${item.faqs.length} FAQ${item.faqs.length === 1 ? "" : "s"} on ${item.name} (${publicPath(item.slug)}).`),
    planned,
  };
}

async function loadRoots() {
  const categories = await db.select().from(catalogueCategoriesTable);
  return categories
    .filter((category) => category.parentId === null)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name) || left.id - right.id)
    .map((category) => ({
      id: category.id,
      slug: category.slug,
      name: category.name,
      active: category.active,
      faqs: category.faqs ?? [],
    }));
}

export async function dryRunCategoryFaqImport(file: Buffer): Promise<CategoryFaqImportReport> {
  const { planned: _planned, ...report } = planCategoryFaqImport(file, await loadRoots());
  return report;
}

export async function categoryFaqTemplateFile() {
  const roots = await loadRoots();
  return categoryFaqImportTemplate(roots);
}

export async function commitCategoryFaqImport(file: Buffer, token: string) {
  const plan = planCategoryFaqImport(file, await loadRoots());
  if (token !== plan.token) throw new Error("This workbook has changed since the dry run. Run the dry run again.");
  if (plan.issues.length) throw new Error(plan.issues.map((issue) => `Row ${issue.row}: ${issue.problem}`).join(" "));

  const now = new Date();
  await db.transaction(async (tx) => {
    for (const item of plan.planned) {
      await tx.update(catalogueCategoriesTable)
        .set({ faqs: item.faqs, updatedAt: now })
        .where(eq(catalogueCategoriesTable.id, item.id));
    }
  });
  const { planned: _planned, ...report } = plan;
  return report;
}
