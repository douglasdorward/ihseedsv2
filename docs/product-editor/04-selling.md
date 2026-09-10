# Tab 4 — Selling

Sale lines, availability, PBR, certification, and private supplier fields.

If any sale lines exist, publishing requires unique stock codes and exactly one default line.

## Sale lines

One card per warehouse stock code. Legacy listing state disables availability on every line.

### Default

- **API path:** `saleLines[].isDefault`
- **Workbook:** `4 Sale lines.is_default`
- **Required:** exactly one default when any lines exist (publish)
- **Customer website:** Chooses the preferred pack/price for the order panel. Does not print the word “default”.
- **Public API:** yes
- **How to fill:** Radio across lines. The first added line starts as default.

### Stock code

- **API path:** `saleLines[].stockCode`
- **Workbook:** `4 Sale lines.stock_code`
- **Required:** unique among all sale lines when lines exist
- **Customer website:** not shown on the current “How it’s sold” table. Still present in the public sale-line payload for order context.
- **Public API:** yes
- **How to fill:** Warehouse code, e.g. `BIONPKS`. Globally unique across the catalogue.
- **Constraints:** required string on the SaleLine schema.

### Seed form

- **API path:** `saleLines[].seedForm`
- **Workbook:** `4 Sale lines.seed_form`
- **Required:** no
- **Customer website:** “How it’s sold” Form column (`Bare` if blank). Some category cards chip seed form (serradella, sub-tropical).
- **Public API:** yes
- **How to fill:** Bare / de-hulled, Podded, Coated, Coated + Gaucho, BioNPK-S coated, Goldstrike coated, Scarified, Lime coated.

### Seed grade

- **API path:** `saleLines[].seedGrade`
- **Workbook:** `4 Sale lines.seed_grade`
- **Required:** no
- **Customer website:** not shown (removed from the sales table on purpose)
- **Public API:** yes (public API, not shown)
- **How to fill:** Certified, Tested, Certified & Tested, VNS. Staff grading only for the public page.

### Pack weight / Pack unit

- **API path:** `saleLines[].packKg`, `saleLines[].packUnit`
- **Workbook:** `4 Sale lines.pack_kg`, `pack_unit`
- **Required:** no
- **Customer website:** “How it’s sold” Pack column. Order panel “Available in …” lists unique positive pack weights. Public pages must not fall back to vestigial product-level `packSize` when sale-line packs exist; the table may still use product `packSize` if a line has no pack weight.
- **Public API:** yes
- **How to fill:** e.g. `25` and `kg`.

### Availability

- **API path:** `saleLines[].availability`
- **Workbook:** `4 Sale lines.availability`
- **Required:** no (blank is TBA in the editor)
- **Customer website:** “How it’s sold” Status pill, and contributes to the product stock pill when no override is set. Disabled and forced Unavailable when listing state is Legacy.
- **Public API:** yes (`Good stock`, `Low stock`, `Very low`, `Unavailable`, or null)
- **How to fill:** Leave TBA only when stock is not yet known. Legacy products cannot advertise stock.

### Price display

- **API path:** `saleLines[].priceDisplay`
- **Workbook:** `4 Sale lines.price_display`
- **Required:** no
- **Customer website:** Order panel amount for the default (or first) line. Not a column in “How it’s sold”. Falls back to “Contact for pricing”.
- **Public API:** yes
- **How to fill:** Customer-facing price string, not internal list prices. Workbook price-list columns are import-only and never public.

### Sale-line sort order

- **API path:** `saleLines[].sortOrder`
- **Workbook:** `4 Sale lines.sort_order`
- **Required:** no (set automatically as lines are added)
- **Customer website:** Category grids currently sort non-featured products by the first sale line’s `sortOrder`. “How it’s sold” follows API line order (default first, then this sort).
- **Public API:** yes
- **How to fill:** Usually leave the editor order. Do not confuse with Content & publishing → Sort order on the product.

## Availability override

- **API path:** `availabilityOverride`
- **Workbook:** product-level availability / listing fields (not a sale-line cell)
- **Required:** no
- **Shown when:** always; disabled when listing state is Legacy
- **Customer website:** Drives the product-level stock pill (`in-stock`, `low`, `very-low`, `unavailable`) when set. “Use derived” takes the default line, else the first non-Unavailable line, else Unavailable. Legacy always Unavailable.
- **Public API:** override itself is excluded; only the derived `status` is public
- **Purpose:** Force a product-level stock message without editing every line.
- **How to fill:** Leave “Use derived” unless the warehouse picture should differ from the lines.

## PBR protected / PBR details

- **API path:** `details.pbrProtected`, `details.pbrDetails`
- **Workbook:** `1 Products.pbr_protected` (details text is product details)
- **Required:** no
- **Customer website:** Sidebar line `PBR: {details or "Protected"}` when the checkbox is on. Shown below related products.
- **Public API:** yes
- **How to fill:** Check only for plant-breeder’s-rights varieties. Details e.g. variety code. Max 300 characters on details.

## Licence restriction

- **API path:** `details.licenceRestriction`
- **Workbook:** `1 Products.licence_restriction`
- **Required:** no
- **Customer website:** not shown
- **Public API:** excluded (admin-only)
- **Purpose:** Private production or resale restriction.
- **Constraints:** max 1000 characters.

## Certification

- **API path:** `details.certification[]`
- **Workbook:** `1 Products.certification`
- **Required:** no
- **Customer website:** Sidebar `Certification: …` when any values are set.
- **Public API:** yes
- **How to fill:** Multi-select ASF Code of Practice, Certified Quality Assured Seed, Certified seed, Licensed production.

## Third-party product / Supplier name

- **API path:** `details.isThirdPartyProduct`, `details.supplierName`
- **Workbook:** `1 Products.is_third_party_product`, `supplier_name`
- **Required:** no
- **Customer website:** not shown
- **Public API:** excluded (admin-only)
- **Purpose:** Private sourcing. Never copy supplier names into public copy.
- **Constraints:** supplier name max 180 characters.
