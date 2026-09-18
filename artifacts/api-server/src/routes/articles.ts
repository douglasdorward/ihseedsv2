import { Router, type IRouter, type Response } from "express";
import { desc, eq, inArray } from "drizzle-orm";
import {
  ARTICLE_RELATED_PRODUCT_LIMIT,
  articlesTable,
  db,
  insertArticleSchema,
  isActiveListing,
  productsTable,
  updateArticleSchema,
  withArticleSearchMetadata,
  type Article,
} from "@workspace/db";
import { bodyHasText, normalizeArticleBody } from "../lib/article-body";
import { clearArticleMediaReferences, syncArticleMediaReferences } from "../lib/media-usage";

const router: IRouter = Router();
const publicSiteBaseUrl = (process.env.PUBLIC_SITE_URL ?? "").trim().replace(/\/+$/, "");

function validId(rawId: string) {
  const id = Number(rawId);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function isPostgresError(error: unknown, code: string) {
  let current: unknown = error;
  while (current && typeof current === "object") {
    if ("code" in current && current.code === code) return true;
    current = "cause" in current ? current.cause : null;
  }
  return false;
}

function escapeXml(value: string) {
  return value.replace(/[<>&'"]/g, (character) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", "\"": "&quot;" })[character]!);
}

function canonicalArticleUrl(slug: string) {
  const path = `/resources/${encodeURIComponent(slug)}`;
  return publicSiteBaseUrl ? `${publicSiteBaseUrl}${path}` : path;
}

function toAdminArticle(article: Article) {
  return {
    ...article,
    tags: article.tags ?? [],
    relatedProductSlugs: article.relatedProductSlugs ?? [],
    heroImageAssetId: article.heroImageAssetId ?? null,
    publishedAt: article.publishedAt ? article.publishedAt.toISOString() : null,
    createdAt: article.createdAt.toISOString(),
    updatedAt: article.updatedAt.toISOString(),
  };
}

function toPublicArticle(article: Article) {
  return {
    id: article.id,
    slug: article.slug,
    title: article.title,
    excerpt: article.excerpt,
    body: article.body,
    tags: article.tags ?? [],
    heroImageSrc: article.heroImageSrc,
    relatedProductSlugs: (article.relatedProductSlugs ?? []).slice(0, ARTICLE_RELATED_PRODUCT_LIMIT),
    publishedAt: (article.publishedAt ?? article.updatedAt).toISOString(),
    seoTitle: article.seoTitle,
    seoDescription: article.seoDescription,
    socialTitle: article.socialTitle,
    socialDescription: article.socialDescription,
    socialImage: article.socialImage,
    robotsIndex: article.robotsIndex,
    updatedAt: article.updatedAt.toISOString(),
  };
}

function publishValidationIssues(article: Pick<Article, "title" | "slug" | "excerpt" | "body" | "seoTitle" | "seoDescription">) {
  return [
    !article.title.trim() && { field: "title", label: "Title" },
    !article.slug.trim() && { field: "slug", label: "Slug" },
    !article.excerpt.trim() && { field: "excerpt", label: "Excerpt" },
    !bodyHasText(article.body) && { field: "body", label: "Article body" },
    !article.seoTitle.trim() && { field: "seoTitle", label: "SEO title" },
    !article.seoDescription.trim() && { field: "seoDescription", label: "SEO description" },
  ].filter(Boolean) as Array<{ field: string; label: string }>;
}

async function findRelatedProductIssues(slugs: string[]) {
  const unique = [...new Set(slugs.map((slug) => slug.trim()).filter(Boolean))];
  if (!unique.length) return [] as string[];
  const rows = await db.select({
    slug: productsTable.slug,
    publishStatus: productsTable.publishStatus,
    listingState: productsTable.listingState,
  }).from(productsTable).where(inArray(productsTable.slug, unique));
  const eligible = new Set(
    rows
      .filter((product) => product.publishStatus === "Published" && isActiveListing(product))
      .map((product) => product.slug),
  );
  return unique.filter((slug) => !eligible.has(slug));
}

function sendRelatedProductError(res: Response, invalid: string[]) {
  res.status(400).json({
    error: `Linked products contains invalid product references: ${invalid.join(", ")}.`,
    issues: [{ field: "relatedProductSlugs", label: "Linked products", values: invalid }],
  });
}

async function persistMedia(article: Article) {
  await syncArticleMediaReferences(article);
}

router.get("/articles", async (_req, res): Promise<void> => {
  const articles = await db.select().from(articlesTable)
    .where(eq(articlesTable.publishStatus, "Published"))
    .orderBy(desc(articlesTable.publishedAt), desc(articlesTable.id));
  res.json(articles.map(toPublicArticle));
});

router.get("/articles/slug/:slug", async (req, res): Promise<void> => {
  const slug = String(req.params.slug ?? "").trim();
  if (!slug) {
    res.status(404).json({ error: "Article not found." });
    return;
  }
  const [article] = await db.select().from(articlesTable).where(eq(articlesTable.slug, slug));
  if (!article || article.publishStatus !== "Published") {
    res.status(404).json({ error: "Article not found." });
    return;
  }
  res.json(toPublicArticle(article));
});

router.get("/sitemap-articles", async (_req, res): Promise<void> => {
  const articles = await db.select({
    slug: articlesTable.slug,
    robotsIndex: articlesTable.robotsIndex,
  }).from(articlesTable).where(eq(articlesTable.publishStatus, "Published"));
  res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${
    articles
      .filter((article) => article.robotsIndex !== false)
      .map((article) => `<url><loc>${escapeXml(canonicalArticleUrl(article.slug))}</loc></url>`)
      .join("")
  }</urlset>`);
});

router.get("/admin/articles", async (_req, res): Promise<void> => {
  const articles = await db.select().from(articlesTable)
    .orderBy(desc(articlesTable.updatedAt), desc(articlesTable.id));
  res.json(articles.map(toAdminArticle));
});

router.post("/admin/articles", async (req, res): Promise<void> => {
  const parsed = insertArticleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Please provide valid article fields." });
    return;
  }
  const values = withArticleSearchMetadata({
    ...parsed.data,
    body: normalizeArticleBody(parsed.data.body),
  });
  const invalid = await findRelatedProductIssues(values.relatedProductSlugs);
  if (invalid.length) {
    sendRelatedProductError(res, invalid);
    return;
  }
  try {
    const [article] = await db.insert(articlesTable).values({
      ...values,
      publishStatus: "Draft",
      publishedAt: null,
      updatedAt: new Date(),
    }).returning();
    await persistMedia(article);
    res.status(201).json(toAdminArticle(article));
  } catch (error) {
    if (isPostgresError(error, "23505")) {
      res.status(409).json({ error: "An article with that slug already exists." });
      return;
    }
    throw error;
  }
});

router.get("/admin/articles/:id", async (req, res): Promise<void> => {
  const id = validId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Please provide a valid article id." });
    return;
  }
  const [article] = await db.select().from(articlesTable).where(eq(articlesTable.id, id));
  if (!article) {
    res.status(404).json({ error: "Article not found." });
    return;
  }
  res.json(toAdminArticle(article));
});

router.patch("/admin/articles/:id", async (req, res): Promise<void> => {
  const id = validId(req.params.id);
  const parsed = updateArticleSchema.safeParse(req.body);
  if (!id || !parsed.success || Object.keys(parsed.data).length === 0) {
    res.status(400).json({ error: "Please provide a valid article id and update." });
    return;
  }
  const values = withArticleSearchMetadata({
    ...parsed.data,
    ...(typeof parsed.data.body === "string" ? { body: normalizeArticleBody(parsed.data.body) } : {}),
  });
  if (values.relatedProductSlugs) {
    const invalid = await findRelatedProductIssues(values.relatedProductSlugs);
    if (invalid.length) {
      sendRelatedProductError(res, invalid);
      return;
    }
  }
  try {
    const [article] = await db.update(articlesTable).set({
      ...values,
      updatedAt: new Date(),
    }).where(eq(articlesTable.id, id)).returning();
    if (!article) {
      res.status(404).json({ error: "Article not found." });
      return;
    }
    await persistMedia(article);
    res.json(toAdminArticle(article));
  } catch (error) {
    if (isPostgresError(error, "23505")) {
      res.status(409).json({ error: "An article with that slug already exists." });
      return;
    }
    throw error;
  }
});

router.delete("/admin/articles/:id", async (req, res): Promise<void> => {
  const id = validId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Please provide a valid article id." });
    return;
  }
  await clearArticleMediaReferences(id);
  const [deleted] = await db.delete(articlesTable).where(eq(articlesTable.id, id)).returning({ id: articlesTable.id });
  if (!deleted) {
    res.status(404).json({ error: "Article not found." });
    return;
  }
  res.status(204).end();
});

router.post("/admin/articles/:id/publish", async (req, res): Promise<void> => {
  const id = validId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Please provide a valid article id." });
    return;
  }
  const [current] = await db.select().from(articlesTable).where(eq(articlesTable.id, id));
  if (!current) {
    res.status(404).json({ error: "Article not found." });
    return;
  }
  const issues = publishValidationIssues(current);
  if (issues.length) {
    res.status(400).json({
      error: `Complete these fields before publishing: ${issues.map((issue) => issue.label).join(", ")}.`,
      issues,
    });
    return;
  }
  const invalid = await findRelatedProductIssues(current.relatedProductSlugs ?? []);
  if (invalid.length) {
    sendRelatedProductError(res, invalid);
    return;
  }
  const [article] = await db.update(articlesTable).set({
    publishStatus: "Published",
    publishedAt: current.publishedAt ?? new Date(),
    updatedAt: new Date(),
  }).where(eq(articlesTable.id, id)).returning();
  if (!article) {
    res.status(404).json({ error: "Article not found." });
    return;
  }
  await persistMedia(article);
  res.json(toAdminArticle(article));
});

router.post("/admin/articles/:id/unpublish", async (req, res): Promise<void> => {
  const id = validId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Please provide a valid article id." });
    return;
  }
  const [article] = await db.update(articlesTable).set({
    publishStatus: "Draft",
    updatedAt: new Date(),
  }).where(eq(articlesTable.id, id)).returning();
  if (!article) {
    res.status(404).json({ error: "Article not found." });
    return;
  }
  await persistMedia(article);
  res.json(toAdminArticle(article));
});

export default router;
