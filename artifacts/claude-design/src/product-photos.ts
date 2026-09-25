export const PRODUCT_PHOTO_SLOTS = [
  { slot: "Photo 1 · Hero", role: "hero" },
  { slot: "Photo 2", role: "gallery" },
  { slot: "Photo 3", role: "gallery" },
] as const;

type SlotRole = (typeof PRODUCT_PHOTO_SLOTS)[number]["role"];

/** Loose shape so both the generated ProductPhoto and local test objects fit. Slot assignment rewrites role anyway. */
type SlotPhoto = {
  slot: string;
  file: string;
  rating: string;
  src: string;
  role?: string;
  assetId?: string | null;
};

export function productPhotoFilled(photo: { src?: string; assetId?: string | null } | undefined) {
  return Boolean(photo?.src?.trim() || photo?.assetId?.trim());
}

export function productPhotoFilledIndex(photos: Array<{ src?: string; assetId?: string | null }>, index: number) {
  if (!productPhotoFilled(photos[index])) return -1;
  return photos.slice(0, index + 1).filter(productPhotoFilled).length - 1;
}

function assigned<T extends SlotPhoto>(filled: T[]): T[] {
  return PRODUCT_PHOTO_SLOTS.map((meta, index) => {
    const photo = filled[index];
    const role: SlotRole = meta.role;
    if (!photo) {
      return { slot: meta.slot, file: "", rating: "", src: "", role } as T;
    }
    return { ...photo, slot: meta.slot, role };
  });
}

export function removeProductPhoto<T extends SlotPhoto>(photos: T[], index: number): T[] {
  const filled = photos.filter(productPhotoFilled);
  const target = photos[index];
  if (!productPhotoFilled(target)) return assigned(filled);
  return assigned(filled.filter((photo) => photo !== target));
}

export function moveProductPhoto<T extends SlotPhoto>(photos: T[], index: number, direction: -1 | 1): T[] {
  const filled = photos.filter(productPhotoFilled);
  const from = filled.indexOf(photos[index] as T);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= filled.length) return assigned(filled);
  const next = filled.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return assigned(next);
}
