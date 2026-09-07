---
name: Legacy published workbook round-trip
description: Compatibility rule for live catalogue records that predate newly required workbook content.
---

An explicit Published workbook row must satisfy the current publish requirements. A live legacy record that predates those requirements may preserve its lifecycle through a blank-status round-trip only while its required public content remains unchanged.

**Why:** Retained records outside a replacement workbook can be legitimately live yet lack newly introduced fields. Rejecting their unchanged export makes the catalogue impossible to round-trip, while accepting arbitrary blank-status changes would let imports degrade live content or bypass publication rules.

**How to apply:** When publish requirements expand, distinguish explicit publication from lifecycle preservation. Permit unchanged legacy content to round-trip, but reject new publication and any invalidating content change.