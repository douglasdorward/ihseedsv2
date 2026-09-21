import { isSamePublicSite } from "./site-url";

function httpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function siteRelativePath(value: string) {
  return value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\");
}

/** Returns only a same-site or site-relative canonical override. */
export function productCanonicalUrl(override: string | undefined, fallbackPath: string) {
  const value = override?.trim();
  if (!value) return fallbackPath;
  if (siteRelativePath(value)) return value;
  const url = httpUrl(value);
  if (!url || !isSamePublicSite(url)) return fallbackPath;
  return `${url.pathname}${url.search}`.replace(/\/+$/, "") || "/";
}

/** Workbook values may be full supplier URLs or stored file paths. */
export function techSheetHref(techSheet: string | undefined) {
  const value = techSheet?.trim();
  if (!value) return null;
  if (siteRelativePath(value)) return value;
  const absolute = httpUrl(value);
  if (absolute) return absolute.toString();
  return `/tech-sheets/${value.replace(/^\/+/, "")}`;
}