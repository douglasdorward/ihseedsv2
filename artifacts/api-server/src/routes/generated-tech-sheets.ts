import { Router, type IRouter, type Request } from "express";
import { eq } from "drizzle-orm";
import { db, isActiveListing, productsTable } from "@workspace/db";
import { getStoredFile, putStoredFile, storedFileExists } from "../lib/app-storage";
import {
  canStoreGeneratedTechSheet,
  generatedTechSheetKey,
  isTechSheetSlug,
  isTechSheetVersion,
  removeGeneratedTechSheets,
  TECH_SHEET_REFRESH_HEADER,
} from "../lib/generated-tech-sheet";

const router: IRouter = Router();

async function publishedProduct(slug: string) {
  const [product] = await db.select().from(productsTable).where(eq(productsTable.slug, slug));
  if (!product || product.publishStatus !== "Published" || !isActiveListing(product)) return null;
  return product;
}

function sheetParams(req: Request) {
  const slug = String(req.params.slug);
  const version = String(req.params.version);
  return isTechSheetSlug(slug) && isTechSheetVersion(version) ? { slug, version } : null;
}

router.head("/generated-tech-sheets/:slug/:version", async (req, res): Promise<void> => {
  const params = sheetParams(req);
  if (!params || !(await publishedProduct(params.slug))) {
    res.status(404).end();
    return;
  }
  const exists = await storedFileExists(generatedTechSheetKey(params.slug, params.version));
  res.setHeader("Cache-Control", "no-store");
  res.status(exists ? 200 : 404).end();
});

router.get("/generated-tech-sheets/:slug/:version", async (req, res): Promise<void> => {
  const params = sheetParams(req);
  if (!params || !(await publishedProduct(params.slug))) {
    res.status(404).end();
    return;
  }
  const file = await getStoredFile(generatedTechSheetKey(params.slug, params.version));
  if (!file) {
    res.status(404).end();
    return;
  }
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Cache-Control", "no-store");
  res.send(file.bytes);
});

router.put("/generated-tech-sheets/:slug/:version", async (req, res): Promise<void> => {
  const header = req.get(TECH_SHEET_REFRESH_HEADER);
  if (!canStoreGeneratedTechSheet(header)) {
    res.status(403).json({ error: "Tech sheet storage is only available to the website." });
    return;
  }
  const params = sheetParams(req);
  const body = req.body;
  if (!params || !Buffer.isBuffer(body) || body.length < 5 || body.subarray(0, 5).toString() !== "%PDF-") {
    res.status(400).json({ error: "A PDF body is required." });
    return;
  }
  if (!(await publishedProduct(params.slug))) {
    res.status(404).json({ error: "Product not found." });
    return;
  }
  await putStoredFile(generatedTechSheetKey(params.slug, params.version), body, "application/pdf");
  try {
    await removeGeneratedTechSheets(params.slug, params.version);
  } catch (err) {
    req.log.warn({ err, slug: params.slug }, "Superseded tech sheets could not be removed");
  }
  res.status(204).end();
});

export default router;
