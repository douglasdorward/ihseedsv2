import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  mediaReferencesTable,
  productsTable,
  type Product,
  type ProductPhoto,
} from "@workspace/db";

type DbLike = Pick<typeof db, "delete" | "insert" | "select">;

const PHOTO_SLOTS: Array<{ slot: string; role: NonNullable<ProductPhoto["role"]> }> = [
  { slot: "Photo 1 · Hero", role: "hero" },
  { slot: "Photo 2", role: "gallery" },
  { slot: "Photo 3", role: "gallery" },
];

export function photoSlotFilled(photo: ProductPhoto | undefined) {
  return Boolean(photo?.src?.trim() || photo?.assetId);
}

export function insertHeroPhoto(photos: ProductPhoto[] | undefined, incoming: ProductPhoto): ProductPhoto[] {
  const incomingId = incoming.assetId?.trim();
  const incomingSrc = incoming.src?.trim();
  const filled = (photos ?? []).filter((photo) => {
    if (!photoSlotFilled(photo)) return false;
    if (incomingId && photo.assetId?.trim() === incomingId) return false;
    if (!incomingId && incomingSrc && photo.src?.trim() === incomingSrc) return false;
    return true;
  });
  const shifted = [incoming, ...filled].slice(0, 3);
  return PHOTO_SLOTS.map((meta, index) => {
    const photo = shifted[index];
    if (!photo) return { slot: meta.slot, file: "", rating: "", src: "", role: meta.role };
    return { ...photo, slot: meta.slot, role: meta.role, rating: photo.rating ?? "" };
  });
}

export function mediaUsageState(publishStatus: string): "Draft" | "Published" {
  return publishStatus === "Published" ? "Published" : "Draft";
}

export async function syncProductMediaReferences(
  product: Pick<Product, "id" | "name" | "publishStatus">,
  photos: ProductPhoto[] | undefined,
  tx: DbLike = db,
) {
  const ownerId = String(product.id);
  await tx.delete(mediaReferencesTable).where(and(
    eq(mediaReferencesTable.ownerType, "product"),
    eq(mediaReferencesTable.ownerId, ownerId),
  ));
  const rows = (photos ?? [])
    .map((photo, index) => {
      const assetId = photo.assetId?.trim();
      if (!assetId) return null;
      return {
        assetId,
        ownerType: "product" as const,
        ownerId,
        ownerName: product.name,
        field: `details.photos[${index}]`,
        role: photo.role || (index === 0 ? "hero" : photo.slot || ""),
        usageState: mediaUsageState(product.publishStatus),
        editPath: `/admin/products/${product.id}`,
        metadata: { slot: photo.slot, index },
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
  if (rows.length) await tx.insert(mediaReferencesTable).values(rows);
}

export async function clearProductMediaReferences(productId: number, tx: DbLike = db) {
  await tx.delete(mediaReferencesTable).where(and(
    eq(mediaReferencesTable.ownerType, "product"),
    eq(mediaReferencesTable.ownerId, String(productId)),
  ));
}

export async function backfillMediaUsage() {
  const products = await db.select({
    id: productsTable.id,
    name: productsTable.name,
    publishStatus: productsTable.publishStatus,
    details: productsTable.details,
  }).from(productsTable);
  const ids = products.map((product) => String(product.id));
  if (ids.length) {
    await db.delete(mediaReferencesTable).where(and(
      eq(mediaReferencesTable.ownerType, "product"),
      inArray(mediaReferencesTable.ownerId, ids),
    ));
  }
  for (const product of products) {
    await syncProductMediaReferences(product, product.details?.photos);
  }
  return { products: products.length };
}
