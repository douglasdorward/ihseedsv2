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
  saleLines?: Array<{
    sortOrder?: number;
    seedForm?: string;
  }>;
  details: {
    tagline: string;
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

function apiUrl(path: string) {
  const base = process.env.API_BASE?.replace(/\/+$/, "");
  if (!base) throw new Error("API_BASE environment variable is required.");
  return `${base}${path}`;
}

async function catalogueFetch<T>(path: string): Promise<T> {
  const response = await fetch(apiUrl(path), { next: { revalidate: 300 } });
  if (!response.ok) {
    throw new Error(`Catalogue request failed (${response.status}) for ${path}`);
  }
  return response.json() as Promise<T>;
}

export function getProducts() {
  return catalogueFetch<CatalogueProduct[]>("/api/products");
}

export function getCategories() {
  return catalogueFetch<CatalogueCategory[]>("/api/categories");
}

export function getLegacyProducts(categoryName: string) {
  return catalogueFetch<LegacyCatalogueProduct[]>(
    `/api/products/category/${encodeURIComponent(categoryName)}/legacy`,
  );
}
