import { Router, type IRouter, type Response } from "express";
import { desc, eq } from "drizzle-orm";
import {
  ARTICLE_RELATED_PRODUCT_LIMIT,
  articlePdfTitleSchema,
  articlePdfUploadSchema,
  articlesTable,
  db,
  insertArticleSchema,
  updateArticleSchema,
  withArticleSearchMetadata,
  type Article,
} from "@workspace/db";
import {
  ArticleLegacyUrlError,
  articleLegacyUrlProblem,
  syncArticleLegacyRedirect,
} from "../lib/article-redirect";
import { normalizeArticleBody } from "../lib/article-body";
import {
  ARTICLE_AGENT_PROMPT,
  articleImportTemplate,
  articlesToWorkbook,
  commitArticleImport,
  dryRunArticleImport,
} from "../lib/article-import";
import {
  findRelatedProductIssues,
  isFuturePublishDate,
  listWorkbookLookups,
  parseScheduledPublishAt,
  publishDueArticles,
  publishValidationIssues,
} from "../lib/article-publish";
import {
  adminArticlePdfs,
  articlePdfPublicPath,
  articlePdfStorageKey,
  assertPdfRoom,
  decodeArticlePdf,
  pdfContentDisposition,
  publicArticlePdfAccess,
  publicArticlePdfs,
  safePdfFilename,
  storedArticlePdfs,
  uniquePdfSlug,
} from "../lib/article-pdf";
import { getStoredFile, putStoredFile, removeStoredFile } from "../lib/app-storage";
import { logger } from "../lib/logger";
import { clearArticleMediaReferences, syncArticleMediaReferences } from "../lib/media-usage";
import { absolutePublicUrl } from "../lib/public-site-url";

const router: IRouter = Router();

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
  return absolutePublicUrl(`/articles/${encodeURIComponent(slug)}`);
}

function canonicalArticlePdfUrl(articleSlug: string, pdfSlug: string) {
  return absolutePublicUrl(articlePdfPublicPath(articleSlug, pdfSlug));
}

function toAdminArticle(article: Article) {
  return {
    ...article,
    tags: article.tags ?? [],
    relatedProductSlugs: article.relatedProductSlugs ?? [],
    pdfs: adminArticlePdfs(storedArticlePdfs(article.pdfs)),
    heroImageAssetId: article.heroImageAssetId ?? null,
    publishedAt: article.publishedAt ? article.publishedAt.toISOString() : null,
    scheduledPublishAt: article.scheduledPublishAt ? article.scheduledPublishAt.toISOString() : null,
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
    pdfs: publicArticlePdfs(article.slug, storedArticlePdfs(article.pdfs)),
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

function sendPdf(res: Response, bytes: Buffer, filename: string, noindex: boolean) {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", pdfContentDisposition(filename));
  res.setHeader("Content-Length", String(bytes.length));
  res.setHeader("Cache-Control", "public, max-age=300");
  if (noindex) res.setHeader("X-Robots-Tag", "noindex");
  res.send(bytes);
}

function sendRelatedProductError(res: Response, invalid: string[]) {
  res.status(400).json({
    error: `Linked products contains invalid product references: ${invalid.join(", ")}.`,
    issues: [{ field: "relatedProductSlugs", label: "Linked products", values: invalid }],
  });
}

async function persistMedia(article: Article) {
  try {
    await syncArticleMediaReferences(article);
  } catch (error) {
    logger.error({ err: error, articleId: article.id }, "Article media references could not be updated");
  }
}

function workbookFromBody(body: unknown) {
  return typeof (body as { workbookBase64?: unknown })?.workbookBase64 === "string"
    ? Buffer.from((body as { workbookBase64: string }).workbookBase64, "base64")
    : null;
}

function sendWorkbook(res: Response, filename: string, file: Buffer) {
  res.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet").attachment(filename).send(file);
}

router.get("/articles", async (_req, res): Promise<void> => {
  await publishDueArticles();
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
  await publishDueArticles();
  const [article] = await db.select().from(articlesTable).where(eq(articlesTable.slug, slug));
  if (!article || article.publishStatus !== "Published") {
    res.status(404).json({ error: "Article not found." });
    return;
  }
  res.json(toPublicArticle(article));
});

router.get("/articles/slug/:slug/pdfs/:pdfSlug", async (req, res): Promise<void> => {
  const slug = String(req.params.slug ?? "").trim();
  const pdfSlug = String(req.params.pdfSlug ?? "").trim();
  if (!slug || !pdfSlug) {
    res.status(404).json({ error: "PDF not found." });
    return;
  }
  await publishDueArticles();
  const [article] = await db.select().from(articlesTable).where(eq(articlesTable.slug, slug));
  const access = publicArticlePdfAccess(article);
  if (!access.ok) {
    res.status(404).json({ error: "PDF not found." });
    return;
  }
  const pdf = storedArticlePdfs(article?.pdfs).find((item) => item.slug === pdfSlug);
  const stored = pdf ? await getStoredFile(pdf.storageKey) : null;
  if (!pdf || !stored?.bytes.length) {
    res.status(404).json({ error: "PDF not found." });
    return;
  }
  sendPdf(res, stored.bytes, pdf.filename, access.noindex);
});

router.get("/sitemap-articles", async (_req, res): Promise<void> => {
  await publishDueArticles();
  const articles = await db.select({
    slug: articlesTable.slug,
    robotsIndex: articlesTable.robotsIndex,
    publishedAt: articlesTable.publishedAt,
    updatedAt: articlesTable.updatedAt,
    pdfs: articlesTable.pdfs,
  }).from(articlesTable).where(eq(articlesTable.publishStatus, "Published"));
  res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${
    articles
      .filter((article) => article.robotsIndex !== false)
      .flatMap((article) => {
        const lastModified = (article.updatedAt ?? article.publishedAt).toISOString();
        const urls = [
          canonicalArticleUrl(article.slug),
          ...storedArticlePdfs(article.pdfs).map((pdf) => canonicalArticlePdfUrl(article.slug, pdf.slug)),
        ];
        return urls.map((url) => `<url><loc>${escapeXml(url)}</loc><lastmod>${escapeXml(lastModified)}</lastmod></url>`);
      })
      .join("")
  }</urlset>`);
});

router.get("/admin/articles", async (_req, res): Promise<void> => {
  await publishDueArticles();
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
    const article = await db.transaction(async (tx) => {
      const problem = await articleLegacyUrlProblem(tx, values.websiteUrlLegacy, values.slug, null);
      if (problem) throw new ArticleLegacyUrlError(problem);
      const [created] = await tx.insert(articlesTable).values({
        ...values,
        publishStatus: "Draft",
        publishedAt: null,
        scheduledPublishAt: null,
        updatedAt: new Date(),
      }).returning();
      if (!created) throw new Error("Could not create the article.");
      await syncArticleLegacyRedirect(tx, null, created);
      return created;
    });
    await persistMedia(article);
    res.status(201).json(toAdminArticle(article));
  } catch (error) {
    if (error instanceof ArticleLegacyUrlError) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (isPostgresError(error, "23505")) {
      res.status(409).json({ error: "An article with that slug already exists." });
      return;
    }
    req.log.error({ err: error }, "Article create failed");
    res.status(500).json({ error: "Could not save this article." });
  }
});

router.get("/admin/articles/import/template", async (_req, res): Promise<void> => {
  sendWorkbook(res, "blog-articles-template.xlsx", articleImportTemplate(await listWorkbookLookups()));
});

router.get("/admin/articles/import/prompt", (_req, res): void => {
  res.type("text/plain; charset=utf-8").send(ARTICLE_AGENT_PROMPT);
});

router.get("/admin/articles/export", async (_req, res): Promise<void> => {
  await publishDueArticles();
  const articles = await db.select().from(articlesTable)
    .orderBy(desc(articlesTable.updatedAt), desc(articlesTable.id));
  sendWorkbook(res, "blog-articles.xlsx", articlesToWorkbook(articles, await listWorkbookLookups()));
});

router.post("/admin/articles/import/dry-run", async (req, res): Promise<void> => {
  const file = workbookFromBody(req.body);
  if (!file) {
    res.status(400).json({ error: "workbookBase64 is required." });
    return;
  }
  res.json(await dryRunArticleImport(file));
});

router.post("/admin/articles/import/commit", async (req, res): Promise<void> => {
  const file = workbookFromBody(req.body);
  const token = typeof req.body?.token === "string" ? req.body.token : "";
  if (!file || !token) {
    res.status(400).json({ error: "workbookBase64 and token are required." });
    return;
  }
  try {
    res.json(await commitArticleImport(file, token));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Import failed" });
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
  const body = req.body && typeof req.body === "object" ? { ...(req.body as Record<string, unknown>) } : {};
  const hasPublishedAt = Object.prototype.hasOwnProperty.call(body, "publishedAt");
  const rawPublishedAt = body.publishedAt;
  delete body.publishedAt;
  const parsed = updateArticleSchema.safeParse(body);
  if (!id || !parsed.success || (Object.keys(parsed.data).length === 0 && !hasPublishedAt)) {
    res.status(400).json({ error: "Please provide a valid article id and update." });
    return;
  }
  let publishedAt: Date | undefined;
  if (hasPublishedAt && rawPublishedAt != null && rawPublishedAt !== "") {
    const value = parseScheduledPublishAt(rawPublishedAt);
    if (!value) {
      res.status(400).json({ error: "Published date must be a valid date." });
      return;
    }
    if (isFuturePublishDate(value)) {
      res.status(400).json({ error: "Published date cannot be in the future. Schedule the article instead." });
      return;
    }
    publishedAt = value;
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
    const article = await db.transaction(async (tx) => {
      const [current] = await tx.select().from(articlesTable).where(eq(articlesTable.id, id));
      if (!current) return null;
      const nextSlug = values.slug ?? current.slug;
      const nextLegacy = values.websiteUrlLegacy ?? current.websiteUrlLegacy;
      const problem = await articleLegacyUrlProblem(tx, nextLegacy, nextSlug, id, current.slug);
      if (problem) throw new ArticleLegacyUrlError(problem);
      const [updated] = await tx.update(articlesTable).set({
        ...values,
        ...(publishedAt ? { publishedAt } : {}),
        updatedAt: new Date(),
      }).where(eq(articlesTable.id, id)).returning();
      if (!updated) return null;
      await syncArticleLegacyRedirect(tx, current, updated);
      return updated;
    });
    if (!article) {
      res.status(404).json({ error: "Article not found." });
      return;
    }
    await persistMedia(article);
    res.json(toAdminArticle(article));
  } catch (error) {
    if (error instanceof ArticleLegacyUrlError) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (isPostgresError(error, "23505")) {
      res.status(409).json({ error: "An article with that slug already exists." });
      return;
    }
    req.log.error({ err: error, articleId: id }, "Article update failed");
    res.status(500).json({ error: "Could not save this article." });
  }
});

router.delete("/admin/articles/:id", async (req, res): Promise<void> => {
  const id = validId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Please provide a valid article id." });
    return;
  }
  const [existing] = await db.select().from(articlesTable).where(eq(articlesTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Article not found." });
    return;
  }
  const pdfs = storedArticlePdfs(existing.pdfs);
  await db.transaction(async (tx) => {
    await syncArticleLegacyRedirect(tx, existing, { slug: existing.slug, websiteUrlLegacy: [] });
    await clearArticleMediaReferences(id, tx);
    await tx.delete(articlesTable).where(eq(articlesTable.id, id));
  });
  await Promise.allSettled(pdfs.map((pdf) => removeStoredFile(pdf.storageKey)));
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
  const requestedPublishedAt = parseScheduledPublishAt((req.body as { publishedAt?: unknown } | undefined)?.publishedAt);
  if ((req.body as { publishedAt?: unknown } | undefined)?.publishedAt && !requestedPublishedAt) {
    res.status(400).json({
      error: "Published date must be a valid date.",
      issues: [{ field: "publishedAt", label: "Published on" }],
    });
    return;
  }
  if (requestedPublishedAt && isFuturePublishDate(requestedPublishedAt)) {
    res.status(400).json({
      error: "Published date cannot be in the future. Schedule the article instead.",
      issues: [{ field: "publishedAt", label: "Published on" }],
    });
    return;
  }
  const [article] = await db.update(articlesTable).set({
    publishStatus: "Published",
    publishedAt: requestedPublishedAt ?? current.publishedAt ?? new Date(),
    scheduledPublishAt: null,
    updatedAt: new Date(),
  }).where(eq(articlesTable.id, id)).returning();
  if (!article) {
    res.status(404).json({ error: "Article not found." });
    return;
  }
  await persistMedia(article);
  res.json(toAdminArticle(article));
});

router.post("/admin/articles/:id/schedule", async (req, res): Promise<void> => {
  const id = validId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Please provide a valid article id." });
    return;
  }
  const scheduledPublishAt = parseScheduledPublishAt((req.body as { scheduledPublishAt?: unknown })?.scheduledPublishAt);
  if (!scheduledPublishAt || scheduledPublishAt.getTime() <= Date.now()) {
    res.status(400).json({
      error: "Choose a future date and time.",
      issues: [{ field: "scheduledPublishAt", label: "Scheduled publish time" }],
    });
    return;
  }
  const [current] = await db.select().from(articlesTable).where(eq(articlesTable.id, id));
  if (!current) {
    res.status(404).json({ error: "Article not found." });
    return;
  }
  if (current.publishStatus === "Published") {
    res.status(400).json({
      error: "Unpublish this article before scheduling it.",
      issues: [{ field: "publishStatus", label: "Status" }],
    });
    return;
  }
  const issues = publishValidationIssues(current);
  if (issues.length) {
    res.status(400).json({
      error: `Complete these fields before scheduling: ${issues.map((issue) => issue.label).join(", ")}.`,
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
    publishStatus: "Scheduled",
    scheduledPublishAt,
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
    scheduledPublishAt: null,
    updatedAt: new Date(),
  }).where(eq(articlesTable.id, id)).returning();
  if (!article) {
    res.status(404).json({ error: "Article not found." });
    return;
  }
  await persistMedia(article);
  res.json(toAdminArticle(article));
});

router.post("/admin/articles/:id/pdfs", async (req, res): Promise<void> => {
  const id = validId(req.params.id);
  const parsed = articlePdfUploadSchema.safeParse(req.body);
  if (!id || !parsed.success) {
    res.status(400).json({ error: "Upload a PDF with a title." });
    return;
  }
  const [current] = await db.select().from(articlesTable).where(eq(articlesTable.id, id));
  if (!current) {
    res.status(404).json({ error: "Article not found." });
    return;
  }
  const pdfs = storedArticlePdfs(current.pdfs);
  try {
    assertPdfRoom(pdfs.length);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "An article can have up to 8 PDFs." });
    return;
  }
  let buffer: Buffer;
  try {
    buffer = decodeArticlePdf(parsed.data.data, parsed.data.filename);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Upload a PDF file." });
    return;
  }
  const slug = uniquePdfSlug(parsed.data.title, pdfs.map((pdf) => pdf.slug));
  const filename = safePdfFilename(parsed.data.filename);
  const storageKey = articlePdfStorageKey(id, slug);
  const next = [...pdfs, {
    slug,
    title: parsed.data.title.trim(),
    filename,
    storageKey,
    bytes: buffer.length,
  }];
  try {
    await putStoredFile(storageKey, buffer, "application/pdf");
    const [article] = await db.update(articlesTable).set({
      pdfs: next,
      updatedAt: new Date(),
    }).where(eq(articlesTable.id, id)).returning();
    if (!article) {
      await removeStoredFile(storageKey);
      res.status(404).json({ error: "Article not found." });
      return;
    }
    res.status(201).json(toAdminArticle(article));
  } catch (error) {
    await removeStoredFile(storageKey);
    req.log.error({ err: error, articleId: id }, "Article PDF upload failed");
    res.status(500).json({ error: "Could not attach that file." });
  }
});

router.get("/admin/articles/:id/pdfs/:pdfSlug", async (req, res): Promise<void> => {
  const id = validId(req.params.id);
  const pdfSlug = String(req.params.pdfSlug ?? "").trim();
  if (!id || !pdfSlug) {
    res.status(404).json({ error: "PDF not found." });
    return;
  }
  const [article] = await db.select().from(articlesTable).where(eq(articlesTable.id, id));
  const pdf = storedArticlePdfs(article?.pdfs).find((item) => item.slug === pdfSlug);
  const stored = pdf ? await getStoredFile(pdf.storageKey) : null;
  if (!article || !pdf || !stored?.bytes.length) {
    res.status(404).json({ error: "PDF not found." });
    return;
  }
  sendPdf(res, stored.bytes, pdf.filename, true);
});

router.patch("/admin/articles/:id/pdfs/:pdfSlug", async (req, res): Promise<void> => {
  const id = validId(req.params.id);
  const pdfSlug = String(req.params.pdfSlug ?? "").trim();
  const parsed = articlePdfTitleSchema.safeParse(req.body);
  if (!id || !pdfSlug || !parsed.success) {
    res.status(400).json({ error: "Provide a PDF title." });
    return;
  }
  const [current] = await db.select().from(articlesTable).where(eq(articlesTable.id, id));
  if (!current) {
    res.status(404).json({ error: "Article not found." });
    return;
  }
  const pdfs = storedArticlePdfs(current.pdfs);
  if (!pdfs.some((pdf) => pdf.slug === pdfSlug)) {
    res.status(404).json({ error: "PDF not found." });
    return;
  }
  const [article] = await db.update(articlesTable).set({
    pdfs: pdfs.map((pdf) => pdf.slug === pdfSlug ? { ...pdf, title: parsed.data.title.trim() } : pdf),
    updatedAt: new Date(),
  }).where(eq(articlesTable.id, id)).returning();
  if (!article) {
    res.status(404).json({ error: "Article not found." });
    return;
  }
  res.json(toAdminArticle(article));
});

router.delete("/admin/articles/:id/pdfs/:pdfSlug", async (req, res): Promise<void> => {
  const id = validId(req.params.id);
  const pdfSlug = String(req.params.pdfSlug ?? "").trim();
  if (!id || !pdfSlug) {
    res.status(404).json({ error: "PDF not found." });
    return;
  }
  const [current] = await db.select().from(articlesTable).where(eq(articlesTable.id, id));
  if (!current) {
    res.status(404).json({ error: "Article not found." });
    return;
  }
  const pdfs = storedArticlePdfs(current.pdfs);
  const pdf = pdfs.find((item) => item.slug === pdfSlug);
  if (!pdf) {
    res.status(404).json({ error: "PDF not found." });
    return;
  }
  const [article] = await db.update(articlesTable).set({
    pdfs: pdfs.filter((item) => item.slug !== pdfSlug),
    updatedAt: new Date(),
  }).where(eq(articlesTable.id, id)).returning();
  if (!article) {
    res.status(404).json({ error: "Article not found." });
    return;
  }
  await removeStoredFile(pdf.storageKey);
  res.json(toAdminArticle(article));
});

export default router;
