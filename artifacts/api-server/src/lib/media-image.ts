import sharp from "sharp";
import { getStoredFile, mediaObjectPath } from "./app-storage";

export const FULL_MAX_EDGE = 1600;
export const CARD_MAX_EDGE = 800;
export const FULL_WEBP_QUALITY = 75;
export const CARD_WEBP_QUALITY = 72;
export const PUBLIC_MEDIA_CACHE_CONTROL = "public, max-age=604800";

export type ConvertedWebp = {
  bytes: Buffer;
  width: number;
  height: number;
  contentType: "image/webp";
};

export type MediaVariantSize = "card" | "full";

export type MediaVariants = {
  full: ConvertedWebp;
  card: ConvertedWebp;
};

function resizeOptions(width: number, height: number, maxEdge: number) {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return null;
  return {
    width: width >= height ? maxEdge : undefined,
    height: height > width ? maxEdge : undefined,
    fit: "inside" as const,
    withoutEnlargement: true,
  };
}

async function encodeWebp(input: Buffer, maxEdge: number, quality: number): Promise<ConvertedWebp> {
  const image = sharp(input, { failOn: "error" }).rotate();
  const meta = await image.metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (!width || !height) throw new Error("The image has no dimensions.");
  const resize = resizeOptions(width, height, maxEdge);
  const pipeline = resize ? image.resize(resize) : image;
  const bytes = await pipeline.webp({ quality }).toBuffer();
  const out = await sharp(bytes).metadata();
  return {
    bytes,
    width: out.width ?? width,
    height: out.height ?? height,
    contentType: "image/webp",
  };
}

export async function convertToWebp(input: Buffer): Promise<ConvertedWebp> {
  return encodeWebp(input, FULL_MAX_EDGE, FULL_WEBP_QUALITY);
}

export async function convertMediaVariants(input: Buffer): Promise<MediaVariants> {
  const full = await encodeWebp(input, FULL_MAX_EDGE, FULL_WEBP_QUALITY);
  const card = await encodeWebp(input, CARD_MAX_EDGE, CARD_WEBP_QUALITY);
  return { full, card };
}

export function mediaVariantObjectPath(id: string, size: MediaVariantSize) {
  return mediaObjectPath(id, size === "card" ? "card.webp" : "image.webp");
}

export function requestedMediaSize(value: unknown): MediaVariantSize {
  return value === "card" ? "card" : "full";
}

/**
 * Bump when the stored variant format changes (sizes, quality, new variants),
 * so "Refine existing images" offers to bring older assets up to date.
 * Version 1: 1600px full WebP plus an 800px card WebP.
 */
export const MEDIA_VARIANTS_VERSION = 1;

export function isRefineCandidate(asset: { status: string; objectPath: string | null }) {
  return asset.status === "Ready" && Boolean(asset.objectPath);
}

export function needsRefine(asset: { status: string; objectPath: string | null; variantsVersion: number }) {
  return isRefineCandidate(asset) && asset.variantsVersion < MEDIA_VARIANTS_VERSION;
}

export async function storedMediaVariant(
  asset: { id: string; objectPath?: string | null },
  size: MediaVariantSize,
) {
  if (size === "card") {
    const card = await getStoredFile(mediaVariantObjectPath(asset.id, "card"));
    if (card) return card;
  }
  if (asset.objectPath) return getStoredFile(asset.objectPath);
  return getStoredFile(mediaVariantObjectPath(asset.id, "full"));
}
