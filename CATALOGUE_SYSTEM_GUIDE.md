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
  -> Published + Active public API
  -> category and product pages, SEO and sitemap
```

The public website does **not** read the workbook directly. The workbook is not the live database, and omitting a product from an upload does not delete it.

### Source-of-truth boundaries

- PostgreSQL is the source of truth for the running catalogue.
- Product slugs are permanent identifiers once a product exists.
- Published product data is separate from unpublished draft revisions.
- Sale lines are separate records linked to products.
- Categories are a two-level taxonomy with stable slugs.
- Generated workbooks are snapshots for bulk editing and safe re-import, not complete backups of every database entity. In particular, generated exports do not contain the redirect table.
- Server validation is authoritative. Browser checks improve usability but never weaken server rules.

## 2. Lifecycle and public eligibility

Three lifecycle states are supported:

| Lifecycle | Meaning | Public? | Can be edited? |
|---|---|---:|---|
| **Published** | The approved live version | Yes, if also Active | Changes are saved as a separate draft revision |
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

Existing live products that predate a newly compulsory field are not automatically unpublished. They remain live until an edit is promoted or a workbook explicitly attempts to publish them. See [Legacy Published compatibility](#legacy-published-compatibility).

### Published revisions

Editing a Published product does not overwrite the public version immediately:

1. The administrator edits a draft snapshot.
2. **Save draft** keeps the current public version unchanged.
3. **Publish** atomically promotes the draft product and its draft sale lines.
4. The draft snapshot is removed after successful publication.
5. **Discard draft** removes the pending revision and leaves the live product untouched.

Published writes, publication, archive, restore, and discard operations lock the product record and re-check its lifecycle inside a database transaction. This prevents an older concurrent save from overwriting a newer publish or archive.

### Archive and restore

- Archiving removes a product from the public catalogue immediately but retains its data.
- Restoring an Archived product returns it to Draft, not Published.
- It must pass current publication checks before going live again.
- Permanent deletion is a distinct, destructive admin action.

### Active and Legacy are not lifecycle states

`Published/Draft/Archived` controls whether a record is eligible to be public. `Active/Legacy` describes availability within the Published catalogue.

The server derives the public listing as follows:

1. `Force active` wins.
2. Otherwise `Force legacy` wins.
3. Otherwise a product is Active when it has no sale lines or at least one sale line is not `Unavailable`.
4. A product whose sale lines are all unavailable is Legacy.

Only **Published + Active** products appear in the main public catalogue and
sitemap. A product with no sale lines is currently treated as Active. Published
products that are forced Legacy, or whose sale lines are all unavailable, can
appear only as names in the category page’s “Also in our catalogue” section.
Draft and Archived products never appear there.

## 3. PostgreSQL data model

### Products

Each product stores:

- Database ID, immutable unique slug, product name, note and timestamps
- Category name plus a category/subcategory foreign key
- Lifecycle state and first-publication timestamp
- Top-level compatibility and operational values such as guide year, tech-sheet path, legacy URL, listing overrides and availability
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

At most one draft snapshot exists per product. It contains the complete editable product payload and its proposed sale lines. This is what allows a Published product to be revised without changing the live website.

A workbook upsert replaces the stored product directly according to import rules and removes any pending admin draft for that imported product. Do not import over products with valuable unfinished admin drafts without reviewing them first.

### Taxonomy

Categories form a two-level hierarchy:

- Root category
- Optional child category/subcategory

Each category stores a stable unique slug, display name, group label, public lead copy, rainfall note, image, sort order and active flag.

Workbook imports may create missing root or child categories. Existing display names can be aligned to workbook names while preserving category IDs and slugs. Category slugs should therefore be treated as immutable public URLs, just like product slugs.

### Redirects

Redirect records map a unique old path to a target path. They support legacy `/product/...` and `/products/...` addresses and are checked when a requested product path is not found.

Redirects can be added from `7 Website SEO` import information, but generated workbook exports do not export the redirect table. Existing database redirects remain stored; they simply do not round-trip through the generated spreadsheet.

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
| `7 Website SEO` | 79 | 16 | SEO, old website paths and redirect hints |
| `Lists` | 12 | 45 | Required validation and option values |
| `Review` | 434 | 4 | Optional warnings/work list; not catalogue content |

The importer recognizes the seven numbered data sheets. `Lists` is required. `Review` is optional and its rows become warnings.

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

### Redirect import

`7 Website SEO` can describe an old source path through `website_slug` or `product_url` and a target product path in `redirect_note`. Valid mappings are upserted by source path.

Because exports do not include all redirect records, do not treat a generated workbook as the redirect register.

### Export behavior

The admin export writes the seven numbered import sheets and a hidden `Lists` sheet:

- Database IDs are translated back to slugs and category names.
- Arrays become pipe-delimited values.
- Booleans become `Y`/`N`.
- Product-linked companions are exported as slugs; free-text companions remain text.
- Options are sorted into canonical list order.

The export is designed to dry-run and re-import cleanly. Keep the sheet names and headers stable.

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
- `listing_state`/`listing_override` concern Active/Legacy availability and are independent of lifecycle.
- `stock_codes` and `availability` are compatibility/summary values; `4 Sale lines` is the structured sale-line source.
- `seo_title` and `seo_description` are present in this approved sheet but are
  not read by the current importer; maintain import SEO in `7 Website SEO`.
- `distributed_by` is retained only for legacy workbook/storage compatibility. It is not editable or public.
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
regrowth, flowering_window, product_form, application_rate, _evidence
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
approved display price/pack for the default or first sale line with a reseller
disclaimer.

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

Current import uses this sheet primarily to merge SEO and legacy-address information:

- `product_slug` or `website_slug` identifies the product.
- `menu_label` can supply the SEO title for legacy compatibility.
- `meta_description` supplies SEO description.
- `website_slug`, `product_url`, and `redirect_note` may define redirects.

The remaining website-capture columns are reference/provenance unless explicitly mapped. Do not assume every captured legacy website field is public in the new site.

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

The following matrix groups related fields. “Publish required” means required by the server before an explicit publication, not that every historic Published record necessarily contains it.

| Data group | Workbook source | Admin location | Draft required | Publish required | Public behavior |
|---|---|---|---:|---:|---|
| Name | `1 Products.product_name` | Basics | Yes | Yes | H1, cards, tables and related links |
| Slug | `1 Products.slug` | Basics, new records only | Yes | Yes | Permanent product URL and joins |
| Category/subcategory | `1 Products` | Basics | Root yes | Root yes | Breadcrumbs, directory and category filtering |
| Record type | `record_type` | Basics | Yes | Yes | Quick facts and type-dependent UI |
| Botanical name | `botanical_name` | Basics | No | No | Product hero where present |
| Also known as | `also_known_as` | Basics | No | No | Stored/admin-only |
| Persistency/type | `persistency_type` | Basics | No | No | Quick facts where present |
| Breeder/origin | `bred_by_origin` | Basics | No | No | **Private; deliberately excluded** |
| Australian bred | `australian_bred` | Basics | No | No | Stored/admin-only |
| Supplier/third-party | `supplier_name`, `is_third_party_product` | Selling | No | No | **Private; deliberately excluded** |
| Distributed by | `distributed_by` | Not editable | No | No | Compatibility storage only; absent from public contract |
| Tagline | `tagline` | Content & publishing | No | Yes | Under H1 and on product cards |
| Blurb | `blurb` | Content & publishing | No | Yes | Introductory paragraph; SEO fallback where needed |
| Key attributes | `key_attributes`, pipe list | Content & publishing | No | Yes | Bullet list |
| Description | `description`, multiline | Content & publishing | No | Yes | Paragraph-preserving “About this variety” |
| Distribution note | `distribution_note` | Content & publishing | No | No | Conditional highlighted public note |
| Description source | `description_source` | Content & publishing | No | No | Admin-only provenance |
| Internal notes/review/source fields | `internal_notes`, `review_flags`, `src_*`, `_evidence`, `source_text`, etc. | Admin/import reports | No | No | **Never public** |
| Minimum rainfall | `rainfall_min_mm` | Agronomy & fit | No | No | Quick facts and comparisons |
| Soil pH/scale | `soil_ph_min`, `soil_ph_scale` | Agronomy & fit | No | No | Quick facts and comparisons |
| Soil range | lightest/heaviest | Agronomy & fit | No | No | Quick facts and comparisons |
| Sowing depth | min/max | Agronomy & fit | No | No | Stored/admin-only in current public page |
| Sowing rates | `2 Sowing rates` | Agronomy & fit | No | No | Quick facts; first rate in comparison table |
| Tolerances | `tolerance`, pipe list | Agronomy & fit | No | No | Quick facts and comparisons |
| End use/livestock | pipe lists | Agronomy & fit | No | No | Quick facts |
| Companion species | `6 Companions` | Agronomy & fit | No | No | Stored/admin-only currently |
| Inoculant/ECOCERT | product fields | Agronomy & fit | No | No | Inoculant private; selected certification can be public |
| Grazing management | `grazing_management_notes` | Agronomy & fit | No | No | Conditional accordion |
| Disease/pest resistance | matching field | Agronomy & fit | No | No | Conditional accordion |
| Stand life | `stand_life_notes` | Agronomy & fit | No | No | Conditional accordion |
| Category-specific facts | `3 Category specifics` | Category-specific | No | No | Selected applicable values in Quick facts |
| Mix components | `5 Mix components` | Category-specific | No | No | Public formulation list and component-specific descriptions |
| Stock code | `4 Sale lines.stock_code` | Selling | No | Valid if line exists | Public stock/order context |
| Seed form | `seed_form` | Selling | No | No | “How it’s sold” |
| Seed grade | `seed_grade` | Selling | No | No | Stored/admin-only; removed from public sales table |
| Pack | `pack_kg`, `pack_unit` | Selling | No | No | “How it’s sold” and order panel |
| Availability | sale line | Selling | No | No | Public stock status and Active/Legacy derivation |
| Display price | `price_display` | Selling | No | No | May appear in order panel; not “How it’s sold” |
| Internal price-list fields | sale-line sheet | Import only | No | No | Private; not public contract |
| Default sale line | `is_default` | Selling | No | At most one | Controls preferred sales presentation |
| PBR/certification | product fields | Selling | No | No | Limited public metadata below related products |
| Licence restriction | `licence_restriction` | Selling | No | No | Stored/admin-only currently |
| Tech-sheet URL | `tech_sheet_pdf_path` | Content & publishing | No | No | Conditional download link |
| Photos | `photo_1` plus stored slots | Content & publishing | No | No | First nonblank photo is hero; other slots retained |
| Related products | slugs | Content & publishing | No | No | Explicit related-product cards |
| Sort order/featured | product fields | Content & publishing | No | No | Ordering and “Also popular” preference |
| Legacy URL | `website_url` | Content & publishing | No | No | Admin/compatibility; redirects are separate |
| SEO title | `7 Website SEO.seo_title` or legacy `menu_label`; `1 Products` cells are currently ignored | SEO | No | **Yes** | Document title and metadata |
| SEO description | `7 Website SEO.meta_description`; `1 Products` cells are currently ignored | SEO | No | **Yes** | Meta description and structured-data fallback |
| Lifecycle status | `status` | Product list/import | New defaults Draft | Explicit publication validated | Controls public eligibility |
| Listing override | listing fields | Selling | No | No | Alters Active/Legacy derivation; public output only shows result |

## 7. Admin website behavior

### Product list and dashboard

The admin provides:

- Published, Draft and Archived product lists
- Search, category, listing and stock-status filters
- Draft overlays for Published products with pending revisions
- Bulk stock-status updates
- Lifecycle actions with confirmation
- Catalogue summary and attention panels
- Missing-tech-sheet and low/unavailable-stock indicators
- Workbook export, dry run and confirmed import

### Six editor sections

1. **Basics** — identity, category, record type, botanical/basic classification.
2. **Agronomy & fit** — sowing, rainfall, pH, soils, tolerance, use, livestock and management.
3. **Category-specific** — fields shown only where relevant, including Mix components.
4. **Selling** — sale lines, availability/listing behavior, certification and private supplier information.
5. **Content & publishing** — the public copy layers, distribution note, admin provenance, media, related products and ordering.
6. **SEO** — title and description required before publication.

Desktop uses section tabs. Mobile uses an “Editing section” dropdown. Category-dependent sections remain unavailable until a category is selected.

### Completion and action behavior

- Completion counts are guidance, not a substitute for server validation.
- The completion panel is collapsible and reports each section.
- Save/Publish actions appear only when there are unpublished changes.
- Saving a Draft requires only the four identity fields.
- Publishing asks for confirmation and promotes the draft/current changes.
- Back navigates directly when the form is clean.
- Back warns only when there are unsaved changes, offering Save draft & leave, Leave without saving, or Keep editing.
- Published live view and Archived view are read-only.
- Archived products must be restored to Draft before editing.

The SEO section labels its fields as compulsory before publish. The browser’s local pre-check does not currently enumerate those SEO errors, but the API does. A publication without SEO therefore fails safely at the server and reports validation errors.

## 8. Public website behavior

### Product directory

The Products page:

- Shows active root categories that contain public products
- Sorts by taxonomy order
- Supports category-group filters
- Shows each category’s image, lead and product count
- Includes loading, error and empty states

### Category page

The Category page:

- Resolves an active root and its active children
- Supports child-category filtering
- Provides grid and comparison-table views
- Shows cards with stock state, name, subcategory, tagline and selected fact chips
- Compares rainfall, soil, pH, first sowing rate and tolerance values
- Separates Published Legacy names into “Also in our catalogue”

Legacy entries are deliberately name-only and are not presented as currently saleable product cards.

### Product detail page

The current public hierarchy is:

1. Breadcrumbs, name, tagline, botanical name, stock state, photo and optional tech sheet
2. Quick facts
3. Blurb
4. Key attributes
5. Conditional Distribution note
6. Mix formulation/components where applicable
7. Multiline Description under “About this variety”
8. Conditional accordions for grazing, disease/pest and stand life
9. “How it’s sold”
10. Order/contact panel
11. Explicit related products
12. Certification/PBR metadata
13. “Also popular”

“Also popular” chooses up to three other products in the same category, preferring featured and catalogue ordering before name.

### SEO and structured data

- Document title and meta description use the stored SEO fields with safe content fallbacks.
- Canonical product paths use `/product/{slug}`.
- Product JSON-LD contains the public name, IH Seeds brand, public description, optional real image and selected Quick facts.
- The sitemap contains the same Published + Active product set as the main catalogue.
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
- Independent Active/Legacy derivation from sale lines and force overrides
- Separate name-only Legacy section on category pages
- Immutable product and category slugs, plus database redirects
- Seven-sheet dry-run/token/commit workbook workflow
- Non-deleting upserts and scoped sale-line replacement
- Taxonomy creation and controlled-value validation through `Lists`
- Preservation of unchanged legacy Published records without weakening new publication rules
- Import/editor schema parity checks
- Public copy hierarchy of Tagline, Blurb, Key attributes, Description and conditional Distribution note
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
- 2 pending draft snapshots attached to products
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
3. Confirm whether any Published products have pending admin drafts; importing those products will replace their direct stored data and remove their draft snapshots.
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
10. Confirm the sitemap/public catalogue contains only the expected Published + Active products.

## 12. Copyable Claude specification for the next workbook

Copy the following block into a future Claude request and add the specific editorial assignment beneath it:

```text
You are refining an IH Seeds catalogue workbook for import into an existing
PostgreSQL-backed website. Treat these as hard compatibility rules:

1. Start from the newest admin export. Preserve the seven numbered sheet names
   and the required Lists sheet.
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
   the current importer ignores those cells.
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
19. Do not alter lifecycle, taxonomy, sale lines, redirects or public/private
    visibility unless the assignment explicitly asks for that change.
20. Deliver a change report listing sheets touched, row counts, fields changed,
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