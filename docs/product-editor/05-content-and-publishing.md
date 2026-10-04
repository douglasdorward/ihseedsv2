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
- **Customer website:** “About this variety”, “About this seed blend” when the record type is Mix, or “About this product” in Biologicals — blank-line-separated paragraphs are preserved.
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
- **Customer website:** not shown as a link. Each old path redirects to this product's calculated `/products/{category-slug}/{slug}` path (workbook import, or publishing in the back-office). If the product's listing state is Legacy, every old path goes straight to the category page `/products/{category-slug}` instead, with a temporary (302) redirect.
- **Public API:** excluded (admin-only)
- **Purpose:** Sole source of the product's redirects from the current Irwin Hunter website. One field holds several old addresses separated with ` | ` (a space, a pipe, a space).
- **Constraints:** max 2000 characters in total and at most 12 addresses; each an HTTP(S) URL on `www.irwinhunter.com.au` (or the apex host), without a query or fragment; each old path used once across the catalogue.

## Photos

- **API path:** `details.photos[]` (`slot`, `file`, `rating`, `src`, optional `assetId`, `alt`, `format`, dimensions)
- **Workbook:** `1 Products.photo_1`, `photo_2`, and `photo_3`
- **Required:** no
- **Customer website:** First non-blank `src` is the product-page hero background and the social image when no Social sharing image override is set (then the Site settings sharing image, then `/social-share-default.jpg`; see Tab 6). Every photo with a `src` is also shown in a Photos card (real `<img>` tags, alt text or the product name): under the sidebar on desktop, after the description section on mobile. The card is omitted when no photo has a `src`. Also popular cards use the hero. Category grid cards currently use rotating placeholder images, not these photos.
- **Public API:** yes
- **Purpose:** Product photography. The Form tab lists slots. The Product page view uploads or pastes a URL onto the hero (first non-blank `src`).
- **How to fill:** Upload JPEG, PNG, or WebP from the Product page hero, the Form Photos card, or **Images** at `/admin/images`. Uploads are compressed in the browser (longest side 2400 px) and stored as WebP at `src=/api/media/{id}` with an `assetId`. Alt text is filled from the product name when the image is uploaded or attached; a library-only upload uses a humanized filename until it is assigned to a product. Editors can change the alt on the photo row. In **Images**, the plus button on a card's "Appears on" line assigns that image as the hero of a chosen product (existing photos move down) or a chosen blog article (replacing its hero; a published article updates immediately); the grid can also be sorted by file name. External/WordPress URLs can still be pasted (no `assetId`; they are not converted). Workbook import exports all three photo addresses. A `/api/media/{id}` cell reconnects that library file and copies its alt text onto the product photo. Any other address is stored as the photo and is not linked in the library. A blank cell leaves that slot unset, and `NULL` clears it. AI never fills photos. Deleting from **Images** removes the file even when it is in use on a product, article, or site page; remaining product photos move up into the hero slot when needed.

## Tech sheet URL

- **API path:** `techSheet`
- **Workbook:** `1 Products.tech_sheet_pdf_path`
- **Required:** no
- **Customer website:** “Download tech sheet” is on every published product hero and on the Tech Sheets Hub. It downloads a PDF generated from the product’s published catalogue fields in the approved sheet layout, and always matches the live product page: publishing, stock-status changes, category renames, workbook imports, and hero photo changes all produce a fresh sheet, and the old stored copy is removed. Archiving or deleting a product removes its stored sheet. This URL is not that download.
- **Public API:** yes (`techSheet`)
- **Purpose:** Optional source document used to fill product fields. Not the customer download.
- **Constraints:** max 240 characters.
- **How to fill:** Paste an external URL, or use **Fill from PDF** on Form → Basics. That uploads the PDF to durable storage and can set this field to `/api/admin/tech-sheets/{id}/file` after you accept the suggestion. The bulk queue at `/admin/tech-sheets` stores the same files; Open editor applies suggestions into the Basics tab. AI never saves or publishes. Publishing prepares a separate generated sheet for customers in App Storage.

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
- **How to fill:** Choose up to three Active or New published products by name. Leave empty for the automatic same-category set. Deleting a chosen product removes it from this list on the live product and on any saved draft. The delete confirmation names those products.

## Permanent delete

Not a catalogue field. Permanently deletes the product and cascaded sale lines. Use Archive if the product should leave the public site but remain recoverable.

If the product is a linked mix ingredient or an Also popular pick, the on-page confirmation names those products and asks you to confirm. Deleting it clears `details.components[].productLink` and removes the slug from `details.relatedProducts`, on the live product and on any saved draft. The mix ingredient row stays, with its name, rate, and description.
