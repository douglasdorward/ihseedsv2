---
name: Catalogue lifecycle safety
description: Safety invariants for public fallbacks, lifecycle changes, and destructive catalogue tests.
---

Never use a complete static catalogue as a public API fallback once records can be Draft or Archived. Treat empty/error state as safer than resurfacing content the catalogue owner intentionally hid.

All writes that depend on a product's lifecycle state must check that state while holding the same product-row lock used by publish, archive, restore, and draft operations.

Drafts require only Product name, Slug, Category, and Record type. Publishing additionally requires the complete public content set; do not move those publishing requirements into draft saves.

Published products cannot be saved as drafts. Editor changes persist only when Publish succeeds with the current payload; a failed publish must leave the live row unchanged.

Lifecycle tests over the committed workbook must not assert the workbook's original Published/Draft counts. Those counts legitimately change as administrators publish products; assert valid lifecycle states and that drafts remain absent from public APIs instead.

A leftover `/product/{slug}` redirect from a previous Legacy listing must not hide that product after it is published as Active. Redirect lookup should return the live nested `/products/{category}/{slug}` path instead of the leftover category target.

The destructive catalogue lifecycle suite must run in a disposable database cloned from the development schema without data. Never point it at the shared development or production database. Drizzle schema push cannot reliably bootstrap an empty isolated schema in this workspace because its introspection assumes declared tables already exist.

**Why:** A stale fallback can leak retired content during an outage, an unlocked check followed by a write can race publication, over-validating drafts prevents administrators from saving incomplete work safely, parking unpublished revisions on live products reintroduces a second meaning of "draft", fixed lifecycle counts become false after normal admin actions, and a shared-database lifecycle run once erased the owner's imported catalogue.

**How to apply:** Preserve the public-data, locking, and draft-vs-publish validation boundaries across the admin UI, API routes, workbook imports, and lifecycle tests. Keep Save draft only for unpublished Draft products. Test lifecycle invariants rather than mutable catalogue totals. For destructive tests, copy schema definitions only into a generated database, migrate and seed there, verify `current_database()` before starting, and drop it in `finally`.
