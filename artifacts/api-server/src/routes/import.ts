import { Router, type IRouter } from "express";
import { commitWorkbook, dryRunWorkbook, exportWorkbook } from "../lib/workbook";
const router: IRouter = Router();
function content(body: unknown) { return typeof (body as { workbookBase64?: unknown })?.workbookBase64 === "string" ? Buffer.from((body as { workbookBase64: string }).workbookBase64, "base64") : null; }
router.post("/admin/import/dry-run", async (req, res): Promise<void> => { const file = content(req.body); if (!file) { res.status(400).json({ error: "workbookBase64 is required." }); return; } res.json(dryRunWorkbook(file)); });
router.post("/admin/import/commit", async (req, res): Promise<void> => { const file = content(req.body); if (!file || typeof req.body.token !== "string") { res.status(400).json({ error: "workbookBase64 and token are required." }); return; } try { res.json(await commitWorkbook(file, req.body.token)); } catch (e) { res.status(400).json({ error: e instanceof Error ? e.message : "Import failed" }); } });
router.get("/admin/import/export", async (_req, res): Promise<void> => { res.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet").attachment("product-data.xlsx").send(await exportWorkbook()); });
export default router;