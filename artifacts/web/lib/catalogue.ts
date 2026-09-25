import { unstable_rethrow } from "next/navigation";

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
  listingState?: "Active" | "New";
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
    faqs?: Array<{ question?: string; answer?: string }>;
    relatedProducts?: string[];
    formulationYear?: string;
    photos?: Array<{ src?: string; file?: string; slot?: string; rating?: string; alt?: string; width?: number; height?: number }>;
    h1?: string;
    seoTitle?: string;
    seoDescription?: string;
    socialTitle?: string;
    socialDescription?: string;
    socialImage?: string;
    canonicalUrl?: string;
    robotsIndex?: boolean;
  };
};

export type CatalogueCategoryFaq = {
  question: string;
  answer: string;
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
  faqs?: CatalogueCategoryFaq[];
  productCount?: number;
};

export type LegacyCatalogueProduct = { name: string };

export type CatalogueArticle = {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  tags: string[];
  heroImageSrc: string;
  relatedProductSlugs: string[];
  publishedAt: string;
  seoTitle: string;
  seoDescription: string;
  socialTitle: string;
  socialDescription: string;
  socialImage: string;
  robotsIndex: boolean;
  updatedAt: string;
};

export type SitemapProductEntry = {
  slug: string;
  lastModified: string;
};

export type PublicSiteHeroImage = {
  src: string;
  assetId: string | null;
  kind?: "image" | "video";
  posterSrc?: string;
  durationSeconds?: number;
};

export type PublicSiteHomepage = {
  heroImageSrc: string;
  heroImageAssetId: string | null;
  heroImages: PublicSiteHeroImage[];
  heroSlideshow: boolean;
  heroEyebrow: string;
  heroHeading: string;
  heroBody: string;
  aboutBody: string;
  bestSellerSlugs: string[];
};

export type PublicSiteSeedGuide = {
  navTitle: string;
  cardHeading: string;
  cardButtonLabel: string;
  cardImageSrc: string;
  cardImageAssetId: string | null;
  pdfFilename: string;
  pdfPublicUrl: string;
  pageTitle: string;
  pageIntro: string;
  pageButtonLabel: string;
};

export type PublicSiteAboutValue = {
  title: string;
  body: string;
};

export type PublicSiteAbout = {
  heroEyebrow: string;
  heroHeading: string;
  heroHeadingEmphasis: string;
  heroIntro: string;
  heroImageSrc: string;
  heroImageAssetId: string | null;
  storyLead: string;
  storyParagraphs: string[];
  valuesHeading: string;
  valuesHeadingEmphasis: string;
  values: PublicSiteAboutValue[];
};

export type PublicSiteCompany = {
  legalName: string;
  tradingName: string;
  phone: string;
  email: string;
  address: string;
  officeHours: string;
  abn: string;
};

export type PublicSiteSettings = {
  homepage: PublicSiteHomepage;
  seedGuide: PublicSiteSeedGuide;
  about: PublicSiteAbout;
  company: PublicSiteCompany;
  updatedAt: string;
};

export type CatalogueResellerOutlet = {
  id: number;
  name: string;
  address: string;
  suburb: string;
  postcode: string;
  region: string;
  phone: string;
  email: string;
  mapsUrl: string;
  latitude: number | null;
  longitude: number | null;
};

export type CatalogueResellerBrand = {
  id: number;
  name: string;
  kind: "elders" | "nutrien" | "independent";
  website: string;
  logoSrc: string;
  logoAssetId: string | null;
  outlets: CatalogueResellerOutlet[];
};

export function productPageHeading(product: CatalogueProduct) {
  return product.details.h1?.trim() || product.name;
}

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

function fetchCause(error: unknown) {
  if (error && typeof error === "object" && "cause" in error) {
    const cause = (error as { cause?: { code?: string; message?: string } }).cause;
    if (cause?.code) return cause.code;
    if (cause?.message) return cause.message;
  }
  return error instanceof Error ? error.message : "unknown error";
}

async function catalogueRequest(url: string, init?: RequestInit) {
  try {
    return await fetch(url, init);
  } catch (error) {
    unstable_rethrow(error);
    throw new Error(`Catalogue API could not be reached at ${url} (${fetchCause(error)})`, { cause: error });
  }
}

async function catalogueFetch<T>(path: string): Promise<T> {
  const response = await catalogueRequest(apiUrl(path), { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Catalogue request failed (${response.status}) for ${path}`);
  }
  return response.json() as Promise<T>;
}

export function getProducts() {
  return catalogueFetch<CatalogueProduct[]>("/api/products");
}

export async function getProductBySlug(slug: string) {
  const response = await catalogueRequest(apiUrl(`/api/products/slug/${encodeURIComponent(slug)}`), {
    cache: "no-store",
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Product request failed (${response.status}) for ${slug}`);
  return response.json() as Promise<CatalogueProduct>;
}

export async function getRedirect(fromPath: string) {
  const response = await catalogueRequest(apiUrl(`/api/redirects/lookup?fromPath=${encodeURIComponent(fromPath)}`), {
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

export function getArticles() {
  return catalogueFetch<CatalogueArticle[]>("/api/articles");
}

export function getSitemapProductEntries() {
  return catalogueFetch<SitemapProductEntry[]>("/api/sitemap-product-entries");
}

export async function getArticleBySlug(slug: string) {
  const response = await catalogueRequest(apiUrl(`/api/articles/slug/${encodeURIComponent(slug)}`), {
    cache: "no-store",
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Article request failed (${response.status}) for ${slug}`);
  return response.json() as Promise<CatalogueArticle>;
}

export function getSiteSettings() {
  return catalogueFetch<PublicSiteSettings>("/api/site-settings");
}

export function getResellers() {
  return catalogueFetch<CatalogueResellerBrand[]>("/api/resellers");
}

export function getLegacyProducts(categoryName: string) {
  return catalogueFetch<LegacyCatalogueProduct[]>(
    `/api/products/category/${encodeURIComponent(categoryName)}/legacy`,
  );
}
