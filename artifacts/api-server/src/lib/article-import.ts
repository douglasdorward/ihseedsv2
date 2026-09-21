import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import * as XLSX from "xlsx";
import {
  articlesTable,
  db,
  insertArticleSchema,
  withArticleSearchMetadata,
  type Article,
  type ArticlePublishStatus,
} from "@workspace/db";
import { normalizeArticleBody } from "./article-body";
import { findRelatedProductIssues, isFuturePublishDate, parseScheduledPublishAt, publishValidationIssues } from "./article-publish";
import { syncArticleMediaReferences } from "./media-usage";

export const ARTICLE_IMPORT_HEADERS = [
  "title",
  "slug",
  "excerpt",
  "body",
  "tags",
  "hero_image_src",
  "related_product_slugs",
  "seo_title",
  "seo_description",
  "social_title",
  "social_description",
  "social_image",
  "robots_index",
  "publish_status",
  "published_at",
  "scheduled_publish_at",
] as const;

const ARTICLE_SHEET = "Articles";
const PRODUCTS_SHEET = "Products";
const CATEGORIES_SHEET = "Categories";
const INSTRUCTIONS_SHEET = "Instructions";
const AGENT_PROMPT_SHEET = "Agent prompt";
const LOOKUP_SHEETS = new Set([PRODUCTS_SHEET, CATEGORIES_SHEET, INSTRUCTIONS_SHEET, AGENT_PROMPT_SHEET]);
const PRODUCT_HEADERS = ["slug", "name", "category", "category_slug", "path"] as const;
const CATEGORY_HEADERS = ["slug", "name", "path"] as const;
const EXCEL_CELL_LIMIT = 32767;

export const ARTICLE_AGENT_PROMPT = `You are preparing an IH Seeds blog import workbook for Admin → Blog → Import.

OUTPUT
- Create an .xlsx with sheets: Articles (required), Products (lookup), Categories (lookup), Instructions (optional), and Agent prompt (optional).
- The Articles sheet MUST use these exact header names in row 1, in this order:
  title, slug, excerpt, body, tags, hero_image_src, related_product_slugs, seo_title, seo_description, social_title, social_description, social_image, robots_index, publish_status, published_at, scheduled_publish_at
- One article per row. Do not add extra columns. Do not rename headers.
- The Products sheet is a lookup of currently linkable products. Copy product slugs into related_product_slugs. Use the path column for in-article links such as <a href="/products/ryegrass/haifa-white-clover">Haifa White Clover</a>. Do not put article rows there; it is not imported.
- The Categories sheet is a lookup of public category landings. Copy a slug or path into body links such as <a href="/products/ryegrass">Ryegrass</a>. Do not put article rows there; it is not imported.
- Matching is by slug: same slug updates an existing article. Rows omitted from the file are not deleted.
- Leave a cell blank to use the default. Do not put formulas in any cell.

COLUMN RULES
- title (required): public H1. Max 180 characters. Do not use ™ or ®.
- slug (required): lowercase kebab-case, pattern ^[a-z0-9]+(?:-[a-z0-9]+)*$, max 180. Example: autumn-sowing-window
- excerpt: 1–2 sentences for the Resources card. Max 500. Required if publish_status is Published or Scheduled.
- body: article HTML or markdown as PLAIN TEXT in the cell. Max 32,767 characters (Excel cell limit). Required if Published or Scheduled.
- tags: up to 12, separated with |. Prefer: Editorial | Sowing & Timing | Feed Planning | Regional Advice. Custom tags allowed, max 80 chars each.
- hero_image_src: image URL only, max 500. Example: https://… or /api/media/{id}. Do not embed files. Leave blank if unknown.
- related_product_slugs: up to 3 product slugs from the Products sheet, separated with |. Example: urana-subterranean-clover|haifa-white-clover. Use the slug column, not the product name. Invalid or unpublished slugs will fail import. Leave blank if none. For a clickable product or category in the body, use the path column from Products or Categories.
- seo_title: max 180. Required if Published or Scheduled. No ™ or ®. Aim ~60 characters.
- seo_description: max 2000. Required if Published or Scheduled. Aim ~155 characters. Plain text only.
- social_title, social_description, social_image: optional Open Graph overrides. Blank falls back to SEO/excerpt/hero.
- robots_index: yes or no. Blank = yes.
- publish_status: Draft, Published, or Scheduled. Blank = Draft.
- published_at: optional public date for backdating. ISO datetime with timezone, e.g. 2024-03-18T09:00:00+08:00. Must not be in the future. Blank on a new Published row uses the time of import/publish; blank on an update keeps the existing date. This is the date shown on Resources. Do not use this for future go-live.
- scheduled_publish_at: required when status is Scheduled. ISO datetime with timezone, e.g. 2026-10-01T09:00:00+08:00. If the time is already in the past, import will publish immediately. Ignore published_at for Scheduled rows until they go live.

BODY FORMATTING (IMPORTANT)
Excel Bold/Italic/Heading toolbar formatting is IGNORED. Put HTML or markdown characters in the cell.

Preferred: HTML as a single cell string. Allowed tags only:
p, h2, h3, strong, em, u, a, ul, ol, li, blockquote, br
- Do not use h1 (it is converted to h2). The title is already the page H1.
- <b> becomes <strong>, <i> becomes <em>, <div> becomes <p>.
- Links: href must be /internal-path or http(s)://. No javascript: links.
- No script, style, images, tables, or classes/inline styles. Extra tags are stripped.
- Wrap paragraphs in <p>. Use <h2> for headings and <h3> for subheadings.

Example body cell:
<h2>Sowing window</h2><p>Plant <strong>early</strong> in autumn for the best establishment.</p><h3>Rates</h3><ul><li>Light soils: 8 kg/ha</li><li>Heavier soils: 12 kg/ha</li></ul><p>See the <a href="/contact">contact page</a> for local advice.</p>

Markdown is also accepted if the cell does not look like HTML:
## Heading
### Subheading
**bold** *italic*
[contact](/contact)
- bullet
1. numbered
> quote

Separate markdown blocks with a blank line.

PUBLISHING
- Draft: title + slug are enough.
- Published or Scheduled also require excerpt, body (with visible text), seo_title, and seo_description.
- Default new rows to Draft unless the user explicitly wants them live, backdated, or scheduled.
- To backdate a live post: publish_status = Published and published_at = a past ISO datetime.
- To schedule: publish_status = Scheduled and scheduled_publish_at = a future ISO datetime.

QUALITY
- Australian English. Practical pasture/seed advice tone, not marketing fluff.
- Each slug unique in the file.
- Do not start a cell with = (Excel will treat it as a formula).
- Keep body well under 32,767 characters.
- After writing the file, sanity-check: every Published/Scheduled row has all required fields; every body cell contains actual <h2>/<p>/<strong> tags or markdown, not untagged plain paragraphs if headings/bold were requested; every published_at is in the past or blank.

If source material is Word, Google Docs, or web copy, convert formatting to the HTML tags above. Return the .xlsx and a short row-by-row summary of title, slug, publish_status, and published_at or scheduled_publish_at.`;

const INSTRUCTION_ROWS: Array<[string, string]> = [
  ["Topic", "Detail"],
  ["Body formatting", "Put HTML or markdown in the body cell as plain text. Excel Bold/Italic toolbar formatting is not imported."],
  ["Allowed HTML", "p, h2, h3, strong, em, u, a, ul, ol, li, blockquote, br. Example: <h2>Heading</h2><p>Copy with <strong>bold</strong>.</p>"],
  ["Markdown", "## Heading, ### Subheading, **bold**, *italic*, [link](/contact), lists and blockquotes also work."],
  ["Cell limit", `Excel cells are limited to ${EXCEL_CELL_LIMIT.toLocaleString()} characters. Longer articles should be edited in admin.`],
  ["Hero images", "Use an image URL. Upload files in the article editor after import."],
  ["Tags", "Separate tags with |. Example: Editorial|Sowing & Timing"],
  ["Linked products", "Copy up to three slugs from the Products sheet into related_product_slugs, separated with |. Example: urana-subterranean-clover|haifa-white-clover. Use slug, not the product name. Products.path is the public product URL for body links."],
  ["Category links", "Copy a slug or path from the Categories sheet into body links, e.g. <a href=\"/products/ryegrass\">Ryegrass</a>. Categories are a lookup and are not imported."],
  ["Status", "Draft, Published or Scheduled. Blank is Draft. Published and Scheduled rows need excerpt, body, SEO title and SEO description."],
  ["Published date", "Optional published_at backdates the public date. Use an ISO datetime such as 2024-03-18T09:00:00+08:00. Must not be in the future. Blank uses the time of import/publish."],
  ["Schedule", "For Scheduled rows, set scheduled_publish_at to an ISO datetime such as 2026-10-01T09:00:00+08:00."],
  ["Agent prompt", "The Agent prompt sheet is a copyable brief for another agent. It includes published_at for backdating and scheduled_publish_at for future go-live."],
  ["Matching", "Rows update existing articles with the same slug. Articles omitted from the file are not deleted."],
];

type Header = (typeof ARTICLE_IMPORT_HEADERS)[number];
type SourceRow = Record<Header, string>;

export type ArticleImportIssue = {
  row: number;
  column: string;
  problem: string;
};

export type ArticleImportReport = {
  token: string;
  rows: number;
  created: number;
  updated: number;
  skipped: number;
  issues: ArticleImportIssue[];
  plannedChanges: string[];
};

type PlannedArticle = {
  row: number;
  existingId: number | null;
  values: {
    title: string;
    slug: string;
    excerpt: string;
    body: string;
    tags: string[];
    heroImageSrc: string;
    heroImageAssetId: string | null;
    relatedProductSlugs: string[];
    seoTitle: string;
    seoDescription: string;
    socialTitle: string;
    socialDescription: string;
    socialImage: string;
    robotsIndex: boolean;
  };
  publishStatus: ArticlePublishStatus;
  publishedAt: Date | null;
  scheduledPublishAt: Date | null;
};

function tokenFor(file: Buffer) {
  return createHash("sha256").update(file).digest("hex");
}

function cellText(value: unknown) {
  if (value == null) return "";
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toISOString();
  return String(value).trim();
}

function headerKey(value: unknown) {
  return cellText(value).toLowerCase().replace(/[\s-]+/g, "_");
}

function splitList(value: string) {
  return [...new Set(value.split(/[|,]/).map((item) => item.trim()).filter(Boolean))];
}

function parseRobots(raw: string) {
  const value = raw.trim().toLowerCase();
  if (!value) return true;
  if (["yes", "true", "1", "y", "index"].includes(value)) return true;
  if (["no", "false", "0", "n", "noindex"].includes(value)) return false;
  return null;
}

function parseStatus(raw: string): ArticlePublishStatus | null {
  const value = raw.trim().toLowerCase();
  if (!value || value === "draft") return "Draft";
  if (value === "published" || value === "publish") return "Published";
  if (value === "scheduled" || value === "schedule") return "Scheduled";
  return null;
}

function assetIdFromSrc(src: string) {
  const match = src.trim().match(/^\/api\/media\/([^/?#]+)/);
  return match?.[1] ?? null;
}

function joinList(items: string[] | null | undefined) {
  return (items ?? []).join("|");
}

function formatSchedule(value: Date | null) {
  return value ? value.toISOString() : "";
}

export type ArticleWorkbookLookups = {
  products: Array<{ slug: string; name: string; category: string; category_slug: string; path: string }>;
  categories: Array<{ slug: string; name: string; path: string }>;
};

const EMPTY_PRODUCT = { slug: "", name: "", category: "", category_slug: "", path: "" };
const EMPTY_CATEGORY = { slug: "", name: "", path: "" };

function workbookFromRows(rows: Array<Record<Header, string>>, lookups: ArticleWorkbookLookups = { products: [], categories: [] }) {
  const book = XLSX.utils.book_new();
  const articleRows = rows.length ? rows : [Object.fromEntries(ARTICLE_IMPORT_HEADERS.map((header) => [header, ""])) as SourceRow];
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(articleRows, { header: [...ARTICLE_IMPORT_HEADERS] }), ARTICLE_SHEET);
  const productRows = lookups.products.length ? lookups.products : [EMPTY_PRODUCT];
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(productRows, { header: [...PRODUCT_HEADERS] }), PRODUCTS_SHEET);
  const categoryRows = lookups.categories.length ? lookups.categories : [EMPTY_CATEGORY];
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(categoryRows, { header: [...CATEGORY_HEADERS] }), CATEGORIES_SHEET);
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(INSTRUCTION_ROWS), INSTRUCTIONS_SHEET);
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([
    ["Copy this prompt into another agent. Attach this workbook and/or the source copy."],
    [ARTICLE_AGENT_PROMPT],
  ]), AGENT_PROMPT_SHEET);
  return XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function articleImportTemplate(lookups: ArticleWorkbookLookups = { products: [], categories: [] }) {
  return workbookFromRows([], lookups);
}

export function articlesToWorkbook(
  articles: Article[],
  lookups: ArticleWorkbookLookups = { products: [], categories: [] },
) {
  return workbookFromRows(articles.map((article) => ({
    title: article.title,
    slug: article.slug,
    excerpt: article.excerpt,
    body: article.body,
    tags: joinList(article.tags),
    hero_image_src: article.heroImageSrc,
    related_product_slugs: joinList(article.relatedProductSlugs),
    seo_title: article.seoTitle,
    seo_description: article.seoDescription,
    social_title: article.socialTitle,
    social_description: article.socialDescription,
    social_image: article.socialImage,
    robots_index: article.robotsIndex ? "yes" : "no",
    publish_status: article.publishStatus,
    published_at: formatSchedule(article.publishedAt),
    scheduled_publish_at: formatSchedule(article.scheduledPublishAt),
  })), lookups);
}

function articlesSheet(book: XLSX.WorkBook) {
  if (book.Sheets[ARTICLE_SHEET]) return book.Sheets[ARTICLE_SHEET];
  const name = book.SheetNames.find((sheet) => !LOOKUP_SHEETS.has(sheet)) ?? book.SheetNames[0];
  return name ? book.Sheets[name] : undefined;
}

function parseRows(file: Buffer) {
  const issues: ArticleImportIssue[] = [];
  let book: XLSX.WorkBook;
  try {
    book = XLSX.read(file, { type: "buffer", cellDates: true });
  } catch {
    return { rows: [] as SourceRow[], issues: [{ row: 1, column: "title", problem: "The file is not a valid Excel workbook." }] };
  }
  const sheet = articlesSheet(book);
  if (!sheet) {
    return { rows: [] as SourceRow[], issues: [{ row: 1, column: "title", problem: "The workbook has no Articles sheet." }] };
  }
  const table = XLSX.utils.sheet_to_json<(string | number | Date | boolean | null)[]>(sheet, { header: 1, defval: "", raw: true });
  const headerRow = table[0] ?? [];
  const indexes = new Map<string, number>();
  headerRow.forEach((header, index) => {
    const key = headerKey(header);
    if (key && !indexes.has(key)) indexes.set(key, index);
  });
  const missing = ["title", "slug"].filter((header) => !indexes.has(header));
  if (missing.length) {
    return { rows: [] as SourceRow[], issues: [{ row: 1, column: missing[0] ?? "title", problem: `Missing columns: ${missing.join(", ")}.` }] };
  }
  const rows: SourceRow[] = [];
  for (let index = 1; index < table.length; index += 1) {
    const source = table[index] ?? [];
    const row = Object.fromEntries(ARTICLE_IMPORT_HEADERS.map((header) => {
      const column = indexes.get(header);
      return [header, column == null ? "" : cellText(source[column])];
    })) as SourceRow;
    rows.push(row);
  }
  return { rows, issues };
}

async function planImport(file: Buffer) {
  const { rows, issues } = parseRows(file);
  const existing = await db.select().from(articlesTable);
  const existingBySlug = new Map(existing.map((article) => [article.slug, article]));
  const planned: PlannedArticle[] = [];
  const plannedChanges: string[] = [];
  const seenSlugs = new Set<string>();
  let skipped = 0;
  const now = new Date();

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]!;
    const rowNumber = index + 2;
    if (ARTICLE_IMPORT_HEADERS.every((header) => !row[header])) {
      skipped += 1;
      continue;
    }
    if (!row.title) {
      issues.push({ row: rowNumber, column: "title", problem: "Title is required." });
      continue;
    }
    if (!row.slug) {
      issues.push({ row: rowNumber, column: "slug", problem: "Slug is required." });
      continue;
    }
    if (row.body.length > EXCEL_CELL_LIMIT) {
      issues.push({ row: rowNumber, column: "body", problem: `Body exceeds the Excel cell limit of ${EXCEL_CELL_LIMIT.toLocaleString()} characters.` });
      continue;
    }

    const parsed = insertArticleSchema.safeParse({
      title: row.title,
      slug: row.slug,
      excerpt: row.excerpt,
      body: normalizeArticleBody(row.body),
      tags: splitList(row.tags),
      heroImageSrc: row.hero_image_src,
      heroImageAssetId: assetIdFromSrc(row.hero_image_src),
      relatedProductSlugs: splitList(row.related_product_slugs),
      seoTitle: row.seo_title,
      seoDescription: row.seo_description,
      socialTitle: row.social_title,
      socialDescription: row.social_description,
      socialImage: row.social_image,
      robotsIndex: true,
    });
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      const column = String(first?.path[0] ?? "title");
      issues.push({ row: rowNumber, column, problem: first?.message ?? "Article fields are invalid." });
      continue;
    }

    const robotsIndex = parseRobots(row.robots_index);
    if (robotsIndex == null) {
      issues.push({ row: rowNumber, column: "robots_index", problem: "Robots index must be yes or no." });
      continue;
    }
    const publishStatus = parseStatus(row.publish_status);
    if (!publishStatus) {
      issues.push({ row: rowNumber, column: "publish_status", problem: "Status must be Draft, Published or Scheduled." });
      continue;
    }
    const scheduled = parseScheduledPublishAt(row.scheduled_publish_at);
    if (row.scheduled_publish_at && !scheduled) {
      issues.push({ row: rowNumber, column: "scheduled_publish_at", problem: "Scheduled publish time must be a valid date." });
      continue;
    }
    if (publishStatus === "Scheduled" && !scheduled) {
      issues.push({ row: rowNumber, column: "scheduled_publish_at", problem: "Scheduled articles need a publish date and time." });
      continue;
    }
    const publishedAt = parseScheduledPublishAt(row.published_at);
    if (row.published_at && !publishedAt) {
      issues.push({ row: rowNumber, column: "published_at", problem: "Published date must be a valid date." });
      continue;
    }
    if (publishedAt && isFuturePublishDate(publishedAt, now)) {
      issues.push({ row: rowNumber, column: "published_at", problem: "Published date cannot be in the future. Use scheduled_publish_at to schedule a post." });
      continue;
    }

    const values = withArticleSearchMetadata({
      ...parsed.data,
      robotsIndex,
    });
    if (seenSlugs.has(values.slug)) {
      issues.push({ row: rowNumber, column: "slug", problem: `Slug "${values.slug}" is used more than once in this file.` });
      continue;
    }
    seenSlugs.add(values.slug);

    if (publishStatus === "Published" || publishStatus === "Scheduled") {
      const missing = publishValidationIssues(values);
      if (missing.length) {
        issues.push({
          row: rowNumber,
          column: missing[0]?.field ?? "title",
          problem: `Complete these fields before ${publishStatus === "Published" ? "publishing" : "scheduling"}: ${missing.map((issue) => issue.label).join(", ")}.`,
        });
        continue;
      }
      const invalid = await findRelatedProductIssues(values.relatedProductSlugs);
      if (invalid.length) {
        issues.push({
          row: rowNumber,
          column: "related_product_slugs",
          problem: `Linked products contains invalid product references: ${invalid.join(", ")}.`,
        });
        continue;
      }
    }

    const existingArticle = existingBySlug.get(values.slug);
    let nextStatus = publishStatus;
    let nextScheduled = publishStatus === "Scheduled" ? scheduled : null;
    if (publishStatus === "Scheduled" && scheduled && scheduled.getTime() <= now.getTime()) {
      nextStatus = "Published";
      nextScheduled = null;
    }

    planned.push({
      row: rowNumber,
      existingId: existingArticle?.id ?? null,
      values,
      publishStatus: nextStatus,
      publishedAt: nextStatus === "Scheduled" ? null : publishedAt,
      scheduledPublishAt: nextScheduled,
    });
    const action = existingArticle ? "Update" : "Create";
    const statusNote = nextStatus === "Published" && publishStatus === "Scheduled"
      ? " and publish now because the scheduled time has passed"
      : nextStatus === "Published"
        ? (publishedAt ? ` and publish dated ${publishedAt.toISOString()}` : " and publish")
        : nextStatus === "Scheduled"
          ? ` and schedule for ${nextScheduled?.toISOString()}`
          : " as a draft";
    plannedChanges.push(`${action} ${values.title}${statusNote}.`);
  }

  return {
    token: tokenFor(file),
    rows: rows.length,
    created: planned.filter((item) => item.existingId == null).length,
    updated: planned.filter((item) => item.existingId != null).length,
    skipped,
    issues,
    plannedChanges,
    planned,
  };
}

export async function dryRunArticleImport(file: Buffer): Promise<ArticleImportReport> {
  const { planned: _planned, ...report } = await planImport(file);
  return report;
}

export async function commitArticleImport(file: Buffer, token: string) {
  const plan = await planImport(file);
  if (token !== plan.token) throw new Error("IMPORT_TOKEN_MISMATCH");
  if (plan.issues.length) throw new Error(plan.issues.map((issue) => `Row ${issue.row}: ${issue.problem}`).join(" "));

  const now = new Date();
  const saved: Article[] = [];
  await db.transaction(async (tx) => {
    for (const item of plan.planned) {
      const statusValues = {
        publishStatus: item.publishStatus,
        publishedAt: item.publishStatus === "Published"
          ? (item.publishedAt ?? now)
          : item.publishStatus === "Draft"
            ? item.publishedAt
            : null,
        scheduledPublishAt: item.scheduledPublishAt,
        updatedAt: now,
      };
      if (item.existingId) {
        const existing = await tx.select({ publishedAt: articlesTable.publishedAt }).from(articlesTable).where(eq(articlesTable.id, item.existingId));
        const [updated] = await tx.update(articlesTable).set({
          ...item.values,
          ...statusValues,
          publishedAt: item.publishStatus === "Published"
            ? (item.publishedAt ?? existing[0]?.publishedAt ?? now)
            : item.publishStatus === "Draft"
              ? (item.publishedAt ?? existing[0]?.publishedAt ?? null)
              : existing[0]?.publishedAt ?? null,
        }).where(eq(articlesTable.id, item.existingId)).returning();
        if (updated) saved.push(updated);
        continue;
      }
      const [created] = await tx.insert(articlesTable).values({
        ...item.values,
        ...statusValues,
      }).returning();
      if (created) saved.push(created);
    }
  });
  for (const article of saved) await syncArticleMediaReferences(article);
  const { planned: _planned, ...report } = plan;
  return report;
}
