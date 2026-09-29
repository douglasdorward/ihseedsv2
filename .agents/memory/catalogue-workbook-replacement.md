---
name: Catalogue workbook replacement
description: Records upsert-by-slug semantics for catalogue workbook imports.
---

Match catalogue workbook products by slug. An existing slug is updated, a new slug is inserted, and a product omitted from the Products sheet is left unchanged. For products that are in the file, supported imported values omitted from authoritative keyed sheets are cleared. Preserve retired compatibility fields already stored on matching records because they are intentionally outside the workbook/editor contract.

**Why:** The owner asked imports to add or update products only, using the product slug as the permanent identity, so a partial file cannot delete the rest of the catalogue.

**How to apply:** Keep dry-run and confirmation copy explicit that omitted products stay, and that data for products in the file can still be cleared. Do not delete products whose slugs are absent from sheet 1.
