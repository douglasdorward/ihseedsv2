import * as XLSX from "xlsx";

/** First sheet of a catalogue export. Guidance only — the importer never reads it. */
export const COLUMN_GUIDE_SHEET = "Column guide";

export const COLUMN_GUIDE_HEADERS = [
  "Sheet",
  "Column",
  "When it is required",
  "What to enter",
  "How it appears on the website",
] as const;

/** Header row of each imported sheet, in export order. The guide must explain every one. */
export const PRODUCT_SHEET_HEADERS = {
  "1 Products": [
    "slug", "product_name", "category", "sub_category", "record_type", "botanical_name", "persistency_type",
    "australian_bred", "tagline", "blurb", "key_attributes", "description", "distribution_note", "rainfall_min_mm",
    "soil_ph_min", "soil_ph_scale", "soil_range_lightest", "soil_range_heaviest", "sowing_depth_min_cm",
    "sowing_depth_max_cm", "tolerance", "end_use", "livestock", "disease_pest_resistance", "stand_life_notes",
    "grazing_management_notes", "pbr_protected", "pbr_details", "certification", "formulation_year",
    "related_products", "photo_1", "photo_2", "photo_3", "tech_sheet_pdf_path", "website_url", "listing_state",
    "listing_override", "availability", "status",
  ],
  "2 Sowing rates": ["slug", "context", "min", "max", "unit"],
  "3 Category specifics": [
    "slug", "category", "ploidy", "heading_date", "heading_offset_days", "argt_resistant", "endophyte",
    "growth_season", "maturity_days", "hard_seed_level", "oestrogen_level", "bloat_risk", "flower_colour",
    "winter_activity", "growing_season", "weeks_to_first_grazing", "prussic_acid_risk", "regrowth",
    "flowering_window", "product_form", "application_rate",
  ],
  "4 Sale lines": ["slug", "stock_code", "seed_form", "pack_kg", "pack_unit", "availability", "price_display", "is_default"],
  "5 Mix components": ["mix_slug", "component_slug", "component_name", "inclusion_rate", "rate_unit", "component_description"],
  "7 Website SEO": [
    "product_slug", "h1", "seo_title", "meta_description", "social_title", "social_description", "social_image",
    "canonical_url", "robots_index",
  ],
  "10 Product FAQs": ["slug", "product_name", "question", "answer"],
} as const;

type GuideRow = readonly [string, string, string, string, string];

const RULES: GuideRow[] = [
  [
    "Workbook rules",
    "How to use this sheet",
    "Read before editing",
    "This sheet is for the person or agent refining the file. It is not imported. Do not rename it, and do not rename headers on the data sheets or add columns. Filter the Sheet column to read one worksheet at a time. Each data row below names the cell, the value it expects, and the place a customer sees it. Closed choices must already exist on the Lists sheet.",
    "Nothing on this sheet is published.",
  ],
  [
    "Workbook rules",
    "Identity and replacement",
    "Always",
    "Start from a current admin export. slug is the permanent identity. Never change an existing slug and never invent a replacement slug for a product that already exists. A slug already in the catalogue is updated. A new slug is added. A product missing from 1 Products is left unchanged. Sheets 2, 3, 4, 5, and 10 replace the stored set for every product in 1 Products. No rows on one of those sheets clears that set for those products only. Do not change lifecycle, category, sale lines, redirects, or FAQs unless the assignment asks for that change.",
    "A Draft product disappears from the public site. A product left out of the file stays as it is. A cleared set disappears from the product page.",
  ],
  [
    "Workbook rules",
    "Cell formats",
    "Always",
    "Plain text. Excel bold, italic, and heading buttons are ignored. Do not start a cell with =. Separate several values with | and do not put spaces around the pipe. Booleans are Y or N. Numbers are plain numbers. A blank cell stores no value. The literal NULL clears a mapped field. Use only values from Lists. CaCl2 is accepted and stored as CaCl₂. Stated – review is a warning, not a public value. An Excel cell cannot hold more than 32,767 characters.",
    "Values that are not on Lists are rejected and never shown.",
  ],
  [
    "Workbook rules",
    "What customers can see",
    "Always",
    "status is the lifecycle: Published, Draft, or Archived. It is not the stock pill. Only Published products can be public. listing_state is separate: Active or New can be sold; Legacy is history only. Publish also needs a tagline of 60 characters or fewer, a blurb, at least one key attribute, a description, an SEO title, and an SEO description. Keep rainfall, soils, sowing rates, tolerances, end use, and livestock in their own columns. Keep grazing, disease, and stand-life notes in their own columns. Do not repeat them inside the description, and do not put private breeder or supplier notes in any public column.",
    "Draft and Archived pages are hidden. Published + Active or New can appear in the selling catalogue. Published + Legacy is only a name under Also in our catalogue. New adds a red NEW stamp on cards and the product hero.",
  ],
  [
    "Lists",
    "(every column)",
    "Required sheet",
    "Allowed values for closed columns, one list per column. Copy a value exactly. Do not invent a spelling. Adding a value here makes it an allowed choice on the next import. Category names listed here are the current roots; a new spelling on 1 Products.category can create a new public category.",
    "Customers never see this sheet. They see the chosen value in the place named on that column's row.",
  ],
];

const PRODUCTS: GuideRow[] = [
  [
    "1 Products",
    "slug",
    "Every product row",
    "Permanent lowercase kebab-case id, for example summit-perennial-ryegrass. Pattern is letters, numbers, and single hyphens. Max 180 characters. Other sheets join to this slug. Do not change it to improve wording or SEO.",
    "The public address is /products/{category-slug}/{slug}. The slug itself is not printed as a label.",
  ],
  [
    "1 Products",
    "product_name",
    "Every product row. Also required to publish.",
    "Commercial title customers should read. Trademarks (™ and ®) belong here. Max 160 characters. This is the default page heading unless 7 Website SEO.h1 overrides it.",
    "Large heading on the product page when H1 is blank. Also the name on category cards, the comparison table, Also popular cards, and the product name in search structured data.",
  ],
  [
    "1 Products",
    "category",
    "Every product row. Also required to publish.",
    "Root category display name, copied from Lists, for example Ryegrasses or Serradellas & Medics. It decides which 3 Category specifics columns are saved. Use an existing name. A new spelling can create a new public category and a new URL.",
    "Breadcrumb and category landing page. Also the pool of products offered under Also popular. Not the same as subcategory.",
  ],
  [
    "1 Products",
    "sub_category",
    "No",
    "Child category display name under that root, or blank for none. Use a name already on the export. A new spelling can create a new public subcategory. This is a name, not a slug, and it is not part of the URL.",
    "Shown under the name on category cards, in the comparison-table Sub-category column, and as the filter on the category page. The product breadcrumb uses the root category, not this.",
  ],
  [
    "1 Products",
    "record_type",
    "Every product row. Also required to publish.",
    "Exactly one of Mix, Variety, or Commodity / generic. Use Mix only when the product is a blend that should list components on sheet 5.",
    "Not printed as a label. Mix turns on the Mix components section. Variety and Commodity / generic do not.",
  ],
  [
    "1 Products",
    "botanical_name",
    "No",
    "Scientific name, for example Lolium multiflorum. Max 180 characters. Leave blank when unknown, and leave blank for mixes.",
    "Italic line under the tagline on the product hero, when filled.",
  ],
  [
    "1 Products",
    "persistency_type",
    "No",
    "How long the stand lasts. Blank, or a Lists value such as Annual, Biennial, Perennial, Hybrid perennial, or Short-term (1–2 years).",
    "Quick facts, labelled Type & persistency. Also a chip on herb cards, and on forage cards when there is room.",
  ],
  [
    "1 Products",
    "australian_bred",
    "No",
    "Y or N. Internal flag only. Do not turn Y into a public “Australian bred” sentence unless that claim is already approved copy in another column.",
    "Not shown.",
  ],
  [
    "1 Products",
    "tagline",
    "Required to publish. Max 60 characters.",
    "One short promise. No full stop. No ™ or ®. Do not repeat the product name, and do not stuff keywords.",
    "Line under the heading on the product hero, and under the name on category cards, Also popular cards, and other listings.",
  ],
  [
    "1 Products",
    "blurb",
    "Required to publish.",
    "One opening paragraph in plain text. This is the introduction, not the full description. No HTML. Do not paste the description here.",
    "First paragraph of the product body, above Key attributes. Also the fallback search description when SEO description is empty.",
  ],
  [
    "1 Products",
    "key_attributes",
    "At least one, to publish.",
    "Five or six short strengths, separated with |. Example: Fast establishing|Strong winter growth. Plain text. Do not repeat the tagline or the quick facts.",
    "Bullet list headed Key attributes on the product page. Not shown on category cards.",
  ],
  [
    "1 Products",
    "description",
    "Required to publish.",
    "Three to five plain-text paragraphs about the variety or mix. Separate paragraphs with a blank line inside the cell. No HTML and no headings. Do not repeat quick facts, grazing notes, disease notes, stand life, the breeder, or the supplier. Stay under Excel's 32,767-character cell limit.",
    "Section headed About this variety, About this seed blend when the record type is Mix, or About this product in Biologicals. Each blank-line block becomes its own paragraph.",
  ],
  [
    "1 Products",
    "distribution_note",
    "No. Leave blank on most products.",
    "Only a genuine public distribution or exclusivity note. One plain-text block. Do not use it for general selling copy.",
    "Highlighted note with an info icon, above the mix table or the description, when filled.",
  ],
  [
    "1 Products",
    "rainfall_min_mm",
    "No",
    "Whole number from the Lists steps, usually 150 to 800 in steps of 50. The minimum annual rainfall in millimetres. Blank if unknown.",
    "Quick facts as Min rainfall: 450 mm+. Category-card chips on several categories. Comparison-table Min Rainfall column. Also drives the rainfall filter on category pages.",
  ],
  [
    "1 Products",
    "soil_ph_min",
    "No. Fill with the scale and both soil ends, or leave the soil group blank.",
    "Lowest suitable pH, from 0 to 14, for example 4.8. Quick facts only appear when this, the scale, and both soil ends are all filled.",
    "Quick facts, inside Soil & pH, as pH 4.8+ (CaCl₂). Comparison-table pH column shows the number and the scale.",
  ],
  [
    "1 Products",
    "soil_ph_scale",
    "No. Required if soil_ph_min is filled and the soil fact should show.",
    "CaCl₂ or water. Prefer CaCl₂ unless the source measured water. CaCl2 is accepted and stored as CaCl₂.",
    "Shown in brackets after the pH in Quick facts and in the comparison-table pH column.",
  ],
  [
    "1 Products",
    "soil_range_lightest",
    "No. Both ends are required before soil shows in Quick facts.",
    "Lightest suitable soil code from Lists: LS, S, L, or H. Must be the same as, or lighter than, soil_range_heaviest.",
    "Quick facts expand the codes to Light sand, Sand, Loam, and Heavy, for example Soil range: Sand to Heavy. The comparison table shows the codes, for example S–H.",
  ],
  [
    "1 Products",
    "soil_range_heaviest",
    "No. Both ends are required before soil shows in Quick facts.",
    "Heaviest suitable soil code: LS, S, L, or H. Same code as the lightest end when the product suits one soil only.",
    "Same Soil & pH fact and comparison-table Soil Range column as the lightest end. Equal ends show one name in Quick facts.",
  ],
  [
    "1 Products",
    "sowing_depth_min_cm",
    "No",
    "Number in centimetres. Staff reference only.",
    "Not shown.",
  ],
  [
    "1 Products",
    "sowing_depth_max_cm",
    "No",
    "Number in centimetres. Staff reference only.",
    "Not shown.",
  ],
  [
    "1 Products",
    "tolerance",
    "No",
    "Stresses the product handles, separated with |. Allowed names: Low pH, Waterlogging, Salinity, Drought, Frost. Prefix a name with Mild when the tolerance is only mild, for example Mild Waterlogging|Drought.",
    "Quick facts, labelled Tolerances, as a comma-separated list. The comparison table shortens them (P, W, S, and the full Drought or Frost name).",
  ],
  [
    "1 Products",
    "end_use",
    "No",
    "Intended uses from Lists, separated with |. Examples: Grazing, Hay, Silage, Cover crop, Permanent pasture, Turf.",
    "Quick facts, labelled End use. Not a category-card chip.",
  ],
  [
    "1 Products",
    "livestock",
    "No",
    "Target animals from Lists, separated with |. Examples: Beef, Dairy, Sheep, Equine.",
    "Quick facts, labelled Livestock. Not a category-card chip.",
  ],
  [
    "1 Products",
    "disease_pest_resistance",
    "No. Max 3,000 characters.",
    "Public resistance notes in one plain-text block. Do not also put this in the description.",
    "Expandable section headed Disease & pest resistance, under the description.",
  ],
  [
    "1 Products",
    "stand_life_notes",
    "No. Max 3,000 characters.",
    "How long the stand lasts and when to replace it. One plain-text block. Do not repeat it in the description.",
    "Expandable section headed Stand life.",
  ],
  [
    "1 Products",
    "grazing_management_notes",
    "No. Max 3,000 characters.",
    "Planting and grazing advice. One plain-text block. Do not repeat quick facts or the sowing-rate numbers.",
    "Expandable section headed Planting & grazing notes.",
  ],
  [
    "1 Products",
    "pbr_protected",
    "No",
    "Y only when the variety is protected by plant breeder's rights. Otherwise N.",
    "When Y, the sidebar under the order panel shows PBR: followed by pbr_details, or the word Protected when details are blank. N shows nothing.",
  ],
  [
    "1 Products",
    "pbr_details",
    "No. Max 300 characters.",
    "Short public PBR wording, such as the variety grant. Used only when pbr_protected is Y.",
    "Sidebar text after PBR: . When protected and this cell is blank, the site says Protected.",
  ],
  [
    "1 Products",
    "certification",
    "No",
    "Public certifications from Lists, separated with |. Examples: Certified seed, ASF Code of Practice.",
    "Sidebar line under the order panel: Certification: followed by the list. Hidden when blank.",
  ],
  [
    "1 Products",
    "formulation_year",
    "No. Mixes only.",
    "Year or season of this mix recipe, for example 2026. Max 20 characters. Leave blank for varieties.",
    "Small line Formulation 2026 above the mix component table. Shown only when record_type is Mix.",
  ],
  [
    "1 Products",
    "related_products",
    "No",
    "Up to three other product slugs, separated with |. Example: holdfast-gt|haifa-white-clover. Use slugs from 1 Products, not names. Each slug must exist in this file. Leave blank to let the site choose. Deleting a chosen product removes it from this list. The delete confirmation names the products that picked it.",
    "Bottom section Also popular. Cards show that product's photo, name, tagline, stock pill, and NEW stamp. A blank cell lets the site pick three other current products in the same category. A Legacy or unpublished slug is replaced.",
  ],
  [
    "1 Products",
    "photo_1",
    "No",
    "Image address only. Prefer /api/media/{id} from the image library, which also copies that file's alt text. Any other http(s) address is stored without a library link. Blank leaves the slot empty. NULL clears it. Do not embed the file. There is no alt-text column.",
    "Full-bleed hero background. Also the first image in the Photos section, on category cards when a photo exists, and the usual social image when social_image is blank. No photo shows the IH Seeds logo on the hero and a placeholder on cards.",
  ],
  [
    "1 Products",
    "photo_2",
    "No",
    "Second image address. Same rules as photo_1.",
    "Second image in the Photos section (desktop beside the page, mobile after the description section). Not the hero.",
  ],
  [
    "1 Products",
    "photo_3",
    "No",
    "Third image address. Same rules as photo_1.",
    "Third image in the Photos section. Not the hero.",
  ],
  [
    "1 Products",
    "tech_sheet_pdf_path",
    "No",
    "Optional staff path or URL of the source PDF. Max 240 characters. NULL clears it. This is not the file customers download.",
    "Not shown as a link. The Download tech sheet button always opens a generated PDF at /tech-sheets/{slug}.",
  ],
  [
    "1 Products",
    "website_url",
    "No",
    "Old public address on www.irwinhunter.com.au, including https://. No query string and no fragment. The apex host is also accepted. Blank means this product has no old-address redirect. Do not put the new /products/... address here. Import replaces redirects only for products in this file.",
    "Not shown. Visitors to that old path are redirected to /products/{category-slug}/{slug}.",
  ],
  [
    "1 Products",
    "listing_state",
    "Defaults to Active when blank.",
    "Active, New, or Legacy. This is not status. Active may be sold. New may be sold and is flagged as new. Legacy is catalogue history and cannot advertise stock. Leave listing_override blank and edit this cell.",
    "Active and New, when also Published, appear in the selling catalogue. New adds a red NEW stamp on the product hero and on cards. Legacy is a name only, in Also in our catalogue, with no stock pill and no selling card.",
  ],
  [
    "1 Products",
    "listing_override",
    "Leave blank.",
    "Legacy column. The export writes it blank. listing_state wins whenever it is filled. Do not use this cell to change Active, New, or Legacy.",
    "No separate display. A filled override is only a fallback when listing_state is blank.",
  ],
  [
    "1 Products",
    "availability",
    "No. Blank imports as Unavailable.",
    "Product-level stock pill: Good stock, Low stock, Very low, or Unavailable. This is not status, and it is not the per-pack stock on sheet 4. Keep it consistent with the sale lines unless the product pill should differ on purpose. Legacy forces Unavailable.",
    "Stock pill on the product hero, category cards, the comparison-table Stock column, and Also popular cards.",
  ],
  [
    "1 Products",
    "status",
    "Blank imports as Draft.",
    "Lifecycle only: Published, Draft, or Archived. Published also needs tagline, blurb, a key attribute, description, seo_title, and meta_description. A blank export cell on an old Published row means that row does not meet today's publish rules; importing the blank makes it Draft. Do not set Published just to keep a page live unless the required copy is present.",
    "Published can be public. Draft and Archived are not on the website. This cell does not set the stock pill.",
  ],
];

const SOWING: GuideRow[] = [
  [
    "2 Sowing rates",
    "slug",
    "Every rate row",
    "Product slug from 1 Products. One product may have several rows, one per situation. No rows for a product clears its sowing rates.",
    "Not shown from this cell. It only attaches the rate to the product.",
  ],
  [
    "2 Sowing rates",
    "context",
    "No, but a rate without a situation is hard to read.",
    "Situation from Lists, for example Dryland, Irrigation, Monoculture, In a mix, Pasture, or Turf.",
    "Quick facts append it to the range, for example 10–15 kg/ha Dryland. Several rows are joined with commas. The comparison table uses the first row only. A Turf row on a sub-tropical product chips Pasture & turf; otherwise that card says Pasture.",
  ],
  [
    "2 Sowing rates",
    "min",
    "No. A rate needs min, max, or both.",
    "Lower sowing rate as a number. Leave blank for an open-ended top or bottom.",
    "Left side of the Quick facts range. The comparison table and mix or forage chips need both min and max before they show a range.",
  ],
  [
    "2 Sowing rates",
    "max",
    "No",
    "Upper sowing rate as a number.",
    "Right side of the Quick facts range, shown with an en dash, for example 10–15.",
  ],
  [
    "2 Sowing rates",
    "unit",
    "No. Blank is stored as kg/ha.",
    "Unit from Lists, usually kg/ha.",
    "After the numbers in Quick facts, the comparison table, and rate chips.",
  ],
];

const SPECIFICS: GuideRow[] = [
  [
    "3 Category specifics",
    "slug",
    "Every specifics row",
    "Product slug from 1 Products. One row per product. A missing row clears that product's category-specific facts. The category cell on this row, not the category on sheet 1, decides which columns are saved.",
    "Not shown from this cell.",
  ],
  [
    "3 Category specifics",
    "category",
    "Should match 1 Products.category.",
    "Root category name. Only columns that apply to this name are saved; other filled cells on the row are ignored. This cell does not move the product. Change category on 1 Products, then keep this cell in step. Applies as follows. Ryegrasses: ploidy, heading date, heading offset, ARGT, endophyte. Clovers: maturity, hard seed, oestrogen, bloat, flower colour. Serradellas & Medics: maturity, hard seed, flower colour, bloat. Lucerne: winter activity. Fescues & Other Grasses: ploidy, heading date, endophyte, growth season. Sub-Tropical Grasses: ploidy, growth season. Forage & Grain Crops: growing season, weeks to first grazing, prussic acid, regrowth. Mixes: flowering window. Biologicals: product form, application rate.",
    "Not printed. It only chooses which facts on this row can appear.",
  ],
  [
    "3 Category specifics",
    "ploidy",
    "No. Saved for Ryegrasses, Fescues & Other Grasses, and Sub-Tropical Grasses.",
    "Blank, or Diploid, Tetraploid, Hexaploid, or Mixed (blend). A value on a Mix row is ignored.",
    "Quick facts, labelled Ploidy, for those three grass categories. Ryegrass cards also chip it. Mix quick facts do not show it.",
  ],
  [
    "3 Category specifics",
    "heading_date",
    "No. Saved for Ryegrasses and Fescues & Other Grasses.",
    "Blank, or Very early, Early, Mid, Mid-late, or Late.",
    "Quick facts, labelled Heading date. Ryegrass cards chip it.",
  ],
  [
    "3 Category specifics",
    "heading_offset_days",
    "No. Saved for Ryegrasses only.",
    "Whole number of days versus Nui. Blank if unknown.",
    "Quick facts as Heading offset: 7 days vs Nui.",
  ],
  [
    "3 Category specifics",
    "argt_resistant",
    "No. Saved for Ryegrasses only.",
    "Y only for a real ARGT resistance claim. N or blank shows nothing.",
    "When Y, Quick facts say ARGT resistance: Resistant. N is hidden.",
  ],
  [
    "3 Category specifics",
    "endophyte",
    "No. Saved for Ryegrasses and Fescues & Other Grasses.",
    "Blank, or Nil, Low, MaxP, or Standard.",
    "Quick facts, labelled Endophyte. Fescue cards chip it, except Nil, which is left off the chip.",
  ],
  [
    "3 Category specifics",
    "growth_season",
    "No. Saved for Fescues & Other Grasses and Sub-Tropical Grasses.",
    "Blank, or Summer-active, Winter-active / Mediterranean, Year-round, or Warm-season. This is not growing_season.",
    "Quick facts, labelled Growth season. Fescue cards chip it. Sub-tropical cards do not.",
  ],
  [
    "3 Category specifics",
    "maturity_days",
    "No. Saved for Clovers and Serradellas & Medics.",
    "Whole number of days to flowering at Perth.",
    "Quick facts, labelled Days to flowering. Clover and serradella cards chip it as 95 days.",
  ],
  [
    "3 Category specifics",
    "hard_seed_level",
    "No. Saved for Clovers and Serradellas & Medics.",
    "Blank, or Soft, Low, Moderate, High, or Very high.",
    "Quick facts, labelled Hard seed level. Clover cards chip it as High hard seed.",
  ],
  [
    "3 Category specifics",
    "oestrogen_level",
    "No. Saved for Clovers only.",
    "Blank, or None, Trace, Low, or High.",
    "Quick facts, labelled Oestrogen level, on clovers.",
  ],
  [
    "3 Category specifics",
    "bloat_risk",
    "No. Saved for Clovers and Serradellas & Medics.",
    "Blank, or Low, Moderate, or High.",
    "Quick facts, labelled Bloat risk.",
  ],
  [
    "3 Category specifics",
    "flower_colour",
    "No. Saved for Clovers and Serradellas & Medics.",
    "Blank, or Pink, Yellow, White, Crimson, Red, or Purple.",
    "Quick facts, labelled Flower colour. Serradella cards chip it as Yellow flowered.",
  ],
  [
    "3 Category specifics",
    "winter_activity",
    "No. Saved for Lucerne only.",
    "Whole number from 1 to 10.",
    "Quick facts, labelled Winter activity. Lucerne cards chip it as Winter active 7.",
  ],
  [
    "3 Category specifics",
    "growing_season",
    "No. Saved for Forage & Grain Crops only.",
    "Blank, or Summer, Winter, or Either. This is not growth_season.",
    "Quick facts, labelled Growing season. Forage cards chip it as Summer crop.",
  ],
  [
    "3 Category specifics",
    "weeks_to_first_grazing",
    "No. Saved for Forage & Grain Crops only.",
    "Short text such as 6-8. Not a closed list.",
    "Quick facts, labelled Weeks to first grazing. Forage cards chip Graze 6-8 wks when the text is 40 characters or fewer.",
  ],
  [
    "3 Category specifics",
    "prussic_acid_risk",
    "No. Saved for Forage & Grain Crops only.",
    "Blank, or None, Low, or Standard – manage.",
    "Quick facts, labelled Prussic acid risk.",
  ],
  [
    "3 Category specifics",
    "regrowth",
    "No. Saved for Forage & Grain Crops only.",
    "Blank, or Single cut, or Multi-cut / regrazes.",
    "Quick facts, labelled Regrowth.",
  ],
  [
    "3 Category specifics",
    "flowering_window",
    "No. Saved for Mixes only. Max 80 characters.",
    "Short season text such as Aug-Nov.",
    "A chip on mix category cards. Not a Quick fact.",
  ],
  [
    "3 Category specifics",
    "product_form",
    "No. Saved for Biologicals only. Max 120 characters.",
    "Form text such as Powder, Liquid, Peat, or Granule.",
    "Quick facts, labelled Product form. Biologicals cards chip it when it is 40 characters or fewer.",
  ],
  [
    "3 Category specifics",
    "application_rate",
    "No. Saved for Biologicals only.",
    "Public rate text, not an internal note.",
    "Quick facts, labelled Application rate. Biologicals cards chip it only when it is 40 characters or fewer. Longer text stays on the product page.",
  ],
];

const SALES: GuideRow[] = [
  [
    "4 Sale lines",
    "slug",
    "Every sale-line row",
    "Product slug from 1 Products. This sheet replaces every pack for every product in the file. No rows for a product removes its packs. Include the complete set.",
    "Not shown from this cell. Packs appear in How it's sold and the order panel.",
  ],
  [
    "4 Sale lines",
    "stock_code",
    "Required for the row to be saved. Unique across the catalogue.",
    "Warehouse code, for example BIONPKS. A duplicate code fails import. A row without a code is skipped.",
    "Not shown in the How it's sold table. The default line's code is the structured-data SKU.",
  ],
  [
    "4 Sale lines",
    "seed_form",
    "No",
    "Public form from Lists: Bare / de-hulled, Podded, Coated, Coated + Gaucho, BioNPK-S coated, Goldstrike coated, Scarified, or Lime coated. Blank is allowed.",
    "How it's sold Form column. Blank is shown as Bare. Serradella cards and sub-tropical cards may chip the form.",
  ],
  [
    "4 Sale lines",
    "pack_kg",
    "No",
    "Numeric pack weight, for example 25. Blank means no weight on this line.",
    "How it's sold Pack column, with the unit, for example 25 kg. The order panel lists Available in … for every pack whose weight is above zero.",
  ],
  [
    "4 Sale lines",
    "pack_unit",
    "No. Blank is stored as kg.",
    "Usually kg.",
    "After the weight in How it's sold and in Available in ….",
  ],
  [
    "4 Sale lines",
    "availability",
    "No. Blank is shown as Unavailable. Legacy is stored as Unavailable.",
    "This pack's stock: Good stock, Low stock, Very low, or Unavailable. One value per pack. Blank is shown as Unavailable. The product pill is 1 Products.availability. Legacy listings cannot advertise stock.",
    "Status pill on that row of the How it's sold table.",
  ],
  [
    "4 Sale lines",
    "price_display",
    "No. Blank is stored as Contact for pricing.",
    "Customer-facing price text, not an internal list price. The order panel uses the default pack's price, or the first pack if none is marked default.",
    "The amount in the order panel. Not a column in How it's sold.",
  ],
  [
    "4 Sale lines",
    "is_default",
    "Exactly one Y when the product has packs.",
    "Y on the pack whose price should lead. N on the others. The importer does not reject several Y values, but the admin publish check requires exactly one default.",
    "Not printed. It chooses which pack's price is shown in the order panel.",
  ],
];

const MIXES: GuideRow[] = [
  [
    "5 Mix components",
    "mix_slug",
    "Every component row",
    "Slug of the mix product. The mix's record_type should be Mix. This sheet replaces that mix's ingredients. No rows clears them.",
    "Not shown from this cell. The table appears only when record_type is Mix.",
  ],
  [
    "5 Mix components",
    "component_slug",
    "No",
    "Optional slug of another product in this file. Not the mix's own slug, and not repeated. Leave blank when the ingredient is not its own catalogue product. An unknown slug fails import. Deleting the linked product clears this slug and keeps the ingredient row. The delete confirmation names those mixes and any Also popular picks.",
    "When the slug matches a product, the ingredient name links to that product page. The slug is not printed.",
  ],
  [
    "5 Mix components",
    "component_name",
    "Needed for the row to be useful.",
    "Name to print in the table, max 120 characters. This can differ from the linked product's name.",
    "Component column of the Mix components table.",
  ],
  [
    "5 Mix components",
    "inclusion_rate",
    "No",
    "Number. For a percentage, do not exceed 100. Blank if this ingredient has no rate.",
    "Rate column. The column appears only when at least one ingredient has a rate. A percentage is shown as 25%. Another unit is shown as 10 kg/ha.",
  ],
  [
    "5 Mix components",
    "rate_unit",
    "No. Blank is stored as %.",
    "Usually %. Also kg/ha, g/ha, or kg.",
    "After the inclusion rate. % sits against the number; other units have a space.",
  ],
  [
    "5 Mix components",
    "component_description",
    "No. Max 2,000 characters.",
    "Why this ingredient is in this mix. Plain text, 2,000 characters or fewer. Write it for the mix. Do not paste the linked product's blurb. Blank means no description.",
    "Smaller text under that ingredient's name in the mix table.",
  ],
];

const SEO: GuideRow[] = [
  [
    "7 Website SEO",
    "product_slug",
    "Every SEO row",
    "Product slug from 1 Products. SEO title and description for a Published product must be on this sheet. There is no SEO title column on 1 Products.",
    "Not shown from this cell.",
  ],
  [
    "7 Website SEO",
    "h1",
    "No. Blank uses the product name. Max 160 characters.",
    "Optional page heading. Leave blank so the heading keeps following product_name. Trademarks may stay here. Do not use this as the search-result title.",
    "The large white heading on the product hero. It replaces the product name when filled.",
  ],
  [
    "7 Website SEO",
    "seo_title",
    "Required to publish. Max 180 characters.",
    "Search-result title in plain text. Aim for about 60 characters. No ™ or ®; they are stripped. Usually the product name plus IH Seeds. This is not the on-page heading.",
    "Browser tab and search-result title. Not the H1 on the page.",
  ],
  [
    "7 Website SEO",
    "meta_description",
    "Required to publish. Max 2,000 characters.",
    "Search snippet in plain text. Aim for about 155 characters. No trademarks; they are stripped. Do not paste the whole description.",
    "The meta description search engines read. Not a visible paragraph. Structured data uses it, then the blurb.",
  ],
  [
    "7 Website SEO",
    "social_title",
    "No. Max 180 characters.",
    "Optional title for link previews. Blank uses the SEO title. No trademarks.",
    "Title when the product link is shared. Not shown on the page.",
  ],
  [
    "7 Website SEO",
    "social_description",
    "No. Max 2,000 characters.",
    "Optional preview text. Blank uses the SEO description. No trademarks.",
    "Description when the product link is shared. Not shown on the page.",
  ],
  [
    "7 Website SEO",
    "social_image",
    "No. Max 500 characters.",
    "Optional image address for link previews. Blank uses photo_1, then the site default share image. NULL clears a previous override. Guide size is 1200×630.",
    "Image in the link preview. Not an extra photo on the page.",
  ],
  [
    "7 Website SEO",
    "canonical_url",
    "No. Leave blank unless a specific override is required.",
    "Full URL that should be the preferred address. Blank uses /products/{category-slug}/{slug}. This does not create a redirect. Redirects come from 1 Products.website_url.",
    "The canonical link and the shared URL. Visitors who open the product page still use the normal address.",
  ],
  [
    "7 Website SEO",
    "robots_index",
    "No. The export writes Y or N. Blank is treated as Y.",
    "Y allows indexing. N publishes noindex. Blank is treated as Y. Use N only when the page should stay out of search results.",
    "Y can include a Published Active or New product in the sitemap. N keeps it out of the sitemap and asks search engines not to index it. The page can still be opened.",
  ],
];

const FAQS: GuideRow[] = [
  [
    "10 Product FAQs",
    "slug",
    "Every FAQ row",
    "Product slug from 1 Products. Up to ten FAQs per product. This sheet replaces that product's FAQs. No rows clears them. A row needs a slug.",
    "Not shown from this cell. Completed FAQs appear in a section headed FAQs.",
  ],
  [
    "10 Product FAQs",
    "product_name",
    "Label only. Not imported.",
    "Copy of the product name so a row is recognisable. Changing it does not rename the product. Rename products in 1 Products.product_name.",
    "Not shown from this cell.",
  ],
  [
    "10 Product FAQs",
    "question",
    "Required for the FAQ to be visible. Max 180 characters.",
    "The question a customer would ask, in plain text. A question without an answer is stored and hidden.",
    "The clickable FAQ summary. Also the question in FAQ structured data.",
  ],
  [
    "10 Product FAQs",
    "answer",
    "Required for the FAQ to be visible. Max 4,000 characters.",
    "One plain-text answer. Do not use HTML. Line breaks inside the cell collapse into the same paragraph on the page, so write it as prose. An answer without a question is stored and hidden.",
    "Paragraph revealed when the question is opened.",
  ],
];

const GUIDE_ROWS: GuideRow[] = [...RULES, ...PRODUCTS, ...SOWING, ...SPECIFICS, ...SALES, ...MIXES, ...SEO, ...FAQS];

export function columnGuideGaps(): string[] {
  const documented = new Map<string, number>();
  for (const [sheet, column] of GUIDE_ROWS) {
    if (sheet === "Workbook rules" || sheet === "Lists") continue;
    const key = `${sheet}\t${column}`;
    documented.set(key, (documented.get(key) ?? 0) + 1);
  }
  const gaps: string[] = [];
  for (const [sheet, columns] of Object.entries(PRODUCT_SHEET_HEADERS)) {
    for (const column of columns) {
      const count = documented.get(`${sheet}\t${column}`) ?? 0;
      if (count !== 1) gaps.push(`${sheet}.${column} (${count})`);
    }
  }
  return gaps;
}

export function appendProductColumnGuide(book: XLSX.WorkBook) {
  const gaps = columnGuideGaps();
  if (gaps.length) throw new Error(`COLUMN_GUIDE_INCOMPLETE:${gaps.join(", ")}`);
  const rows = [COLUMN_GUIDE_HEADERS, ...GUIDE_ROWS];
  const sheet = XLSX.utils.aoa_to_sheet(rows.map((row) => [...row]));
  sheet["!cols"] = [{ wch: 24 }, { wch: 28 }, { wch: 42 }, { wch: 88 }, { wch: 88 }];
  sheet["!autofilter"] = { ref: `A1:E${rows.length}` };
  sheet["!freeze"] = { xSplit: 0, ySplit: 1, topLeftCell: "A2", activePane: "bottomLeft", state: "frozen" };
  XLSX.utils.book_append_sheet(book, sheet, COLUMN_GUIDE_SHEET);
}
