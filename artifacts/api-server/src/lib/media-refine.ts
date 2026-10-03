import { createHash } from "node:crypto";
import { and, asc, count, eq, gt, lte } from "drizzle-orm";
import { db, mediaAssetsTable } from "@workspace/db";
import { getStoredFile, putStoredFile, removeStoredFile } from "./app-storage";
import { logger } from "./logger";
import { convertMediaVariants, isRefineCandidate, mediaVariantObjectPath } from "./media-image";

export const REFINE_BATCH_DEFAULT = 5;
export const REFINE_BATCH_MAX = 25;

export type RefineMediaBatchResult = {
  /** Counts for this batch only. */
  refined: number;
  skipped: number;
  failed: number;
  /** Ready assets up to and including this batch, in id order. */
  processed: number;
  /** All Ready assets at the time of this batch. */
  total: number;
  /** Pass back as `after` to continue; null once the library is finished. */
  nextCursor: string | null;
  done: boolean;
};

function sha256(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

type MediaAssetRow = typeof mediaAssetsTable.$inferSelect;

async function refineAsset(asset: MediaAssetRow): Promise<"refined" | "skipped" | "failed"> {
  if (!isRefineCandidate(asset) || !asset.objectPath) return "skipped";
  const sourcePath = asset.objectPath;
  try {
    const stored = await getStoredFile(sourcePath);
    if (!stored?.bytes?.length) return "skipped";
    const variants = await convertMediaVariants(stored.bytes);
    const objectPath = mediaVariantObjectPath(asset.id, "full");
    await putStoredFile(objectPath, variants.full.bytes, "image/webp");
    await putStoredFile(mediaVariantObjectPath(asset.id, "card"), variants.card.bytes, "image/webp");
    if (sourcePath !== objectPath) await removeStoredFile(sourcePath);
    await db.update(mediaAssetsTable).set({
      contentType: "image/webp",
      bytes: variants.full.bytes.length,
      width: variants.full.width,
      height: variants.full.height,
      sha256: sha256(variants.full.bytes),
      objectPath,
      updatedAt: new Date(),
    }).where(eq(mediaAssetsTable.id, asset.id));
    return "refined";
  } catch (error) {
    logger.warn({ err: error, assetId: asset.id }, "Media refine failed for asset");
    return "failed";
  }
}

/**
 * Refines one bounded batch of Ready library assets, walking them in id order
 * so successive batches never repeat or skip an asset. Callers loop on
 * `nextCursor` until `done`, which keeps each request short and lets the admin
 * screen report progress.
 */
export async function refineReadyMediaAssetBatch(
  { after, limit = REFINE_BATCH_DEFAULT }: { after?: string | null; limit?: number } = {},
): Promise<RefineMediaBatchResult> {
  const ready = eq(mediaAssetsTable.status, "Ready");
  const batch = await db.select().from(mediaAssetsTable)
    .where(after ? and(ready, gt(mediaAssetsTable.id, after)) : ready)
    .orderBy(asc(mediaAssetsTable.id))
    .limit(limit + 1);
  const hasMore = batch.length > limit;
  const assets = hasMore ? batch.slice(0, limit) : batch;

  let refined = 0;
  let skipped = 0;
  let failed = 0;
  for (const asset of assets) {
    const outcome = await refineAsset(asset);
    if (outcome === "refined") refined += 1;
    else if (outcome === "skipped") skipped += 1;
    else failed += 1;
  }

  const lastId = assets.at(-1)?.id ?? after ?? null;
  const [[totalRow], [processedRow]] = await Promise.all([
    db.select({ value: count() }).from(mediaAssetsTable).where(ready),
    lastId
      ? db.select({ value: count() }).from(mediaAssetsTable).where(and(ready, lte(mediaAssetsTable.id, lastId)))
      : Promise.resolve([{ value: 0 }]),
  ]);
  const total = Number(totalRow?.value ?? 0);
  const processed = hasMore ? Number(processedRow?.value ?? 0) : total;

  return {
    refined,
    skipped,
    failed,
    processed,
    total,
    nextCursor: hasMore ? lastId : null,
    done: !hasMore,
  };
}
