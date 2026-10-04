import { and, eq, inArray } from "drizzle-orm";
import {
  articlesTable,
  db,
  productsTable,
  redirectsTable,
} from "@workspace/db";
import { legacyWebsitePaths } from "./product-legacy-urls";
import { legacyWebsitePath } from "./product-path";

type RedirectDb = Pick<typeof db, "delete" | "insert" | "select">;

export class ArticleLegacyUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArticleLegacyUrlError";
  }
}

export function articlePublicPath(slug: string) {
  return `/articles/${slug}`;
}

export function describeArticleLegacyUrl(raw: string, slug: string) {
  const trimmed = raw.trim();
  if (!trimmed) return { fromPath: null as string | null, problem: null as string | null };
  const fromPath = legacyWebsitePath(trimmed);
  if (!fromPath) {
    return {
      fromPath: null,
      problem: "Legacy website URL must be an http(s) URL on www.irwinhunter.com.au without a query or fragment",
    };
  }
  if (fromPath === articlePublicPath(slug)) {
    return {
      fromPath,
      problem: "Legacy website URL cannot already be the article's canonical path",
    };
  }
  return { fromPath, problem: null };
}

export function describeArticleLegacyUrls(raws: string[], slug: string) {
  const paths: string[] = [];
  const seen = new Set<string>();
  for (const raw of raws) {
    if (!raw.trim()) continue;
    const described = describeArticleLegacyUrl(raw, slug);
    if (described.problem || !described.fromPath) {
      return { paths: [] as string[], problem: described.problem ?? "Legacy website URL is invalid" };
    }
    if (seen.has(described.fromPath)) {
      return { paths, problem: `Duplicate legacy website path "${described.fromPath}"` };
    }
    seen.add(described.fromPath);
    paths.push(described.fromPath);
  }
  return { paths, problem: null as string | null };
}

function legacyPaths(urls: string[]) {
  return [...new Set(urls.flatMap((url) => {
    const path = legacyWebsitePath(url);
    return path ? [path] : [];
  }))];
}

export async function articleLegacyUrlProblem(
  executor: RedirectDb,
  raws: string[],
  slug: string,
  articleId: number | null,
  previousSlug?: string | null,
) {
  const described = describeArticleLegacyUrls(raws, slug);
  if (described.problem) return described.problem;
  if (!described.paths.length) return null;
  const toPath = articlePublicPath(slug);
  const previousTo = previousSlug ? articlePublicPath(previousSlug) : null;

  const articles = await executor.select({
    id: articlesTable.id,
    websiteUrlLegacy: articlesTable.websiteUrlLegacy,
  }).from(articlesTable);
  const otherArticlePaths = new Set<string>();
  for (const article of articles) {
    if (article.id === articleId) continue;
    for (const path of legacyPaths(article.websiteUrlLegacy ?? [])) otherArticlePaths.add(path);
  }

  const products = await executor.select({
    websiteUrlLegacy: productsTable.websiteUrlLegacy,
  }).from(productsTable);
  const productPaths = new Set(products.flatMap((product) => legacyWebsitePaths(product.websiteUrlLegacy)));

  const redirects = described.paths.length
    ? await executor.select({
      fromPath: redirectsTable.fromPath,
      toPath: redirectsTable.toPath,
    }).from(redirectsTable).where(inArray(redirectsTable.fromPath, described.paths))
    : [];
  const redirectByPath = new Map(redirects.map((redirect) => [redirect.fromPath, redirect.toPath]));

  for (const fromPath of described.paths) {
    if (otherArticlePaths.has(fromPath)) {
      return `Legacy website path "${fromPath}" is already used by another article`;
    }
    if (productPaths.has(fromPath)) {
      return `Legacy website path "${fromPath}" is already used by a product`;
    }
    const owner = redirectByPath.get(fromPath);
    if (owner && owner !== toPath && owner !== previousTo) {
      return `Legacy website path "${fromPath}" is already used by another redirect`;
    }
  }
  return null;
}

export async function syncArticleLegacyRedirect(
  executor: RedirectDb,
  previous: { slug: string; websiteUrlLegacy: string[] } | null,
  next: { slug: string; websiteUrlLegacy: string[] },
) {
  const previousTo = previous ? articlePublicPath(previous.slug) : null;
  const nextTo = articlePublicPath(next.slug);
  const previousPaths = new Set(previous ? legacyPaths(previous.websiteUrlLegacy) : []);
  const nextPaths = new Set(legacyPaths(next.websiteUrlLegacy));

  const removed = [...previousPaths].filter((path) => !nextPaths.has(path) || previousTo !== nextTo);
  if (removed.length && previousTo) {
    await executor.delete(redirectsTable).where(and(
      inArray(redirectsTable.fromPath, removed),
      eq(redirectsTable.toPath, previousTo),
    ));
  }

  for (const fromPath of nextPaths) {
    await executor.insert(redirectsTable).values({
      fromPath,
      toPath: nextTo,
    }).onConflictDoUpdate({
      target: redirectsTable.fromPath,
      set: { toPath: nextTo, updatedAt: new Date() },
    });
  }
}
