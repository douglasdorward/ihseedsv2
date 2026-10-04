import type { CatalogueProduct } from "./catalogue";

/**
 * Detail fields the product listing cards, fact chips, comparison table and
 * filters read. Anything not listed here stays on the server so listing pages
 * do not ship every product's full record (descriptions, SEO copy, FAQs…) to
 * the browser. Add a field here when a listing component starts reading it.
 */
export const LISTING_DETAIL_FIELDS = [
  "tagline",
  "ploidy",
  "headingDate",
  "rainfallMinMm",
  "maturityDays",
  "hardSeedLevel",
  "flowerColour",
  "maturityMeasure",
  "winterActivity",
  "sowingRates",
  "endophyte",
  "growthSeason",
  "persistencyType",
  "growingSeason",
  "weeksToFirstGrazing",
  "floweringWindow",
  "productForm",
  "applicationRate",
  "soilRangeLightest",
  "soilRangeHeaviest",
  "soilPhMin",
  "soilPhScale",
  "tolerance",
  "endUse",
  "livestock",
] as const satisfies ReadonlyArray<keyof CatalogueProduct["details"]>;

type ListingDetailField = (typeof LISTING_DETAIL_FIELDS)[number];
type ListingPhoto = Pick<NonNullable<CatalogueProduct["details"]["photos"]>[number], "src" | "alt">;

export type ListingProduct = Pick<
  CatalogueProduct,
  "id" | "name" | "slug" | "status" | "category" | "subcategoryId" | "listingState" | "packSize"
> & {
  saleLines?: Array<Pick<NonNullable<CatalogueProduct["saleLines"]>[number], "seedForm">>;
  details: Pick<CatalogueProduct["details"], ListingDetailField> & { photos?: ListingPhoto[] };
};

/** The slim record a listing page passes to its client component. */
export function toListingProduct(product: CatalogueProduct): ListingProduct {
  const details = {} as Record<string, unknown>;
  for (const field of LISTING_DETAIL_FIELDS) {
    const value = product.details[field];
    if (value !== undefined) details[field] = value;
  }
  // Cards only ever show the first photo that has a src.
  const photo = product.details.photos?.find((item) => item.src?.trim());
  if (photo) details.photos = [{ src: photo.src, ...(photo.alt ? { alt: photo.alt } : {}) }];

  const listing: ListingProduct = {
    id: product.id,
    name: product.name,
    slug: product.slug,
    status: product.status,
    category: product.category,
    packSize: product.packSize,
    details: details as ListingProduct["details"],
  };
  if (product.subcategoryId !== undefined) listing.subcategoryId = product.subcategoryId;
  if (product.listingState !== undefined) listing.listingState = product.listingState;
  // Keep line order and count: some chips read the first sale line.
  if (product.saleLines?.length) listing.saleLines = product.saleLines.map((line) => ({ seedForm: line.seedForm }));
  return listing;
}
