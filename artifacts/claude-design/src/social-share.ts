export type SocialImageSource = "override" | "hero" | "site" | "default";

export const SOCIAL_IMAGE_WIDTH = 1200;
export const SOCIAL_IMAGE_HEIGHT = 630;
export const APPLE_TOUCH_ICON = "/apple-touch-icon.png";
export const PUBLIC_DEFAULT_SOCIAL_IMAGE = "/social-share-default.jpg";

export function socialSourceLabel(source: SocialImageSource, kind: "product" | "article" = "product"): string {
  switch (source) {
    case "override": return "Custom sharing image";
    case "hero": return kind === "article" ? "Article hero image" : "First product photo";
    case "site": return "Site-wide sharing image (Site settings)";
    default: return "IH Seeds default sharing image";
  }
}

/** Describes the site-wide image state for the Site settings editor. */
export function siteSocialState(src: string | null | undefined, assetId: string | null | undefined): "asset" | "url" | "default" {
  if (assetId?.trim()) return "asset";
  if (src?.trim()) return "url";
  return "default";
}

export function siteSocialPreviewSrc(src: string | null | undefined, assetId: string | null | undefined): string {
  const id = assetId?.trim();
  if (id) return `/api/admin/media/${id}/preview`;
  return src?.trim() || PUBLIC_DEFAULT_SOCIAL_IMAGE;
}

/** Warns when an uploaded image is far from the 1200x630 guide. */
export function socialDimensionWarning(width?: number, height?: number): string {
  if (!width || !height) return "";
  if (width < SOCIAL_IMAGE_WIDTH || height < SOCIAL_IMAGE_HEIGHT) {
    return `This image is ${width}×${height}px. Use at least ${SOCIAL_IMAGE_WIDTH}×${SOCIAL_IMAGE_HEIGHT}px so it stays sharp when shared.`;
  }
  const ratio = width / height;
  if (Math.abs(ratio - SOCIAL_IMAGE_WIDTH / SOCIAL_IMAGE_HEIGHT) > 0.15) {
    return `This image is ${width}×${height}px. Share previews crop to about 1.91:1, so the edges may be cut off.`;
  }
  return "";
}
