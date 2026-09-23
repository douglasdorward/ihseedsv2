"use server";

import { getArticles, getCategories, getProducts } from "./catalogue";
import { buildSearchDocuments, searchDocuments, type SearchHit } from "./site-search";

export async function searchSite(query: string): Promise<SearchHit[]> {
  const text = typeof query === "string" ? query : "";
  if (!text.trim()) return [];
  const [products, categories, articles] = await Promise.all([
    getProducts(),
    getCategories(),
    getArticles(),
  ]);
  return searchDocuments(text, buildSearchDocuments({ products, categories, articles }));
}
