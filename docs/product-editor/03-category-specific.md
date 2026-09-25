# Tab 3 — Category-specific
Fields appear only for the selected root category. Herbs have no extra fields.

Quick facts on the product page also filter by category, so filling a field that is hidden for this category will not show it to customers.

Ploidy is offered for Mixes in the editor but Quick facts only print ploidy for Ryegrasses, Fescues & Other Grasses, and Sub-Tropical Grasses.

## Ryegrasses, Fescues & Other Grasses, Sub-Tropical Grasses, Mixes

### Ploidy

- **API path:** `details.ploidy`
- **Workbook:** `3 Category specifics.ploidy`
- **Required:** no
- **Shown when:** Ryegrasses, Fescues & Other Grasses, Sub-Tropical Grasses, or Mixes
- **Customer website:** Quick facts “Ploidy” for the three grass categories only. Ryegrass category cards chip it. Mix Quick facts do not show it.
- **Public API:** yes
- **How to fill:** Diploid, Tetraploid, Hexaploid, or Mixed (blend).

## Ryegrasses, Fescues & Other Grasses

### Heading date

- **API path:** `details.headingDate`
- **Workbook:** `3 Category specifics.heading_date`
- **Required:** no
- **Customer website:** Quick facts “Heading date”. Ryegrass cards chip it.
- **Public API:** yes
- **How to fill:** Very early, Early, Mid, Mid-late, Late.

### Endophyte

- **API path:** `details.endophyte`
- **Workbook:** `3 Category specifics.endophyte`
- **Required:** no
- **Customer website:** Quick facts “Endophyte”. Fescue cards chip `{value} endophyte` unless the value is Nil/None.
- **Public API:** yes
- **How to fill:** Nil, Low, MaxP, Standard.

## Ryegrasses only

### Heading offset days

- **API path:** `details.headingOffsetDays`
- **Workbook:** `3 Category specifics.heading_offset_days`
- **Required:** no
- **Customer website:** Quick facts “Heading offset” as `{n} days vs Nui`.
- **Public API:** yes
- **Purpose:** Days relative to Nui.
- **How to fill:** Integer days. Blank if unknown.

### ARGT resistant

- **API path:** `details.argtResistant`
- **Workbook:** `3 Category specifics.argt_resistant`
- **Required:** no
- **Customer website:** Quick facts “ARGT resistance: Resistant” only when true. False/unset is omitted.
- **Public API:** yes
- **How to fill:** Check only when annual ryegrass toxicity resistance is a real claim.

## Clovers, Serradellas & Medics

### Maturity days (Perth)

- **API path:** `details.maturityDays`
- **Workbook:** `3 Category specifics.maturity_days`
- **Required:** no
- **Customer website:** Quick facts “Days to flowering”. Clover and serradella cards chip `{n} days`.
- **Public API:** yes
- **How to fill:** Integer days to flowering at Perth. Not Lucerne winter activity.

### Hard seed level

- **API path:** `details.hardSeedLevel`
- **Workbook:** `3 Category specifics.hard_seed_level`
- **Required:** no
- **Customer website:** Quick facts “Hard seed level”. Clover cards chip `{value} hard seed`.
- **Public API:** yes
- **How to fill:** Soft, Low, Moderate, High, Very high.

### Bloat risk

- **API path:** `details.bloatRisk`
- **Workbook:** `3 Category specifics.bloat_risk`
- **Required:** no
- **Customer website:** Quick facts “Bloat risk”.
- **Public API:** yes
- **How to fill:** Low, Moderate, High.

### Flower colour

- **API path:** `details.flowerColour`
- **Workbook:** `3 Category specifics.flower_colour`
- **Required:** no
- **Customer website:** Quick facts “Flower colour”. Serradella cards chip `{colour} flowered`.
- **Public API:** yes
- **How to fill:** Pink, Yellow, White, Crimson, Red, Purple.

## Clovers only

### Oestrogen level

- **API path:** `details.oestrogenLevel`
- **Workbook:** `3 Category specifics.oestrogen_level`
- **Required:** no
- **Customer website:** Quick facts “Oestrogen level”.
- **Public API:** yes
- **How to fill:** None, Trace, Low, High.

## Lucerne

### Winter activity (1–10)

- **API path:** `details.winterActivity`
- **Workbook:** `3 Category specifics.winter_activity`
- **Required:** no
- **Customer website:** Quick facts “Winter activity”. Lucerne cards chip `Winter active {n}` (or `maturityDays` if `maturityMeasure` is Winter activity rating — prefer this dedicated field).
- **Public API:** yes
- **How to fill:** Integer 1–10.

## Fescues & Other Grasses, Sub-Tropical Grasses

### Growth season

- **API path:** `details.growthSeason`
- **Workbook:** `3 Category specifics.growth_season`
- **Required:** no
- **Customer website:** Quick facts “Growth season”. Fescue cards chip it.
- **Public API:** yes
- **How to fill:** Summer-active, Winter-active / Mediterranean, Year-round, Warm-season.

## Forage & Grain Crops

Forage cards chip growing season (`{value} crop`), weeks to first grazing (`Graze {value} wks`), and on a category page the subcategory name. Those come first. Empty pill slots then fall back to minimum rainfall (`{n} mm+`), persistency type, and the first sowing-rate range. A card shows at most three pills.

### Growing season

- **API path:** `details.growingSeason`
- **Workbook:** `3 Category specifics.growing_season`
- **Required:** no
- **Customer website:** Quick facts “Growing season”. Forage cards chip `{value} crop` ahead of the rainfall, persistency, and sowing-rate fallbacks.
- **Public API:** yes
- **How to fill:** Summer, Winter, Either.

### Weeks to first grazing

- **API path:** `details.weeksToFirstGrazing`
- **Workbook:** `3 Category specifics.weeks_to_first_grazing`
- **Required:** no
- **Customer website:** Quick facts “Weeks to first grazing”. Forage cards chip `Graze {value} wks` ahead of the rainfall, persistency, and sowing-rate fallbacks.
- **Public API:** yes
- **How to fill:** Short text such as `6-8`.

### Prussic acid risk

- **API path:** `details.prussicAcidRisk`
- **Workbook:** `3 Category specifics.prussic_acid_risk`
- **Required:** no
- **Customer website:** Quick facts “Prussic acid risk”.
- **Public API:** yes
- **How to fill:** None, Low, Standard – manage.

### Regrowth

- **API path:** `details.regrowth`
- **Workbook:** `3 Category specifics.regrowth`
- **Required:** no
- **Customer website:** Quick facts “Regrowth”.
- **Public API:** yes
- **How to fill:** Single cut, or Multi-cut / regrazes.

## Mixes

### Flowering window

- **API path:** `details.floweringWindow`
- **Workbook:** `3 Category specifics.flowering_window`
- **Required:** no
- **Customer website:** Mix category cards show this as a flowering-window chip.
- **Public API:** excluded today
- **How to fill:** Short season text such as `Aug-Nov`.
- **Constraints:** max 80 characters.

### Formulation year

- **API path:** `details.formulationYear`
- **Workbook:** mix component / product details (exported with the mix)
- **Required:** no (completion counts it for Mixes)
- **Customer website:** Line “Formulation {year}” above the mix component table when set.
- **Public API:** yes
- **How to fill:** Year or season label for this mix recipe.
- **Constraints:** max 20 characters.

### Mix components

Each card is one public ingredient row. Do not substitute the linked product’s Blurb.

The customer website prints a fixed like-for-like substitution disclaimer (grey italic) directly under every mix table. It is not editable per product.

#### Display name

- **API path:** `details.components[].speciesName`
- **Workbook:** `5 Mix components.component_name`
- **Required:** required if the row has any other content
- **Customer website:** Mix table “Component” name. Links to the catalogue product when Linked product is set and that product is public.
- **Public API:** yes
- **Constraints:** max 120 characters.

#### Linked product

- **API path:** `details.components[].productLink` (slug)
- **Workbook:** `5 Mix components.component_slug`
- **Required:** no
- **Customer website:** Turns the display name into a link to `/products/{category}/{slug}` when that product is in the public catalogue. Unlinked names stay plain text.
- **Public API:** yes
- **How to fill:** Choose a catalogue product, or leave empty for species IH Seeds does not sell alone. Cannot link to this mix. Cannot reuse the same slug on two rows.

#### Inclusion rate / Unit

- **API path:** `details.components[].inclusionRate`, `details.components[].unit`
- **Workbook:** `5 Mix components.inclusion_rate`, `rate_unit`
- **Required:** no
- **Customer website:** Mix table Rate column if any component has a rate. Otherwise the column is hidden.
- **Public API:** yes
- **How to fill:** Suggested units `%`, `kg/ha`, `g/ha`, `kg`. Percentage rates cannot exceed 100.
- **Constraints:** rate ≥ 0; unit max 20 characters.

#### Public description

- **API path:** `details.components[].description`
- **Workbook:** `5 Mix components.component_description`
- **Required:** no
- **Customer website:** Under the component name in the mix table. Blank means no description — never fall back to the linked product’s blurb.
- **Public API:** yes
- **Constraints:** max 10,000 characters.

## Biologicals

### Product form

- **API path:** `details.productForm`
- **Workbook:** `3 Category specifics.product_form`
- **Required:** no
- **Customer website:** Quick facts “Product form”. Biologicals cards chip it.
- **Public API:** yes
- **How to fill:** e.g. Powder, Liquid, Peat, Granule (free text in the editor; keep to known forms).
- **Constraints:** max 120 characters.

### Application rate

- **API path:** `details.applicationRate`
- **Workbook:** `3 Category specifics.application_rate`
- **Required:** no (completion counts it for Biologicals, including on tab 2)
- **Customer website:** Quick facts “Application rate”. Biologicals cards chip it only when the text is 40 characters or fewer. Longer rates stay on the product page and are omitted from listing pills.
- **Public API:** yes
- **How to fill:** Public rate text. Not the stored Application notes field (that field is not shown in the editor).
