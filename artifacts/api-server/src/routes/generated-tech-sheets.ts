import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, isActiveListing, productsTable } from "@workspace/db";
import { getStoredFile, putStoredFile } from "../lib/app-storage";
import { canStoreGeneratedTechSheet, generatedTechSheetKey, TECH_SHEET_REFRESH_HEADER } from "../lib/generated-tech-sheet";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const router: IRouter = Router();

async function publishedProduct(slug: string) {
  const [product] = await db.select().from(productsTable).where(eq(productsTable.slug, slug));
  if (!product || product.publishStatus !== "Published" || !isActiveListing(product)) return null;
  return product;
}

router.get("/generated-tech-sheets/:slug", async (req, res): Promise<void> => {
  const slug = String(req.params.slug);
  if (!SLUG.test(slug) || !(await publishedProduct(slug))) {
    res.status(404).end();
    return;
  }
  const file = await getStoredFile(generatedTechSheetKey(slug));
  if (!file) {
    res.status(404).end();
    return;
  }
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Cache-Control", "no-store");
  res.send(file.bytes);
});

router.put("/generated-tech-sheets/:slug", async (req, res): Promise<void> => {
  const header = req.get(TECH_SHEET_REFRESH_HEADER);
  if (!canStoreGeneratedTechSheet(req.socket.remoteAddress, header)) {
    res.status(403).json({ error: "Tech sheet storage is only available locally." });
    return;
  }
  const slug = String(req.params.slug);
  const body = req.body;
  if (!SLUG.test(slug) || !Buffer.isBuffer(body) || body.length < 5 || body.subarray(0, 5).toString() !== "%PDF-") {
    res.status(400).json({ error: "A PDF body is required." });
    return;
  }
  if (!(await publishedProduct(slug))) {
    res.status(404).json({ error: "Product not found." });
    return;
  }
  await putStoredFile(generatedTechSheetKey(slug), body, "application/pdf");
  res.status(204).end();
});

export default router;
