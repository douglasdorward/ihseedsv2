---
name: Catalogue data backfills
description: Safety rule for correcting previously seeded or published catalogue data.
---

Catalogue corrections must run as persisted, one-time data migrations. Do not reconcile known records on normal API reads, even when matching exact legacy values.

**Why:** A request-time correction can later mistake an intentional admin-published value for legacy data and silently overwrite it after the draft has been promoted and removed.

**How to apply:** Put targeted corrections in the migration system, guard them by the exact legacy state and lifecycle constraints, and test both the upgrade path and a later intentional admin edit.