# IH Seeds website — Product admin v2 build brief

Paste-ready brief for the Replit agent. It restructures the product record into three layers (core / category specifics / sale lines), makes the admin form category-driven, and adds an importer that reads the pre-filled workbook `IH Seeds - Product Data Workbook (pre-filled).xlsx` (sheets 1–7 + Lists).

Everything already built stays. Nothing here changes the public URL of a live product.

---

## 1. Data model changes

### 1.1 `products` — add / rename

| Change | Field | Type | Notes |
|---|---|---|---|
| ADD | `sub_category` | enum, options depend on `category` | Drives site navigation and category-page grouping. Option lists in §5. |
| ADD | `guide_year` | text (e.g. `2026`) | Edition that `guide_section` and `in_current_printed_guide` refer to. |
| RENAME | `persistence_longevity` → `stand_life_notes` | long text | Label in the form: **Stand life notes**. Avoids the clash with `persistency_type`. |
| ADD | `description_source` | text, admin-only | Where the current description came from (live page / guide / tech sheet). Not published. |
| ADD | `website_url_legacy` | text, admin-only | The old irwinhunter.com.au URL, kept for the redirect map. |
| REMOVE | `stock_code` (single) and `pack_sizes[]` | — | Replaced by the `sale_lines` table (§1.2). Keep a read-only "Stock codes" summary on the product list derived from sale lines. |
| REMOVE | `seed_treatment[]` at product level | — | Coating is a property of the sale line (`seed_form`). The values move there. |
| ADD (category specifics) | see §1.3 | | |

Keep as they are: `slug`, `product_name`, `category`, `record_type`, `botanical_name`, `also_known_as[]`, `persistency_type`, `flower_colour`, `bred_by_origin`, `australian_bred`, `distributed_by`, `summary`, `description`, `internal_notes`, `sowing_rates[]`, `rainfall_min_mm`, `soil_ph_min`, `soil_ph_scale`, `soil_range_lightest/heaviest`, `sowing_depth_min/max_cm`, `tolerance[]`, `maturity_measure` + values, `inoculant_group`, `ecocert_approved`, `end_use[]`, `livestock[]`, `companion_species[]`, `disease_pest_resistance`, `grazing_management_notes`, commercial & legal fields, `mix_components[]`, `formulation_year`, availability, tech sheet, photos, publishing, SEO, related products.

Two option-list fixes on existing fields:

- `sowing_rates[].context` add: `General`, `Podded`, `De-hulled`, `Coated` (existing: Monoculture, In a mix, Dryland, Irrigation, Pasture, Turf).
- `tolerance[]` chips need a three-state toggle: off → on → **Mild**. Store as `Low pH` / `Mild Low pH` etc. The printed guide codes "Mild S" and "Mild P/W" on many rows.

### 1.2 New table `sale_lines` (one row per warehouse stock code)

| Field | Type | Notes |
|---|---|---|
| `product_id` | FK → products | |
| `stock_code` | text, unique across all lines | e.g. `MARG`, `MARGP`, `KIK2C` |
| `seed_form` | enum: Bare / de-hulled · Podded · Coated · Coated + Gaucho · BioNPK-S coated · Goldstrike coated · Scarified · Lime coated | blank allowed |
| `seed_grade` | enum: Certified · Tested · Certified & Tested · VNS | blank allowed |
| `pack_kg` | decimal | 2, 5, 10, 15, 20, 22.7, 25 all occur |
| `pack_unit` | text, default `kg` | |
| `availability` | enum: Good stock · Low stock · Very low · Unavailable | per line |
| `price_display` | text, default `Contact for pricing` | never a number on the public site |
| `is_default` | boolean | exactly one per product; the line the catalogue card shows |
| `sort_order` | integer | |

Product-level `availability` becomes **derived**: the best availability among its lines, with an optional manual override field `availability_override`. Show the derived value in the Availability panel with the lines listed under it.

### 1.3 Category-specific fields (columns on `products`, shown conditionally)

Simplest in Replit: plain nullable columns on `products`, with the form showing only those that apply to the product's category (§2.2). Well-evidenced set for this build:

| Field | Type | Applies to |
|---|---|---|
| `ploidy` | enum: Diploid · Tetraploid · Hexaploid · Mixed (blend) | Ryegrasses, Fescues & Other Grasses, Sub-Tropical Grasses, Mixes |
| `heading_date` (exists under maturity) | enum: Very early · Early · Mid · Mid-late · Late | Ryegrasses, Fescues & Other Grasses |
| `heading_offset_days` | integer, signed (vs Nui) | Ryegrasses |
| `argt_resistant` | boolean | Ryegrasses |
| `endophyte` | enum: Nil · Low · MaxP · Standard | Ryegrasses, Fescues & Other Grasses |
| `growth_season` | enum: Summer-active · Winter-active / Mediterranean · Year-round · Warm-season | Fescues & Other Grasses, Sub-Tropical Grasses |
| `maturity_days` (exists) | integer, days to flowering at Perth | Clovers, Serradellas & Medics |
| `hard_seed_level` | enum: Soft · Low · Moderate · High · Very high | Clovers, Serradellas & Medics |
| `oestrogen_level` | enum: None · Trace · Low · High | Clovers (sub clovers especially) |
| `bloat_risk` | enum: Low · Moderate · High | Clovers, Serradellas & Medics |
| `flower_colour` (exists) | enum | Serradellas & Medics, Clovers |
| `winter_activity` (exists) | integer 1–10 | Lucerne |
| `growing_season` | enum: Summer · Winter · Either | Forage & Grain Crops |
| `weeks_to_first_grazing` | text range, e.g. `6–8` | Forage & Grain Crops |
| `prussic_acid_risk` | enum: None · Low · Standard – manage | Forage & Grain Crops (sorghums, millets) |
| `regrowth` | enum: Single cut · Multi-cut / regrazes | Forage & Grain Crops |
| `flowering_window` (exists) | text | Mixes |
| `product_form` | enum: Powder · Liquid · Peat · Granule | Biologicals |
| `application_rate` | text | Biologicals |

`maturity_measure` is no longer chosen by the user — it is **preset by category**: Ryegrasses & Fescues → Heading date; Clovers & Serradellas → Days to flowering (Perth); Lucerne → Winter activity rating; Mixes → Time of flowering; everything else → none. Show the matching value input inline next to the label.

### 1.4 `redirects` table

`from_path` → `to_path`, 301. Seed it from sheet **7 Website SEO** column `redirect_note` (two rows today: the duplicate Souwest page, and soft-seeded Persian clover pointing at the hard-seeded page — confirm with Lance whether those should stay two products). Every product save that changes nothing about the slug is a no-op here; slugs are immutable after first publish.

### 1.5 Listing state — Active vs Legacy

Every product has a derived `listing_state`:

- **Active** — the product has at least one sale line whose availability is not `Unavailable`. Importing the current price list therefore sets it automatically.
- **Legacy** — no such sale line. The product stays in the catalogue (its agronomy, tech sheet and history are kept) but is not actively sold.
- `listing_override` (nullable enum: `Force active` · `Force legacy`) wins over the derived value when set. Use case: a line held pre-season that is not yet on the price list, or run-out stock that should drop off the shelf early.

Effects across the site (§4 has the layout):

| | Active | Legacy |
|---|---|---|
| Product page `/product/{slug}` | yes | **no** — no URL is published; requests 301 to the category page's catalogue anchor |
| Category page | full-colour card in the main grid | name only, in the "Also in our catalogue" list at the foot of the page |
| Counts (category tiles, "24 ryegrasses", filter counts, home page totals) | counted | **never counted** |
| Filters and comparison table | included | excluded |
| Site search | normal result | shown under a separate "In our catalogue" heading, no link, "ask us" contact link instead |
| Sitemap / structured data | included | excluded |
| Tech Sheets Hub | listed | listed, tagged "catalogue line" — the PDF is still useful |

Today's split from the workbook: 96 Active, 54 Legacy. Six Legacy products currently have live pages (Avalon, Icon Lucerne, Anywhere Tall Fescue, Nemnuke, Parafield Peas, Persian Clover) — sheet 7 carries their 301 targets.

---

## 2. Admin form restructure

### 2.1 Layout

Replace the single long page with five tabs (or a sticky in-page nav with collapsed sections — either is fine, tabs preferred). Each tab header shows `filled / required` for that tab, and the product header shows an overall completeness percentage (required fields for this category that are filled).

1. **Basics** — product name, slug, category, sub-category, record type, botanical name, also known as, guide section + year, in current printed guide, persistency type, bred by, Australian bred, distributed by.
2. **Agronomy** — sowing rates (repeatable), rainfall, soil pH + scale, soil range, sowing depth, tolerance chips (3-state), end use, livestock, companion species, inoculant group (legumes only), ECOCERT (mixes only), disease & pest resistance, stand life notes, grazing management notes.
3. **Category specifics** — the panel from §2.2. Tab label shows the category name, e.g. "Ryegrass specifics".
4. **Selling** — sale lines (repeatable rows; §1.2), derived availability + override, **listing state** (read-only badge: Active / Legacy, with the `listing_override` select beside it and one line explaining why: "Active — 2 sale lines on the current price list"), price display, commercial & legal (PBR, licence, certification, third-party, supplier).
5. **Content & publishing** — summary, description, internal notes, photos, tech sheet PDF, SEO title/description, related products, sort order, featured, status, archive/delete.

Category must be chosen before tabs 2–4 unlock (it is already required); changing category later shows a confirm dialog because it changes which fields are kept.

### 2.2 What each category shows

| Category | Category-specifics panel shows | Also hide on other tabs |
|---|---|---|
| Ryegrasses | ploidy, heading date, heading offset days, ARGT resistant, endophyte | inoculant group |
| Clovers | maturity days, hard seed level, oestrogen level, bloat risk, flower colour | — |
| Serradellas & Medics | maturity days, hard seed level, flower colour, bloat risk | — |
| Lucerne | winter activity (1–10) | — |
| Fescues & Other Grasses | ploidy, heading date, endophyte, growth season | inoculant group |
| Sub-Tropical Grasses | ploidy, growth season | inoculant group |
| Herbs | (panel hidden — "No category-specific fields for herbs") | inoculant group |
| Forage & Grain Crops | growing season, weeks to first grazing, prussic acid risk, regrowth | — |
| Mixes | flowering window, mix components (moved here from the bottom of the page), formulation year | botanical name, inoculant group, bred by |
| Biologicals | product form, application rate | rainfall, soil, tolerance, sowing depth, maturity, inoculant, livestock, companions, disease, stand life — the whole Agronomy tab collapses to sowing/application notes |

### 2.3 Product list view

Table, not cards: name · category · sub-category · **listing state** · status · in guide · completeness % · derived availability · stock codes · last edited. Filters on category, sub-category, listing state, status, in-guide, availability, completeness < 100. Default sort: Active first, then by sort order. Bulk actions: set availability (per sale line, via a simple picker), set status, export selection as CSV in the workbook column layout. Search across name, also-known-as, stock code, botanical name.

---

## 3. Importer

Accept `.xlsx` with the sheet names below (also accept the same as separate CSVs). Upsert on `slug`. Run as a **dry run first** that returns a validation report (row, column, problem) and only commits when the user confirms. Never delete rows that are absent from the file.

| Sheet | Key | Behaviour |
|---|---|---|
| `1 Products` | `slug` | Upsert core fields. `listing_override` is imported; `listing_state` is ignored (it is derived after sale lines load). Ignore columns starting `src_`, plus `stock_codes`, `website_url`, `data_completeness`, `latest_source_year`, `review_flags`, `description_source` (store the last one as admin-only if present). |
| `2 Sowing rates` | `slug` | Replace that product's rate rows with the rows in the file. |
| `3 Category specifics` | `slug` | Update the category columns; ignore `_evidence`; ignore values in columns that do not apply to the row's category. |
| `4 Sale lines` | `stock_code` | Upsert; ignore `price_list_name`, `price_list_group`, `list_price_per_kg_ex_gst`, `farm_price_per_kg_ex_gst`, `match`, `review`. Rows with blank `slug` are skipped and reported. |
| `5 Mix components` | `mix_slug` | Replace that mix's components; `component_slug` links to a product where present, otherwise store `component_name` as text. |
| `6 Companions` | `slug` | Add links where `companion_slug` is set; keep `companion_text` as free text otherwise. |
| `7 Website SEO` | `website_slug` | Only `redirect_note` is used (seeds `redirects`): two product-to-product redirects and six legacy pages → their category page. |
| `Lists` | — | Reference only; validate enum columns against it and report any value not in the list. |

Conventions: multi-value cells are pipe-separated with no spaces (`Grazing|Hay`); `Y`/`N` booleans; numbers plain; blank cell = leave existing value unchanged (a literal `NULL` clears it).

Export must round-trip: "Export all products" produces the same seven sheets so the office can edit in Excel and re-import.

---

## 4. Public site

**Design constraint — read first.** Nothing below introduces a new visual language. Everything uses the IH Seeds Style Guide (5 Nov 2025) as already applied on the site: Raleway (Tahoma fallback); the type scale h1 48 / h2 36 / h3 30 / h4 24 / h5 20 / h6 16 / body 16 at the stated line-heights; brand green `#0C583C`, yellow `#F9B617`, black-green `#1D281C`; the three tint sets (green `#839587 / #C5CCC5 / #EFF1EE`, yellow `#F8D999 / #FCEED3 / #FEFBF2`, grey `#75766E / #BCBDB8 / #EDEDEB`); full-rounded buttons (solid green primary, outlined secondary, hover/active states as in the guide); rounded image corners. Reuse the existing components — product card, stock-status pill, quick-facts bar, filter sidebar, mix components table — and extend them; do not add cards-within-cards, gradients, new accent colours, icons sets, or a second hero style. Where a new element is unavoidable (the fact chip, the legacy list) it is specified below in guide terms.

### 4.1 Category pages `/products/{category}/`

Same hero band as the Products page (h1 category name, one-sentence intro, "Download the 2026 Pasture Seed Guide" button). Then, top to bottom:

1. **Sub-category switcher** — a row of full-rounded secondary (outlined green) buttons directly under the hero: "All (13)", then one per sub-category with its Active count, e.g. "Annual tetraploid (5)". The selected one is the solid green primary. Categories with a single sub-category (Lucerne, Biologicals) do not show the row. On mobile the row scrolls horizontally; it does not wrap into a stack.
2. **Filter sidebar** (existing) — site-wide filters (rainfall, soil, pH, end use, livestock, tolerance, persistency, in current guide) plus this category's own filters from §2.2 (e.g. ploidy and heading date on Ryegrasses; days to flowering and hard seed on Clovers; winter activity on Lucerne). All counts are Active-only.
3. **Active product grid** — the existing card, with these fields in this order: photo (rounded corners; category placeholder image if none) · stock-status pill top-left over the photo · name (h5, 20px/600) · sub-category as a small grey label (`#75766E`, 14px) · **three fact chips** · "View product" text link. Sort: `featured` first, then `sort_order`. Card count in the section heading: "13 ryegrasses".
4. **Comparison table** — a "Compare as a table" toggle above the grid switches the same Active set into a sortable table: name · sub-category · stock · min rainfall · soil range · pH · sowing rate · tolerances (guide codes: P / W / S, "Mild S") · end use · then the category's own columns. Header row in `#EFF1EE`; sticky header; scrolls horizontally inside its own container on mobile.
5. **"Also in our catalogue" — the Legacy list**, anchor `#catalogue`. A full-width band in `#EFF1EE` (or `#EDEDEB`) with h3 "Also in our catalogue" and one line of body copy: "These lines are not on our current price list. Ask us about availability or a custom mix." followed by a **Contact us** secondary button. Under it, the Legacy names as plain text in `#75766E`, 16px, grouped by sub-category (sub-category name as h6), laid out in 2–3 columns on desktop, one on mobile. No photos, no cards, no pills, no links to product pages, no count anywhere. If a category has no Legacy lines, the band is not rendered.

**Fact chips** — the one new element. A chip is a full-rounded label, 14px/500 Raleway, `#0C583C` text on `#EFF1EE`, 4px 10px padding, three per card maximum, blank facts skipped. Which three, by category (this is how category-specific information reaches the customer at browse level without changing the card):

| Category | Chip 1 | Chip 2 | Chip 3 |
|---|---|---|---|
| Ryegrasses | Ploidy ("Tetraploid") | Heading date ("Mid-late heading") | Min rainfall ("550 mm+") |
| Clovers | Sub-category ("Subterranean") | Days to flowering ("105 days") | Hard seed ("High hard seed") |
| Serradellas & Medics | Flower colour ("Pink flowered") | Days to flowering | Forms sold ("Podded & bare") |
| Lucerne | Winter activity ("Winter active 9") | Min rainfall | Rate context ("Dryland & irrigation") |
| Fescues & Other Grasses | Endophyte ("Nil endophyte") | Growth season ("Summer-active") | Min rainfall |
| Sub-Tropical Grasses | Seed form ("Coated + Gaucho") | Min rainfall | End use ("Pasture & turf" where turf rate exists) |
| Herbs | Persistency ("Perennial") | Min rainfall | End use |
| Forage & Grain Crops | Growing season ("Summer crop") | Weeks to first grazing ("Graze 6–8 wks") | Sub-category ("Sorghum") |
| Mixes | Purpose = sub-category ("Cover crop") | Sowing rate ("25–35 kg/ha") | Flowering window ("Aug–Nov") |
| Biologicals | Product form ("Powder") | Application rate | Pack ("5 kg") |

Stock-status pill colours, unchanged from the availability table: Good stock = `#0C583C` text on `#EFF1EE`; Low stock = `#1D281C` on `#FCEED3`; Very low = `#1D281C` on `#F8D999`; Unavailable = `#75766E` on `#EDEDEB`.

### 4.2 Product page `/product/{slug}` — Active products only, same skeleton on every product

1. Header: name (h1) · botanical name (grey, italic) · breadcrumb Products › Category › Sub-category · summary as tagline · hero photo · stock-status pill · "Download tech sheet" primary button.
2. **Quick-facts bar** (existing component) — eight facts, same order everywhere, blank ones omitted: Type & persistency · Min rainfall · Soil range & pH (with scale) · Sowing rate(s) by context · Tolerances (guide codes, "Mild" spelled out) · End use · Livestock · Sow with (linked to their product pages).
3. **Category details** — a second row of the *same* quick-facts tiles, headed h4 "{Category} details" (e.g. "Ryegrass details"), holding the rows from §2.2 for that category. For mixes this row is replaced by the existing mix-components table (component name → link where `component_slug` exists, rate, note) with "Formulation {year}" under the heading. Herbs skip this row.
4. Description (paragraphs preserved), then three collapsible sections in the existing accordion style: "Planting & grazing notes", "Disease & pest resistance", "Stand life".
5. **How it's sold** — a small table, one row per sale line: form · grade · pack · stock-status pill · price display ("Contact for pricing"). Default line first.
6. Related products (existing card row) · companion species · certification / PBR footer line in grey body text.

### 4.3 Navigation and counts

- Products mega-menu: category → sub-category, listing Active products only; a category's count is its Active count. Sub-categories with zero Active products are hidden from the menu but still exist as filters.
- Home-page and About-page figures ("80+ varieties and mixes") should read from the Active count, not the catalogue count.

### 4.4 SEO

- `<title>` = `seo_title` (fallback `{product_name} | IH Seeds`), meta description = `seo_description` (fallback: summary, 160 chars).
- Canonical URL `/product/{slug}`; 301s from `redirects`; product sitemap regenerated on publish and containing Active products only.
- Structured data: `Product` schema with name, description, brand "IH Seeds", image, and `additionalProperty` for the quick-facts. No price.
- Legacy names are plain text in the category page HTML, so they remain findable by search engines without competing pages.
- Tech-sheet PDFs served from `tech_sheet_pdf_path` with the product name as link text.

---

## 5. Option lists

`category`: Ryegrasses · Clovers · Fescues & Other Grasses · Serradellas & Medics · Lucerne · Herbs · Sub-Tropical Grasses · Biologicals · Forage & Grain Crops · Mixes

`sub_category` by category:

- Ryegrasses: Annual tetraploid · Annual diploid · Italian & biennial · Perennial & hybrid
- Clovers: Subterranean · Aerial-seeded annual · Perennial
- Serradellas & Medics: Serradella · Medic · Other legume
- Lucerne: Lucerne
- Herbs: Chicory · Plantain
- Fescues & Other Grasses: Tall fescue · Cocksfoot · Phalaris · Prairie grass · Veldt grass · Puccinellia · Tall wheatgrass · Other grass
- Sub-Tropical Grasses: Rhodes grass · Couch / Bermuda · Kikuyu · Panic · Setaria · Carpet grass · Teff · Other sub-tropical
- Biologicals: Biological
- Forage & Grain Crops: Cereal · Pulse / legume · Brassica · Millet · Sorghum · Oilseed · Other
- Mixes: Pasture · Cover crop · Green manure · Equine · Dairy · Irrigation · Self-regenerating · Inter-row / orchard · Nitrogen / legume · Sub-tropical perennial

All other enums are on the workbook's **Lists** sheet and should be loaded from there, not hard-coded, so a new option is a spreadsheet row.

---

## 6. Acceptance checks

1. Import the workbook in dry-run: 150 products, 242 rate rows, 112 sale lines (9 skipped as "not in catalogue" plus the custom-mix line), 118 components, 79 SEO rows; zero enum violations.
2. Open Margurita French Serradella: Selling tab shows two lines (MARG bare, MARGP podded); Category specifics shows hard seed, flower colour, days to flowering and nothing about ploidy or winter activity.
3. Open L97 Lucerne: maturity shows "Winter activity rating: 9" with no heading-date control visible.
4. Open BioNPK Powder S: Agronomy tab is reduced to application notes; no rainfall/soil/tolerance fields.
5. Tolerance chip on Amazon T reads "Mild Low pH" and "Waterlogging"; the public page prints "Mild P / W".
6. `/product/souwest-pasture-mix` 301s to `/product/souwest-pasture-mix-2`; `/product/icon-lucerne` 301s to `/products/lucerne#catalogue`.
7. Ryegrasses category page: sub-category row reads All (13) · Annual tetraploid (5) · Annual diploid (2) · Italian & biennial (3) · Perennial & hybrid (3); the grid shows 13 cards; the "Also in our catalogue" band lists 12 names in grey with no links; Aristocrat II has no product URL.
8. Setting `listing_override = Force legacy` on Abundant removes it from the grid, counts and sitemap on the next publish; clearing the override restores it.
9. Export → re-import with no changes produces zero diffs.
