---
name: Product editor field docs
description: Field-by-field product editor docs must stay in the same change as catalogue field, visibility, or customer-display updates.
---

Product editor behaviour lives in `docs/product-editor/` (one markdown file per tab, plus `fields.yaml`). Use those files before filling product fields or changing the editor, public product pages, or product API payloads.

When a field is added, moved, or its public behaviour changes, update the matching tab doc and `fields.yaml` in the same change. If section 6 of `CATALOGUE_SYSTEM_GUIDE.md` is then wrong, update that too.

**Why:** Agents and a future MCP need a stable map from editor fields to API paths and customer visibility. Stale tab docs will put private copy on the public site or omit required publish fields.

**How to apply:** Treat `docs/product-editor/` as part of the catalogue contract. Do not invent display behaviour; source it from the editor, `toPublicDetails`, and the public pages. OpenAPI remains authoritative for types.
