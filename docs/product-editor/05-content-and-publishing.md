# Tab 5 — Content & publishing

Public copy, media, FAQs, Also popular, and display flags. Tagline, blurb, at least one key attribute, and description are required to publish.

## Tagline

- **API path:** `details.tagline`
- **Workbook:** `1 Products.tagline`
- **Required:** Draft no / Publish yes
- **Customer website:** Under the H1 on the product hero; category cards; homepage/resource/availability cards; Also popular subtitles.
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

## Legacy website URL

- **API path:** `websiteUrlLegacy`
- **Workbook:** `1 Products.website_url`
- **Required:** no
- **Customer website:** not shown as a link. Its old path redirects to this product's calculated `/products/{category-slug}/{slug}` path after workbook import.
- **Public API:** excluded (admin-only)
- **Purpose:** Sole source of the product's redirect from the current Irwin Hunter website.
- **Constraints:** max 500 characters; HTTP(S) URL on `www.irwinhunter.com.au` (or the apex host), without a query or fragment; unique old path.

## Photos

- **API path:** `details.photos[]` (`slot`, `file`, `rating`, `src`, optional `assetId`, `alt`, `format`, dimensions)
- **Workbook:** `1 Products.photo_1` (and further slots when present)
- **Required:** no
- **Customer website:** First non-blank `src` is the product-page hero background and the default social image. Every photo with a `src` is also shown in a Photos card (real `<img>` tags, alt text or the product name): under the sidebar on desktop, after About this variety on mobile. The card is omitted when no photo has a `src`. Also popular cards use the hero. Category grid cards currently use rotating placeholder images, not these photos.
- **Public API:** yes
- **Purpose:** Product photography. The Form tab lists slots. The Product page view uploads or pastes a URL onto the hero (first non-blank `src`).
- **How to fill:** Upload JPEG, PNG, or WebP from the Product page hero, the Form Photos card, or **Images** at `/admin/images`. Uploads are converted to WebP in the shared library and stored as `src=/api/media/{id}` with an `assetId`. Alt text is filled from the product name when the image is uploaded or attached; a library-only upload uses a humanized filename until it is assigned to a product. Editors can change the alt on the photo row. External/WordPress URLs can still be pasted (no `assetId`; they are not converted). AI never fills photos. Deleting from **Images** removes the file even when it is in use on a product, article, or site page; remaining product photos move up into the hero slot when needed.

## Tech sheet URL

- **API path:** `techSheet`
- **Workbook:** `1 Products.tech_sheet_pdf_path`
- **Required:** no
- **Customer website:** “Download tech sheet” is on every published product hero and on the Tech Sheets Hub. It downloads a PDF generated from the product’s catalogue fields in the approved sheet layout. This URL is not that download.
- **Public API:** yes (`techSheet`)
- **Purpose:** Optional source document used to fill product fields. Not the customer download.
- **Constraints:** max 240 characters.
- **How to fill:** Paste an external URL, or use **Fill from PDF** on Form → Basics. That uploads the PDF to durable storage and can set this field to `/api/admin/tech-sheets/{id}/file` after you accept the suggestion. The bulk queue at `/admin/tech-sheets` stores the same files; Open editor applies suggestions into the Basics tab. AI never saves or publishes. Publishing stores a separate generated sheet for customers.

## FAQs

- **API path:** `details.faqs[]` (`question`, `answer`)
- **Workbook:** `10 Product FAQs` (`slug`, `question`, `answer`). Join by product `slug`. One row per FAQ; row order is stored order. A missing sheet leaves stored FAQs unchanged. If a product slug appears on the sheet, its FAQ set is replaced by those rows (max ten).
- **Required:** no
- **Shown when:** Form Content & publishing, and the Product page FAQ band above Also popular
- **Customer website:** “FAQs” accordion band immediately above Also popular. Only items with both a question and an answer are shown. The whole section is omitted when none are complete. Max ten.
- **Public API:** yes (`faqs`)
- **Purpose:** Optional product questions customers ask. Do not repeat Quick facts or the full description.
- **How to fill:** Add a card per question. Leave empty if the product does not need FAQs. Incomplete cards stay in the editor and are hidden from customers.
- **Constraints:** max 10 items. Question max 180 characters. Answer max 4,000 characters.

## Also popular

- **API path:** `details.relatedProducts[]` (slugs; stored name unchanged)
- **Workbook:** related product slug list on the product row
- **Required:** no
- **Shown when:** Form Content & publishing, and the Product page Also popular band
- **Customer website:** “Also popular” cards, max three. The picker only offers Published products with Active or New listing. If a stored pick is later set to Legacy (or is otherwise not public), that slot is filled with another current product from the same category using a slug-seeded shuffle that is stable across loads. An empty list still shows three other Active or New products in the same category. Featured does not rank this list.
- **Public API:** yes (`relatedProducts`)
- **How to fill:** Choose up to three Active or New published products by name. Leave empty for the automatic same-category set.

## Permanent delete

Not a catalogue field. Permanently deletes the product and cascaded sale lines. Use Archive if the product should leave the public site but remain recoverable.
