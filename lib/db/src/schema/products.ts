import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const productsTable = pgTable("ih_products", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull().unique(),
  price: text("price").notNull(),
  packSize: text("pack_size").notNull(),
  status: text("status").notNull(),
  note: text("note").notNull(),
  category: text("category").notNull().default("Other"),
  techSheet: text("tech_sheet").notNull().default(""),
  publishStatus: text("publish_status").notNull().default("Published"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertProductSchema = z.object({
  name: z.string().trim().min(1).max(160),
  price: z.string().trim().min(1).max(80),
  packSize: z.string().trim().min(1).max(80),
  status: z.enum(["in-stock", "low", "very-low", "unavailable"]),
  note: z.string().trim().max(500),
  category: z.string().trim().min(1).max(120),
  techSheet: z.string().trim().max(240),
  publishStatus: z.enum(["Published", "Draft"]),
});
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;