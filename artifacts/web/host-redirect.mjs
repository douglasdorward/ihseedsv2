// Host canonicalisation for next.config.mjs. Kept as .mjs because the Next
// config cannot import TypeScript; mirrors the www rule in lib/site-url.ts.

export const DEFAULT_PUBLIC_SITE_URL = "https://www.irwinhunter.com.au";

/** Resolve the canonical public origin, forcing the apex of irwinhunter.com.au to www. */
export function canonicalPublicSiteUrl(configured = process.env.PUBLIC_SITE_URL) {
  const url = new URL(configured?.trim() || DEFAULT_PUBLIC_SITE_URL);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("PUBLIC_SITE_URL must use http or https.");
  }
  if (url.hostname === "irwinhunter.com.au") url.hostname = "www.irwinhunter.com.au";
  return url;
}

/**
 * Next.js redirect rules that 301 the bare apex host to the canonical www host,
 * preserving path and query. Empty when the canonical host is not a www host.
 */
export function canonicalHostRedirects(configured = process.env.PUBLIC_SITE_URL) {
  const siteUrl = canonicalPublicSiteUrl(configured);
  if (!siteUrl.hostname.startsWith("www.")) return [];
  const apexHost = siteUrl.hostname.slice("www.".length);
  return [
    {
      source: "/:path*",
      has: [{ type: "host", value: apexHost.replaceAll(".", "\\.") }],
      destination: `${siteUrl.origin}/:path*`,
      permanent: true,
    },
  ];
}
