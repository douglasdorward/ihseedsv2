export type CatalogueProduct = {
  id: number;
  name: string;
  slug: string;
  price: string;
  packSize: string;
  status: string;
  note: string;
  category: string;
  subcategoryId?: number | null;
  techSheet?: string;
  saleLines?: Array<{
    sortOrder?: number;
    stockCode?: string;
    seedForm?: string;
    packKg?: number | null;
    packUnit?: string;
    availability?: "Good stock" | "Low stock" | "Very low" | "Unavailable";
    priceDisplay?: string;
    isDefault?: boolean;
  }>;
  details: {
    recordType?: string;
    botanicalName?: string;
    tagline: string;
    blurb?: string;
    keyAttributes?: string[];
    distributionNote?: string;
    featured?: boolean;
    ploidy?: string;
    headingDate?: string;
    rainfallMinMm?: number | null;
    maturityDays?: number | null;
    hardSeedLevel?: string;
    flowerColour?: string;
    maturityMeasure?: string;
    winterActivity?: number | null;
    sowingRates?: Array<{
      context?: string;
      min?: number | null;
      max?: number | null;
      unit?: string;
    }>;
    endophyte?: string;
    growthSeason?: string;
    persistencyType?: string;
    growingSeason?: string;
    weeksToFirstGrazing?: number | null;
    floweringWindow?: string;
    productForm?: string;
    applicationRate?: string;
    soilRangeLightest?: string;
    soilRangeHeaviest?: string;
    soilPhMin?: number | null;
    soilPhScale?: string;
    tolerance?: Array<{ name: string; mild?: boolean }>;
    endUse?: string[];
    livestock?: string[];
    headingOffsetDays?: number | null;
    argtResistant?: boolean;
    oestrogenLevel?: string;
    bloatRisk?: string;
    prussicAcidRisk?: string;
    regrowth?: string;
    diseasePestResistance?: string;
    standLifeNotes?: string;
    grazingManagementNotes?: string;
    pbrProtected?: boolean;
    pbrDetails?: string;
    certification?: string[];
    description?: string;
    components?: Array<{ speciesName?: string; inclusionRate?: number | null; unit?: string; description?: string; note?: string; productLink?: string }>;
    relatedProducts?: string[];
    formulationYear?: string;
    photos?: Array<{ src?: string; file?: string; slot?: string; rating?: string }>;
    seoTitle?: string;
    seoDescription?: string;
    socialTitle?: string;
    socialDescription?: string;
    socialImage?: string;
    canonicalUrl?: string;
    robotsIndex?: boolean;
  };
};

export type CatalogueCategory = {
  id: number;
  parentId: number | null;
  slug: string;
  name: string;
  groupLabel: string;
  lead: string;
  image: string;
  sortOrder: number;
  active: boolean;
  pageHeading: string;
  seoTitle: string;
  seoDescription: string;
};

export type LegacyCatalogueProduct = { name: string };

export function defaultSaleLine(product: CatalogueProduct) {
  return product.saleLines?.find((line) => line.isDefault) ?? product.saleLines?.[0];
}

export function saleLinePriceDisplay(product: CatalogueProduct) {
  return defaultSaleLine(product)?.priceDisplay?.trim() || "";
}

export function saleLinePackLabels(product: CatalogueProduct) {
  const labels: string[] = [];
  for (const line of product.saleLines ?? []) {
    if (line.packKg == null || Number(line.packKg) <= 0) continue;
    const unit = line.packUnit?.trim() || "kg";
    const label = `${line.packKg} ${unit}`;
    if (!labels.includes(label)) labels.push(label);
  }
  return labels;
}

function apiUrl(path: string) {
  const base = process.env.API_BASE?.replace(/\/+$/, "");
  if (!base) throw new Error("API_BASE environment variable is required.");
  return `${base}${path}`;
}

async function catalogueFetch<T>(path: string): Promise<T> {
  const response = await fetch(apiUrl(path), { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Catalogue request failed (${response.status}) for ${path}`);
  }
  return response.json() as Promise<T>;
}

export function getProducts() {
  return catalogueFetch<CatalogueProduct[]>("/api/products");
}

export async function getProductBySlug(slug: string) {
  const response = await fetch(apiUrl(`/api/products/slug/${encodeURIComponent(slug)}`), {
    cache: "no-store",
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Product request failed (${response.status}) for ${slug}`);
  return response.json() as Promise<CatalogueProduct>;
}

export async function getRedirect(fromPath: string) {
  const response = await fetch(apiUrl(`/api/redirects/lookup?fromPath=${encodeURIComponent(fromPath)}`), {
    next: { revalidate: 300 },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Redirect request failed (${response.status}) for ${fromPath}`);
  const redirect: unknown = await response.json();
  if (!redirect || typeof redirect !== "object" || !("toPath" in redirect) ||
    typeof redirect.toPath !== "string" || !redirect.toPath.startsWith("/")) {
    throw new Error("Redirect response is invalid.");
  }
  return redirect.toPath;
}

export function getCategories() {
  return catalogueFetch<CatalogueCategory[]>("/api/categories");
}

export function getLegacyProducts(categoryName: string) {
  return catalogueFetch<LegacyCatalogueProduct[]>(
    `/api/products/category/${encodeURIComponent(categoryName)}/legacy`,
  );
}
