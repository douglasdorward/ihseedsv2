import { randomBytes } from "node:crypto";
import { clerkClient } from "@clerk/express";
import {
  adminAccessAuditTable,
  adminPendingApprovalsTable,
  adminRevocationsTable,
  adminUsersTable,
  db,
} from "@workspace/db";
import { asc, desc, eq } from "drizzle-orm";
import type { AdminSession } from "../middlewares/admin-auth";
import { lockAdminAccess, normalizeAdminEmail } from "./admin-access";
import { ensureAllowedAdminEmail, removeAllowedAdminEmail } from "./admin-invitations";

type AdminAccountTx = any;

function temporaryPassword() {
  return `${randomBytes(18).toString("base64url")}aA1!`;
}

async function audit(tx: AdminAccountTx, actor: AdminSession, targetEmail: string, action: string) {
  await tx.insert(adminAccessAuditTable).values({
    actorClerkUserId: actor.userId,
    actorEmail: actor.email,
    targetEmail,
    action,
  });
}

async function activeSuperadmin(tx: AdminAccountTx, actor: AdminSession) {
  if (actor.testBypass) return true;
  const [stored] = await tx.select().from(adminUsersTable)
    .where(eq(adminUsersTable.clerkUserId, actor.userId))
    .for("update");
  return stored?.role === "superadmin" && !stored.disabledAt;
}

export async function listAdminAccounts() {
  const [administrators, auditRows] = await Promise.all([
    db.select({
      clerkUserId: adminUsersTable.clerkUserId,
      email: adminUsersTable.email,
      role: adminUsersTable.role,
      disabledAt: adminUsersTable.disabledAt,
      mustChangePassword: adminUsersTable.mustChangePassword,
      createdAt: adminUsersTable.createdAt,
    }).from(adminUsersTable).orderBy(asc(adminUsersTable.email)),
    db.select({
      id: adminAccessAuditTable.id,
      actorEmail: adminAccessAuditTable.actorEmail,
      targetEmail: adminAccessAuditTable.targetEmail,
      action: adminAccessAuditTable.action,
      createdAt: adminAccessAuditTable.createdAt,
    }).from(adminAccessAuditTable)
      .orderBy(desc(adminAccessAuditTable.createdAt), desc(adminAccessAuditTable.id))
      .limit(100),
  ]);
  return { administrators, audit: auditRows };
}

export async function createAdminAccount(actor: AdminSession, emailValue: string) {
  const email = normalizeAdminEmail(emailValue);
  const password = temporaryPassword();
  const existingClerk = await clerkClient.users.getUserList({ emailAddress: [email], limit: 10 });
  if (existingClerk.data.length > 0) return { ok: false as const, reason: "identity-exists" as const };

  await ensureAllowedAdminEmail(email);
  let user;
  try {
    user = await clerkClient.users.createUser({
      emailAddress: [email],
      password,
      skipLegalChecks: true,
    });
  } finally {
    await removeAllowedAdminEmail(email).catch(() => undefined);
  }
  try {
    const result = await db.transaction(async (tx) => {
      await lockAdminAccess(tx);
      if (!await activeSuperadmin(tx, actor)) return { ok: false as const, reason: "actor-revoked" as const };
      const [existing] = await tx.select().from(adminUsersTable)
        .where(eq(adminUsersTable.email, email)).for("update");
      if (existing) return { ok: false as const, reason: "already-active" as const };
      await tx.insert(adminUsersTable).values({
        clerkUserId: user.id,
        email,
        role: "admin",
        mustChangePassword: true,
      });
      await tx.delete(adminPendingApprovalsTable).where(eq(adminPendingApprovalsTable.email, email));
      await tx.delete(adminRevocationsTable).where(eq(adminRevocationsTable.email, email));
      await audit(tx, actor, email, "account_created");
      return { ok: true as const, password };
    });
    if (!result.ok) await clerkClient.users.deleteUser(user.id);
    return result;
  } catch (error) {
    await clerkClient.users.deleteUser(user.id).catch(() => undefined);
    throw error;
  }
}

export async function setAdminDisabled(actor: AdminSession, clerkUserId: string, disabled: boolean) {
  return db.transaction(async (tx) => {
    await lockAdminAccess(tx);
    if (!await activeSuperadmin(tx, actor)) return { ok: false as const, reason: "actor-revoked" as const };
    const [target] = await tx.select().from(adminUsersTable)
      .where(eq(adminUsersTable.clerkUserId, clerkUserId)).for("update");
    if (!target) return { ok: false as const, reason: "target-not-found" as const };
    if (target.role === "superadmin") return { ok: false as const, reason: "protected-superadmin" as const };
    if (disabled) await clerkClient.users.banUser(clerkUserId);
    else await clerkClient.users.unbanUser(clerkUserId);
    await tx.update(adminUsersTable).set({
      disabledAt: disabled ? new Date() : null,
      updatedAt: new Date(),
    }).where(eq(adminUsersTable.clerkUserId, clerkUserId));
    await audit(tx, actor, target.email, disabled ? "account_disabled" : "account_restored");
    return { ok: true as const };
  });
}

export async function resetAdminTemporaryPassword(actor: AdminSession, clerkUserId: string) {
  const password = temporaryPassword();
  return db.transaction(async (tx) => {
    await lockAdminAccess(tx);
    if (!await activeSuperadmin(tx, actor)) return { ok: false as const, reason: "actor-revoked" as const };
    const [target] = await tx.select().from(adminUsersTable)
      .where(eq(adminUsersTable.clerkUserId, clerkUserId)).for("update");
    if (!target) return { ok: false as const, reason: "target-not-found" as const };
    if (target.role === "superadmin") return { ok: false as const, reason: "protected-superadmin" as const };
    await clerkClient.users.updateUser(clerkUserId, {
      password,
      signOutOfOtherSessions: true,
    });
    await tx.update(adminUsersTable).set({
      mustChangePassword: true,
      updatedAt: new Date(),
    }).where(eq(adminUsersTable.clerkUserId, clerkUserId));
    await audit(tx, actor, target.email, "temporary_password_reset");
    return { ok: true as const, password };
  });
}

export async function completeOwnPasswordChange(actor: AdminSession) {
  await db.update(adminUsersTable).set({
    mustChangePassword: false,
    updatedAt: new Date(),
  }).where(eq(adminUsersTable.clerkUserId, actor.userId));
}

async function allAllowlistEntries() {
  const entries = [];
  let offset = 0;
  while (true) {
    const page = await clerkClient.allowlistIdentifiers.getAllowlistIdentifierList({ limit: 500, offset });
    entries.push(...page.data);
    offset += page.data.length;
    if (page.data.length === 0 || offset >= page.totalCount) return entries;
  }
}

async function revokePendingInvitations() {
  let offset = 0;
  while (true) {
    const page = await clerkClient.invitations.getInvitationList({ status: "pending", limit: 100, offset });
    await Promise.all(page.data.map((invitation) => clerkClient.invitations.revokeInvitation(invitation.id)));
    if (page.data.length === 0 || offset + page.data.length >= page.totalCount) return;
    offset += page.data.length;
  }
}

export async function configureSimpleAdminAccounts() {
  if (process.env.NODE_ENV === "test" && process.env.ADMIN_TEST_BYPASS === "1") return;
  const email = normalizeAdminEmail(process.env.ADMIN_SUPERADMIN_EMAIL ?? "");
  const password = process.env.ADMIN_SUPERADMIN_INITIAL_PASSWORD ?? "";
  if (!email || password.length < 15) {
    throw new Error("ADMIN_SUPERADMIN_EMAIL and an ADMIN_SUPERADMIN_INITIAL_PASSWORD of at least 15 characters are required.");
  }

  await clerkClient.instance.updateRestrictions({ allowlist: true });
  await revokePendingInvitations();

  const [stored] = await db.select().from(adminUsersTable).where(eq(adminUsersTable.email, email));
  if (stored?.role === "superadmin" && !stored.disabledAt) {
    const entries = await allAllowlistEntries();
    await Promise.all(entries.map((entry) =>
      clerkClient.allowlistIdentifiers.deleteAllowlistIdentifier(entry.id)));
    return;
  }

  const existingUsers = await clerkClient.users.getUserList({ emailAddress: [email], limit: 10 });
  let user = existingUsers.data[0];
  if (!user) {
    await ensureAllowedAdminEmail(email);
    try {
      user = await clerkClient.users.createUser({
        emailAddress: [email],
        password,
        skipLegalChecks: true,
      });
    } finally {
      await removeAllowedAdminEmail(email).catch(() => undefined);
    }
  } else {
    await clerkClient.users.updateUser(user.id, { password, signOutOfOtherSessions: true });
  }

  await db.transaction(async (tx) => {
    await lockAdminAccess(tx);
    await tx.update(adminUsersTable).set({ role: "admin", updatedAt: new Date() })
      .where(eq(adminUsersTable.role, "superadmin"));
    await tx.delete(adminUsersTable).where(eq(adminUsersTable.email, email));
    await tx.insert(adminUsersTable).values({
      clerkUserId: user.id,
      email,
      role: "superadmin",
      disabledAt: null,
      mustChangePassword: true,
    });
    await tx.delete(adminPendingApprovalsTable).where(eq(adminPendingApprovalsTable.email, email));
    await tx.delete(adminRevocationsTable).where(eq(adminRevocationsTable.email, email));
    await tx.insert(adminAccessAuditTable).values({
      actorClerkUserId: user.id,
      actorEmail: email,
      targetEmail: email,
      action: "superadmin_bootstrapped",
    });
  });

  const entries = await allAllowlistEntries();
  await Promise.all(entries.map((entry) =>
    clerkClient.allowlistIdentifiers.deleteAllowlistIdentifier(entry.id)));
}