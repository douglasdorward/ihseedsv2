import type { CatalogueProduct } from "./catalogue";

export type ProductQuickFact = { label: string; value: string | number; icon: string };

type SowingRate = NonNullable<CatalogueProduct["details"]["sowingRates"]>[number];

function formatSowingRate(rate: SowingRate) {
  const hasMin = rate.min != null;
  const hasMax = rate.max != null;
  if (!hasMin && !hasMax) return null;
  const range = hasMin && hasMax ? `${rate.min}–${rate.max}` : String(hasMin ? rate.min : rate.max);
  return [range, rate.unit, rate.context].filter((part) => Boolean(part && String(part).trim())).join(" ");
}

// Preserves the historical ProductDetail fact order and values exactly.
export function getProductQuickFacts(product: CatalogueProduct): ProductQuickFact[] {
  const d = product.details;
  const quickFacts: ProductQuickFact[] = [];
  const sowingRate = (d.sowingRates ?? []).map(formatSowingRate).filter((value): value is string => Boolean(value)).join(", ");
  if (d.persistencyType) quickFacts.push({ label: "Type & persistency", value: d.persistencyType, icon: "leaf" });
  if (d.rainfallMinMm) quickFacts.push({ label: "Min rainfall", value: `${d.rainfallMinMm} mm+`, icon: "cloud-rain" });
  if (d.soilRangeLightest && d.soilRangeHeaviest && d.soilPhMin && d.soilPhScale) quickFacts.push({ label: "Soil & pH", value: `${d.soilRangeLightest}–${d.soilRangeHeaviest}, pH ${d.soilPhMin}+ (${d.soilPhScale})`, icon: "layers" });
  if (sowingRate) quickFacts.push({ label: "Sowing rate", value: sowingRate, icon: "scale" });
  if (d.tolerance?.length) quickFacts.push({ label: "Tolerances", value: d.tolerance.map((tolerance) => tolerance.mild ? `Mild ${tolerance.name}` : tolerance.name).join(", "), icon: "shield" });
  if (d.endUse?.length) quickFacts.push({ label: "End use", value: d.endUse.join(", "), icon: "target" });
  if (d.livestock?.length) quickFacts.push({ label: "Livestock", value: d.livestock.join(", "), icon: "paw-print" });
  if (["Ryegrasses", "Fescues & Other Grasses", "Sub-Tropical Grasses"].includes(product.category) && d.ploidy) quickFacts.push({ label: "Ploidy", value: d.ploidy, icon: "layers" });
  if (["Ryegrasses", "Fescues & Other Grasses"].includes(product.category)) {
    if (d.headingDate) quickFacts.push({ label: "Heading date", value: d.headingDate, icon: "calendar" });
    if (d.endophyte) quickFacts.push({ label: "Endophyte", value: d.endophyte, icon: "sprout" });
  }
  if (product.category === "Ryegrasses") {
    if (d.headingOffsetDays) quickFacts.push({ label: "Heading offset", value: `${d.headingOffsetDays} days vs Nui`, icon: "clock" });
    if (d.argtResistant) quickFacts.push({ label: "ARGT resistance", value: "Resistant", icon: "shield" });
  }
  if (["Clovers", "Serradellas & Medics"].includes(product.category)) {
    if (d.maturityDays) quickFacts.push({ label: "Days to flowering", value: d.maturityDays, icon: "calendar" });
    if (d.hardSeedLevel) quickFacts.push({ label: "Hard seed level", value: d.hardSeedLevel, icon: "shield" });
    if (d.flowerColour) quickFacts.push({ label: "Flower colour", value: d.flowerColour, icon: "flower" });
  }
  if (product.category === "Clovers" && d.oestrogenLevel) quickFacts.push({ label: "Oestrogen level", value: d.oestrogenLevel, icon: "activity" });
  if (["Clovers", "Serradellas & Medics"].includes(product.category) && d.bloatRisk) quickFacts.push({ label: "Bloat risk", value: d.bloatRisk, icon: "shield" });
  if (product.category === "Lucerne" && d.winterActivity) quickFacts.push({ label: "Winter activity", value: d.winterActivity, icon: "cloud-rain" });
  if (["Fescues & Other Grasses", "Sub-Tropical Grasses"].includes(product.category) && d.growthSeason) quickFacts.push({ label: "Growth season", value: d.growthSeason, icon: "sun" });
  if (product.category === "Forage & Grain Crops") {
    if (d.growingSeason) quickFacts.push({ label: "Growing season", value: d.growingSeason, icon: "sun" });
    if (d.weeksToFirstGrazing) quickFacts.push({ label: "Weeks to first grazing", value: d.weeksToFirstGrazing, icon: "clock" });
    if (d.prussicAcidRisk) quickFacts.push({ label: "Prussic acid risk", value: d.prussicAcidRisk, icon: "shield" });
    if (d.regrowth) quickFacts.push({ label: "Regrowth", value: d.regrowth, icon: "sprout" });
  }
  if (product.category === "Biologicals") {
    if (d.productForm) quickFacts.push({ label: "Product form", value: d.productForm, icon: "package" });
    if (d.applicationRate) quickFacts.push({ label: "Application rate", value: d.applicationRate, icon: "scale" });
  }
  return quickFacts;
}