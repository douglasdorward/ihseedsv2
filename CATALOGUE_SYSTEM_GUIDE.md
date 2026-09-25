# IH Seeds Catalogue System Guide

**System documented:** 7 September 2026  
**Approved workbook reviewed:** `attached_assets/0_IH_Seeds_-_Product_Data_Workbook_(pre-filled)_-_description_1788757020628.xlsx`

This guide explains the current IH Seeds catalogue from end to end: the Excel workbook, PostgreSQL storage, administration interface, public API, and public website. It is intended both for day-to-day catalogue ownership and as a specification that can be given to Claude before a future spreadsheet revision.

The rules in this guide are durable unless the implementation changes. The counts in [Current catalogue snapshot](#current-catalogue-snapshot-7-september-2026) are point-in-time figures only.

## 1. System at a glance

The catalogue has four main layers:

1. **Excel workbook** — a controlled bulk-editing and transfer format.
2. **API server and PostgreSQL** — the authoritative catalogue, taxonomy, lifecycle, draft, sale-line, redirect, and option data.
3. **Admin website** — the normal place to create, edit, validate, publish, archive, restore, import, and export.
4. **Public website and API** — a deliberately redacted, Published-only view of the catalogue.

The normal data flow is:

```text
Excel workbook
  -> dry-run parsing and validation
  -> confirmed transactional import
  -> PostgreSQL product and taxonomy records
  -> admin editing or publication
  -> Published + Active or New public API
  -> category and product pages, SEO and sitemap
```

The public website does **not** read the workbook directly. The back-office export is the authoritative replacement workbook: before importing, export and securely back up the current catalogue. An upload replaces the entire product catalogue; omitted products are deleted and omitted imported values are cleared.

### Source-of-truth boundaries

- PostgreSQL is the source of truth for the running catalogue.
- Product slugs are permanent identifiers once a product exists.
- Published product data is separate from unpublished Draft products.
- Sale lines are separate records linked to products.
- Categories are a two-level taxonomy with stable slugs.
- Generated workbooks are the master bulk-editing contract. They are not a substitute for a secure backup of the database and draft history.
- Server validation is authoritative. Browser checks improve usability but never weaken server rules.

## 2. Lifecycle and public eligibility

Three lifecycle states are supported:

| Lifecycle | Meaning | Public? | Can be edited? |
|---|---|---:|---|
| **Published** | The approved live version | Yes, if also Active | Edits persist only when published; they replace the live page immediately |
| **Draft** | Not yet approved for publication | No | Yes |
| **Archived** | Retained but withdrawn | No | Read-only until restored |
| **Draft** | Not yet approved for publication | No | Yes |
| **Archived** | Retained but withdrawn | No | Read-only until restored |

### Draft and publish requirements

A Draft can be saved with only:

- Product name
- Slug
- Category
- Record type

Publishing is intentionally stricter. The current server requires:

- Product name
- Slug
- Category
- Record type
- Tagline, no more than 60 characters
- Blurb
- At least one nonblank key attribute
- Description
- SEO title
- SEO description
- For interactive admin publication, valid sale lines: stock codes must be unique and,
  when sale lines exist, exactly one must be the default

An explicit `Published` status in an imported workbook is subject to the same
required public copy and SEO checks. Workbook validation separately rejects
duplicate stock codes, but it does not currently enforce the interactive
publisher's exactly-one-default rule. This implementation difference should be
treated as a compatibility gap, not permission to supply ambiguous defaults.

Existing live products that predate a newly compulsory field are not automatically unpublished. They remain live until an edit is published or a workbook explicitly attempts to publish them. See [Legacy Published compatibility](#legacy-published-compatibility).

### Published edits

Editing a Published product does not park a draft revision:

1. The administrator edits the live product in the admin editor.
2. **Save draft** is not available. Unpublished edits exist only in the browser until Publish succeeds.
3. **Publish** validates the current editor payload and atomically replaces the live product and its sale lines.
4. If publication fails validation, the live product is left unchanged.
5. Leftover rows in `ih_product_drafts` (from the previous pending-revision model) can still be discarded, or published from the editor as unsaved form state.

Published writes, publication, archive, restore, and leftover discard operations lock the product record and re-check its lifecycle inside a database transaction. This prevents an older concurrent save from overwriting a newer publish or archive.

### Archive and restore

- Archiving removes a product from the public catalogue immediately but retains its data.
- Restoring an Archived product returns it to Draft, not Published.
- It must pass current publication checks before going live again.
- Permanent deletion is a distinct, destructive admin action.

### Active, New and Legacy are not lifecycle states

`Published/Draft/Archived` controls whether a record is eligible to be public. `Active/New/Legacy` is a manual listing choice within the Published catalogue.

- **Active** products can appear in the main public catalogue and may have availability.
- **New** products appear in the same current catalogue as Active, may have availability, and show a red NEW stamp on public product cards and the product page.
- **Legacy** products stay published as catalogue history only. They cannot have availability: sale-line stock and availability overrides are treated as Unavailable.
- Listing state is chosen by the administrator. It is not derived from sale-line availability.
- Archiving is different: Archive removes the product from the public website entirely while keeping the record. Restoring an Archived product returns it to Draft.

Only **Published + Active or New** products appear in the main public catalogue, the sitemap, `/llms.txt`, and `/llms-full.txt`. Those two files list the same product and article set as the sitemap and refresh within about 5 minutes of an admin change. The Pasture Selector questions are the one part stored in code (`artifacts/web/lib/pasture-selector-faqs.ts`). Published Legacy products can appear only as names in the category page’s “Also in our catalogue” section. Draft and Archived products never appear there.

## 3. PostgreSQL data model

### Products

Each product stores:

- Database ID, immutable unique slug, product name, note and timestamps
- Category name plus a category/subcategory foreign key
- Lifecycle state and first-publication timestamp
- Top-level compatibility and operational values such as guide year, tech-sheet path, legacy URL, listing state and availability
- A structured JSON details object containing the main agronomy, copy, SEO, classification, mix, media and editorial fields

The details normalizer retains compatibility with earlier field names and shapes, including the former `summary` name now represented as `tagline`.

### Sale lines

Sale lines are child records owned by a product. They store:

- Globally unique stock code
- Seed form (the retired seed-grade column remains stored but is not editable or exported)
- Pack quantity and unit
- Availability
- Displayed price
- Default-line flag
- Retired stored sort order (customer ordering is derived from default, pack weight and stock code)

Deleting a product cascades to its sale lines. Public pages expose a restricted sale-line presentation; internal pricing fields are not part of the public contract unless represented by the approved display-price field.

### Product drafts

Unpublished products are stored as Draft rows on `ih_products`. Sale lines are stored on `ih_sale_lines` even while the product is Draft; public APIs still hide those products.

The `ih_product_drafts` table is a leftover from the previous pending-revision model. New published edits are not written there. A workbook upsert replaces the stored product directly according to import rules and removes any leftover admin draft for that imported product.

### Taxonomy

Categories form a two-level hierarchy:

- Root category
- Optional child category/subcategory

Each category stores a stable unique slug, display name, group label, public lead copy, rainfall note, image, sort order, active flag, and optional FAQs on root categories.

Public browsing starts at `/products`. `/products/categories` permanently redirects there. Category landings remain `/products/{category}`. Product pages are `/products/{category}/{product}`. Subcategory is an on-page filter only and is not a URL path. The root slug `categories` is reserved so it cannot collide with the old index path.

Workbook imports may create missing root or child categories. Existing display names can be aligned to workbook names while preserving category IDs and slugs. Category slugs should therefore be treated as immutable public URLs, just like product slugs.

### Redirects

Redirect records map the path from each product's current `www.irwinhunter.com.au` URL to its new canonical product path.

`1 Products.website_url` is the only redirect input. Import validates that it is an HTTP(S) URL on `www.irwinhunter.com.au` (the apex host is also accepted), extracts its path, and derives the destination from the resolved category slug and product slug. Each catalogue import replaces the entire redirect table. No built-in, historical, category-change, or product-change redirects are added automatically.

### Product options

The options table stores list name, value and display order. Workbook `Lists` values are imported into it and feed controlled admin choices and future exports.

## 4. Workbook contract

### Exact authoritative workbook shape

The approved file contains:

| Sheet | Data rows | Columns | Import role |
|---|---:|---:|---|
| `1 Products` | one row per product | 38 | Core product, copy, lifecycle and broad agronomy data |
| `2 Sowing rates` | repeatable | 5 | Repeatable sowing-rate rows |
| `3 Category specifics` | one row per product | 21 | Category-dependent facts |
| `4 Sale lines` | repeatable | 8 | Saleable pack/stock records |
| `5 Mix components` | repeatable | 6 | Components of Mix products |
| `7 Website SEO` | one row per product | 9 | SEO and social metadata |
| `10 Product FAQs` | generated | 4 | Optional product question/answer rows |
| `Lists` | generated | validation columns | Visible validation and option values |
| `Review` | optional | variable | Optional warnings/work list; not catalogue content |

The importer recognizes sheets `1`–`5`, `7`, and `10`; `Lists` is required and visible. Sheets `6 Companions`, `8 Categories`, and `9 Redirects` are no longer imported or exported; if present in an upload they are ignored with warnings. `Review` is optional and its rows become warnings.

### Joins and stable keys

| Relationship | Join key |
|---|---|
| Main product | `1 Products.slug` |
| Sowing-rate row to product | `2 Sowing rates.slug` |
| Category-specific row to product | `3 Category specifics.slug` |
| Sale line to product | `4 Sale lines.slug` |
| Mix to product | `5 Mix components.mix_slug` |
| Linked mix component | `5 Mix components.component_slug` |
| SEO row to product | `7 Website SEO.product_slug` |
| Redirect source | `1 Products.website_url` |
| Product FAQ | `10 Product FAQs.slug` |
| Category | `1 Products.category` + optional `sub_category` |

Product slug is the import identity. Renaming it does not rename a product; it risks creating another product and leaving the original untouched. Never change an existing slug to improve wording or SEO. Use redirects when a historic address must point somewhere else.

### Import formats

- Use plain strings for text.
- Preserve paragraph breaks in `description`; multiline cells are supported.
- Use `|` for list values, for example `Fast establishing|Strong winter growth`.
- Do not put spaces around the pipe unless those spaces are intended as content.
- Use `Y` and `N` for workbook booleans.
- Use numeric cells or plainly numeric text for numeric fields.
- Use the literal `NULL` only when a supported mapped field must be explicitly cleared.
- Export all current columns. Missing rows on the authoritative keyed sheets clear those imported collections for workbook products; a blank lifecycle status imports as Draft.
- Use only values allowed by `Lists`, including exact category-dependent enumerations.
- `Stated – review` is an editorial warning sentinel. It produces a warning and is not converted into a public enumeration.
- `CaCl2` is normalized to `CaCl₂`.
- Tolerance names must match the supported set; `Mild ` may prefix supported tolerances.

### Dry run and commit

Every admin workbook import is two-stage:

1. **Dry run**
   - Reads and validates the workbook without opening a database connection for writes.
   - Reports sheet counts, planned upserts, issues and warnings.
   - Produces a hash/token for that exact file content.
2. **Confirm import**
   - Re-runs validation.
   - Requires the exact dry-run token.
   - Refuses to proceed if any issue remains.
   - Applies the accepted changes in one database transaction.

Warnings should be reviewed but do not necessarily block import. Issues block import. If the file changes after dry run, perform another dry run rather than attempting to confirm the old result.

### Replacement behavior

- Products are matched by immutable slug.
- The uploaded workbook is authoritative for the entire product catalogue.
- Products omitted from `1 Products` are deleted.
- Imported product values omitted from the workbook contract use their empty/default value, except retired stored compatibility fields, which remain untouched on matching products.
- New products with blank lifecycle status default to Draft.
- Existing products with blank lifecycle status also become Draft.
- Only `Published`, `Draft`, and `Archived` are valid explicit lifecycle values.
- Stored compatibility keys remain tolerated by the normalizer, but hidden/retired fields are not part of the editor or workbook contract.

### Sale-line replacement boundary

Sale lines are authoritative for every product represented in `1 Products`.

- Each imported product's existing sale lines are replaced by its complete set from `4 Sale lines`.
- An imported product with no `4 Sale lines` rows has no sale lines after import.
- Stock codes must be globally unique.
- Blank or unresolved sale-line ownership cannot produce a valid line.

Do not create partial workbooks. Start from a current admin export and supply the complete intended catalogue.

### Taxonomy behavior

The importer derives category and subcategory pairs from `1 Products`:

- Existing categories are matched by normalized names and known aliases.
- Missing categories may be created as active categories.
- Existing category display names may be updated.
- Existing category slugs remain stable.
- A named subcategory that cannot be resolved is a blocking issue.
- Category-specific values are applied only when valid for that category.

Review new taxonomy names carefully during dry run. A spelling variant can otherwise become a new public category.

### SEO merging and publication

Publication validation evaluates the product assembled from `1 Products` after
applying SEO from `7 Website SEO`.

For imports:

- Effective SEO title comes only from `7 Website SEO.seo_title`.
- Effective SEO description comes from `7 Website SEO.meta_description`.
- Although the approved `1 Products` sheet contains `seo_title` and
  `seo_description` headers, the current importer does not read those two cells.
  Do not rely on them for an import.
- An explicit Published row must resolve both values.
- It is not safe to revise only `1 Products.status` without also considering `7 Website SEO`.
- Trademark symbols (`™`, `®`) belong on the product name, and on `h1` if that
  heading is overwritten. The importer strips them from SEO title and description
  before storage. Put the mark on `product_name` or `h1`, not in SEO title or
  social fields.

### Legacy URL redirect import

Each nonblank `1 Products.website_url` is the old source URL. The importer extracts its path and sends it to the product's new `/products/{category-slug}/{product-slug}` path. Blank means that product has no redirect. Because the workbook replaces the complete catalogue, it also replaces the complete redirect set.

### Export behavior

The admin export writes the numbered import sheets and a visible `Lists` sheet:

- Database IDs are translated back to slugs and category names.
- Arrays become pipe-delimited values.
- Booleans become `Y`/`N`.
- Options are sorted into canonical list order.
- Product SEO extras (H1 override, social title, description, image, canonical URL, index flag) are exported on `7 Website SEO`.
- Only `photo_1` is exported. The importer still accepts `photo_2` and `photo_3` when supplied.
- Categories are managed in the back office and are not workbook sheets.
- Product FAQs are exported on `10 Product FAQs`. Omitting FAQ rows clears the imported product's FAQs.
- Each product's redirect source is exported in `1 Products.website_url`; the destination is calculated during import.

The export is designed to dry-run and re-import cleanly. Keep the sheet names and headers stable. Older `6 Companions`, `8 Categories`, and `9 Redirects` sheets are ignored with warnings.

### Legacy Published compatibility

Some existing Published records predate today’s compulsory public fields. The export leaves their lifecycle blank rather than pretending they satisfy current publication rules.

For such a record:

- Export leaves its lifecycle status blank.
- Re-importing it makes the product Draft.
- Explicitly setting it to `Published`, or materially revising required publication content, requires current validation to pass.

This compatibility marker prevents the export from claiming an incomplete legacy record meets current publish rules. Re-importing that row intentionally moves it to Draft.

## 5. Sheet-by-sheet reference

The authoritative export headers, in order, are:

```text
1 Products: slug, product_name, category, sub_category, record_type, botanical_name, persistency_type, australian_bred, tagline, blurb, key_attributes, description, distribution_note, rainfall_min_mm, soil_ph_min, soil_ph_scale, soil_range_lightest, soil_range_heaviest, sowing_depth_min_cm, sowing_depth_max_cm, tolerance, end_use, livestock, disease_pest_resistance, stand_life_notes, grazing_management_notes, pbr_protected, pbr_details, certification, formulation_year, related_products, photo_1, tech_sheet_pdf_path, website_url, listing_state, listing_override, availability, status
2 Sowing rates: slug, context, min, max, unit
3 Category specifics: slug, category, ploidy, heading_date, heading_offset_days, argt_resistant, endophyte, growth_season, maturity_days, hard_seed_level, oestrogen_level, bloat_risk, flower_colour, winter_activity, growing_season, weeks_to_first_grazing, prussic_acid_risk, regrowth, flowering_window, product_form, application_rate
4 Sale lines: slug, stock_code, seed_form, pack_kg, pack_unit, availability, price_display, is_default
5 Mix components: mix_slug, component_slug, component_name, inclusion_rate, rate_unit, component_description
7 Website SEO: product_slug, h1, seo_title, meta_description, social_title, social_description, social_image, canonical_url, robots_index
10 Product FAQs: slug, product_name, question, answer
Lists: visible validation columns
```

`NULL` explicitly clears a supported value; `|` separates multi-values. The export emits only `photo_1`, leaves `listing_override` blank, and keeps `Lists` visible. Category management remains in the back office rather than a workbook sheet.

### `1 Products` through `5 Mix components`

Use the exact headers listed above. Retired provenance, merchandising, companion,
category-management, seed-grade, sale-line-order, and component-note columns are
not part of the authoritative contract. Existing database JSON may retain those
keys, but the editor and AI fill do not target them.

The applicable fields depend on category. Examples:

- Ryegrass/fescue/sub-tropical: ploidy
- Ryegrass/fescue: heading and endophyte
- Ryegrass: heading offset and ARGT resistance
- Clover/serradella: maturity, hard seed, bloat and flower colour
- Clover: oestrogen
- Lucerne: winter activity
- Fescue/sub-tropical: growth season
- Forage/grain: growing season, first grazing, prussic acid and regrowth
- Mixes: flowering window
- Biologicals: product form and application rate

`_evidence` is provenance, not public copy.

`mix_slug` identifies the owning Mix. `component_slug` optionally links an
existing catalogue product. Components carry their display name, inclusion
rate/unit, and component-specific public description.

The public Mix page must use `component_description` from the component row. It must never substitute the linked product’s Blurb.

Formulation notes, matching, source and review information are private.

### `7 Website SEO`

Headers:

```text
product_slug, h1, seo_title, meta_description, social_title, social_description,
social_image, canonical_url, robots_index
```

Current import uses this sheet to merge SEO, sharing and legacy-address information:

- `product_slug` identifies the product.
- `seo_title` is the only SEO title source.
- `meta_description` supplies SEO description.
- `h1` is an optional product-page heading override. Blank cells leave the stored override; `NULL` clears it so the public H1 follows the product name again.
- `social_title`, `social_description`, `canonical_url` and `robots_index` store the admin SEO extras. Blank cells leave existing values; `NULL` clears them (`robots_index` NULL restores the default of indexed).
- A blank or missing `social_image` stores the first photo `src` from the imported product when one exists. `NULL` stores an empty social image and does not substitute the hero. A non-blank URL is stored as written.
- `1 Products.website_url` is the only redirect source; the destination is calculated from the imported category and slug.

Generated exports write one SEO row per product with the current H1 override, title, description, social fields, canonical URL and index flag.

### `10 Product FAQs`

Headers:

```text
slug, product_name, question, answer
```

There may be several rows per product. `slug` owns the relationship. `product_name` is a human label and is not imported. Row order is the stored FAQ order.

- The sheet is authoritative for every product in `1 Products`; no rows for an imported product means its stored FAQs are cleared.
- A product's FAQ set is replaced by its rows (max ten). A row with only blank question/answer cells also results in an empty set.
- Incomplete question/answer pairs are stored, matching the editor. Customers only see items that have both a question and an answer.
- Question max 180 characters. Answer max 4,000 characters. Preserve answer paragraph breaks.

### `Lists`

`Lists` is mandatory. It contains the accepted controlled values for category, guide section, record type, persistency, category-specific choices, rate units, soil, tolerance, uses, livestock, seed form/grade, certification, availability, lifecycle and Y/N fields.

Rules:

- Preserve its sheet name.
- Preserve all lists required by the data sheets.
- Add a value to the appropriate list before using it in catalogue rows.
- Treat spelling, punctuation and Unicode variants cautiously even though normalization handles common differences.
- Preserve category/subcategory validation relationships.

### `Review`

`Review` has:

```text
sheet, slug, product_name, issue
```

It is optional and produces import warnings. It is not an instruction to clear or alter catalogue data.

The approved workbook contains 434 Review rows. The accompanying upload note says 28 were stale flags for descriptions that had already been restored. Remove or refresh those stale rows before treating Review as a current work list.

## 6. Data and visibility matrix

The following matrix groups related fields. “Publish required” means required by the server before an explicit publication, not that every historic Published record necessarily contains it. Field-by-field editor labels, fill guidance, and exact customer surfaces are in [docs/product-editor/](docs/product-editor/README.md).

| Data group | Workbook source | Admin location | Draft required | Publish required | Public behavior |
|---|---|---|---:|---:|---|
| Name | `1 Products.product_name` | Basics | Yes | Yes | Default H1, cards, tables and related links |
| H1 | `7 Website SEO.h1` | SEO | No | No | Product page H1; blank copies the product name. Trademarks stay visible |
| Slug | `1 Products.slug` | Basics, new records only | Yes | Yes | Permanent product URL and joins |
| Category/subcategory | `1 Products` | Basics | Root yes | Root yes | Breadcrumbs, directory and category filtering |
| Record type | `record_type` | Basics | Yes | Yes | Quick facts and type-dependent UI |
| Botanical name | `botanical_name` | Basics | No | No | Product hero where present |
| Distributed by | `distributed_by` | Not editable | No | No | Compatibility storage only; absent from public contract |
| Tagline | `tagline` | Content & publishing | No | Yes | Under H1 and on product cards |
| Blurb | `blurb` | Content & publishing | No | Yes | Introductory paragraph; SEO fallback where needed |
| Key attributes | `key_attributes`, pipe list | Content & publishing | No | Yes | Bullet list |
| Description | `description`, multiline | Content & publishing | No | Yes | Paragraph-preserving “About this variety” |
| Distribution note | `distribution_note` | Content & publishing | No | No | Conditional highlighted public note |
| Minimum rainfall | `rainfall_min_mm` | Agronomy & fit | No | No | Quick facts and comparisons |
| Soil pH/scale | `soil_ph_min`, `soil_ph_scale` | Agronomy & fit | No | No | Quick facts and comparisons |
| Soil range | lightest/heaviest | Agronomy & fit | No | No | Quick facts and comparisons |
| Sowing depth | min/max | Agronomy & fit | No | No | Stored/admin-only in current public page |
| Sowing rates | `2 Sowing rates` | Agronomy & fit | No | No | Quick facts; first rate in comparison table |
| Tolerances | `tolerance`, pipe list | Agronomy & fit | No | No | Quick facts and comparisons |
| End use/livestock | pipe lists | Agronomy & fit | No | No | Quick facts |
| Persistency/type | `persistency_type` | Agronomy & fit | No | No | Quick facts where present |
| Australian bred | `australian_bred` | Agronomy & fit | No | No | Stored/admin-only |
| Inoculant group | product fields | Not in editor (retained on save/import) | No | No | Private |
| Grazing management | `grazing_management_notes` | Agronomy & fit | No | No | Conditional accordion |
| Disease/pest resistance | matching field | Agronomy & fit | No | No | Conditional accordion |
| Stand life | `stand_life_notes` | Agronomy & fit | No | No | Conditional accordion |
| Category-specific facts | `3 Category specifics` | Category-specific | No | No | Selected applicable values in Quick facts |
| Mix components | `5 Mix components` | Category-specific | No | No | Public formulation list and component-specific descriptions |
| Stock code | `4 Sale lines.stock_code` | Selling | No | Valid if line exists | Public stock/order context |
| Seed form | `seed_form` | Selling | No | No | “How it’s sold” |
| Pack | `pack_kg`, `pack_unit` | Selling | No | No | “How it’s sold” and order panel |
| Availability | sale line | Selling | No | No | Public stock status. Disabled when listing state is Legacy |
| Display price | `price_display` | Selling | No | No | May appear in order panel; not “How it’s sold” |
| Internal price-list fields | sale-line sheet | Import only | No | No | Private; not public contract |
| Default sale line | `is_default` | Selling | No | At most one | Controls preferred sales presentation |
| PBR/certification | product fields | Selling | No | No | Limited public metadata below the order panel |
| Tech-sheet URL | `tech_sheet_pdf_path` | Content & publishing | No | No | Conditional download link |
| Photos | `photo_1` exported; `photo_2` and `photo_3` import-only | Content & publishing | No | No | The first nonblank photo is the hero background. Every photo with a src is shown in a Photos card under the sidebar on desktop and after About this variety on mobile, using its alt text or the product name. The card is omitted when none have a src |
| FAQs | `10 Product FAQs` | Content & publishing (Form and Product page) | No | No | Accordion band above Also popular, max ten. Incomplete question/answer cards are hidden. Imported products receive exactly the FAQ rows supplied |
| Also popular | `relatedProducts` slugs | Content & publishing (Form and Product page) | No | No | Chosen Active or New published products on the Also popular band, max three. A Legacy or missing pick is replaced in that slot with another current product from the same category. An empty list uses three other same-category Active or New products |
| Legacy URL | `website_url` | Content & publishing | No | No | Old current-site URL; its path redirects to the imported category-and-slug product path |
| SEO title | `7 Website SEO.seo_title` | SEO | No | **Yes** | Document title and metadata; `™`/`®` are stripped |
| SEO description | `7 Website SEO.meta_description`; `1 Products` cells are currently ignored | SEO | No | **Yes** | Meta description and structured-data fallback; `™`/`®` are stripped |
| Social sharing | `social_title`, `social_description`, `social_image` | SEO | No | No | Optional. A blank social image is saved as the first photo src on editor save and workbook import. `NULL` stores empty. Public previews still use the hero when the stored value is empty |
| Canonical URL | `canonical_url` | SEO | No | No | Optional override of the product URL |
| Search indexing | `robots_index` | SEO | No | No | `N` publishes with noindex |
| Category metadata | back office | Categories admin | No | No | Managed outside the workbook |
| Category FAQs | root category FAQ workbook, or the root category editor | Site settings → Root categories | No | No | Accordion band above “Also in our catalogue”. Import replaces FAQs only for root slugs that have at least one complete question and answer. The downloadable template lists every root category |
| Lifecycle status | `status` | Product list/import | New defaults Draft | Explicit publication validated | Controls public eligibility |
| Listing state | listing fields | Basics | Active | No | Manual Active/New/Legacy listing; public output shows Active and New products. New renders a NEW stamp |

## 7. Admin website behavior

### Product list and dashboard

The admin provides:

- Published, Draft and Archived product lists
- Search, category, listing and stock-status filters
- Leftover unpublished-change badges for any remaining `ih_product_drafts` rows
- Bulk stock-status updates
- Lifecycle actions with confirmation
- Catalogue summary and attention panels
- Missing-tech-sheet and low/unavailable-stock indicators
- Workbook export, dry run and confirmed import

### Six editor sections

Administrators can fill a product in two views that share the same form state:

1. **Form** (default when a product is opened) — the original six sections below.
2. **Product page** — a visual copy of the public product page. Empty customer-facing fields stay on screen as fillable placeholders. Category is chosen from the breadcrumb dropdown. Quick facts edit the same agronomy and category-specific fields as the form. SEO, slug, selling, and other fields customers do not see sit in cards under the replica.

Switching views does not copy data; both surfaces read and write the same editor payload.

Field-by-field purpose, fill guidance, and customer visibility for each tab live in [docs/product-editor/](docs/product-editor/README.md). Update those files in the same change as editor, API, or public-display updates.

1. **Basics** — identity, category, record type, listing state and botanical name. [01-basics.md](docs/product-editor/01-basics.md)
2. **Agronomy & fit** — sowing, rainfall, pH, soils, tolerance, use, livestock, persistency, Australian bred, and management. [02-agronomy-and-fit.md](docs/product-editor/02-agronomy-and-fit.md)
3. **Category-specific** — fields shown only where relevant, including Mix components. [03-category-specific.md](docs/product-editor/03-category-specific.md)
4. **Selling** — sale lines, availability, PBR and certification. [04-selling.md](docs/product-editor/04-selling.md)
5. **Content & publishing** — the public copy layers, distribution note, legacy URL, media, FAQs and Also popular. [05-content-and-publishing.md](docs/product-editor/05-content-and-publishing.md)
6. **SEO** — title and description required before publication. [06-seo.md](docs/product-editor/06-seo.md)

Desktop uses a Form / Product page switch above the section tabs. Form is the default. Mobile uses an “Editor view” dropdown, then the “Editing section” dropdown when Form is selected. Category-dependent sections remain unavailable until a category is selected.

### Completion and action behavior

- Completion counts are guidance, not a substitute for server validation.
- The completion panel is collapsible and reports each section.
- Save/Publish actions appear only when there are unpublished changes.
- Saving a Draft requires only the four identity fields.
- Published products cannot be saved as drafts; Publish replaces the live page.
- Publishing asks for confirmation, saves the current editor payload if the product is still a Draft, then publishes that payload.
- Back navigates directly when the form is clean.
- Back warns only when there are unsaved changes. Draft products can Save draft & leave. Published products can only Leave without saving or Keep editing.
- Leftover unpublished changes on a Published product can be compared with View Live, then published or discarded.
- Archived view is read-only.
- Archived products must be restored to Draft before editing.

The SEO section labels its fields as compulsory before publish. The browser’s local pre-check does not currently enumerate those SEO errors, but the API does. A publication without SEO therefore fails safely at the server and reports validation errors.

Trademark marks belong on the product name. The Basics tab includes a TM button for that field. The SEO tab H1 copies that name until overwritten; marks stay visible there. SEO title, SEO description, and social sharing title/description are stored and published as plain text: `™` and `®` are stripped on edit, import, and public metadata.

## 8. Public website behavior

### Product directory

`/products` lists every Published + Active or New product, with a left sidebar for Category, End-use, Livestock, Tolerance, Rainfall, soil type and sowing-rate context. Filter state is stored in the query string. Cards use the same fact chips as category pages, and omit any chip longer than 40 characters. Category landings stay at `/products/{category}` and are not this listing.

### Category page

The Category page:

- Resolves an active root and its active children
- Supports child-category filtering
- Provides grid and comparison-table views
- Shows cards with stock state, name, subcategory, tagline and selected fact chips. A chip is omitted when its text is longer than 40 characters, so paragraph-length values such as a full application rate stay on the product page
- Compares rainfall, soil, pH, first sowing rate and tolerance values
- Separates Published Legacy names into “Also in our catalogue”
- Shows a conditional “FAQs” accordion above that band when the root category has complete question/answer pairs

“FAQs” is omitted when the category has no complete items. Incomplete editor rows are dropped on save, not stored. Administrators can also download a root-category FAQ template, which lists every root category, and import a completed workbook. A category’s stored FAQs are replaced only when that import contains at least one complete question and answer for its slug. Blank template rows do not clear existing FAQs. Legacy entries are deliberately name-only and are not presented as currently saleable product cards.

### Product detail page

The current public hierarchy is:

1. Breadcrumbs, H1 (SEO H1 or product name), tagline, botanical name, stock state, photo and Download tech sheet
2. Quick facts
3. Blurb
4. Key attributes
5. Conditional Distribution note
6. Mix formulation/components where applicable
7. Multiline Description under “About this variety”
8. Conditional accordions for grazing, disease/pest and stand life
9. “How it’s sold”
10. Order/contact panel
11. Certification/PBR metadata
12. Conditional Photos card, when at least one photo has a src. On desktop it is its own card under the sidebar, after the order panel and certification/PBR. On mobile it follows About this variety and comes before the growing-note accordions. Each image is a visible `img` with the stored alt text, or the product name when alt is blank
13. Conditional “FAQs” accordion (complete question/answer pairs only, max ten)
14. “Also popular”

“FAQs” is omitted when no stored item has both a question and an answer. Incomplete editor cards stay stored and stay hidden from customers.

“Also popular” shows chosen Active or New published products (max three). If a stored pick is Legacy or otherwise not public, that slot is filled with another current product from the same category, shuffled with a slug seed so the substitute is stable across loads. An empty list shows three other Active or New products in the same category. Featured does not rank this list.

### SEO and structured data

- Document title and meta description use the stored SEO fields with safe content fallbacks.
- `™` and `®` stay on the visible product name (cards, JSON-LD Product `name`) and on the page H1 (product name, or the SEO H1 override). They are stripped from document title, meta description, Open Graph title/description, and JSON-LD description.
- Canonical product paths use `/products/{category}/{slug}`. A legacy address redirects there only when that exact current-site URL is supplied in `1 Products.website_url`.
- Product JSON-LD contains the public name, IH Seeds brand, public description, image URLs for every attached photo (or the single hero/fallback image when there are none), and selected Quick facts.
- When a product has complete FAQs, the page also emits FAQPage JSON-LD for those question/answer pairs.
- When a category page has complete FAQs, it also emits FAQPage JSON-LD for those question/answer pairs.
- The sitemap contains the same Published + Active or New product set as the main catalogue, excluding products with search indexing turned off.
- `/llms.txt` and `/llms-full.txt` list that same product set and the same indexable articles. They are rebuilt from the public API on each request and cached for about 5 minutes. Pasture Selector FAQs are the exception: they live in `artifacts/web/lib/pasture-selector-faqs.ts`.
- Redirect lookup supports valid legacy paths; the application issues permanent redirects for mapped routes.

### Public redaction

The API constructs a public field whitelist rather than returning the database object and attempting to remove a few fields. This is a deliberate safety boundary.

The following must stay private:

- Breeder/origin and supplier identity
- Internal notes, description source, evidence and review fields
- Lifecycle and unpublished draft data
- Listing override controls and internal provenance
- Internal price-list calculations
- Guide/source metadata not explicitly approved for display
- Licence restrictions and third-party sourcing details
- Companion relationships until a public design is approved
- `distributed_by`, including stored legacy values

Public fallbacks must never use a static “complete catalogue” that could resurrect Draft or Archived records.

## 9. Changes since the last Excel upload

### Changes introduced by the approved workbook upload

The accompanying upload note states that only `1 Products` changed:

- It grew from 62 to 65 columns while remaining at 150 product rows.
- `summary` was renamed to `tagline`.
- `blurb` was added.
- `key_attributes` was added as a pipe-delimited 5–6 item list.
- `distribution_note` was added and intentionally populated only where relevant.
- All 150 descriptions were rewritten as 3–5 plain paragraphs.
- Description line breaks became meaningful and must be preserved.
- Repeated quick-fact content was removed from descriptions.
- Grazing, disease/pest and stand-life content moved into dedicated accordion fields.
- Breeder and supplier names were removed from public copy and explicitly designated private.
- The note identified 28 stale Review rows relating to descriptions that had since been restored.

### Later Replit refinements

After that upload, the running implementation was refined further:

- PostgreSQL-backed Published/Draft/Archived lifecycle with separate snapshots for revisions to live products
- Transactional row locking around lifecycle writes
- Published-only public endpoints with no unsafe complete-static-catalogue fallback
- Independent Active/New/Legacy listing chosen by the administrator, taking precedence over availability
- Separate name-only Legacy section on category pages
- Immutable product and category slugs, plus redirects derived from imported Legacy website URLs
- Authoritative replacement workbook with dry-run/token/commit workflow
- Replacement product and sale-line data; omitted products are deleted and omitted imported values are cleared
- Taxonomy creation and controlled-value validation through `Lists`
- Preservation of unchanged legacy Published records without weakening new publication rules
- Import/editor schema parity checks
- Public copy hierarchy of Tagline, Blurb, Key attributes, Description and conditional Distribution note
- Optional product FAQs above Also popular
- Optional category FAQs above “Also in our catalogue”
- Quick facts combined with approved sale/pricing context
- Workbook-specific Mix component descriptions
- “Also popular” recommendations
- Grade and Price removed from “How it’s sold”
- Completion moved into a collapsible six-section panel
- Mobile section dropdown and desktop editor tabs
- Save/Publish actions hidden until unpublished changes exist
- Back warning limited to unsaved changes
- SEO moved into its own editor section
- SEO title and description made compulsory for new publication and explicit Published imports
- `distributed_by` removed from the admin editor, public pages, public API and generated public types while retained in storage/import compatibility

## 10. Current catalogue snapshot — 7 September 2026

These figures are operational observations, not system invariants:

- 106 Published products
- 49 Draft products
- 100 products in the public Active catalogue
- 102 sale lines
- 2 leftover draft snapshots attached to products from the previous revision model
- 8 redirects
- 11 root categories
- 45 child categories
- 56 active categories in total
- 30 Published products without an SEO title
- 28 Published products without an SEO description

The SEO gaps are expected compatibility debt: those live records predate the current compulsory-SEO rule. They are not automatically unpublished, but they must be completed before their next successful publication.

Do not write tests or business logic that expects these exact totals. Normal catalogue administration changes them.

## 11. Safe future workbook procedure

### Before editing

1. Export a fresh workbook from the admin.
2. Keep an untouched copy as a comparison point.
3. Confirm whether any Published products have leftover admin drafts; importing those products will replace their stored data and remove those leftover snapshots.
4. Decide whether the job is:
   - copy refinement only,
   - taxonomy refinement,
   - sale-line replacement,
   - new products,
   - lifecycle changes, or
   - a combination.
5. Resolve all questions listed in [Questions to answer before Claude edits](#questions-to-answer-before-claude-edits).

### While editing

- Keep all numbered sheet names and `Lists`.
- Keep existing slugs unchanged.
- Include every product that should remain stored; omission deletes it.
- Preserve paragraph breaks.
- Preserve pipe-delimited values and Y/N formatting.
- Use only approved `Lists` values.
- If adding a taxonomy value, update `Lists` and review the resulting category plan.
- Treat `4 Sale lines` as a complete replacement for every product represented there.
- Keep private supplier, breeder, source and internal data out of public copy.
- Do not repurpose `distributed_by`.
- Populate `7 Website SEO` whenever an explicit Published status is requested.
- Do not use `Published` as shorthand for “this row is complete”; use it only when the row should become live.

### Before import

1. Check uniqueness of product slugs.
2. Check global uniqueness of sale-line stock codes.
3. Check all explicit lifecycle values.
4. Check the four Draft identity fields.
5. For every explicit Published row, check all required copy and SEO fields,
   taking import SEO from `7 Website SEO`.
6. Confirm each sale-line product has its complete intended set.
7. Confirm Mix components use their own `component_description`.
8. Confirm referenced component and companion slugs exist.
9. Remove stale Review warnings or clearly distinguish them from current issues.
10. Compare row counts and key columns with the original export.

### Import and release

1. Upload the `.xlsx` through admin.
2. Run dry run.
3. Read every issue and warning, including sheet, row and column.
4. Review planned taxonomy and lifecycle changes.
5. Do not confirm while any issue exists.
6. Correct the workbook and dry-run again after every file change.
7. Confirm import only with the token from the final unchanged file.
8. Review Published, Draft and Archived lists after commit.
9. Spot-check affected public category and product pages.
10. Confirm the sitemap/public catalogue contains only the expected Published + Active or New products.

## 12. Copyable Claude specification for the next workbook

Copy the following block into a future Claude request and add the specific editorial assignment beneath it:

```text
You are refining an IH Seeds catalogue workbook for import into an existing
PostgreSQL-backed website. Treat these as hard compatibility rules:

1. Start from the newest admin export. Preserve the current numbered sheets
   (`1`–`5`, `7`, `9`, and `10`) and the required visible Lists sheet.
2. Product slug is the permanent identity and join key. Never change an existing
   slug. Never invent a replacement slug for an existing product.
3. Treat the uploaded workbook as authoritative replacement data. Export and
   securely back up before importing; omission may remove or clear catalogue data.
   Lifecycle accepts only Published, Draft or Archived.
4. A blank lifecycle status imports the product as Draft. Use explicit Published
   only when publication is intended.
5. Draft minimum fields are product_name, slug, category and record_type.
6. Explicit Published rows additionally require tagline (maximum 60 characters),
   blurb, at least one key attribute, description, SEO title and SEO description.
7. Effective import SEO comes from `7 Website SEO.seo_title` and
   `meta_description`; there is no legacy menu-label fallback.
   Do not rely on the seo_title or seo_description cells present in 1 Products;
   the current importer ignores those cells. Do not put ™ or ® in SEO fields;
   those marks belong on product_name and are stripped from search metadata.
8. Preserve description paragraph breaks. Description must be plain paragraphs,
   not embedded section headings.
9. Use | for list values, Y/N for booleans, controlled values from Lists, and
   literal NULL only when an explicitly supported field must be cleared.
10. Keep evidence, review and source metadata private. Do not repeat them in
    public tagline, blurb, key attributes, description or SEO.
12. The public copy layers have separate purposes:
    - tagline: one short fragment, no full stop, <=60 characters
    - blurb: concise introductory paragraph
    - key_attributes: 5-6 non-repetitive pipe-delimited benefits
    - description: 3-5 informative plain paragraphs
    - distribution_note: only genuine public channel/exclusivity information
13. Keep rainfall, pH, soils, sowing, tolerance, use and livestock facts in their
    structured fields instead of repeating them in description.
14. Keep grazing management, disease/pest resistance and stand life in their
    dedicated fields instead of repeating them in description.
15. For Mixes, write component_description on each component row. Never reuse the
    linked product blurb as the component description.
16. 4 Sale lines is authoritative for every product in 1 Products. Include each
    product's complete intended sale-line set. No rows clears its sale lines. Stock codes are globally
    unique. Supply exactly one default whenever a product has sale lines; the
    interactive publisher enforces this even though workbook import currently
    does not.
17. Existing category and product slugs must remain stable. Flag proposed new
    categories for review and add controlled values to Lists.
18. Preserve component links by slug. Flag unresolved references; do not silently
    convert them. Retired stored companion values are not workbook content.
19. 10 Product FAQs is authoritative for every product in 1 Products. Include
    each product's complete intended FAQ set (max ten); no rows clears it.
    Question max 180 characters; answer max 4,000. Preserve answer paragraph breaks.
20. Do not alter lifecycle, taxonomy, sale lines, redirects, product FAQs or
    public/private visibility unless the assignment explicitly asks for that change.
21. Deliver a change report listing sheets touched, row counts, fields changed,
    new controlled values, lifecycle changes, taxonomy changes, sale-line
    replacements, unresolved questions and Review warnings.

Before producing the workbook, answer the project questions below. Do not guess
where a guess could create a new product, expose private information, replace
sale lines or publish incomplete content.
```

### Questions to answer before Claude edits

- Which exact products and sheets are in scope?
- Is this copy-only, or may structured facts change?
- May any lifecycle status change?
- May any product become explicitly Published?
- Are SEO title and description required in this job?
- May taxonomy names or assignments change?
- May new categories/subcategories be created?
- May sale lines change, and is the supplied set complete per product?
- May Mix components change?
- May product FAQs change, and is the supplied set complete for every product?
- Are redirects being added, and what are the exact old and target paths?
- Which source material is authoritative when workbook fields disagree?
- Should stale Review rows be deleted, replaced or retained as history?

## 13. Verification sources

This guide was checked against:

- `artifacts/api-server/src/lib/workbook.ts`
- `artifacts/api-server/src/routes/products.ts`
- `artifacts/api-server/test/products-lifecycle.test.mjs`
- `artifacts/claude-design/src/pages/Admin.tsx`
- `artifacts/claude-design/src/pages/Products.tsx`
- `artifacts/claude-design/src/pages/Category.tsx`
- `artifacts/claude-design/src/pages/ProductDetail.tsx`
- `artifacts/claude-design/src/admin-v2.css`
- `lib/db/src/schema/products.ts`
- `lib/db/src/schema/categories.ts`
- `lib/api-spec/openapi.yaml`
- Generated public/admin API schemas
- The approved workbook and its accompanying change note

The lifecycle test suite covers public eligibility, archive/restore, unpublished revision privacy, authoritative workbook replacement, blank-status Draft imports, import/export compatibility, redirects and concurrent lifecycle writes.