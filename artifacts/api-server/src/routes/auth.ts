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

router.post("/auth/password", async (req, res): Promise<void> => {
  const admin = await getAdminSession(req);
  if (!admin) {
    res.status(401).json({ error: "Sign in is required." });
    return;
  }
  if (!admin.mustChangePassword) {
    res.status(409).json({ error: "A temporary password change is not required." });
    return;
  }
  const currentPassword = typeof req.body?.currentPassword === "string" ? req.body.currentPassword : "";
  const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";
  if (!currentPassword || newPassword.length < 15 || newPassword.length > 128) {
    res.status(400).json({ error: "Enter the temporary password and choose a new password of at least 15 characters." });
    return;
  }
  try {
    await completeOwnPasswordChange(admin, { currentPassword, newPassword });
    res.set("Cache-Control", "no-store").json({ success: true });
  } catch (error) {
    req.log.warn({ error, userId: admin.userId }, "Administrator password change failed");
    res.status(400).json({ error: "Choose a stronger password and try again." });
  }
});

export default router;
