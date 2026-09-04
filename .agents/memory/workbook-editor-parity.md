---
name: Workbook and editor parity
description: Ensures catalogue imports remain editable after workbook validation and commit.
---

Treat workbook acceptance and admin-editor acceptance as one contract: every imported record must pass the same draft-save schema without truncation, coercion, or manual cleanup.

**Why:** A workbook can pass its own Lists-driven validation while older editor enums and length limits still reject otherwise valid imported values and source copy.

**How to apply:** After any workbook or Lists change, round-trip the export through the importer and run all imported records through the draft-save schema. Preserve intentional blanks such as TBA availability rather than translating them to a different business state.