import express, { type Express } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import router from "./routes";
import { logger } from "./lib/logger";
import { publicRedirectTo } from "./lib/public-redirect";
import { requireAdmin } from "./middlewares/admin-auth";

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
// PDF extract/tech-sheet uploads need a higher bound than the workbook path.
app.use((req, res, next) => {
  const large = req.originalUrl.startsWith("/api/admin/ai") || req.originalUrl.startsWith("/api/admin/tech-sheets");
  express.json({ limit: large ? "25mb" : "10mb" })(req, res, next);
});
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// A real HTTP redirect for legacy public product URLs. When no redirect is
// registered, control passes to the hosting platform's SPA fallback.
app.get("/product/:slug", async (req, res, next): Promise<void> => {
  const toPath = await publicRedirectTo(req.path);
  if (!toPath) { next(); return; }
  res.redirect(301, toPath);
});

if (process.env.NODE_ENV !== "development" && process.env.CLERK_SECRET_KEY) {
  app.use(clerkMiddleware());
}
app.use("/api/admin", requireAdmin);
app.use("/api", router);
app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));

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
