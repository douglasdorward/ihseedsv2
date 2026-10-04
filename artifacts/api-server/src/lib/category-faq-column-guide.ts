import * as XLSX from "xlsx";
import { COLUMN_GUIDE_HEADERS, COLUMN_GUIDE_SHEET } from "./product-column-guide.ts";

export const CATEGORY_FAQ_LIMIT = 10;
export const CATEGORY_FAQ_QUESTION_MAX = 200;
export const CATEGORY_FAQ_ANSWER_MAX = 2000;
export const CATEGORY_PAGE_HEADING_MAX = 180;
export const CATEGORY_LEAD_MAX = 1000;
export const CATEGORY_SEO_TITLE_MAX = 180;
export const CATEGORY_SEO_DESCRIPTION_MAX = 2000;
export const CATEGORY_SOCIAL_TITLE_MAX = 180;
export const CATEGORY_SOCIAL_DESCRIPTION_MAX = 2000;
export const CATEGORY_SOCIAL_IMAGE_MAX = 500;

export const CATEGORY_FAQ_SHEET = "FAQs";
export const CATEGORY_FAQ_CATEGORIES_SHEET = "Categories";
/** Name of the same sheet in workbooks exported before sub-categories were included. */
export const CATEGORY_FAQ_LEGACY_CATEGORIES_SHEET = "Root categories";

/** Header row of each sheet in the FAQ export, in export order. The guide must explain every one. */
export const CATEGORY_FAQ_SHEET_HEADERS = {
  [CATEGORY_FAQ_SHEET]: ["slug", "parent_slug", "category_name", "question", "answer"],
  [CATEGORY_FAQ_CATEGORIES_SHEET]: ["slug", "parent_slug", "level", "name", "path", "active", "page_heading", "intro", "seo_title", "seo_description", "social_title", "social_description", "social_image", "faq_count"],
} as const;

type GuideRow = readonly [string, string, string, string, string];

const RULES: GuideRow[] = [
  [
    "Workbook rules",
    "How to use this sheet",
    "Read before editing",
    "This sheet is for the person or agent refining the file. It is not imported. Do not rename any sheet, do not rename headers, and do not add columns. Filter the Sheet column to read one worksheet at a time. Each row below names the cell, the value it expects, and the place a customer sees it. Start from a current Export Categories file so the FAQs and Categories sheets already hold what is live.",
    "Nothing on this sheet is published.",
  ],
  [
    "Workbook rules",
    "What to write",
    "Always",
    "The Categories sheet lists every root category and every sub-category with its current page heading, intro, SEO title and meta description, and the FAQs sheet starts with one row per stored FAQ. A category with no FAQs yet has one blank starter row. Write the search and page copy and the FAQs for each active category, root or sub-category, because each has its own public page. faq_count 0 on Categories means that page has no FAQs yet.",
    "A category page shows an FAQs section only when it has at least one complete question and answer.",
  ],
  [
    "Workbook rules",
    "Identity and replacement",
    "Always",
    `A category is identified by slug, plus parent_slug for a sub-category. Root categories have a blank parent_slug. A sub-category slug is only unique inside its root, so always copy both columns from Categories and never invent either. One FAQ per row. Repeat a category's slug (and parent_slug) for each extra question, up to ${CATEGORY_FAQ_LIMIT} per category. A category is updated only when at least one of its rows has both a question and an answer. Those complete rows then replace that category's stored FAQs, so keep every FAQ you still want, including the existing ones already exported. Categories left out of the file, or listed only with blank question and answer cells, keep their current FAQs. Blank rows never clear FAQs.`,
    "A replaced set changes the FAQs on that category page. Categories not named in the file are untouched.",
  ],
  [
    "Workbook rules",
    "Search, social and page copy",
    "Optional",
    "page_heading, intro, seo_title, seo_description, social_title, social_description and social_image on the Categories sheet are imported. The export fills them with the values stored today, so only edit the cells you mean to change. Each category listed on the Categories sheet is set to exactly what those cells say. A blank cell clears that field so the page falls back to its default. Delete a category's row, or leave the columns out, to leave its copy untouched. Do not use the ™ or ® symbols in seo_title or seo_description, because they are removed on import.",
    "Changes the H1, the intro under it, the browser tab and Google title, the search result description, and how the category page looks when shared on social media.",
  ],
  [
    "Workbook rules",
    "Cell formats",
    "Always",
    "Plain text. Excel bold, italic, and heading buttons are ignored. Do not use HTML and do not start a cell with =. A blank cell stores no value. An Excel cell cannot hold more than 32,767 characters.",
    "Anything other than plain text is shown literally or rejected.",
  ],
  [
    "Workbook rules",
    "Agent prompt",
    "Optional",
    "The Agent prompt sheet is a copyable brief for another agent. Attach this workbook so the agent can see which categories need copy and what is already published.",
    "Nothing on that sheet is published.",
  ],
];

const FAQS: GuideRow[] = [
  [
    CATEGORY_FAQ_SHEET,
    "slug",
    "Every row where question or answer is filled",
    "Category slug, copied exactly from the slug column of Categories, for example ryegrass, or aerial-seeded-annual for a sub-category. Rows with a blank question and answer are ignored, so their slug is only a placeholder.",
    "Not shown from this cell. It decides which category page receives the FAQ.",
  ],
  [
    CATEGORY_FAQ_SHEET,
    "parent_slug",
    "Required for sub-category rows. Blank for root categories.",
    "The slug of the root category that holds a sub-category, for example clovers. Leave it blank for a root category. Together with slug it names the page, because two roots can each have a sub-category with the same slug.",
    "Not shown from this cell. It decides which sub-category page receives the FAQ.",
  ],
  [
    CATEGORY_FAQ_SHEET,
    "category_name",
    "Label only. Not imported.",
    "Copy of the category name so a row is recognisable, for example Ryegrass. Changing it does not rename the category. Names, URLs and the sub-category list are edited in Products & mixes.",
    "Not shown from this cell.",
  ],
  [
    CATEGORY_FAQ_SHEET,
    "question",
    `Required with answer. Max ${CATEGORY_FAQ_QUESTION_MAX} characters.`,
    "The question a grower would ask, in plain text, for example When should I sow clover? Make each question unique within a category. Leave question and answer both blank to skip a row. A question without an answer is rejected.",
    "The clickable FAQ summary in the FAQs section of the category page. Also the question in FAQ structured data.",
  ],
  [
    CATEGORY_FAQ_SHEET,
    "answer",
    `Required with question. Max ${CATEGORY_FAQ_ANSWER_MAX} characters.`,
    "One plain-text answer in Australian English. Do not use HTML. Short paragraphs a customer can read on the category page. Do not invent product variety claims, because these FAQs sit above the product list. An answer without a question is rejected.",
    "Paragraph revealed when the question is opened.",
  ],
];

const CATEGORIES: GuideRow[] = [
  [
    CATEGORY_FAQ_CATEGORIES_SHEET,
    "slug",
    "Required on every row. Identity, not changed by import.",
    "The permanent slug of a category, for example ryegrass, or aerial-seeded-annual for a sub-category. One row for every root category and sub-category, active or not. Copy it exactly and never invent one. It also tells the FAQs sheet which category a row belongs to.",
    "Last part of the category address.",
  ],
  [
    CATEGORY_FAQ_CATEGORIES_SHEET,
    "parent_slug",
    "Required on sub-category rows. Identity, not changed by import.",
    "Blank for a root category. For a sub-category, the slug of its root category, for example clovers. A sub-category slug is only unique inside its root, so slug and parent_slug together identify the page.",
    "The category part of a sub-category address, as in /products/clovers/aerial-seeded-annual.",
  ],
  [
    CATEGORY_FAQ_CATEGORIES_SHEET,
    "level",
    "Label only. Not imported.",
    "root or sub. Tells you whether the row is a root category page or a sub-category page.",
    "Not shown.",
  ],
  [
    CATEGORY_FAQ_CATEGORIES_SHEET,
    "name",
    "Label only. Not imported.",
    "Category display name, as it is stored today. Changing it does not rename the category. Names are edited in Products & mixes.",
    "Category heading, pill label and breadcrumb.",
  ],
  [
    CATEGORY_FAQ_CATEGORIES_SHEET,
    "path",
    "Label only. Not imported.",
    "Public page address, for example /products/ryegrass or /products/clovers/aerial-seeded-annual, so you can read the page before writing for it.",
    "The category page where the copy and FAQs appear.",
  ],
  [
    CATEGORY_FAQ_CATEGORIES_SHEET,
    "active",
    "Label only. Not imported.",
    "yes or no. Write copy and FAQs for active categories. Leave inactive categories alone unless the assignment asks for them.",
    "An inactive category is not shown on the public site.",
  ],
  [
    CATEGORY_FAQ_CATEGORIES_SHEET,
    "page_heading",
    `Imported. Optional. Max ${CATEGORY_PAGE_HEADING_MAX} characters.`,
    "The heading of the category page, for example Ryegrass Seed. Blank clears it, and the page then uses its default heading (the category name followed by Seed, or Seed Mixes for the mixes category; for a sub-category, its name followed by the root category name).",
    "The main H1 on the category page.",
  ],
  [
    CATEGORY_FAQ_CATEGORIES_SHEET,
    "intro",
    `Imported. Optional. Max ${CATEGORY_LEAD_MAX} characters.`,
    "The short introduction for the category, in plain text. On a sub-category page it is the paragraph under the heading; on a root category it is the category card description. Either way it is the meta description when seo_description is blank. Blank clears it, and a sub-category page then shows an automatic summary of its range.",
    "Paragraph under the H1 and the fallback search description.",
  ],
  [
    CATEGORY_FAQ_CATEGORIES_SHEET,
    "seo_title",
    `Imported. Optional. Max ${CATEGORY_SEO_TITLE_MAX} characters, about 60 recommended.`,
    "Plain text title for search results and the browser tab. No ™ or ® symbols, which are removed on import. Blank clears it, and the page then uses its default title.",
    "Browser tab title and the Google search result title.",
  ],
  [
    CATEGORY_FAQ_CATEGORIES_SHEET,
    "seo_description",
    `Imported. Optional. Max ${CATEGORY_SEO_DESCRIPTION_MAX} characters, about 155 recommended.`,
    "Plain text description for search results. No HTML and no ™ or ® symbols. Blank clears it, and the page then uses the category intro.",
    "The meta description and the snippet under the title in Google.",
  ],
  [
    CATEGORY_FAQ_CATEGORIES_SHEET,
    "social_title",
    `Imported. Optional. Max ${CATEGORY_SOCIAL_TITLE_MAX} characters.`,
    "Plain text title for social sharing (Facebook, LinkedIn, X, messaging apps). No ™ or ® symbols. Blank clears it, and the share then uses the SEO title.",
    "The title shown on the link card when the category page is shared.",
  ],
  [
    CATEGORY_FAQ_CATEGORIES_SHEET,
    "social_description",
    `Imported. Optional. Max ${CATEGORY_SOCIAL_DESCRIPTION_MAX} characters.`,
    "Plain text description for social sharing. No HTML and no ™ or ® symbols. Blank clears it, and the share then uses the meta description.",
    "The description shown on the link card when the category page is shared.",
  ],
  [
    CATEGORY_FAQ_CATEGORIES_SHEET,
    "social_image",
    `Imported. Optional. Max ${CATEGORY_SOCIAL_IMAGE_MAX} characters.`,
    "Public image address, either a full https:// URL or a site path starting with /. About 1200 by 630 pixels works best. Blank clears it, and the share then uses the Site settings sharing image.",
    "The picture on the link card when the category page is shared.",
  ],
  [
    CATEGORY_FAQ_CATEGORIES_SHEET,
    "faq_count",
    "Label only. Not imported.",
    "How many complete FAQs are stored today. 0 means that page still needs a set.",
    "Not shown. It counts the items in the FAQs section.",
  ],
];

const GUIDE_ROWS: GuideRow[] = [...RULES, ...FAQS, ...CATEGORIES];

export function categoryFaqColumnGuideGaps(): string[] {
  const documented = new Map<string, number>();
  for (const [sheet, column] of GUIDE_ROWS) {
    if (sheet === "Workbook rules") continue;
    const key = `${sheet}\t${column}`;
    documented.set(key, (documented.get(key) ?? 0) + 1);
  }
  const gaps: string[] = [];
  for (const [sheet, columns] of Object.entries(CATEGORY_FAQ_SHEET_HEADERS)) {
    for (const column of columns) {
      const count = documented.get(`${sheet}\t${column}`) ?? 0;
      if (count !== 1) gaps.push(`${sheet}.${column} (${count})`);
    }
  }
  return gaps;
}

export function appendCategoryFaqColumnGuide(book: XLSX.WorkBook) {
  const gaps = categoryFaqColumnGuideGaps();
  if (gaps.length) throw new Error(`COLUMN_GUIDE_INCOMPLETE:${gaps.join(", ")}`);
  const rows = [COLUMN_GUIDE_HEADERS, ...GUIDE_ROWS];
  const sheet = XLSX.utils.aoa_to_sheet(rows.map((row) => [...row]));
  sheet["!cols"] = [{ wch: 24 }, { wch: 28 }, { wch: 42 }, { wch: 88 }, { wch: 88 }];
  sheet["!autofilter"] = { ref: `A1:E${rows.length}` };
  sheet["!freeze"] = { xSplit: 0, ySplit: 1, topLeftCell: "A2", activePane: "bottomLeft", state: "frozen" };
  XLSX.utils.book_append_sheet(book, sheet, COLUMN_GUIDE_SHEET);
}
