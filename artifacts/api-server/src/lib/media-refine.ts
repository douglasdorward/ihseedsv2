import { createHash } from "node:crypto";
import { and, asc, count, eq, gt, isNotNull, lt, type SQL } from "drizzle-orm";
import { db, mediaAssetsTable } from "@workspace/db";
import { getStoredFile, putStoredFile, removeStoredFile, storedFileExists } from "./app-storage";
import { logger } from "./logger";
import {
  CARD_MAX_EDGE,
  CARD_WEBP_QUALITY,
  convertMediaVariants,
  FULL_MAX_EDGE,
  MEDIA_VARIANTS_VERSION,
  mediaVariantObjectPath,
} from "./media-image";
import sharp from "sharp";

export const REFINE_BATCH_DEFAULT = 5;
export const REFINE_BATCH_MAX = 25;

export type RefineMediaBatchResult = {
  /** Counts for this batch only. */
  refined: number;
  /** Files were already current; the asset was stamped without re-encoding. */
  upToDate: number;
  /** No stored file to work from; left as it is. */
  skipped: number;
  failed: number;
  /** Assets still needing refinement after this batch's cursor. */
  remaining: number;
  /** Pass back as `after` to continue; null once the library is finished. */
  nextCursor: string | null;
  done: boolean;
};

type RefineOutcome = "refined" | "upToDate" | "skipped" | "failed";
type MediaAssetRow = typeof mediaAssetsTable.$inferSelect;

function sha256(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Ready assets with a stored file whose variants are older than the current version. */
function needsRefineWhere(after?: string | null): SQL {
  const base = and(
    eq(mediaAssetsTable.status, "Ready"),
    isNotNull(mediaAssetsTable.objectPath),
    lt(mediaAssetsTable.variantsVersion, MEDIA_VARIANTS_VERSION),
  )!;
  return after ? and(base, gt(mediaAssetsTable.id, after))! : base;
}

export async function countMediaNeedingRefine(): Promise<number> {
  const [row] = await db.select({ value: count() }).from(mediaAssetsTable).where(needsRefineWhere());
  return Number(row?.value ?? 0);
}

function stamp(assetId: string, values: Partial<MediaAssetRow> = {}) {
  return db.update(mediaAssetsTable)
    .set({ ...values, variantsVersion: MEDIA_VARIANTS_VERSION, updatedAt: new Date() })
    .where(eq(mediaAssetsTable.id, assetId));
}

/** The full image is already a current-size WebP at its standard path. */
function fullIsCurrent(asset: MediaAssetRow) {
  return asset.objectPath === mediaVariantObjectPath(asset.id, "full")
    && asset.contentType === "image/webp"
    && Boolean(asset.width && asset.height)
    && Math.max(asset.width ?? 0, asset.height ?? 0) <= FULL_MAX_EDGE;
}

async function refineAsset(asset: MediaAssetRow): Promise<RefineOutcome> {
  if (asset.status !== "Ready" || !asset.objectPath) return "skipped";
  const sourcePath = asset.objectPath;
  const cardPath = mediaVariantObjectPath(asset.id, "card");
  try {
    // Already-current files are never re-encoded, so refining twice does not
    // lose quality. A missing card is made from the current full image.
    if (fullIsCurrent(asset)) {
      if (await storedFileExists(cardPath)) {
        await stamp(asset.id);
        return "upToDate";
      }
      const stored = await getStoredFile(sourcePath);
      if (!stored?.bytes?.length) return "skipped";
      const card = await sharp(stored.bytes, { failOn: "error" })
        .resize({ width: CARD_MAX_EDGE, height: CARD_MAX_EDGE, fit: "inside", withoutEnlargement: true })
        .webp({ quality: CARD_WEBP_QUALITY })
        .toBuffer();
      await putStoredFile(cardPath, card, "image/webp");
      await stamp(asset.id);
      return "refined";
    }

    const stored = await getStoredFile(sourcePath);
    if (!stored?.bytes?.length) return "skipped";
    const variants = await convertMediaVariants(stored.bytes);
    const objectPath = mediaVariantObjectPath(asset.id, "full");
    await putStoredFile(objectPath, variants.full.bytes, "image/webp");
    await putStoredFile(cardPath, variants.card.bytes, "image/webp");
    if (sourcePath !== objectPath) await removeStoredFile(sourcePath);
    await stamp(asset.id, {
      contentType: "image/webp",
      bytes: variants.full.bytes.length,
      width: variants.full.width,
      height: variants.full.height,
      sha256: sha256(variants.full.bytes),
      objectPath,
    });
    return "refined";
  } catch (error) {
    logger.warn({ err: error, assetId: asset.id }, "Media refine failed for asset");
    return "failed";
  }
}

/**
 * Refines one bounded batch of assets that still need it, walking them in id
 * order so successive batches never repeat or skip an asset (skipped and
 * failed assets stay behind the cursor for a later run). Callers loop on
 * `nextCursor` until `done`, which keeps each request short and lets the admin
 * screen report progress.
 */
export async function refineReadyMediaAssetBatch(
  { after, limit = REFINE_BATCH_DEFAULT }: { after?: string | null; limit?: number } = {},
): Promise<RefineMediaBatchResult> {
  const batch = await db.select().from(mediaAssetsTable)
    .where(needsRefineWhere(after))
    .orderBy(asc(mediaAssetsTable.id))
    .limit(limit + 1);
  const hasMore = batch.length > limit;
  const assets = hasMore ? batch.slice(0, limit) : batch;

  const counts = { refined: 0, upToDate: 0, skipped: 0, failed: 0 };
  for (const asset of assets) {
    counts[await refineAsset(asset)] += 1;
  }

  const lastId = assets.at(-1)?.id ?? after ?? null;
  let remaining = 0;
  if (hasMore) {
    const [row] = await db.select({ value: count() }).from(mediaAssetsTable).where(needsRefineWhere(lastId));
    remaining = Number(row?.value ?? 0);
  }

  return {
    ...counts,
    remaining,
    nextCursor: hasMore ? lastId : null,
    done: !hasMore,
  };
}
