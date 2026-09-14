import {
  BLOCKED_AI_PATHS,
  LEAKAGE_SOURCE_PATHS,
  PUBLIC_COPY_PATHS,
  fieldVisibleForCategory,
  loadFieldCatalog,
  type FieldCatalogEntry,
} from "./ai-field-catalog.ts";

type AiSuggestion = {
  path: string;
  label: string;
  tab: number;
  current: unknown;
  proposed: unknown;
  confidence: number;
  quote?: string;
};

const ALWAYS_BLOCKED = new Set([
  ...BLOCKED_AI_PATHS,
  "price",
  "packSize",
  "status",
  "note",
  "details.companionSpecies",
]);

const TAB_NAMES: Record<number, string> = {
  1: "Basics",
  2: "Agronomy & fit",
  3: "Category-specific",
  4: "Selling",
  5: "Content & publishing",
  6: "SEO",
};

const SOIL_ALIASES: Record<string, string> = {
  ls: "LS",
  "light sand": "LS",
  "light sandy": "LS",
  s: "S",
  sand: "S",
  sandy: "S",
  l: "L",
  loam: "L",
  loamy: "L",
  h: "H",
  heavy: "H",
  clay: "H",
};

function valueAtPath(source: unknown, path: string): unknown {
  if (!source || typeof source !== "object") return undefined;
  const [head, ...rest] = path.split(".");
  const current = (source as Record<string, unknown>)[head];
  if (!rest.length) return current;
  return valueAtPath(current, rest.join("."));
}

function stringifyValue(value: unknown) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

function isBlank(value: unknown) {
  if (value == null) return true;
  if (typeof value === "string") return !value.trim();
  if (Array.isArray(value)) return value.every(isBlank);
  if (typeof value === "object") return !Object.keys(value as object).length;
  return false;
}

function clip(value: unknown, field: FieldCatalogEntry) {
  if (typeof value !== "string" || !field.maxLength) return value;
  return value.slice(0, field.maxLength);
}

function coerce(value: unknown, field: FieldCatalogEntry) {
  if (value == null || value === "") return field.type === "boolean" ? false : value;
  if (field.type === "integer" || field.type === "number") {
    const numeric = typeof value === "number" ? value : Number(String(value).replace(/[^\d.-]/g, ""));
    if (!Number.isFinite(numeric)) return undefined;
    if (field.apiPath === "details.rainfallMinMm") {
      const snapped = Math.round(numeric / 50) * 50;
      if (snapped >= 150 && snapped <= 800) return snapped;
    }
    return numeric;
  }
  if (field.type === "boolean") return value === true || value === "true" || value === "Y" || value === "yes";
  if (field.apiPath === "details.soilRangeLightest" || field.apiPath === "details.soilRangeHeaviest") {
    const alias = SOIL_ALIASES[String(value).trim().toLowerCase()];
    if (alias) return alias;
  }
  if (field.enumValues?.length) {
    const text = String(value).trim();
    const exact = field.enumValues.find((item) => item === text);
    if (exact) return exact || undefined;
    const match = field.enumValues.find((item) => item && item.toLowerCase() === text.toLowerCase());
    return match || undefined;
  }
  if (field.type === "string[]") {
    const list = Array.isArray(value) ? value : String(value).split("|");
    return list.map((item) => String(item).trim()).filter(Boolean);
  }
  if ((field.type === "object[]" || field.apiPath.endsWith("[]") || field.apiPath.includes("[]")) && Array.isArray(value)) {
    return value;
  }
  if (field.type === "string" || field.type === "enum") return clip(String(value), field);
  return clip(value, field);
}

function flattenProposed(input: unknown, prefix = ""): Array<{ path: string; value: unknown }> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return prefix ? [{ path: prefix, value: input }] : [];
  }
  const rows: Array<{ path: string; value: unknown }> = [];
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (value === undefined) continue;
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      rows.push(...flattenProposed(value, path));
    } else {
      rows.push({ path, value });
    }
  }
  return rows;
}

function leakageValues(proposed: Record<string, unknown>, currentProduct: unknown) {
  const values: string[] = [];
  for (const path of LEAKAGE_SOURCE_PATHS) {
    for (const source of [proposed, currentProduct]) {
      const text = stringifyValue(valueAtPath(source, path)).trim();
      if (text.length >= 4) values.push(text);
    }
  }
  return values;
}

function leaksPrivateCopy(value: unknown, privateValues: string[]) {
  const text = stringifyValue(value).toLowerCase();
  if (!text) return false;
  return privateValues.some((item) => item.length >= 4 && text.includes(item.toLowerCase()));
}

export function allowedFieldsForCategory(category: string, existingProduct: boolean) {
  return loadFieldCatalog().filter((field) => {
    if (ALWAYS_BLOCKED.has(field.apiPath) || ALWAYS_BLOCKED.has(field.apiPath.replace(/\[\]/g, ""))) return false;
    if (field.immutableAfterCreate && existingProduct) return false;
    if (field.apiPath.includes("[]") && field.apiPath !== "details.keyAttributes" && field.apiPath !== "details.faqs") {
      return fieldVisibleForCategory({ ...field, apiPath: field.apiPath.split("[]")[0] }, category);
    }
    return fieldVisibleForCategory(field, category);
  });
}

export function sanitizeAiPatch(options: {
  proposed: unknown;
  currentProduct: unknown;
  category: string;
  existingProduct: boolean;
}): { suggestions: AiSuggestion[]; warnings: string[] } {
  const warnings: string[] = [];
  const catalog = loadFieldCatalog();
  const byPath = new Map(catalog.map((field) => [field.apiPath, field]));
  const allowed = new Map(allowedFieldsForCategory(options.category, options.existingProduct).map((field) => [field.apiPath, field]));
  const proposedObject = (options.proposed && typeof options.proposed === "object" && !Array.isArray(options.proposed)
    ? options.proposed
    : {}) as Record<string, unknown>;
  const privateValues = leakageValues(proposedObject, options.currentProduct);
  const suggestions: AiSuggestion[] = [];
  const seen = new Set<string>();

  for (const row of flattenProposed(proposedObject)) {
    const path = allowed.has(row.path) || byPath.has(row.path) ? row.path : `details.${row.path}`;
    const value = row.value;
    if (ALWAYS_BLOCKED.has(path) || path === "slug") {
      warnings.push(`Ignored ${path}; AI cannot change that field.`);
      continue;
    }
    const field = allowed.get(path) ?? byPath.get(path);
    if (!field || !allowed.has(path)) {
      if (byPath.has(path) || path.startsWith("details.")) warnings.push(`Ignored ${path}; it is not fillable for this product.`);
      else warnings.push(`Dropped unknown field ${path}.`);
      continue;
    }
    const coerced = coerce(value, field);
    if (coerced === undefined) {
      warnings.push(`Ignored ${field.label}; the suggested value was not a valid ${field.type}.`);
      continue;
    }
    if (isBlank(coerced)) continue;
    if (PUBLIC_COPY_PATHS.has(path) && leaksPrivateCopy(coerced, privateValues)) {
      warnings.push(`Ignored ${field.label}; it repeated private breeder, supplier, or internal wording.`);
      continue;
    }
    if (seen.has(path)) continue;
    seen.add(path);
    const current = valueAtPath(options.currentProduct, path);
    suggestions.push({
      path,
      label: field.label,
      tab: field.tab,
      current,
      proposed: coerced,
      confidence: isBlank(current) ? 0.8 : 0.55,
    });
  }

  return { suggestions, warnings };
}

export function promptFieldsForCategory(category: string, existingProduct: boolean) {
  const grouped: Record<string, Array<{
    path: string;
    label: string;
    type: string;
    maxLength?: number;
    enumValues?: string[];
    fillGuidance?: string;
  }>> = {};
  for (const field of allowedFieldsForCategory(category, existingProduct)) {
    const tab = TAB_NAMES[field.tab] ?? `Tab ${field.tab}`;
    grouped[tab] ??= [];
    grouped[tab].push({
      path: field.apiPath,
      label: field.label,
      type: field.type,
      maxLength: field.maxLength,
      enumValues: field.enumValues?.filter(Boolean),
      fillGuidance: field.fillGuidance,
    });
  }
  return grouped;
}
