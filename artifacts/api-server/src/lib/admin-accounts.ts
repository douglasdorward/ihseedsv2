import { randomBytes, randomUUID } from "node:crypto";
import { clerkClient } from "@clerk/express";
import {
  adminAccessAuditTable,
  adminPendingApprovalsTable,
  adminRevocationsTable,
  adminUsersTable,
  db,
} from "@workspace/db";
import { and, asc, desc, eq, isNotNull } from "drizzle-orm";
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
  const target = await db.transaction(async (tx) => {
    await lockAdminAccess(tx);
    if (!await activeSuperadmin(tx, actor)) return { ok: false as const, reason: "actor-revoked" as const };
    const [stored] = await tx.select().from(adminUsersTable)
      .where(eq(adminUsersTable.clerkUserId, clerkUserId)).for("update");
    if (!stored) return { ok: false as const, reason: "target-not-found" as const };
    if (stored.role === "superadmin") return { ok: false as const, reason: "protected-superadmin" as const };
    if (disabled) {
      await tx.update(adminUsersTable).set({
        disabledAt: stored.disabledAt ?? new Date(),
        updatedAt: new Date(),
      }).where(eq(adminUsersTable.clerkUserId, clerkUserId));
      await audit(tx, actor, stored.email, "account_disable_requested");
    }
    return { ok: true as const, email: stored.email };
  });
  if (!target.ok) return target;

  if (disabled) {
    // Persist local denial first. A Clerk failure leaves the account blocked by
    // this application and the same operation can safely be retried.
    await clerkClient.users.banUser(clerkUserId);
    return { ok: true as const };
  }

  // Provider access is restored first; the ledger remains disabled unless the
  // final transaction commits, so a partial failure cannot grant app access.
  await clerkClient.users.unbanUser(clerkUserId);
  return db.transaction(async (tx) => {
    await lockAdminAccess(tx);
    if (!await activeSuperadmin(tx, actor)) return { ok: false as const, reason: "actor-revoked" as const };
    const [stored] = await tx.select().from(adminUsersTable)
      .where(eq(adminUsersTable.clerkUserId, clerkUserId)).for("update");
    if (!stored) return { ok: false as const, reason: "target-not-found" as const };
    if (stored.role === "superadmin") return { ok: false as const, reason: "protected-superadmin" as const };
    await tx.update(adminUsersTable).set({
      disabledAt: null,
      updatedAt: new Date(),
    }).where(eq(adminUsersTable.clerkUserId, clerkUserId));
    await audit(tx, actor, stored.email, "account_restored");
    return { ok: true as const };
  });
}

export async function resetAdminTemporaryPassword(actor: AdminSession, clerkUserId: string) {
  const password = temporaryPassword();
  const operationId = randomUUID();
  const prepared = await db.transaction(async (tx) => {
    await lockAdminAccess(tx);
    if (!await activeSuperadmin(tx, actor)) return { ok: false as const, reason: "actor-revoked" as const };
    const [target] = await tx.select().from(adminUsersTable)
      .where(eq(adminUsersTable.clerkUserId, clerkUserId)).for("update");
    if (!target) return { ok: false as const, reason: "target-not-found" as const };
    if (target.role === "superadmin") return { ok: false as const, reason: "protected-superadmin" as const };
    if (target.passwordOperationId) return { ok: false as const, reason: "reset-in-progress" as const };
    await tx.update(adminUsersTable).set({
      mustChangePassword: true,
      passwordOperationId: operationId,
      updatedAt: new Date(),
    }).where(eq(adminUsersTable.clerkUserId, clerkUserId));
    return { ok: true as const };
  });
  if (!prepared.ok) return prepared;
  try {
    return await db.transaction(async (tx) => {
      await lockAdminAccess(tx);
      const [target] = await tx.select().from(adminUsersTable)
        .where(eq(adminUsersTable.clerkUserId, clerkUserId)).for("update");
      if (!target || target.passwordOperationId !== operationId) {
        return { ok: false as const, reason: "reset-superseded" as const };
      }
      // The row lock prevents password completion from racing the provider
      // update. The durable operation id remains set if this transaction fails.
      await clerkClient.users.updateUser(clerkUserId, {
        password,
        signOutOfOtherSessions: true,
      });
      await tx.update(adminUsersTable).set({
        mustChangePassword: true,
        passwordOperationId: null,
        updatedAt: new Date(),
      }).where(eq(adminUsersTable.clerkUserId, clerkUserId));
      await audit(tx, actor, target.email, "temporary_password_reset_requested");
      return { ok: true as const, password };
    });
  } catch (error) {
    // Keep mandatory change enabled but release a failed operation so the
    // Superadmin can issue a replacement password immediately.
    await db.update(adminUsersTable).set({
      mustChangePassword: true,
      passwordOperationId: null,
      updatedAt: new Date(),
    }).where(and(
      eq(adminUsersTable.clerkUserId, clerkUserId),
      eq(adminUsersTable.passwordOperationId, operationId),
    )).catch(() => undefined);
    throw error;
  }
}

export async function completeOwnPasswordChange(
  actor: AdminSession,
  passwords: { currentPassword: string; newPassword: string },
) {
  await db.transaction(async (tx) => {
    await lockAdminAccess(tx);
    const [stored] = await tx.select().from(adminUsersTable)
      .where(eq(adminUsersTable.clerkUserId, actor.userId)).for("update");
    if (!stored || stored.disabledAt) throw new Error("Administrator access is unavailable.");
    if (!stored.mustChangePassword) throw new Error("A temporary password change is not required.");
    if (stored.passwordOperationId) throw new Error("A temporary password reset is in progress.");
    await clerkClient.users.verifyPassword({
      userId: actor.userId,
      password: passwords.currentPassword,
    });
    await clerkClient.users.updateUser(actor.userId, {
      password: passwords.newPassword,
    });
    await tx.update(adminUsersTable).set({
      mustChangePassword: false,
      updatedAt: new Date(),
    }).where(eq(adminUsersTable.clerkUserId, actor.userId));
  });
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
  // No password mutation can survive a process restart. Release abandoned
  // operation ownership while retaining fail-closed mandatory-change state.
  await db.update(adminUsersTable).set({
    passwordOperationId: null,
    mustChangePassword: true,
    updatedAt: new Date(),
  }).where(isNotNull(adminUsersTable.passwordOperationId));

  const [stored] = await db.select().from(adminUsersTable).where(eq(adminUsersTable.email, email));
  const existingUsers = await clerkClient.users.getUserList({ emailAddress: [email], limit: 10 });
  if (existingUsers.data.length > 1) {
    throw new Error("The configured Superadmin email matches multiple Clerk users.");
  }
  let user = existingUsers.data[0];
  if (user) {
    const primary = user.emailAddresses?.find((address) => address.id === user.primaryEmailAddressId);
    if (
      primary?.verification?.status !== "verified"
      || normalizeAdminEmail(primary.emailAddress) !== email
    ) {
      throw new Error("The configured Superadmin email must be the verified primary email in Clerk.");
    }
  }
  if (stored?.role === "superadmin" && !stored.disabledAt) {
    if (!user || user.id !== stored.clerkUserId) {
      throw new Error("The configured Superadmin ledger does not match the Clerk identity.");
    }
    const entries = await allAllowlistEntries();
    await Promise.all(entries.map((entry) =>
      clerkClient.allowlistIdentifiers.deleteAllowlistIdentifier(entry.id)));
    return;
  }
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