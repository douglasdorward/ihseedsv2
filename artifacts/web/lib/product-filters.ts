import type { CatalogueCategory, CatalogueProduct } from "./catalogue";

export const END_USE_OPTIONS = [
  "Grazing", "Hay", "Silage", "Cover crop", "Green manure", "Grain", "Stockfeed",
  "Permanent pasture", "Erosion control / stabilisation", "Break crop", "Biofumigant", "Turf",
] as const;

export const LIVESTOCK_OPTIONS = [
  "Beef", "Dairy", "Sheep", "Equine", "Goat", "Chicken", "Alpaca", "Weaners", "Lamb finishing",
] as const;

export const TOLERANCE_OPTIONS = ["Low pH", "Waterlogging", "Salinity", "Drought", "Frost"] as const;

export const SOIL_OPTIONS = [
  { value: "LS", label: "Light sand" },
  { value: "S", label: "Sand" },
  { value: "L", label: "Loam" },
  { value: "H", label: "Heavy" },
] as const;

export const SOWING_CONTEXT_OPTIONS = [
  "Monoculture", "In a mix", "Dryland", "Irrigation", "Pasture", "Turf",
  "General", "Podded", "De-hulled", "Coated",
] as const;

export const RAINFALL_OPTIONS = [350, 400, 450, 500, 550, 600, 700, 800, 1000];

const SOIL_RANK: Record<string, number> = { LS: 0, S: 1, L: 2, H: 3 };

export const PASTURE_PERSISTENCE_VALUES = ["annual", "self-regenerating", "lasting"] as const;

export type PasturePersistence = (typeof PASTURE_PERSISTENCE_VALUES)[number];

export type ProductListingFilters = {
  category: string[];
  endUse: string[];
  livestock: string[];
  tolerance: string[];
  rainfall: number | null;
  soil: string[];
  sowing: string[];
  persistence: PasturePersistence | null;
};

export const EMPTY_FILTERS: ProductListingFilters = {
  category: [],
  endUse: [],
  livestock: [],
  tolerance: [],
  rainfall: null,
  soil: [],
  sowing: [],
  persistence: null,
};

function readList(params: URLSearchParams, key: string) {
  return params.getAll(key).flatMap((value) => value.split(",")).map((value) => value.trim()).filter(Boolean);
}

function readPersistence(params: URLSearchParams): PasturePersistence | null {
  const raw = params.get("persistence");
  if (raw === "perennial") return "lasting";
  if (raw === "annual" || raw === "self-regenerating" || raw === "lasting") return raw;
  return null;
}

export function filtersFromSearchParams(params: URLSearchParams): ProductListingFilters {
  const rainfallRaw = params.get("rainfall");
  const rainfall = rainfallRaw && Number.isFinite(Number(rainfallRaw)) ? Number(rainfallRaw) : null;
  return {
    category: readList(params, "category"),
    endUse: readList(params, "endUse"),
    livestock: readList(params, "livestock"),
    tolerance: readList(params, "tolerance"),
    rainfall,
    soil: readList(params, "soil"),
    sowing: readList(params, "sowing"),
    persistence: readPersistence(params),
  };
}

export function searchParamsFromFilters(filters: ProductListingFilters) {
  const params = new URLSearchParams();
  const append = (key: string, values: string[]) => {
    for (const value of values) params.append(key, value);
  };
  append("category", filters.category);
  append("endUse", filters.endUse);
  append("livestock", filters.livestock);
  append("tolerance", filters.tolerance);
  if (filters.rainfall != null) params.set("rainfall", String(filters.rainfall));
  append("soil", filters.soil);
  append("sowing", filters.sowing);
  if (filters.persistence) params.set("persistence", filters.persistence);
  return params;
}

export function filtersAreEmpty(filters: ProductListingFilters) {
  return !filters.category.length && !filters.endUse.length && !filters.livestock.length
    && !filters.tolerance.length && filters.rainfall == null && !filters.soil.length
    && !filters.sowing.length && filters.persistence == null;
}

function intersects(selected: string[], values: string[] | undefined) {
  if (!selected.length) return true;
  return (values ?? []).some((value) => selected.includes(value));
}

export function soilMatches(product: CatalogueProduct, selected: string[]) {
  if (!selected.length) return true;
  const light = SOIL_RANK[product.details.soilRangeLightest ?? ""];
  const heavy = SOIL_RANK[product.details.soilRangeHeaviest ?? ""];
  if (light == null || heavy == null) return false;
  return selected.some((value) => {
    const rank = SOIL_RANK[value];
    return rank != null && rank >= light && rank <= heavy;
  });
}

export function productMatchesFilters(
  product: CatalogueProduct,
  filters: ProductListingFilters,
  categories: CatalogueCategory[],
) {
  if (filters.category.length) {
    const root = categories.find((category) => category.parentId === null && category.name === product.category);
    if (!root || !filters.category.includes(root.slug)) return false;
  }
  if (!intersects(filters.endUse, product.details.endUse)) return false;
  if (!intersects(filters.livestock, product.details.livestock)) return false;
  if (!intersects(filters.tolerance, (product.details.tolerance ?? []).map((item) => item.name))) return false;
  if (filters.rainfall != null) {
    if (product.details.rainfallMinMm == null || product.details.rainfallMinMm > filters.rainfall) return false;
  }
  if (!soilMatches(product, filters.soil)) return false;
  if (filters.sowing.length) {
    const contexts = (product.details.sowingRates ?? [])
      .map((rate) => rate.context)
      .filter((value): value is string => Boolean(value));
    if (!intersects(filters.sowing, contexts)) return false;
  }
  return true;
}

export type CatalogueFilterOptions = {
  category: string[];
  endUse: string[];
  livestock: string[];
  tolerance: string[];
  rainfall: number[];
  soil: string[];
  sowing: string[];
};

export type FilterOptionDimension = Exclude<keyof ProductListingFilters, "persistence">;

function keepOrdered<T extends string | number>(
  canonical: readonly T[],
  present: ReadonlySet<string | number>,
): T[] {
  return canonical.filter((value) => present.has(value));
}

/** Options that appear on at least one product in the full catalogue (static list). */
export function catalogueFilterOptions(
  products: CatalogueProduct[],
  categories: CatalogueCategory[],
): CatalogueFilterOptions {
  const categoryPresent = new Set<string>();
  const endUsePresent = new Set<string>();
  const livestockPresent = new Set<string>();
  const tolerancePresent = new Set<string>();
  const rainfallPresent = new Set<number>();
  const soilPresent = new Set<string>();
  const sowingPresent = new Set<string>();

  for (const product of products) {
    const root = categories.find((category) => category.parentId === null && category.name === product.category);
    if (root) categoryPresent.add(root.slug);
    for (const value of product.details.endUse ?? []) endUsePresent.add(value);
    for (const value of product.details.livestock ?? []) livestockPresent.add(value);
    for (const item of product.details.tolerance ?? []) tolerancePresent.add(item.name);
    const min = product.details.rainfallMinMm;
    if (min != null) {
      for (const option of RAINFALL_OPTIONS) {
        if (min <= option) rainfallPresent.add(option);
      }
    }
    const light = SOIL_RANK[product.details.soilRangeLightest ?? ""];
    const heavy = SOIL_RANK[product.details.soilRangeHeaviest ?? ""];
    if (light != null && heavy != null) {
      for (const option of SOIL_OPTIONS) {
        const rank = SOIL_RANK[option.value];
        if (rank != null && rank >= light && rank <= heavy) soilPresent.add(option.value);
      }
    }
    for (const rate of product.details.sowingRates ?? []) {
      if (rate.context) sowingPresent.add(rate.context);
    }
  }

  const rootSlugs = categories
    .filter((category) => category.parentId === null && category.active)
    .sort((first, second) => first.name.localeCompare(second.name))
    .map((category) => category.slug);

  return {
    category: keepOrdered(rootSlugs, categoryPresent),
    endUse: keepOrdered(END_USE_OPTIONS, endUsePresent),
    livestock: keepOrdered(LIVESTOCK_OPTIONS, livestockPresent),
    tolerance: keepOrdered(TOLERANCE_OPTIONS, tolerancePresent),
    rainfall: keepOrdered(RAINFALL_OPTIONS, rainfallPresent),
    soil: keepOrdered(SOIL_OPTIONS.map((option) => option.value), soilPresent),
    sowing: keepOrdered(SOWING_CONTEXT_OPTIONS, sowingPresent),
  };
}

function withOption(
  filters: ProductListingFilters,
  dimension: FilterOptionDimension,
  value: string | number,
): ProductListingFilters {
  if (dimension === "rainfall") {
    return { ...filters, rainfall: Number(value) };
  }
  const current = filters[dimension] as string[];
  if (current.includes(String(value))) return filters;
  return { ...filters, [dimension]: [...current, String(value)] };
}

function optionAlreadySelected(
  filters: ProductListingFilters,
  dimension: FilterOptionDimension,
  value: string | number,
) {
  if (dimension === "rainfall") return filters.rainfall === Number(value);
  return (filters[dimension] as string[]).includes(String(value));
}

/**
 * True when selecting this value still leaves at least one matching product,
 * or when it is already selected (so the user can uncheck it).
 */
export function isFilterOptionEnabled(
  products: CatalogueProduct[],
  categories: CatalogueCategory[],
  filters: ProductListingFilters,
  dimension: FilterOptionDimension,
  value: string | number,
) {
  if (optionAlreadySelected(filters, dimension, value)) return true;
  if (filtersAreEmpty(filters)) return true;
  const next = withOption(filters, dimension, value);
  return products.some((product) => productMatchesFilters(product, next, categories));
}
