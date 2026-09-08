---
name: Legacy product URLs
description: How workbook product URLs and duplicate historical aliases are represented during the site migration.
---

Each product keeps one canonical old-site product URL in its admin-only legacy URL field. Additional historical URLs that resolve to the same current product belong in the redirect map rather than being concatenated into that field.

**Why:** The Website SEO workbook can contain multiple historical rows resolving to one product. The admin product field is singular, while redirects must preserve every old path for SEO migration.

**How to apply:** Import the canonical old URL from the workbook row matching the current product slug. Retain duplicate or alternate website slugs as separate permanent redirect records.