import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type FieldCatalogEntry = {
  id: string;
  apiPath: string;
  label: string;
  type: string;
  tab: number;
  visibility: "customer" | "publicApi" | "adminOnly";
  editorVisible: boolean;
  visibleWhen: string;
  immutableAfterCreate: boolean;
  enumValues?: string[];
  maxLength?: number;
  fillGuidance?: string;
};

function catalogCandidates() {
  const here = dirname(fileURLToPath(import.meta.url));
  return [
    resolve(process.cwd(), "docs/product-editor/fields.yaml"),
    resolve(process.cwd(), "../../docs/product-editor/fields.yaml"),
    resolve(here, "../../../docs/product-editor/fields.yaml"),
    resolve(here, "../../../../docs/product-editor/fields.yaml"),
  ];
}

function unquote(value: string) {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseScalar(value: string): string | number | boolean {
  const trimmed = unquote(value);
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (/^-?\d+$/.test(trimmed)) return Number(trimmed);
  return trimmed;
}

function parseInlineList(value: string) {
  const inner = value.trim().replace(/^\[/, "").replace(/\]$/, "");
  if (!inner.trim()) return [];
  return inner.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((part) => unquote(part));
}

export function parseFieldsYaml(source: string): FieldCatalogEntry[] {
  const fields: FieldCatalogEntry[] = [];
  const blocks = source.split(/\n  - id:/).slice(1);
  for (const block of blocks) {
    const lines = (`id:${block}`).split("\n");
    const record: Record<string, unknown> = {};
    for (const line of lines) {
      const match = line.match(/^\s{0,4}([A-Za-z][\w]*):\s*(.*)$/);
      if (!match) continue;
      const [, key, raw] = match;
      if (raw.startsWith("[")) record[key] = parseInlineList(raw);
      else record[key] = parseScalar(raw);
    }
    const apiPath = typeof record.apiPath === "string" ? record.apiPath : "";
    const id = typeof record.id === "string" ? record.id : "";
    if (!id || !apiPath) continue;
    fields.push({
      id,
      apiPath,
      label: typeof record.label === "string" ? record.label : id,
      type: typeof record.type === "string" ? record.type : "string",
      tab: typeof record.tab === "number" ? record.tab : 0,
      visibility: record.visibility === "adminOnly" || record.visibility === "publicApi" ? record.visibility : "customer",
      editorVisible: record.editorVisible !== false,
      visibleWhen: typeof record.visibleWhen === "string" ? record.visibleWhen : "always",
      immutableAfterCreate: record.immutableAfterCreate === true,
      enumValues: Array.isArray(record.enumValues) ? record.enumValues.map(String) : undefined,
      maxLength: typeof record.maxLength === "number" ? record.maxLength : undefined,
      fillGuidance: typeof record.fillGuidance === "string" ? record.fillGuidance : undefined,
    });
  }
  return fields;
}

let cached: FieldCatalogEntry[] | undefined;

export function loadFieldCatalog(): FieldCatalogEntry[] {
  if (cached) return cached;
  for (const candidate of catalogCandidates()) {
    try {
      cached = parseFieldsYaml(readFileSync(candidate, "utf8"));
      if (cached.length) return cached;
    } catch {
      /* try the next path */
    }
  }
  cached = [];
  return cached;
}

export function fieldVisibleForCategory(field: FieldCatalogEntry, category: string) {
  if (!field.editorVisible) return false;
  const when = field.visibleWhen;
  if (when === "always" || when === "root-category-selected" || when === "editor-assigns-on-add") return true;
  if (when === "not-in-editor") return false;
  if (when === "category-not-Mixes") return category !== "Mixes";
  if (when === "category-not-Biologicals") return category !== "Biologicals";
  if (when.includes("|")) return when.split("|").map((part) => part.trim()).includes(category);
  return when === category;
}

export const BLOCKED_AI_PATHS = new Set([
  "slug",
  "saleLines",
  "listingState",
  "publishStatus",
  "websiteUrlLegacy",
  "descriptionSource",
  "availabilityOverride",
  "details.photos",
  "details.relatedProducts",
  "details.featured",
  "details.robotsIndex",
  "details.canonicalUrl",
  "details.socialImage",
  "details.sortOrder",
]);

export const PUBLIC_COPY_PATHS = new Set([
  "details.tagline",
  "details.blurb",
  "details.description",
  "details.keyAttributes",
  "details.distributionNote",
  "details.seoTitle",
  "details.seoDescription",
  "details.socialTitle",
  "details.socialDescription",
  "details.h1",
  "details.faqs",
]);

export const LEAKAGE_SOURCE_PATHS = new Set([
  "details.bredByOrigin",
  "details.supplierName",
  "details.notes",
  "details.licenceRestriction",
  "descriptionSource",
]);
