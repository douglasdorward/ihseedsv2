import {
  adminUsersTable,
  db,
} from "@workspace/db";
import { and, eq, isNull } from "drizzle-orm";
import { normalizeAdminEmail } from "./admin-access";

export type StoredAdminSession = {
  userId: string;
  email: string;
  role: "admin" | "superadmin";
  mustChangePassword: boolean;
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

export async function resolveAdminIdentity(
  userId: string,
  verifiedEmail?: string | null,
): Promise<StoredAdminSession | null> {
  const email = verifiedEmail ? normalizeAdminEmail(verifiedEmail) : "";
  if (!email) return null;
  const [existing] = await db.select().from(adminUsersTable)
    .where(and(
      eq(adminUsersTable.clerkUserId, userId),
      eq(adminUsersTable.email, email),
      isNull(adminUsersTable.disabledAt),
    ));
  if (!existing || (existing.role !== "admin" && existing.role !== "superadmin")) return null;
  return {
    userId: existing.clerkUserId,
    email: existing.email,
    role: existing.role,
    mustChangePassword: existing.mustChangePassword,
  };
}