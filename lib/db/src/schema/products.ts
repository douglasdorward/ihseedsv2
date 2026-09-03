import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export type ProductDetails = {
  stockCode: string;
  guideSection: string;
  treatment: string;
  kind: "Mix" | "Variety";
  rate: string;
  rainfall: string;
  flowering: string;
  inoculant: string;
  soil: string[];
  tolerance: string[];
  summary: string;
  description: string;
  notes: string;
  components: { name: string; note: string }[];
  photos: { slot: string; file: string; rating: string; src: string }[];
};

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
  details: jsonb("details").$type<ProductDetails>().notNull().default({
    stockCode: "",
    guideSection: "",
    treatment: "",
    kind: "Mix",
    rate: "",
    rainfall: "",
    flowering: "",
    inoculant: "",
    soil: [],
    tolerance: [],
    summary: "",
    description: "",
    notes: "",
    components: [],
    photos: [],
  }),
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
  details: z.object({
    stockCode: z.string().max(40),
    guideSection: z.string().max(120),
    treatment: z.string().max(120),
    kind: z.enum(["Mix", "Variety"]),
    rate: z.string().max(80),
    rainfall: z.string().max(80),
    flowering: z.string().max(100),
    inoculant: z.string().max(80),
    soil: z.array(z.string().max(20)),
    tolerance: z.array(z.string().max(20)),
    summary: z.string().max(500),
    description: z.string().max(5000),
    notes: z.string().max(2000),
    components: z.array(z.object({ name: z.string().max(120), note: z.string().max(240) })),
    photos: z.array(z.object({ slot: z.string().max(40), file: z.string().max(240), rating: z.string().max(80), src: z.string().max(500) })),
  }).default({
    stockCode: "",
    guideSection: "",
    treatment: "",
    kind: "Mix",
    rate: "",
    rainfall: "",
    flowering: "",
    inoculant: "",
    soil: [],
    tolerance: [],
    summary: "",
    description: "",
    notes: "",
    components: [],
    photos: [],
  }),
});
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;