import { sql } from "drizzle-orm";
import { boolean, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { forSearchMetadata } from "./products";

export type ArticlePublishStatus = "Draft" | "Published";

export const ARTICLE_RELATED_PRODUCT_LIMIT = 3;
export const ARTICLE_TAG_LIMIT = 12;
export const ARTICLE_TAG_PRESETS = ["Editorial", "Sowing & Timing", "Feed Planning", "Regional Advice"] as const;

const emptyTags: string[] = [];
const emptyRelated: string[] = [];

export const articlesTable = pgTable("ih_articles", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  excerpt: text("excerpt").notNull().default(""),
  body: text("body").notNull().default(""),
  tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
  heroImageSrc: text("hero_image_src").notNull().default(""),
  heroImageAssetId: text("hero_image_asset_id"),
  relatedProductSlugs: jsonb("related_product_slugs").$type<string[]>().notNull().default(emptyRelated),
  publishStatus: text("publish_status").$type<ArticlePublishStatus>().notNull().default("Draft"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  seoTitle: text("seo_title").notNull().default(""),
  seoDescription: text("seo_description").notNull().default(""),
  socialTitle: text("social_title").notNull().default(""),
  socialDescription: text("social_description").notNull().default(""),
  socialImage: text("social_image").notNull().default(""),
  robotsIndex: boolean("robots_index").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("ih_articles_slug_unique").on(table.slug),
]);

const slugSchema = z.string().trim().min(1).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

function uniqueTrimmed(items: string[], limit: number) {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const raw of items) {
    const value = raw.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    next.push(value);
    if (next.length >= limit) break;
  }
  return next;
}

const tagsSchema = z.array(z.string().trim().max(80)).max(ARTICLE_TAG_LIMIT).transform((items) => uniqueTrimmed(items, ARTICLE_TAG_LIMIT));
const relatedProductSlugsSchema = z.array(z.string().trim().max(180)).max(ARTICLE_RELATED_PRODUCT_LIMIT)
  .transform((items) => uniqueTrimmed(items, ARTICLE_RELATED_PRODUCT_LIMIT));

const articleFieldsSchema = z.object({
  slug: slugSchema,
  title: z.string().trim().min(1).max(180),
  excerpt: z.string().trim().max(500),
  body: z.string().max(200000),
  tags: tagsSchema,
  heroImageSrc: z.string().trim().max(500),
  heroImageAssetId: z.string().trim().max(80).nullable(),
  relatedProductSlugs: relatedProductSlugsSchema,
  seoTitle: z.string().trim().max(180),
  seoDescription: z.string().trim().max(2000),
  socialTitle: z.string().trim().max(180),
  socialDescription: z.string().trim().max(2000),
  socialImage: z.string().trim().max(500),
  robotsIndex: z.boolean(),
});

export const insertArticleSchema = articleFieldsSchema.extend({
  excerpt: articleFieldsSchema.shape.excerpt.default(""),
  body: articleFieldsSchema.shape.body.default(""),
  tags: tagsSchema.default(emptyTags),
  heroImageSrc: articleFieldsSchema.shape.heroImageSrc.default(""),
  heroImageAssetId: articleFieldsSchema.shape.heroImageAssetId.default(null),
  relatedProductSlugs: relatedProductSlugsSchema.default(emptyRelated),
  seoTitle: articleFieldsSchema.shape.seoTitle.default(""),
  seoDescription: articleFieldsSchema.shape.seoDescription.default(""),
  socialTitle: articleFieldsSchema.shape.socialTitle.default(""),
  socialDescription: articleFieldsSchema.shape.socialDescription.default(""),
  socialImage: articleFieldsSchema.shape.socialImage.default(""),
  robotsIndex: articleFieldsSchema.shape.robotsIndex.default(true),
});
export const updateArticleSchema = articleFieldsSchema.partial();

export function withArticleSearchMetadata<T extends {
  seoTitle?: string;
  seoDescription?: string;
  socialTitle?: string;
  socialDescription?: string;
}>(data: T): T {
  return {
    ...data,
    ...(typeof data.seoTitle === "string" ? { seoTitle: forSearchMetadata(data.seoTitle) } : {}),
    ...(typeof data.seoDescription === "string" ? { seoDescription: forSearchMetadata(data.seoDescription) } : {}),
    ...(typeof data.socialTitle === "string" ? { socialTitle: forSearchMetadata(data.socialTitle) } : {}),
    ...(typeof data.socialDescription === "string" ? { socialDescription: forSearchMetadata(data.socialDescription) } : {}),
  };
}

export type InsertArticle = z.infer<typeof insertArticleSchema>;
export type UpdateArticle = z.infer<typeof updateArticleSchema>;
export type Article = typeof articlesTable.$inferSelect;
