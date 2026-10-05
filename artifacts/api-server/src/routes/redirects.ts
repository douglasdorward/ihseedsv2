import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, redirectsTable } from "@workspace/db";
import {
  commitRedirectImport,
  dryRunRedirectImport,
  listRedirects,
  loadManagedRedirectSources,
  REDIRECT_IMPORT_TEMPLATE,
  redirectImportCsvFromBody,
} from "../lib/redirect-import";

const router: IRouter = Router();

router.get("/admin/redirects", async (_req, res): Promise<void> => {
  res.json(await listRedirects());
});

router.get("/admin/redirects/import/template", (_req, res): void => {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="redirect-import-template.csv"');
  res.send(REDIRECT_IMPORT_TEMPLATE);
});

router.post("/admin/redirects/import/dry-run", async (req, res): Promise<void> => {
  const csvText = redirectImportCsvFromBody(req.body);
  if (!csvText.trim()) {
    res.status(400).json({ error: "csvText is required." });
    return;
  }
  res.json(await dryRunRedirectImport(csvText));
});

router.post("/admin/redirects/import/commit", async (req, res): Promise<void> => {
  const csvText = redirectImportCsvFromBody(req.body);
  const token = typeof req.body?.token === "string" ? req.body.token : "";
  if (!csvText.trim() || !token) {
    res.status(400).json({ error: "csvText and token are required." });
    return;
  }
  try {
    res.json(await commitRedirectImport(csvText, token));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Import failed" });
  }
});

router.delete("/admin/redirects/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "Please provide a valid redirect id." });
    return;
  }
  const [redirect] = await db.select().from(redirectsTable).where(eq(redirectsTable.id, id));
  if (!redirect) {
    res.status(404).json({ error: "Redirect not found." });
    return;
  }
  // Product and article editors recreate these from their Legacy website URL, so
  // removing one here would silently come back on the next publish.
  const managed = await loadManagedRedirectSources();
  if (managed.product.has(redirect.fromPath) || managed.article.has(redirect.fromPath)) {
    res.status(409).json({
      error: "This redirect comes from a product or article's Legacy website URL. Remove it in that editor.",
    });
    return;
  }
  await db.delete(redirectsTable).where(eq(redirectsTable.id, id));
  res.status(204).end();
});

export default router;
