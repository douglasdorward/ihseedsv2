import { AnyPgColumn, boolean, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const catalogueCategoriesTable = pgTable("ih_catalogue_categories", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  parentId: integer("parent_id").references((): AnyPgColumn => catalogueCategoriesTable.id, { onDelete: "restrict" }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  groupLabel: text("group_label").notNull(),
  lead: text("lead").notNull().default(""),
  pageHeading: text("page_heading").notNull().default(""),
  seoTitle: text("seo_title").notNull().default(""),
  seoDescription: text("seo_description").notNull().default(""),
  rainfall: text("rainfall").notNull().default(""),
  image: text("image").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

const categoryFieldsSchema = z.object({
  parentId: z.number().int().positive().nullable(),
  slug: z.string().trim().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().trim().min(1).max(120),
  groupLabel: z.string().trim().min(1).max(80),
  lead: z.string().trim().max(1000),
  pageHeading: z.string().trim().max(180),
  seoTitle: z.string().trim().max(180),
  seoDescription: z.string().trim().max(2000),
  rainfall: z.string().trim().max(120),
  image: z.string().trim().max(500),
  sortOrder: z.number().int().min(0),
  active: z.boolean(),
});

export const insertCatalogueCategorySchema = categoryFieldsSchema.extend({
  pageHeading: categoryFieldsSchema.shape.pageHeading.default(""),
  seoTitle: categoryFieldsSchema.shape.seoTitle.default(""),
  seoDescription: categoryFieldsSchema.shape.seoDescription.default(""),
});
export const updateCatalogueCategorySchema = categoryFieldsSchema.partial();
export const reorderCatalogueCategoriesSchema = z.object({
  items: z.array(z.object({
    id: z.number().int().positive(),
    sortOrder: z.number().int().min(0),
  })).min(1),
});

export type InsertCatalogueCategory = z.infer<typeof insertCatalogueCategorySchema>;
export type UpdateCatalogueCategory = z.infer<typeof updateCatalogueCategorySchema>;
export type CatalogueCategory = typeof catalogueCategoriesTable.$inferSelect;