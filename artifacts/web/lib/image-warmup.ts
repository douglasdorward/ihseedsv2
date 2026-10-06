/**
 * Background warm-up for the image optimiser.
 *
 * Resized photos are cached on the server copy that made them, so after a
 * publish or a new server start every photo's first visitor waits while it is
 * made. The warm-up reads the site's own key pages, collects the exact
 * `/_next/image` URLs their browsers will ask for, and requests the common
 * ones one at a time. Reading the rendered pages (rather than rebuilding the
 * list from catalogue data) guarantees the URLs match what visitors request.
 */

/** Widths most visitors' browsers pick: 1x desktop cards (256/384), high-density screens and phones (828), heroes (1200/1600). */
export const WARM_WIDTHS = new Set([256, 384, 828, 1200, 1600]);

/** Pages whose photos are warmed. Listing and article pagination is discovered from these. */
export const WARM_START_PAGES = ["/", "/products", "/articles"];

function decodeHtmlAttribute(value: string) {
  return value.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'");
}

/** Every `/_next/image` URL in the page's src/srcset/preload attributes. */
export function optimisedImageUrlsInHtml(html: string) {
  const urls = new Set<string>();
  for (const match of html.matchAll(/\/_next\/image\?[^"'\s,]+/g)) {
    urls.add(decodeHtmlAttribute(match[0]));
  }
  return [...urls];
}

/** Keeps only the widths worth preparing ahead of time. */
export function selectWarmUrls(urls: Iterable<string>, widths: Set<number> = WARM_WIDTHS) {
  const selected = new Set<string>();
  for (const url of urls) {
    const width = Number(new URL(url, "http://local").searchParams.get("w"));
    if (widths.has(width)) selected.add(url);
  }
  return [...selected];
}

/** Category pages (`/products/<slug>`) and paginated listings linked from a page. */
export function warmPagesLinkedFrom(path: string, html: string) {
  const pages = new Set<string>();
  for (const match of html.matchAll(/href="([^"]+)"/g)) {
    const href = decodeHtmlAttribute(match[1]);
    if (/^\/products\/[a-z0-9-]+\/?$/.test(href)) pages.add(href.replace(/\/$/, ""));
    const [hrefPath, query = ""] = href.split("?");
    const pathOnly = path.split("?")[0];
    if (hrefPath === pathOnly && /^page=\d+$/.test(query)) pages.add(href);
  }
  return [...pages];
}

type WarmOptions = {
  origin: string;
  log?: (message: string) => void;
  fetchImpl?: typeof fetch;
  maxPages?: number;
};

async function fetchText(fetchImpl: typeof fetch, url: string) {
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`${response.status} for ${url}`);
  return response.text();
}

/** Runs the warm-up. Never throws; failures are logged and skipped. */
export async function warmOptimisedImages({ origin, log = console.log, fetchImpl = fetch, maxPages = 60 }: WarmOptions) {
  const started = Date.now();
  const queue = [...WARM_START_PAGES];
  const visited = new Set<string>();
  const imageUrls = new Set<string>();
  while (queue.length && visited.size < maxPages) {
    const path = queue.shift()!;
    if (visited.has(path)) continue;
    visited.add(path);
    try {
      const html = await fetchText(fetchImpl, origin + path);
      for (const url of selectWarmUrls(optimisedImageUrlsInHtml(html))) imageUrls.add(url);
      for (const page of warmPagesLinkedFrom(path, html)) if (!visited.has(page)) queue.push(page);
    } catch (error) {
      log(`[image-warmup] page ${path} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  let failed = 0;
  // One at a time so real visitors are never queued behind the warm-up.
  for (const url of imageUrls) {
    try {
      const response = await fetchImpl(origin + url, { headers: { accept: "image/avif,image/webp,*/*" } });
      await response.arrayBuffer();
      if (!response.ok) throw new Error(String(response.status));
    } catch (error) {
      failed += 1;
      log(`[image-warmup] ${url} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  log(`[image-warmup] prepared ${imageUrls.size - failed}/${imageUrls.size} photos from ${visited.size} pages in ${Math.round((Date.now() - started) / 1000)}s`);
}

/** Production by default; IMAGE_WARMUP=0 disables, IMAGE_WARMUP=1 enables in development. */
export function imageWarmupEnabled(env: Record<string, string | undefined>) {
  if (env.IMAGE_WARMUP === "0") return false;
  if (env.IMAGE_WARMUP === "1") return true;
  return env.NODE_ENV === "production";
}
