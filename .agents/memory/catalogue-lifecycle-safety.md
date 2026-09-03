---
name: Catalogue lifecycle safety
description: Safety invariants for public fallbacks and concurrent product lifecycle changes.
---

Never use a complete static catalogue as a public API fallback once records can be Draft or Archived. Treat empty/error state as safer than resurfacing content the catalogue owner intentionally hid.

All writes that depend on a product's lifecycle state must check that state while holding the same product-row lock used by publish, archive, restore, and draft operations.

**Why:** A stale fallback can leak retired content during an outage, while an unlocked check followed by a write can race publication and modify the live row outside the draft workflow.

**How to apply:** When changing public data loading or catalogue mutation routes, preserve these two invariants and include the published-then-edited and concurrent transition cases in verification.