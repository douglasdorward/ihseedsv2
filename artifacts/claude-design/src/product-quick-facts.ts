export type QuickFactSlotId =
  | "persistencyType"
  | "rainfallMinMm"
  | "soilPh"
  | "sowingRates"
  | "tolerance"
  | "endUse"
  | "livestock"
  | "ploidy"
  | "headingDate"
  | "endophyte"
  | "headingOffsetDays"
  | "argtResistant"
  | "maturityDays"
  | "hardSeedLevel"
  | "flowerColour"
  | "oestrogenLevel"
  | "bloatRisk"
  | "winterActivity"
  | "growthSeason"
  | "growingSeason"
  | "weeksToFirstGrazing"
  | "prussicAcidRisk"
  | "regrowth"
  | "productForm"
  | "applicationRate";

export type EditorQuickFactSlot = {
  id: QuickFactSlotId;
  label: string;
  icon: string;
  formatted: string;
};

type SowingRate = { min?: number | null; max?: number | null; unit?: string; context?: string };
type Tolerance = { name: string; mild?: boolean };

export const SOIL_LABELS: Record<string, string> = {
  LS: "Light sand",
  S: "Sand",
  L: "Loam",
  H: "Heavy",
};

export type QuickFactDetails = {
  persistencyType?: string;
  rainfallMinMm?: number | null;
  soilRangeLightest?: string;
  soilRangeHeaviest?: string;
  soilPhMin?: number | null;
  soilPhScale?: string;
  sowingRates?: SowingRate[];
  tolerance?: Tolerance[];
  endUse?: string[];
  livestock?: string[];
  ploidy?: string;
  headingDate?: string;
  endophyte?: string;
  headingOffsetDays?: number | null;
  argtResistant?: boolean;
  maturityDays?: number | null;
  hardSeedLevel?: string;
  flowerColour?: string;
  oestrogenLevel?: string;
  bloatRisk?: string;
  winterActivity?: number | null;
  growthSeason?: string;
  growingSeason?: string;
  weeksToFirstGrazing?: string;
  prussicAcidRisk?: string;
  regrowth?: string;
  productForm?: string;
  applicationRate?: string;
};

function formatSowingRate(rate: SowingRate) {
  const hasMin = rate.min != null;
  const hasMax = rate.max != null;
  if (!hasMin && !hasMax) return null;
  const range = hasMin && hasMax ? `${rate.min}–${rate.max}` : String(hasMin ? rate.min : rate.max);
  return [range, rate.unit, rate.context].filter((part) => Boolean(part && String(part).trim())).join(" ");
}

function formattedSowingRates(rates: SowingRate[] | undefined) {
  return (rates ?? []).map(formatSowingRate).filter((value): value is string => Boolean(value)).join(", ");
}

function formattedTolerances(tolerance: Tolerance[] | undefined) {
  return (tolerance ?? []).map((item) => item.mild ? `Mild ${item.name}` : item.name).join(", ");
}

export function formatSoilAndPh(details: QuickFactDetails) {
  const lightest = details.soilRangeLightest ? SOIL_LABELS[details.soilRangeLightest] : undefined;
  const heaviest = details.soilRangeHeaviest ? SOIL_LABELS[details.soilRangeHeaviest] : undefined;
  if (!lightest || !heaviest || details.soilPhMin == null || !details.soilPhScale) return "";
  const soilRange = lightest === heaviest ? lightest : `${lightest} to ${heaviest}`;
  return `Soil range: ${soilRange} · pH ${details.soilPhMin}+ (${details.soilPhScale})`;
}

/** Category-gated slots in public Quick-facts order, including empty placeholders. */
export function getEditorQuickFactSlots(category: string, details: QuickFactDetails): EditorQuickFactSlot[] {
  const slots: EditorQuickFactSlot[] = [
    { id: "persistencyType", label: "Type & persistency", icon: "leaf", formatted: details.persistencyType?.trim() || "" },
    { id: "rainfallMinMm", label: "Min rainfall", icon: "cloud-rain", formatted: details.rainfallMinMm ? `${details.rainfallMinMm} mm+` : "" },
    { id: "soilPh", label: "Soil & pH", icon: "layers", formatted: formatSoilAndPh(details) },
    { id: "sowingRates", label: "Sowing rate", icon: "scale", formatted: formattedSowingRates(details.sowingRates) },
    { id: "tolerance", label: "Tolerances", icon: "shield", formatted: formattedTolerances(details.tolerance) },
    { id: "endUse", label: "End use", icon: "target", formatted: (details.endUse ?? []).join(", ") },
    { id: "livestock", label: "Livestock", icon: "paw-print", formatted: (details.livestock ?? []).join(", ") },
  ];

  if (["Ryegrasses", "Fescues & Other Grasses", "Sub-Tropical Grasses"].includes(category)) {
    slots.push({ id: "ploidy", label: "Ploidy", icon: "layers", formatted: details.ploidy?.trim() || "" });
  }
  if (["Ryegrasses", "Fescues & Other Grasses"].includes(category)) {
    slots.push({ id: "headingDate", label: "Heading date", icon: "calendar", formatted: details.headingDate?.trim() || "" });
    slots.push({ id: "endophyte", label: "Endophyte", icon: "sprout", formatted: details.endophyte?.trim() || "" });
  }
  if (category === "Ryegrasses") {
    slots.push({
      id: "headingOffsetDays",
      label: "Heading offset",
      icon: "clock",
      formatted: details.headingOffsetDays ? `${details.headingOffsetDays} days vs Nui` : "",
    });
    slots.push({
      id: "argtResistant",
      label: "ARGT resistance",
      icon: "shield",
      formatted: details.argtResistant ? "Resistant" : "",
    });
  }
  if (["Clovers", "Serradellas & Medics"].includes(category)) {
    slots.push({ id: "maturityDays", label: "Days to flowering", icon: "calendar", formatted: details.maturityDays != null ? String(details.maturityDays) : "" });
    slots.push({ id: "hardSeedLevel", label: "Hard seed level", icon: "shield", formatted: details.hardSeedLevel?.trim() || "" });
    slots.push({ id: "flowerColour", label: "Flower colour", icon: "flower", formatted: details.flowerColour?.trim() || "" });
  }
  if (category === "Clovers") {
    slots.push({ id: "oestrogenLevel", label: "Oestrogen level", icon: "activity", formatted: details.oestrogenLevel?.trim() || "" });
  }
  if (["Clovers", "Serradellas & Medics"].includes(category)) {
    slots.push({ id: "bloatRisk", label: "Bloat risk", icon: "shield", formatted: details.bloatRisk?.trim() || "" });
  }
  if (category === "Lucerne") {
    slots.push({ id: "winterActivity", label: "Winter activity", icon: "cloud-rain", formatted: details.winterActivity != null ? String(details.winterActivity) : "" });
  }
  if (["Fescues & Other Grasses", "Sub-Tropical Grasses"].includes(category)) {
    slots.push({ id: "growthSeason", label: "Growth season", icon: "sun", formatted: details.growthSeason?.trim() || "" });
  }
  if (category === "Forage & Grain Crops") {
    slots.push({ id: "growingSeason", label: "Growing season", icon: "sun", formatted: details.growingSeason?.trim() || "" });
    slots.push({ id: "weeksToFirstGrazing", label: "Weeks to first grazing", icon: "clock", formatted: details.weeksToFirstGrazing?.trim() || "" });
    slots.push({ id: "prussicAcidRisk", label: "Prussic acid risk", icon: "shield", formatted: details.prussicAcidRisk?.trim() || "" });
    slots.push({ id: "regrowth", label: "Regrowth", icon: "sprout", formatted: details.regrowth?.trim() || "" });
  }
  if (category === "Biologicals") {
    slots.push({ id: "productForm", label: "Product form", icon: "package", formatted: details.productForm?.trim() || "" });
    slots.push({ id: "applicationRate", label: "Application rate", icon: "scale", formatted: details.applicationRate?.trim() || "" });
  }
  return slots;
}
