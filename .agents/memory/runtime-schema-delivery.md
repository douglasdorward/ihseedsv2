---
name: Runtime schema delivery
description: Why runtime-required database objects need both typed schema declarations and forward SQL migrations.
---

Any new table or other database object required during application startup or request handling must be represented in the Drizzle schema and in a forward SQL migration.

**Why:** Replit Publish applies production schema diffs, while repository lifecycle tests and development setup also exercise the migration ledger. A typed schema declaration alone leaves that separate validation/setup path incomplete. Do not use the migration ledger as a reason to add production startup DDL.

**How to apply:** Add an idempotent forward migration for new runtime-required objects, keep legacy baselining limited to an explicit historical migration set, and test the empty-ledger adoption path before exercising the feature. Apply development schema through the dev-side flow; production schema delivery belongs exclusively to user-initiated Publish, not startup or deploy-build migration scripts.