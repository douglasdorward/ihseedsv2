import { and, eq, inArray, lte } from "drizzle-orm";
import {
  articlesTable,
  catalogueCategoriesTable,
  db,
  isActiveListing,
  productsTable,
  type Article,
} from "@workspace/db";
import { bodyHasText } from "./article-body";
import { logger } from "./logger";
import { syncArticleMediaReferences } from "./media-usage";
import { productPublicPath } from "./product-path";

const SCHEDULER_INTERVAL_MS = 60_000;

export function publishValidationIssues(article: Pick<Article, "title" | "slug" | "excerpt" | "body" | "seoTitle" | "seoDescription">) {
  return [
    !article.title.trim() && { field: "title", label: "Title" },
    !article.slug.trim() && { field: "slug", label: "Slug" },
    !article.excerpt.trim() && { field: "excerpt", label: "Excerpt" },
    !bodyHasText(article.body) && { field: "body", label: "Article body" },
    !article.seoTitle.trim() && { field: "seoTitle", label: "SEO title" },
    !article.seoDescription.trim() && { field: "seoDescription", label: "SEO description" },
  ].filter(Boolean) as Array<{ field: string; label: string }>;
}

export async function listWorkbookLookups() {
  const categories = await db.select({
    parentId: catalogueCategoriesTable.parentId,
    slug: catalogueCategoriesTable.slug,
    name: catalogueCategoriesTable.name,
    sortOrder: catalogueCategoriesTable.sortOrder,
    active: catalogueCategoriesTable.active,
  }).from(catalogueCategoriesTable);
  const categoryRows = categories
    .filter((category) => category.parentId === null && category.active)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, "en-AU"))
    .map((category) => ({
      slug: category.slug,
      name: category.name,
      path: `/products/${category.slug}`,
    }));
  const products = await db.select({
    slug: productsTable.slug,
    name: productsTable.name,
    category: productsTable.category,
    publishStatus: productsTable.publishStatus,
    listingState: productsTable.listingState,
  }).from(productsTable);
  const productRows = products
    .filter((product) => product.publishStatus === "Published" && isActiveListing(product))
    .sort((left, right) => left.name.localeCompare(right.name, "en-AU"))
    .map((product) => ({
      slug: product.slug,
      name: product.name,
      category: product.category,
      category_slug: categories.find((category) => category.parentId === null && category.name === product.category)?.slug ?? "",
      path: productPublicPath(product.slug, product.category, categories),
    }));
  return { products: productRows, categories: categoryRows };
}

export async function findRelatedProductIssues(slugs: string[]) {
  const unique = [...new Set(slugs.map((slug) => slug.trim()).filter(Boolean))];
  if (!unique.length) return [] as string[];
  const rows = await db.select({
    slug: productsTable.slug,
    publishStatus: productsTable.publishStatus,
    listingState: productsTable.listingState,
  }).from(productsTable).where(inArray(productsTable.slug, unique));
  const eligible = new Set(
    rows
      .filter((product) => product.publishStatus === "Published" && isActiveListing(product))
      .map((product) => product.slug),
  );
  return unique.filter((slug) => !eligible.has(slug));
}

export function parseScheduledPublishAt(value: unknown) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

const CLOCK_SKEW_MS = 60_000;

export function isFuturePublishDate(date: Date, now = new Date()) {
  return date.getTime() > now.getTime() + CLOCK_SKEW_MS;
}

export async function publishDueArticles(now = new Date()) {
  const due = await db.select().from(articlesTable).where(and(
    eq(articlesTable.publishStatus, "Scheduled"),
    lte(articlesTable.scheduledPublishAt, now),
  ));
  const published: Article[] = [];
  for (const article of due) {
    const [updated] = await db.update(articlesTable).set({
      publishStatus: "Published",
      publishedAt: article.publishedAt ?? now,
      scheduledPublishAt: null,
      updatedAt: now,
    }).where(and(
      eq(articlesTable.id, article.id),
      eq(articlesTable.publishStatus, "Scheduled"),
    )).returning();
    if (!updated) continue;
    await syncArticleMediaReferences(updated);
    published.push(updated);
  }
  return published;
}

export function startArticlePublishScheduler() {
  const tick = () => {
    void publishDueArticles().catch((error) => {
      logger.error({ err: error }, "Scheduled article publish failed");
    });
  };
  tick();
  const timer = setInterval(tick, SCHEDULER_INTERVAL_MS);
  timer.unref();
  return timer;
}
