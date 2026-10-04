import type { ListingProduct } from "./product-listing";
import { SOIL_OPTIONS } from "./product-filters";
import { formatSoilPh, formatSoilRange } from "./product-quick-facts";

export type CategoryFact = { label: string; value: string; icon: string };

export type CategorySummary = {
  productCount: number;
  facts: CategoryFact[];
  sentence: string;
};

export type CategoryComparisonRow = { product: ListingProduct; cells: string[] };

export type CategoryComparison = {
  /** First column is always the product name; the rest are data columns. */
  columns: string[];
  rows: CategoryComparisonRow[];
};

type Details = ListingProduct["details"];

function clean(value: string | undefined | null) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

/** Distinct non-empty values ordered by how many products use them, then first appearance. */
function countedValues(lists: Array<Array<string | undefined> | undefined>) {
  const counts = new Map<string, number>();
  for (const list of lists) {
    const seen = new Set<string>();
    for (const raw of list ?? []) {
      const value = clean(raw);
      if (!value || seen.has(value)) continue;
      seen.add(value);
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([name, count], index) => ({ name, count, index }))
    .sort((a, b) => b.count - a.count || a.index - b.index);
}

function distinct(products: ListingProduct[], pick: (details: Details) => string | undefined) {
  return countedValues(products.map((product) => [pick(product.details)])).map((item) => item.name);
}

function numbers(products: ListingProduct[], pick: (details: Details) => number | null | undefined) {
  return products
    .map((product) => pick(product.details))
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0);
}

function numberSpan(values: number[]) {
  if (!values.length) return null;
  return { min: Math.min(...values), max: Math.max(...values) };
}

function joinAnd(parts: string[]) {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

function withCounts(items: Array<{ name: string; count: number }>) {
  return items.map((item) => `${item.name} (${item.count})`).join(", ");
}

function soilRank(value: string | undefined) {
  return SOIL_OPTIONS.findIndex((option) => option.value === value);
}

function soilSpan(products: ListingProduct[]) {
  let lightest = -1;
  let heaviest = -1;
  for (const { details } of products) {
    const light = soilRank(details.soilRangeLightest);
    const heavy = soilRank(details.soilRangeHeaviest);
    if (light < 0 || heavy < 0) continue;
    lightest = lightest < 0 ? light : Math.min(lightest, light);
    heaviest = Math.max(heaviest, heavy);
  }
  if (lightest < 0 || heaviest < 0) return null;
  return formatSoilRange({
    soilRangeLightest: SOIL_OPTIONS[lightest].value,
    soilRangeHeaviest: SOIL_OPTIONS[heaviest].value,
  });
}

function phSpan(products: ListingProduct[]) {
  const withPh = products.filter((product) => product.details.soilPhMin != null && clean(product.details.soilPhScale));
  if (!withPh.length) return null;
  const lowest = Math.min(...withPh.map((product) => product.details.soilPhMin as number));
  const scale = countedValues(withPh.map((product) => [product.details.soilPhScale]))[0]?.name;
  return formatSoilPh({ soilPhMin: lowest, soilPhScale: scale });
}

function firstSowingRate(details: Details) {
  return (details.sowingRates ?? []).find((rate) => rate.min != null && rate.max != null && clean(rate.unit));
}

function sowingSpan(products: ListingProduct[]) {
  const rates = products.map((product) => firstSowingRate(product.details)).filter((rate) => rate !== undefined);
  if (!rates.length) return null;
  const unit = countedValues(rates.map((rate) => [rate.unit]))[0]?.name;
  const matching = rates.filter((rate) => clean(rate.unit) === unit);
  const min = Math.min(...matching.map((rate) => rate.min as number));
  const max = Math.max(...matching.map((rate) => rate.max as number));
  return `${min === max ? min : `${min}–${max}`} ${unit}`;
}

function rainfallValue(span: { min: number; max: number }) {
  return span.min === span.max ? `${span.min} mm+` : `${span.min}–${span.max} mm+`;
}

function spanValue(span: { min: number; max: number }, suffix = "") {
  const range = span.min === span.max ? `${span.min}` : `${span.min}–${span.max}`;
  return suffix ? `${range} ${suffix}` : range;
}

const HEADING_ORDER = ["very early", "early", "early-mid", "mid", "mid-late", "late", "very late"];

/** Earliest first; unrecognised values keep their relative order after the known ones. */
function compareHeadingDates(a: string, b: string) {
  const rank = (value: string) => {
    const index = HEADING_ORDER.indexOf(value.toLowerCase());
    return index < 0 ? HEADING_ORDER.length : index;
  };
  return rank(a) - rank(b);
}

function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function categoryExtras(products: ListingProduct[], categoryName: string): CategoryFact[] {
  const facts: CategoryFact[] = [];
  const add = (label: string, icon: string, value: string | null | undefined) => {
    if (value) facts.push({ label, value, icon });
  };
  const list = (pick: (details: Details) => string | undefined) => distinct(products, pick).join(", ");

  if (["Ryegrasses", "Fescues & Other Grasses", "Sub-Tropical Grasses"].includes(categoryName)) {
    add("Ploidy", "layers", list((details) => details.ploidy));
  }
  if (["Ryegrasses", "Fescues & Other Grasses"].includes(categoryName)) {
    add("Heading date", "calendar", distinct(products, (details) => details.headingDate).sort(compareHeadingDates).join(", "));
    add("Endophyte", "sprout", list((details) => details.endophyte));
  }
  if (["Fescues & Other Grasses", "Sub-Tropical Grasses"].includes(categoryName)) {
    add("Growth season", "sun", list((details) => details.growthSeason));
  }
  if (["Clovers", "Serradellas & Medics"].includes(categoryName)) {
    const span = numberSpan(numbers(products, (details) => details.maturityDays));
    add("Days to flowering", "calendar", span ? spanValue(span, "days") : null);
    add("Hard seed level", "shield", list((details) => details.hardSeedLevel));
    add("Flower colour", "flower", list((details) => details.flowerColour));
  }
  if (categoryName === "Lucerne") {
    const span = numberSpan(numbers(products, (details) => details.winterActivity));
    add("Winter activity", "cloud-rain", span ? spanValue(span) : null);
  }
  if (categoryName === "Forage & Grain Crops") {
    add("Growing season", "sun", list((details) => details.growingSeason));
    const span = numberSpan(numbers(products, (details) => details.weeksToFirstGrazing));
    add("Weeks to first grazing", "clock", span ? spanValue(span, "weeks") : null);
  }
  if (categoryName === "Biologicals") {
    add("Product form", "package", list((details) => details.productForm));
  }
  return facts;
}

export function summariseCategoryProducts(
  products: ListingProduct[],
  categoryName: string,
  options: {
    storedRainfall?: string;
    /**
     * Root category name. Category-specific facts (clover hard seed, ryegrass
     * ploidy and so on) are keyed by root, so a sub-category page passes its
     * root here and its own name as `categoryName` for the wording.
     */
    rootName?: string;
  } = {},
): CategorySummary {
  const productCount = products.length;
  const facts: CategoryFact[] = [];
  const noun = clean(categoryName).toLowerCase() || "pasture seed";

  const persistency = distinct(products, (details) => details.persistencyType);
  if (persistency.length) facts.push({ label: "Type & persistency", value: persistency.join(", "), icon: "leaf" });

  const rainfall = numberSpan(numbers(products, (details) => details.rainfallMinMm));
  const storedRainfall = clean(options.storedRainfall);
  if (rainfall) {
    facts.push({
      label: "Rainfall",
      value: rainfall.min === rainfall.max
        ? `${rainfallValue(rainfall)} annual rainfall`
        : `${rainfallValue(rainfall)} annual rainfall, depending on variety`,
      icon: "cloud-rain",
    });
  } else if (storedRainfall) {
    facts.push({ label: "Rainfall", value: storedRainfall, icon: "cloud-rain" });
  }

  const soil = soilSpan(products);
  if (soil) facts.push({ label: "Soil range", value: soil, icon: "layers" });
  const ph = phSpan(products);
  if (ph) facts.push({ label: "Soil pH", value: ph, icon: "layers" });

  const sowing = sowingSpan(products);
  if (sowing) facts.push({ label: "Sowing rate", value: sowing, icon: "scale" });

  const tolerances = countedValues(products.map((product) => (product.details.tolerance ?? []).map((item) => item.name)));
  if (tolerances.length) facts.push({ label: "Tolerances", value: withCounts(tolerances), icon: "shield" });

  const endUse = countedValues(products.map((product) => product.details.endUse));
  if (endUse.length) facts.push({ label: "End use", value: withCounts(endUse), icon: "target" });

  const livestock = countedValues(products.map((product) => product.details.livestock));
  if (livestock.length) facts.push({ label: "Livestock", value: withCounts(livestock), icon: "paw-print" });

  facts.push(...categoryExtras(products, options.rootName ?? categoryName));

  const sentences: string[] = [];
  if (productCount > 0) {
    sentences.push(`Our ${noun} range has ${plural(productCount, "line")}${persistency.length ? `, covering ${joinAnd(persistency.map((item) => item.toLowerCase()))} types` : ""}.`);
  }
  if (rainfall) {
    sentences.push(rainfall.min === rainfall.max
      ? `They suit areas with ${rainfall.min} mm or more of annual rainfall.`
      : `Individual lines suit areas from ${rainfall.min} mm up to ${rainfall.max} mm or more of annual rainfall.`);
  } else if (storedRainfall) {
    sentences.push(`Typical rainfall zone: ${storedRainfall}.`);
  }
  if (soil) {
    sentences.push(soil.includes(" to ")
      ? `Soils range from ${soil.toLowerCase()}.`
      : `Suited to ${soil.toLowerCase()} soils.`);
  }
  if (endUse.length) {
    sentences.push(`Common uses are ${joinAnd(endUse.slice(0, 4).map((item) => item.name.toLowerCase()))}.`);
  }
  if (livestock.length) {
    sentences.push(`Suitable livestock include ${joinAnd(livestock.slice(0, 4).map((item) => item.name.toLowerCase()))}.`);
  }

  return { productCount, facts, sentence: sentences.join(" ") };
}

type ComparisonColumn = { label: string; cell: (details: Details) => string };

const persistencyColumn: ComparisonColumn = { label: "Persistency", cell: (details) => clean(details.persistencyType) };
const rainfallColumn: ComparisonColumn = {
  label: "Min rainfall",
  cell: (details) => (details.rainfallMinMm ? `${details.rainfallMinMm} mm+` : ""),
};
const soilColumn: ComparisonColumn = { label: "Soil range", cell: (details) => formatSoilRange(details) ?? "" };
const sowingColumn: ComparisonColumn = {
  label: "Sowing rate",
  cell: (details) => {
    const rate = firstSowingRate(details);
    return rate ? `${rate.min === rate.max ? rate.min : `${rate.min}–${rate.max}`} ${clean(rate.unit)}` : "";
  },
};

const COMPARISON_COLUMNS: Record<string, ComparisonColumn[]> = {
  Ryegrasses: [
    persistencyColumn,
    { label: "Ploidy", cell: (details) => clean(details.ploidy) },
    { label: "Heading date", cell: (details) => clean(details.headingDate) },
    rainfallColumn,
  ],
  "Fescues & Other Grasses": [
    persistencyColumn,
    { label: "Growth season", cell: (details) => clean(details.growthSeason) },
    rainfallColumn,
    soilColumn,
  ],
  Clovers: [
    persistencyColumn,
    { label: "Days to flowering", cell: (details) => (details.maturityDays ? String(details.maturityDays) : "") },
    { label: "Hard seed", cell: (details) => clean(details.hardSeedLevel) },
    rainfallColumn,
  ],
  Lucerne: [
    persistencyColumn,
    { label: "Winter activity", cell: (details) => (details.winterActivity != null ? String(details.winterActivity) : "") },
    rainfallColumn,
    soilColumn,
  ],
};

const DEFAULT_COMPARISON_COLUMNS = [persistencyColumn, rainfallColumn, soilColumn, sowingColumn];

/** A crawlable per-product comparison; columns with no data at all are dropped. */
export function buildCategoryComparison(
  products: ListingProduct[],
  categoryName: string,
  /** Root category name when `categoryName` is a sub-category; selects the column set. */
  rootName?: string,
): CategoryComparison {
  const definitions = COMPARISON_COLUMNS[rootName ?? categoryName] ?? DEFAULT_COMPARISON_COLUMNS;
  const sorted = [...products].sort((a, b) => a.name.localeCompare(b.name));
  const used = definitions.filter((column) => sorted.some((product) => column.cell(product.details)));
  return {
    columns: ["Product", ...used.map((column) => column.label)],
    rows: sorted.map((product) => ({
      product,
      cells: used.map((column) => column.cell(product.details) || "—"),
    })),
  };
}
