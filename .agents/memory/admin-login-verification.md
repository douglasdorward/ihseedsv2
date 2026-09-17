---
name: Administrator login verification
description: Why successful builds and rendered login screenshots were insufficient for the custom Clerk flow.
---

Verify custom authentication by submitting credentials through the installed SDK in a real browser, including password replacement and a dashboard reload. Confirm that a typecheck actually includes the changed frontend source.

**Why:** A bare TypeScript command inherited an empty workspace configuration and passed without checking the admin app. A screenshot rendered normally even though a newer Clerk hook contract left the login button permanently disabled.

**How to apply:** When changing SDK imports or auth routing, check source inclusion and exercise loading, invalid credentials, session activation, mandatory password change, and session persistence. Do not equate a build or a rendered form with working sign-in.

For Clerk recovery, initiate an email factor once, and keep provider password completion separate from application reconciliation retries.

**Why:** Creating a sign-in with the reset strategy already sends a code; immediately preparing that factor again can send a second code and invalidate the first. Once the password reset completes, repeating it on the completed attempt cannot repair a failed application request.

**How to apply:** Create an identifier-only attempt then prepare the selected factor once. Retry only reconciliation after provider completion. For server-side evidence, use the authoritative password-update timestamp, never the general user-update timestamp, which unrelated profile changes can advance.