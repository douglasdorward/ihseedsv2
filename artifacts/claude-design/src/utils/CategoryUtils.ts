import type { Product } from "@workspace/api-client-react";

export function getFactChips(product: Product, subcategoryName?: string) {
  const c = product.category;
  const d = product.details;
  const chips: string[] = [];
  
  const add = (val: any, suffix = "", prefix = "") => {
    if (val && val !== "None" && val !== "Nil") chips.push(`${prefix}${val}${suffix}`);
  };

  if (c === "Ryegrasses") {
    add(d.ploidy);
    add(d.headingDate);
    add(d.rainfallMinMm, " mm+");
  } else if (c === "Clovers") {
    if (subcategoryName) add(subcategoryName);
    add(d.maturityDays, " days");
    add((d as any).hardSeedLevel, " hard seed");
  } else if (c === "Serradellas & Medics") {
    add(d.flowerColour, " flowered");
    add(d.maturityDays, " days");
    const forms = product.saleLines?.map(l => l.seedForm).filter(Boolean).join(" & ");
    if (forms) add(forms);
  } else if (c === "Lucerne") {
    // "Winter activity rating" is under maturityMeasure for Lucerne, with value in maturityDays? Wait, backend/src/controllers/products mapped winter_activity to maturityDays probably.
    const wa = d.maturityMeasure === "Winter activity rating" ? d.maturityDays : (d as any).winterActivity;
    if (wa) add(`Winter active ${wa}`);
    add(d.rainfallMinMm, " mm+");
    const ctx = d.sowingRates?.[0]?.context;
    if (ctx) add(ctx);
  } else if (c === "Fescues & Other Grasses") {
    add((d as any).endophyte, " endophyte");
    add((d as any).growthSeason);
    add(d.rainfallMinMm, " mm+");
  } else if (c === "Sub-Tropical Grasses") {
    add(product.saleLines?.[0]?.seedForm);
    add(d.rainfallMinMm, " mm+");
    add(d.sowingRates?.find(r => r.context === "Turf") ? "Pasture & turf" : "Pasture");
  } else if (c === "Herbs") {
    add(d.persistencyType);
    add(d.rainfallMinMm, " mm+");
    add(d.sowingRates?.[0]?.context);
  } else if (c === "Forage & Grain Crops") {
    add((d as any).growingSeason, " crop");
    add((d as any).weeksToFirstGrazing, " wks", "Graze ");
    if (subcategoryName) add(subcategoryName);
  } else if (c === "Mixes") {
    if (subcategoryName) add(subcategoryName);
    const rate = d.sowingRates?.[0];
    if (rate && rate.min && rate.max) add(`${rate.min}–${rate.max} ${rate.unit}`);
    add((d as any).floweringWindow);
  } else if (c === "Biologicals") {
    add((d as any).productForm);
    add((d as any).applicationRate);
    add(product.packSize);
  }
  
  return chips.filter(Boolean).slice(0, 3);
}
