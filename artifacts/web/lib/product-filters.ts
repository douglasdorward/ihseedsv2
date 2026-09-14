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

export type ProductListingFilters = {
  category: string[];
  endUse: string[];
  livestock: string[];
  tolerance: string[];
  rainfall: number | null;
  soil: string[];
  sowing: string[];
};

export const EMPTY_FILTERS: ProductListingFilters = {
  category: [],
  endUse: [],
  livestock: [],
  tolerance: [],
  rainfall: null,
  soil: [],
  sowing: [],
};

function readList(params: URLSearchParams, key: string) {
  return params.getAll(key).flatMap((value) => value.split(",")).map((value) => value.trim()).filter(Boolean);
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
  return params;
}

export function filtersAreEmpty(filters: ProductListingFilters) {
  return !filters.category.length && !filters.endUse.length && !filters.livestock.length
    && !filters.tolerance.length && filters.rainfall == null && !filters.soil.length && !filters.sowing.length;
}

function intersects(selected: string[], values: string[] | undefined) {
  if (!selected.length) return true;
  return (values ?? []).some((value) => selected.includes(value));
}

function soilMatches(product: CatalogueProduct, selected: string[]) {
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
