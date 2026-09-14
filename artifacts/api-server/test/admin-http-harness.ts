import express from "express";
import { clerkMiddleware } from "@clerk/express";
import { requireAdmin } from "../src/middlewares/admin-auth";
import administratorsRouter from "../src/routes/administrators";

// This is the production-mode HTTP composition for the access-management
// surface: real body parsing, Clerk mounting boundary, administrator gate, and
// route handlers. Only Clerk itself is replaced by the adjacent provider mock.
const app = express();
app.use(express.json());
app.use(clerkMiddleware());
app.use("/api/admin", requireAdmin);
app.use("/api", administratorsRouter);

export default app;
export { setTestClerkIdentity } from "./clerk-express-mock";