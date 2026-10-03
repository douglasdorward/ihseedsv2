import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, mediaAssetsTable } from "@workspace/db";
import { getStoredFile, putStoredFile, removeStoredFile } from "./app-storage";
import { convertMediaVariants, isRefineCandidate, mediaVariantObjectPath } from "./media-image";

export type RefineMediaResult = {
  refined: number;
  skipped: number;
  failed: number;
};

function sha256(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function refineReadyMediaAssets(): Promise<RefineMediaResult> {
  const assets = await db.select().from(mediaAssetsTable).where(eq(mediaAssetsTable.status, "Ready"));
  let refined = 0;
  let skipped = 0;
  let failed = 0;
  for (const asset of assets) {
    if (!isRefineCandidate(asset) || !asset.objectPath) {
      skipped += 1;
      continue;
    }
    const sourcePath = asset.objectPath;
    try {
      const stored = await getStoredFile(sourcePath);
      if (!stored?.bytes?.length) {
        skipped += 1;
        continue;
      }
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
      refined += 1;
    } catch {
      failed += 1;
    }
  }
  return { refined, skipped, failed };
}
