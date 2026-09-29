---
name: Migration name collisions
description: How to reconcile a database when an already-recorded migration name produced a different table shape.
---

Treat the migration journal as immutable even when an applied migration name created a schema that differs from the current migration file. Add a new idempotent forward migration that detects and reconciles the alternate shape.

**Why:** Existing databases may have already recorded the migration checksum, while fresh databases run the current file. `CREATE TABLE IF NOT EXISTS` then hides incompatible columns and constraints instead of repairing them.

The after-merge schema push can stop to ask whether to truncate the redirects table, because the live unique constraint on the redirect source path has a different name from the one the schema expects. Never accept truncation. Apply the numbered SQL migrations with the database package's migrate script instead.

**Why:** The redirects table holds imported legacy-URL redirects. Truncating it loses that data even though the constraint itself is already equivalent.

**How to apply:** Inspect the live columns and constraints, preserve existing data, and make the next migration safe for both the alternate existing schema and the current fresh schema.