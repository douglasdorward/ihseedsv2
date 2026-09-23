import express, { type Express } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import router from "./routes";
import { logger } from "./lib/logger";
import { publicRedirectTo } from "./lib/public-redirect";
import { requireAdmin, requireSuperadmin } from "./middlewares/admin-auth";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";

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
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
// Catalogue workbooks are posted as base64 JSON for a validation-first import.
// PDF extract/tech-sheet uploads need a higher bound than the workbook path.
app.use((req, res, next) => {
  const path = req.originalUrl.split("?")[0];
  if (
    req.method === "PUT"
    && (
      /^\/api\/admin\/media\/[^/]+\/object$/.test(path)
      || /^\/api\/generated-tech-sheets\/[^/]+$/.test(path)
    )
  ) {
    express.raw({ type: "*/*", limit: "12mb" })(req, res, next);
    return;
  }
  const large = path.startsWith("/api/admin/ai")
    || path.startsWith("/api/admin/tech-sheets")
    || path.startsWith("/api/admin/site-settings")
    || path.startsWith("/api/admin/articles/import")
    || path.startsWith("/api/admin/categories/faqs/import");
  express.json({ limit: large ? "25mb" : "10mb" })(req, res, next);
});
app.use((req, res, next) => {
  const requestPath = req.originalUrl.split("?")[0];
  if (
    req.method === "PUT"
    && (
      /^\/api\/admin\/media\/[^/]+\/object$/.test(requestPath)
      || /^\/api\/generated-tech-sheets\/[^/]+$/.test(requestPath)
    )
  ) {
    next();
    return;
  }
  express.urlencoded({ extended: true, limit: "10mb" })(req, res, next);
});

// A real HTTP redirect for legacy public product URLs. When no redirect is
// registered, control passes to the hosting platform's SPA fallback.
app.get("/product/:slug", async (req, res, next): Promise<void> => {
  const toPath = await publicRedirectTo(req.path);
  if (!toPath) { next(); return; }
  res.redirect(301, toPath);
});

app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);
app.use("/api/admin/administrators", requireSuperadmin);
app.use("/api/admin", requireAdmin);
app.use("/api", router);
app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));

// The admin remains the existing Vite application. Express only delivers its
// compiled files so Next.js can reserve the public routes for server rendering.
const adminDistDir = fileURLToPath(
  new URL("../../claude-design/dist/public", import.meta.url),
);
const sendAdminIndex = (_req: express.Request, res: express.Response) => {
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.sendFile("index.html", { root: adminDistDir });
};
app.use("/admin/sign-up", (_req, res) => {
  res.redirect(302, "/admin/sign-in");
});
app.use("/admin", (_req, res, next) => {
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  next();
});
app.get("/admin", sendAdminIndex);
app.use(
  "/admin",
  express.static(adminDistDir),
  sendAdminIndex,
);

export default app;
