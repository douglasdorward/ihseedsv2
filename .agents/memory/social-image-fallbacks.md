---
name: Social image fallback intent
description: Why blank editor overrides remain dynamic while workbook imports keep their older behavior.
---

Preserve blank social-image overrides on editor saves. Resolve their effective image at display time; do not persist the current hero as an override.

**Why:** Copying the hero during save makes clearing a custom image misleading and prevents future hero changes from being reflected automatically. Existing explicit values cannot safely be distinguished from previously copied values, so do not bulk-clear them.

**How to apply:** Keep editor previews and public metadata on the same resolver. Workbook blank-to-hero import behavior remains an intentional compatibility exception; changing that requires explicit import-contract work and round-trip tests.