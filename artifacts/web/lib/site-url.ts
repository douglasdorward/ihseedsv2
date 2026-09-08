const configuredSiteUrl = process.env.PUBLIC_SITE_URL?.trim() || "https://irwinhunter.com.au";
const parsedSiteUrl = new URL(configuredSiteUrl);

if (!["http:", "https:"].includes(parsedSiteUrl.protocol)) {
  throw new Error("PUBLIC_SITE_URL must use http or https.");
}

export const publicSiteUrl = new URL(parsedSiteUrl.origin);

export function absoluteSiteUrl(path: string) {
  return new URL(path, publicSiteUrl).toString();
}