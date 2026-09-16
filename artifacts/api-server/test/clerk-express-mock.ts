import type { RequestHandler } from "express";

type MockEmailAddress = {
  id: string;
  emailAddress: string;
  verification?: { status?: string | null } | null;
};

type MockIdentity = {
  userId: string;
  primaryEmailAddressId: string | null;
  emailAddresses: MockEmailAddress[];
};

let currentIdentity: MockIdentity | null = null;
let nextId = 1;
const invitations: { id: string; emailAddress: string; status: "pending" | "revoked" }[] = [];
const allowlistIdentifiers: { id: string; identifier: string }[] = [];
let allowlistEnabled = false;

/**
 * Test-only Clerk provider boundary. The HTTP harness configures this module
 * directly; no request header, cookie, or client-provided identity is trusted.
 */
export function setTestClerkIdentity(identity: MockIdentity | null) {
  currentIdentity = identity;
}

export function getTestClerkOperations() {
  return {
    invitations: invitations.map((invitation) => ({ ...invitation })),
    allowlistIdentifiers: allowlistIdentifiers.map((entry) => ({ ...entry })),
    allowlistEnabled,
  };
}

export function resetTestClerkOperations() {
  invitations.splice(0);
  allowlistIdentifiers.splice(0);
  allowlistEnabled = false;
  nextId = 1;
}

export function getAuth() {
  return { userId: currentIdentity?.userId ?? null };
}

export const clerkClient = {
  users: {
    async getUser(userId: string) {
      if (!currentIdentity || currentIdentity.userId !== userId) {
        throw new Error("Mock Clerk user was not configured.");
      }
      return currentIdentity;
    },
    async getUserList({ emailAddress = [] }: { emailAddress?: string[] } = {}) {
      const matches = currentIdentity && currentIdentity.emailAddresses.some((address) =>
        emailAddress.some((email) => email.toLowerCase() === address.emailAddress.toLowerCase()))
        ? [currentIdentity]
        : [];
      return { data: matches, totalCount: matches.length };
    },
  },
  invitations: {
    async createInvitation({ emailAddress }: { emailAddress: string }) {
      const invitation = {
        id: `invitation-${nextId++}`,
        emailAddress,
        status: "pending" as const,
      };
      invitations.push(invitation);
      return invitation;
    },
    async getInvitationList({ query, status }: { query?: string; status?: string } = {}) {
      const matches = invitations.filter((invitation) =>
        (!query || invitation.emailAddress.toLowerCase() === query.toLowerCase())
        && (!status || invitation.status === status));
      return { data: matches, totalCount: matches.length };
    },
    async revokeInvitation(invitationId: string) {
      const invitation = invitations.find(({ id }) => id === invitationId);
      if (!invitation) throw new Error("Mock Clerk invitation was not found.");
      invitation.status = "revoked";
      return invitation;
    },
  },
  allowlistIdentifiers: {
    async getAllowlistIdentifierList() {
      return { data: allowlistIdentifiers, totalCount: allowlistIdentifiers.length };
    },
    async createAllowlistIdentifier({ identifier }: { identifier: string }) {
      const entry = { id: `allowlist-${nextId++}`, identifier };
      allowlistIdentifiers.push(entry);
      return entry;
    },
    async deleteAllowlistIdentifier(id: string) {
      const index = allowlistIdentifiers.findIndex((entry) => entry.id === id);
      if (index >= 0) allowlistIdentifiers.splice(index, 1);
      return { id, object: "allowlist_identifier", deleted: true };
    },
  },
  instance: {
    async updateRestrictions({ allowlist }: { allowlist?: boolean }) {
      if (allowlist !== undefined) allowlistEnabled = allowlist;
    },
  },
};

export function clerkMiddleware(): RequestHandler {
  return (_req, _res, next) => next();
}