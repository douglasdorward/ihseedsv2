import { createHash, randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import { and, desc, eq, ilike, inArray, ne } from "drizzle-orm";
import {
  db,
  mediaAssetsTable,
  mediaReferencesTable,
  productsTable,
  type MediaAsset,
  type MediaReference,
  type ProductPhoto,
} from "@workspace/db";
import {
  getStoredFile,
  mediaObjectPath,
  mediaPreviewPath,
  mediaPublicPath,
  putStoredFile,
  removeStoredFile,
} from "../lib/app-storage";
import { convertToWebp } from "../lib/media-image";
import { backfillMediaUsage, insertHeroPhoto, syncProductMediaReferences } from "../lib/media-usage";

const router: IRouter = Router();
const MAX_BYTES = 12 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const EXT_FOR_TYPE: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

type UsageSummary = {
  total: number;
  draft: number;
  published: number;
  product: number;
  category: number;
  static: number;
};

const emptyUsage = (): UsageSummary => ({
  total: 0, draft: 0, published: 0, product: 0, category: 0, static: 0,
});

function sha256(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

function extensionFor(filename: string, contentType: string) {
  const fromName = filename.toLowerCase().match(/\.(jpe?g|png|webp)$/)?.[0];
  if (fromName === ".jpeg") return ".jpg";
  if (fromName) return fromName;
  return EXT_FOR_TYPE[contentType] ?? ".bin";
}

async function usageByAssetId(ids: string[]) {
  const map = new Map<string, UsageSummary>();
  if (!ids.length) return map;
  const refs = await db.select().from(mediaReferencesTable).where(inArray(mediaReferencesTable.assetId, ids));
  for (const ref of refs) {
    const usage = map.get(ref.assetId) ?? emptyUsage();
    usage.total += 1;
    if (ref.usageState === "Draft") usage.draft += 1;
    if (ref.usageState === "Published") usage.published += 1;
    if (ref.ownerType === "product") usage.product += 1;
    if (ref.ownerType === "category") usage.category += 1;
    if (ref.ownerType === "static") usage.static += 1;
    map.set(ref.assetId, usage);
  }
  return map;
}

function toPublicAsset(asset: MediaAsset, usage = emptyUsage(), published = false) {
  return {
    id: asset.id,
    status: asset.status,
    originalFilename: asset.originalFilename,
    contentType: asset.contentType,
    bytes: asset.bytes,
    width: asset.width,
    height: asset.height,
    sha256: asset.sha256,
    defaultAlt: asset.defaultAlt,
    defaultCaption: asset.defaultCaption,
    failureReason: asset.failureReason,
    storageKind: asset.storageKind,
    objectPath: asset.objectPath,
    previewURL: asset.status === "Ready" ? mediaPreviewPath(asset.id) : null,
    publicURL: published || usage.published > 0 ? mediaPublicPath(asset.id) : null,
    usageSummary: usage,
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
  };
}

function toPublicReference(ref: MediaReference) {
  return {
    id: ref.id,
    assetId: ref.assetId,
    ownerType: ref.ownerType,
    ownerId: ref.ownerId,
    ownerName: ref.ownerName,
    field: ref.field,
    role: ref.role,
    usageState: ref.usageState,
    editPath: ref.editPath,
    metadata: ref.metadata ?? {},
    createdAt: ref.createdAt.toISOString(),
    updatedAt: ref.updatedAt.toISOString(),
  };
}

function usageBucket(usage: UsageSummary) {
  if (usage.total === 0) return "unassigned";
  if (usage.published > 0 && usage.draft > 0) return "mixed";
  if (usage.published > 0) return "published";
  return "draft";
}

router.get("/admin/media", async (req, res): Promise<void> => {
  const query = typeof req.query.query === "string" ? req.query.query.trim() : "";
  const usageFilter = typeof req.query.usage === "string" ? req.query.usage : "";
  const area = typeof req.query.area === "string" ? req.query.area : "";
  const cursor = typeof req.query.cursor === "string" ? req.query.cursor : "";
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 40));
  const filters = [eq(mediaAssetsTable.status, "Ready")];
  if (query) filters.push(ilike(mediaAssetsTable.originalFilename, `%${query.replace(/[%_]/g, "\\$&")}%`));
  const rows = await db.select().from(mediaAssetsTable)
    .where(and(...filters))
    .orderBy(desc(mediaAssetsTable.createdAt), desc(mediaAssetsTable.id));
  const usageMap = await usageByAssetId(rows.map((row) => row.id));
  let items = rows.map((row) => toPublicAsset(row, usageMap.get(row.id) ?? emptyUsage()));
  if (usageFilter) items = items.filter((item) => usageBucket(item.usageSummary) === usageFilter);
  if (area === "product" || area === "category" || area === "static") {
    items = items.filter((item) => item.usageSummary[area] > 0);
  }
  let start = 0;
  if (cursor) {
    const index = items.findIndex((item) => item.id === cursor);
    start = index >= 0 ? index + 1 : 0;
  }
  const page = items.slice(start, start + limit);
  const next = items[start + limit];
  res.json({ items: page, nextCursor: next?.id ?? null, staticUsageIndexed: true });
});

router.post("/admin/media/upload-request", async (req, res): Promise<void> => {
  const originalFilename = typeof req.body?.originalFilename === "string" ? req.body.originalFilename.trim() : "";
  const contentType = typeof req.body?.contentType === "string" ? req.body.contentType : "";
  const bytes = Number(req.body?.bytes);
  const digest = typeof req.body?.sha256 === "string" ? req.body.sha256.toLowerCase() : "";
  if (!originalFilename || !ALLOWED_TYPES.has(contentType) || !Number.isInteger(bytes) || bytes < 1 || bytes > MAX_BYTES) {
    res.status(400).json({ error: "Upload a JPEG, PNG, or WebP image up to 12 MB." });
    return;
  }
  if (digest && /^[a-f0-9]{64}$/.test(digest)) {
    const [existing] = await db.select().from(mediaAssetsTable)
      .where(and(eq(mediaAssetsTable.status, "Ready"), eq(mediaAssetsTable.sha256, digest)));
    if (existing) {
      const usage = (await usageByAssetId([existing.id])).get(existing.id) ?? emptyUsage();
      res.status(200).json({
        duplicate: true,
        asset: toPublicAsset(existing, usage),
        assetId: existing.id,
      });
      return;
    }
  }
  const id = randomUUID();
  const stagingPath = mediaObjectPath(id, `original${extensionFor(originalFilename, contentType)}`);
  const [created] = await db.insert(mediaAssetsTable).values({
    id,
    status: "Pending",
    originalFilename,
    contentType: contentType as "image/jpeg" | "image/png" | "image/webp",
    bytes,
    storageKind: "managed",
    objectPath: stagingPath,
    stagingPath,
  }).returning();
  res.status(201).json({
    duplicate: false,
    asset: toPublicAsset(created),
    assetId: id,
    uploadURL: `/api/admin/media/${id}/object`,
    objectPath: stagingPath,
    previewURL: mediaPreviewPath(id),
  });
});

router.put("/admin/media/:id/object", async (req, res): Promise<void> => {
  const id = String(req.params.id ?? "");
  const [asset] = await db.select().from(mediaAssetsTable).where(eq(mediaAssetsTable.id, id));
  if (!asset) {
    res.status(404).json({ error: "Asset not found." });
    return;
  }
  if (asset.status !== "Pending") {
    res.status(400).json({ error: "This image has already been processed." });
    return;
  }
  const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body ?? []);
  if (!body.length || body.length > MAX_BYTES) {
    res.status(400).json({ error: "Images must be between 1 byte and 12 MB." });
    return;
  }
  const stagingPath = asset.stagingPath || mediaObjectPath(id, "original.bin");
  await putStoredFile(stagingPath, body, asset.contentType || "application/octet-stream");
  await db.update(mediaAssetsTable).set({
    bytes: body.length,
    stagingPath,
    updatedAt: new Date(),
  }).where(eq(mediaAssetsTable.id, id));
  res.sendStatus(204);
});

router.post("/admin/media/:id/complete", async (req, res): Promise<void> => {
  const id = String(req.params.id ?? "");
  const [asset] = await db.select().from(mediaAssetsTable).where(eq(mediaAssetsTable.id, id));
  if (!asset) {
    res.status(404).json({ error: "Asset not found." });
    return;
  }
  if (asset.status === "Ready") {
    const usage = (await usageByAssetId([asset.id])).get(asset.id) ?? emptyUsage();
    res.json(toPublicAsset(asset, usage));
    return;
  }
  const stagingPath = asset.stagingPath;
  if (!stagingPath) {
    res.status(400).json({ error: "Upload the image bytes before completing." });
    return;
  }
  const stored = await getStoredFile(stagingPath);
  if (!stored?.bytes?.length) {
    await db.update(mediaAssetsTable).set({
      status: "Failed",
      failureReason: "The uploaded file could not be read.",
      updatedAt: new Date(),
    }).where(eq(mediaAssetsTable.id, id));
    res.status(400).json({ error: "The uploaded file could not be read." });
    return;
  }
  try {
    const converted = await convertToWebp(stored.bytes);
    const digest = sha256(converted.bytes);
    const [duplicate] = await db.select().from(mediaAssetsTable)
      .where(and(eq(mediaAssetsTable.status, "Ready"), eq(mediaAssetsTable.sha256, digest), ne(mediaAssetsTable.id, id)));
    if (duplicate) {
      await removeStoredFile(stagingPath);
      await db.delete(mediaAssetsTable).where(eq(mediaAssetsTable.id, id));
      const usage = (await usageByAssetId([duplicate.id])).get(duplicate.id) ?? emptyUsage();
      res.status(409).json({ error: "Exact duplicate; reuse existing asset", asset: toPublicAsset(duplicate, usage) });
      return;
    }
    const objectPath = mediaObjectPath(id, "image.webp");
    await putStoredFile(objectPath, converted.bytes, "image/webp");
    if (stagingPath !== objectPath) await removeStoredFile(stagingPath);
    const [ready] = await db.update(mediaAssetsTable).set({
      status: "Ready",
      contentType: "image/webp",
      bytes: converted.bytes.length,
      width: converted.width,
      height: converted.height,
      sha256: digest,
      objectPath,
      stagingPath: null,
      failureReason: null,
      updatedAt: new Date(),
    }).where(eq(mediaAssetsTable.id, id)).returning();
    res.json(toPublicAsset(ready));
  } catch (error) {
    const reason = error instanceof Error ? error.message : "The image could not be converted to WebP.";
    await db.update(mediaAssetsTable).set({
      status: "Failed",
      failureReason: reason,
      updatedAt: new Date(),
    }).where(eq(mediaAssetsTable.id, id));
    res.status(400).json({ error: reason });
  }
});

router.post("/admin/media/backfill", async (_req, res): Promise<void> => {
  const result = await backfillMediaUsage();
  res.json({ ok: true, message: `Reconciled media usage for ${result.products} products.` });
});

router.post("/admin/media/:id/attach", async (req, res): Promise<void> => {
  const id = String(req.params.id ?? "");
  const productId = Number(req.body?.productId);
  if (!Number.isInteger(productId) || productId < 1) {
    res.status(400).json({ error: "Choose a product." });
    return;
  }
  const [asset] = await db.select().from(mediaAssetsTable).where(eq(mediaAssetsTable.id, id));
  if (!asset || asset.status !== "Ready") {
    res.status(404).json({ error: "Asset not found or not ready." });
    return;
  }
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, productId));
  if (!product) {
    res.status(404).json({ error: "Product not found." });
    return;
  }
  if (product.publishStatus === "Archived") {
    res.status(409).json({ error: "Restore this product to Draft before attaching an image." });
    return;
  }
  const incoming: ProductPhoto = {
    slot: "Photo 1 · Hero",
    file: asset.originalFilename,
    rating: "",
    src: mediaPublicPath(asset.id),
    assetId: asset.id,
    alt: asset.defaultAlt || undefined,
    role: "hero",
    width: asset.width ?? undefined,
    height: asset.height ?? undefined,
    format: "webp",
    objectPath: asset.objectPath ?? undefined,
  };
  const photos = insertHeroPhoto(product.details?.photos, incoming);
  const details = { ...product.details, photos };
  const updated = await db.transaction(async (tx) => {
    const [saved] = await tx.update(productsTable).set({
      details,
      updatedAt: new Date(),
    }).where(eq(productsTable.id, product.id)).returning();
    await syncProductMediaReferences(saved, photos, tx);
    return saved;
  });
  const usage = (await usageByAssetId([asset.id])).get(asset.id) ?? emptyUsage();
  res.json(toPublicAsset(asset, usage, updated.publishStatus === "Published"));
});

router.get("/admin/media/:id/preview", async (req, res): Promise<void> => {
  const id = String(req.params.id ?? "");
  const [asset] = await db.select().from(mediaAssetsTable).where(eq(mediaAssetsTable.id, id));
  if (!asset || asset.status !== "Ready" || !asset.objectPath) {
    res.status(404).json({ error: "Asset not found or not ready." });
    return;
  }
  const stored = await getStoredFile(asset.objectPath);
  if (!stored) {
    res.status(404).json({ error: "Asset not found or not ready." });
    return;
  }
  res.setHeader("content-type", stored.contentType || "image/webp");
  res.setHeader("cache-control", "private, max-age=60");
  res.send(stored.bytes);
});

router.get("/admin/media/:id", async (req, res): Promise<void> => {
  const [asset] = await db.select().from(mediaAssetsTable).where(eq(mediaAssetsTable.id, String(req.params.id ?? "")));
  if (!asset) {
    res.status(404).json({ error: "Asset not found." });
    return;
  }
  const refs = await db.select().from(mediaReferencesTable).where(eq(mediaReferencesTable.assetId, asset.id));
  const usage = (await usageByAssetId([asset.id])).get(asset.id) ?? emptyUsage();
  res.json({ ...toPublicAsset(asset, usage), usages: refs.map(toPublicReference) });
});

router.patch("/admin/media/:id", async (req, res): Promise<void> => {
  const [asset] = await db.select().from(mediaAssetsTable).where(eq(mediaAssetsTable.id, req.params.id));
  if (!asset) {
    res.status(404).json({ error: "Asset not found." });
    return;
  }
  const defaultAlt = typeof req.body?.defaultAlt === "string" ? req.body.defaultAlt.slice(0, 300) : asset.defaultAlt;
  const defaultCaption = typeof req.body?.defaultCaption === "string" ? req.body.defaultCaption.slice(0, 300) : asset.defaultCaption;
  const [updated] = await db.update(mediaAssetsTable).set({
    defaultAlt,
    defaultCaption,
    updatedAt: new Date(),
  }).where(eq(mediaAssetsTable.id, asset.id)).returning();
  const usage = (await usageByAssetId([updated.id])).get(updated.id) ?? emptyUsage();
  res.json(toPublicAsset(updated, usage));
});

router.delete("/admin/media/:id", async (req, res): Promise<void> => {
  if (req.body?.confirm !== true) {
    res.status(400).json({ error: "Confirmation required." });
    return;
  }
  const [asset] = await db.select().from(mediaAssetsTable).where(eq(mediaAssetsTable.id, req.params.id));
  if (!asset) {
    res.status(404).json({ error: "Asset not found." });
    return;
  }
  const refs = await db.select().from(mediaReferencesTable).where(eq(mediaReferencesTable.assetId, asset.id));
  if (refs.length) {
    res.status(409).json({ error: "Asset is still in use.", usages: refs.map(toPublicReference) });
    return;
  }
  if (asset.objectPath) await removeStoredFile(asset.objectPath);
  if (asset.stagingPath) await removeStoredFile(asset.stagingPath);
  await db.delete(mediaAssetsTable).where(eq(mediaAssetsTable.id, asset.id));
  res.sendStatus(204);
});

router.get("/media/:id", async (req, res): Promise<void> => {
  const [asset] = await db.select().from(mediaAssetsTable).where(eq(mediaAssetsTable.id, req.params.id));
  if (!asset || asset.status !== "Ready" || !asset.objectPath) {
    res.status(404).json({ error: "Asset not published or not found." });
    return;
  }
  const [published] = await db.select({ id: mediaReferencesTable.id }).from(mediaReferencesTable)
    .where(and(eq(mediaReferencesTable.assetId, asset.id), eq(mediaReferencesTable.usageState, "Published")))
    .limit(1);
  if (!published) {
    res.status(404).json({ error: "Asset not published or not found." });
    return;
  }
  const stored = await getStoredFile(asset.objectPath);
  if (!stored) {
    res.status(404).json({ error: "Asset not published or not found." });
    return;
  }
  res.setHeader("content-type", stored.contentType || "image/webp");
  res.setHeader("cache-control", "public, max-age=86400");
  res.send(stored.bytes);
});

export default router;
