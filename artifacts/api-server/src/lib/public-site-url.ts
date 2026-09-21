export const DEFAULT_PUBLIC_SITE_URL = "https://www.irwinhunter.com.au";

export function publicSiteBaseUrl() {
  const raw = (process.env.PUBLIC_SITE_URL ?? DEFAULT_PUBLIC_SITE_URL).trim().replace(/\/+$/, "")
    || DEFAULT_PUBLIC_SITE_URL;
  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol)) return DEFAULT_PUBLIC_SITE_URL;
    if (url.hostname === "irwinhunter.com.au") url.hostname = "www.irwinhunter.com.au";
    return url.origin;
  } catch {
    return DEFAULT_PUBLIC_SITE_URL;
  }
}

function isSamePublicSite(url: URL) {
  const candidate = url.hostname.replace(/^www\./, "");
  const expected = new URL(publicSiteBaseUrl()).hostname.replace(/^www\./, "");
  return candidate === expected;
}

function siteRelativePath(value: string) {
  return value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\");
}

/** Returns only a same-site or site-relative canonical override. */
export function canonicalPublicPath(override: string | undefined, fallbackPath: string) {
  const value = override?.trim();
  if (!value) return fallbackPath;
  if (siteRelativePath(value)) return value;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || !isSamePublicSite(url)) return fallbackPath;
    return `${url.pathname}${url.search}`.replace(/\/+$/, "") || "/";
  } catch {
    return fallbackPath;
  }
}

export function absolutePublicUrl(path: string) {
  return new URL(path, `${publicSiteBaseUrl()}/`).toString();
}
