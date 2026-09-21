export const DEFAULT_PUBLIC_SITE_URL = "https://www.irwinhunter.com.au";

function canonicalPublicOrigin(value: string) {
  const parsed = new URL(value);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("PUBLIC_SITE_URL must use http or https.");
  }
  if (parsed.hostname === "irwinhunter.com.au") {
    parsed.hostname = "www.irwinhunter.com.au";
  }
  return parsed.origin;
}

const configuredSiteUrl = process.env.PUBLIC_SITE_URL?.trim() || DEFAULT_PUBLIC_SITE_URL;

export const publicSiteUrl = new URL(canonicalPublicOrigin(configuredSiteUrl));

export function absoluteSiteUrl(path: string) {
  return new URL(path, publicSiteUrl).toString();
}

export function isSamePublicSite(url: URL) {
  const candidate = url.hostname.replace(/^www\./, "");
  const expected = publicSiteUrl.hostname.replace(/^www\./, "");
  return candidate === expected;
}
