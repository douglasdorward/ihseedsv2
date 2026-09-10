---
name: Catalogue lifecycle safety
description: Safety invariants for public fallbacks and concurrent product lifecycle changes.
---

Never use a complete static catalogue as a public API fallback once records can be Draft or Archived. Treat empty/error state as safer than resurfacing content the catalogue owner intentionally hid.

All writes that depend on a product's lifecycle state must check that state while holding the same product-row lock used by publish, archive, restore, and draft operations.

Drafts require only Product name, Slug, Category, and Record type. Publishing additionally requires the complete public content set; do not move those publishing requirements into draft saves.

Published products cannot be saved as drafts. Editor changes persist only when Publish succeeds with the current payload; a failed publish must leave the live row unchanged.

Lifecycle tests over the committed workbook must not assert the workbook's original Published/Draft counts. Those counts legitimately change as administrators publish products; assert valid lifecycle states and that drafts remain absent from public APIs instead.

**Why:** A stale fallback can leak retired content during an outage, an unlocked check followed by a write can race publication, over-validating drafts prevents administrators from saving incomplete work safely, parking unpublished revisions on live products reintroduces a second meaning of "draft", and fixed lifecycle counts become false after normal admin actions.

**How to apply:** Preserve the public-data, locking, and draft-vs-publish validation boundaries across the admin UI, API routes, workbook imports, and lifecycle tests. Keep Save draft only for unpublished Draft products. Test lifecycle invariants rather than mutable catalogue totals.
