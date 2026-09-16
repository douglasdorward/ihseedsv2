import {
  adminAccessAuditTable,
  adminPendingApprovalsTable,
  adminRevocationsTable,
  adminUsersTable,
  db,
} from "@workspace/db";
import { asc, desc, eq, sql } from "drizzle-orm";
import type { AdminSession } from "../middlewares/admin-auth";

type AdminAccessTx = any;

export type AccessWriteResult =
  | { ok: true }
  | { ok: false; reason: "actor-revoked" | "already-active" | "already-pending" | "not-pending" | "target-not-found" | "last-admin" };

export type AdministratorList = {
  administrators: { clerkUserId: string; email: string; createdAt: Date }[];
  pendingApprovals: { email: string; createdAt: Date }[];
  audit: { id: number; actorEmail: string; targetEmail: string; action: string; createdAt: Date }[];
};

export function normalizeAdminEmail(value: string) {
  return value.trim().toLowerCase();
}

export async function lockAdminAccess(tx: AdminAccessTx) {
  // Every access-changing path (including bootstrap/approval claims) takes
  // this lock. It serializes the count-and-delete last-admin check.
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('ih_admin_access'))`);
}

async function activeActor(tx: AdminAccessTx, actor: AdminSession) {
  const [stored] = await tx.select({ role: adminUsersTable.role })
    .from(adminUsersTable)
    .where(eq(adminUsersTable.clerkUserId, actor.userId))
    .for("update");
  return stored?.role === "admin";
}

async function audit(
  tx: AdminAccessTx,
  actor: AdminSession,
  targetEmail: string,
  action: string,
) {
  await tx.insert(adminAccessAuditTable).values({
    actorClerkUserId: actor.userId,
    actorEmail: actor.email,
    targetEmail,
    action,
  });
}

export async function listAdministratorAccess(): Promise<AdministratorList> {
  const [administrators, pendingApprovals, auditRows] = await Promise.all([
    db.select({
      clerkUserId: adminUsersTable.clerkUserId,
      email: adminUsersTable.email,
      createdAt: adminUsersTable.createdAt,
    }).from(adminUsersTable).orderBy(asc(adminUsersTable.email)),
    db.select({
      email: adminPendingApprovalsTable.email,
      createdAt: adminPendingApprovalsTable.createdAt,
    }).from(adminPendingApprovalsTable).orderBy(asc(adminPendingApprovalsTable.createdAt)),
    db.select({
      id: adminAccessAuditTable.id,
      actorEmail: adminAccessAuditTable.actorEmail,
      targetEmail: adminAccessAuditTable.targetEmail,
      action: adminAccessAuditTable.action,
      createdAt: adminAccessAuditTable.createdAt,
    }).from(adminAccessAuditTable).orderBy(desc(adminAccessAuditTable.createdAt), desc(adminAccessAuditTable.id)),
  ]);
  return { administrators, pendingApprovals, audit: auditRows };
}

export async function createAdministratorApproval(
  actor: AdminSession,
  email: string,
): Promise<AccessWriteResult> {
  return db.transaction(async (tx) => {
    await lockAdminAccess(tx);
    if (!await activeActor(tx, actor)) return { ok: false, reason: "actor-revoked" };
    const [active] = await tx.select({ clerkUserId: adminUsersTable.clerkUserId })
      .from(adminUsersTable).where(eq(adminUsersTable.email, email)).for("update");
    if (active) return { ok: false, reason: "already-active" };
    const [pending] = await tx.select({ email: adminPendingApprovalsTable.email })
      .from(adminPendingApprovalsTable).where(eq(adminPendingApprovalsTable.email, email)).for("update");
    if (pending) return { ok: false, reason: "already-pending" };
    // Re-approval is intentional authorization, so it is the sole operation
    // that may clear a previous revocation tombstone.
    await tx.delete(adminRevocationsTable).where(eq(adminRevocationsTable.email, email));
    await tx.insert(adminPendingApprovalsTable).values({ email });
    await audit(tx, actor, email, "approval_created");
    return { ok: true };
  });
}

export async function cancelAdministratorApproval(
  actor: AdminSession,
  email: string,
): Promise<AccessWriteResult> {
  return db.transaction(async (tx) => {
    await lockAdminAccess(tx);
    if (!await activeActor(tx, actor)) return { ok: false, reason: "actor-revoked" };
    const [deleted] = await tx.delete(adminPendingApprovalsTable)
      .where(eq(adminPendingApprovalsTable.email, email)).returning({ email: adminPendingApprovalsTable.email });
    if (!deleted) return { ok: false, reason: "not-pending" };
    // Cancelling an approval is an explicit denial too. This keeps an old
    // bootstrap allowlist from authorizing the cancelled address.
    await tx.insert(adminRevocationsTable).values({ email, clerkUserId: null, createdAt: new Date() })
      .onConflictDoUpdate({
        target: adminRevocationsTable.email,
        set: { clerkUserId: null, createdAt: new Date() },
      });
    await audit(tx, actor, email, "approval_cancelled");
    return { ok: true };
  });
}

export async function revokeAdministratorAccess(
  actor: AdminSession,
  clerkUserId: string,
): Promise<AccessWriteResult> {
  return db.transaction(async (tx) => {
    await lockAdminAccess(tx);
    if (!await activeActor(tx, actor)) return { ok: false, reason: "actor-revoked" };
    const [target] = await tx.select().from(adminUsersTable)
      .where(eq(adminUsersTable.clerkUserId, clerkUserId)).for("update");
    if (!target) return { ok: false, reason: "target-not-found" };
    const active = await tx.select({ clerkUserId: adminUsersTable.clerkUserId }).from(adminUsersTable);
    if (active.length <= 1) return { ok: false, reason: "last-admin" };
    await tx.delete(adminUsersTable).where(eq(adminUsersTable.clerkUserId, clerkUserId));
    await tx.insert(adminRevocationsTable).values({
      email: target.email,
      clerkUserId: target.clerkUserId,
      createdAt: new Date(),
    }).onConflictDoUpdate({
      target: adminRevocationsTable.email,
      set: { clerkUserId: target.clerkUserId, createdAt: new Date() },
    });
    await audit(tx, actor, target.email, "access_revoked");
    return { ok: true };
  });
}