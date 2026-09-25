import { createHash, randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import { and, desc, eq, ilike, inArray, ne } from "drizzle-orm";
import {
  articlesTable,
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
import { imageAltFromContext, resolveImageAlt, shouldReplaceGeneratedAlt } from "../lib/image-alt";
import { convertToWebp } from "../lib/media-image";
import { backfillMediaUsage, insertHeroPhoto, isProtectedMediaReference, syncArticleMediaReferences, syncProductMediaReferences, unlinkAndDeleteMediaRecords } from "../lib/media-usage";

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
  article: number;
  reseller: number;
  protected: number;
};

const emptyUsage = (): UsageSummary => ({
  total: 0, draft: 0, published: 0, product: 0, category: 0, static: 0, article: 0, reseller: 0, protected: 0,
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
    if (ref.ownerType === "article") usage.article += 1;
    if (ref.ownerType === "reseller") usage.reseller += 1;
    if (isProtectedMediaReference(ref)) usage.protected += 1;
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

function ownerContextFromBody(body: unknown) {
  const record = body && typeof body === "object" ? body as { ownerName?: unknown; role?: unknown } : {};
  return {
    ownerName: typeof record.ownerName === "string" ? record.ownerName : "",
    role: typeof record.role === "string" ? record.role : "",
  };
}

async function fillBlankDefaultAlt(
  asset: MediaAsset,
  context: { ownerName?: string; filename?: string; role?: string } = {},
): Promise<MediaAsset> {
  if (asset.defaultAlt.trim()) return asset;
  const defaultAlt = resolveImageAlt({
    currentAlt: asset.defaultAlt,
    ownerName: context.ownerName,
    filename: context.filename || asset.originalFilename,
    role: context.role,
  });
  if (!defaultAlt) return asset;
  const [updated] = await db.update(mediaAssetsTable).set({
    defaultAlt,
    updatedAt: new Date(),
  }).where(eq(mediaAssetsTable.id, asset.id)).returning();
  return updated ?? asset;
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
  if (area === "product" || area === "category" || area === "static" || area === "article" || area === "reseller") {
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
      const filled = await fillBlankDefaultAlt(existing, { filename: originalFilename });
      const usage = (await usageByAssetId([filled.id])).get(filled.id) ?? emptyUsage();
      res.status(200).json({
        duplicate: true,
        asset: toPublicAsset(filled, usage),
        assetId: filled.id,
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
  try {
    await putStoredFile(stagingPath, body, asset.contentType || "application/octet-stream");
  } catch (error) {
    await db.delete(mediaAssetsTable).where(eq(mediaAssetsTable.id, id));
    req.log.error({ err: error, assetId: id }, "Image storage upload failed");
    res.status(503).json({ error: "Image storage is temporarily unavailable. Please try the upload again." });
    return;
  }
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
      const context = ownerContextFromBody(req.body);
      const filled = await fillBlankDefaultAlt(duplicate, {
        ownerName: context.ownerName,
        filename: asset.originalFilename,
        role: context.role,
      });
      const usage = (await usageByAssetId([filled.id])).get(filled.id) ?? emptyUsage();
      res.status(409).json({ error: "Exact duplicate; reuse existing asset", asset: toPublicAsset(filled, usage) });
      return;
    }
    const objectPath = mediaObjectPath(id, "image.webp");
    await putStoredFile(objectPath, converted.bytes, "image/webp");
    if (stagingPath !== objectPath) await removeStoredFile(stagingPath);
    const context = ownerContextFromBody(req.body);
    const defaultAlt = resolveImageAlt({
      currentAlt: asset.defaultAlt,
      ownerName: context.ownerName,
      filename: asset.originalFilename,
      role: context.role,
    });
    const [ready] = await db.update(mediaAssetsTable).set({
      status: "Ready",
      contentType: "image/webp",
      bytes: converted.bytes.length,
      width: converted.width,
      height: converted.height,
      sha256: digest,
      defaultAlt,
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

const BULK_DELETE_LIMIT = 100;

async function deleteAssetsAndFiles(ids: string[]) {
  const deleted = await unlinkAndDeleteMediaRecords(ids);
  for (const asset of deleted) {
    if (asset.objectPath) await removeStoredFile(asset.objectPath);
    if (asset.stagingPath) await removeStoredFile(asset.stagingPath);
  }
  return deleted;
}

function confirmedIds(body: unknown, fallbackId?: string) {
  if (!body || typeof body !== "object" || (body as { confirm?: unknown }).confirm !== true) return { error: "Confirmation required." as const };
  if (fallbackId) return { ids: [fallbackId] };
  const ids = (body as { ids?: unknown }).ids;
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > BULK_DELETE_LIMIT) {
    return { error: `Choose between 1 and ${BULK_DELETE_LIMIT} images.` as const };
  }
  const unique = [...new Set(ids.map((id) => typeof id === "string" ? id.trim() : "").filter(Boolean))];
  if (!unique.length) return { error: `Choose between 1 and ${BULK_DELETE_LIMIT} images.` as const };
  return { ids: unique };
}

router.post("/admin/media/bulk-delete", async (req, res): Promise<void> => {
  const parsed = confirmedIds(req.body);
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  await deleteAssetsAndFiles(parsed.ids);
  res.sendStatus(204);
});

function attachTargetId(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const id = Number(value);
  return Number.isInteger(id) && id >= 1 ? id : Number.NaN;
}

/** Exactly one of productId or articleId. Returns the chosen target, or null when the body is invalid. */
function attachTarget(body: unknown) {
  const record = body && typeof body === "object" ? body as { productId?: unknown; articleId?: unknown } : {};
  const productId = attachTargetId(record.productId);
  const articleId = attachTargetId(record.articleId);
  if (productId === null && articleId === null) return null;
  if (productId !== null && articleId !== null) return null;
  if (productId !== null) return Number.isNaN(productId) ? null : { kind: "product" as const, id: productId };
  return Number.isNaN(articleId as number) ? null : { kind: "article" as const, id: articleId as number };
}

router.post("/admin/media/:id/attach", async (req, res): Promise<void> => {
  const id = String(req.params.id ?? "");
  const target = attachTarget(req.body);
  if (!target) {
    res.status(400).json({ error: "Choose a product or an article." });
    return;
  }
  const [asset] = await db.select().from(mediaAssetsTable).where(eq(mediaAssetsTable.id, id));
  if (!asset || asset.status !== "Ready") {
    res.status(404).json({ error: "Asset not found or not ready." });
    return;
  }
  if (target.kind === "article") {
    const [article] = await db.select().from(articlesTable).where(eq(articlesTable.id, target.id));
    if (!article) {
      res.status(404).json({ error: "Article not found." });
      return;
    }
    const nextDefaultAlt = shouldReplaceGeneratedAlt(asset.defaultAlt, asset.originalFilename)
      ? imageAltFromContext({ ownerName: article.title, filename: asset.originalFilename, role: "hero" })
      : asset.defaultAlt;
    const updatedArticle = await db.transaction(async (tx) => {
      const [saved] = await tx.update(articlesTable).set({
        heroImageSrc: mediaPublicPath(asset.id),
        heroImageAssetId: asset.id,
        updatedAt: new Date(),
      }).where(eq(articlesTable.id, article.id)).returning();
      if (nextDefaultAlt !== asset.defaultAlt) {
        await tx.update(mediaAssetsTable).set({
          defaultAlt: nextDefaultAlt,
          updatedAt: new Date(),
        }).where(eq(mediaAssetsTable.id, asset.id));
      }
      await syncArticleMediaReferences(saved, tx);
      return saved;
    });
    const usage = (await usageByAssetId([asset.id])).get(asset.id) ?? emptyUsage();
    res.json(toPublicAsset({ ...asset, defaultAlt: nextDefaultAlt }, usage, updatedArticle.publishStatus === "Published"));
    return;
  }
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, target.id));
  if (!product) {
    res.status(404).json({ error: "Product not found." });
    return;
  }
  if (product.publishStatus === "Archived") {
    res.status(409).json({ error: "Restore this product to Draft before attaching an image." });
    return;
  }
  const photoAlt = resolveImageAlt({
    currentAlt: asset.defaultAlt,
    ownerName: product.name,
    filename: asset.originalFilename,
    role: "hero",
  });
  const incoming: ProductPhoto = {
    slot: "Photo 1 · Hero",
    file: asset.originalFilename,
    rating: "",
    src: mediaPublicPath(asset.id),
    assetId: asset.id,
    alt: photoAlt || undefined,
    role: "hero",
    width: asset.width ?? undefined,
    height: asset.height ?? undefined,
    format: "webp",
    objectPath: asset.objectPath ?? undefined,
  };
  const photos = insertHeroPhoto(product.details?.photos, incoming);
  const details = { ...product.details, photos };
  const nextDefaultAlt = shouldReplaceGeneratedAlt(asset.defaultAlt, asset.originalFilename)
    ? imageAltFromContext({ ownerName: product.name, filename: asset.originalFilename, role: "hero" })
    : asset.defaultAlt;
  const updated = await db.transaction(async (tx) => {
    const [saved] = await tx.update(productsTable).set({
      details,
      updatedAt: new Date(),
    }).where(eq(productsTable.id, product.id)).returning();
    if (nextDefaultAlt !== asset.defaultAlt) {
      await tx.update(mediaAssetsTable).set({
        defaultAlt: nextDefaultAlt,
        updatedAt: new Date(),
      }).where(eq(mediaAssetsTable.id, asset.id));
    }
    await syncProductMediaReferences(saved, photos, tx);
    return saved;
  });
  const usage = (await usageByAssetId([asset.id])).get(asset.id) ?? emptyUsage();
  res.json(toPublicAsset({ ...asset, defaultAlt: nextDefaultAlt }, usage, updated.publishStatus === "Published"));
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
  const parsed = confirmedIds(req.body, String(req.params.id ?? ""));
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const deleted = await deleteAssetsAndFiles(parsed.ids);
  if (!deleted.length) {
    res.status(404).json({ error: "Asset not found." });
    return;
  }
  res.sendStatus(204);
});

router.get("/media/:id", async (req, res): Promise<void> => {
  const id = String(req.params.id ?? "");
  const [asset] = await db.select().from(mediaAssetsTable).where(eq(mediaAssetsTable.id, id));
  if (!asset || asset.status !== "Ready" || !asset.objectPath) {
    const orphanKey = /^[a-zA-Z0-9-]{8,80}$/.test(id) ? mediaObjectPath(id, "image.webp") : "";
    const orphan = orphanKey ? await getStoredFile(orphanKey) : null;
    if (orphan) {
      res.setHeader("content-type", orphan.contentType || "image/webp");
      res.setHeader("cache-control", "public, max-age=86400");
      res.send(orphan.bytes);
      return;
    }
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
