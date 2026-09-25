import { Router, type IRouter, type Response } from "express";
import { desc, eq, inArray } from "drizzle-orm";
import {
  db,
  catalogueCategoriesTable,
  forSearchMetadata,
  normalizeProductDetails,
  withDefaultSocialImage,
  resolveProductH1,
  productDraftSchema,
  productDraftsTable,
  productsTable,
  saleLineSchema,
  saleLinesTable,
  type SaleLine,
  updateProductSchema,
  type InsertProduct,
  type Product,
  type ProductEditablePayload,
  applyListingAvailability,
  isActiveListing,
  isNewListing,
  prepareEditablePayload,
  resolveListingState,
} from "@workspace/db";
import { insertProductSchema } from "@workspace/db";
import { publicRedirectTo } from "../lib/public-redirect";
import { productPublicPath } from "../lib/product-path";
import { absolutePublicUrl, canonicalPublicPath } from "../lib/public-site-url";
import { clearProductMediaReferences, syncProductMediaReferences } from "../lib/media-usage";
import { scheduleGeneratedTechSheet } from "../lib/generated-tech-sheet";

const router: IRouter = Router();

function escapeXml(value: string) {
  return value.replace(/[<>&'"]/g, (character) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", "\"": "&quot;" })[character]!);
}

function allowsSearchIndex(details: unknown) {
  if (!details || typeof details !== "object" || Array.isArray(details)) return true;
  return (details as { robotsIndex?: boolean }).robotsIndex !== false;
}

function productCanonicalOverride(details: unknown) {
  if (!details || typeof details !== "object" || Array.isArray(details)) return undefined;
  const value = (details as { canonicalUrl?: unknown }).canonicalUrl;
  return typeof value === "string" ? value : undefined;
}

function xmlUrlTag(loc: string, lastModified: Date) {
  return `<url><loc>${escapeXml(loc)}</loc><lastmod>${escapeXml(lastModified.toISOString())}</lastmod></url>`;
}

type SitemapProductEntry = {
  slug: string;
  path: string;
  lastModified: Date;
};

async function listIndexableSitemapProducts(): Promise<SitemapProductEntry[]> {
  const [products, categories] = await Promise.all([
    db.select().from(productsTable).where(eq(productsTable.publishStatus, "Published")),
    db.select({
      parentId: catalogueCategoriesTable.parentId,
      slug: catalogueCategoriesTable.slug,
      name: catalogueCategoriesTable.name,
    }).from(catalogueCategoriesTable),
  ]);
  return products
    .filter((product) => isActiveListing(product) && allowsSearchIndex(product.details))
    .map((product) => {
      const fallbackPath = productPublicPath(product.slug, product.category, categories);
      return {
        slug: product.slug,
        path: canonicalPublicPath(productCanonicalOverride(product.details), fallbackPath),
        lastModified: product.updatedAt,
      };
    });
}

type PublicProduct = {
  id: number; name: string; slug: string; price: string; packSize: string; status: string;
  note: string; category: string; subcategoryId: number | null; techSheet: string; guideYear: string;
  listingState: "Active" | "New"; saleLines: SaleLine[]; details: ReturnType<typeof toPublicDetails>;
};

function toPublicDetails(value: unknown, packSize: string, name = "") {
  const d = normalizeProductDetails(value, packSize);
  return {
    recordType: d.recordType, botanicalName: d.botanicalName,
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
    floweringWindow: d.floweringWindow,
    applicationRate: d.applicationRate, diseasePestResistance: d.diseasePestResistance,
    standLifeNotes: d.standLifeNotes, grazingManagementNotes: d.grazingManagementNotes,
    pbrProtected: d.pbrProtected, pbrDetails: d.pbrDetails, certification: d.certification,
    description: d.description, components: d.components, faqs: d.faqs,
    relatedProducts: d.relatedProducts, formulationYear: d.formulationYear, photos: d.photos,
    h1: resolveProductH1(name, d.h1),
    seoTitle: forSearchMetadata(d.seoTitle),
    seoDescription: forSearchMetadata(d.seoDescription || d.blurb),
    socialTitle: forSearchMetadata(d.socialTitle),
    socialDescription: forSearchMetadata(d.socialDescription),
    socialImage: d.socialImage, canonicalUrl: d.canonicalUrl, robotsIndex: d.robotsIndex,
  };
}

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

function compareSaleLines(
  a: typeof saleLinesTable.$inferSelect,
  b: typeof saleLinesTable.$inferSelect,
) {
  const defaultOrder = Number(b.isDefault) - Number(a.isDefault);
  if (defaultOrder) return defaultOrder;
  const packOrder = (value: string | null) => {
    if (value === null) return null;
    const packKg = Number(value);
    return Number.isFinite(packKg) && packKg > 0 ? packKg : null;
  };
  const aPack = packOrder(a.packKg), bPack = packOrder(b.packKg);
  if (aPack !== null && bPack !== null && aPack !== bPack) return aPack - bPack;
  if (aPack !== null && bPack === null) return -1;
  if (aPack === null && bPack !== null) return 1;
  const stockOrder = a.stockCode.localeCompare(b.stockCode, undefined, { sensitivity: "base" });
  return stockOrder || a.id - b.id;
}

async function liveSaleLines(productId: number): Promise<SaleLine[]> {
  return (await db.select().from(saleLinesTable).where(eq(saleLinesTable.productId, productId)))
    .sort(compareSaleLines).map(toSaleLine);
}

const STATUS_TO_AVAILABILITY = {
  "in-stock": "Good stock",
  low: "Low stock",
  "very-low": "Very low",
  unavailable: "Unavailable",
} as const;

type ProductStockStatus = keyof typeof STATUS_TO_AVAILABILITY;
type StockAvailability = (typeof STATUS_TO_AVAILABILITY)[ProductStockStatus];

function availabilityFromStatus(status: string): StockAvailability | null {
  return Object.hasOwn(STATUS_TO_AVAILABILITY, status)
    ? STATUS_TO_AVAILABILITY[status as ProductStockStatus]
    : null;
}

function applyStockToDraftSnapshot(
  snapshot: ProductEditablePayload,
  status: ProductEditablePayload["status"],
  availability: StockAvailability,
  hasLiveSaleLines: boolean,
): ProductEditablePayload {
  return {
    ...snapshot,
    status,
    availabilityOverride: hasLiveSaleLines ? null : availability,
    saleLines: (snapshot.saleLines ?? []).map((line) => ({ ...line, availability })),
  };
}

function toPublicProduct(product: Product, productLines: SaleLine[]): PublicProduct {
  const availability = product.listingState === "Legacy"
    ? "Unavailable"
    : product.availabilityOverride ?? productLines.find((line) => line.isDefault)?.availability
    ?? productLines.find((line) => line.availability !== "Unavailable")?.availability ?? "Unavailable";
  return {
    id: product.id, name: product.name, slug: product.slug, price: product.price, packSize: product.packSize,
    status: ({ "Good stock": "in-stock", "Low stock": "low", "Very low": "very-low", Unavailable: "unavailable" } as const)[availability] ?? "unavailable",
    note: product.note, category: product.category, subcategoryId: product.subcategoryId, techSheet: product.techSheet,
    guideYear: product.guideYear, listingState: isNewListing(product) ? "New" : "Active", saleLines: productLines,
    details: toPublicDetails(product.details, product.packSize, product.name),
  };
}

function editableFromProduct(product: Product, saleLines: SaleLine[] = []): ProductEditablePayload {
  return applyListingAvailability({
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
    listingState: resolveListingState(product),
    details: normalizeProductDetails(product.details, product.packSize),
    saleLines,
  });
}

function sourceHasSaleLines(source: unknown): source is { saleLines: SaleLine[] } {
  return Boolean(
    source
    && typeof source === "object"
    && !Array.isArray(source)
    && Array.isArray((source as { saleLines?: unknown }).saleLines),
  );
}

function saleLinesFromSource(source: unknown, fallback: SaleLine[]): SaleLine[] {
  return sourceHasSaleLines(source) ? source.saleLines : fallback;
}

function normalizeEditable(payload: ProductEditablePayload): ProductEditablePayload {
  return applyListingAvailability({
    ...payload,
    subcategoryId: payload.subcategoryId ?? null,
    saleLines: payload.saleLines ?? [],
    details: withDefaultSocialImage(normalizeProductDetails(payload.details, payload.packSize)),
    listingState: resolveListingState(payload),
  });
}

function productFieldsFromEditable(payload: ProductEditablePayload) {
  const { saleLines: _saleLines, ...productFields } = payload;
  return productFields;
}

function saleLineRows(productId: number, saleLines: ProductEditablePayload["saleLines"]) {
  return saleLines.map((line) => ({
    productId,
    stockCode: line.stockCode,
    seedForm: line.seedForm,
    seedGrade: line.seedGrade,
    packKg: line.packKg === null ? null : String(line.packKg),
    packUnit: line.packUnit,
    availability: line.availability,
    priceDisplay: line.priceDisplay,
    isDefault: line.isDefault,
    sortOrder: line.sortOrder,
  }));
}

async function replaceSaleLines(
  tx: Pick<typeof db, "delete" | "insert">,
  productId: number,
  saleLines: ProductEditablePayload["saleLines"],
) {
  await tx.delete(saleLinesTable).where(eq(saleLinesTable.productId, productId));
  if (saleLines.length) {
    await tx.insert(saleLinesTable).values(saleLineRows(productId, saleLines));
  }
}

function hasPublishPayload(body: unknown): body is Record<string, unknown> {
  return Boolean(body && typeof body === "object" && !Array.isArray(body) && Object.keys(body).length > 0);
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

type PublishValidationIssue = {
  field: string;
  label: string;
};

function getPublishValidationErrors(product: Product, payload: ProductEditablePayload): PublishValidationIssue[] {
  return [
    !payload.name.trim() && { field: "name", label: "Product name" },
    !product.slug.trim() && { field: "slug", label: "Slug" },
    !payload.category.trim() && { field: "category", label: "Category" },
    !payload.details.recordType && { field: "details.recordType", label: "Record type" },
    !payload.details.tagline.trim() && { field: "details.tagline", label: "Tagline" },
    !payload.details.blurb.trim() && { field: "details.blurb", label: "Blurb" },
    !payload.details.keyAttributes.some((attribute) => attribute.trim()) && { field: "details.keyAttributes", label: "Key attributes" },
    !payload.details.description.trim() && { field: "details.description", label: "Product description" },
    !payload.details.seoTitle.trim() && { field: "details.seoTitle", label: "SEO title" },
    !payload.details.seoDescription.trim() && { field: "details.seoDescription", label: "SEO description" },
    payload.saleLines.length > 0 && payload.saleLines.filter((line) => line.isDefault).length !== 1 && { field: "saleLines.default", label: "Exactly one default sale line" },
    new Set(payload.saleLines.map((line) => line.stockCode)).size !== payload.saleLines.length && { field: "saleLines.stockCodes", label: "Unique sale line stock codes" },
  ].filter(Boolean) as PublishValidationIssue[];
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
  return db.select().from(productsTable)
    .orderBy(desc(productsTable.updatedAt), desc(productsTable.id));
}

type ProductReferenceIssue = {
  field: "details.relatedProducts" | "details.components";
  label: string;
  values: string[];
};

async function findProductReferenceIssues(details: InsertProduct["details"], ownSlug?: string): Promise<ProductReferenceIssue[]> {
  const referencesByField = [
    { field: "details.relatedProducts", label: "Also popular", values: details.relatedProducts.filter(Boolean) },
    { field: "details.components", label: "Component links", values: details.components.map((component) => component.productLink).filter(Boolean) },
  ] as const;
  const references = [...new Set(referencesByField.flatMap((reference) => reference.values))];
  if (references.length === 0) return [];
  const existing = await db.select({ slug: productsTable.slug }).from(productsTable)
    .where(inArray(productsTable.slug, references));
  const known = new Set(existing.map((product) => product.slug));
  return referencesByField.flatMap(({ field, label, values }) => {
    const invalid = [...new Set(values.filter((slug) => !known.has(slug) || slug === ownSlug))];
    return invalid.length ? [{ field, label, values: invalid }] : [];
  });
}

function sendProductReferenceError(res: Response, issues: ProductReferenceIssue[]) {
  res.status(400).json({
    error: `${issues[0].label} contains invalid product references: ${issues[0].values.join(", ")}.`,
    issues,
  });
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

// Drizzle wraps the driver error in DrizzleQueryError, so the Postgres error
// code and constraint live on `cause`, not on the thrown error's message.
function findPostgresUniqueViolation(error: unknown): { constraint: string | null } | null {
  let current: unknown = error;
  while (current && typeof current === "object") {
    if ("code" in current && current.code === "23505") {
      const constraint = "constraint" in current && typeof current.constraint === "string" ? current.constraint : null;
      return { constraint };
    }
    current = "cause" in current ? current.cause : null;
  }
  return null;
}

function sendDuplicateProductError(res: Response, error: unknown): boolean {
  const violation = findPostgresUniqueViolation(error);
  if (!violation) return false;
  const field = violation.constraint === "ih_products_slug_unique" ? "slug" : "name";
  res.status(409).json({
    error: field === "slug"
      ? "A product with that slug already exists. Choose a different slug."
      : "A product with that name already exists.",
    issues: [{ field, label: field === "slug" ? "Slug" : "Product name" }],
  });
  return true;
}

router.get("/products", async (req, res): Promise<void> => {
  const products = await ensureProducts();
  res.set("Cache-Control", "no-store");
  const lines = await db.select().from(saleLinesTable);
  const linesByProduct = new Map<number, SaleLine[]>();
  for (const line of lines.sort(compareSaleLines)) {
    linesByProduct.set(line.productId, [...(linesByProduct.get(line.productId) ?? []), toSaleLine(line)]);
  }
  res.json(products.filter((product) => {
    if (product.publishStatus !== "Published") return false;
    return isActiveListing(product);
  }).map((product): PublicProduct => toPublicProduct(product, linesByProduct.get(product.id) ?? [])));
});

// A detail lookup must never disclose draft, archived, or legacy-only products.
router.get("/products/slug/:slug", async (req, res): Promise<void> => {
  const slug = String(req.params.slug);
  const [product] = await db.select().from(productsTable).where(eq(productsTable.slug, slug));
  if (!product || product.publishStatus !== "Published") {
    res.status(404).json({ error: "Product not found." });
    return;
  }
  const productLines = await liveSaleLines(product.id);
  if (!isActiveListing(product)) {
    res.status(404).json({ error: "Product not found." });
    return;
  }
  res.set("Cache-Control", "no-store");
  res.json(toPublicProduct(product, productLines));
});

// Deliberately name-only: category pages can expose catalogue history without
// accidentally making Legacy product detail data public.
router.get("/products/category/:category/legacy", async (req, res): Promise<void> => {
  const category = decodeURIComponent(String(req.params.category));
  const products = await db.select().from(productsTable)
    .where(eq(productsTable.category, category));
  res.json(products.filter((product) => product.publishStatus === "Published" && !isActiveListing(product))
    .map((product) => ({ name: product.name })));
});

router.get("/redirects/lookup", async (req, res): Promise<void> => {
  const fromPath = typeof req.query.fromPath === "string" ? req.query.fromPath : "";
  if (!fromPath.startsWith("/") || fromPath.length > 500) {
    res.status(400).json({ error: "A valid absolute fromPath is required." });
    return;
  }
  const toPath = await publicRedirectTo(fromPath);
  if (!toPath) {
    res.status(404).json({ error: "Redirect not found." });
    return;
  }
  res.json({ toPath });
});

router.get("/sitemap-product-entries", async (_req, res): Promise<void> => {
  const entries = await listIndexableSitemapProducts();
  res.json(entries.map((entry) => ({
    slug: entry.slug,
    lastModified: entry.lastModified.toISOString(),
  })));
});

router.get("/sitemap-products", async (_req, res): Promise<void> => {
  const entries = await listIndexableSitemapProducts();
  res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${
    entries.map((entry) => xmlUrlTag(absolutePublicUrl(entry.path), entry.lastModified)).join("")
  }</urlset>`);
});

router.post("/products", async (req, res): Promise<void> => {
  const missingDraftFields = getDraftValidationErrors(req.body);
  if (missingDraftFields.length > 0) {
    res.status(400).json({ error: `Complete these fields before saving a draft: ${missingDraftFields.join(", ")}.` });
    return;
  }
  const parsed = insertProductSchema.safeParse(prepareEditablePayload({
    ...req.body,
    publishStatus: "Draft",
    details: withDefaultSocialImage(normalizeProductDetails(req.body.details, String(req.body.packSize ?? ""))),
  }));
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
  const referenceIssues = await findProductReferenceIssues(taxonomyPayload.details, parsed.data.slug);
  if (referenceIssues.length > 0) {
    sendProductReferenceError(res, referenceIssues);
    return;
  }
  const parsedSaleLines = saleLineSchema.array().safeParse(req.body?.saleLines ?? []);
  if (!parsedSaleLines.success) {
    res.status(400).json({ error: "Please complete all required product fields." });
    return;
  }
  const listingPayload = applyListingAvailability({
    ...taxonomyPayload,
    listingState: resolveListingState(taxonomyPayload),
    saleLines: parsedSaleLines.data,
  });
  const { saleLines, ...productValues } = listingPayload;
  try {
    const product = await db.transaction(async (tx) => {
      const [created] = await tx.insert(productsTable).values({
        ...productValues,
        publishStatus: "Draft",
        publishedAt: null,
      }).returning();
      await replaceSaleLines(tx, created.id, saleLines);
      await syncProductMediaReferences(created, created.details.photos, tx);
      return created;
    });
    req.log.info({ productId: product.id }, "Draft product created");
    res.status(201).json(product);
  } catch (error) {
    if (sendDuplicateProductError(res, error)) return;
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
  if (product.publishStatus === "Published") {
    res.status(409).json({ error: "Published products cannot be saved as drafts. Publish the changes instead." });
    return;
  }
  const missingDraftFields = getDraftValidationErrors({ ...req.body, slug: product.slug });
  if (missingDraftFields.length > 0) {
    res.status(400).json({ error: `Complete these fields before saving a draft: ${missingDraftFields.join(", ")}.` });
    return;
  }
  const parsed = productDraftSchema.safeParse(prepareEditablePayload(req.body));
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
  const referenceIssues = await findProductReferenceIssues(taxonomyPayload.details, product.slug);
  if (referenceIssues.length > 0) {
    sendProductReferenceError(res, referenceIssues);
    return;
  }
  const snapshot = normalizeEditable(taxonomyPayload);
  try {
    const updated = await db.transaction(async (tx) => {
      const [lockedProduct] = await tx.select().from(productsTable)
        .where(eq(productsTable.id, id)).for("update");
      if (!lockedProduct) throw new Error("PRODUCT_NOT_FOUND");
      if (lockedProduct.publishStatus === "Archived") throw new Error("PRODUCT_ARCHIVED");
      if (lockedProduct.publishStatus === "Published") throw new Error("PRODUCT_PUBLISHED");
      const [draftProduct] = await tx.update(productsTable)
        .set({ ...productFieldsFromEditable(snapshot), publishStatus: "Draft", updatedAt: new Date() })
        .where(eq(productsTable.id, id)).returning();
      await replaceSaleLines(tx, id, snapshot.saleLines);
      await syncProductMediaReferences(draftProduct, draftProduct.details.photos, tx);
      return draftProduct;
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
    if (error instanceof Error && error.message === "PRODUCT_PUBLISHED") {
      res.status(409).json({ error: "Published products cannot be saved as drafts. Publish the changes instead." });
      return;
    }
    if (sendDuplicateProductError(res, error)) return;
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
  let bodyPayload: ProductEditablePayload | null = null;
  if (hasPublishPayload(req.body)) {
    const parsed = productDraftSchema.safeParse(prepareEditablePayload(req.body));
    if (!parsed.success) {
      res.status(400).json({ error: "Please complete all required product fields." });
      return;
    }
    bodyPayload = normalizeEditable(parsed.data);
  }
  try {
    const updated = await db.transaction(async (tx) => {
      const [lockedProduct] = await tx.select().from(productsTable)
        .where(eq(productsTable.id, id)).for("update");
      if (!lockedProduct) throw new Error("PRODUCT_NOT_FOUND");
      if (lockedProduct.publishStatus === "Archived") throw new Error("PRODUCT_ARCHIVED");
      const [draft] = await tx.select().from(productDraftsTable)
        .where(eq(productDraftsTable.productId, id));
      const liveLines = (await tx.select().from(saleLinesTable).where(eq(saleLinesTable.productId, id)))
        .sort(compareSaleLines)
        .map(toSaleLine);
      const source = bodyPayload ? req.body : draft?.snapshot;
      const payload = {
        ...(bodyPayload ?? draft?.snapshot ?? editableFromProduct(lockedProduct, liveLines)),
        saleLines: saleLinesFromSource(source, liveLines),
      };
      const resolvedPayload = await applyTaxonomyCategory(
        normalizeEditable(payload),
        lockedProduct.publishStatus === "Published" && lockedProduct.subcategoryId !== null
          ? new Set([lockedProduct.subcategoryId])
          : new Set(),
      );
      if (!resolvedPayload) throw new Error("INVALID_CATEGORY");
      const normalizedPayload = resolvedPayload;
      const referenceIssues = await findProductReferenceIssues(normalizedPayload.details, lockedProduct.slug);
      if (referenceIssues.length > 0) throw new Error(`REFERENCE_VALIDATION:${JSON.stringify(referenceIssues)}`);
      const missingFields = getPublishValidationErrors(lockedProduct, normalizedPayload);
      if (missingFields.length > 0) throw new Error(`PUBLISH_VALIDATION:${JSON.stringify(missingFields)}`);
      const [published] = await tx.update(productsTable).set({
        ...productFieldsFromEditable(normalizedPayload),
        publishStatus: "Published",
        publishedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(productsTable.id, id)).returning();
      await replaceSaleLines(tx, id, normalizedPayload.saleLines);
      if (draft) await tx.delete(productDraftsTable).where(eq(productDraftsTable.id, draft.id));
      await syncProductMediaReferences(published, published.details.photos, tx);
      return published;
    });
    scheduleGeneratedTechSheet(updated.slug);
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
      const issues = JSON.parse(error.message.slice("PUBLISH_VALIDATION:".length)) as PublishValidationIssue[];
      res.status(400).json({
        error: `Complete these fields before publishing: ${issues.map((issue) => issue.label).join(", ")}.`,
        issues,
      });
      return;
    }
    if (error instanceof Error && error.message.startsWith("REFERENCE_VALIDATION:")) {
      const issues = JSON.parse(error.message.slice("REFERENCE_VALIDATION:".length)) as ProductReferenceIssue[];
      sendProductReferenceError(res, issues);
      return;
    }
    if (sendDuplicateProductError(res, error)) return;
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
    await syncProductMediaReferences(archived, archived.details.photos, tx);
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
    const restoredFields = draft && restoredDraftPayload ? productFieldsFromEditable(restoredDraftPayload) : {};
    const [restored] = await tx.update(productsTable).set({
      ...restoredFields,
      publishStatus: "Draft",
      updatedAt: new Date(),
    }).where(eq(productsTable.id, id)).returning();
    if (draft && restoredDraftPayload && sourceHasSaleLines(draft.snapshot)) {
      await replaceSaleLines(tx, id, restoredDraftPayload.saleLines);
    }
    if (draft) await tx.delete(productDraftsTable).where(eq(productDraftsTable.id, draft.id));
    await syncProductMediaReferences(restored, restored.details.photos, tx);
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
  const parsed = updateProductSchema.safeParse(prepareEditablePayload(req.body));
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
  for (const key of ["guideYear", "descriptionSource", "websiteUrlLegacy", "availabilityOverride", "listingState"] as const) {
    if (!(key in req.body)) delete changes[key];
  }
  if (resolveListingState({ ...currentProduct, ...changes }) === "Legacy") {
    changes.availabilityOverride = null;
    changes.status = "unavailable";
  }
  if (publishStatus) {
    res.status(409).json({ error: "Use the lifecycle actions to change publication status." });
    return;
  }
  if (changes.details) {
    const referenceIssues = await findProductReferenceIssues(changes.details, currentProduct.slug);
    if (referenceIssues.length > 0) {
      sendProductReferenceError(res, referenceIssues);
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
    const listingState = resolveListingState({ ...lockedProduct, ...changes });
    const requestedStatus = changes.status;
    const stockAvailability = requestedStatus
      ? availabilityFromStatus(listingState === "Legacy" ? "unavailable" : requestedStatus)
      : null;
    const applyLiveStock = Boolean(stockAvailability) && listingState !== "Legacy";
    let liveLineCount = 0;
    if (applyLiveStock && stockAvailability) {
      const lines = await tx.select({ id: saleLinesTable.id }).from(saleLinesTable)
        .where(eq(saleLinesTable.productId, id));
      liveLineCount = lines.length;
      changes.availabilityOverride = liveLineCount > 0 ? null : stockAvailability;
    }
    const allowedPublishedKeys = new Set(["status", "availabilityOverride"]);
    if (lockedProduct.publishStatus === "Published" && Object.keys(changes).some((key) => !allowedPublishedKeys.has(key))) {
      return { kind: "published-content" as const };
    }
    const [updated] = await tx.update(productsTable)
      .set({ ...changes, updatedAt: new Date() })
      .where(eq(productsTable.id, id)).returning();
    if (applyLiveStock && stockAvailability && liveLineCount > 0) {
      await tx.update(saleLinesTable)
        .set({ availability: stockAvailability, updatedAt: new Date() })
        .where(eq(saleLinesTable.productId, id));
    }
    if (changes.details) {
      await syncProductMediaReferences(updated, updated.details.photos, tx);
    }
    if (requestedStatus && lockedProduct.publishStatus === "Published") {
      const [draft] = await tx.select().from(productDraftsTable)
        .where(eq(productDraftsTable.productId, id));
      if (draft) {
        const snapshot = applyLiveStock && stockAvailability
          ? applyStockToDraftSnapshot(
            draft.snapshot,
            requestedStatus,
            stockAvailability,
            liveLineCount > 0,
          )
          : { ...draft.snapshot, status: requestedStatus };
        await tx.update(productDraftsTable)
          .set({ snapshot, updatedAt: new Date() })
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
    res.status(409).json({ error: "Published catalogue content must be published. Use the publish action to apply changes." });
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
      details.components.some((component) => component.productLink === target.slug);
  });
  const draftReferences = drafts.filter((draft) => {
    if (draft.productId === id) return false;
    const details = normalizeProductDetails(draft.snapshot.details, draft.snapshot.packSize);
    return details.relatedProducts.includes(target.slug) ||
      details.components.some((component) => component.productLink === target.slug);
  });
  if (referencedBy.length > 0 || draftReferences.length > 0) {
    const names = referencedBy.map((product) => product.name);
    res.status(409).json({ error: `This product is linked from: ${names.join(", ") || "a draft revision"}. Remove those links before deleting it.` });
    return;
  }
  await db.delete(productsTable).where(eq(productsTable.id, id));
  await clearProductMediaReferences(id);
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
    pendingDrafts: products.filter((product) => product.publishStatus === "Draft").length,
    lowStockProducts: products.filter((product) => product.status === "low" || product.status === "very-low" || product.status === "unavailable").length,
    missingTechSheets: products.filter((product) => product.publishStatus !== "Archived" && !product.techSheet).length,
    recentProducts,
  });
});

router.get("/availability", async (_req, res): Promise<void> => {
  const products = await ensureProducts();
  res.json(products.filter((product) => product.publishStatus === "Published" && isActiveListing(product))
    .map(({ id, name, note, status }) => ({ id, name, note, status })));
});

export default router;