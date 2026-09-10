# Tab 2 — Agronomy & fit

Sowing, soils, tolerances, use, livestock, and management notes. Disabled until a category is selected.

Biologicals use a shorter form (application notes plus persistency / Australian bred). Other categories use sowing rates and the full agronomy grid.

## Sowing rates

- **API path:** `details.sowingRates[]` (`context`, `min`, `max`, `unit`)
- **Workbook:** `2 Sowing rates`
- **Required:** no (completion counts at least one row when the category is not Biologicals)
- **Shown when:** category is not Biologicals
- **Customer website:** Product Quick facts “Sowing rate” (all rates that have a min or max). Category comparison table uses the first rate. Mix category cards may chip the first rate range. Category fact chips for some categories use the first rate’s context.
- **Public API:** yes
- **Purpose:** Recommended sowing amount by situation.
- **How to fill:** Add one row per context. Contexts: Monoculture, In a mix, Dryland, Irrigation, Pasture, Turf, General, Podded, De-hulled, Coated. Enter min and/or max and a unit, usually `kg/ha`.
- **Constraints:** min/max ≥ 0; unit max 20 characters.

## Minimum rainfall (mm)

- **API path:** `details.rainfallMinMm`
- **Workbook:** `1 Products.rainfall_min_mm`
- **Required:** no
- **Shown when:** category is not Biologicals
- **Customer website:** Quick facts “Min rainfall” as `{n} mm+`. Category cards (several categories) and comparison table.
- **Public API:** yes
- **Purpose:** Lowest annual rainfall the product is recommended for.
- **How to fill:** Integer millimetres, e.g. `400`.
- **Constraints:** ≥ 0, integer.

## Minimum soil pH / Soil pH scale

- **API path:** `details.soilPhMin`, `details.soilPhScale`
- **Workbook:** `1 Products.soil_ph_min`, `soil_ph_scale`
- **Required:** no
- **Shown when:** category is not Biologicals
- **Customer website:** Quick facts “Soil & pH” only when lightest soil, heaviest soil, min pH, **and** scale are all set. Comparison table shows pH even if soils are missing.
- **Public API:** yes
- **Purpose:** Lowest suitable pH and which lab scale it uses.
- **How to fill:** pH number (e.g. `5.5`). Scale `CaCl₂` or `water`. Prefer CaCl₂ for Australian agronomy unless the source is water-based.
- **Constraints:** pH 0–14.

## Lightest soil / Heaviest soil

- **API path:** `details.soilRangeLightest`, `details.soilRangeHeaviest`
- **Workbook:** `1 Products.soil_range_lightest`, `soil_range_heaviest`
- **Required:** no
- **Shown when:** category is not Biologicals
- **Customer website:** Quick facts “Soil & pH” when paired with pH as above. Comparison table “Soil Range”.
- **Public API:** yes
- **Purpose:** Texture band the product suits.
- **How to fill:** `LS` light sand, `S` sand, `L` loam, `H` heavy. Lightest should not be heavier than heaviest.
- **Constraints:** closed enum including blank.

## Minimum / Maximum sowing depth (cm)

- **API path:** `details.sowingDepthMinCm`, `details.sowingDepthMaxCm`
- **Workbook:** `1 Products.sowing_depth_min_cm`, `sowing_depth_max_cm`
- **Required:** no
- **Shown when:** category is not Biologicals
- **Customer website:** not shown
- **Public API:** excluded (admin-only)
- **Purpose:** Private sowing-depth range for staff and future use.
- **How to fill:** Centimetres. Leave blank if unknown.

## Tolerance

- **API path:** `details.tolerance[]` (`name`, `mild`)
- **Workbook:** `1 Products.tolerance`
- **Required:** no
- **Shown when:** category is not Biologicals
- **Customer website:** Quick facts “Tolerances”. Comparison table (abbreviated). Not on category cards.
- **Public API:** yes
- **Purpose:** Which stresses the product copes with.
- **How to fill:** Toggle Low pH, Waterlogging, Salinity, Drought, Frost. Optional Mild checkbox per selected stress.
- **Constraints:** names are a closed enum.

## End use

- **API path:** `details.endUse[]`
- **Workbook:** `1 Products.end_use`
- **Required:** no
- **Shown when:** category is not Biologicals
- **Customer website:** Quick facts “End use”.
- **Public API:** yes
- **Purpose:** Intended farm uses.
- **How to fill:** Multi-select: Grazing, Hay, Silage, Cover crop, Green manure, Grain, Stockfeed, Permanent pasture, Erosion control / stabilisation, Break crop, Biofumigant, Turf.

## Livestock

- **API path:** `details.livestock[]`
- **Workbook:** `1 Products.livestock`
- **Required:** no
- **Shown when:** category is not Biologicals
- **Customer website:** Quick facts “Livestock”.
- **Public API:** yes
- **Purpose:** Which animals the product is aimed at.
- **How to fill:** Multi-select: Beef, Dairy, Sheep, Equine, Goat, Chicken, Alpaca, Weaners, Lamb finishing.

## Persistency type

- **API path:** `details.persistencyType`
- **Workbook:** `1 Products.persistency_type`
- **Required:** no
- **Shown when:** always (including Biologicals)
- **Customer website:** Quick facts “Type & persistency” when set. Herbs category cards chip it.
- **Public API:** yes
- **Purpose:** How long the stand is expected to last.
- **How to fill:** Annual, Biennial, Perennial, Hybrid perennial, or Short-term (1–2 years).

## Australian bred

- **API path:** `details.australianBred`
- **Workbook:** `1 Products.australian_bred`
- **Required:** no
- **Shown when:** always
- **Customer website:** not shown
- **Public API:** excluded (admin-only)
- **Purpose:** Internal origin flag. Do not treat as a public claim until a public design exists.

## Companion species

- **API path:** `details.companionSpecies[]` (product slugs)
- **Workbook:** `6 Companions`
- **Required:** no
- **Shown when:** category is not Biologicals
- **Customer website:** not shown
- **Public API:** excluded (admin-only)
- **Purpose:** Links to other catalogue products that fit with this one. Not a public companions list.
- **How to fill:** Search and add real catalogue products. Do not add this product. Put general companion *advice* in grazing/agronomy notes, not here.
- **Constraints:** each entry is a slug; must resolve to another product.

## Inoculant group

- **API path:** `details.inoculantGroup`
- **Workbook:** `1 Products.inoculant_group`
- **Required:** no
- **Shown when:** legumes (hidden for Ryegrasses, Fescues & Other Grasses, Sub-Tropical Grasses, Herbs, Mixes, Biologicals)
- **Customer website:** not shown
- **Public API:** excluded (admin-only)
- **Purpose:** Rhizobium group for staff.
- **How to fill:** None, C, G/S, G, S, AL, AM, B, BS, E, F/E, I.

## Disease & pest resistance

- **API path:** `details.diseasePestResistance`
- **Workbook:** `1 Products.disease_pest_resistance`
- **Required:** no
- **Shown when:** category is not Biologicals
- **Customer website:** Accordion “Disease & pest resistance” when non-blank.
- **Public API:** yes
- **Purpose:** Public resistance notes. Keep out of the main Description.
- **Constraints:** max 3000 characters.

## Stand life notes

- **API path:** `details.standLifeNotes`
- **Workbook:** `1 Products.stand_life_notes`
- **Required:** no
- **Shown when:** category is not Biologicals
- **Customer website:** Accordion “Stand life” when non-blank.
- **Public API:** yes
- **Purpose:** Persistence and replacement guidance.
- **Constraints:** max 3000 characters.

## Grazing management notes

- **API path:** `details.grazingManagementNotes`
- **Workbook:** `1 Products.grazing_management_notes`
- **Required:** no
- **Shown when:** category is not Biologicals
- **Customer website:** Accordion “Planting & grazing notes” when non-blank.
- **Public API:** yes
- **Purpose:** How to plant and graze. Do not repeat Quick facts.
- **Constraints:** max 3000 characters.

## Application notes (Biologicals)

- **API path:** `details.notes`
- **Workbook:** `1 Products.internal_notes`
- **Required:** no
- **Shown when:** Biologicals, on this tab, labelled Application notes
- **Customer website:** not shown
- **Public API:** excluded (admin-only)
- **Purpose:** Same storage as Content & publishing → Internal notes. On Biologicals this tab is the convenient place to type staff application reminders. Customers never see it.
- **How to fill:** Do not put public application rates here; that is Category-specific → Application rate.
- **Constraints:** max 2000 characters.
