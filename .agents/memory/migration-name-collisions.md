---
name: Migration name collisions
description: How to reconcile a database when an already-recorded migration name produced a different table shape.
---

Treat the migration journal as immutable even when an applied migration name created a schema that differs from the current migration file. Add a new idempotent forward migration that detects and reconciles the alternate shape.

**Why:** Existing databases may have already recorded the migration checksum, while fresh databases run the current file. `CREATE TABLE IF NOT EXISTS` then hides incompatible columns and constraints instead of repairing them.

Never run or accept a Drizzle schema push against an existing database; after-merge setup applies the numbered SQL migrations only. The Drizzle schema omits tables, checks, indexes and foreign keys that migrations create, so a push proposes truncating redirects and dropping the migration journal and media structures. Push is only for provisioning an empty database. Migrations from 0040 onward must be idempotent because journal-less baselining never skips them.

**Why:** An unattended push once blocked every merge on truncate/drop prompts; accepting them would have deleted redirects and schema.

**How to apply:** Inspect the live columns and constraints, preserve existing data, and make the next migration safe for both the alternate existing schema and the current fresh schema.