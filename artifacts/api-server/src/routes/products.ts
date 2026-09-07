import { Router, type IRouter } from "express";
import { desc, eq, inArray } from "drizzle-orm";
import {
  db,
  catalogueCategoriesTable,
  normalizeProductDetails,
  productDraftSchema,
  productDraftsTable,
  productsTable,
  saleLinesTable,
  redirectsTable,
  type SaleLine,
  updateProductSchema,
  type InsertProduct,
  type Product,
  type ProductEditablePayload,
} from "@workspace/db";
import { insertProductSchema } from "@workspace/db";

const router: IRouter = Router();
const publicSiteBaseUrl = (process.env.PUBLIC_SITE_URL ?? "").trim().replace(/\/+$/, "");

function escapeXml(value: string) {
  return value.replace(/[<>&'"]/g, (character) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", "\"": "&quot;" })[character]!);
}

function canonicalProductUrl(slug: string) {
  return `${publicSiteBaseUrl}/product/${encodeURIComponent(slug)}`;
}

type PublicProduct = {
  id: number; name: string; slug: string; price: string; packSize: string; status: string;
  note: string; category: string; subcategoryId: number | null; techSheet: string; guideYear: string;
  listingState: "Active"; saleLines: SaleLine[]; details: ReturnType<typeof toPublicDetails>;
};

function toPublicDetails(value: unknown, packSize: string) {
  const d = normalizeProductDetails(value, packSize);
  return {
    recordType: d.recordType, botanicalName: d.botanicalName, distributedBy: d.distributedBy,
    tagline: d.tagline, blurb: d.blurb, keyAttributes: d.keyAttributes, distributionNote: d.distributionNote,
    persistencyType: d.persistencyType, ploidy: d.ploidy,
    flowerColour: d.flowerColour, sowingRates: d.sowingRates, rainfallMinMm: d.rainfallMinMm,
    soilPhMin: d.soilPhMin, soilPhScale: d.soilPhScale, soilRangeLightest: d.soilRangeLightest,
    soilRangeHeaviest: d.soilRangeHeaviest, tolerance: d.tolerance, endUse: d.endUse,
    livestock: d.livestock, maturityMeasure: d.maturityMeasure, maturityDays: d.maturityDays,
    headingDate: d.headingDate, headingOffsetDays: d.headingOffsetDays, winterActivity: d.winterActivity,
    argtResistant: d.argtResistant, endophyte: d.endophyte, growthSeason: d.growthSeason,
    hardSeedLevel: d.hardSeedLevel, oestrogenLevel: d.oestrogenLevel, bloatRisk: d.bloatRisk,
    growingSeason: d.growingSeason, weeksToFirstGrazing: d.weeksToFirstGrazing,
    prussicAcidRisk: d.prussicAcidRisk, regrowth: d.regrowth, productForm: d.productForm,
    applicationRate: d.applicationRate, diseasePestResistance: d.diseasePestResistance,
    standLifeNotes: d.standLifeNotes, grazingManagementNotes: d.grazingManagementNotes,
    pbrProtected: d.pbrProtected, pbrDetails: d.pbrDetails, certification: d.certification,
    description: d.description, components: d.components,
    relatedProducts: d.relatedProducts, formulationYear: d.formulationYear, photos: d.photos,
    featured: d.featured, seoTitle: d.seoTitle, seoDescription: d.seoDescription || d.blurb,
  };
}

const seedProducts = [
  ["SouWest™ Pasture Mix", "$25.00 per kg", "25 kg bag", "in-stock", "Blended to order, 500 mm+ zones", "Specialty Mixes"],
  ["Maximix", "$25.00 per kg", "25 kg bag", "in-stock", "Versatile pasture mix for broad-acre sowing", "Specialty Mixes"],
  ["Silahay™ Mix", "$25.00 per kg", "25 kg bag", "low", "Hay and silage, mid rainfall", "Specialty Mixes"],
  ["Self Regeneration Pasture Mix", "$25.00 per kg", "25 kg bag", "in-stock", "Built for persistence and recovery", "Specialty Mixes"],
  ["Ceres PG One50 Ryegrass", "$14.50 per kg", "25 kg bag", "in-stock", "Perennial, 600 mm+ zones", "Ryegrasses"],
  ["Margurita French Serradella", "$9.80 per kg", "25 kg bag", "low", "Reliable early-season legume", "Serradellas & Medics"],
  ["SARDI Seven Lucerne", "$18.00 per kg", "25 kg bag", "in-stock", "High quality feed for rotational systems", "Lucerne"],
  ["Dalkeith Subterranean Clover", "$11.20 per kg", "25 kg bag", "very-low", "Early season, 325–450 mm", "Clovers"],
] as const;

const createSlug = (name: string) =>
  name.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

function toSaleLine(line: typeof saleLinesTable.$inferSelect): SaleLine {
  return {
    stockCode: line.stockCode,
    seedForm: line.seedForm as SaleLine["seedForm"],
    seedGrade: line.seedGrade as SaleLine["seedGrade"],
    packKg: line.packKg === null ? null : Number(line.packKg),
    packUnit: line.packUnit,
    availability: line.availability as SaleLine["availability"],
    priceDisplay: line.priceDisplay, isDefault: line.isDefault, sortOrder: line.sortOrder,
  };
}

async function liveSaleLines(productId: number): Promise<SaleLine[]> {
  return (await db.select().from(saleLinesTable).where(eq(saleLinesTable.productId, productId)))
    .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.sortOrder - b.sortOrder || a.id - b.id).map(toSaleLine);
}

function isActiveListing(product: Product, productLines: SaleLine[]) {
  if (product.listingOverride === "Force active") return true;
  if (product.listingOverride === "Force legacy") return false;
  return productLines.length === 0 || productLines.some((line) => line.availability !== "Unavailable");
}

function editableFromProduct(product: Product, saleLines: SaleLine[] = []): ProductEditablePayload {
  return {
    name: product.name,
    price: product.price,
    packSize: product.packSize,
    status: product.status as ProductEditablePayload["status"],
    note: product.note,
    category: product.category,
    subcategoryId: product.subcategoryId,
    techSheet: product.techSheet,
    guideYear: product.guideYear,
    descriptionSource: product.descriptionSource,
    websiteUrlLegacy: product.websiteUrlLegacy,
    availabilityOverride: product.availabilityOverride as ProductEditablePayload["availabilityOverride"],
    listingOverride: product.listingOverride as ProductEditablePayload["listingOverride"],
    details: normalizeProductDetails(product.details, product.packSize),
    saleLines,
  };
}

function normalizeEditable(payload: ProductEditablePayload): ProductEditablePayload {
  return { ...payload, subcategoryId: payload.subcategoryId ?? null, saleLines: payload.saleLines ?? [],
    details: normalizeProductDetails(payload.details, payload.packSize) };
}

async function resolveTaxonomyCategory(subcategoryId: number | null): Promise<{ category: string; active: boolean } | null> {
  if (subcategoryId === null) return null;
  const [selected] = await db.select().from(catalogueCategoriesTable)
    .where(eq(catalogueCategoriesTable.id, subcategoryId));
  if (!selected) return null;
  if (selected.parentId === null) return { category: selected.name, active: selected.active };
  const [parent] = await db.select().from(catalogueCategoriesTable)
    .where(eq(catalogueCategoriesTable.id, selected.parentId));
  return parent?.parentId === null
    ? { category: parent.name, active: selected.active && parent.active }
    : null;
}

async function applyTaxonomyCategory<T extends { category: string; subcategoryId: number | null }>(
  payload: T,
  allowedInactiveIds = new Set<number>(),
): Promise<T | null> {
  const taxonomy = await resolveTaxonomyCategory(payload.subcategoryId);
  if (payload.subcategoryId === null) return payload;
  if (taxonomy === null || (!taxonomy.active && !allowedInactiveIds.has(payload.subcategoryId))) return null;
  return { ...payload, category: taxonomy.category };
}

function getPublishValidationErrors(product: Product, payload: ProductEditablePayload) {
  return [
    !payload.name.trim() && "Product name",
    !product.slug.trim() && "Slug",
    !payload.category.trim() && "Category",
    !payload.details.recordType && "Record type",
    !payload.details.tagline.trim() && "Tagline",
    !payload.details.blurb.trim() && "Blurb",
    !payload.details.keyAttributes.some((attribute) => attribute.trim()) && "Key attributes",
    !payload.details.description.trim() && "Product description",
    payload.saleLines.length > 0 && payload.saleLines.filter((line) => line.isDefault).length !== 1 && "Exactly one default sale line",
    new Set(payload.saleLines.map((line) => line.stockCode)).size !== payload.saleLines.length && "Unique sale line stock codes",
  ].filter(Boolean) as string[];
}

function getDraftValidationErrors(payload: {
  name?: unknown;
  slug?: unknown;
  category?: unknown;
  details?: { recordType?: unknown };
}) {
  return [
    (typeof payload.name !== "string" || !payload.name.trim()) && "Product name",
    (typeof payload.slug !== "string" || !payload.slug.trim()) && "Slug",
    (typeof payload.category !== "string" || !payload.category.trim()) && "Category",
    !payload.details?.recordType && "Record type",
  ].filter(Boolean) as string[];
}

async function ensureProducts() {
  const existing = await db.select().from(productsTable)
    .orderBy(desc(productsTable.updatedAt), desc(productsTable.id));
  if (existing.length > 0) {
    return existing;
  }
  await db.insert(productsTable).values(seedProducts.map(([name, price, packSize, status, note, category]) => ({
    name,
    slug: createSlug(name),
    price,
    packSize,
    status,
    note,
    category,
    techSheet: "",
    publishStatus: "Published",
    publishedAt: new Date(),
  }))).onConflictDoNothing({ target: productsTable.name });
  return db.select().from(productsTable)
    .orderBy(desc(productsTable.updatedAt), desc(productsTable.id));
}

async function findMissingProductReferences(details: InsertProduct["details"]) {
  const references = [...new Set([
    ...details.components.map((component) => component.productLink),
    ...details.companionSpecies,
    ...details.relatedProducts,
  ].filter(Boolean))];
  if (references.length === 0) return [];
  const existing = await db.select({ slug: productsTable.slug }).from(productsTable)
    .where(inArray(productsTable.slug, references));
  const known = new Set(existing.map((product) => product.slug));
  return references.filter((slug) => !known.has(slug));
}

async function getAdminProduct(product: Product) {
  const [draft] = await db.select().from(productDraftsTable)
    .where(eq(productDraftsTable.productId, product.id));
  const lines = await liveSaleLines(product.id);
  return {
    ...product,
    details: normalizeProductDetails(product.details, product.packSize),
    lifecycleStatus: product.publishStatus,
    hasDraft: Boolean(draft),
    draftSavedAt: draft?.updatedAt ?? null,
    publishedAt: product.publishedAt,
    saleLines: lines,
    draft: draft ? { ...normalizeEditable(draft.snapshot), savedAt: draft.updatedAt } : null,
  };
}

async function findProduct(id: number) {
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, id));
  return product;
}

function validId(rawId: string) {
  const id = Number(rawId);
  return Number.isInteger(id) && id > 0 ? id : null;
}

router.get("/products", async (req, res): Promise<void> => {
  const products = await ensureProducts();
  res.set("Cache-Control", "no-store");
  const lines = await db.select().from(saleLinesTable);
  const linesByProduct = new Map<number, SaleLine[]>();
  for (const line of lines) linesByProduct.set(line.productId, [...(linesByProduct.get(line.productId) ?? []), toSaleLine(line)]);
  res.json(products.filter((product) => {
    if (product.publishStatus !== "Published") return false;
    return isActiveListing(product, linesByProduct.get(product.id) ?? []);
  }).map((product): PublicProduct => {
    const productLines = linesByProduct.get(product.id) ?? [];
    const availability = product.availabilityOverride ?? productLines.find((line) => line.isDefault)?.availability
      ?? productLines.find((line) => line.availability !== "Unavailable")?.availability ?? "Unavailable";
    return {
      id: product.id, name: product.name, slug: product.slug, price: product.price, packSize: product.packSize,
      status: ({ "Good stock": "in-stock", "Low stock": "low", "Very low": "very-low", Unavailable: "unavailable" } as const)[availability] ?? "unavailable",
      note: product.note, category: product.category, subcategoryId: product.subcategoryId, techSheet: product.techSheet,
      guideYear: product.guideYear, listingState: "Active", saleLines: productLines,
      details: toPublicDetails(product.details, product.packSize),
    };
  }));
});

// Deliberately name-only: category pages can expose catalogue history without
// accidentally making Legacy product detail data public.
router.get("/products/category/:category/legacy", async (req, res): Promise<void> => {
  const category = decodeURIComponent(String(req.params.category));
  const products = await db.select().from(productsTable)
    .where(eq(productsTable.category, category));
  const lines = await db.select().from(saleLinesTable);
  const byProduct = new Map<number, SaleLine[]>();
  for (const line of lines) byProduct.set(line.productId, [...(byProduct.get(line.productId) ?? []), toSaleLine(line)]);
  res.json(products.filter((product) => product.publishStatus === "Published" &&
    (product.listingOverride === "Force legacy" ||
      (product.listingOverride !== "Force active" && (() => { const productLines = byProduct.get(product.id) ?? []; return productLines.length > 0 && !productLines.some((line) => line.availability !== "Unavailable"); })())))
    .map((product) => ({ name: product.name })));
});

router.get("/redirects/lookup", async (req, res): Promise<void> => {
  const fromPath = typeof req.query.fromPath === "string" ? req.query.fromPath : "";
  if (!fromPath.startsWith("/") || fromPath.length > 500) {
    res.status(400).json({ error: "A valid absolute fromPath is required." });
    return;
  }
  const [redirect] = await db.select().from(redirectsTable).where(eq(redirectsTable.fromPath, fromPath));
  if (!redirect) {
    res.status(404).json({ error: "Redirect not found." });
    return;
  }
  res.json({ toPath: redirect.toPath });
});

router.get("/sitemap-products", async (_req, res): Promise<void> => {
  const products = await db.select().from(productsTable).where(eq(productsTable.publishStatus, "Published"));
  const lines = await db.select().from(saleLinesTable);
  const linesByProduct = new Map<number, SaleLine[]>();
  for (const line of lines) linesByProduct.set(line.productId, [...(linesByProduct.get(line.productId) ?? []), toSaleLine(line)]);
  res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${
    products.filter((product) => isActiveListing(product, linesByProduct.get(product.id) ?? []))
      .map((product) => `<url><loc>${escapeXml(canonicalProductUrl(product.slug))}</loc></url>`).join("")
  }</urlset>`);
});

router.post("/products", async (req, res): Promise<void> => {
  const missingDraftFields = getDraftValidationErrors(req.body);
  if (missingDraftFields.length > 0) {
    res.status(400).json({ error: `Complete these fields before saving a draft: ${missingDraftFields.join(", ")}.` });
    return;
  }
  const parsed = insertProductSchema.safeParse({
    ...req.body,
    publishStatus: "Draft",
    details: normalizeProductDetails(req.body.details, String(req.body.packSize ?? "")),
  });
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.flatten() }, "Invalid product create request");
    res.status(400).json({ error: "Please complete all required product fields." });
    return;
  }
  const taxonomyPayload = await applyTaxonomyCategory(parsed.data);
  if (!taxonomyPayload) {
    res.status(400).json({ error: "Selected category does not exist or has an invalid parent." });
    return;
  }
  const missingReferences = await findMissingProductReferences(taxonomyPayload.details);
  if (missingReferences.length > 0) {
    res.status(400).json({ error: `Unknown linked product: ${missingReferences.join(", ")}.` });
    return;
  }
  try {
    const [product] = await db.insert(productsTable).values({
      ...taxonomyPayload,
      publishStatus: "Draft",
      publishedAt: null,
    }).returning();
    req.log.info({ productId: product.id }, "Draft product created");
    res.status(201).json(product);
  } catch (error) {
    if (error instanceof Error && error.message.includes("duplicate key")) {
      res.status(409).json({ error: "A product with that name already exists." });
      return;
    }
    throw error;
  }
});

router.get("/admin/products", async (_req, res): Promise<void> => {
  const products = await ensureProducts();
  res.set("Cache-Control", "no-store");
  res.json(await Promise.all(products.map(getAdminProduct)));
});

router.get("/admin/products/:id", async (req, res): Promise<void> => {
  const id = validId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid product id." });
    return;
  }
  const product = await findProduct(id);
  if (!product) {
    res.status(404).json({ error: "Product not found." });
    return;
  }
  res.json(await getAdminProduct(product));
});

router.post("/admin/products/:id/draft", async (req, res): Promise<void> => {
  const id = validId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid product id." });
    return;
  }
  const product = await findProduct(id);
  if (!product) {
    res.status(404).json({ error: "Product not found." });
    return;
  }
  if (product.publishStatus === "Archived") {
    res.status(409).json({ error: "Archived products must be restored to Draft before editing." });
    return;
  }
  const missingDraftFields = getDraftValidationErrors({ ...req.body, slug: product.slug });
  if (missingDraftFields.length > 0) {
    res.status(400).json({ error: `Complete these fields before saving a draft: ${missingDraftFields.join(", ")}.` });
    return;
  }
  const parsed = productDraftSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Please complete all required product fields." });
    return;
  }
  const [existingDraft] = await db.select().from(productDraftsTable)
    .where(eq(productDraftsTable.productId, id));
  const allowedInactiveIds = new Set([product.subcategoryId, existingDraft?.snapshot.subcategoryId]
    .filter((categoryId): categoryId is number => categoryId !== null && categoryId !== undefined));
  const taxonomyPayload = await applyTaxonomyCategory(parsed.data, allowedInactiveIds);
  if (!taxonomyPayload) {
    res.status(400).json({ error: "Selected category does not exist or has an invalid parent." });
    return;
  }
  const missingReferences = await findMissingProductReferences(taxonomyPayload.details);
  if (missingReferences.length > 0) {
    res.status(400).json({ error: `Unknown linked product: ${missingReferences.join(", ")}.` });
    return;
  }
  const snapshot = normalizeEditable(taxonomyPayload);
  try {
    const updated = await db.transaction(async (tx) => {
      const [lockedProduct] = await tx.select().from(productsTable)
        .where(eq(productsTable.id, id)).for("update");
      if (!lockedProduct) throw new Error("PRODUCT_NOT_FOUND");
      if (lockedProduct.publishStatus === "Archived") throw new Error("PRODUCT_ARCHIVED");
      if (lockedProduct.publishStatus === "Published") {
        const [existingDraft] = await tx.select().from(productDraftsTable)
          .where(eq(productDraftsTable.productId, id));
        if (existingDraft) {
          await tx.update(productDraftsTable)
            .set({ snapshot, updatedAt: new Date() })
            .where(eq(productDraftsTable.id, existingDraft.id));
        } else {
          await tx.insert(productDraftsTable).values({ productId: id, snapshot });
        }
        return lockedProduct;
      } else {
        const [draftProduct] = await tx.update(productsTable)
          .set({ ...snapshot, publishStatus: "Draft", updatedAt: new Date() })
          .where(eq(productsTable.id, id)).returning();
        return draftProduct;
      }
    });
    res.json(await getAdminProduct(updated));
  } catch (error) {
    if (error instanceof Error && error.message === "PRODUCT_NOT_FOUND") {
      res.status(404).json({ error: "Product not found." });
      return;
    }
    if (error instanceof Error && error.message === "PRODUCT_ARCHIVED") {
      res.status(409).json({ error: "Archived products must be restored to Draft before editing." });
      return;
    }
    if (error instanceof Error && error.message.includes("duplicate key")) {
      res.status(409).json({ error: "A product with that name already exists." });
      return;
    }
    throw error;
  }
});

router.post("/admin/products/:id/publish", async (req, res): Promise<void> => {
  const id = validId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid product id." });
    return;
  }
  const product = await findProduct(id);
  if (!product) {
    res.status(404).json({ error: "Product not found." });
    return;
  }
  if (product.publishStatus === "Archived") {
    res.status(409).json({ error: "Restore this product to Draft before publishing it." });
    return;
  }
  try {
    const updated = await db.transaction(async (tx) => {
      const [lockedProduct] = await tx.select().from(productsTable)
        .where(eq(productsTable.id, id)).for("update");
      if (!lockedProduct) throw new Error("PRODUCT_NOT_FOUND");
      if (lockedProduct.publishStatus === "Archived") throw new Error("PRODUCT_ARCHIVED");
      const [draft] = await tx.select().from(productDraftsTable)
        .where(eq(productDraftsTable.productId, id));
       const payload = draft?.snapshot ?? editableFromProduct(lockedProduct, await liveSaleLines(lockedProduct.id));
      const resolvedPayload = await applyTaxonomyCategory(
        normalizeEditable(payload),
        lockedProduct.subcategoryId === null ? new Set() : new Set([lockedProduct.subcategoryId]),
      );
      if (!resolvedPayload) throw new Error("INVALID_CATEGORY");
      const normalizedPayload = resolvedPayload;
      const missingFields = getPublishValidationErrors(lockedProduct, normalizedPayload);
      if (missingFields.length > 0) throw new Error(`PUBLISH_VALIDATION:${missingFields.join(", ")}`);
      const [published] = await tx.update(productsTable).set({
        ...normalizedPayload,
        publishStatus: "Published",
        publishedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(productsTable.id, id)).returning();
       // Sale lines are deliberately snapshot-only until this transaction.
       await tx.delete(saleLinesTable).where(eq(saleLinesTable.productId, id));
       if (normalizedPayload.saleLines.length) {
         await tx.insert(saleLinesTable).values(normalizedPayload.saleLines.map((line) => ({
           productId: id, stockCode: line.stockCode, seedForm: line.seedForm, seedGrade: line.seedGrade,
           packKg: line.packKg === null ? null : String(line.packKg), packUnit: line.packUnit,
           availability: line.availability, priceDisplay: line.priceDisplay, isDefault: line.isDefault, sortOrder: line.sortOrder,
         })));
       }
      if (draft) await tx.delete(productDraftsTable).where(eq(productDraftsTable.id, draft.id));
      return published;
    });
    res.json(await getAdminProduct(updated));
  } catch (error) {
    if (error instanceof Error && error.message === "PRODUCT_NOT_FOUND") {
      res.status(404).json({ error: "Product not found." });
      return;
    }
    if (error instanceof Error && error.message === "PRODUCT_ARCHIVED") {
      res.status(409).json({ error: "Restore this product to Draft before publishing it." });
      return;
    }
    if (error instanceof Error && error.message === "INVALID_CATEGORY") {
      res.status(400).json({ error: "Selected category does not exist or has an invalid parent." });
      return;
    }
    if (error instanceof Error && error.message.startsWith("PUBLISH_VALIDATION:")) {
      res.status(400).json({ error: `Complete these fields before publishing: ${error.message.slice("PUBLISH_VALIDATION:".length)}.` });
      return;
    }
    if (error instanceof Error && error.message.includes("duplicate key")) {
      res.status(409).json({ error: "A product with that name already exists." });
      return;
    }
    throw error;
  }
});

router.post("/admin/products/:id/archive", async (req, res): Promise<void> => {
  const id = validId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid product id." });
    return;
  }
  const product = await findProduct(id);
  if (!product) {
    res.status(404).json({ error: "Product not found." });
    return;
  }
  if (product.publishStatus === "Archived") {
    res.status(409).json({ error: "Product is already archived." });
    return;
  }
  const archiveResult = await db.transaction(async (tx) => {
    const [lockedProduct] = await tx.select().from(productsTable)
      .where(eq(productsTable.id, id)).for("update");
    if (!lockedProduct) return { kind: "not-found" as const };
    if (lockedProduct.publishStatus === "Archived") return { kind: "already-archived" as const };
    const [archived] = await tx.update(productsTable)
      .set({ publishStatus: "Archived", updatedAt: new Date() })
      .where(eq(productsTable.id, id)).returning();
    return { kind: "updated" as const, product: archived };
  });
  if (archiveResult.kind === "not-found") {
    res.status(404).json({ error: "Product not found." });
    return;
  }
  if (archiveResult.kind === "already-archived") {
    res.status(409).json({ error: "Product is already archived." });
    return;
  }
  const updated = archiveResult.product;
  res.json(await getAdminProduct(updated));
});

router.post("/admin/products/:id/restore", async (req, res): Promise<void> => {
  const id = validId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid product id." });
    return;
  }
  const product = await findProduct(id);
  if (!product) {
    res.status(404).json({ error: "Product not found." });
    return;
  }
  if (product.publishStatus !== "Archived") {
    res.status(409).json({ error: "Only archived products can be restored." });
    return;
  }
  const [pendingDraft] = await db.select().from(productDraftsTable)
    .where(eq(productDraftsTable.productId, id));
  const restoredDraftPayload = pendingDraft
    ? await applyTaxonomyCategory(
      normalizeEditable(pendingDraft.snapshot),
      product.subcategoryId === null ? new Set() : new Set([product.subcategoryId]),
    )
    : null;
  if (pendingDraft && !restoredDraftPayload) {
    res.status(400).json({ error: "Selected category does not exist or has an invalid parent." });
    return;
  }
  const updated = await db.transaction(async (tx) => {
    const [lockedProduct] = await tx.select().from(productsTable)
      .where(eq(productsTable.id, id)).for("update");
    if (!lockedProduct || lockedProduct.publishStatus !== "Archived") {
      throw new Error("PRODUCT_NOT_ARCHIVED");
    }
    const [draft] = await tx.select().from(productDraftsTable)
      .where(eq(productDraftsTable.productId, id));
    const [restored] = await tx.update(productsTable).set({
      ...(draft && restoredDraftPayload ? restoredDraftPayload : {}),
      publishStatus: "Draft",
      updatedAt: new Date(),
    }).where(eq(productsTable.id, id)).returning();
    if (draft) await tx.delete(productDraftsTable).where(eq(productDraftsTable.id, draft.id));
    return restored;
  }).catch((error: unknown) => {
    if (error instanceof Error && error.message === "PRODUCT_NOT_ARCHIVED") return null;
    throw error;
  });
  if (!updated) {
    res.status(409).json({ error: "Only archived products can be restored." });
    return;
  }
  res.json(await getAdminProduct(updated));
});

router.post("/admin/products/:id/discard-draft", async (req, res): Promise<void> => {
  const id = validId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid product id." });
    return;
  }
  const product = await findProduct(id);
  if (!product) {
    res.status(404).json({ error: "Product not found." });
    return;
  }
  if (product.publishStatus !== "Published") {
    res.status(409).json({ error: "Draft-only products should be deleted if they are no longer needed." });
    return;
  }
  const discardResult = await db.transaction(async (tx) => {
    const [lockedProduct] = await tx.select().from(productsTable)
      .where(eq(productsTable.id, id)).for("update");
    if (!lockedProduct) return { kind: "not-found" as const };
    if (lockedProduct.publishStatus !== "Published") return { kind: "not-published" as const };
    await tx.delete(productDraftsTable).where(eq(productDraftsTable.productId, id));
    return { kind: "discarded" as const, product: lockedProduct };
  });
  if (discardResult.kind === "not-found") {
    res.status(404).json({ error: "Product not found." });
    return;
  }
  if (discardResult.kind === "not-published") {
    res.status(409).json({ error: "Draft-only products should be deleted if they are no longer needed." });
    return;
  }
  res.json(await getAdminProduct(discardResult.product));
});

router.patch("/products/:id", async (req, res): Promise<void> => {
  const id = validId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid product id." });
    return;
  }
  const parsed = updateProductSchema.safeParse(req.body);
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    res.status(400).json({ error: "Please provide at least one valid product field." });
    return;
  }
  const currentProduct = await findProduct(id);
  if (!currentProduct) {
    res.status(404).json({ error: "Product not found." });
    return;
  }
  const { publishStatus, ...changes } = parsed.data;
  // v2 insert defaults must not turn a status-only patch into an attempted
  // published-content edit when Zod supplies their default values.
  for (const key of ["guideYear", "descriptionSource", "websiteUrlLegacy", "availabilityOverride", "listingOverride"] as const) {
    if (!(key in req.body)) delete changes[key];
  }
  if (publishStatus) {
    res.status(409).json({ error: "Use the lifecycle actions to change publication status." });
    return;
  }
  if (changes.details) {
    const missingReferences = await findMissingProductReferences(changes.details);
    if (missingReferences.length > 0) {
      res.status(400).json({ error: `Unknown linked product: ${missingReferences.join(", ")}.` });
      return;
    }
  }
  if (changes.subcategoryId !== undefined) {
    const taxonomyChanges = await applyTaxonomyCategory({
      category: changes.category ?? "",
      subcategoryId: changes.subcategoryId,
    }, currentProduct.subcategoryId === null ? new Set() : new Set([currentProduct.subcategoryId]));
    if (!taxonomyChanges) {
      res.status(400).json({ error: "Selected category does not exist or has an invalid parent." });
      return;
    }
    if (changes.subcategoryId !== null) changes.category = taxonomyChanges.category;
  }
  const updateResult = await db.transaction(async (tx) => {
    const [lockedProduct] = await tx.select().from(productsTable)
      .where(eq(productsTable.id, id)).for("update");
    if (!lockedProduct) return { kind: "not-found" as const };
    if (lockedProduct.publishStatus === "Archived") return { kind: "archived" as const };
    if (lockedProduct.publishStatus === "Published" && Object.keys(changes).some((key) => key !== "status")) {
      return { kind: "published-content" as const };
    }
    const [updated] = await tx.update(productsTable)
      .set({ ...changes, updatedAt: new Date() })
      .where(eq(productsTable.id, id)).returning();
    if (lockedProduct.publishStatus === "Published" && changes.status) {
      const [draft] = await tx.select().from(productDraftsTable)
        .where(eq(productDraftsTable.productId, id));
      if (draft) {
        await tx.update(productDraftsTable)
          .set({ snapshot: { ...draft.snapshot, status: changes.status }, updatedAt: new Date() })
          .where(eq(productDraftsTable.id, draft.id));
      }
    }
    return { kind: "updated" as const, product: updated };
  });
  if (updateResult.kind === "not-found") {
    res.status(404).json({ error: "Product not found." });
    return;
  }
  if (updateResult.kind === "archived") {
    res.status(409).json({ error: "Restore this product before editing it." });
    return;
  }
  if (updateResult.kind === "published-content") {
    res.status(409).json({ error: "Published catalogue content must be saved as a draft." });
    return;
  }
  res.json(updateResult.product);
});

router.delete("/products/:id", async (req, res): Promise<void> => {
  const id = validId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid product id." });
    return;
  }
  const target = await findProduct(id);
  if (!target) {
    res.status(404).json({ error: "Product not found." });
    return;
  }
  const catalogue = await db.select().from(productsTable);
  const drafts = await db.select().from(productDraftsTable);
  const referencedBy = catalogue.filter((product) => {
    if (product.id === id) return false;
    const details = normalizeProductDetails(product.details, product.packSize);
    return details.relatedProducts.includes(target.slug) ||
      details.companionSpecies.includes(target.slug) ||
      details.components.some((component) => component.productLink === target.slug);
  });
  const draftReferences = drafts.filter((draft) => {
    if (draft.productId === id) return false;
    const details = normalizeProductDetails(draft.snapshot.details, draft.snapshot.packSize);
    return details.relatedProducts.includes(target.slug) ||
      details.companionSpecies.includes(target.slug) ||
      details.components.some((component) => component.productLink === target.slug);
  });
  if (referencedBy.length > 0 || draftReferences.length > 0) {
    const names = referencedBy.map((product) => product.name);
    res.status(409).json({ error: `This product is linked from: ${names.join(", ") || "a draft revision"}. Remove those links before deleting it.` });
    return;
  }
  await db.delete(productsTable).where(eq(productsTable.id, id));
  res.sendStatus(204);
});

router.get("/admin/summary", async (_req, res): Promise<void> => {
  const products = await ensureProducts();
  const recentProducts = [...products].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()).slice(0, 5);
  res.json({
    totalProducts: products.filter((product) => product.publishStatus !== "Archived").length,
    publishedProducts: products.filter((product) => product.publishStatus === "Published").length,
    draftProducts: products.filter((product) => product.publishStatus === "Draft").length,
    archivedProducts: products.filter((product) => product.publishStatus === "Archived").length,
    pendingDrafts: (await db.select().from(productDraftsTable)).length,
    lowStockProducts: products.filter((product) => product.status === "low" || product.status === "very-low" || product.status === "unavailable").length,
    missingTechSheets: products.filter((product) => product.publishStatus !== "Archived" && !product.techSheet).length,
    recentProducts,
  });
});

router.get("/availability", async (_req, res): Promise<void> => {
  const products = await ensureProducts();
  const lines = await db.select().from(saleLinesTable);
  const hasAvailableLine = new Set(lines.filter((line) => line.availability !== "Unavailable").map((line) => line.productId));
  res.json(products.filter((product) => product.publishStatus === "Published" &&
    (product.listingOverride === "Force active" ||
      (product.listingOverride !== "Force legacy" && (hasAvailableLine.has(product.id) || !lines.some((line) => line.productId === product.id)))))
    .map(({ id, name, note, status }) => ({ id, name, note, status })));
});

export default router;