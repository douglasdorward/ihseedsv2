import type { MetadataRoute } from "next";
import { getArticles, getCategories, getProducts, getSitemapProductEntries } from "../lib/catalogue";
import { buildPublicSitemap } from "../lib/sitemap-entries";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories, articles, productDates] = await Promise.all([
    getProducts().catch(() => []),
    getCategories().catch(() => []),
    getArticles().catch(() => []),
    getSitemapProductEntries().catch(() => []),
  ]);

  return buildPublicSitemap({ products, categories, articles, productDates });
}
