---
name: Catalogue taxonomy draft integrity
description: Integrity rules for taxonomy changes when leftover product revisions may still be stored as JSON snapshots.
---

Taxonomy deletion must treat IDs referenced by leftover product drafts as in use, even though those references are stored in JSON rather than protected by a foreign key. Root renames must keep live product display labels aligned, and any leftover snapshots that still exist. Inactive taxonomy may be retained for an existing assignment but cannot be newly selected or published as a changed assignment.

**Why:** A leftover unpublished revision is still a release candidate until it is discarded or published. Deleting or deactivating its newly selected taxonomy can otherwise make it impossible to publish, while stale denormalized labels make category renames appear inconsistent.

**How to apply:** Whenever taxonomy mutation or product lifecycle behavior changes, test live assignments and any leftover draft snapshots together, including rename, deactivate, delete, publish, and restore.
