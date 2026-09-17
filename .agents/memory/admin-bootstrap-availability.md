---
name: Admin bootstrap availability
description: Availability boundary between administrator identity provisioning and the public catalogue API.
---

Administrator identity bootstrap must fail admin access closed, but its failure must not stop the API process or public catalogue.

**Why:** Clerk policy or a missing bootstrap setting can prevent administrator provisioning. Treating that as a process-startup failure takes down the unrelated public website.

**How to apply:** Log bootstrap failures prominently, leave unprovisioned administrators unauthorized, and continue serving public endpoints. Never weaken Clerk password or registration policy to make startup pass.