import {
  adminAccessAuditTable,
  adminPendingApprovalsTable,
  adminRevocationsTable,
  adminUsersTable,
  db,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { lockAdminAccess, normalizeAdminEmail } from "./admin-access";

export type StoredAdminSession = {
  userId: string;
  email: string;
  role: "admin";
  developmentBypass: false;
};

export function verifiedPrimaryEmail(user: {
  primaryEmailAddressId: string | null;
  emailAddresses: { id: string; emailAddress: string; verification?: { status?: string | null } | null }[];
}): string {
  const primaryEmail = user.emailAddresses.find((email) => email.id === user.primaryEmailAddressId);
  return primaryEmail?.verification?.status === "verified"
    ? primaryEmail.emailAddress.trim().toLowerCase()
    : "";
}

function bootstrapEmails() {
  return new Set(
    (process.env.ADMIN_BOOTSTRAP_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export async function resolveAdminIdentity(
  userId: string,
  verifiedEmail?: string | null,
): Promise<StoredAdminSession | null> {
  const [existing] = await db.select().from(adminUsersTable)
    .where(eq(adminUsersTable.clerkUserId, userId));
  if (existing?.role === "admin") {
    return {
      userId: existing.clerkUserId,
      email: existing.email,
      role: "admin",
      developmentBypass: false,
    };
  }

  const email = verifiedEmail ? normalizeAdminEmail(verifiedEmail) : "";
  if (!email) return null;

  return db.transaction(async (tx) => {
    await lockAdminAccess(tx);
    // An access mutation may have happened after the initial read.
    const [current] = await tx.select().from(adminUsersTable)
      .where(eq(adminUsersTable.clerkUserId, userId)).for("update");
    if (current?.role === "admin") {
      return {
        userId: current.clerkUserId,
        email: current.email,
        role: "admin" as const,
        developmentBypass: false as const,
      };
    }

    const [revoked] = await tx.select({ email: adminRevocationsTable.email })
      .from(adminRevocationsTable).where(eq(adminRevocationsTable.email, email)).for("update");
    // A tombstone wins over an old bootstrap configuration. Only an explicit
    // administrator-created pending approval may clear it.
    if (revoked) return null;

    const [pending] = await tx.select({ email: adminPendingApprovalsTable.email })
      .from(adminPendingApprovalsTable).where(eq(adminPendingApprovalsTable.email, email)).for("update");
    const bootstrap = bootstrapEmails().has(email);
    if (!pending && !bootstrap) return null;

    const [claimedByAnotherIdentity] = await tx.select({ clerkUserId: adminUsersTable.clerkUserId })
      .from(adminUsersTable).where(eq(adminUsersTable.email, email)).for("update");
    if (claimedByAnotherIdentity) return null;

    const [created] = await tx.insert(adminUsersTable).values({
      clerkUserId: userId,
      email,
      role: "admin",
    }).returning();
    if (pending) {
      await tx.delete(adminPendingApprovalsTable).where(eq(adminPendingApprovalsTable.email, email));
    }
    await tx.insert(adminAccessAuditTable).values({
      actorClerkUserId: userId,
      actorEmail: email,
      targetEmail: email,
      action: pending ? "approval_claimed" : "bootstrap_claimed",
    });
    return {
      userId: created.clerkUserId,
      email: created.email,
      role: "admin" as const,
      developmentBypass: false as const,
    };
  });
}