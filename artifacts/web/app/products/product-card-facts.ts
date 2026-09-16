import type { CatalogueProduct } from "../../lib/catalogue";

export const listingImageOptions = [
  "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1530507629858-e4977d30e9e0?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1499529112087-3cb3b73cec95?auto=format&fit=crop&w=900&q=80",
];

export function productCardImage(product: CatalogueProduct, fallbackIndex = 0) {
  const attached = product.details.photos?.find((photo) => photo.src?.trim())?.src?.trim();
  return attached || listingImageOptions[fallbackIndex % listingImageOptions.length];
}

export function getFactChips(product: CatalogueProduct, subcategoryName?: string) {
  const category = product.category;
  const details = product.details;
  const chips: string[] = [];
  const add = (value: unknown, suffix = "", prefix = "") => {
    if (value && value !== "None" && value !== "Nil") chips.push(`${prefix}${value}${suffix}`);
  };

  if (category === "Ryegrasses") {
    add(details.ploidy);
    add(details.headingDate);
    add(details.rainfallMinMm, " mm+");
  } else if (category === "Clovers") {
    if (subcategoryName) add(subcategoryName);
    add(details.maturityDays, " days");
    add(details.hardSeedLevel, " hard seed");
  } else if (category === "Serradellas & Medics") {
    add(details.flowerColour, " flowered");
    add(details.maturityDays, " days");
    add(product.saleLines?.map((line) => line.seedForm).filter(Boolean).join(" & "));
  } else if (category === "Lucerne") {
    const winterActivity = details.maturityMeasure === "Winter activity rating"
      ? details.maturityDays
      : details.winterActivity;
    if (winterActivity) add(`Winter active ${winterActivity}`);
    add(details.rainfallMinMm, " mm+");
    add(details.sowingRates?.[0]?.context);
  } else if (category === "Fescues & Other Grasses") {
    add(details.endophyte, " endophyte");
    add(details.growthSeason);
    add(details.rainfallMinMm, " mm+");
  } else if (category === "Sub-Tropical Grasses") {
    add(product.saleLines?.[0]?.seedForm);
    add(details.rainfallMinMm, " mm+");
    add(details.sowingRates?.find((rate) => rate.context === "Turf") ? "Pasture & turf" : "Pasture");
  } else if (category === "Herbs") {
    add(details.persistencyType);
    add(details.rainfallMinMm, " mm+");
    add(details.sowingRates?.[0]?.context);
  } else if (category === "Forage & Grain Crops") {
    add(details.growingSeason, " crop");
    add(details.weeksToFirstGrazing, " wks", "Graze ");
    if (subcategoryName) add(subcategoryName);
  } else if (category === "Mixes") {
    if (subcategoryName) add(subcategoryName);
    const rate = details.sowingRates?.[0];
    if (rate?.min && rate.max) add(`${rate.min}–${rate.max} ${rate.unit}`);
    add(details.floweringWindow);
  } else if (category === "Biologicals") {
    add(details.productForm);
    add(details.applicationRate);
    add(product.packSize);
  }

  return chips.filter(Boolean).slice(0, 3);
}
