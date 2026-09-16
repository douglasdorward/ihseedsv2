# Replit prompt: align the workbook import/export with what the website actually uses

## Context

The customer website (artifacts/web) is the source of truth. I have audited every workbook column against the importer (artifacts/api-server/src/lib/workbook.ts), the public API (toPublicDetails in routes/products.ts), the Next.js site and the back office (artifacts/claude-design). Going forward the **back office export is the master file**: I will download it, edit it, and re-import it. So the export must emit exactly the columns below, in this order, and an untouched export must re-import with zero issues.

Do the work in this order. Do not change the database schema or delete any stored data; every removal below is from the importer, exporter, editor, AI field catalog, OpenAPI examples and docs only. Keep all existing tests green and add tests where noted.

## 1. Bug fixes

1.1 **flowering_window never reaches the website.** `toPublicDetails` omits `floweringWindow`, so the Mixes card chip in `artifacts/web/app/products/product-card-facts.ts` can never show it. Add `floweringWindow` to `toPublicDetails`, to the PublicProductDetails schema in `lib/api-spec/openapi.yaml` (regenerate the clients), and set its visibility to `customer` in `docs/product-editor/fields.yaml`.

1.2 **Remove leftover debug instrumentation.** `routes/products.ts` (around lines 845 and 895) and `claude-design/src/pages/Admin.tsx` (around lines 913–943) contain `fetch('http://127.0.0.1:7761/ingest/…')` calls. Delete them.

1.3 **SEO title source.** The importer falls back from `seo_title` to `menu_label` on sheet 7. Remove the `menu_label` fallback: `seo_title` on sheet 7 is the only source of the page title. Also remove `redirectFromNote()` and the `redirect_note` / `website_slug` / `product_url` handling on sheet 7; redirects come only from sheet 9. Keep `website_url` on sheet 1 as the legacy-URL field. Keep the two hard-coded redirects (souwest, icon-lucerne) as they are.

## 2. Ordering

2.1 **Category pages sort alphabetically by product name.** In `CategoryCatalogue.tsx`, `ProductsListing.tsx` and `lib/product-filters.ts`, replace the "featured first, then sale-line sortOrder" ordering with plain A–Z on `name` (locale compare). The comparison table follows the same order.

2.2 **Sale lines ("How it's sold" and the order panel):** the default line first, then `packKg` ascending, then `stockCode`. Derive this in `liveSaleLines` / the public API sort; stop relying on `sortOrder`. The editor should no longer show or assign sale-line sort order. Keep the DB column.

2.3 **Drop `featured` everywhere except the DB:** site sorting, `toPublicDetails`, editor tick box, workbook import/export, AI field catalog, fields.yaml and docs.

## 3. Fields to remove from importer, exporter, editor and docs (data stays in the DB)

Product fields: `guide_section`, `guide_year`, `also_known_as`, `bred_by_origin`, `distributed_by`, `inoculant_group`, `licence_restriction`, `is_third_party_product`, `supplier_name`, `in_current_printed_guide`, `description_source`, `internal_notes` (details.notes), `ecocert_approved`, product-level `sort_order` (details.sortOrder), `featured`.

Sale lines: `seed_grade`. The editor should not show it; the export should not emit it; the importer should not read it.

Mix components: the `note` column (details.components[].note).

Companions: remove sheet **6 Companions** from import and export, and remove the "Companion products" section from the editor. "Also popular" continues to use `related_products`.

Categories: remove sheet **8 Categories** from import and export. Categories are managed in the back office only.

Make sure `normalizeProductDetails` still tolerates these keys in stored JSON (it should, it just spreads them), that publish validation does not reference any of them, and that `ai-field-catalog.ts` / Fill from PDF no longer target them.

## 4. Exact workbook shape (import and export must match this)

Column order matters for the export. `NULL` in a cell still means "clear this value" on import. Pipe `|` separates multi-values.

**1 Products** — slug, product_name, category, sub_category, record_type, botanical_name, persistency_type, australian_bred, tagline, blurb, key_attributes, description, distribution_note, rainfall_min_mm, soil_ph_min, soil_ph_scale, soil_range_lightest, soil_range_heaviest, sowing_depth_min_cm, sowing_depth_max_cm, tolerance, end_use, livestock, disease_pest_resistance, stand_life_notes, grazing_management_notes, pbr_protected, pbr_details, certification, formulation_year, related_products, photo_1, tech_sheet_pdf_path, website_url, listing_state, listing_override, availability, status

- Export `photo_1` only (keep `photo_2`/`photo_3` accepted on import if present, but do not emit them).
- Do not export `availability_override`; keep accepting it on import. It is set in the back office.
- `related_products` is already read by the importer (ARRAY_KEYS) and written by the exporter. Validate that every slug in it resolves to a product in the workbook, and report unresolved ones as issues on dry-run.
- `listing_override` continues to export blank.

**2 Sowing rates** — slug, context, min, max, unit

**3 Category specifics** — slug, category, ploidy, heading_date, heading_offset_days, argt_resistant, endophyte, growth_season, maturity_days, hard_seed_level, oestrogen_level, bloat_risk, flower_colour, winter_activity, growing_season, weeks_to_first_grazing, prussic_acid_risk, regrowth, flowering_window, product_form, application_rate

- Remove `ecocert_approved` from SPECIFICS and from the Biologicals applicable set.

**4 Sale lines** — slug, stock_code, seed_form, pack_kg, pack_unit, availability, price_display, is_default

**5 Mix components** — mix_slug, component_slug, component_name, inclusion_rate, rate_unit, component_description

**7 Website SEO** — product_slug, h1, seo_title, meta_description, social_title, social_description, social_image, canonical_url, robots_index

- One row per product on export. `seo_title` and `meta_description` are required for Published rows (unchanged). The other columns stay optional.

**9 Redirects** — from_path, to_path

**10 Product FAQs** — slug, product_name, question, answer

**Lists** — keep as the validation sheet, but make it **visible** in the export (it is currently hidden) so I can add allowed values. Remove list columns that no longer feed anything (guide_section, inoculant_group, seed_grade, certification stays).

Sheets 6 and 8 are no longer part of the workbook. If an uploaded workbook still contains them, ignore them and add a warning "Sheet X is no longer imported" to the dry-run report rather than failing.

## 5. Things NOT to change

- Mix component rows are imported exactly as supplied (no "current in formulation" logic).
- Product-level `packSize` stays as it is on the home page, Resources page and Biologicals chip.
- Category FAQs stay back-office only.
- Publish validation rules (tagline ≤ 60, blurb, key attributes, description, SEO title, SEO description) are unchanged.
- Database schema, migrations and stored JSON: untouched.

## 6. Acceptance

1. Download the export, upload it unchanged to dry-run: **0 issues, 0 warnings** (other than Review-sheet warnings if any).
2. The export's sheet names and column headers match section 4 exactly.
3. A Mix with `flowering_window` set shows it as a card chip on its category page.
4. Category pages list products A–Z; a product previously marked featured no longer jumps to the top.
5. A product with a default sale line and two pack sizes shows the default line first, then ascending pack size, in "How it's sold".
6. Editing a product in the back office shows no fields from section 3, and saving does not wipe existing values for those fields (check the raw `details` JSON before and after).
7. `pnpm run typecheck` and the api-server test suite pass. Update `docs/product-editor/*.md`, `fields.yaml` and `CATALOGUE_SYSTEM_GUIDE.md` to match.

Before starting, list any place where these instructions conflict with the current code and ask me rather than guessing.
