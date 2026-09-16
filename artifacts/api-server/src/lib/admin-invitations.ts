import { clerkClient } from "@clerk/express";
import {
  adminPendingApprovalsTable,
  adminRevocationsTable,
  adminUsersTable,
  db,
} from "@workspace/db";
import { normalizeAdminEmail } from "./admin-access";

function configuredBootstrapEmails() {
  return (process.env.ADMIN_BOOTSTRAP_EMAILS ?? "")
    .split(",")
    .map(normalizeAdminEmail)
    .filter(Boolean);
}

async function allowlistEntries() {
  const entries = [];
  let offset = 0;
  while (true) {
    const result = await clerkClient.allowlistIdentifiers.getAllowlistIdentifierList({
      limit: 500,
      offset,
    });
    entries.push(...result.data);
    offset += result.data.length;
    if (result.data.length === 0 || offset >= result.totalCount) return entries;
  }
}

export async function ensureAllowedAdminEmail(email: string) {
  const normalized = normalizeAdminEmail(email);
  const entries = await allowlistEntries();
  const existing = entries.find((entry) => normalizeAdminEmail(entry.identifier) === normalized);
  if (existing) return { id: existing.id, created: false };
  const created = await clerkClient.allowlistIdentifiers.createAllowlistIdentifier({
    identifier: normalized,
    notify: false,
  });
  return { id: created.id, created: true };
}

export async function removeAllowedAdminEmail(email: string) {
  const normalized = normalizeAdminEmail(email);
  const entries = await allowlistEntries();
  await Promise.all(
    entries
      .filter((entry) => normalizeAdminEmail(entry.identifier) === normalized)
      .map((entry) => clerkClient.allowlistIdentifiers.deleteAllowlistIdentifier(entry.id)),
  );
}

export async function sendAdministratorInvitation(email: string) {
  const normalized = normalizeAdminEmail(email);
  const existingUsers = await clerkClient.users.getUserList({ emailAddress: [normalized], limit: 10 });
  const existingUser = existingUsers.data.some((user) =>
    user.emailAddresses.some((address) => normalizeAdminEmail(address.emailAddress) === normalized));
  if (existingUser) return { sent: false as const };
  const existingInvitations = await clerkClient.invitations.getInvitationList({
    query: normalized,
    status: "pending",
    limit: 100,
  });
  if (existingInvitations.data.some((invitation) =>
    normalizeAdminEmail(invitation.emailAddress) === normalized)) {
    return { sent: false as const };
  }

  await clerkClient.invitations.createInvitation({
    emailAddress: normalized,
    notify: true,
    redirectUrl: "/admin/invitation",
    publicMetadata: { ihSeedsAdministratorInvitation: true },
  });
  return { sent: true as const };
}

export async function revokeAdministratorInvitations(email: string) {
  const normalized = normalizeAdminEmail(email);
  const invitations = await clerkClient.invitations.getInvitationList({
    query: normalized,
    status: "pending",
    limit: 100,
  });
  await Promise.all(
    invitations.data
      .filter((invitation) => normalizeAdminEmail(invitation.emailAddress) === normalized)
      .map((invitation) => clerkClient.invitations.revokeInvitation(invitation.id)),
  );
}

export async function configureInvitationOnlyClerk() {
  if (process.env.NODE_ENV === "test" && process.env.ADMIN_TEST_BYPASS === "1") return;

  await clerkClient.instance.updateRestrictions({ allowlist: true });
  const [active, pending, revoked, entries] = await Promise.all([
    db.select({ email: adminUsersTable.email }).from(adminUsersTable),
    db.select({ email: adminPendingApprovalsTable.email }).from(adminPendingApprovalsTable),
    db.select({ email: adminRevocationsTable.email }).from(adminRevocationsTable),
    allowlistEntries(),
  ]);
  const revokedEmails = new Set(revoked.map(({ email }) => normalizeAdminEmail(email)));
  const bootstrapEmails = configuredBootstrapEmails()
    .filter((email) => !revokedEmails.has(email));
  const allowed = new Set([
    ...bootstrapEmails,
    ...active.map(({ email }) => normalizeAdminEmail(email)),
    ...pending.map(({ email }) => normalizeAdminEmail(email)),
  ]);

  for (const email of allowed) {
    if (!entries.some((entry) => normalizeAdminEmail(entry.identifier) === email)) {
      await clerkClient.allowlistIdentifiers.createAllowlistIdentifier({
        identifier: email,
        notify: false,
      });
    }
  }
  await Promise.all(
    entries
      .filter((entry) => !allowed.has(normalizeAdminEmail(entry.identifier)))
      .map((entry) => clerkClient.allowlistIdentifiers.deleteAllowlistIdentifier(entry.id)),
  );

  const activeEmails = new Set(active.map(({ email }) => normalizeAdminEmail(email)));
  for (const email of bootstrapEmails) {
    if (!activeEmails.has(email)) {
      await sendAdministratorInvitation(email);
    }
  }
}