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

/**
 * Test-only Clerk provider boundary. The HTTP harness configures this module
 * directly; no request header, cookie, or client-provided identity is trusted.
 */
export function setTestClerkIdentity(identity: MockIdentity | null) {
  currentIdentity = identity;
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
  },
};

export function clerkMiddleware(): RequestHandler {
  return (_req, _res, next) => next();
}