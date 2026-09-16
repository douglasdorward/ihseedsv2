# Tab 1 — Basics
Identity, taxonomy, listing state, and origin. Tabs 2–6 stay disabled until a category is chosen.

Draft save requires Product name, Slug, Category, and Record type from this tab.

## Fill from PDF

- **Shown when:** Form Basics. Also used when a tech-sheet queue item opens this product with `?aiItem=`.
- **Purpose:** Read a tech-sheet PDF and suggest editor fields across every tab the document supports.
- **How to fill:** Choose a category first, then upload a PDF. Review suggestions grouped by tab, then Apply to form. Suggestions stay in the form until Save draft (unpublished products) or Publish (live products). Reject anything the document does not clearly support. Private breeder/supplier wording is dropped from public copy. Sale lines, slugs, photos, listing state, and related products are never filled from the PDF.
- **Tabs filled when present in the PDF:** Basics, Agronomy & fit, Category-specific, Content & publishing, SEO. Selling stock codes and prices are never filled. PBR and certification on Selling can be filled when the sheet states them.
- **Scanned PDFs:** If the file has almost no text, fields are left blank and a warning is shown rather than guessed.

## Product name

- **API path:** `name`
- **Workbook:** `1 Products.product_name`
- **Required:** Draft yes / Publish yes
- **Shown when:** always
- **Customer website:** Default H1 on the product page when SEO → H1 is blank; category cards; comparison table; Also popular names; JSON-LD Product `name`. Trademark symbols stay visible here.
- **Public API:** yes (`name`)
- **Purpose:** The customer-facing product title.
- **How to fill:** Use the commercial name. Insert ™ with the TM button when the brand is trademarked. Do not put ™ or ® in SEO or social fields.
- **Constraints:** 1–160 characters.

## Slug

- **API path:** `slug`
- **Workbook:** `1 Products.slug`
- **Required:** Draft yes / Publish yes
- **Shown when:** always; input is disabled after the product exists
- **Customer website:** Permanent URL `/products/{category-slug}/{slug}`. Used to join Also popular picks, mix components, and redirects. Legacy `/product/{slug}` URLs redirect to this path.
- **Public API:** yes (`slug`)
- **Purpose:** Immutable public identifier.
- **How to fill:** Lowercase kebab-case matching `^[a-z0-9]+(?:-[a-z0-9]+)*$`. Choose carefully on create; it cannot be edited later.
- **Constraints:** 1–180 characters. Unique.

## Category

- **API path:** `category` (root category name)
- **Workbook:** `1 Products.category`
- **Required:** Draft yes / Publish yes
- **Shown when:** always
- **Customer website:** Breadcrumb, directory grouping, category page membership, Also popular pool (Active or New published products in this category).
- **Public API:** yes (`category`)
- **Purpose:** Places the product in the two-level taxonomy. Also decides which Category-specific fields appear.
- **How to fill:** Choose an active root. Inactive roots remain available only for an existing assignment. Publishing a changed assignment to inactive taxonomy is rejected.
- **Constraints:** Must match a catalogue root name.

## Subcategory

- **API path:** `subcategoryId`
- **Workbook:** `1 Products.sub_category` (resolved to the child id)
- **Required:** no
- **Shown when:** a root category is selected
- **Customer website:** Shown under the name on category cards; comparison-table “Sub-category” column; used as the category-page filter. Not shown in the product-page breadcrumb (that uses the root).
- **Public API:** yes (`subcategoryId`)
- **Purpose:** Optional child grouping inside the root.
- **How to fill:** Choose a child of the selected root, or None. None stores the root id as `subcategoryId` in the editor select’s empty state when a root is selected — follow the current editor payload; do not invent a second parent.

## Record type

- **API path:** `details.recordType`
- **Workbook:** `1 Products.record_type`
- **Required:** Draft yes / Publish yes
- **Shown when:** always
- **Customer website:** Not printed as a label. `Mix` turns on the Mix components block on the product page. Variety / Commodity change how some agronomy copy is framed but are not a Quick fact.
- **Public API:** yes (`details.recordType`)
- **Purpose:** Distinguishes mixes from single varieties and generic commodities.
- **How to fill:** `Mix`, `Variety`, or `Commodity / generic`. Use Mix only for blended products that should list components.
- **Constraints:** Closed enum.

## Listing state

- **API path:** `listingState`
- **Workbook:** `1 Products.listing_state` (wins over legacy `listing_override`)
- **Required:** defaults to Active; not a publish-content check
- **Shown when:** always
- **Customer website:** Active and New products can appear in the main catalogue, availability, and sitemap. New also shows a red jagged NEW stamp on product cards and the product hero. Legacy products appear only as names in the category page “Also in our catalogue” list. They are not saleable cards and cannot show stock.
- **Public API:** public payloads include Active and New products. `listingState` is `Active` or `New` there.
- **Purpose:** Manual current-selling vs catalogue-history choice. Independent of Published/Draft/Archived. Different from Archive, which removes the product from the public website.
- **How to fill:** Active when the product may be sold or shown as current. New for the same selling catalogue plus a public NEW stamp. Legacy when it should remain as history only. Legacy forces sale-line availability and the availability override to Unavailable.
- **Constraints:** `Active`, `New`, or `Legacy`.

## Botanical name

- **API path:** `details.botanicalName`
- **Workbook:** `1 Products.botanical_name`
- **Required:** no
- **Shown when:** category is not Mixes
- **Customer website:** Italic line under the tagline on the product hero, when present.
- **Public API:** yes
- **Purpose:** Scientific name for a variety or commodity.
- **How to fill:** e.g. `Lolium multiflorum`. Leave blank if unknown. Mixes do not use this field in the editor.
- **Constraints:** max 180 characters.
