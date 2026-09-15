import { clerkClient, getAuth } from "@clerk/express";
import type { NextFunction, Request, Response } from "express";
import { resolveAdminIdentity, verifiedPrimaryEmail } from "../lib/admin-role";

export type AdminSession = {
  userId: string;
  email: string;
  role: "admin";
  developmentBypass: boolean;
};

function isDevelopmentBypass() {
  return process.env.NODE_ENV === "development";
}

async function resolveAdmin(req: Request): Promise<AdminSession | null> {
  if (isDevelopmentBypass()) {
    return {
      userId: "development-admin",
      email: "development@ihseeds.local",
      role: "admin",
      developmentBypass: true,
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
    if (isDevelopmentBypass()) {
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
    res.locals.admin = admin;
    next();
  } catch (error) {
    req.log.error({ error }, "Admin authorization failed");
    res.status(500).json({ error: "Unable to verify administrator access." });
  }
}