---
name: Product growing-note sections
description: How the expandable product sections (4 fixed defaults + admin custom sections) must be rendered and imported consistently.
---
Every customer surface (product page, tech sheet PDF, site search, llms-full.txt) must get its expandable sections from the one shared web helper, never list the fields itself. Default order and titles are fixed: Planting & grazing notes, Disease & pest resistance, Stand life, Carbon Farming & Pasture Diversity; custom sections follow in saved order. Blank sections and untitled custom sections are hidden but still stored (like incomplete FAQs).

**Why:** the user asked for the sections to look the same in the form editor, the Product page editor and the customer site; separate field lists had already drifted (admin form order differs from the public order).

**How to apply:** a new default section needs the db type, OpenAPI (public + draft), both admin editors, the shared helper, a 1 Products workbook column, the column guide and docs in one change. Custom sections round-trip through workbook sheet "11 Product sections", which replaces each imported product's set (missing sheet clears it, same as FAQs). AI fill is blocked from writing custom sections.
