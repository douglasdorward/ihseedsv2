import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export type MediaAssetStatus = "Pending" | "Ready" | "Failed";
export type MediaStorageKind = "managed" | "legacy" | "external";
export type MediaOwnerType = "product" | "category" | "static";
export type MediaUsageState = "Draft" | "Published";

export const mediaAssetsTable = pgTable("ih_media_assets", {
  id: text("id").primaryKey(),
  status: text("status").$type<MediaAssetStatus>().notNull().default("Pending"),
  originalFilename: text("original_filename").notNull(),
  contentType: text("content_type").$type<"image/jpeg" | "image/png" | "image/webp" | null>(),
  bytes: integer("bytes"),
  width: integer("width"),
  height: integer("height"),
  sha256: text("sha256"),
  defaultAlt: text("default_alt").notNull().default(""),
  defaultCaption: text("default_caption").notNull().default(""),
  failureReason: text("failure_reason"),
  storageKind: text("storage_kind").$type<MediaStorageKind>().notNull().default("managed"),
  objectPath: text("object_path"),
  stagingPath: text("staging_path"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const mediaReferencesTable = pgTable("ih_media_references", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  assetId: text("asset_id").notNull().references(() => mediaAssetsTable.id, { onDelete: "cascade" }),
  ownerType: text("owner_type").$type<MediaOwnerType>().notNull(),
  ownerId: text("owner_id").notNull(),
  ownerName: text("owner_name").notNull().default(""),
  field: text("field").notNull().default("details.photos"),
  role: text("role").notNull().default(""),
  usageState: text("usage_state").$type<MediaUsageState>().notNull(),
  editPath: text("edit_path"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type MediaAsset = typeof mediaAssetsTable.$inferSelect;
export type MediaReference = typeof mediaReferencesTable.$inferSelect;
