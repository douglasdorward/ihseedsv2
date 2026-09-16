---
name: Invitation-only admin access
description: Security boundaries for synchronizing Clerk registration with the server-owned administrator ledger.
---

Administrator registration must be allowlist-only at Clerk and authorization must remain server-owned. An active session is valid only while its Clerk user still has the exact verified primary email stored in the administrator ledger.

**Why:** Hiding sign-up UI does not prevent Clerk account creation. Separately mutating Clerk and the database can also let cancellation races or stale bootstrap settings recreate a registration path.

**How to apply:** Serialize invite and cancellation effects with the administrator access lock, let revocation tombstones override bootstrap configuration, reconcile restrictions before serving, fail startup closed, and never run reconciliation tests with live Clerk credentials.