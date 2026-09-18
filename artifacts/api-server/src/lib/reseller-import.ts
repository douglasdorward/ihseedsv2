import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import {
  db,
  insertResellerBrandSchema,
  insertResellerOutletSchema,
  resellerBrandsTable,
  resellerOutletsTable,
  type ResellerBrand,
  type ResellerKind,
  type ResellerOutlet,
} from "@workspace/db";

export const RESELLER_IMPORT_HEADERS = [
  "brand",
  "kind",
  "website",
  "outlet_name",
  "address",
  "suburb",
  "postcode",
  "region",
  "phone",
  "email",
  "google_pin",
  "listed",
] as const;

export const RESELLER_IMPORT_TEMPLATE = `${RESELLER_IMPORT_HEADERS.join(",")}\n`;

type CsvRow = Record<(typeof RESELLER_IMPORT_HEADERS)[number], string>;

export type ResellerImportIssue = {
  row: number;
  column: string;
  problem: string;
};

export type ResellerImportReport = {
  token: string;
  rows: number;
  brandsCreated: number;
  outletsCreated: number;
  outletsUpdated: number;
  skipped: number;
  issues: ResellerImportIssue[];
  plannedChanges: string[];
};

type PlannedBrand = {
  name: string;
  kind: ResellerKind;
  website: string;
  existingId: number | null;
};

type PlannedOutlet = {
  row: number;
  brandName: string;
  name: string;
  address: string;
  suburb: string;
  postcode: string;
  region: string;
  phone: string;
  email: string;
  mapsUrl: string;
  active: boolean;
  existingId: number | null;
};

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (quoted) {
      if (character === "\"" && line[index + 1] === "\"") {
        current += "\"";
        index += 1;
      } else if (character === "\"") {
        quoted = false;
      } else {
        current += character;
      }
      continue;
    }
    if (character === "\"") {
      quoted = true;
      continue;
    }
    if (character === ",") {
      cells.push(current);
      current = "";
      continue;
    }
    current += character;
  }
  cells.push(current);
  return cells;
}

function parseCsv(text: string) {
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n").filter((line) => line.trim().length > 0);
  return lines.map(parseCsvLine);
}

function headerIndex(headers: string[]) {
  const map = new Map<string, number>();
  headers.forEach((header, index) => {
    map.set(header.trim().toLowerCase(), index);
  });
  return map;
}

function cell(row: string[], index: number | undefined) {
  if (index == null || index < 0) return "";
  return (row[index] ?? "").trim();
}

function parseKind(raw: string): ResellerKind | null {
  const value = raw.trim().toLowerCase();
  if (!value) return null;
  if (value === "elders" || value === "elder") return "elders";
  if (value === "nutrien" || value === "nutrien ag" || value === "nutrien ag solutions") return "nutrien";
  if (value === "independent" || value === "independents") return "independent";
  return null;
}

function parseListed(raw: string) {
  const value = raw.trim().toLowerCase();
  if (!value) return true;
  if (["yes", "true", "1", "listed", "y"].includes(value)) return true;
  if (["no", "false", "0", "hidden", "n"].includes(value)) return false;
  return null;
}

function tokenFor(csvText: string) {
  return createHash("sha256").update(csvText).digest("hex");
}

function parseRows(csvText: string) {
  const table = parseCsv(csvText);
  if (!table.length) {
    return { rows: [] as CsvRow[], issues: [{ row: 1, column: "brand", problem: "The CSV is empty." }] as ResellerImportIssue[] };
  }
  const indexes = headerIndex(table[0] ?? []);
  const missing = RESELLER_IMPORT_HEADERS.filter((header) => !indexes.has(header));
  if (missing.length) {
    return {
      rows: [] as CsvRow[],
      issues: [{ row: 1, column: missing[0] ?? "brand", problem: `Missing columns: ${missing.join(", ")}.` }] as ResellerImportIssue[],
    };
  }
  const rows: CsvRow[] = [];
  for (let index = 1; index < table.length; index += 1) {
    const source = table[index] ?? [];
    rows.push({
      brand: cell(source, indexes.get("brand")),
      kind: cell(source, indexes.get("kind")),
      website: cell(source, indexes.get("website")),
      outlet_name: cell(source, indexes.get("outlet_name")),
      address: cell(source, indexes.get("address")),
      suburb: cell(source, indexes.get("suburb")),
      postcode: cell(source, indexes.get("postcode")),
      region: cell(source, indexes.get("region")),
      phone: cell(source, indexes.get("phone")),
      email: cell(source, indexes.get("email")),
      google_pin: cell(source, indexes.get("google_pin")),
      listed: cell(source, indexes.get("listed")),
    });
  }
  return { rows, issues: [] as ResellerImportIssue[] };
}

async function loadExisting() {
  const brands = await db.select().from(resellerBrandsTable);
  const outlets = await db.select().from(resellerOutletsTable);
  const brandsByName = new Map<string, ResellerBrand>();
  for (const brand of brands) brandsByName.set(brand.name.trim().toLowerCase(), brand);
  const outletsByKey = new Map<string, ResellerOutlet>();
  for (const outlet of outlets) {
    outletsByKey.set(`${outlet.brandId}:${outlet.name.trim().toLowerCase()}`, outlet);
  }
  return { brands, outlets, brandsByName, outletsByKey };
}

export async function dryRunResellerImport(csvText: string): Promise<ResellerImportReport> {
  const { rows, issues } = parseRows(csvText);
  const existing = await loadExisting();
  const plannedBrands = new Map<string, PlannedBrand>();
  const plannedOutlets: PlannedOutlet[] = [];
  const plannedChanges: string[] = [];
  const seenOutletKeys = new Set<string>();
  let skipped = 0;

  for (const brand of existing.brands) {
    plannedBrands.set(brand.name.trim().toLowerCase(), {
      name: brand.name,
      kind: brand.kind,
      website: brand.website,
      existingId: brand.id,
    });
  }

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const empty = RESELLER_IMPORT_HEADERS.every((header) => !row[header]);
    if (empty) {
      skipped += 1;
      return;
    }
    if (!row.brand) {
      issues.push({ row: rowNumber, column: "brand", problem: "Brand is required." });
      return;
    }
    if (!row.outlet_name) {
      issues.push({ row: rowNumber, column: "outlet_name", problem: "Outlet name is required." });
      return;
    }

    const brandKey = row.brand.toLowerCase();
    const existingBrand = plannedBrands.get(brandKey);
    const kind = parseKind(row.kind);
    if (!existingBrand && !kind) {
      issues.push({ row: rowNumber, column: "kind", problem: "Kind is required for a new brand (elders, nutrien, or independent)." });
      return;
    }
    if (row.kind && !kind) {
      issues.push({ row: rowNumber, column: "kind", problem: "Kind must be elders, nutrien, or independent." });
      return;
    }
    if (existingBrand && kind && kind !== existingBrand.kind) {
      issues.push({ row: rowNumber, column: "kind", problem: `Brand "${existingBrand.name}" is already ${existingBrand.kind}.` });
      return;
    }

    const listed = parseListed(row.listed);
    if (listed == null) {
      issues.push({ row: rowNumber, column: "listed", problem: "Listed must be yes or no." });
      return;
    }

    const brandInput = insertResellerBrandSchema.safeParse({
      name: row.brand,
      kind: existingBrand?.kind ?? kind,
      website: row.website || existingBrand?.website || "",
      logoSrc: "",
      logoAssetId: null,
    });
    if (!brandInput.success) {
      issues.push({ row: rowNumber, column: "brand", problem: "Brand fields are invalid." });
      return;
    }
    const outletInput = insertResellerOutletSchema.safeParse({
      name: row.outlet_name,
      address: row.address,
      suburb: row.suburb,
      postcode: row.postcode,
      region: row.region,
      phone: row.phone,
      email: row.email,
      mapsUrl: row.google_pin,
      active: listed,
    });
    if (!outletInput.success) {
      const first = outletInput.error.issues[0];
      const column = first?.path[0] === "mapsUrl" ? "google_pin" : String(first?.path[0] ?? "outlet_name");
      issues.push({ row: rowNumber, column, problem: first?.message ?? "Outlet fields are invalid." });
      return;
    }

    if (!existingBrand) {
      plannedBrands.set(brandKey, {
        name: brandInput.data.name,
        kind: brandInput.data.kind,
        website: brandInput.data.website,
        existingId: null,
      });
      plannedChanges.push(`Create brand ${brandInput.data.name}`);
    } else if (row.website && row.website !== existingBrand.website) {
      plannedBrands.set(brandKey, { ...existingBrand, website: brandInput.data.website });
      plannedChanges.push(`Update brand ${existingBrand.name}`);
    }

    const brandId = existingBrand?.existingId;
    const outletKey = `${brandKey}:${row.outlet_name.toLowerCase()}`;
    const existingOutlet = brandId != null
      ? existing.outletsByKey.get(`${brandId}:${row.outlet_name.toLowerCase()}`)
      : undefined;
    const isUpdate = Boolean(existingOutlet) || seenOutletKeys.has(outletKey);
    seenOutletKeys.add(outletKey);
    plannedOutlets.push({
      row: rowNumber,
      brandName: brandInput.data.name,
      name: outletInput.data.name,
      address: outletInput.data.address,
      suburb: outletInput.data.suburb,
      postcode: outletInput.data.postcode,
      region: outletInput.data.region,
      phone: outletInput.data.phone,
      email: outletInput.data.email,
      mapsUrl: outletInput.data.mapsUrl,
      active: outletInput.data.active,
      existingId: existingOutlet?.id ?? (isUpdate ? 0 : null),
    });
    plannedChanges.push(`${isUpdate ? "Update" : "Create"} outlet ${brandInput.data.name} ${outletInput.data.name}`);
  });

  return {
    token: tokenFor(csvText),
    rows: rows.length,
    brandsCreated: [...plannedBrands.values()].filter((brand) => brand.existingId == null).length,
    outletsCreated: plannedOutlets.filter((outlet) => outlet.existingId == null).length,
    outletsUpdated: plannedOutlets.filter((outlet) => outlet.existingId != null).length,
    skipped,
    issues,
    plannedChanges,
  };
}

export async function commitResellerImport(csvText: string, token: string) {
  const report = await dryRunResellerImport(csvText);
  if (token !== report.token) throw new Error("IMPORT_TOKEN_MISMATCH");
  if (report.issues.length) throw new Error(report.issues.map((issue) => `Row ${issue.row}: ${issue.problem}`).join(" "));

  const { rows } = parseRows(csvText);
  await db.transaction(async (tx) => {
    const brands = await tx.select().from(resellerBrandsTable);
    const outlets = await tx.select().from(resellerOutletsTable);
    const brandsByName = new Map(brands.map((brand) => [brand.name.trim().toLowerCase(), brand]));
    let nextBrandSort = brands.reduce((max, brand) => Math.max(max, brand.sortOrder), -1) + 1;
    const nextOutletSort = new Map<number, number>();
    for (const outlet of outlets) {
      nextOutletSort.set(outlet.brandId, Math.max(nextOutletSort.get(outlet.brandId) ?? -1, outlet.sortOrder));
    }

    for (const row of rows) {
      if (RESELLER_IMPORT_HEADERS.every((header) => !row[header])) continue;
      const brandKey = row.brand.toLowerCase();
      let brand = brandsByName.get(brandKey);
      const kind = parseKind(row.kind) ?? brand?.kind ?? "independent";
      if (!brand) {
        const [created] = await tx.insert(resellerBrandsTable).values({
          name: row.brand.trim(),
          kind,
          website: row.website,
          sortOrder: nextBrandSort,
          active: true,
          updatedAt: new Date(),
        }).returning();
        nextBrandSort += 1;
        brand = created;
        brandsByName.set(brandKey, created);
      } else if (row.website && row.website !== brand.website) {
        const [updated] = await tx.update(resellerBrandsTable)
          .set({ website: row.website, updatedAt: new Date() })
          .where(eq(resellerBrandsTable.id, brand.id))
          .returning();
        brand = updated;
        brandsByName.set(brandKey, updated);
      }

      const listed = parseListed(row.listed) ?? true;
      const [existingOutlet] = await tx.select().from(resellerOutletsTable).where(and(
        eq(resellerOutletsTable.brandId, brand.id),
        sql`lower(${resellerOutletsTable.name}) = ${row.outlet_name.trim().toLowerCase()}`,
      ));
      const values = {
        name: row.outlet_name.trim(),
        address: row.address,
        suburb: row.suburb,
        postcode: row.postcode,
        region: row.region,
        phone: row.phone,
        email: row.email,
        mapsUrl: row.google_pin,
        active: listed,
        updatedAt: new Date(),
      };
      if (existingOutlet) {
        await tx.update(resellerOutletsTable).set(values).where(eq(resellerOutletsTable.id, existingOutlet.id));
      } else {
        const sortOrder = (nextOutletSort.get(brand.id) ?? -1) + 1;
        nextOutletSort.set(brand.id, sortOrder);
        await tx.insert(resellerOutletsTable).values({
          brandId: brand.id,
          sortOrder,
          ...values,
        });
      }
    }
  });

  return report;
}

export function resellerImportCsvFromBody(body: unknown) {
  if (!body || typeof body !== "object") return "";
  const csvText = "csvText" in body ? body.csvText : null;
  return typeof csvText === "string" ? csvText : "";
}
