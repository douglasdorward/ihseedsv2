import {
  cancelAdministratorApproval,
  createAdministratorApproval,
  listAdministratorAccess,
  normalizeAdminEmail,
  revokeAdministratorAccess,
} from "../lib/admin-access";
import {
  ensureAllowedAdminEmail,
  removeAllowedAdminEmail,
  revokeAdministratorInvitations,
  sendAdministratorInvitation,
} from "../lib/admin-invitations";
import {
  CreateAdministratorApprovalBody,
  CreateAdministratorApprovalResponse,
  DeleteAdministratorApprovalBody,
  DeleteAdministratorApprovalResponse,
  GetAdministratorsResponse,
  RevokeAdministratorAccessBody,
  RevokeAdministratorAccessResponse,
} from "@workspace/api-zod";
import { Router, type IRouter, type Response } from "express";

const router: IRouter = Router();
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function requestedEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const email = normalizeAdminEmail(value);
  return email.length <= 320 && EMAIL_PATTERN.test(email) ? email : null;
}

function writeError(res: Response, reason: string) {
  if (reason === "actor-revoked") {
    res.status(403).json({ error: "Administrator access was revoked." });
    return;
  }
  const message = {
    "already-active": "That email already has administrator access.",
    "already-pending": "That email already has a pending approval.",
    "not-pending": "That email does not have a pending approval.",
    "target-not-found": "Administrator access was not found.",
    "last-admin": "The final active administrator cannot be revoked.",
  }[reason] ?? "Unable to change administrator access.";
  res.status(409).json({ error: message });
}

router.get("/admin/administrators", async (req, res): Promise<void> => {
  const access = await listAdministratorAccess();
  const response = GetAdministratorsResponse.parse({ ...access, currentUserId: res.locals.admin.userId });
  res.set("Cache-Control", "no-store").json(response);
});

router.post("/admin/administrators/approvals", async (req, res): Promise<void> => {
  const parsed = CreateAdministratorApprovalBody.safeParse(req.body);
  const email = parsed.success ? requestedEmail(parsed.data.email) : null;
  if (!email) {
    res.status(400).json({ error: "Provide a valid email address." });
    return;
  }
  let allowlistEntry: { id: string; created: boolean } | null = null;
  try {
    const result = await createAdministratorApproval(res.locals.admin, email, async () => {
      allowlistEntry = await ensureAllowedAdminEmail(email);
      try {
        await sendAdministratorInvitation(email);
      } catch (error) {
        if (allowlistEntry?.created) {
          await removeAllowedAdminEmail(email).catch(() => undefined);
        }
        throw error;
      }
    });
    if (!result.ok) {
      writeError(res, result.reason);
      return;
    }
    res.json(CreateAdministratorApprovalResponse.parse({ success: true }));
  } catch (error) {
    req.log.error({ error, email }, "Unable to send administrator invitation");
    res.status(502).json({ error: "The administrator invitation could not be sent. No access was granted." });
  }
});

router.delete("/admin/administrators/approvals", async (req, res): Promise<void> => {
  const parsed = DeleteAdministratorApprovalBody.safeParse(req.body);
  const email = parsed.success ? requestedEmail(parsed.data.email) : null;
  if (!email) {
    res.status(400).json({ error: "Provide a valid email address." });
    return;
  }
  try {
    const result = await cancelAdministratorApproval(res.locals.admin, email, async () => {
      await revokeAdministratorInvitations(email);
      await removeAllowedAdminEmail(email);
    });
    if (!result.ok) {
      writeError(res, result.reason);
      return;
    }
  } catch (error) {
    req.log.error({ error, email }, "Unable to revoke administrator invitation");
    res.status(502).json({ error: "The invitation could not be cancelled. Try again." });
    return;
  }
  res.json(DeleteAdministratorApprovalResponse.parse({ success: true }));
});

router.delete("/admin/administrators/access", async (req, res): Promise<void> => {
  const parsed = RevokeAdministratorAccessBody.safeParse(req.body);
  const clerkUserId = parsed.success ? parsed.data.clerkUserId.trim() : "";
  if (!clerkUserId) {
    res.status(400).json({ error: "Provide a valid administrator id." });
    return;
  }
  const result = await revokeAdministratorAccess(res.locals.admin, clerkUserId);
  if (!result.ok) {
    writeError(res, result.reason);
    return;
  }
  res.json(RevokeAdministratorAccessResponse.parse({ success: true }));
});

export default router;