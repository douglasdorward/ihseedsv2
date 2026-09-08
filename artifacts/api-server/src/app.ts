import express, { type Express } from "express";
import { fileURLToPath } from "node:url";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { db, redirectsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
// Catalogue workbooks are posted as base64 JSON for a validation-first import.
// Keep this bounded, but above the size of the maintained product workbook.
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// A real HTTP redirect for legacy public product URLs. When no redirect is
// registered, control passes to the hosting platform's SPA fallback.
app.get("/product/:slug", async (req, res, next): Promise<void> => {
  const [redirect] = await db.select().from(redirectsTable).where(eq(redirectsTable.fromPath, req.path));
  if (!redirect) { next(); return; }
  res.redirect(301, redirect.toPath);
});

app.use("/api", router);

// The admin remains the existing Vite application. Express only delivers its
// compiled files so Next.js can reserve the public routes for server rendering.
const adminDistDir = fileURLToPath(
  new URL("../../claude-design/dist/public", import.meta.url),
);
const sendAdminIndex = (_req: express.Request, res: express.Response) =>
  res.sendFile("index.html", { root: adminDistDir });
app.get("/admin", sendAdminIndex);
app.use(
  "/admin",
  express.static(adminDistDir),
  sendAdminIndex,
);

export default app;
