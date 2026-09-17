import { Router, type IRouter, type Response } from "express";
import {
  createAdminAccount,
  listAdminAccounts,
  resetAdminTemporaryPassword,
  setAdminDisabled,
} from "../lib/admin-accounts";
import { normalizeAdminEmail } from "../lib/admin-access";

const router: IRouter = Router();
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function requestedEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const email = normalizeAdminEmail(value);
  return email.length <= 320 && EMAIL_PATTERN.test(email) ? email : null;
}

function requestedUserId(value: unknown) {
  return typeof value === "string" && value.trim().length <= 255 ? value.trim() : null;
}

function writeError(res: Response, reason: string) {
  const status = reason === "actor-revoked" ? 403 : 409;
  const message = {
    "actor-revoked": "Superadmin access is required.",
    "already-active": "That email already has an administrator account.",
    "identity-exists": "That email already belongs to an existing sign-in account.",
    "target-not-found": "Administrator account was not found.",
    "protected-superadmin": "The Superadmin account cannot be changed here.",
    "reset-in-progress": "A temporary password is already being issued for this account.",
    "reset-superseded": "A newer temporary password request replaced this one.",
  }[reason] ?? "Unable to change the administrator account.";
  res.status(status).json({ error: message });
}

router.get("/admin/administrators", async (_req, res): Promise<void> => {
  const access = await listAdminAccounts();
  res.set("Cache-Control", "no-store").json({
    ...access,
    currentUserId: res.locals.admin.userId,
  });
});

router.post("/admin/administrators", async (req, res): Promise<void> => {
  const email = requestedEmail(req.body?.email);
  if (!email) {
    res.status(400).json({ error: "Provide a valid email address." });
    return;
  }
  try {
    const result = await createAdminAccount(res.locals.admin, email);
    if (!result.ok) {
      writeError(res, result.reason);
      return;
    }
    res.status(201).set("Cache-Control", "no-store").json({
      success: true,
      temporaryPassword: result.password,
    });
  } catch (error) {
    req.log.error({ error, email }, "Unable to create administrator account");
    res.status(502).json({ error: "The administrator account could not be created." });
  }
});

router.patch("/admin/administrators/:clerkUserId/status", async (req, res): Promise<void> => {
  const clerkUserId = requestedUserId(req.params.clerkUserId);
  if (!clerkUserId || typeof req.body?.disabled !== "boolean") {
    res.status(400).json({ error: "Provide a valid administrator and status." });
    return;
  }
  try {
    const result = await setAdminDisabled(res.locals.admin, clerkUserId, req.body.disabled);
    if (!result.ok) {
      writeError(res, result.reason);
      return;
    }
    res.json({ success: true });
  } catch (error) {
    req.log.error({ error, clerkUserId }, "Unable to change administrator status");
    res.status(502).json({ error: "The administrator status could not be changed." });
  }
});

router.post("/admin/administrators/:clerkUserId/temporary-password", async (req, res): Promise<void> => {
  const clerkUserId = requestedUserId(req.params.clerkUserId);
  if (!clerkUserId) {
    res.status(400).json({ error: "Provide a valid administrator." });
    return;
  }
  try {
    const result = await resetAdminTemporaryPassword(res.locals.admin, clerkUserId);
    if (!result.ok) {
      writeError(res, result.reason);
      return;
    }
    res.set("Cache-Control", "no-store").json({
      success: true,
      temporaryPassword: result.password,
    });
  } catch (error) {
    req.log.error({ error, clerkUserId }, "Unable to reset administrator password");
    res.status(502).json({ error: "A temporary password could not be issued." });
  }
});

export default router;