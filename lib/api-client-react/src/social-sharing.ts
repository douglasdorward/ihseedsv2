export const DEFAULT_SOCIAL_IMAGE = "/social-share-default.jpg";

/** Only browser-safe public image URLs; previews and metadata share this resolver. */
function imageSource(value?: string | null): string {
  const src = value?.trim() || "";
  if (/^\/(?![\\/])/.test(src)) return src;
  try {
    const url = new URL(src);
    return ["https:", "http:"].includes(url.protocol) ? src : "";
  } catch {
    return "";
  }
}

export function resolveSocialImage(input: {
  override?: string | null;
  hero?: string | null;
  siteImage?: string | null;
  siteAssetId?: string | null;
}): { src: string; source: "override" | "hero" | "site" | "default" } {
  const override = imageSource(input.override);
  if (override) return { src: override, source: "override" };
  const hero = imageSource(input.hero);
  if (hero) return { src: hero, source: "hero" };
  const assetId = input.siteAssetId?.trim();
  const site = assetId ? `/api/media/${encodeURIComponent(assetId)}` : imageSource(input.siteImage);
  if (site) return { src: site, source: "site" };
  return { src: DEFAULT_SOCIAL_IMAGE, source: "default" };
}