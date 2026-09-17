import { clerkClient, getAuth } from "@clerk/express";
import type { NextFunction, Request, Response } from "express";
import { resolveAdminIdentity, verifiedPrimaryEmail } from "../lib/admin-role";

export type AdminSession = {
  userId: string;
  email: string;
  role: "admin" | "superadmin";
  mustChangePassword: boolean;
  testBypass?: true;
};

function isIsolatedTestBypass() {
  return process.env.NODE_ENV === "test"
    && process.env.ADMIN_TEST_BYPASS === "1"
    && /^ih_catalogue_test_\d+_\d+$/.test(process.env.CATALOGUE_TEST_DATABASE ?? "");
}

async function resolveAdmin(req: Request): Promise<AdminSession | null> {
  if (isIsolatedTestBypass()) {
    return {
      userId: "isolated-lifecycle-test",
      email: "lifecycle-test@example.test",
      role: "admin",
      mustChangePassword: false,
      testBypass: true,
    };
  }
  const auth = getAuth(req);
  if (!auth.userId) return null;

  const user = await clerkClient.users.getUser(auth.userId);
  const email = verifiedPrimaryEmail(user);
  return resolveAdminIdentity(auth.userId, email);
}

export async function getAdminSession(req: Request): Promise<AdminSession | null> {
  return resolveAdmin(req);
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (isIsolatedTestBypass()) {
      res.locals.admin = await resolveAdmin(req);
      next();
      return;
    }
    const auth = getAuth(req);
    if (!auth.userId) {
      res.status(401).json({ error: "Sign in is required." });
      return;
    }
    const admin = await resolveAdmin(req);
    if (!admin) {
      res.status(403).json({ error: "Administrator access is required." });
      return;
    }
    if (admin.mustChangePassword) {
      res.status(428).json({ error: "Change your temporary password before continuing." });
      return;
    }
    res.locals.admin = admin;
    next();
  } catch (error) {
    req.log.error({ error }, "Admin authorization failed");
    res.status(500).json({ error: "Unable to verify administrator access." });
  }
}

export async function requireSuperadmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  await requireAdmin(req, res, () => {
    const admin = res.locals.admin as AdminSession | undefined;
    if (admin?.role !== "superadmin") {
      res.status(403).json({ error: "Superadmin access is required." });
      return;
    }
    next();
  });
}