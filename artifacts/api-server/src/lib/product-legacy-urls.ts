import { legacyWebsitePath } from "./product-path";

/**
 * A product keeps its old website addresses in one text field. Several
 * addresses are separated with " | ", for example:
 *   https://www.irwinhunter.com.au/product/maximix/ | https://www.irwinhunter.com.au/maximix-pasture-mix/
 * The same format is used by the back-office editor and by the workbook
 * `1 Products.website_url` column.
 */
export const LEGACY_URL_SEPARATOR = " | ";
export const PRODUCT_LEGACY_URL_LIMIT = 12;
export const PRODUCT_LEGACY_URL_FIELD_MAX = 2000;

const INVALID_URL_PROBLEM =
  "must be an http(s) URL on www.irwinhunter.com.au without a query or fragment. Separate several addresses with \" | \"";

/** Splits the field on "|" and drops blanks. Does not validate or de-duplicate. */
export function splitLegacyUrls(value: unknown): string[] {
  if (typeof value !== "string") return [];
  return value.split("|").map((part) => part.trim()).filter(Boolean);
}

/** The canonical stored form: trimmed addresses, blanks removed, joined with " | ". */
export function joinLegacyUrls(value: unknown): string {
  return splitLegacyUrls(value).join(LEGACY_URL_SEPARATOR);
}

/**
 * Validates every address in the field. `canonicalPath` is the product's own
 * new address; an old address may not already be that path.
 */
export function describeProductLegacyUrls(value: unknown, canonicalPath?: string) {
  const urls = splitLegacyUrls(value);
  const paths: string[] = [];
  if (urls.length > PRODUCT_LEGACY_URL_LIMIT) {
    return {
      urls,
      paths: [] as string[],
      problem: `Use at most ${PRODUCT_LEGACY_URL_LIMIT} legacy website URLs per product`,
    };
  }
  const seen = new Set<string>();
  for (const url of urls) {
    const path = legacyWebsitePath(url);
    if (!path) {
      return {
        urls,
        paths: [] as string[],
        problem: urls.length > 1
          ? `Legacy website URL "${url}" ${INVALID_URL_PROBLEM}`
          : `Legacy website URL ${INVALID_URL_PROBLEM}`,
      };
    }
    if (canonicalPath && path === canonicalPath) {
      return {
        urls,
        paths: [] as string[],
        problem: "Legacy website URL cannot already be the product's new canonical path",
      };
    }
    if (seen.has(path)) {
      return { urls, paths: [] as string[], problem: `Duplicate legacy website path "${path}"` };
    }
    seen.add(path);
    paths.push(path);
  }
  return { urls, paths, problem: null as string | null };
}

/** Every valid, unique path in the field. Invalid entries are skipped. */
export function legacyWebsitePaths(value: unknown): string[] {
  return [...new Set(splitLegacyUrls(value).flatMap((url) => {
    const path = legacyWebsitePath(url);
    return path ? [path] : [];
  }))];
}
