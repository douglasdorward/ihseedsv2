---
name: Administrator login verification
description: Why successful builds and rendered login screenshots were insufficient for the custom Clerk flow.
---

Verify custom authentication by submitting credentials through the installed SDK in a real browser, including password replacement and a dashboard reload. Confirm that a typecheck actually includes the changed frontend source.

**Why:** A bare TypeScript command inherited an empty workspace configuration and passed without checking the admin app. A screenshot rendered normally even though a newer Clerk hook contract left the login button permanently disabled.

**How to apply:** When changing SDK imports or auth routing, check source inclusion and exercise loading, invalid credentials, session activation, mandatory password change, and session persistence. Do not equate a build or a rendered form with working sign-in.