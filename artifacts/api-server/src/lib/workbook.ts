import { createHash } from "node:crypto";
import * as XLSX from "xlsx";
import { eq } from "drizzle-orm";
import { db, normalizeProductDetails, productsTable, saleLinesTable, type SaleLine } from "@workspace/db";

export const importSheetNames = ["1 Products", "2 Sowing rates", "3 Category specifics", "4 Sale lines", "5 Mix components", "6 Companions", "7 Website SEO"] as const;
type Row = Record<string, unknown>;
export type WorkbookReport = { token: string; hash: string; sheets: Record<string, { rows: number; accepted: number; skipped: number; reasons: string[] }>; issues: { sheet: string; row: number; column: string; problem: string }[]; warnings: string[]; plannedChanges: string[] };

function cell(value: unknown) { return value == null ? "" : String(value).trim(); }
function isNull(value: unknown) { return cell(value).toUpperCase() === "NULL"; }
function values(sheet: XLSX.WorkSheet) { return XLSX.utils.sheet_to_json<Row>(sheet, { defval: "", raw: false }); }
function parseYN(value: unknown) { const v = cell(value).toUpperCase(); return v === "Y" ? true : v === "N" ? false : undefined; }

export function readWorkbook(content: Buffer): { book: XLSX.WorkBook; rows: Record<string, Row[]> } {
  const book = XLSX.read(content, { type: "buffer", cellText: true, cellDates: false });
  const rows: Record<string, Row[]> = {};
  for (const name of importSheetNames) rows[name] = book.SheetNames.includes(name) ? values(book.Sheets[name]) : [];
  return { book, rows };
}

export function dryRunWorkbook(content: Buffer): WorkbookReport {
  const { book, rows } = readWorkbook(content);
  const hash = createHash("sha256").update(content).digest("hex");
  const issues: WorkbookReport["issues"] = [];
  const sheets: WorkbookReport["sheets"] = {};
  const slugs = new Set(rows["1 Products"].map((r) => cell(r.slug)).filter(Boolean));
  const stock = new Set<string>();
  for (const name of importSheetNames) {
    const data = rows[name]; let skipped = 0; const reasons: string[] = [];
    data.forEach((row, index) => {
      if (name === "4 Sale lines" && !cell(row.slug)) { skipped++; reasons.push(`row ${index + 2}: blank slug (not in catalogue)`); }
      if (name === "4 Sale lines") { const code = cell(row.stock_code); if (code && stock.has(code)) issues.push({ sheet: name, row: index + 2, column: "stock_code", problem: "Duplicate stock code" }); stock.add(code); }
      const key = name === "2 Sowing rates" || name === "3 Category specifics" || name === "6 Companions" ? "slug" : name === "5 Mix components" ? "mix_slug" : "";
      if (key && cell(row[key]) && !slugs.has(cell(row[key]))) issues.push({ sheet: name, row: index + 2, column: key, problem: "Unresolved product slug" });
    });
    sheets[name] = { rows: data.length, accepted: data.length - skipped, skipped, reasons };
  }
  if (!book.SheetNames.includes("Lists")) {
    issues.push({ sheet: "Lists", row: 0, column: "", problem: "Lists sheet is required" });
  } else {
    const listRows = values(book.Sheets.Lists);
    const allowed = new Map<string, Set<string>>();
    for (const row of listRows) {
      for (const [column, value] of Object.entries(row)) {
        if (column.startsWith("__") || column === "sub_category options by category") continue;
        const option = cell(value);
        if (!option) continue;
        const options = allowed.get(column) ?? new Set<string>();
        options.add(option);
        allowed.set(column, options);
      }
    }
    const optionColumn: Record<string, string> = {
      publication_status: "status",
      publish_status: "status",
      active: "yes_no",
      is_default: "yes_no",
      in_current_printed_guide: "yes_no",
      australian_bred: "yes_no",
      ecocert_approved: "yes_no",
      pbr_protected: "yes_no",
      is_third_party_product: "yes_no",
      argt_resistant: "yes_no",
    };
    for (const name of importSheetNames) {
      rows[name].forEach((row, index) => {
        for (const [column, rawValue] of Object.entries(row)) {
          const value = cell(rawValue);
          if (!value || isNull(rawValue)) continue;
          const options = allowed.get(optionColumn[column] ?? column);
          if (!options) continue;
          for (const selected of value.split("|").map((part) => part.trim()).filter(Boolean)) {
            // The supplied editorial workbook deliberately uses this sentinel
            // for values that are retained and tracked on the Review sheet.
            if (/stated\s*[–-]\s*review/i.test(selected)) continue;
            if (!options.has(selected)) {
              issues.push({
                sheet: name,
                row: index + 2,
                column,
                problem: `Value "${selected}" is not present in Lists`,
              });
            }
          }
        }
      });
    }
  }
  if (book.SheetNames.includes("Review")) sheets.Review = { rows: values(book.Sheets.Review).length, accepted: 0, skipped: 0, reasons: [] };
  return { hash, token: hash, sheets, issues, warnings: values(book.Sheets.Review ?? {}).filter((r) => Object.values(r).some(cell)).map((_, i) => `Review row ${i + 2}`), plannedChanges: rows["1 Products"].map((r) => `upsert product ${cell(r.slug)}`).filter((x) => !x.endsWith(" " )) };
}

/** Applies only supplied cells; absent workbook rows never cause deletes. */
export async function commitWorkbook(content: Buffer, token: string) {
  const report = dryRunWorkbook(content);
  if (token !== report.token) throw new Error("IMPORT_TOKEN_MISMATCH");
  if (report.issues.length) throw new Error("IMPORT_VALIDATION_FAILED");
  const { rows } = readWorkbook(content);
  await db.transaction(async (tx) => {
    for (const row of rows["1 Products"]) {
      const slug = cell(row.slug); if (!slug) continue;
      const [existing] = await tx.select().from(productsTable).where(eq(productsTable.slug, slug));
      const base = existing ? normalizeProductDetails(existing.details, existing.packSize) : normalizeProductDetails({}, "");
      const next = { ...base };
      const text = (key: string, detail: keyof typeof next) => { if (isNull(row[key])) (next[detail] as string) = ""; else if (cell(row[key])) (next[detail] as string) = cell(row[key]); };
      text("stand_life_notes", "standLifeNotes"); text("summary", "summary"); text("description", "description"); text("guide_section", "guideSection");
      const payload = {
        name: cell(row.product_name) || existing?.name || slug, category: cell(row.category) || existing?.category || "Other",
        price: existing?.price || "", packSize: existing?.packSize || "", status: existing?.status || "unavailable", note: existing?.note || "",
        techSheet: cell(row.tech_sheet_pdf_path) || existing?.techSheet || "", guideYear: cell(row.guide_year) || existing?.guideYear || "",
        descriptionSource: cell(row.description_source) || existing?.descriptionSource || "", listingOverride: isNull(row.listing_override) ? null : cell(row.listing_override) || existing?.listingOverride || null,
        availabilityOverride: existing?.availabilityOverride || null, details: next, updatedAt: new Date(),
      };
      if (existing) await tx.update(productsTable).set(payload).where(eq(productsTable.id, existing.id));
      else await tx.insert(productsTable).values({ ...payload, slug, publishStatus: "Draft", publishedAt: null, subcategoryId: null });
    }
    for (const row of rows["4 Sale lines"]) {
      const code = cell(row.stock_code); const slug = cell(row.slug); if (!code || !slug) continue;
      const [product] = await tx.select().from(productsTable).where(eq(productsTable.slug, slug)); if (!product) continue;
      const line = { productId: product.id, stockCode: code, seedForm: cell(row.seed_form), seedGrade: cell(row.seed_grade), packKg: cell(row.pack_kg) || null, packUnit: cell(row.pack_unit) || "kg", availability: cell(row.availability) || "Unavailable", priceDisplay: cell(row.price_display) || "Contact for pricing", isDefault: parseYN(row.is_default) ?? false, sortOrder: Number(cell(row.sort_order)) || 0 };
      await tx.insert(saleLinesTable).values(line).onConflictDoUpdate({ target: saleLinesTable.stockCode, set: line });
    }
    // The remaining sheets intentionally update the typed details document in
    // place, preserving unknown/legacy detail keys and untouched workbook data.
    for (const row of rows["2 Sowing rates"]) {
      const [product] = await tx.select().from(productsTable).where(eq(productsTable.slug, cell(row.slug)));
      if (!product) continue;
      const details = normalizeProductDetails(product.details, product.packSize);
      const rate = { context: cell(row.context) as typeof details.sowingRates[number]["context"], min: cell(row.min) ? Number(row.min) : null, max: cell(row.max) ? Number(row.max) : null, unit: cell(row.unit) || "kg/ha" };
      // Replace semantics are achieved by collecting the complete file set.
      const all = rows["2 Sowing rates"].filter((x) => cell(x.slug) === product.slug).map((x) => ({ context: cell(x.context) as typeof rate.context, min: cell(x.min) ? Number(x.min) : null, max: cell(x.max) ? Number(x.max) : null, unit: cell(x.unit) || "kg/ha" }));
      await tx.update(productsTable).set({ details: { ...details, sowingRates: all.length ? all : [rate] }, updatedAt: new Date() }).where(eq(productsTable.id, product.id));
    }
    const camel: Record<string, string> = { ploidy: "ploidy", heading_date: "headingDate", heading_offset_days: "headingOffsetDays", argt_resistant: "argtResistant", endophyte: "endophyte", growth_season: "growthSeason", maturity_days: "maturityDays", hard_seed_level: "hardSeedLevel", oestrogen_level: "oestrogenLevel", bloat_risk: "bloatRisk", flower_colour: "flowerColour", winter_activity: "winterActivity", growing_season: "growingSeason", weeks_to_first_grazing: "weeksToFirstGrazing", prussic_acid_risk: "prussicAcidRisk", regrowth: "regrowth", flowering_window: "floweringWindow", product_form: "productForm", application_rate: "applicationRate" };
    for (const row of rows["3 Category specifics"]) {
      const [product] = await tx.select().from(productsTable).where(eq(productsTable.slug, cell(row.slug))); if (!product) continue;
      const details = normalizeProductDetails(product.details, product.packSize) as Record<string, unknown>;
      for (const [column, key] of Object.entries(camel)) if (column in row && (cell(row[column]) || isNull(row[column]))) details[key] = isNull(row[column]) ? null : (["headingOffsetDays", "maturityDays", "winterActivity"].includes(key) ? Number(row[column]) : parseYN(row[column]) ?? cell(row[column]));
      await tx.update(productsTable).set({ details: details as ReturnType<typeof normalizeProductDetails>, updatedAt: new Date() }).where(eq(productsTable.id, product.id));
    }
    for (const row of rows["5 Mix components"]) {
      const [product] = await tx.select().from(productsTable).where(eq(productsTable.slug, cell(row.mix_slug))); if (!product) continue;
      const details = normalizeProductDetails(product.details, product.packSize);
      const components = rows["5 Mix components"].filter((x) => cell(x.mix_slug) === product.slug).map((x) => ({ productLink: cell(x.component_slug), speciesName: cell(x.component_name), inclusionRate: cell(x.inclusion_rate) ? Number(x.inclusion_rate) : null, unit: cell(x.unit) || "%", note: cell(x.note) }));
      await tx.update(productsTable).set({ details: { ...details, components }, updatedAt: new Date() }).where(eq(productsTable.id, product.id));
    }
    for (const row of rows["6 Companions"]) {
      const [product] = await tx.select().from(productsTable).where(eq(productsTable.slug, cell(row.slug))); if (!product) continue;
      const details = normalizeProductDetails(product.details, product.packSize);
      const companionSpecies = rows["6 Companions"].filter((x) => cell(x.slug) === product.slug).map((x) => cell(x.companion_slug) || cell(x.companion_text)).filter(Boolean);
      await tx.update(productsTable).set({ details: { ...details, companionSpecies }, updatedAt: new Date() }).where(eq(productsTable.id, product.id));
    }
    for (const row of rows["7 Website SEO"]) {
      const slug = cell(row.website_slug); const [product] = await tx.select().from(productsTable).where(eq(productsTable.slug, slug)); if (!product) continue;
      const details = normalizeProductDetails(product.details, product.packSize);
      await tx.update(productsTable).set({ details: { ...details, seoTitle: isNull(row.seo_title) ? "" : cell(row.seo_title) || details.seoTitle, seoDescription: isNull(row.seo_description) ? "" : cell(row.seo_description) || details.seoDescription }, updatedAt: new Date() }).where(eq(productsTable.id, product.id));
    }
  });
  return report;
}

export async function exportWorkbook() {
  const book = XLSX.utils.book_new();
  const products = await db.select().from(productsTable);
  const lines = await db.select().from(saleLinesTable);
  const productRows = products.map((p) => { const d = normalizeProductDetails(p.details, p.packSize); return { slug: p.slug, product_name: p.name, category: p.category, guide_section: d.guideSection, guide_year: p.guideYear, record_type: d.recordType, botanical_name: d.botanicalName, summary: d.summary, description: d.description, description_source: p.descriptionSource, stand_life_notes: d.standLifeNotes, listing_override: p.listingOverride ?? "", seo_title: d.seoTitle, seo_description: d.seoDescription }; });
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(productRows), "1 Products");
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(products.flatMap((p) => normalizeProductDetails(p.details, p.packSize).sowingRates.map((r) => ({ slug: p.slug, ...r })))), "2 Sowing rates");
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(products.map((p) => { const d = normalizeProductDetails(p.details, p.packSize); return { slug: p.slug, ploidy: d.ploidy, heading_date: d.headingDate, maturity_days: d.maturityDays, winter_activity: d.winterActivity, product_form: d.productForm }; })), "3 Category specifics");
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(lines.map((line) => ({ slug: products.find((p) => p.id === line.productId)?.slug ?? "", stock_code: line.stockCode, seed_form: line.seedForm, seed_grade: line.seedGrade, pack_kg: line.packKg, pack_unit: line.packUnit, availability: line.availability, price_display: line.priceDisplay, is_default: line.isDefault ? "Y" : "N", sort_order: line.sortOrder }))), "4 Sale lines");
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(products.flatMap((p) => normalizeProductDetails(p.details, p.packSize).components.map((c) => ({ mix_slug: p.slug, component_slug: c.productLink, component_name: c.speciesName, inclusion_rate: c.inclusionRate, unit: c.unit, note: c.note })))), "5 Mix components");
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(products.flatMap((p) => normalizeProductDetails(p.details, p.packSize).companionSpecies.map((c) => ({ slug: p.slug, companion_slug: c })))), "6 Companions");
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(products.map((p) => { const d = normalizeProductDetails(p.details, p.packSize); return { website_slug: p.slug, seo_title: d.seoTitle, seo_description: d.seoDescription }; })), "7 Website SEO");
  return XLSX.write(book, { type: "buffer", bookType: "xlsx" });
}