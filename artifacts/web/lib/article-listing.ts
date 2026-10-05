import type { CatalogueArticle } from "./catalogue";

/**
 * The fields an article card reads. Bodies, SEO and social copy stay on the
 * server so the articles page doesn't ship every article's full text.
 */
export type ListingArticle = Pick<
  CatalogueArticle,
  "id" | "slug" | "title" | "excerpt" | "tags" | "heroImageSrc" | "publishedAt"
>;

export function toListingArticle(article: CatalogueArticle): ListingArticle {
  return {
    id: article.id,
    slug: article.slug,
    title: article.title,
    excerpt: article.excerpt,
    tags: article.tags,
    heroImageSrc: article.heroImageSrc,
    publishedAt: article.publishedAt,
  };
}

export const ALL_TOPICS = "All";

/** "All" followed by every tag in first-seen order. */
export function articleTopics(articles: ListingArticle[]): string[] {
  return [ALL_TOPICS, ...Array.from(new Set(articles.flatMap((article) => article.tags).filter(Boolean)))];
}

/** The topic from `?topic=`; missing or unknown topics mean "All". */
export function topicFromSearchParams(params: URLSearchParams, topics: string[]): string {
  const raw = params.get("topic");
  return raw && raw !== ALL_TOPICS && topics.includes(raw) ? raw : ALL_TOPICS;
}

export function articlesForTopic(articles: ListingArticle[], topic: string): ListingArticle[] {
  return topic === ALL_TOPICS ? articles : articles.filter((article) => article.tags.includes(topic));
}

/** Link for a topic chip. Changing topic always returns to page 1. */
export function topicHref(pathname: string, params: URLSearchParams, topic: string): string {
  const next = new URLSearchParams(params);
  next.delete("page");
  if (topic === ALL_TOPICS) next.delete("topic");
  else next.set("topic", topic);
  const query = next.toString();
  return query ? `${pathname}?${query}` : pathname;
}
