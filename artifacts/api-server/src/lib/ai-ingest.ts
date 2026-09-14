import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  aiIngestItemsTable,
  db,
  productsTable,
  type AiIngestItem,
  type AiProposedPatch,
  type Product,
} from "@workspace/db";
import { getStoredFile, putStoredFile, removeStoredFile, techSheetPublicPath } from "./app-storage";
import { extractPdfText, renderPdfPagePngs } from "./pdf-text";
import { proposeFieldsFromDocument } from "./ai-extract";
import { sanitizeAiPatch } from "./ai-patch";
import { matchProductFromFilename } from "./tech-sheet-match";

const MAX_PDF_BYTES = 15 * 1024 * 1024;
const PDF_MAGIC = Buffer.from("%PDF");

export type UploadedPdf = {
  filename: string;
  data: string;
};

function decodePdf(data: string, filename: string) {
  const buffer = Buffer.from(data.replace(/^data:[^;]+;base64,/, ""), "base64");
  if (!buffer.length || buffer.length > MAX_PDF_BYTES) {
    throw new Error(`“${filename}” must be a PDF between 1 byte and 15 MB.`);
  }
  if (!buffer.subarray(0, 4).equals(PDF_MAGIC)) {
    throw new Error(`“${filename}” is not a PDF.`);
  }
  return buffer;
}

function safeFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "tech-sheet.pdf";
}

export function toPublicIngestItem(item: AiIngestItem) {
  return {
    id: item.id,
    filename: item.filename,
    status: item.status,
    productId: item.productId,
    warnings: item.warnings ?? [],
    errorMessage: item.errorMessage,
    proposedPatch: item.proposedPatch,
    fileUrl: techSheetPublicPath(item.id),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

async function listMatchableProducts() {
  return db.select({
    id: productsTable.id,
    name: productsTable.name,
    slug: productsTable.slug,
    category: productsTable.category,
    details: productsTable.details,
    techSheet: productsTable.techSheet,
    packSize: productsTable.packSize,
  }).from(productsTable);
}

export async function storePdfItem(file: UploadedPdf, productId?: number | null) {
  const buffer = decodePdf(file.data, file.filename);
  const [item] = await db.insert(aiIngestItemsTable).values({
    filename: safeFilename(file.filename),
    storageKey: `pending/${randomBytes(8).toString("hex")}.pdf`,
    mimeType: "application/pdf",
    status: "uploaded",
    productId: productId ?? null,
  }).returning();
  const storageKey = `tech-sheets/${item.id}/${safeFilename(file.filename)}`;
  await putStoredFile(storageKey, buffer, "application/pdf");
  const [stored] = await db.update(aiIngestItemsTable).set({
    storageKey,
    updatedAt: new Date(),
  }).where(eq(aiIngestItemsTable.id, item.id)).returning();
  return stored;
}

function currentProductPayload(product: {
  name: string;
  slug: string;
  category: string;
  techSheet: string;
  packSize: string;
  details: unknown;
} | null) {
  if (!product) return { name: "", category: "", details: {} };
  return {
    name: product.name,
    slug: product.slug,
    category: product.category,
    techSheet: product.techSheet,
    details: product.details,
  };
}

export async function extractStoredItem(item: AiIngestItem, options: {
  stubPatch?: unknown;
  currentProduct?: unknown;
  category?: string;
  existingProduct?: boolean;
  productName?: string;
} = {}) {
  const stored = await getStoredFile(item.storageKey);
  if (!stored) throw new Error("The uploaded PDF could not be read from storage.");
  await db.update(aiIngestItemsTable).set({ status: "extracting", errorMessage: "", updatedAt: new Date() }).where(eq(aiIngestItemsTable.id, item.id));
  const extracted = await extractPdfText(stored.bytes);
  const warnings = [...(extracted.scannedLikely ? ["The PDF looks scanned or has almost no text. Fields were left blank rather than guessed."] : [])];
  let images: Array<{ mediaType: string; data: string }> | undefined;
  if (extracted.scannedLikely && !options.stubPatch && !process.env.AI_EXTRACT_STUB) {
    const pages = await renderPdfPagePngs(stored.bytes);
    images = pages.map((page) => ({ mediaType: "image/png", data: page.toString("base64") }));
    if (!images.length) warnings.push("Page images could not be rendered for OCR. Install or enable mutool, or upload a text PDF.");
  }
  if (extracted.scannedLikely && !options.stubPatch && (process.env.AI_EXTRACT_STUB || !(images && images.length))) {
    const patch: AiProposedPatch = { suggestions: [], warnings, scanned: true };
    const [updated] = await db.update(aiIngestItemsTable).set({
      status: item.productId ? "ready" : "needs-match",
      extractedTextHash: createHash("sha256").update(extracted.text).digest("hex"),
      proposedPatch: patch,
      warnings,
      errorMessage: "",
      updatedAt: new Date(),
    }).where(eq(aiIngestItemsTable.id, item.id)).returning();
    return updated;
  }
  try {
    const proposed = await proposeFieldsFromDocument({
      productName: options.productName,
      category: options.category ?? "",
      existingProduct: options.existingProduct ?? Boolean(item.productId),
      currentProduct: options.currentProduct ?? {},
      pdfText: extracted.text,
      images,
    }, options.stubPatch);
    const sanitized = sanitizeAiPatch({
      proposed,
      currentProduct: options.currentProduct ?? {},
      category: options.category ?? "",
      existingProduct: options.existingProduct ?? Boolean(item.productId),
    });
    const mergedWarnings = [...warnings, ...sanitized.warnings];
    const suggestions = [...sanitized.suggestions];
    if (item.productId || options.existingProduct) {
      const techSheetUrl = techSheetPublicPath(item.id);
      if (!suggestions.some((suggestion) => suggestion.path === "techSheet")) {
        suggestions.push({
          path: "techSheet",
          label: "Tech sheet URL",
          tab: 5,
          current: (options.currentProduct as { techSheet?: string } | undefined)?.techSheet ?? "",
          proposed: techSheetUrl,
          confidence: 0.9,
        });
      }
    }
    const patch: AiProposedPatch = {
      suggestions,
      warnings: mergedWarnings,
      scanned: extracted.scannedLikely,
    };
    const [updated] = await db.update(aiIngestItemsTable).set({
      status: item.productId ? "ready" : "needs-match",
      extractedTextHash: createHash("sha256").update(extracted.text).digest("hex"),
      proposedPatch: patch,
      warnings: mergedWarnings,
      errorMessage: "",
      updatedAt: new Date(),
    }).where(eq(aiIngestItemsTable.id, item.id)).returning();
    return updated;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Extraction failed";
    const [updated] = await db.update(aiIngestItemsTable).set({
      status: "failed",
      errorMessage: message,
      warnings,
      updatedAt: new Date(),
    }).where(eq(aiIngestItemsTable.id, item.id)).returning();
    return updated;
  }
}

export async function ingestPdfForProduct(file: UploadedPdf, product: Product | null, stubPatch?: unknown, category?: string) {
  const item = await storePdfItem(file, product?.id ?? null);
  const extracted = await extractStoredItem(item, {
    stubPatch,
    currentProduct: currentProductPayload(product),
    category: category || product?.category || "",
    existingProduct: Boolean(product),
    productName: product?.name,
  });
  return extracted;
}

export async function ingestQueueFiles(files: UploadedPdf[], stubPatch?: unknown) {
  const products = await listMatchableProducts();
  const items: AiIngestItem[] = [];
  for (const file of files) {
    const match = matchProductFromFilename(file.filename, products);
    const item = await storePdfItem(file, match?.id ?? null);
    const product = match ? products.find((candidate) => candidate.id === match.id) ?? null : null;
    items.push(await extractStoredItem(item, {
      stubPatch,
      currentProduct: currentProductPayload(product),
      category: product?.category ?? "",
      existingProduct: Boolean(product),
      productName: product?.name,
    }));
  }
  return items;
}

export async function assignIngestItem(id: number, product: Product, stubPatch?: unknown) {
  const [item] = await db.select().from(aiIngestItemsTable).where(eq(aiIngestItemsTable.id, id));
  if (!item) return null;
  const [assigned] = await db.update(aiIngestItemsTable).set({
    productId: product.id,
    status: item.proposedPatch ? "ready" : "uploaded",
    updatedAt: new Date(),
  }).where(eq(aiIngestItemsTable.id, id)).returning();
  if (assigned.proposedPatch) return assigned;
  return extractStoredItem(assigned, {
    stubPatch,
    currentProduct: currentProductPayload(product),
    category: product.category,
    existingProduct: true,
    productName: product.name,
  });
}

export async function deleteIngestItem(id: number) {
  const [item] = await db.select().from(aiIngestItemsTable).where(eq(aiIngestItemsTable.id, id));
  if (!item) return false;
  await removeStoredFile(item.storageKey);
  await db.delete(aiIngestItemsTable).where(eq(aiIngestItemsTable.id, id));
  return true;
}
