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
  passwordEnabled?: boolean;
  updatedAt?: number;
  raw?: { password_last_updated_at?: number | null } | null;
  passwordForVerification?: string;
};

let currentIdentity: MockIdentity | null = null;
let currentSession: { id: string; userId: string; status: string; createdAt: number } | null = null;
let nextId = 1;
const invitations: { id: string; emailAddress: string; status: "pending" | "revoked" }[] = [];
const allowlistIdentifiers: { id: string; identifier: string }[] = [];
const users: {
  id: string;
  emailAddresses: MockEmailAddress[];
  banned: boolean;
  passwordUpdated: boolean;
}[] = [];
const userUpdates: { userId: string; signOutOfOtherSessions: boolean | undefined }[] = [];
let allowlistEnabled = false;

/**
 * Test-only Clerk provider boundary. The HTTP harness configures this module
 * directly; no request header, cookie, or client-provided identity is trusted.
 */
export function setTestClerkIdentity(identity: MockIdentity | null) {
  currentIdentity = identity;
}

export function setTestClerkSession(session: typeof currentSession) {
  currentSession = session;
}

export function getTestClerkOperations() {
  return {
    invitations: invitations.map((invitation) => ({ ...invitation })),
    allowlistIdentifiers: allowlistIdentifiers.map((entry) => ({ ...entry })),
    users: users.map((user) => ({ ...user, emailAddresses: user.emailAddresses.map((email) => ({ ...email })) })),
    userUpdates: userUpdates.map((update) => ({ ...update })),
    allowlistEnabled,
  };
}

export function resetTestClerkOperations() {
  invitations.splice(0);
  allowlistIdentifiers.splice(0);
  users.splice(0);
  userUpdates.splice(0);
  allowlistEnabled = false;
  nextId = 1;
  currentSession = null;
}

export function getAuth() {
  return { userId: currentIdentity?.userId ?? null, sessionId: currentSession?.id ?? null };
}

export const clerkClient = {
  users: {
    async getUser(userId: string) {
      if (currentIdentity?.userId === userId) return currentIdentity;
      const user = users.find((candidate) => candidate.id === userId);
      if (user) return user;
      throw new Error("Mock Clerk user was not configured.");
    },
    async getUserList({ emailAddress = [] }: { emailAddress?: string[] } = {}) {
      const candidates = [...users, ...(currentIdentity ? [currentIdentity] : [])];
      const matches = candidates.filter((candidate) => candidate.emailAddresses.some((address) =>
        emailAddress.some((email) => email.toLowerCase() === address.emailAddress.toLowerCase())));
      return { data: matches, totalCount: matches.length };
    },
    async createUser({ emailAddress }: { emailAddress: string[] }) {
      const user = {
        id: `user-${nextId++}`,
        emailAddresses: emailAddress.map((email, index) => ({
          id: `email-${nextId++}`,
          emailAddress: email,
          verification: { status: "verified" },
          ...(index === 0 ? { primary: true } : {}),
        })),
        banned: false,
        passwordUpdated: false,
      };
      users.push(user);
      return user;
    },
    async updateUser(userId: string, params: { signOutOfOtherSessions?: boolean } = {}) {
      userUpdates.push({ userId, signOutOfOtherSessions: params.signOutOfOtherSessions });
      if (currentIdentity?.userId === userId) return currentIdentity;
      const user = users.find((candidate) => candidate.id === userId);
      if (!user) throw new Error("Mock Clerk user was not found.");
      user.passwordUpdated = true;
      return user;
    },
    async verifyPassword({ userId, password }: { userId: string; password: string }) {
      if (
        currentIdentity?.userId !== userId
        || !password
        || (currentIdentity.passwordForVerification && currentIdentity.passwordForVerification !== password)
      ) {
        throw new Error("Password verification failed.");
      }
      return { verified: true as const };
    },
    async deleteUser(userId: string) {
      const index = users.findIndex((candidate) => candidate.id === userId);
      if (index >= 0) users.splice(index, 1);
    },
    async banUser(userId: string) {
      const user = users.find((candidate) => candidate.id === userId);
      if (!user) throw new Error("Mock Clerk user was not found.");
      user.banned = true;
      return user;
    },
    async unbanUser(userId: string) {
      const user = users.find((candidate) => candidate.id === userId);
      if (!user) throw new Error("Mock Clerk user was not found.");
      user.banned = false;
      return user;
    },
  },
  sessions: {
    async getSession(sessionId: string) {
      if (!currentSession || currentSession.id !== sessionId) throw new Error("Mock Clerk session was not configured.");
      return currentSession;
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