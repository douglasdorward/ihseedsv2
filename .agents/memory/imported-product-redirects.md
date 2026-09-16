---
name: Imported product redirects
description: Authoritative source and destination rules for catalogue redirects.
---

Only a product's imported Legacy website URL may create a redirect. It must identify the current `www.irwinhunter.com.au` site, and its path redirects to the canonical destination derived from the imported category slug and product slug. A complete catalogue import replaces the entire redirect set; category and product edits do not add redirects automatically.

**Why:** The owner explicitly limited migration scope to URLs on the current website supplied in the replacement workbook. Retaining historical, hardcoded, or automatically generated redirects would make the register broader than the approved migration source.

**How to apply:** Keep `1 Products.website_url` as the sole redirect input, calculate rather than manually import the destination, and treat blank or omitted Legacy website URLs as no redirect.