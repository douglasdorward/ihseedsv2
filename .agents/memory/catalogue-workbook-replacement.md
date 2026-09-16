---
name: Catalogue workbook replacement
description: Records the accepted destructive semantics for catalogue workbook imports.
---

Treat an uploaded catalogue workbook as the complete replacement product catalogue. Products omitted from the Products sheet are deleted, and supported imported values omitted from authoritative keyed sheets are cleared. Preserve retired compatibility fields already stored on matching records because they are intentionally outside the workbook/editor contract.

**Why:** The user explicitly accepted possible data loss to make the back-office export the master file and requested a prominent export-and-backup warning before import.

**How to apply:** Keep dry-run and confirmation copy explicit about deletion and clearing. Any future partial-import feature must be a separate, clearly selected mode rather than weakening replacement semantics.