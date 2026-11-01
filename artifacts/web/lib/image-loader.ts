import type { ImageLoaderProps } from "next/image";

/**
 * Widths the image optimiser will produce. Kept short on purpose: every
 * width is a separate version the server has to make on first request, so
 * fewer widths means more visitors get an already-made copy.
 * Must match `images.deviceSizes` / `images.imageSizes` in next.config.mjs.
 */
export const IMAGE_DEVICE_SIZES = [640, 828, 1200, 1600, 2048];
export const IMAGE_SMALL_SIZES = [96, 128, 256, 384];
export const IMAGE_QUALITY = 75;

/** Library card copies are stored 800px wide; 828 is the nearest allowed width. */
export const CARD_MAX_WIDTH = 828;
/** Full library copies are stored at most 1600px wide. */
export const FULL_MAX_WIDTH = 1600;

/** The widest copy worth asking for, or undefined when the source size is unknown. */
export function sourceMaxWidth(src: string): number | undefined {
  const query = new URLSearchParams(src.split("?")[1] ?? "");
  if (src.includes("/api/media/")) return query.get("size") === "card" ? CARD_MAX_WIDTH : FULL_MAX_WIDTH;
  // Built-in Unsplash placeholders state their width; use the nearest allowed width at or above it.
  const stated = src.startsWith("https://images.unsplash.com/") ? Number(query.get("w")) : NaN;
  if (stated > 0) return IMAGE_DEVICE_SIZES.find((size) => size >= stated);
  return undefined;
}

/**
 * The optimiser never enlarges, so asking for more than the stored copy
 * returns the same picture under a new cache entry. Cap the width so every
 * larger screen shares one copy.
 */
export function cappedWidth(src: string, width: number) {
  const max = sourceMaxWidth(src);
  return max !== undefined && width > max ? max : width;
}

export function optimisedImageUrl(src: string, width: number, quality = IMAGE_QUALITY) {
  return `/_next/image?url=${encodeURIComponent(src)}&w=${cappedWidth(src, width)}&q=${quality}`;
}

export function cappedImageLoader({ src, width, quality }: ImageLoaderProps) {
  return optimisedImageUrl(src, width, quality ?? IMAGE_QUALITY);
}
