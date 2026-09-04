---
name: Catalogue taxonomy draft integrity
description: Integrity rules for taxonomy changes when product revisions are stored as JSON snapshots.
---

Taxonomy deletion must treat IDs referenced by pending product drafts as in use, even though those references are stored in JSON rather than protected by a foreign key. Root renames must keep live and draft display labels aligned. Inactive taxonomy may be retained for an existing assignment but cannot be newly selected or promoted from a changed draft.

**Why:** A pending product revision is a legitimate release candidate. Deleting or deactivating its newly selected taxonomy can otherwise make it impossible to publish, while stale denormalized labels make category renames appear inconsistent.

**How to apply:** Whenever taxonomy mutation or product lifecycle behavior changes, test live assignments and pending draft snapshots together, including rename, deactivate, delete, publish, and restore.