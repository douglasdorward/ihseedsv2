import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import {
  aiIngestItemsTable,
  db,
  insertProductSchema,
  normalizeProductDetails,
  prepareEditablePayload,
  productsTable,
} from "@workspace/db";
import { getStoredFile } from "../lib/app-storage";
import { aiExtractConfigured } from "../lib/ai-extract";
import {
  assignIngestItem,
  deleteIngestItem,
  extractStoredItem,
  ingestPdfForProduct,
  ingestQueueFiles,
  toPublicIngestItem,
  type UploadedPdf,
} from "../lib/ai-ingest";

const router: IRouter = Router();
const MAX_BATCH = 20;

function asFiles(body: unknown): UploadedPdf[] {
  if (!body || typeof body !== "object") return [];
  const record = body as { files?: unknown; filename?: unknown; data?: unknown };
  if (Array.isArray(record.files)) {
    return record.files.flatMap((file) => {
      if (!file || typeof file !== "object") return [];
      const item = file as { filename?: unknown; data?: unknown };
      if (typeof item.filename !== "string" || typeof item.data !== "string") return [];
      return [{ filename: item.filename, data: item.data }];
    });
  }
  if (typeof record.filename === "string" && typeof record.data === "string") {
    return [{ filename: record.filename, data: record.data }];
  }
  return [];
}

function stubPatchFrom(body: unknown) {
  if (!process.env.AI_EXTRACT_STUB) return undefined;
  if (!body || typeof body !== "object") return undefined;
  const stub = (body as { stubPatch?: unknown }).stubPatch;
  return stub && typeof stub === "object" ? stub : undefined;
}

router.post("/admin/ai/extract", async (req, res): Promise<void> => {
  const files = asFiles(req.body);
  if (!files.length) {
    res.status(400).json({ error: "Upload at least one PDF." });
    return;
  }
  if (!aiExtractConfigured() && !stubPatchFrom(req.body)) {
    res.status(503).json({ error: "AI extraction is not configured." });
    return;
  }
  const productId = Number((req.body as { productId?: unknown }).productId);
  const product = Number.isInteger(productId) && productId > 0
    ? (await db.select().from(productsTable).where(eq(productsTable.id, productId)))[0] ?? null
    : null;
  const category = typeof (req.body as { category?: unknown }).category === "string"
    ? (req.body as { category: string }).category
    : undefined;
  try {
    const item = await ingestPdfForProduct(files[0], product, stubPatchFrom(req.body), category);
    res.json({
      item: toPublicIngestItem(item),
      suggestions: item.proposedPatch?.suggestions ?? [],
      warnings: item.warnings ?? [],
      scanned: item.proposedPatch?.scanned ?? false,
    });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Extraction failed" });
  }
});

router.get("/admin/tech-sheets", async (_req, res): Promise<void> => {
  const items = await db.select().from(aiIngestItemsTable).orderBy(desc(aiIngestItemsTable.createdAt));
  res.json(items.map(toPublicIngestItem));
});

router.post("/admin/tech-sheets", async (req, res): Promise<void> => {
  const files = asFiles(req.body).slice(0, MAX_BATCH);
  if (!files.length) {
    res.status(400).json({ error: "Upload at least one PDF." });
    return;
  }
  try {
    const items = await ingestQueueFiles(files, stubPatchFrom(req.body));
    res.status(201).json(items.map(toPublicIngestItem));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Upload failed" });
  }
});

router.get("/admin/tech-sheets/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [item] = await db.select().from(aiIngestItemsTable).where(eq(aiIngestItemsTable.id, id));
  if (!item) {
    res.status(404).json({ error: "Tech sheet not found." });
    return;
  }
  res.json(toPublicIngestItem(item));
});

router.get("/admin/tech-sheets/:id/file", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [item] = await db.select().from(aiIngestItemsTable).where(eq(aiIngestItemsTable.id, id));
  if (!item) {
    res.status(404).json({ error: "Tech sheet not found." });
    return;
  }
  const stored = await getStoredFile(item.storageKey);
  if (!stored) {
    res.status(404).json({ error: "The PDF is no longer in storage." });
    return;
  }
  res.setHeader("content-type", stored.contentType || "application/pdf");
  res.setHeader("content-disposition", `inline; filename="${item.filename.replace(/"/g, "")}"`);
  res.send(stored.bytes);
});

router.post("/admin/tech-sheets/:id/assign", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const body = req.body as { productId?: unknown; createDraft?: unknown };
  let product = Number.isInteger(Number(body.productId)) && Number(body.productId) > 0
    ? (await db.select().from(productsTable).where(eq(productsTable.id, Number(body.productId))))[0]
    : undefined;
  if (!product && body.createDraft && typeof body.createDraft === "object") {
    const draft = body.createDraft as Record<string, unknown>;
    const parsed = insertProductSchema.safeParse(prepareEditablePayload({
      name: draft.name,
      slug: draft.slug,
      price: "",
      packSize: "",
      status: "unavailable",
      note: "",
      category: draft.category,
      subcategoryId: null,
      techSheet: "",
      listingState: "Active",
      publishStatus: "Draft",
      details: normalizeProductDetails({ recordType: draft.recordType ?? "Variety" }, ""),
    }));
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues.map((issue) => issue.message).join(" ") });
      return;
    }
    const [created] = await db.insert(productsTable).values({
      ...parsed.data,
      publishStatus: "Draft",
      publishedAt: null,
    }).returning();
    product = created;
  }
  if (!product) {
    res.status(400).json({ error: "Choose an existing product or supply Draft identity fields." });
    return;
  }
  const item = await assignIngestItem(id, product, stubPatchFrom(req.body));
  if (!item) {
    res.status(404).json({ error: "Tech sheet not found." });
    return;
  }
  res.json({ item: toPublicIngestItem(item), productId: product.id });
});

router.post("/admin/tech-sheets/:id/extract", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [item] = await db.select().from(aiIngestItemsTable).where(eq(aiIngestItemsTable.id, id));
  if (!item) {
    res.status(404).json({ error: "Tech sheet not found." });
    return;
  }
  const product = item.productId
    ? (await db.select().from(productsTable).where(eq(productsTable.id, item.productId)))[0] ?? null
    : null;
  const updated = await extractStoredItem(item, {
    stubPatch: stubPatchFrom(req.body),
    currentProduct: product ? { name: product.name, slug: product.slug, category: product.category, techSheet: product.techSheet, details: product.details } : {},
    category: product?.category ?? "",
    existingProduct: Boolean(product),
    productName: product?.name,
  });
  res.json(toPublicIngestItem(updated));
});

router.delete("/admin/tech-sheets/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const removed = await deleteIngestItem(id);
  if (!removed) {
    res.status(404).json({ error: "Tech sheet not found." });
    return;
  }
  res.status(204).end();
});

export default router;
