---
name: Uploaded redirects
description: Administrator-uploaded legacy URL redirects are a separate class from catalogue-derived redirects.
---

Redirects uploaded from Site settings > Legacy URL redirects carry `ih_redirects.source = 'uploaded'`. Catalogue workbook imports must never delete or rebuild them (the import's destination-based delete skips `uploaded`). Paths owned by a product or article's Legacy website URL field cannot be uploaded over; edit them in that editor.

**Why:** The workbook import deletes every redirect whose destination is an imported product's path. Without the marker, an uploaded legacy URL pointing at a product would silently vanish on the next catalogue import.

**How to apply:** Any new code that bulk-deletes or rewrites `ih_redirects` by destination must exclude `source = 'uploaded'`. Uploaded rows are changed or deleted only through the Site settings redirects page.
