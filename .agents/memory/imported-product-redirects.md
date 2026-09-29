---
name: Imported product redirects
description: Authoritative source and destination rules for catalogue redirects.
---

Only a product's imported Legacy website URL may create a redirect. It must identify the current `www.irwinhunter.com.au` site, and its path redirects to the canonical destination derived from the imported category slug and product slug. A catalogue import replaces redirects only for products in the file. Redirects for products left out of the file stay. Category and product edits do not add redirects automatically.

**Why:** The owner explicitly limited migration scope to URLs on the current website supplied in the replacement workbook. Retaining historical, hardcoded, or automatically generated redirects would make the register broader than the approved migration source.

**How to apply:** Keep `1 Products.website_url` as the sole redirect input, calculate rather than manually import the destination, and treat a blank Legacy website URL on an imported product as no redirect. Delete existing redirects only when their destination is an imported product's current or previous public path.