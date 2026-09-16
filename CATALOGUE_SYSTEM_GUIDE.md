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

The public website does **not** read the workbook directly. The workbook is not the live database, and omitting a product from an upload does not delete it.

### Source-of-truth boundaries

- PostgreSQL is the source of truth for the running catalogue.
- Product slugs are permanent identifiers once a product exists.
- Published product data is separate from unpublished Draft products.
- Sale lines are separate records linked to products.
- Categories are a two-level taxonomy with stable slugs.
- Generated workbooks are snapshots for bulk editing and safe re-import, not complete backups of every database entity. Draft snapshots are not exported.
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

Only **Published + Active or New** products appear in the main public catalogue and sitemap. Published Legacy products can appear only as names in the category page’s “Also in our catalogue” section. Draft and Archived products never appear there.

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
- Seed form and grade
- Pack quantity and unit
- Availability
- Displayed price
- Default-line flag
- Sort order

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

Redirect records map a unique old path to a target path. They support legacy `/product/...` and `/products/...` addresses and are checked when a requested product path is not found.

Redirects can be added from `7 Website SEO` import information or from `9 Redirects`. Generated workbook exports include the current redirect table on `9 Redirects`. Omission from an import does not delete existing redirects; listed rows are upserted by source path.

### Product options

The options table stores list name, value and display order. Workbook `Lists` values are imported into it and feed controlled admin choices and future exports.

## 4. Workbook contract

### Exact approved workbook shape

The approved file contains:

| Sheet | Data rows | Columns | Import role |
|---|---:|---:|---|
| `README` | 24 | 1 | Human guidance; not imported |
| `1 Products` | 150 | 65 | Core product, copy, lifecycle and broad agronomy data |
| `2 Sowing rates` | 242 | 9 | Repeatable sowing-rate rows |
| `3 Category specifics` | 150 | 25 | Category-dependent facts |
| `4 Sale lines` | 112 | 16 | Saleable pack/stock records |
| `5 Mix components` | 125 | 17 | Components of Mix products |
| `6 Companions` | 229 | 8 | Companion-product or free-text relationships |
| `7 Website SEO` | 79 | 16 | SEO, social, canonical, index flag, old website paths and redirect hints |
| `8 Categories` | generated | 12 | Category slugs, copy, SEO and visibility |
| `9 Redirects` | generated | 2 | Canonical redirect table |
| `10 Product FAQs` | generated | 4 | Optional product question/answer rows |
| `Lists` | 12 | 45 | Required validation and option values |
| `Review` | 434 | 4 | Optional warnings/work list; not catalogue content |

The importer recognizes the numbered data sheets. `1`–`7` are the original product sheets; `8 Categories`, `9 Redirects` and `10 Product FAQs` are optional on older workbooks and are written by current exports. `Lists` is required. `Review` is optional and its rows become warnings.

### Joins and stable keys

| Relationship | Join key |
|---|---|
| Main product | `1 Products.slug` |
| Sowing-rate row to product | `2 Sowing rates.slug` |
| Category-specific row to product | `3 Category specifics.slug` |
| Sale line to product | `4 Sale lines.slug` |
| Mix to product | `5 Mix components.mix_slug` |
| Linked mix component | `5 Mix components.component_slug` |
| Companion owner | `6 Companions.slug` |
| Linked companion product | `6 Companions.companion_slug` |
| SEO row to product | `7 Website SEO.product_slug`, falling back to `website_slug` |
| Category metadata | `8 Categories.slug` with optional `parent_slug` |
| Redirect | `9 Redirects.from_path` |
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
- A blank value commonly means “no new value supplied” or “preserve lifecycle,” depending on the field; it is not a universal clear command.
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

### Upsert and non-deletion behavior

- Products are upserted by immutable slug.
- Products omitted from a workbook are retained.
- Import never interprets omission as deletion or archive.
- New products with blank lifecycle status default to Draft.
- Existing products with blank lifecycle status preserve their current lifecycle.
- Only `Published`, `Draft`, and `Archived` are valid explicit lifecycle values.
- Imported fields are overlaid on normalized existing details so compatibility fields not represented by the workbook can survive.

### Sale-line replacement boundary

Sale lines are authoritative only for products represented in `4 Sale lines`.

- For each represented product, its existing sale lines are replaced by the imported set.
- A product omitted entirely from `4 Sale lines` keeps its current sale lines.
- Stock codes must be globally unique.
- Blank or unresolved sale-line ownership cannot produce a valid line.

This boundary matters when creating partial workbooks: including one product in the sale-line sheet means supplying the complete intended sale-line set for that product.

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

- Effective SEO title comes from `7 Website SEO.seo_title` or the legacy
  `menu_label`.
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

### Redirect import

`7 Website SEO` can describe an old source path through `website_slug` or `product_url` and a target product path in `redirect_note`. Valid mappings are upserted by source path.

Because older workbooks may omit `9 Redirects`, do not treat a historic spreadsheet as the complete redirect register. Current admin exports do include it.

### Export behavior

The admin export writes the numbered import sheets and a hidden `Lists` sheet:

- Database IDs are translated back to slugs and category names.
- Arrays become pipe-delimited values.
- Booleans become `Y`/`N`.
- Product-linked companions are exported as slugs; free-text companions remain text.
- Options are sorted into canonical list order.
- Product SEO extras (H1 override, social title, description, image, canonical URL, index flag) are exported on `7 Website SEO`.
- Additional product photos are exported as `photo_2` and `photo_3`.
- Category page heading, lead, SEO, rainfall, image, sort and active flag are exported on `8 Categories`.
- Category FAQs are edited in taxonomy settings and are not exported on `8 Categories`. Overlay import leaves stored FAQs unchanged.
- Product FAQs are exported on `10 Product FAQs`. Overlay import leaves stored product FAQs unchanged when that sheet is omitted.
- Redirects are exported on `9 Redirects`.

The export is designed to dry-run and re-import cleanly. Keep the sheet names and headers stable. Older workbooks without sheets `8`, `9` and `10` still import; missing sheets leave those records unchanged.

### Legacy Published compatibility

Some existing Published records predate today’s compulsory public fields. The system avoids two unsafe outcomes: silently unpublishing them, or pretending they satisfy current publication rules.

For such a record:

- Export may leave its lifecycle status blank.
- Re-importing the unchanged record preserves its existing Published lifecycle.
- The importer rejects degrading its required public content.
- Explicitly setting it to `Published`, or materially revising required publication content, requires current validation to pass.

This exception is for lossless maintenance of existing live records, not a way to publish new incomplete content.

## 5. Sheet-by-sheet reference

### `1 Products`

Headers in the approved workbook:

```text
slug, product_name, category, sub_category, guide_section, guide_year,
record_type, botanical_name, also_known_as, persistency_type, bred_by_origin,
australian_bred, distributed_by, tagline, blurb, key_attributes, description,
description_source, internal_notes, rainfall_min_mm, soil_ph_min, soil_ph_scale,
soil_range_lightest, soil_range_heaviest, sowing_depth_min_cm,
sowing_depth_max_cm, tolerance, inoculant_group, ecocert_approved, end_use,
livestock, disease_pest_resistance, stand_life_notes, grazing_management_notes,
pbr_protected, licence_restriction, certification, is_third_party_product,
supplier_name, listing_state, listing_override, stock_codes, availability,
status, in_current_printed_guide, tech_sheet_pdf_path, photo_1, seo_title,
seo_description, sort_order, featured, website_url, data_completeness,
latest_source_year, src_rainfall, src_soil_ph, src_sowing_depth, src_tolerance,
src_end_use, src_livestock, src_maturity, src_persistency, src_certification,
review_flags, distribution_note
```

This is the core row. It supplies identity, taxonomy, lifecycle intent, broad facts, copy, provenance, visibility overrides and some SEO compatibility values. Related repeatable data belongs in the other sheets rather than being flattened here.

Important notes:

- `status` means lifecycle: Published, Draft or Archived.
- `listing_state` is the stored Active/New/Legacy listing. It is independent of lifecycle and takes precedence over availability. New products appear in the current catalogue with a NEW stamp. Legacy products cannot have availability.
- `listing_override` is retained only for older workbook compatibility (`Force active` / `Force legacy` / `Active` / `Legacy`). `listing_state` wins when both are present.
- `stock_codes` and `availability` are compatibility/summary values; `4 Sale lines` is the structured sale-line source.
- `seo_title` and `seo_description` are present in this approved sheet but are
  not read by the current importer; maintain import SEO in `7 Website SEO`.
- `distributed_by` is retained only for legacy workbook/storage compatibility. It is not editable or public.
- `ecocert_approved` remains on this sheet for older workbook compatibility. Only Biologicals values are imported; the editor field lives on Category specifics.
- `bred_by_origin`, `supplier_name`, `description_source`, source columns, internal notes and review flags are private/admin information.

### `2 Sowing rates`

Headers:

```text
slug, product_name, context, min, max, unit, note, source_text, review
```

There may be several rows per product. `slug` owns the relationship. Public quick facts may show the approved sowing context/range/unit/note; source and review information remain private.

### `3 Category specifics`

Headers:

```text
slug, product_name, category, sub_category, ploidy, heading_date,
heading_offset_days, argt_resistant, endophyte, growth_season, maturity_days,
hard_seed_level, oestrogen_level, bloat_risk, flower_colour, seed_form_options,
winter_activity, growing_season, weeks_to_first_grazing, prussic_acid_risk,
regrowth, flowering_window, product_form, application_rate, ecocert_approved, _evidence
```

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

### `4 Sale lines`

Headers:

```text
slug, product_name, stock_code, price_list_name, seed_form, seed_grade, pack_kg,
pack_unit, availability, price_display, is_default, price_list_group,
list_price_per_kg_ex_gst, farm_price_per_kg_ex_gst, match, review
```

The persisted subset is stock code, seed form, seed grade, pack, availability,
display price and default status. Those values are also available in the public
API sale-line contract. Price-list calculations, matching and review columns are
private import context.

The current public “How it’s sold” table intentionally shows seed form, pack and
stock status. It does **not** render Grade or Price in that table, even though
both remain in the public API sale-line data. A separate order panel may use the
approved display price for the default or first sale line, and lists unique
sale-line pack weights when any exist. Public pages must not fall back to the
vestigial product-level `price` or `packSize` fields.

### `5 Mix components`

Headers:

```text
mix_slug, mix_name, component_name, component_slug, component_role,
component_category, component_listing, botanical_name, inclusion_rate,
rate_unit, current_in_formulation, component_description, description_source,
formulation_note, component_match, source, review
```

`mix_slug` identifies the owning Mix. `component_slug` optionally links an existing catalogue product. Components can still carry their own display name, role, inclusion rate/unit and **component-specific public description**.

The public Mix page must use `component_description` from the component row. It must never substitute the linked product’s Blurb.

Formulation notes, matching, source and review information are private.

### `6 Companions`

Headers:

```text
slug, product_name, companion_text, companion_slug, companion_product, match,
relationship, source_text
```

A companion can link to a known product slug or remain meaningful free text. These relationships are stored/admin data but are not currently rendered on public product pages.

### `7 Website SEO`

Headers:

```text
website_slug, product_slug, redirect_note, website_product_name, menu_label,
website_category, website_sub_category, product_url, in_main_menu, page_tagline,
meta_description, words, tech_sheet_pdf_urls, images_on_page, notes,
page_text_verbatim
```

Current import uses this sheet to merge SEO, sharing and legacy-address information:

- `product_slug` or `website_slug` identifies the product.
- `menu_label` can supply the SEO title for legacy compatibility.
- `meta_description` supplies SEO description.
- `h1` is an optional product-page heading override. Blank cells leave the stored override; `NULL` clears it so the public H1 follows the product name again.
- `social_title`, `social_description`, `social_image`, `canonical_url` and `robots_index` store the admin SEO extras. Blank cells leave existing values; `NULL` clears them (`robots_index` NULL restores the default of indexed).
- `website_slug`, `product_url`, and `redirect_note` may define redirects. The full redirect table is `9 Redirects`.

Generated exports write one SEO row per product with the current H1 override, title, description, social fields, canonical URL, index flag and legacy product URL.

The remaining website-capture columns are reference/provenance unless explicitly mapped. Do not assume every captured legacy website field is public in the new site.

### `8 Categories`

Headers:

```text
parent_slug, slug, name, group_label, lead, page_heading, seo_title,
seo_description, rainfall, image, sort_order, active
```

This sheet is the category metadata export. Root rows have a blank `parent_slug`. Import updates matching slugs and can create missing categories. It does not delete omitted categories or change parent/slug identity of existing rows. FAQs are not on this sheet; they are edited in taxonomy settings. Overlay import leaves stored FAQs unchanged.

### `9 Redirects`

Headers:

```text
from_path, to_path
```

Each row is one stored redirect. Import upserts by `from_path`. Omitted redirects are retained.

### `10 Product FAQs`

Headers:

```text
slug, product_name, question, answer
```

There may be several rows per product. `slug` owns the relationship. `product_name` is a human label and is not imported. Row order is the stored FAQ order.

- Missing sheet: stored product FAQs are left unchanged.
- If a product slug appears on the sheet, its FAQ set is replaced by those rows (max ten). A represented product with only blank question/answer cells clears stored FAQs.
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
| Also known as | `also_known_as` | Not in editor (retained on save/import) | No | No | Stored/admin-only |
| Breeder/origin | `bred_by_origin` | Not in editor (retained on save/import) | No | No | **Private; deliberately excluded** |
| Supplier/third-party | `supplier_name`, `is_third_party_product` | Not in editor (retained on save/import) | No | No | **Private; deliberately excluded** |
| Distributed by | `distributed_by` | Not editable | No | No | Compatibility storage only; absent from public contract |
| Tagline | `tagline` | Content & publishing | No | Yes | Under H1 and on product cards |
| Blurb | `blurb` | Content & publishing | No | Yes | Introductory paragraph; SEO fallback where needed |
| Key attributes | `key_attributes`, pipe list | Content & publishing | No | Yes | Bullet list |
| Description | `description`, multiline | Content & publishing | No | Yes | Paragraph-preserving “About this variety” |
| Distribution note | `distribution_note` | Content & publishing | No | No | Conditional highlighted public note |
| Description source | `description_source` | Not in editor (retained on save/import) | No | No | Admin-only provenance |
| Internal notes/review/source fields | `internal_notes`, `review_flags`, `src_*`, `_evidence`, `source_text`, etc. | Admin/import reports | No | No | **Never public** |
| Minimum rainfall | `rainfall_min_mm` | Agronomy & fit | No | No | Quick facts and comparisons |
| Soil pH/scale | `soil_ph_min`, `soil_ph_scale` | Agronomy & fit | No | No | Quick facts and comparisons |
| Soil range | lightest/heaviest | Agronomy & fit | No | No | Quick facts and comparisons |
| Sowing depth | min/max | Agronomy & fit | No | No | Stored/admin-only in current public page |
| Sowing rates | `2 Sowing rates` | Agronomy & fit | No | No | Quick facts; first rate in comparison table |
| Tolerances | `tolerance`, pipe list | Agronomy & fit | No | No | Quick facts and comparisons |
| End use/livestock | pipe lists | Agronomy & fit | No | No | Quick facts |
| Companion species | `6 Companions` | Agronomy & fit | No | No | Stored/admin-only currently |
| Persistency/type | `persistency_type` | Agronomy & fit | No | No | Quick facts where present |
| Australian bred | `australian_bred` | Agronomy & fit | No | No | Stored/admin-only |
| Inoculant group | product fields | Not in editor (retained on save/import) | No | No | Private |
| ECOCERT approved | `ecocert_approved` | Not in editor (retained on save/import) | No | No | Staff flag; public certification uses Selling → Certification |
| Grazing management | `grazing_management_notes` | Agronomy & fit | No | No | Conditional accordion |
| Disease/pest resistance | matching field | Agronomy & fit | No | No | Conditional accordion |
| Stand life | `stand_life_notes` | Agronomy & fit | No | No | Conditional accordion |
| Category-specific facts | `3 Category specifics` | Category-specific | No | No | Selected applicable values in Quick facts |
| Mix components | `5 Mix components` | Category-specific | No | No | Public formulation list and component-specific descriptions |
| Stock code | `4 Sale lines.stock_code` | Selling | No | Valid if line exists | Public stock/order context |
| Seed form | `seed_form` | Selling | No | No | “How it’s sold” |
| Seed grade | `seed_grade` | Not in editor (retained on save/import) | No | No | Stored/admin-only; removed from public sales table |
| Pack | `pack_kg`, `pack_unit` | Selling | No | No | “How it’s sold” and order panel |
| Availability | sale line | Selling | No | No | Public stock status. Disabled when listing state is Legacy |
| Display price | `price_display` | Selling | No | No | May appear in order panel; not “How it’s sold” |
| Internal price-list fields | sale-line sheet | Import only | No | No | Private; not public contract |
| Default sale line | `is_default` | Selling | No | At most one | Controls preferred sales presentation |
| PBR/certification | product fields | Selling | No | No | Limited public metadata below the order panel |
| Licence restriction | `licence_restriction` | Not in editor (retained on save/import) | No | No | Stored/admin-only currently |
| Tech-sheet URL | `tech_sheet_pdf_path` | Content & publishing | No | No | Conditional download link |
| Photos | `photo_1`, `photo_2`, `photo_3` | Content & publishing | No | No | First nonblank photo is hero; other slots retained |
| FAQs | `10 Product FAQs` | Content & publishing (Form and Product page) | No | No | Accordion band above Also popular, max ten. Incomplete question/answer cards are hidden. Missing sheet leaves stored FAQs unchanged; a represented product replaces its FAQ set |
| Also popular | `relatedProducts` slugs | Content & publishing (Form and Product page) | No | No | Chosen Active or New published products on the Also popular band, max three. A Legacy or missing pick is replaced in that slot with another current product from the same category. An empty list uses three other same-category Active or New products |
| Sort order/featured | product fields | Featured on Content & publishing; product `sortOrder` is not in the editor (retained on save/import) | No | No | Featured sorts category grids first. Also popular does not use featured. Product `sortOrder` is stored/admin-only and is not used by the current public pages |
| Legacy URL | `website_url` / `7 Website SEO.product_url` | Content & publishing | No | No | Admin/compatibility; redirects are separate |
| SEO title | `7 Website SEO.seo_title` or legacy `menu_label`; `1 Products` cells are currently ignored | SEO | No | **Yes** | Document title and metadata; `™`/`®` are stripped |
| SEO description | `7 Website SEO.meta_description`; `1 Products` cells are currently ignored | SEO | No | **Yes** | Meta description and structured-data fallback; `™`/`®` are stripped |
| Social sharing | `social_title`, `social_description`, `social_image` | SEO | No | No | Optional; blank falls back to the product SEO/hero on the public site |
| Canonical URL | `canonical_url` | SEO | No | No | Optional override of the product URL |
| Search indexing | `robots_index` | SEO | No | No | `N` publishes with noindex |
| Category metadata | `8 Categories` | Categories admin | No | No | Page heading, lead, SEO, rainfall, image, active |
| Category FAQs | taxonomy admin | Categories admin | No | No | Accordion band above “Also in our catalogue”, max twenty. Incomplete question/answer rows are dropped on save. Not in the workbook; overlay import keeps stored FAQs |
| Redirects | `9 Redirects` | Import/database | No | No | Old path to current path |
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
2. **Agronomy & fit** — sowing, rainfall, pH, soils, tolerance, use, livestock, companions, persistency, Australian bred, and management. [02-agronomy-and-fit.md](docs/product-editor/02-agronomy-and-fit.md)
3. **Category-specific** — fields shown only where relevant, including Mix components. [03-category-specific.md](docs/product-editor/03-category-specific.md)
4. **Selling** — sale lines, availability, PBR and certification. [04-selling.md](docs/product-editor/04-selling.md)
5. **Content & publishing** — the public copy layers, distribution note, legacy URL, media, FAQs, Also popular and featured. [05-content-and-publishing.md](docs/product-editor/05-content-and-publishing.md)
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

`/products` lists every Published + Active or New product, with a left sidebar for Category, End-use, Livestock, Tolerance, Rainfall, soil type and sowing-rate context. Filter state is stored in the query string. Category landings stay at `/products/{category}` and are not this listing.

### Category page

The Category page:

- Resolves an active root and its active children
- Supports child-category filtering
- Provides grid and comparison-table views
- Shows cards with stock state, name, subcategory, tagline and selected fact chips
- Compares rainfall, soil, pH, first sowing rate and tolerance values
- Separates Published Legacy names into “Also in our catalogue”
- Shows a conditional “FAQs” accordion above that band when the root category has complete question/answer pairs

“FAQs” is omitted when the category has no complete items. Incomplete editor rows are dropped on save, not stored. Legacy entries are deliberately name-only and are not presented as currently saleable product cards.

### Product detail page

The current public hierarchy is:

1. Breadcrumbs, H1 (SEO H1 or product name), tagline, botanical name, stock state, photo and optional tech sheet
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
12. Conditional “FAQs” accordion (complete question/answer pairs only, max ten)
13. “Also popular”

“FAQs” is omitted when no stored item has both a question and an answer. Incomplete editor cards stay stored and stay hidden from customers.

“Also popular” shows chosen Active or New published products (max three). If a stored pick is Legacy or otherwise not public, that slot is filled with another current product from the same category, shuffled with a slug seed so the substitute is stable across loads. An empty list shows three other Active or New products in the same category. Featured does not rank this list.

### SEO and structured data

- Document title and meta description use the stored SEO fields with safe content fallbacks.
- `™` and `®` stay on the visible product name (cards, JSON-LD Product `name`) and on the page H1 (product name, or the SEO H1 override). They are stripped from document title, meta description, Open Graph title/description, and JSON-LD description.
- Canonical product paths use `/products/{category}/{slug}`. Legacy `/product/{slug}` addresses permanently redirect there.
- Product JSON-LD contains the public name, IH Seeds brand, public description, optional real image and selected Quick facts.
- When a product has complete FAQs, the page also emits FAQPage JSON-LD for those question/answer pairs.
- When a category page has complete FAQs, it also emits FAQPage JSON-LD for those question/answer pairs.
- The sitemap contains the same Published + Active or New product set as the main catalogue.
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
- `description_source` remained private provenance.
- The note identified 28 stale Review rows relating to descriptions that had since been restored.

### Later Replit refinements

After that upload, the running implementation was refined further:

- PostgreSQL-backed Published/Draft/Archived lifecycle with separate snapshots for revisions to live products
- Transactional row locking around lifecycle writes
- Published-only public endpoints with no unsafe complete-static-catalogue fallback
- Independent Active/New/Legacy listing chosen by the administrator, taking precedence over availability
- Separate name-only Legacy section on category pages
- Immutable product and category slugs, plus database redirects
- Seven-sheet dry-run/token/commit workbook workflow
- Non-deleting upserts and scoped sale-line replacement
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
- Preserve every product that should remain stored; omission does not delete it, but a complete export is easier to audit.
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

1. Start from the newest admin export. Preserve the numbered sheet names
   (`1`–`10` on current exports) and the required Lists sheet. Older files may
   omit `8 Categories`, `9 Redirects` and `10 Product FAQs`.
2. Product slug is the permanent identity and join key. Never change an existing
   slug. Never invent a replacement slug for an existing product.
3. Do not remove products to archive or delete them. Omission does not delete
   database records. Lifecycle accepts only Published, Draft or Archived.
4. A blank lifecycle status preserves an existing product’s lifecycle and makes
   a new product Draft. Use explicit Published only when publication is intended.
5. Draft minimum fields are product_name, slug, category and record_type.
6. Explicit Published rows additionally require tagline (maximum 60 characters),
   blurb, at least one key attribute, description, SEO title and SEO description.
7. Effective import SEO comes from 7 Website SEO. The importer accepts its
   seo_title or legacy menu_label as title, and meta_description as description.
   Do not rely on the seo_title or seo_description cells present in 1 Products;
   the current importer ignores those cells. Do not put ™ or ® in SEO fields;
   those marks belong on product_name and are stripped from search metadata.
8. Preserve description paragraph breaks. Description must be plain paragraphs,
   not embedded section headings.
9. Use | for list values, Y/N for booleans, controlled values from Lists, and
   literal NULL only when an explicitly supported field must be cleared.
10. Keep breeder/origin, supplier identity, description source, internal notes,
    evidence, review and source metadata private. Do not repeat them in public
    tagline, blurb, key attributes, description or SEO.
11. distributed_by is legacy compatibility data. Do not add public copy based on
    it and do not treat it as an editable website field.
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
16. 4 Sale lines is authoritative per represented product. If a product appears
    there, include its complete intended sale-line set. Stock codes are globally
    unique. Supply exactly one default whenever a product has sale lines; the
    interactive publisher enforces this even though workbook import currently
    does not.
17. Existing category and product slugs must remain stable. Flag proposed new
    categories for review and add controlled values to Lists.
18. Preserve companion and component links by slug. Flag unresolved references;
    do not silently convert them.
19. 10 Product FAQs is authoritative per represented product. If a product slug
    appears there, include its complete intended FAQ set (max ten). Question max
    180 characters; answer max 4,000. Preserve answer paragraph breaks. Older
    workbooks without this sheet leave stored FAQs unchanged.
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
- May Mix components or companion links change?
- May product FAQs change, and is the supplied set complete per represented product?
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

The lifecycle test suite covers public eligibility, archive/restore, unpublished revision privacy, import/export compatibility, non-deleting upserts, legacy Published round-trips and concurrent lifecycle writes.