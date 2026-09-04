import { createHash } from "node:crypto";
import * as XLSX from "xlsx";
import { eq } from "drizzle-orm";
import {
  catalogueCategoriesTable, db, normalizeProductDetails, productOptionsTable,
  productDraftsTable, productsTable, redirectsTable, saleLinesTable,
} from "@workspace/db";

export const importSheetNames = ["1 Products", "2 Sowing rates", "3 Category specifics", "4 Sale lines", "5 Mix components", "6 Companions", "7 Website SEO"] as const;
type Row = Record<string, unknown>;
type SheetReport = { rows: number; accepted: number; skipped: number; reasons: string[] };
export type WorkbookReport = {
  token: string; hash: string; sheets: Record<string, SheetReport>;
  issues: { sheet: string; row: number; column: string; problem: string }[];
  warnings: string[]; plannedChanges: string[];
};

const PRODUCT_DETAILS: Record<string, string> = {
  guide_section: "guideSection", record_type: "recordType", botanical_name: "botanicalName",
  persistency_type: "persistencyType", bred_by_origin: "bredByOrigin", distributed_by: "distributedBy",
  summary: "summary", description: "description", internal_notes: "notes", rainfall_min_mm: "rainfallMinMm",
  soil_ph_min: "soilPhMin", soil_ph_scale: "soilPhScale", soil_range_lightest: "soilRangeLightest",
  soil_range_heaviest: "soilRangeHeaviest", sowing_depth_min_cm: "sowingDepthMinCm",
  sowing_depth_max_cm: "sowingDepthMaxCm", inoculant_group: "inoculantGroup",
  disease_pest_resistance: "diseasePestResistance", stand_life_notes: "standLifeNotes",
  grazing_management_notes: "grazingManagementNotes", licence_restriction: "licenceRestriction",
  supplier_name: "supplierName", sort_order: "sortOrder",
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
const NUMBER_KEYS = new Set(["rainfallMinMm", "soilPhMin", "sowingDepthMinCm", "sowingDepthMaxCm", "sortOrder",
  "headingOffsetDays", "maturityDays", "winterActivity"]);
const BOOLEAN_KEYS = new Set(["australianBred", "ecocertApproved", "pbrProtected", "isThirdPartyProduct", "featured", "inCurrentPrintedGuide", "argtResistant"]);
const ARRAY_KEYS: Record<string, string> = {
  also_known_as: "alsoKnownAs", end_use: "endUse", livestock: "livestock", certification: "certification",
  related_products: "relatedProducts", seed_treatment: "seedTreatment",
};
const BOOL_COLUMNS: Record<string, string> = {
  australian_bred: "australianBred", ecocert_approved: "ecocertApproved", pbr_protected: "pbrProtected",
  is_third_party_product: "isThirdPartyProduct", featured: "featured", in_current_printed_guide: "inCurrentPrintedGuide",
  argt_resistant: "argtResistant",
};
const OPTION_ALIASES: Record<string, string> = {
  soil_ph_scale: "soil_ph_scale", context: "rate_context", unit: "rate_unit", rate_unit: "rate_unit",
  soil_range_lightest: "soil_code", soil_range_heaviest: "soil_code",
  is_default: "yes_no", australian_bred: "yes_no", ecocert_approved: "yes_no", pbr_protected: "yes_no",
  is_third_party_product: "yes_no", featured: "yes_no", in_current_printed_guide: "yes_no", argt_resistant: "yes_no",
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
function isNull(value: unknown) { return cell(value).toUpperCase() === "NULL"; }
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
function equivalentRoot(left: string, right: string) {
  const aliases = [
    ["specialtymixes", "mixes"], ["ryegrass", "ryegrasses"],
    ["pastureherbs", "herbs"], ["otherproducts", "other"],
  ];
  const a = normal(left), b = normal(right);
  return a === b || aliases.some((group) => group.includes(a) && group.includes(b));
}

export function readWorkbook(content: Buffer): { book: XLSX.WorkBook; rows: Record<string, Row[]> } {
  const book = XLSX.read(content, { type: "buffer", cellText: true, cellDates: false });
  const rows: Record<string, Row[]> = {};
  for (const name of importSheetNames) rows[name] = book.SheetNames.includes(name) ? values(book.Sheets[name]) : [];
  return { book, rows };
}

function lists(book: XLSX.WorkBook) {
  const result = new Map<string, Set<string>>();
  if (!book.SheetNames.includes("Lists")) return result;
  for (const row of values(book.Sheets.Lists)) for (const [name, raw] of Object.entries(row)) {
    if (!name || name.startsWith("__") || name === "sub_category options by category") continue;
    const value = cell(raw); if (value) (result.get(name) ?? result.set(name, new Set()).get(name)!).add(value);
  }
  return result;
}

/** Pure parser/validator: deliberately never opens a database connection. */
export function dryRunWorkbook(content: Buffer): WorkbookReport {
  const { book, rows } = readWorkbook(content);
  const issues: WorkbookReport["issues"] = [], warnings: string[] = [];
  const productSlugs = new Set(rows["1 Products"].map((r) => cell(r.slug)).filter(Boolean));
  const stocks = new Set<string>(), optionLists = lists(book);
  const sheets: Record<string, SheetReport> = {};
  for (const name of importSheetNames) {
    let skipped = 0; const reasons: string[] = [];
    rows[name].forEach((row, i) => {
      const rowNo = i + 2, slugKey = name === "5 Mix components" ? "mix_slug" : ["2 Sowing rates", "3 Category specifics", "6 Companions"].includes(name) ? "slug" : "";
      if (name === "4 Sale lines" && !cell(row.slug)) { skipped++; reasons.push(`row ${rowNo}: blank slug (not in catalogue)`); }
      if (slugKey && cell(row[slugKey]) && !productSlugs.has(cell(row[slugKey]))) issues.push({ sheet: name, row: rowNo, column: slugKey, problem: "Unresolved product slug" });
      if (name === "4 Sale lines") { const code = cell(row.stock_code); if (code && stocks.has(code)) issues.push({ sheet: name, row: rowNo, column: "stock_code", problem: "Duplicate stock code" }); if (code) stocks.add(code); }
      for (const reference of name === "5 Mix components" ? ["component_slug"] : name === "6 Companions" ? ["companion_slug"] : []) {
        if (cell(row[reference]) && !productSlugs.has(cell(row[reference]))) issues.push({ sheet: name, row: rowNo, column: reference, problem: "Unresolved product reference" });
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
  for (const [column, key] of Object.entries(PRODUCT_DETAILS)) if (cell(row[column]) || isNull(row[column])) details[key] = isNull(row[column]) ? (NUMBER_KEYS.has(key) ? null : "") : NUMBER_KEYS.has(key) ? num(row[column]) : typedValue(column, cell(row[column]));
  for (const [column, key] of Object.entries(ARRAY_KEYS)) if (cell(row[column]) || isNull(row[column])) details[key] = isNull(row[column]) ? [] : pipe(row[column]);
  for (const [column, key] of Object.entries(BOOL_COLUMNS)) if (yn(row[column]) !== undefined || isNull(row[column])) details[key] = isNull(row[column]) ? false : yn(row[column]);
  if (cell(row.tolerance) || isNull(row.tolerance)) details.tolerance = isNull(row.tolerance) ? [] : pipe(row.tolerance).flatMap((v) => {
    const mild = /^mild\s+/i.test(v), name = v.replace(/^mild\s+/i, "");
    return ["Low pH", "Waterlogging", "Salinity", "Drought", "Frost"].includes(name) ? [{ name, mild }] : [];
  });
  if (cell(row.photo_1) || isNull(row.photo_1)) details.photos = isNull(row.photo_1) ? [] : [{ slot: "photo_1", file: cell(row.photo_1), rating: "", src: cell(row.photo_1) }];
  if (cell(row.formulation_year) || isNull(row.formulation_year)) details.formulationYear = isNull(row.formulation_year) ? "" : cell(row.formulation_year);
}

function redirectFromNote(row: Row) {
  const note = cell(row.redirect_note);
  const websiteSlug = cell(row.website_slug);
  let from = websiteSlug ? `/product/${websiteSlug}` : "";
  if (!from && cell(row.product_url)) {
    try {
      from = new URL(cell(row.product_url)).pathname.replace(/\/+$/, "");
    } catch {
      from = cell(row.product_url).replace(/\/+$/, "");
    }
  }
  const target = note.match(/(\/(?:product|products)\/[^\s,.)]+)/i)?.[1];
  return from && target ? { from, to: target } : null;
}

export async function commitWorkbook(content: Buffer, token: string) {
  const report = dryRunWorkbook(content);
  if (token !== report.token) throw new Error("IMPORT_TOKEN_MISMATCH");
  if (report.issues.length) throw new Error("IMPORT_VALIDATION_FAILED");
  const { book, rows } = readWorkbook(content);
  await db.transaction(async (tx) => {
    // A deployment may predate the v2 taxonomy and therefore only have roots.
    // Build the workbook taxonomy inside this transaction. Existing slugs stay
    // immutable while workbook names become the canonical display labels.
    let categories = await tx.select().from(catalogueCategoriesTable);
    const uniqueSlug = (name: string) => {
      const base = taxonomySlug(name); let candidate = base, n = 2;
      while (categories.some((category) => category.slug === candidate)) candidate = `${base}-${n++}`;
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
          parentId: root.id, slug: uniqueSlug(`${root.slug}-${entry.subcategory}`), name: entry.subcategory,
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
      const details = normalizeProductDetails(existing?.details ?? {}, existing?.packSize ?? "") as unknown as Record<string, unknown>;
      applyProductRow(details, row);
      const categoryName = cell(row.category);
      details.maturityMeasure = categoryName === "Ryegrasses" || categoryName === "Fescues & Other Grasses" ? "Heading date"
        : categoryName === "Clovers" || categoryName === "Serradellas & Medics" ? "Days to flowering (Perth)"
          : categoryName === "Lucerne" ? "Winter activity rating"
            : categoryName === "Mixes" ? "Time of flowering" : "";
      const lifecycle = cell(row.status) || existing?.publishStatus || "Draft";
      const taxonomy = resolveSubcategory(cell(row.category), cell(row.sub_category));
      const subcategoryId = taxonomy.id ?? existing?.subcategoryId ?? null;
      if (cell(row.sub_category) && !taxonomy.id) throw new Error(`UNRESOLVED_TAXONOMY:${slug}`);
      const payload = {
        name: cell(row.product_name) || existing?.name || slug, category: taxonomy.category || existing?.category || "Other", subcategoryId,
        price: existing?.price ?? "", packSize: existing?.packSize ?? "",
        status: ({ "Good stock": "in-stock", "Low stock": "low", "Very low": "very-low", Unavailable: "unavailable" } as Record<string, "in-stock" | "low" | "very-low" | "unavailable">)[cell(row.availability)] ?? existing?.status ?? "unavailable", note: existing?.note ?? "",
        techSheet: isNull(row.tech_sheet_pdf_path) ? "" : cell(row.tech_sheet_pdf_path) || existing?.techSheet || "",
        guideYear: isNull(row.guide_year) ? "" : cell(row.guide_year) || existing?.guideYear || "",
        descriptionSource: isNull(row.description_source) ? "" : cell(row.description_source) || existing?.descriptionSource || "",
        websiteUrlLegacy: isNull(row.website_url) ? "" : cell(row.website_url) || existing?.websiteUrlLegacy || "",
        // A workbook Legacy row without a sale line must not be interpreted as
        // an old pre-v2 product by public listing code.  An explicit user
        // override still wins when it is supplied by the workbook.
        listingOverride: isNull(row.listing_override) ? null : cell(row.listing_override)
          || (cell(row.listing_state) === "Legacy" && !rows["4 Sale lines"].some((line) => cell(line.slug) === slug) ? "Force legacy" : existing?.listingOverride || null),
        availabilityOverride: isNull(row.availability_override) ? null
          : (cell(row.availability_override) as typeof existing.availabilityOverride) || existing?.availabilityOverride || null,
        publishStatus: lifecycle, publishedAt: lifecycle === "Published" ? existing?.publishedAt ?? new Date() : null,
        details: details as ReturnType<typeof normalizeProductDetails>, updatedAt: new Date(),
      };
      if (existing) await tx.update(productsTable).set(payload).where(eq(productsTable.id, existing.id));
      else await tx.insert(productsTable).values({ ...payload, slug });
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
    for (const slug of new Set(rows["5 Mix components"].map((r) => cell(r.mix_slug)).filter(Boolean))) await updateDetails(slug, (d) => { d.components = rows["5 Mix components"].filter((r) => cell(r.mix_slug) === slug).map((r) => ({ productLink: cell(r.component_slug), speciesName: cell(r.component_name), inclusionRate: num(r.inclusion_rate), unit: cell(r.rate_unit) || "%", note: cell(r.note) })); });
    for (const slug of new Set(rows["6 Companions"].map((r) => cell(r.slug)).filter(Boolean))) await updateDetails(slug, (d) => { d.companionSpecies = rows["6 Companions"].filter((r) => cell(r.slug) === slug).map((r) => cell(r.companion_slug) || cell(r.companion_text)).filter(Boolean); });
    for (const row of rows["7 Website SEO"]) {
      const slug = cell(row.product_slug) || cell(row.website_slug);
      await updateDetails(slug, (d) => { if (cell(row.meta_description)) d.seoDescription = cell(row.meta_description); if (cell(row.menu_label)) d.seoTitle = cell(row.menu_label); });
      const redirect = redirectFromNote(row); if (redirect) await tx.insert(redirectsTable).values({ fromPath: redirect.from, toPath: redirect.to }).onConflictDoUpdate({ target: redirectsTable.fromPath, set: { toPath: redirect.to, updatedAt: new Date() } });
    }
    for (const redirect of [{ from: "/product/souwest-pasture-mix", to: "/product/souwest-pasture-mix-2" }, { from: "/product/icon-lucerne", to: "/products/lucerne#catalogue" }]) await tx.insert(redirectsTable).values({ fromPath: redirect.from, toPath: redirect.to }).onConflictDoUpdate({ target: redirectsTable.fromPath, set: { toPath: redirect.to, updatedAt: new Date() } });
    // Sale lines are the one keyed sheet with replacement semantics: a price
    // list is authoritative for every workbook product, but products omitted
    // from the workbook are never touched.
    for (const slug of new Set(rows["4 Sale lines"].map((row) => cell(row.slug)).filter(Boolean))) {
      const product = productBySlug.get(slug);
      if (product) await tx.delete(saleLinesTable).where(eq(saleLinesTable.productId, product.id));
    }
    for (const row of rows["4 Sale lines"]) {
      const product = productBySlug.get(cell(row.slug)), stockCode = cell(row.stock_code); if (!product || !stockCode) continue;
      const line = { productId: product.id, stockCode, seedForm: cell(row.seed_form), seedGrade: cell(row.seed_grade), packKg: num(row.pack_kg)?.toString() ?? null, packUnit: cell(row.pack_unit) || "kg", availability: cell(row.availability) || null, priceDisplay: cell(row.price_display) || "Contact for pricing", isDefault: yn(row.is_default) ?? false, sortOrder: num(row.sort_order) ?? 0 };
      await tx.insert(saleLinesTable).values(line).onConflictDoUpdate({ target: saleLinesTable.stockCode, set: line });
    }
  });
  return report;
}

export async function exportWorkbook() {
  const book = XLSX.utils.book_new(), products = await db.select().from(productsTable), lines = await db.select().from(saleLinesTable);
  const taxonomy = new Map((await db.select().from(catalogueCategoriesTable)).map((category) => [category.id, category.name]));
  const options = await db.select().from(productOptionsTable);
  const optionLists = new Map<string, Set<string>>();
  for (const option of options.sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)) {
    (optionLists.get(option.listName) ?? optionLists.set(option.listName, new Set()).get(option.listName)!).add(option.value);
  }
  const categoryOptions = optionLists.get("category") ?? optionLists.set("category", new Set()).get("category")!;
  for (const product of products) if (product.category) categoryOptions.add(product.category);
  // Mix component inclusion rates are percentages. The source Lists sheet only
  // carries sowing-rate units, so make the export's hidden validation sheet
  // self-contained without changing the office-managed option records.
  (optionLists.get("rate_unit") ?? optionLists.set("rate_unit", new Set()).get("rate_unit")!).add("%");
  const d = (p: typeof products[number]) => normalizeProductDetails(p.details, p.packSize);
  const append = (name: string, data: object[]) => XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(data), name);
  const listed = (column: string, value: string) => listedValue(optionLists, column, value);
  const listedPipe = (column: string, values: string[]) => values.map((value) => listed(column, value)).join("|");
  append("1 Products", products.map((p) => {
    const details = d(p);
    return {
      slug: p.slug, product_name: p.name, category: p.category,
      sub_category: p.subcategoryId ? taxonomy.get(p.subcategoryId) ?? "" : "",
      guide_year: p.guideYear, guide_section: details.guideSection, record_type: listed("record_type", details.recordType),
      botanical_name: details.botanicalName, also_known_as: details.alsoKnownAs.join("|"),
      persistency_type: listed("persistency_type", details.persistencyType), bred_by_origin: details.bredByOrigin,
      australian_bred: details.australianBred ? "Y" : "N", distributed_by: details.distributedBy,
      summary: details.summary, description: details.description, description_source: p.descriptionSource,
      internal_notes: details.notes, rainfall_min_mm: details.rainfallMinMm, soil_ph_min: details.soilPhMin,
      soil_ph_scale: listed("soil_ph_scale", details.soilPhScale),
      soil_range_lightest: listed("soil_range_lightest", details.soilRangeLightest),
      soil_range_heaviest: listed("soil_range_heaviest", details.soilRangeHeaviest),
      sowing_depth_min_cm: details.sowingDepthMinCm, sowing_depth_max_cm: details.sowingDepthMaxCm,
      tolerance: listedPipe("tolerance", details.tolerance.map((x) => `${x.mild ? "Mild " : ""}${x.name}`)),
      inoculant_group: listed("inoculant_group", details.inoculantGroup),
      seed_treatment: listedPipe("seed_treatment", details.seedTreatment),
      ecocert_approved: details.ecocertApproved ? "Y" : "N", end_use: listedPipe("end_use", details.endUse),
      livestock: listedPipe("livestock", details.livestock), disease_pest_resistance: details.diseasePestResistance,
      stand_life_notes: details.standLifeNotes, grazing_management_notes: details.grazingManagementNotes,
      pbr_protected: details.pbrProtected ? "Y" : "N", pbr_details: details.pbrDetails,
      licence_restriction: details.licenceRestriction, certification: listedPipe("certification", details.certification),
      is_third_party_product: details.isThirdPartyProduct ? "Y" : "N", supplier_name: details.supplierName,
      formulation_year: details.formulationYear, photo_1: details.photos[0]?.src || details.photos[0]?.file || "",
      in_current_printed_guide: details.inCurrentPrintedGuide ? "Y" : "N", featured: details.featured ? "Y" : "N",
      related_products: details.relatedProducts.join("|"), sort_order: details.sortOrder,
      listing_override: p.listingOverride ?? "", availability_override: p.availabilityOverride ?? "",
      status: p.publishStatus, tech_sheet_pdf_path: p.techSheet, website_url: p.websiteUrlLegacy,
    };
  }));
  append("2 Sowing rates", products.flatMap((p) => d(p).sowingRates.map((r) => ({
    slug: p.slug, context: listed("context", r.context), min: r.min, max: r.max, unit: listed("unit", r.unit),
  }))));
  append("3 Category specifics", products.map((p) => ({ slug: p.slug, category: p.category, ...Object.fromEntries(Object.entries(SPECIFICS).map(([column, key]) => {
    const value = (d(p) as unknown as Record<string, unknown>)[key];
    return [column, typeof value === "string" ? listed(column, value) : typeof value === "boolean" ? (value ? "Y" : "N") : value];
  })) })));
  append("4 Sale lines", lines.map((x) => ({ slug: products.find((p) => p.id === x.productId)?.slug ?? "", stock_code: x.stockCode, seed_form: x.seedForm, seed_grade: x.seedGrade, pack_kg: x.packKg, pack_unit: x.packUnit, availability: x.availability, price_display: x.priceDisplay, is_default: x.isDefault ? "Y" : "N", sort_order: x.sortOrder })));
  append("5 Mix components", products.flatMap((p) => d(p).components.map((x) => ({ mix_slug: p.slug, component_slug: x.productLink, component_name: x.speciesName, inclusion_rate: x.inclusionRate, rate_unit: x.unit, note: x.note }))));
  const productSlugs = new Set(products.map((product) => product.slug));
  append("6 Companions", products.flatMap((p) => d(p).companionSpecies.map((x) => ({
    slug: p.slug, companion_slug: productSlugs.has(x) ? x : "", companion_text: productSlugs.has(x) ? "" : x,
  }))));
  append("7 Website SEO", products.map((p) => ({ website_slug: p.slug, product_slug: p.slug, seo_title: d(p).seoTitle, meta_description: d(p).seoDescription })));
  const listNames = [...optionLists.keys()];
  const listRows = Array.from({ length: Math.max(0, ...[...optionLists.values()].map((values) => values.size)) }, (_, index) =>
    Object.fromEntries(listNames.map((name) => [name, [...(optionLists.get(name) ?? [])][index] ?? ""])));
  append("Lists", listRows);
  book.Workbook = book.Workbook ?? {};
  book.Workbook.Sheets = book.SheetNames.map((name) => ({ Hidden: name === "Lists" ? 1 : 0 }));
  return XLSX.write(book, { type: "buffer", bookType: "xlsx" });
}