import type { CatalogueCategory, CatalogueProduct } from "./catalogue";
import {
  filtersFromSearchParams,
  soilMatches,
  type PasturePersistence,
  type ProductListingFilters,
} from "./product-filters";

export const SELECTOR_RAINFALL = [
  { value: 300, label: "Under 350 mm", note: "Wheatbelt / mallee margin" },
  { value: 350, label: "350–450 mm", note: "" },
  { value: 450, label: "450–550 mm", note: "" },
  { value: 550, label: "550–650 mm", note: "" },
  { value: 650, label: "650 mm and above", note: "South West, Great Southern" },
] as const;

export const SELECTOR_SOIL = [
  { value: "LS", label: "Deep sand — free-draining, low fertility", short: "deep sand" },
  { value: "S", label: "Sand over loam / sandy", short: "sand" },
  { value: "L", label: "Loam — deeper, more fertile", short: "loam" },
  { value: "H", label: "Heavy / clay", short: "clay" },
] as const;

export const SELECTOR_GROUND = [
  { value: "Waterlogging", label: "Gets wet / waterlogs in winter", badge: "Suits wet ground" },
  { value: "Low pH", label: "Acid soil, pH under 5", badge: "Suits acid soil" },
  { value: "Salinity", label: "Salty patches", badge: "Suits salty ground" },
] as const;

export const SELECTOR_END_USE = [
  { value: "Grazing", label: "Grazing" },
  { value: "Hay", label: "Hay" },
  { value: "Silage", label: "Silage" },
  { value: "Break crop", label: "Break crop" },
  { value: "Grain", label: "Grain" },
  { value: "Cover crop,Green manure", label: "Cover crop or green manure" },
  { value: "Permanent pasture", label: "Permanent pasture" },
  { value: "Erosion control / stabilisation", label: "Erosion control" },
] as const;

export const SELECTOR_LIVESTOCK = [
  { value: "Beef", label: "Beef" },
  { value: "Sheep", label: "Sheep" },
  { value: "Dairy", label: "Dairy" },
  { value: "Equine", label: "Horses" },
] as const;

export const SELECTOR_PERSISTENCE = [
  { value: "annual" as const, label: "Just this season — feed now, resow next year", why: "annual" },
  { value: "self-regenerating" as const, label: "Comes back on its own each year", why: "self-regenerating" },
  { value: "lasting" as const, label: "Several years — a lasting pasture", why: "lasting" },
] as const;

export const RAINFALL_GAP = "rainfall not stated — ask us";
export const SOIL_GAP = "soil range not stated";
export const END_USE_GAP = "use not stated";
export const PERSISTENCE_GAP = "stand life not stated";
export const MILD_TOLERANCE = "Moderate tolerance — check with us";

const LASTING_TYPES = new Set(["Perennial", "Biennial", "Hybrid perennial"]);
const SELF_REGENERATING_SLUGS = new Set(["subterranean", "aerial-seeded-annual", "serradella", "medic"]);
const ACID_PH_MAX = 4.8;

const CONTACT_SOIL: Record<string, string> = {
  LS: "Light sand",
  S: "Sand",
  L: "Loam",
  H: "Heavy / clay",
};

export type PastureSelectorGroup = "mix" | "variety" | "maybe";

export type PastureSelectorBadge = {
  tone: "good" | "caution";
  label: string;
};

export type PastureSelectorCard = {
  product: CatalogueProduct;
  group: PastureSelectorGroup;
  why: string;
  sowingRate: string | null;
  badges: PastureSelectorBadge[];
  toleranceRank: number;
  livestockRank: number;
  persistenceRank: number;
};

export type PastureSelectorGroups = {
  mixes: PastureSelectorCard[];
  varieties: PastureSelectorCard[];
  maybe: PastureSelectorCard[];
};

export type SelectorEnquiryPrefill = {
  topic: string;
  message: string;
  soil: string;
  rainfall: string;
};

export function pageSearchParams(raw: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") params.append(key, value);
    else if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
    }
  }
  return params;
}

export function hasSelectorAnswers(filters: ProductListingFilters) {
  return filters.rainfall != null
    || filters.soil.length > 0
    || filters.tolerance.length > 0
    || filters.endUse.length > 0
    || filters.livestock.length > 0
    || filters.persistence != null;
}

export function endUseParts(value: string) {
  return value.split(",").map((part) => part.trim()).filter(Boolean);
}

export function endUseSelected(filters: ProductListingFilters, value: string) {
  return endUseParts(value).every((part) => filters.endUse.includes(part));
}

function isBiological(product: CatalogueProduct) {
  return product.category === "Biologicals";
}

export function isPastureMix(product: CatalogueProduct) {
  return product.details.recordType === "Mix" || product.category === "Mixes";
}

function childCategory(product: CatalogueProduct, categories: CatalogueCategory[]) {
  if (product.subcategoryId == null) return null;
  const category = categories.find((item) => item.id === product.subcategoryId);
  if (!category || category.parentId == null) return null;
  return category;
}

function isSelfRegenerationMix(product: CatalogueProduct) {
  return /self[\s-]*regeneration/i.test(product.name) || product.slug.includes("self-regeneration");
}

function matchesSelfRegenerating(product: CatalogueProduct, categories: CatalogueCategory[]) {
  if (isSelfRegenerationMix(product)) return true;
  const child = childCategory(product, categories);
  return child != null && SELF_REGENERATING_SLUGS.has(child.slug);
}

function persistenceOutcome(
  product: CatalogueProduct,
  categories: CatalogueCategory[],
  persistence: PasturePersistence,
): "match" | "gap" | "exclude" {
  if (persistence === "self-regenerating") {
    if (matchesSelfRegenerating(product, categories)) return "match";
    if (!product.details.persistencyType) return "gap";
    return "exclude";
  }
  const type = product.details.persistencyType ?? "";
  if (!type) return "gap";
  if (persistence === "annual") return type === "Annual" ? "match" : "exclude";
  return LASTING_TYPES.has(type) ? "match" : "exclude";
}

function persistenceWhy(product: CatalogueProduct, persistence: PasturePersistence) {
  if (persistence === "lasting") {
    const type = product.details.persistencyType?.trim();
    return type ? type.toLowerCase() : "lasting";
  }
  return SELECTOR_PERSISTENCE.find((option) => option.value === persistence)?.why ?? persistence;
}

function soilPhrase(light: string, heavy: string) {
  const lightLabel = SELECTOR_SOIL.find((option) => option.value === light)?.short ?? light;
  const heavyLabel = SELECTOR_SOIL.find((option) => option.value === heavy)?.short ?? heavy;
  return light === heavy ? lightLabel : `${lightLabel} to ${heavyLabel}`;
}

function endUseWhy(product: CatalogueProduct, selected: string[]) {
  return (product.details.endUse ?? [])
    .filter((value) => selected.includes(value))
    .map((value) => value.toLowerCase());
}

export function generalSowingRate(product: CatalogueProduct) {
  const rate = product.details.sowingRates?.find((item) => item.context === "General");
  if (!rate || (rate.min == null && rate.max == null)) return null;
  const unit = rate.unit?.trim() || "kg/ha";
  if (rate.min != null && rate.max != null && rate.min !== rate.max) return `${rate.min}–${rate.max} ${unit}`;
  return `${rate.min ?? rate.max} ${unit}`;
}

function toleranceBadges(product: CatalogueProduct, selected: string[]) {
  const badges: PastureSelectorBadge[] = [];
  let rank = 0;
  for (const option of SELECTOR_GROUND) {
    if (!selected.includes(option.value)) continue;
    const recorded = product.details.tolerance?.find((item) => item.name === option.value);
    const acidByPh = option.value === "Low pH"
      && product.details.soilPhMin != null
      && product.details.soilPhMin <= ACID_PH_MAX;
    if (!recorded && !acidByPh) continue;
    rank += 1;
    badges.push(recorded?.mild
      ? { tone: "caution", label: MILD_TOLERANCE }
      : { tone: "good", label: option.badge });
  }
  const seen = new Set<string>();
  return {
    rank,
    badges: badges.filter((badge) => {
      if (seen.has(badge.label)) return false;
      seen.add(badge.label);
      return true;
    }),
  };
}

function livestockRank(product: CatalogueProduct, selected: string[]) {
  if (!selected.length) return 0;
  return (product.details.livestock ?? []).some((value) => selected.includes(value)) ? 1 : 0;
}

function compareCards(first: PastureSelectorCard, second: PastureSelectorCard) {
  return second.persistenceRank - first.persistenceRank
    || second.toleranceRank - first.toleranceRank
    || second.livestockRank - first.livestockRank
    || first.product.name.localeCompare(second.product.name, "en-AU");
}

export function selectPastureProducts(
  products: CatalogueProduct[],
  categories: CatalogueCategory[],
  filters: ProductListingFilters,
): PastureSelectorGroups {
  const cards: PastureSelectorCard[] = [];
  for (const product of products) {
    if (isBiological(product)) continue;
    const gaps: string[] = [];
    const why: string[] = [];
    let excluded = false;
    let persistenceRank = 0;

    if (filters.rainfall != null) {
      const minimum = product.details.rainfallMinMm;
      if (minimum == null) gaps.push(RAINFALL_GAP);
      else if (minimum > filters.rainfall) excluded = true;
      else why.push(`${minimum} mm+`);
    }

    if (!excluded && filters.soil.length) {
      const light = product.details.soilRangeLightest ?? "";
      const heavy = product.details.soilRangeHeaviest ?? "";
      if (!light || !heavy) gaps.push(SOIL_GAP);
      else if (!soilMatches(product, filters.soil)) excluded = true;
      else why.push(soilPhrase(light, heavy));
    }

    if (!excluded && filters.endUse.length) {
      const uses = product.details.endUse ?? [];
      if (!uses.length) gaps.push(END_USE_GAP);
      else if (!uses.some((value) => filters.endUse.includes(value))) excluded = true;
      else why.push(...endUseWhy(product, filters.endUse));
    }

    const mix = isPastureMix(product);
    if (!excluded && filters.persistence) {
      const outcome = persistenceOutcome(product, categories, filters.persistence);
      if (mix) {
        if (outcome === "match") {
          persistenceRank = 1;
          why.push(persistenceWhy(product, filters.persistence));
        }
      } else if (outcome === "exclude") excluded = true;
      else if (outcome === "gap") gaps.push(PERSISTENCE_GAP);
      else why.push(persistenceWhy(product, filters.persistence));
    }

    if (excluded) continue;

    const tolerance = toleranceBadges(product, filters.tolerance);
    const badges = [...tolerance.badges];
    if (mix && filters.persistence && persistenceRank === 0 && !product.details.persistencyType) {
      badges.push({ tone: "caution", label: PERSISTENCE_GAP });
    }
    for (const gap of gaps) badges.push({ tone: "caution", label: gap });

    cards.push({
      product,
      group: gaps.length ? "maybe" : mix ? "mix" : "variety",
      why: why.length ? `Suits ${why.join(", ")}` : "",
      sowingRate: generalSowingRate(product),
      badges,
      toleranceRank: tolerance.rank,
      livestockRank: livestockRank(product, filters.livestock),
      persistenceRank,
    });
  }

  const sort = (group: PastureSelectorGroup) => cards.filter((card) => card.group === group).sort(compareCards);
  return { mixes: sort("mix"), varieties: sort("variety"), maybe: sort("maybe") };
}

export function findNamedProduct(products: CatalogueProduct[], pattern: RegExp) {
  return products.find((product) => pattern.test(product.name) || pattern.test(product.slug.replace(/-/g, " "))) ?? null;
}

export function selectorContactHref(params: URLSearchParams) {
  const next = new URLSearchParams(params);
  next.set("from", "pasture-selector");
  return `/contact?${next.toString()}`;
}

function labelsFor(values: readonly { value: string; label: string }[], selected: string[]) {
  return values.filter((option) => selected.includes(option.value)).map((option) => option.label);
}

export function selectorEnquiryPrefill(params: URLSearchParams): SelectorEnquiryPrefill | null {
  if (params.get("from") !== "pasture-selector") return null;
  const filters = filtersFromSearchParams(params);
  const rainfall = SELECTOR_RAINFALL.find((option) => option.value === filters.rainfall)?.label ?? "";
  const soilLabels = labelsFor(SELECTOR_SOIL, filters.soil);
  const soil = soilLabels.length > 1 ? "Mixed / not sure" : CONTACT_SOIL[filters.soil[0] ?? ""] ?? "";
  const lines = ["Paddock from the pasture selector."];
  if (rainfall) lines.push(`Rainfall: ${rainfall}`);
  if (soilLabels.length) lines.push(`Soil: ${soilLabels.join("; ")}`);
  const ground = labelsFor(SELECTOR_GROUND, filters.tolerance);
  if (ground.length) lines.push(`Ground: ${ground.join("; ")}`);
  const uses = SELECTOR_END_USE.filter((option) => endUseSelected(filters, option.value)).map((option) => option.label);
  if (uses.length) lines.push(`Use: ${uses.join(", ")}`);
  const stock = labelsFor(SELECTOR_LIVESTOCK, filters.livestock);
  if (stock.length) lines.push(`Stock: ${stock.join(", ")}`);
  const persistence = SELECTOR_PERSISTENCE.find((option) => option.value === filters.persistence)?.label;
  if (persistence) lines.push(`How long: ${persistence}`);
  return {
    topic: "A sowing rate or mix recommendation",
    message: lines.join("\n"),
    soil,
    rainfall,
  };
}
