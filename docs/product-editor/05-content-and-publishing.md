# Tab 5 — Content & publishing

Public copy, media, related products, and display flags. Tagline, blurb, at least one key attribute, and description are required to publish.

## Tagline

- **API path:** `details.tagline`
- **Workbook:** `1 Products.tagline`
- **Required:** Draft no / Publish yes
- **Customer website:** Under the H1 on the product hero; category cards; homepage/resource/availability cards; related-product and Also popular subtitles.
- **Public API:** yes
- **Purpose:** Short product promise. Not the SEO title.
- **How to fill:** One line. No ™ or ® (those belong on the product name).
- **Constraints:** max 60 characters.

## Blurb

- **API path:** `details.blurb`
- **Workbook:** `1 Products.blurb`
- **Required:** Draft no / Publish yes
- **Customer website:** Opening paragraph at the top of the product body.
- **Public API:** yes (also SEO-description fallback when SEO description is blank)
- **Purpose:** Concise introduction. Do not repeat the full description.
- **How to fill:** A few sentences. Keep Quick facts out of this paragraph.

## Key attributes

- **API path:** `details.keyAttributes[]`
- **Workbook:** `1 Products.key_attributes` (pipe list)
- **Required:** Draft no / Publish yes (at least one non-blank item)
- **Customer website:** “Key attributes” bullet list.
- **Public API:** yes
- **Purpose:** 5–6 concise strengths.
- **How to fill:** One strength per row, e.g. `Strong winter growth`. Blank rows do not count.

## Description

- **API path:** `details.description`
- **Workbook:** `1 Products.description`
- **Required:** Draft no / Publish yes
- **Customer website:** “About this variety” — blank-line-separated paragraphs are preserved.
- **Public API:** yes
- **Purpose:** The long public story. Do not repeat rainfall, pH, or other Quick facts. Do not include breeder or supplier names.
- **Constraints:** max 200,000 characters. Line breaks are meaningful.

## Distribution note

- **API path:** `details.distributionNote`
- **Workbook:** `1 Products.distribution_note`
- **Required:** no
- **Customer website:** Highlighted info aside when non-blank.
- **Public API:** yes
- **Purpose:** Optional availability or distribution callout. Leave blank on most products.

## Description source

- **API path:** `descriptionSource`
- **Workbook:** `1 Products.description_source`
- **Required:** no
- **Customer website:** not shown
- **Public API:** excluded (admin-only)
- **Purpose:** Provenance of the copy. Max 240 characters.

## Legacy website URL

- **API path:** `websiteUrlLegacy`
- **Workbook:** `1 Products.website_url` / SEO sheet product URL
- **Required:** no
- **Customer website:** not shown as a link. Redirects live in the redirect table, not this field.
- **Public API:** excluded (admin-only)
- **Purpose:** Canonical old-site URL for this product. Extra historical paths belong in redirects.
- **Constraints:** max 500 characters.

## Internal notes

- **API path:** `details.notes`
- **Workbook:** `1 Products.internal_notes`
- **Required:** no
- **Customer website:** not shown
- **Public API:** excluded (admin-only)
- **Purpose:** Staff reminders. On Biologicals this is the same field as Agronomy → Application notes.
- **Constraints:** max 2000 characters.

## Photos

- **API path:** `details.photos[]` (`slot`, `file`, `rating`, `src`)
- **Workbook:** `1 Products.photo_1` (and further slots when present)
- **Required:** no
- **Customer website:** First non-blank `src` is the product-page hero and the default social image. Related-product and Also popular cards use that hero. Category grid cards currently use rotating placeholder images, not these photos.
- **Public API:** yes
- **Purpose:** Product photography. The current editor lists slots; it does not upload new files from this tab.
- **How to fill:** Keep `src` as a real URL. Empty slots are skipped for the hero.

## Tech sheet URL

- **API path:** `techSheet`
- **Workbook:** `1 Products.tech_sheet_pdf_path`
- **Required:** no
- **Customer website:** “Download tech sheet” on the hero when the stored path/URL resolves.
- **Public API:** yes (`techSheet`)
- **Purpose:** Link to the PDF fact sheet.
- **Constraints:** max 240 characters.

## Related products

- **API path:** `details.relatedProducts[]` (slugs)
- **Workbook:** related product slug list on the product row
- **Required:** no
- **Customer website:** “Related products” cards, in listed order, only for slugs that resolve to public products.
- **Public API:** yes
- **How to fill:** Public product slugs. Invalid slugs are omitted on the site.

## Sort order

- **API path:** `details.sortOrder`
- **Workbook:** `1 Products.sort_order`
- **Required:** no
- **Customer website:** not used by the current public pages (category grids prefer featured, then the first sale line’s sort order; Also popular prefers featured, then name)
- **Public API:** excluded (admin-only)
- **Purpose:** Stored catalogue ordering hint for staff/workbook. Do not assume it sorts the website.
- **Constraints:** integer ≥ 0 or blank.

## Featured product

- **API path:** `details.featured`
- **Workbook:** `1 Products.featured`
- **Required:** no
- **Customer website:** Featured products sort first on category grids. Also popular prefers featured products in the same category (up to three).
- **Public API:** yes
- **How to fill:** Check sparingly. This is a merchandising flag, not a lifecycle state.

## Permanent delete

Not a catalogue field. Permanently deletes the product and cascaded sale lines. Use Archive if the product should leave the public site but remain recoverable.
