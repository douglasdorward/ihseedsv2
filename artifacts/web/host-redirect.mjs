// Host canonicalisation for next.config.mjs. Kept as .mjs because the Next
// config cannot import TypeScript; mirrors the apex rule in lib/site-url.ts.

export const DEFAULT_PUBLIC_SITE_URL = "https://irwinhunter.com.au";

/** Resolve the canonical public origin, normalising www.irwinhunter.com.au to apex. */
export function canonicalPublicSiteUrl(configured = process.env.PUBLIC_SITE_URL) {
  const url = new URL(configured?.trim() || DEFAULT_PUBLIC_SITE_URL);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("PUBLIC_SITE_URL must use http or https.");
  }
  if (url.hostname === "www.irwinhunter.com.au") url.hostname = "irwinhunter.com.au";
  return url;
}

/**
 * Redirect www to the canonical apex, preserving path and query.
 * Other configured domains (including previews) are left unchanged.
 */
export function canonicalHostRedirects(configured = process.env.PUBLIC_SITE_URL) {
  const siteUrl = canonicalPublicSiteUrl(configured);
  if (siteUrl.hostname !== "irwinhunter.com.au") return [];
  const alternateHost = `www.${siteUrl.hostname}`;
  return [
    {
      source: "/:path*",
      has: [{ type: "host", value: alternateHost.replaceAll(".", "\\.") }],
      destination: `${siteUrl.origin}/:path*`,
      permanent: true,
    },
  ];
}
