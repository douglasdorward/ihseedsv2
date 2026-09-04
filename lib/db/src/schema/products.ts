import { boolean, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { catalogueCategoriesTable } from "./categories";

export type ProductDetails = {
  stockCode: string;
  guideSection: string;
  recordType: "Mix" | "Variety" | "Commodity / generic";
  botanicalName: string;
  alsoKnownAs: string[];
  packSizes: { label: string; size: number | null; unit: string }[];
  treatment: string;
  persistencyType: "" | "Annual" | "Biennial" | "Perennial" | "Hybrid perennial" | "Short-term (1–2 years)";
  ploidy: "" | "Diploid" | "Tetraploid" | "Hexaploid" | "Mixed (blend)";
  flowerColour: "" | "Pink" | "Yellow" | "White" | "Crimson" | "Red" | "Purple";
  bredByOrigin: string;
  australianBred: boolean;
  distributedBy: string;
  sowingRates: { context: "" | "General" | "Monoculture" | "In a mix" | "Dryland" | "Irrigation" | "Pasture" | "Turf" | "Podded" | "De-hulled" | "Coated"; min: number | null; max: number | null; unit: string }[];
  rainfallMinMm: number | null;
  soilPhMin: number | null;
  soilPhScale: "CaCl₂" | "water";
  soilRangeLightest: "" | "LS" | "S" | "L" | "H";
  soilRangeHeaviest: "" | "LS" | "S" | "L" | "H";
  sowingDepthMinCm: number | null;
  sowingDepthMaxCm: number | null;
  tolerance: { name: "Low pH" | "Waterlogging" | "Salinity" | "Drought" | "Frost"; mild: boolean }[];
  maturityMeasure: "" | "Days to flowering (Perth)" | "Heading date" | "Time of flowering" | "Winter activity rating";
  maturityDays: number | null;
  headingDate: "" | "Very early" | "Early" | "Mid" | "Mid-late" | "Late";
  floweringWindow: string;
  winterActivity: number | null;
  inoculantGroup: "None" | "C" | "G/S" | "G" | "S" | "AL" | "AM" | "B" | "BS" | "E" | "F/E" | "I";
  seedTreatment: Array<"Bare / untreated" | "Gaucho" | "Thiram" | "Goldstrike" | "BioNPK Powder S" | "Lime coated">;
  ecocertApproved: boolean;
  endUse: Array<"Grazing" | "Hay" | "Silage" | "Cover crop" | "Green manure" | "Grain" | "Stockfeed" | "Permanent pasture" | "Erosion control / stabilisation" | "Break crop" | "Biofumigant" | "Turf">;
  livestock: Array<"Beef" | "Dairy" | "Sheep" | "Equine" | "Goat" | "Chicken" | "Alpaca" | "Weaners" | "Lamb finishing">;
  companionSpecies: string[];
  diseasePestResistance: string;
  /** @deprecated read-only compatibility alias for records written before v2. */
  persistenceLongevity?: string;
  standLifeNotes: string;
  grazingManagementNotes: string;
  pbrProtected: boolean;
  pbrDetails: string;
  licenceRestriction: string;
  certification: Array<"ASF Code of Practice" | "Certified Quality Assured Seed" | "Certified seed" | "Licensed production">;
  isThirdPartyProduct: boolean;
  supplierName: string;
  summary: string;
  description: string;
  notes: string;
  components: { productLink: string; speciesName: string; inclusionRate: number | null; unit: string; note: string }[];
  formulationYear: string;
  photos: { slot: string; file: string; rating: string; src: string }[];
  inCurrentPrintedGuide: boolean;
  seoTitle: string;
  seoDescription: string;
  sortOrder: number | null;
  featured: boolean;
  relatedProducts: string[];
  headingOffsetDays: number | null;
  argtResistant: boolean;
  endophyte: "" | "Nil" | "Low" | "MaxP" | "Standard";
  growthSeason: "" | "Summer-active" | "Winter-active / Mediterranean" | "Year-round" | "Warm-season";
  hardSeedLevel: "" | "Soft" | "Low" | "Moderate" | "High" | "Very high";
  oestrogenLevel: "" | "None" | "Trace" | "Low" | "High";
  bloatRisk: "" | "Low" | "Moderate" | "High";
  growingSeason: "" | "Summer" | "Winter" | "Either";
  weeksToFirstGrazing: string;
  prussicAcidRisk: "" | "None" | "Low" | "Standard – manage";
  regrowth: "" | "Single cut" | "Multi-cut / regrazes";
  productForm: string;
  applicationRate: string;
};
export type SaleLine = {
  stockCode: string; seedForm: "" | "Bare / de-hulled" | "Podded" | "Coated" | "Coated + Gaucho" | "BioNPK-S coated" | "Goldstrike coated" | "Scarified" | "Lime coated";
  seedGrade: "" | "Certified" | "Tested" | "Certified & Tested" | "VNS";
  packKg: number | null; packUnit: string; availability: "Good stock" | "Low stock" | "Very low" | "Unavailable" | null;
  priceDisplay: string; isDefault: boolean; sortOrder: number;
};

export type ProductLifecycleStatus = "Published" | "Draft" | "Archived";
export type ProductEditablePayload = {
  name: string;
  price: string;
  packSize: string;
  status: "in-stock" | "low" | "very-low" | "unavailable";
  note: string;
  category: string;
  subcategoryId: number | null;
  techSheet: string;
  guideYear: string;
  descriptionSource: string;
  websiteUrlLegacy: string;
  availabilityOverride: "Good stock" | "Low stock" | "Very low" | "Unavailable" | null;
  listingOverride: "Force active" | "Force legacy" | null;
  details: ProductDetails;
  saleLines: SaleLine[];
};

const emptyProductDetails: ProductDetails = {
  stockCode: "",
  guideSection: "",
  recordType: "Mix",
  botanicalName: "",
  alsoKnownAs: [],
  packSizes: [],
  treatment: "",
  persistencyType: "",
  ploidy: "",
  flowerColour: "",
  bredByOrigin: "",
  australianBred: false,
  distributedBy: "IH Seeds",
  sowingRates: [],
  rainfallMinMm: null,
  soilPhMin: null,
  soilPhScale: "CaCl₂",
  soilRangeLightest: "",
  soilRangeHeaviest: "",
  sowingDepthMinCm: null,
  sowingDepthMaxCm: null,
  tolerance: [],
  maturityMeasure: "",
  maturityDays: null,
  headingDate: "",
  floweringWindow: "",
  winterActivity: null,
  inoculantGroup: "None",
  seedTreatment: [],
  ecocertApproved: false,
  endUse: [],
  livestock: [],
  companionSpecies: [],
  diseasePestResistance: "",
  standLifeNotes: "",
  grazingManagementNotes: "",
  pbrProtected: false,
  pbrDetails: "",
  licenceRestriction: "",
  certification: [],
  isThirdPartyProduct: false,
  supplierName: "",
  summary: "",
  description: "",
  notes: "",
  components: [],
  formulationYear: "",
  photos: [],
  inCurrentPrintedGuide: false,
  seoTitle: "",
  seoDescription: "",
  sortOrder: null,
  featured: false,
  relatedProducts: [],
  headingOffsetDays: null, argtResistant: false, endophyte: "", growthSeason: "", hardSeedLevel: "",
  oestrogenLevel: "", bloatRisk: "", growingSeason: "", weeksToFirstGrazing: "", prussicAcidRisk: "",
  regrowth: "", productForm: "", applicationRate: "",
};

type LegacyProductDetails = Omit<Partial<ProductDetails>, "tolerance" | "components"> & {
  kind?: "Mix" | "Variety";
  rate?: string;
  rainfall?: string;
  flowering?: string;
  inoculant?: string;
  soil?: string[];
  tolerance?: Array<string | ProductDetails["tolerance"][number]>;
  components?: Array<ProductDetails["components"][number] | { name?: string; note?: string }>;
};

export function normalizeProductDetails(value: unknown, packSize = ""): ProductDetails {
  const raw = value && typeof value === "object" ? value as LegacyProductDetails : {};
  const {
    kind: legacyKind,
    rate: legacyRate,
    rainfall: legacyRainfallText,
    flowering: legacyFlowering,
    inoculant: legacyInoculant,
    soil: legacySoilValue,
    ...current
  } = raw;
  const legacyRateValues = (legacyRate ?? "").match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  const legacyRainfall = Number.parseFloat(legacyRainfallText ?? "");
  const legacySoil = Array.isArray(legacySoilValue) ? legacySoilValue : [];
  const toleranceNames: ProductDetails["tolerance"][number]["name"][] = ["Low pH", "Waterlogging", "Salinity", "Drought", "Frost"];
  const inoculantGroups: ProductDetails["inoculantGroup"][] = ["None", "C", "G/S", "G", "S", "AL", "AM", "B", "BS", "E", "F/E", "I"];
  const soilCodes: ProductDetails["soilRangeLightest"][] = ["", "LS", "S", "L", "H"];
  const isToleranceName = (name: string): name is ProductDetails["tolerance"][number]["name"] =>
    toleranceNames.includes(name as ProductDetails["tolerance"][number]["name"]);
  const normalizeSoil = (code: string | undefined): ProductDetails["soilRangeLightest"] =>
    soilCodes.includes(code as ProductDetails["soilRangeLightest"]) ? code as ProductDetails["soilRangeLightest"] : "";
  const tolerance = Array.isArray(raw.tolerance)
    ? raw.tolerance.flatMap((item) => typeof item === "string"
      ? isToleranceName(item) ? [{ name: item, mild: false }] : []
      : [item])
    : [];
  const components = Array.isArray(raw.components)
    ? raw.components.map((item) => "speciesName" in item ? item : {
      productLink: "",
      speciesName: item.name ?? "",
      inclusionRate: null,
      unit: "%",
      note: item.note ?? "",
    })
    : [];

  return {
    ...emptyProductDetails,
    ...current,
    standLifeNotes: current.standLifeNotes ?? current.persistenceLongevity ?? "",
    recordType: current.recordType ?? legacyKind ?? "Mix",
    alsoKnownAs: Array.isArray(current.alsoKnownAs) ? current.alsoKnownAs : [],
    packSizes: Array.isArray(current.packSizes) && current.packSizes.length
      ? current.packSizes
      : [{ label: "Standard", size: null, unit: packSize }],
    sowingRates: Array.isArray(current.sowingRates) && current.sowingRates.length
      ? current.sowingRates
      : [{ context: "Pasture", min: legacyRateValues[0] ?? null, max: legacyRateValues[1] ?? legacyRateValues[0] ?? null, unit: "kg/ha" }],
    rainfallMinMm: current.rainfallMinMm ?? (Number.isFinite(legacyRainfall) ? legacyRainfall : null),
    soilRangeLightest: normalizeSoil(current.soilRangeLightest ?? legacySoil[0]),
    soilRangeHeaviest: normalizeSoil(current.soilRangeHeaviest ?? legacySoil.at(-1)),
    tolerance,
    floweringWindow: current.floweringWindow ?? legacyFlowering ?? "",
    inoculantGroup: current.inoculantGroup ??
      (legacyInoculant && inoculantGroups.includes(legacyInoculant as ProductDetails["inoculantGroup"])
        ? legacyInoculant as ProductDetails["inoculantGroup"]
        : "None"),
    seedTreatment: Array.isArray(current.seedTreatment) ? current.seedTreatment : [],
    endUse: Array.isArray(current.endUse) ? current.endUse : [],
    livestock: Array.isArray(current.livestock) ? current.livestock : [],
    companionSpecies: Array.isArray(current.companionSpecies) ? current.companionSpecies : [],
    certification: Array.isArray(current.certification) ? current.certification : [],
    components,
    photos: Array.isArray(current.photos) ? current.photos : [],
    relatedProducts: Array.isArray(current.relatedProducts) ? current.relatedProducts : [],
  };
}

export const productsTable = pgTable("ih_products", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  price: text("price").notNull(),
  packSize: text("pack_size").notNull(),
  status: text("status").notNull(),
  note: text("note").notNull(),
  category: text("category").notNull().default("Other"),
  subcategoryId: integer("subcategory_id").references(() => catalogueCategoriesTable.id, { onDelete: "restrict" }),
  techSheet: text("tech_sheet").notNull().default(""),
  guideYear: text("guide_year").notNull().default(""),
  descriptionSource: text("description_source").notNull().default(""),
  websiteUrlLegacy: text("website_url_legacy").notNull().default(""),
  availabilityOverride: text("availability_override"),
  listingOverride: text("listing_override"),
  publishStatus: text("publish_status").notNull().default("Published"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  details: jsonb("details").$type<ProductDetails>().notNull().default(emptyProductDetails),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const saleLinesTable = pgTable("ih_sale_lines", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  productId: integer("product_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),
  stockCode: text("stock_code").notNull(),
  seedForm: text("seed_form").notNull().default(""),
  seedGrade: text("seed_grade").notNull().default(""),
  packKg: numeric("pack_kg", { precision: 8, scale: 2 }),
  packUnit: text("pack_unit").notNull().default("kg"),
  availability: text("availability").default("Unavailable"),
  priceDisplay: text("price_display").notNull().default("Contact for pricing"),
  isDefault: boolean("is_default").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("ih_sale_lines_stock_code_unique").on(table.stockCode)]);

export const redirectsTable = pgTable("ih_redirects", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  fromPath: text("from_path").notNull().unique(),
  toPath: text("to_path").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const productOptionsTable = pgTable("ih_product_options", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  listName: text("list_name").notNull(),
  value: text("value").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
}, (table) => [uniqueIndex("ih_product_options_list_value_unique").on(table.listName, table.value)]);

export const productDraftsTable = pgTable("ih_product_drafts", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  productId: integer("product_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }).unique(),
  snapshot: jsonb("snapshot").$type<ProductEditablePayload>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

const productDetailsObjectSchema = z.object({
  stockCode: z.string().max(40),
  guideSection: z.string().max(120),
  recordType: z.enum(["Mix", "Variety", "Commodity / generic"]),
  botanicalName: z.string().max(180),
  alsoKnownAs: z.array(z.string().max(120)),
  packSizes: z.array(z.object({ label: z.string().max(80), size: z.number().min(0).nullable(), unit: z.string().max(30) })),
  treatment: z.string().max(120),
  persistencyType: z.enum(["", "Annual", "Biennial", "Perennial", "Hybrid perennial", "Short-term (1–2 years)"]),
  ploidy: z.enum(["", "Diploid", "Tetraploid", "Hexaploid", "Mixed (blend)"]),
  flowerColour: z.enum(["", "Pink", "Yellow", "White", "Crimson", "Red", "Purple"]),
  bredByOrigin: z.string().max(2000),
  australianBred: z.boolean(),
  distributedBy: z.string().max(120),
  sowingRates: z.array(z.object({ context: z.enum(["", "General", "Monoculture", "In a mix", "Dryland", "Irrigation", "Pasture", "Turf", "Podded", "De-hulled", "Coated"]), min: z.number().min(0).nullable(), max: z.number().min(0).nullable(), unit: z.string().max(20) })),
  rainfallMinMm: z.number().int().min(0).nullable(),
  soilPhMin: z.number().min(0).max(14).nullable(),
  soilPhScale: z.enum(["CaCl₂", "water"]),
  soilRangeLightest: z.enum(["", "LS", "S", "L", "H"]),
  soilRangeHeaviest: z.enum(["", "LS", "S", "L", "H"]),
  sowingDepthMinCm: z.number().min(0).nullable(),
  sowingDepthMaxCm: z.number().min(0).nullable(),
  tolerance: z.array(z.object({ name: z.enum(["Low pH", "Waterlogging", "Salinity", "Drought", "Frost"]), mild: z.boolean() })),
  maturityMeasure: z.enum(["", "Days to flowering (Perth)", "Heading date", "Time of flowering", "Winter activity rating"]),
  maturityDays: z.number().int().min(0).nullable(),
  headingDate: z.enum(["", "Very early", "Early", "Mid", "Mid-late", "Late"]),
  floweringWindow: z.string().max(80),
  winterActivity: z.number().int().min(1).max(10).nullable(),
  inoculantGroup: z.enum(["None", "C", "G/S", "G", "S", "AL", "AM", "B", "BS", "E", "F/E", "I"]),
  seedTreatment: z.array(z.enum(["Bare / untreated", "Gaucho", "Thiram", "Goldstrike", "BioNPK Powder S", "Lime coated"])),
  ecocertApproved: z.boolean(),
  endUse: z.array(z.enum(["Grazing", "Hay", "Silage", "Cover crop", "Green manure", "Grain", "Stockfeed", "Permanent pasture", "Erosion control / stabilisation", "Break crop", "Biofumigant", "Turf"])),
  livestock: z.array(z.enum(["Beef", "Dairy", "Sheep", "Equine", "Goat", "Chicken", "Alpaca", "Weaners", "Lamb finishing"])),
  companionSpecies: z.array(z.string().max(120)),
  diseasePestResistance: z.string().max(3000),
  standLifeNotes: z.string().max(3000),
  grazingManagementNotes: z.string().max(3000),
  pbrProtected: z.boolean(),
  pbrDetails: z.string().max(300),
  licenceRestriction: z.string().max(1000),
  certification: z.array(z.enum(["ASF Code of Practice", "Certified Quality Assured Seed", "Certified seed", "Licensed production"])),
  isThirdPartyProduct: z.boolean(),
  supplierName: z.string().max(180),
  summary: z.string().max(500),
  description: z.string().max(200000),
  notes: z.string().max(2000),
  components: z.array(z.object({ productLink: z.string().max(180), speciesName: z.string().max(120), inclusionRate: z.number().nullable(), unit: z.string().max(20), note: z.string().max(4000) })),
  formulationYear: z.string().max(20),
  photos: z.array(z.object({ slot: z.string().max(40), file: z.string().max(240), rating: z.string().max(80), src: z.string().max(500) })),
  inCurrentPrintedGuide: z.boolean(),
  seoTitle: z.string().max(180),
  seoDescription: z.string().max(2000),
  sortOrder: z.number().int().min(0).nullable(),
  featured: z.boolean(),
  relatedProducts: z.array(z.string().max(180)),
  headingOffsetDays: z.number().int().min(-365).max(365).nullable(),
  argtResistant: z.boolean(),
  endophyte: z.enum(["", "Nil", "Low", "MaxP", "Standard"]),
  growthSeason: z.enum(["", "Summer-active", "Winter-active / Mediterranean", "Year-round", "Warm-season"]),
  hardSeedLevel: z.enum(["", "Soft", "Low", "Moderate", "High", "Very high"]),
  oestrogenLevel: z.enum(["", "None", "Trace", "Low", "High"]),
  bloatRisk: z.enum(["", "Low", "Moderate", "High"]),
  growingSeason: z.enum(["", "Summer", "Winter", "Either"]),
  weeksToFirstGrazing: z.string().max(80),
  prussicAcidRisk: z.enum(["", "None", "Low", "Standard – manage"]),
  regrowth: z.enum(["", "Single cut", "Multi-cut / regrazes"]),
  productForm: z.string().max(120),
  applicationRate: z.string().max(240),
});
const productDetailsSchema = productDetailsObjectSchema.default(emptyProductDetails);

export const insertProductSchema = z.object({
  name: z.string().trim().min(1).max(160),
  slug: z.string().trim().min(1).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  price: z.string().trim().max(80),
  packSize: z.string().trim().max(80),
  status: z.enum(["in-stock", "low", "very-low", "unavailable"]),
  note: z.string().trim().max(500),
  category: z.string().trim().max(120),
  subcategoryId: z.number().int().positive().nullable().default(null),
  techSheet: z.string().trim().max(240),
  guideYear: z.string().trim().max(12).default(""),
  descriptionSource: z.string().trim().max(240).default(""),
  websiteUrlLegacy: z.string().trim().max(500).default(""),
  availabilityOverride: z.enum(["Good stock", "Low stock", "Very low", "Unavailable"]).nullable().default(null),
  listingOverride: z.enum(["Force active", "Force legacy"]).nullable().default(null),
  publishStatus: z.enum(["Published", "Draft", "Archived"]),
  details: productDetailsSchema,
});
export const updateProductSchema = insertProductSchema
  .omit({ slug: true, details: true })
  .partial()
  .extend({
    subcategoryId: z.number().int().positive().nullable().optional(),
    details: productDetailsObjectSchema.optional(),
  });
export const saleLineSchema = z.object({
  stockCode: z.string().trim().min(1).max(80),
  seedForm: z.enum(["", "Bare / de-hulled", "Podded", "Coated", "Coated + Gaucho", "BioNPK-S coated", "Goldstrike coated", "Scarified", "Lime coated"]),
  seedGrade: z.enum(["", "Certified", "Tested", "Certified & Tested", "VNS"]),
  packKg: z.number().min(0).nullable(),
  packUnit: z.string().trim().min(1).max(20).default("kg"),
  availability: z.enum(["Good stock", "Low stock", "Very low", "Unavailable"]).nullable(),
  priceDisplay: z.string().trim().max(120).default("Contact for pricing"),
  isDefault: z.boolean(),
  sortOrder: z.number().int().min(0),
});
export const productDraftSchema = insertProductSchema.omit({ slug: true, publishStatus: true })
  .extend({ saleLines: z.array(saleLineSchema).default([]) });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type UpdateProduct = z.infer<typeof updateProductSchema>;
export type Product = typeof productsTable.$inferSelect;
export type ProductDraftInput = z.infer<typeof productDraftSchema>;