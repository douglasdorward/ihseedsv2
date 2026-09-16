import assert from "node:assert/strict";
import test from "node:test";
import { getClerkProxyHost } from "../src/middlewares/clerkProxyMiddleware";

test("Clerk proxy uses the first public forwarded host", () => {
  assert.equal(
    getClerkProxyHost({
      headers: {
        host: "internal.example",
        "x-forwarded-host": "admin.example.com, deployment.internal",
      },
    }),
    "admin.example.com",
  );
});

test("Clerk proxy falls back to the request host", () => {
  assert.equal(
    getClerkProxyHost({ headers: { host: "admin.example.com" } }),
    "admin.example.com",
  );
});