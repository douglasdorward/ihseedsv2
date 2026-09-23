import type { CatalogueProduct } from "../../lib/catalogue";

export const PRODUCT_FALLBACK_IMAGE = "/product-fallback.svg";

export function hasProductPhoto(product: CatalogueProduct) {
  return product.details.photos?.some((photo) => photo.src?.trim()) === true;
}

export function productCardImage(product: CatalogueProduct) {
  const attached = product.details.photos?.find((photo) => photo.src?.trim())?.src?.trim();
  return attached || PRODUCT_FALLBACK_IMAGE;
}

export function productImageAlt(product: CatalogueProduct) {
  const photo = product.details.photos?.find((item) => item.src?.trim());
  return photo?.alt?.trim() || product.name;
}

/** Listing pills stay one short label. Longer copy remains on the product page. */
export const LISTING_FACT_CHIP_MAX_LENGTH = 40;

export function getFactChips(product: CatalogueProduct, subcategoryName?: string) {
  const category = product.category;
  const details = product.details;
  const chips: string[] = [];
  const add = (value: unknown, suffix = "", prefix = "") => {
    if (!value || value === "None" || value === "Nil") return;
    const chip = `${prefix}${value}${suffix}`.replace(/\s+/g, " ").trim();
    if (!chip || chip.length > LISTING_FACT_CHIP_MAX_LENGTH) return;
    chips.push(chip);
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
    add(details.rainfallMinMm, " mm+");
    add(details.persistencyType);
    const forageRate = details.sowingRates?.[0];
    if (forageRate?.min && forageRate.max && forageRate.unit) add(`${forageRate.min}–${forageRate.max} ${forageRate.unit}`);
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
