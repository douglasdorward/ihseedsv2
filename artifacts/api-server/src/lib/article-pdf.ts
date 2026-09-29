import { ARTICLE_PDF_LIMIT, type ArticlePdfRecord } from "@workspace/db/schema";

export const ARTICLE_PDF_MAX_BYTES = 15 * 1024 * 1024;
const PDF_MAGIC = Buffer.from("%PDF");
const PDF_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugifyPdfTitle(title: string) {
  const slug = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return slug || "document";
}

export function uniquePdfSlug(title: string, taken: Iterable<string>) {
  const used = new Set(taken);
  const base = slugifyPdfTitle(title);
  if (!used.has(base)) return base;
  for (let index = 2; index < 1000; index += 1) {
    const suffix = `-${index}`;
    const candidate = `${base.slice(0, 80 - suffix.length)}${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
  throw new Error("Could not create a unique PDF address.");
}

export function articlePdfStorageKey(articleId: number, slug: string) {
  return `articles/${articleId}/${slug}.pdf`;
}

export function articlePdfPublicPath(articleSlug: string, pdfSlug: string) {
  return `/articles/${articleSlug}/${pdfSlug}.pdf`;
}

export function safePdfFilename(filename: string) {
  const base = filename
    .replace(/[\r\n"]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  const named = base || "document.pdf";
  return named.toLowerCase().endsWith(".pdf") ? named : `${named}.pdf`;
}

export function pdfContentDisposition(filename: string) {
  return `inline; filename="${safePdfFilename(filename)}"`;
}

export function decodeArticlePdf(data: string, filename: string) {
  const buffer = Buffer.from(data.replace(/^data:[^;]+;base64,/, ""), "base64");
  if (!buffer.length || buffer.length > ARTICLE_PDF_MAX_BYTES) {
    throw new Error(`"${filename}" must be a PDF between 1 byte and 15 MB.`);
  }
  if (buffer.length < 4 || !buffer.subarray(0, 4).equals(PDF_MAGIC)) {
    throw new Error(`"${filename}" is not a PDF.`);
  }
  return buffer;
}

export function storedArticlePdfs(value: unknown): ArticlePdfRecord[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Partial<ArticlePdfRecord>;
    if (typeof record.slug !== "string" || !PDF_SLUG.test(record.slug)) return [];
    if (typeof record.title !== "string" || !record.title.trim() || record.title.length > 180) return [];
    if (typeof record.filename !== "string" || !record.filename.trim()) return [];
    if (typeof record.storageKey !== "string" || !record.storageKey.startsWith("articles/")) return [];
    if (typeof record.bytes !== "number" || !Number.isInteger(record.bytes) || record.bytes <= 0) return [];
    return [{
      slug: record.slug,
      title: record.title.trim(),
      filename: record.filename,
      storageKey: record.storageKey,
      bytes: record.bytes,
    }];
  });
}

export function adminArticlePdfs(pdfs: ArticlePdfRecord[]) {
  return pdfs.map(({ slug, title, filename, bytes }) => ({ slug, title, filename, bytes }));
}

export function publicArticlePdfs(articleSlug: string, pdfs: ArticlePdfRecord[]) {
  return pdfs.map((pdf) => ({
    slug: pdf.slug,
    title: pdf.title,
    href: articlePdfPublicPath(articleSlug, pdf.slug),
  }));
}

export function publicArticlePdfAccess(article: { publishStatus: string; robotsIndex: boolean } | null | undefined) {
  if (!article || article.publishStatus !== "Published") return { ok: false as const };
  return { ok: true as const, noindex: article.robotsIndex === false };
}

export function assertPdfRoom(count: number) {
  if (count >= ARTICLE_PDF_LIMIT) {
    throw new Error(`An article can have up to ${ARTICLE_PDF_LIMIT} PDFs.`);
  }
}
