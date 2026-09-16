import { Router, type IRouter } from "express";
import { getAdminSession } from "../middlewares/admin-auth";

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
    email: admin.email,
  });
});

export default router;
