import type { MetadataRoute } from "next";
import type { CatalogueArticle, CatalogueCategory, CatalogueProduct, SitemapProductEntry } from "./catalogue";
import { CATALOGUE_INDEX_PATH, productPublicPath } from "./catalogue-paths";
import { productCanonicalUrl } from "./product-url";
import { absoluteSiteUrl } from "./site-url";

export const SITEMAP_STATIC_PATHS = [
  "/",
  CATALOGUE_INDEX_PATH,
  "/availability",
  "/resources",
  "/guide",
  "/pasture-selector",
  "/about",
  "/contact",
  "/privacy",
  "/terms-and-conditions",
];

export function sitemapDate(value: string | undefined) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function entry(url: string, lastModified?: Date): MetadataRoute.Sitemap[number] {
  return lastModified ? { url, lastModified } : { url };
}

export function buildPublicSitemap(input: {
  products: CatalogueProduct[];
  categories: CatalogueCategory[];
  articles: CatalogueArticle[];
  productDates?: SitemapProductEntry[];
}): MetadataRoute.Sitemap {
  const lastModifiedBySlug = new Map(
    (input.productDates ?? []).map((item) => [item.slug, item.lastModified]),
  );
  const entries: MetadataRoute.Sitemap = SITEMAP_STATIC_PATHS.map((path) => entry(absoluteSiteUrl(path)));

  for (const category of input.categories) {
    if (category.parentId !== null || !category.active || (category.productCount ?? 0) <= 0) continue;
    entries.push(entry(absoluteSiteUrl(`/products/${category.slug}`)));
  }

  for (const product of input.products) {
    if (product.details.robotsIndex === false) continue;
    const path = productCanonicalUrl(
      product.details.canonicalUrl,
      productPublicPath(product, input.categories),
    );
    entries.push(entry(absoluteSiteUrl(path), sitemapDate(lastModifiedBySlug.get(product.slug))));
  }

  for (const article of input.articles) {
    if (article.robotsIndex === false) continue;
    entries.push(entry(
      absoluteSiteUrl(`/resources/${article.slug}`),
      sitemapDate(article.updatedAt || article.publishedAt),
    ));
  }

  return entries;
}
