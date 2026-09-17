import { Router, type IRouter } from "express";
import { getAdminSession } from "../middlewares/admin-auth";
import { completeOwnPasswordChange } from "../lib/admin-accounts";

const router: IRouter = Router();

router.get("/auth/session", async (req, res): Promise<void> => {
  const admin = await getAdminSession(req);
  if (!admin) {
    res.status(401).json({ signedIn: false, authorized: false });
    return;
  }
  res.set("Cache-Control", "no-store").json({
    signedIn: true,
    authorized: true,
    userId: admin.userId,
    email: admin.email,
    role: admin.role,
    mustChangePassword: admin.mustChangePassword,
  });
});

router.post("/auth/password-changed", async (req, res): Promise<void> => {
  const admin = await getAdminSession(req);
  if (!admin) {
    res.status(401).json({ error: "Sign in is required." });
    return;
  }
  await completeOwnPasswordChange(admin);
  res.set("Cache-Control", "no-store").json({ success: true });
});

export default router;
