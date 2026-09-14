import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { productsTable } from "./products";

export type AiIngestStatus = "uploaded" | "extracting" | "ready" | "needs-match" | "failed";

export type AiSuggestion = {
  path: string;
  label: string;
  tab: number;
  current: unknown;
  proposed: unknown;
  confidence: number;
  quote?: string;
};

export type AiProposedPatch = {
  suggestions: AiSuggestion[];
  warnings: string[];
  scanned: boolean;
};

export const aiIngestItemsTable = pgTable("ih_ai_ingest_items", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  filename: text("filename").notNull(),
  storageKey: text("storage_key").notNull(),
  mimeType: text("mime_type").notNull().default("application/pdf"),
  status: text("status").$type<AiIngestStatus>().notNull().default("uploaded"),
  productId: integer("product_id").references(() => productsTable.id, { onDelete: "set null" }),
  extractedTextHash: text("extracted_text_hash").notNull().default(""),
  proposedPatch: jsonb("proposed_patch").$type<AiProposedPatch | null>(),
  warnings: jsonb("warnings").$type<string[]>().notNull().default([]),
  errorMessage: text("error_message").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AiIngestItem = typeof aiIngestItemsTable.$inferSelect;
