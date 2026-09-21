import { createHash } from "node:crypto";
import * as XLSX from "xlsx";
import { eq, sql } from "drizzle-orm";
import {
  applyListingAvailability,
  catalogueCategoriesTable, db, forSearchMetadata, isActiveListing, normalizeProductDetails, productOptionsTable,
  productDraftsTable, productsTable, redirectsTable, resolveListingState, saleLinesTable,
} from "@workspace/db";
import { clearProductMediaReferences, syncProductMediaReferences } from "./media-usage.ts";
import { legacyWebsitePath, productPublicPath, requiredLegacyRedirects } from "./product-path.ts";

export const importSheetNames = ["1 Products", "2 Sowing rates", "3 Category specifics", "4 Sale lines", "5 Mix components", "7 Website SEO", "10 Product FAQs"] as const;
const PRODUCT_FAQ_SHEET = "10 Product FAQs";
const PRODUCT_FAQ_LIMIT = 10;
const PRODUCT_FAQ_QUESTION_MAX = 180;
const PRODUCT_FAQ_ANSWER_MAX = 4000;
type Row = Record<string, unknown>;
type SheetReport = { rows: number; accepted: number; skipped: number; reasons: string[] };
export type WorkbookReport = {
  token: string; hash: string; sheets: Record<string, SheetReport>;
  issues: { sheet: string; row: number; column: string; problem: string }[];
  warnings: string[]; plannedChanges: string[];
};

const PRODUCT_DETAILS: Record<string, string> = {
  record_type: "recordType", botanical_name: "botanicalName",
  persistency_type: "persistencyType",
  tagline: "tagline", blurb: "blurb", distribution_note: "distributionNote", description: "description",
  rainfall_min_mm: "rainfallMinMm",
  soil_ph_min: "soilPhMin", soil_ph_scale: "soilPhScale", soil_range_lightest: "soilRangeLightest",
  soil_range_heaviest: "soilRangeHeaviest", sowing_depth_min_cm: "sowingDepthMinCm",
  sowing_depth_max_cm: "sowingDepthMaxCm",
  disease_pest_resistance: "diseasePestResistance", stand_life_notes: "standLifeNotes",
  grazing_management_notes: "grazingManagementNotes",
  pbr_details: "pbrDetails",
};
const SPECIFICS: Record<string, string> = {
  ploidy: "ploidy", heading_date: "headingDate", heading_offset_days: "headingOffsetDays",
  argt_resistant: "argtResistant", endophyte: "endophyte", growth_season: "growthSeason",
  maturity_days: "maturityDays", hard_seed_level: "hardSeedLevel", oestrogen_level: "oestrogenLevel",
  bloat_risk: "bloatRisk", flower_colour: "flowerColour", winter_activity: "winterActivity",
  growing_season: "growingSeason", weeks_to_first_grazing: "weeksToFirstGrazing",
  prussic_acid_risk: "prussicAcidRisk", regrowth: "regrowth", flowering_window: "floweringWindow",
  product_form: "productForm", application_rate: "applicationRate",
};
const NUMBER_KEYS = new Set(["rainfallMinMm", "soilPhMin", "sowingDepthMinCm", "sowingDepthMaxCm",
  "headingOffsetDays", "maturityDays", "winterActivity"]);
const BOOLEAN_KEYS = new Set(["australianBred", "pbrProtected", "argtResistant"]);
const ARRAY_KEYS: Record<string, string> = {
  end_use: "endUse", livestock: "livestock", certification: "certification",
  related_products: "relatedProducts", seed_treatment: "seedTreatment", key_attributes: "keyAttributes",
};
const BOOL_COLUMNS: Record<string, string> = {
  australian_bred: "australianBred", pbr_protected: "pbrProtected",
  argt_resistant: "argtResistant",
};
const LIFECYCLE_STATUSES = new Set(["Published", "Draft", "Archived"]);
const OPTION_ALIASES: Record<string, string> = {
  soil_ph_scale: "soil_ph_scale", context: "rate_context", unit: "rate_unit", rate_unit: "rate_unit",
  soil_range_lightest: "soil_code", soil_range_heaviest: "soil_code",
  is_default: "yes_no", australian_bred: "yes_no", pbr_protected: "yes_no",
  argt_resistant: "yes_no",
  robots_index: "yes_no", active: "yes_no",
};

function optionKey(value: string) {
  return value.normalize("NFKC").replace(/[₂]/g, "2").replace(/[–—]/g, "-").trim().toLowerCase();
}
function listedValue(optionLists: Map<string, Set<string>>, column: string, value: string) {
  const list = optionLists.get(OPTION_ALIASES[column] ?? column);
  if (!list || !value) return value;
  return [...list].find((candidate) => optionKey(candidate) === optionKey(value)) ?? value;
}
function typedValue(column: string, value: string) {
  if (column === "soil_ph_scale" && optionKey(value) === "cacl2") return "CaCl₂";
  return value;
}
const applicableSpecifics: Record<string, Set<string>> = {
  "Ryegrasses": new Set(["ploidy", "heading_date", "heading_offset_days", "argt_resistant", "endophyte"]),
  "Clovers": new Set(["maturity_days", "hard_seed_level", "oestrogen_level", "bloat_risk", "flower_colour"]),
  "Serradellas & Medics": new Set(["maturity_days", "hard_seed_level", "flower_colour", "bloat_risk"]),
  "Lucerne": new Set(["winter_activity"]),
  "Fescues & Other Grasses": new Set(["ploidy", "heading_date", "endophyte", "growth_season"]),
  "Sub-Tropical Grasses": new Set(["ploidy", "growth_season"]),
  "Forage & Grain Crops": new Set(["growing_season", "weeks_to_first_grazing", "prussic_acid_risk", "regrowth"]),
  "Mixes": new Set(["flowering_window"]),
  "Biologicals": new Set(["product_form", "application_rate"]),
};

function cell(value: unknown) { return value == null ? "" : String(value).trim(); }
function faqAnswer(value: unknown) { return value == null ? "" : String(value); }
function importedFaqs(rows: Row[], slug: string) {
  return rows
    .filter((row) => cell(row.slug) === slug)
    .map((row) => ({ question: cell(row.question), answer: faqAnswer(row.answer) }))
    .filter((faq) => faq.question || faq.answer);
}
function isNull(value: unknown) { return cell(value).toUpperCase() === "NULL"; }
function importedListingState(row: Row) {
  const state = isNull(row.listing_state) ? "" : cell(row.listing_state);
  const override = isNull(row.listing_override) ? "" : cell(row.listing_override);
  return resolveListingState({ listingState: state, listingOverride: override });
}
function yn(value: unknown) { const v = cell(value).toUpperCase(); return v === "Y" ? true : v === "N" ? false : undefined; }
function num(value: unknown) {
  const text = cell(value);
  if (!text) return null;
  const matched = text.match(/-?\d+(?:\.\d+)?/);
  if (!matched) return null;
  const n = Number(matched[0]);
  return Number.isFinite(n) ? n : null;
}
function pipe(value: unknown) { return cell(value).split("|").map((v) => v.trim()).filter(Boolean); }
function values(sheet: XLSX.WorkSheet) { return XLSX.utils.sheet_to_json<Row>(sheet, { defval: "", raw: false }); }
function isReview(value: unknown) { return /^stated\s*[–-]\s*review$/i.test(cell(value)); }
function normal(value: string) { return value.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]/g, ""); }
function taxonomySlug(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "catalogue";
}
function childTaxonomySlug(parentSlug: string, value: string) {
  const slug = taxonomySlug(value);
  const prefix = `${parentSlug}-`;
  return slug.startsWith(prefix) ? slug.slice(prefix.length) || slug : slug;
}
function publishContentErrors(payload: { name: string; slug: string; category: string; details: ReturnType<typeof normalizeProductDetails> }) {
  return [
    !payload.name.trim() && "Product name",
    !payload.slug.trim() && "Slug",
    !payload.category.trim() && "Category",
    !["Mix", "Variety", "Commodity / generic"].includes(payload.details.recordType) && "Record type",
    !payload.details.tagline.trim() && "Tagline",
    payload.details.tagline.trim().length > 60 && "Tagline (maximum 60 characters)",
    !payload.details.blurb.trim() && "Blurb",
    !payload.details.keyAttributes.some((attribute) => attribute.trim()) && "Key attributes",
    !payload.details.description.trim() && "Product description",
    !payload.details.seoTitle.trim() && "SEO title",
    !payload.details.seoDescription.trim() && "SEO description",
  ].filter(Boolean) as string[];
}
function applySeoRow(details: ReturnType<typeof normalizeProductDetails>, row: Row | undefined) {
  if (!row) return;
  if (cell(row.h1) || isNull(row.h1)) {
    details.h1 = isNull(row.h1) ? "" : cell(row.h1);
  }
   details.seoTitle = isNull(row.seo_title) ? "" : forSearchMetadata(cell(row.seo_title));
   details.seoDescription = isNull(row.meta_description) ? "" : forSearchMetadata(cell(row.meta_description));
  if (cell(row.social_title) || isNull(row.social_title)) {
    details.socialTitle = isNull(row.social_title) ? "" : forSearchMetadata(cell(row.social_title));
  }
  if (cell(row.social_description) || isNull(row.social_description)) {
    details.socialDescription = isNull(row.social_description) ? "" : forSearchMetadata(cell(row.social_description));
  }
  if (cell(row.social_image) || isNull(row.social_image)) {
    details.socialImage = isNull(row.social_image) ? "" : cell(row.social_image);
  }
  if (cell(row.canonical_url) || isNull(row.canonical_url)) {
    details.canonicalUrl = isNull(row.canonical_url) ? "" : cell(row.canonical_url);
  }
  if (yn(row.robots_index) !== undefined || isNull(row.robots_index)) {
    details.robotsIndex = isNull(row.robots_index) ? true : yn(row.robots_index)!;
  }
}

function photoValue(details: ReturnType<typeof normalizeProductDetails>, index: number) {
  const photo = details.photos[index];
  return photo?.src || photo?.file || "";
}

function applyPhotoColumns(details: Record<string, unknown>, row: Row) {
  const slots = ["Photo 1 · Hero", "Photo 2", "Photo 3"];
  const current = Array.isArray(details.photos) ? [...details.photos] as ProductPhotoRow[] : [];
  let touched = false;
  for (const [index, slot] of slots.entries()) {
    const column = `photo_${index + 1}`;
    if (!cell(row[column]) && !isNull(row[column])) continue;
    touched = true;
    const value = isNull(row[column]) ? "" : cell(row[column]);
    while (current.length <= index) current.push({ slot: slots[current.length], file: "", rating: "", src: "" });
    current[index] = { slot: current[index]?.slot || slot, file: value, rating: current[index]?.rating || "", src: value };
  }
  if (touched) details.photos = current;
}

type ProductPhotoRow = { slot: string; file: string; rating: string; src: string };

function requiredPublishContentFingerprint(payload: { name: string; slug: string; category: string; details: ReturnType<typeof normalizeProductDetails> }) {
  const { details } = payload;
  return JSON.stringify({
    name: payload.name,
    slug: payload.slug,
    category: payload.category,
    recordType: details.recordType,
    tagline: details.tagline,
    blurb: details.blurb,
    keyAttributes: details.keyAttributes,
    description: details.description,
    seoTitle: details.seoTitle,
    seoDescription: details.seoDescription,
  });
}
function equivalentRoot(left: string, right: string) {
  const aliases = [
    ["specialtymixes", "mixes"], ["ryegrass", "ryegrasses"],
    ["pastureherbs", "herbs"], ["otherproducts", "other"],
  ];
  const a = normal(left), b = normal(right);
  return a === b || aliases.some((group) => group.includes(a) && group.includes(b));
}

function orderedCategoryRows(rows: Row[]) {
  const withSlug = rows.filter((row) => cell(row.slug));
  return [
    ...withSlug.filter((row) => !cell(row.parent_slug)),
    ...withSlug.filter((row) => cell(row.parent_slug)),
  ];
}

export function readWorkbook(content: Buffer): { book: XLSX.WorkBook; rows: Record<string, Row[]> } {
  const book = XLSX.read(content, { type: "buffer", cellText: true, cellDates: false });
  const rows: Record<string, Row[]> = {};
  for (const name of importSheetNames) rows[name] = book.SheetNames.includes(name) ? values(book.Sheets[name]) : [];
  return { book, rows };
}

function lists(book: XLSX.WorkBook) {
  const result = new Map<string, Set<string>>();
  const retired = new Set(["guide_section", "inoculant_group", "seed_grade", "featured", "is_third_party_product", "in_current_printed_guide", "ecocert_approved"]);
  if (!book.SheetNames.includes("Lists")) return result;
  for (const row of values(book.Sheets.Lists)) for (const [name, raw] of Object.entries(row)) {
    if (!name || name.startsWith("__") || name === "sub_category options by category" || retired.has(name)) continue;
    const value = cell(raw); if (value) (result.get(name) ?? result.set(name, new Set()).get(name)!).add(value);
  }
  return result;
}

/** Pure parser/validator: deliberately never opens a database connection. */
export function dryRunWorkbook(content: Buffer): WorkbookReport {
  const { book, rows } = readWorkbook(content);
  const issues: WorkbookReport["issues"] = [], warnings: string[] = [];
  const productSlugs = new Set(rows["1 Products"].map((r) => cell(r.slug)).filter(Boolean));
  const seenProductSlugs = new Set<string>();
  const seenLegacyPaths = new Set<string>();
  const stocks = new Set<string>(), optionLists = lists(book);
  const sheets: Record<string, SheetReport> = {};
  for (const retired of ["6 Companions", "8 Categories", "9 Redirects"]) {
    if (book.SheetNames.includes(retired)) warnings.push(`Sheet ${retired} is no longer imported`);
  }
  for (const name of importSheetNames) {
    let skipped = 0; const reasons: string[] = [];
    rows[name].forEach((row, i) => {
      const rowNo = i + 2, slugKey = name === "5 Mix components" ? "mix_slug" : ["2 Sowing rates", "3 Category specifics", PRODUCT_FAQ_SHEET].includes(name) ? "slug" : "";
      if (name === PRODUCT_FAQ_SHEET) {
        const question = cell(row.question);
        const answer = faqAnswer(row.answer);
        if (!cell(row.slug) && !question && !answer.trim()) { skipped++; reasons.push(`row ${rowNo}: blank FAQ`); }
        else {
          if (!cell(row.slug) && (question || answer.trim())) {
            issues.push({ sheet: name, row: rowNo, column: "slug", problem: "Product slug is required" });
          }
          if (question.length > PRODUCT_FAQ_QUESTION_MAX) {
            issues.push({ sheet: name, row: rowNo, column: "question", problem: `Question must be ${PRODUCT_FAQ_QUESTION_MAX} characters or fewer` });
          }
          if (answer.length > PRODUCT_FAQ_ANSWER_MAX) {
            issues.push({ sheet: name, row: rowNo, column: "answer", problem: `Answer must be ${PRODUCT_FAQ_ANSWER_MAX} characters or fewer` });
          }
        }
      }
      if (name === "1 Products") {
        const rowHasContent = Object.values(row).some((value) => cell(value));
        if (rowHasContent) {
          for (const column of ["slug", "product_name", "category", "record_type"]) {
            if (!cell(row[column])) {
              issues.push({ sheet: name, row: rowNo, column, problem: "Required for every product row" });
            }
          }
          const slug = cell(row.slug);
          if (slug && seenProductSlugs.has(slug)) {
            issues.push({ sheet: name, row: rowNo, column: "slug", problem: `Duplicate product slug "${slug}"` });
          }
          if (slug) seenProductSlugs.add(slug);
          const rawLegacyUrl = cell(row.website_url);
          if (rawLegacyUrl) {
            const fromPath = legacyWebsitePath(rawLegacyUrl);
            if (!fromPath) {
              issues.push({
                sheet: name,
                row: rowNo,
                column: "website_url",
                problem: "Legacy website URL must be an http(s) URL on www.irwinhunter.com.au without a query or fragment",
              });
            } else if (seenLegacyPaths.has(fromPath)) {
              issues.push({
                sheet: name,
                row: rowNo,
                column: "website_url",
                problem: `Duplicate legacy website path "${fromPath}"`,
              });
            } else {
              seenLegacyPaths.add(fromPath);
              const approximateDestination = `/products/${taxonomySlug(cell(row.category))}/${slug}`;
              if (fromPath === approximateDestination) {
                issues.push({
                  sheet: name,
                  row: rowNo,
                  column: "website_url",
                  problem: "Legacy website URL cannot already be the product's new canonical path",
                });
              }
            }
          }
        }
        const lifecycle = cell(row.status);
        if (lifecycle && !LIFECYCLE_STATUSES.has(lifecycle)) {
          issues.push({ sheet: name, row: rowNo, column: "status", problem: `Invalid lifecycle status "${lifecycle}"` });
        } else if (lifecycle === "Published") {
          const details = normalizeProductDetails({});
          applyProductRow(details as unknown as Record<string, unknown>, row);
          applySeoRow(details, rows["7 Website SEO"].find((seoRow) => cell(seoRow.product_slug) === cell(row.slug)));
          const missing = publishContentErrors({
            name: cell(row.product_name), slug: cell(row.slug), category: cell(row.category), details,
          });
          if (missing.length) issues.push({
            sheet: name, row: rowNo, column: "status",
            problem: `Published products require: ${missing.join(", ")}`,
          });
        }
      }
      if (name === "4 Sale lines" && !cell(row.slug)) { skipped++; reasons.push(`row ${rowNo}: blank slug (not in catalogue)`); }
      if (slugKey && cell(row[slugKey]) && !productSlugs.has(cell(row[slugKey]))) issues.push({ sheet: name, row: rowNo, column: slugKey, problem: "Unresolved product slug" });
      if (name === "4 Sale lines") { const code = cell(row.stock_code); if (code && stocks.has(code)) issues.push({ sheet: name, row: rowNo, column: "stock_code", problem: "Duplicate stock code" }); if (code) stocks.add(code); }
      for (const reference of name === "5 Mix components" ? ["component_slug"] : []) {
        if (cell(row[reference]) && !productSlugs.has(cell(row[reference]))) issues.push({ sheet: name, row: rowNo, column: reference, problem: "Unresolved product reference" });
      }
      if (name === "1 Products" && cell(row.related_products)) {
        for (const related of pipe(row.related_products)) {
          if (!productSlugs.has(related)) issues.push({ sheet: name, row: rowNo, column: "related_products", problem: `Unresolved product reference "${related}"` });
        }
      }
      for (const [column, raw] of Object.entries(row)) {
        const value = cell(raw), list = optionLists.get(OPTION_ALIASES[column] ?? column);
        if (!value || isNull(raw) || !list) continue;
        for (const rawSelected of pipe(value)) {
          const selected = column === "tolerance" ? rawSelected.replace(/^mild\s+/i, "") : rawSelected;
          // Editorial sentinels are retained in the Review sheet rather than
          // being coerced into public enum data.
          if (isReview(selected)) { if (!book.SheetNames.includes("Review")) warnings.push(`${name} row ${rowNo} ${column}: Stated – review`); continue; }
          if (![...list].some((candidate) => optionKey(candidate) === optionKey(selected))) issues.push({ sheet: name, row: rowNo, column, problem: `Value "${selected}" is not present in Lists` });
        }
      }
    });
    sheets[name] = { rows: rows[name].length, accepted: rows[name].length - skipped, skipped, reasons };
    if (name === PRODUCT_FAQ_SHEET) {
      for (const slug of new Set(rows[name].map((row) => cell(row.slug)).filter(Boolean))) {
        const count = importedFaqs(rows[name], slug).length;
        if (count > PRODUCT_FAQ_LIMIT) {
          issues.push({
            sheet: name, row: 0, column: "question",
            problem: `"${slug}" has ${count} FAQs; maximum is ${PRODUCT_FAQ_LIMIT}`,
          });
        }
      }
    }
  }
  if (!book.SheetNames.includes("Lists")) issues.push({ sheet: "Lists", row: 0, column: "", problem: "Lists sheet is required" });
  if (book.SheetNames.includes("Review")) {
    const review = values(book.Sheets.Review).filter((r) => Object.values(r).some((x) => cell(x)));
    sheets.Review = { rows: review.length, accepted: 0, skipped: 0, reasons: [] };
    warnings.push(...review.map((_, i) => `Review row ${i + 2}`));
  }
  return { hash: createHash("sha256").update(content).digest("hex"), token: createHash("sha256").update(content).digest("hex"), sheets, issues, warnings, plannedChanges: rows["1 Products"].map((r) => `upsert product ${cell(r.slug)}`).filter(Boolean) };
}

function applyProductRow(details: Record<string, unknown>, row: Row) {
  for (const [column, key] of Object.entries(PRODUCT_DETAILS)) if (cell(row[column]) || isNull(row[column])) {
    // XLSX delivers embedded line breaks intact; do not trim editorial
    // description content while mapping it into the canonical JSON payload.
    const text = key === "description" ? String(row[column] ?? "") : cell(row[column]);
    details[key] = isNull(row[column]) ? (NUMBER_KEYS.has(key) ? null : "") : NUMBER_KEYS.has(key) ? num(row[column]) : typedValue(column, text);
  }
  for (const [column, key] of Object.entries(ARRAY_KEYS)) if (cell(row[column]) || isNull(row[column])) details[key] = isNull(row[column]) ? [] : pipe(row[column]);
  for (const [column, key] of Object.entries(BOOL_COLUMNS)) if (yn(row[column]) !== undefined || isNull(row[column])) details[key] = isNull(row[column]) ? false : yn(row[column]);
  if (cell(row.tolerance) || isNull(row.tolerance)) details.tolerance = isNull(row.tolerance) ? [] : pipe(row.tolerance).flatMap((v) => {
    const mild = /^mild\s+/i.test(v), name = v.replace(/^mild\s+/i, "");
    return ["Low pH", "Waterlogging", "Salinity", "Drought", "Frost"].includes(name) ? [{ name, mild }] : [];
  });
  applyPhotoColumns(details, row);
  if (cell(row.formulation_year) || isNull(row.formulation_year)) details.formulationYear = isNull(row.formulation_year) ? "" : cell(row.formulation_year);
}

// Retired workbook fields remain in stored JSON for backwards compatibility,
// but are deliberately not part of the replacement payload.
const PRESERVED_DETAIL_KEYS = [
  "guideSection", "guideYear", "alsoKnownAs", "bredByOrigin", "distributedBy",
  "inoculantGroup", "licenceRestriction", "isThirdPartyProduct", "supplierName",
  "inCurrentPrintedGuide", "descriptionSource", "notes", "ecocertApproved",
  "sortOrder", "featured", "companionSpecies",
];

function replacementDetails(existing: unknown, packSize: string) {
  const old = existing && typeof existing === "object" && !Array.isArray(existing) ? existing as Record<string, unknown> : {};
  const preserved = Object.fromEntries(PRESERVED_DETAIL_KEYS.filter((key) => key in old).map((key) => [key, old[key]]));
  return { ...normalizeProductDetails({}, packSize), ...preserved } as unknown as Record<string, unknown>;
}

export async function commitWorkbook(content: Buffer, token: string) {
  const report = dryRunWorkbook(content);
  if (token !== report.token) throw new Error("IMPORT_TOKEN_MISMATCH");
  if (report.issues.length) throw new Error("IMPORT_VALIDATION_FAILED");
  const { book, rows } = readWorkbook(content);
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('ih_catalogue_import'))`);
    const importedSlugs = new Set(rows["1 Products"].map((row) => cell(row.slug)).filter(Boolean));
    const existingProducts = await tx.select().from(productsTable);
    const componentsBeforeReplacement = new Map(existingProducts.map((product) => [
      product.slug,
      normalizeProductDetails(product.details, product.packSize).components,
    ]));
    for (const product of existingProducts) {
      if (importedSlugs.has(product.slug)) continue;
      await clearProductMediaReferences(product.id, tx);
      await tx.delete(productsTable).where(eq(productsTable.id, product.id));
    }
    // A deployment may predate the v2 taxonomy and therefore only have roots.
    // Build the workbook taxonomy inside this transaction. Existing slugs stay
    // immutable while workbook names become the canonical display labels.
    let categories = await tx.select().from(catalogueCategoriesTable);
    const uniqueSlug = (name: string, parentId: number | null = null) => {
      const base = taxonomySlug(name); let candidate = base, n = 2;
      while (categories.some((category) => category.parentId === parentId && category.slug === candidate)) candidate = `${base}-${n++}`;
      return candidate;
    };
    const workbookTaxonomy = new Map<string, { category: string; subcategory: string; order: number }>();
    rows["1 Products"].forEach((row, order) => {
      const category = cell(row.category), subcategory = cell(row.sub_category);
      if (category) workbookTaxonomy.set(`${normal(category)}\u0000${normal(subcategory)}`, { category, subcategory, order });
    });
    for (const entry of workbookTaxonomy.values()) {
      let root = categories.find((category) => category.parentId === null && equivalentRoot(category.name, entry.category));
      if (!root) {
        const [insertedRoot] = await tx.insert(catalogueCategoriesTable).values({
          parentId: null, slug: uniqueSlug(entry.category), name: entry.category, groupLabel: "Products",
          lead: "", rainfall: "", image: "", sortOrder: entry.order, active: true,
        }).returning();
        if (!insertedRoot) throw new Error(`FAILED_TO_CREATE_TAXONOMY:${entry.category}`);
        root = insertedRoot;
        categories = [...categories, insertedRoot];
      } else if (root.name !== entry.category) {
        const previousName = root.name;
        const [renamedRoot] = await tx.update(catalogueCategoriesTable).set({
          name: entry.category,
          groupLabel: "Products",
        }).where(eq(catalogueCategoriesTable.id, root.id)).returning();
        if (!renamedRoot) throw new Error(`FAILED_TO_RENAME_TAXONOMY:${entry.category}`);
        root = renamedRoot;
        await tx.update(catalogueCategoriesTable).set({ groupLabel: entry.category })
          .where(eq(catalogueCategoriesTable.parentId, root.id));
        await tx.update(productsTable).set({ category: entry.category })
          .where(eq(productsTable.category, previousName));
        categories = categories.map((category) => category.id === renamedRoot.id
          ? renamedRoot
          : category.parentId === renamedRoot.id ? { ...category, groupLabel: entry.category } : category);
      }
      if (!root) throw new Error(`UNRESOLVED_ROOT_TAXONOMY:${entry.category}`);
      if (entry.subcategory && !categories.some((category) => category.parentId === root.id && normal(category.name) === normal(entry.subcategory))) {
        const [child] = await tx.insert(catalogueCategoriesTable).values({
          parentId: root.id, slug: uniqueSlug(childTaxonomySlug(root.slug, entry.subcategory), root.id), name: entry.subcategory,
          groupLabel: root.name, lead: "", rainfall: "", image: "", sortOrder: entry.order, active: true,
        }).returning();
        categories = [...categories, child];
      }
    }
    const resolveSubcategory = (category: string, subcategory: string) => {
      const root = categories.find((item) => item.parentId === null && equivalentRoot(item.name, category));
      const child = categories.find((item) => item.parentId === root?.id && normal(item.name) === normal(subcategory));
      return { id: child?.id ?? (root && !subcategory ? root.id : null), category: root?.name ?? category };
    };
    for (const [listName, valuesSet] of lists(book)) {
      let order = 0; for (const value of valuesSet) await tx.insert(productOptionsTable).values({ listName, value, sortOrder: order++ }).onConflictDoUpdate({ target: [productOptionsTable.listName, productOptionsTable.value], set: { sortOrder: order - 1 } });
    }
    for (const row of rows["1 Products"]) {
      const slug = cell(row.slug); if (!slug) continue;
      const [existing] = await tx.select().from(productsTable).where(eq(productsTable.slug, slug));
      const details = replacementDetails(existing?.details, existing?.packSize ?? "");
      applyProductRow(details, row);
      const seoRow = rows["7 Website SEO"].find((candidate) => cell(candidate.product_slug) === slug);
      applySeoRow(details as ReturnType<typeof normalizeProductDetails>, seoRow);
      const categoryName = cell(row.category);
      details.maturityMeasure = categoryName === "Ryegrasses" || categoryName === "Fescues & Other Grasses" ? "Heading date"
        : categoryName === "Clovers" || categoryName === "Serradellas & Medics" ? "Days to flowering (Perth)"
          : categoryName === "Lucerne" ? "Winter activity rating"
            : categoryName === "Mixes" ? "Time of flowering" : "";
      const requestedLifecycle = cell(row.status);
      const lifecycle = requestedLifecycle || "Draft";
      if (!LIFECYCLE_STATUSES.has(lifecycle)) throw new Error(`INVALID_LIFECYCLE_STATUS:${slug}`);
      const taxonomy = resolveSubcategory(cell(row.category), cell(row.sub_category));
      const subcategoryId = taxonomy.id ?? null;
      if (cell(row.sub_category) && !taxonomy.id) throw new Error(`UNRESOLVED_TAXONOMY:${slug}`);
      const payload = {
        name: cell(row.product_name) || slug, category: taxonomy.category || "Other", subcategoryId,
        price: existing?.price ?? "", packSize: existing?.packSize ?? "",
        status: ({ "Good stock": "in-stock", "Low stock": "low", "Very low": "very-low", Unavailable: "unavailable" } as Record<string, "in-stock" | "low" | "very-low" | "unavailable">)[cell(row.availability)] ?? "unavailable", note: "",
        techSheet: isNull(row.tech_sheet_pdf_path) ? "" : cell(row.tech_sheet_pdf_path),
        guideYear: "",
        descriptionSource: "",
        websiteUrlLegacy: isNull(row.website_url) ? "" : cell(row.website_url),
        listingState: importedListingState(row),
        availabilityOverride: isNull(row.availability_override) ? null
          : (cell(row.availability_override) as "Good stock" | "Low stock" | "Very low" | "Unavailable") || null,
        publishStatus: lifecycle, publishedAt: lifecycle === "Published" ? existing?.publishedAt ?? new Date() : null,
        details: normalizeProductDetails(details, existing?.packSize ?? ""), updatedAt: new Date(),
      };
      const listingPayload = applyListingAvailability(payload);
      if (lifecycle === "Published") {
        const missing = publishContentErrors({ name: payload.name, slug, category: payload.category, details: payload.details });
        const existingPayload = existing && {
          name: existing.name,
          slug: existing.slug,
          category: existing.category,
          details: normalizeProductDetails(existing.details, existing.packSize),
        };
        const requiredContentChanged = !existingPayload ||
          requiredPublishContentFingerprint(existingPayload) !== requiredPublishContentFingerprint({
            name: payload.name, slug, category: payload.category, details: payload.details,
          });
        // Legacy Published records may be exported with a blank lifecycle as a
        // lossless preservation marker. They can round-trip unchanged, but an
        // editor cannot use that marker to make invalid public content live.
        if (missing.length && (requestedLifecycle === "Published" ||
          existing?.publishStatus !== "Published" || requiredContentChanged)) {
          throw new Error(`PUBLISH_VALIDATION:${slug}:${missing.join(", ")}`);
        }
      }
      if (existing) await tx.update(productsTable).set(listingPayload).where(eq(productsTable.id, existing.id));
      else await tx.insert(productsTable).values({ ...listingPayload, slug });
      const [imported] = await tx.select().from(productsTable).where(eq(productsTable.slug, slug));
      if (imported) await tx.delete(productDraftsTable).where(eq(productDraftsTable.productId, imported.id));
    }
    const productRows = await tx.select().from(productsTable);
    const productBySlug = new Map(productRows.map((p) => [p.slug, p]));
    const updateDetails = async (slug: string, change: (d: Record<string, unknown>) => void) => {
      const product = productBySlug.get(slug); if (!product) return;
      const d = normalizeProductDetails(product.details, product.packSize) as unknown as Record<string, unknown>; change(d);
      await tx.update(productsTable).set({ details: d as ReturnType<typeof normalizeProductDetails>, updatedAt: new Date() }).where(eq(productsTable.id, product.id));
      productBySlug.set(slug, { ...product, details: d as ReturnType<typeof normalizeProductDetails> });
    };
    // These keyed sheets are authoritative: a missing row means the value is
    // empty for products represented by the uploaded workbook.
    const workbookProducts = productRows.filter((product) => rows["1 Products"].some((row) => cell(row.slug) === product.slug));
    for (const product of workbookProducts) {
      const details = normalizeProductDetails(product.details, product.packSize) as unknown as Record<string, unknown>;
      details.sowingRates = [];
      details.components = [];
      details.faqs = [];
      for (const key of Object.values(SPECIFICS)) {
        details[key] = NUMBER_KEYS.has(key) ? null : BOOLEAN_KEYS.has(key) ? false : "";
      }
      await tx.update(productsTable).set({ details: details as ReturnType<typeof normalizeProductDetails>, updatedAt: new Date() })
        .where(eq(productsTable.id, product.id));
      productBySlug.set(product.slug, { ...product, details: details as ReturnType<typeof normalizeProductDetails> });
    }
    for (const slug of new Set(rows["2 Sowing rates"].map((r) => cell(r.slug)).filter(Boolean))) await updateDetails(slug, (d) => {
      d.sowingRates = rows["2 Sowing rates"].filter((r) => cell(r.slug) === slug).map((r) => ({ context: cell(r.context), min: num(r.min), max: num(r.max), unit: cell(r.unit) || "kg/ha" }));
    });
    for (const row of rows["3 Category specifics"]) await updateDetails(cell(row.slug), (d) => {
      const applicable = applicableSpecifics[cell(row.category)] ?? new Set<string>();
      for (const [column, key] of Object.entries(SPECIFICS)) if (applicable.has(column) && (cell(row[column]) || isNull(row[column]))) {
        if (isReview(row[column])) continue;
        d[key] = isNull(row[column]) ? (NUMBER_KEYS.has(key) ? null : BOOLEAN_KEYS.has(key) ? false : "") : NUMBER_KEYS.has(key) ? num(row[column]) : BOOLEAN_KEYS.has(key) ? yn(row[column]) : cell(row[column]);
      }
    });
    for (const slug of new Set(rows["5 Mix components"].map((r) => cell(r.mix_slug)).filter(Boolean))) await updateDetails(slug, (d) => {
      const existingComponents = (componentsBeforeReplacement.get(slug) ?? []) as Record<string, unknown>[];
      const matchedExisting = new Set<number>();
      d.components = rows["5 Mix components"].filter((r) => cell(r.mix_slug) === slug).map((r, index) => {
        const productLink = cell(r.component_slug);
        const speciesName = cell(r.component_name);
        const existingIndex = existingComponents.findIndex((component, componentIndex) =>
          !matchedExisting.has(componentIndex) && (
            productLink
              ? component.productLink === productLink
              : !component.productLink && speciesName && component.speciesName === speciesName
          )
        );
        if (existingIndex >= 0) matchedExisting.add(existingIndex);
        const existing = existingIndex >= 0 ? existingComponents[existingIndex] : undefined;
        return {
          productLink,
          speciesName,
          inclusionRate: num(r.inclusion_rate),
          unit: cell(r.rate_unit) || "%",
          description: cell(r.component_description),
          note: typeof existing?.note === "string" ? existing.note : "",
        };
      });
    });
    for (const slug of new Set(rows[PRODUCT_FAQ_SHEET].map((r) => cell(r.slug)).filter(Boolean))) {
      await updateDetails(slug, (d) => { d.faqs = importedFaqs(rows[PRODUCT_FAQ_SHEET], slug).slice(0, PRODUCT_FAQ_LIMIT); });
    }
    for (const row of rows["7 Website SEO"]) {
      const slug = cell(row.product_slug);
      await updateDetails(slug, (d) => {
        const seoTitle = isNull(row.seo_title) ? "" : forSearchMetadata(cell(row.seo_title));
        if (cell(row.meta_description)) d.seoDescription = forSearchMetadata(cell(row.meta_description));
        else if (isNull(row.meta_description)) d.seoDescription = "";
        d.seoTitle = seoTitle;
        if (cell(row.h1) || isNull(row.h1)) d.h1 = isNull(row.h1) ? "" : cell(row.h1);
      });
    }
    await tx.delete(redirectsTable);
    for (const row of rows["1 Products"]) {
      const product = productBySlug.get(cell(row.slug));
      const fromPath = legacyWebsitePath(cell(row.website_url));
      if (!product || !fromPath) continue;
      const toPath = productPublicPath(product.slug, product.category, categories);
      if (fromPath === toPath) throw new Error(`SELF_REDIRECT:${product.slug}`);
      await tx.insert(redirectsTable).values({ fromPath, toPath });
    }
    for (const alias of requiredLegacyRedirects([...productBySlug.values()], categories)) {
      await tx.insert(redirectsTable).values(alias).onConflictDoUpdate({
        target: redirectsTable.fromPath,
        set: { toPath: alias.toPath, updatedAt: new Date() },
      });
    }
    // The sale-line sheet is authoritative for every imported product.
    for (const slug of importedSlugs) {
      const product = productBySlug.get(slug);
      if (product) await tx.delete(saleLinesTable).where(eq(saleLinesTable.productId, product.id));
    }
    for (const row of rows["4 Sale lines"]) {
      const product = productBySlug.get(cell(row.slug)), stockCode = cell(row.stock_code); if (!product || !stockCode) continue;
      const line = { productId: product.id, stockCode, seedForm: cell(row.seed_form), seedGrade: "", packKg: num(row.pack_kg)?.toString() ?? null, packUnit: cell(row.pack_unit) || "kg", availability: isActiveListing(product) ? (cell(row.availability) || null) : "Unavailable", priceDisplay: cell(row.price_display) || "Contact for pricing", isDefault: yn(row.is_default) ?? false, sortOrder: 0 };
      await tx.insert(saleLinesTable).values(line).onConflictDoUpdate({ target: saleLinesTable.stockCode, set: line });
    }
    for (const slug of importedSlugs) {
      const product = productBySlug.get(slug);
      if (!product) continue;
      await syncProductMediaReferences(product, normalizeProductDetails(product.details, product.packSize).photos, tx);
    }
  });
  return report;
}

export async function exportWorkbook() {
  const book = XLSX.utils.book_new(), products = await db.select().from(productsTable), lines = await db.select().from(saleLinesTable);
  const categories = await db.select().from(catalogueCategoriesTable);
  const taxonomy = new Map(categories.map((category) => [category.id, category.name]));
  const options = await db.select().from(productOptionsTable);
  const optionLists = new Map<string, Set<string>>();
  const retiredListNames = new Set(["guide_section", "inoculant_group", "seed_grade", "featured", "is_third_party_product", "in_current_printed_guide", "ecocert_approved"]);
  for (const option of options.sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)) {
    if (retiredListNames.has(option.listName)) continue;
    (optionLists.get(option.listName) ?? optionLists.set(option.listName, new Set()).get(option.listName)!).add(option.value);
  }
  const categoryOptions = optionLists.get("category") ?? optionLists.set("category", new Set()).get("category")!;
  for (const product of products) if (product.category) categoryOptions.add(product.category);
  // Mix component inclusion rates are percentages. The source Lists sheet only
  // carries sowing-rate units, so make the export's hidden validation sheet
  // self-contained without changing the office-managed option records.
  (optionLists.get("rate_unit") ?? optionLists.set("rate_unit", new Set()).get("rate_unit")!).add("%");
  const d = (p: typeof products[number]) => normalizeProductDetails(p.details, p.packSize);
  const append = (name: string, data: object[], headers?: string[]) => {
    const sheet = XLSX.utils.json_to_sheet(data);
    if (!data.length && headers) XLSX.utils.sheet_add_aoa(sheet, [headers], { origin: "A1" });
    XLSX.utils.book_append_sheet(book, sheet, name);
  };
  const listed = (column: string, value: string) => listedValue(optionLists, column, value);
  const listedPipe = (column: string, values: string[]) => values.map((value) => listed(column, value)).join("|");
  append("1 Products", products.map((p) => {
    const details = d(p);
    return {
      slug: p.slug, product_name: p.name, category: p.category,
      sub_category: p.subcategoryId ? taxonomy.get(p.subcategoryId) ?? "" : "",
       record_type: listed("record_type", details.recordType), botanical_name: details.botanicalName,
       persistency_type: listed("persistency_type", details.persistencyType),
        australian_bred: details.australianBred ? "Y" : "N",
       tagline: details.tagline, blurb: details.blurb, key_attributes: details.keyAttributes.join("|"),
        description: details.description, distribution_note: details.distributionNote,
       rainfall_min_mm: details.rainfallMinMm, soil_ph_min: details.soilPhMin,
      soil_ph_scale: listed("soil_ph_scale", details.soilPhScale),
      soil_range_lightest: listed("soil_range_lightest", details.soilRangeLightest),
      soil_range_heaviest: listed("soil_range_heaviest", details.soilRangeHeaviest),
      sowing_depth_min_cm: details.sowingDepthMinCm, sowing_depth_max_cm: details.sowingDepthMaxCm,
      tolerance: listedPipe("tolerance", details.tolerance.map((x) => `${x.mild ? "Mild " : ""}${x.name}`)),
       end_use: listedPipe("end_use", details.endUse),
      livestock: listedPipe("livestock", details.livestock), disease_pest_resistance: details.diseasePestResistance,
      stand_life_notes: details.standLifeNotes, grazing_management_notes: details.grazingManagementNotes,
      pbr_protected: details.pbrProtected ? "Y" : "N", pbr_details: details.pbrDetails,
       certification: listedPipe("certification", details.certification), formulation_year: details.formulationYear,
       related_products: details.relatedProducts.join("|"), photo_1: photoValue(details, 0),
       tech_sheet_pdf_path: p.techSheet, website_url: p.websiteUrlLegacy,
       listing_state: p.listingState, listing_override: "",
       availability: ({ "in-stock": "Good stock", low: "Low stock", "very-low": "Very low", unavailable: "Unavailable" } as Record<string, string>)[p.status] ?? "Unavailable",
       status: p.publishStatus === "Published" && publishContentErrors({
         name: p.name, slug: p.slug, category: p.category, details,
       }).length ? "" : p.publishStatus,
    };
   }), ["slug", "product_name", "category", "sub_category", "record_type", "botanical_name", "persistency_type", "australian_bred", "tagline", "blurb", "key_attributes", "description", "distribution_note", "rainfall_min_mm", "soil_ph_min", "soil_ph_scale", "soil_range_lightest", "soil_range_heaviest", "sowing_depth_min_cm", "sowing_depth_max_cm", "tolerance", "end_use", "livestock", "disease_pest_resistance", "stand_life_notes", "grazing_management_notes", "pbr_protected", "pbr_details", "certification", "formulation_year", "related_products", "photo_1", "tech_sheet_pdf_path", "website_url", "listing_state", "listing_override", "availability", "status"]);
  append("2 Sowing rates", products.flatMap((p) => d(p).sowingRates.map((r) => ({
    slug: p.slug, context: listed("context", r.context), min: r.min, max: r.max, unit: listed("unit", r.unit),
  }))), ["slug", "context", "min", "max", "unit"]);
  append("3 Category specifics", products.map((p) => ({ slug: p.slug, category: p.category, ...Object.fromEntries(Object.entries(SPECIFICS).map(([column, key]) => {
    const value = (d(p) as unknown as Record<string, unknown>)[key];
    return [column, typeof value === "string" ? listed(column, value) : typeof value === "boolean" ? (value ? "Y" : "N") : value];
  })) })), ["slug", "category", ...Object.keys(SPECIFICS)]);
  append("4 Sale lines", lines.map((x) => ({ slug: products.find((p) => p.id === x.productId)?.slug ?? "", stock_code: x.stockCode, seed_form: x.seedForm, pack_kg: x.packKg, pack_unit: x.packUnit, availability: x.availability, price_display: x.priceDisplay, is_default: x.isDefault ? "Y" : "N" })), ["slug", "stock_code", "seed_form", "pack_kg", "pack_unit", "availability", "price_display", "is_default"]);
  append("5 Mix components", products.flatMap((p) => d(p).components.map((x) => ({ mix_slug: p.slug, component_slug: x.productLink, component_name: x.speciesName, inclusion_rate: x.inclusionRate, rate_unit: x.unit, component_description: x.description }))), ["mix_slug", "component_slug", "component_name", "inclusion_rate", "rate_unit", "component_description"]);
  append("7 Website SEO", products.map((p) => {
    const details = d(p);
    return {
      product_slug: p.slug,
      h1: details.h1, seo_title: details.seoTitle, meta_description: details.seoDescription,
      social_title: details.socialTitle, social_description: details.socialDescription,
      social_image: details.socialImage, canonical_url: details.canonicalUrl,
      robots_index: details.robotsIndex ? "Y" : "N",
    };
  }), ["product_slug", "h1", "seo_title", "meta_description", "social_title", "social_description", "social_image", "canonical_url", "robots_index"]);
  const faqRows = products.flatMap((p) => d(p).faqs.map((faq) => ({
    slug: p.slug, product_name: p.name, question: faq.question, answer: faq.answer,
  })));
  append(PRODUCT_FAQ_SHEET, faqRows.length ? faqRows : [{ slug: "", product_name: "", question: "", answer: "" }], ["slug", "product_name", "question", "answer"]);
  const listNames = [...optionLists.keys()];
  const listRows = Array.from({ length: Math.max(0, ...[...optionLists.values()].map((values) => values.size)) }, (_, index) =>
    Object.fromEntries(listNames.map((name) => [name, [...(optionLists.get(name) ?? [])][index] ?? ""])));
  append("Lists", listRows);
  book.Workbook = book.Workbook ?? {};
  book.Workbook.Sheets = book.SheetNames.map(() => ({ Hidden: 0 }));
  return XLSX.write(book, { type: "buffer", bookType: "xlsx" });
}