import { sql } from "drizzle-orm";
import { boolean, integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const RESELLER_KINDS = ["elders", "nutrien", "independent"] as const;
export type ResellerKind = (typeof RESELLER_KINDS)[number];

export const RESELLER_REGION_PRESETS = [
  "Great Southern",
  "Esperance",
  "Wheatbelt",
  "South West",
  "Midwest",
  "Kimberley",
] as const;

export const resellerBrandsTable = pgTable("ih_reseller_brands", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  kind: text("kind").$type<ResellerKind>().notNull(),
  website: text("website").notNull().default(""),
  logoSrc: text("logo_src").notNull().default(""),
  logoAssetId: text("logo_asset_id"),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("ih_reseller_brands_name_unique").on(sql`lower(${table.name})`),
]);

export const resellerOutletsTable = pgTable("ih_reseller_outlets", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  brandId: integer("brand_id").notNull().references(() => resellerBrandsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  address: text("address").notNull().default(""),
  suburb: text("suburb").notNull().default(""),
  postcode: text("postcode").notNull().default(""),
  region: text("region").notNull().default(""),
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""),
  mapsUrl: text("maps_url").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("ih_reseller_outlets_brand_name_unique").on(table.brandId, sql`lower(${table.name})`),
]);

function optionalHttpUrl(max: number) {
  return z.string().trim().max(max).refine((value) => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }, "Enter a valid http(s) URL.");
}

const optionalEmail = z.string().trim().max(180).refine(
  (value) => value === "" || z.string().email().safeParse(value).success,
  "Enter a valid email address.",
);

const resellerKindSchema = z.enum(RESELLER_KINDS);

const brandFieldsSchema = z.object({
  name: z.string().trim().min(1).max(120),
  kind: resellerKindSchema,
  website: optionalHttpUrl(500),
  logoSrc: z.string().trim().max(500),
  logoAssetId: z.string().trim().max(80).nullable(),
  sortOrder: z.number().int().min(0),
  active: z.boolean(),
});

const outletFieldsSchema = z.object({
  name: z.string().trim().min(1).max(120),
  address: z.string().trim().max(300),
  suburb: z.string().trim().max(120),
  postcode: z.string().trim().max(12),
  region: z.string().trim().max(80),
  phone: z.string().trim().max(80),
  email: optionalEmail,
  mapsUrl: optionalHttpUrl(1000),
  sortOrder: z.number().int().min(0),
  active: z.boolean(),
});

export const insertResellerBrandSchema = brandFieldsSchema.extend({
  website: brandFieldsSchema.shape.website.default(""),
  logoSrc: brandFieldsSchema.shape.logoSrc.default(""),
  logoAssetId: brandFieldsSchema.shape.logoAssetId.default(null),
  sortOrder: brandFieldsSchema.shape.sortOrder.default(0),
  active: brandFieldsSchema.shape.active.default(true),
});
export const updateResellerBrandSchema = brandFieldsSchema.partial();

export const insertResellerOutletSchema = outletFieldsSchema.extend({
  address: outletFieldsSchema.shape.address.default(""),
  suburb: outletFieldsSchema.shape.suburb.default(""),
  postcode: outletFieldsSchema.shape.postcode.default(""),
  region: outletFieldsSchema.shape.region.default(""),
  phone: outletFieldsSchema.shape.phone.default(""),
  email: outletFieldsSchema.shape.email.default(""),
  mapsUrl: outletFieldsSchema.shape.mapsUrl.default(""),
  sortOrder: outletFieldsSchema.shape.sortOrder.default(0),
  active: outletFieldsSchema.shape.active.default(true),
});
export const updateResellerOutletSchema = outletFieldsSchema.partial();

export const reorderResellerItemsSchema = z.object({
  items: z.array(z.object({
    id: z.number().int().positive(),
    sortOrder: z.number().int().min(0),
  })).min(1),
});

export type InsertResellerBrand = z.infer<typeof insertResellerBrandSchema>;
export type UpdateResellerBrand = z.infer<typeof updateResellerBrandSchema>;
export type InsertResellerOutlet = z.infer<typeof insertResellerOutletSchema>;
export type UpdateResellerOutlet = z.infer<typeof updateResellerOutletSchema>;
export type ResellerBrand = typeof resellerBrandsTable.$inferSelect;
export type ResellerOutlet = typeof resellerOutletsTable.$inferSelect;
