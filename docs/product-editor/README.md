# Product editor field docs

These files describe every field on the admin product editor: what it is for, how to fill it, which API path it uses, and whether customers ever see it.

They are for:

- Administrators who are unsure what a field does
- Agents editing products or the catalogue system
- A future MCP that populates the editor through the admin API

The system guide remains the source for lifecycle, workbook import, and taxonomy. Use this set for **editor-tab, field-by-field** behaviour.

## Files

- [01-basics.md](01-basics.md)
- [02-agronomy-and-fit.md](02-agronomy-and-fit.md)
- [03-category-specific.md](03-category-specific.md)
- [04-selling.md](04-selling.md)
- [05-content-and-publishing.md](05-content-and-publishing.md)
- [06-seo.md](06-seo.md)
- [fields.yaml](fields.yaml) — machine-readable catalog for MCP/API population

## How to use this set

1. Open the tab file that matches the editor section.
2. Read the field’s visibility before filling it. Admin-only fields must never be copied into public copy.
3. For API or MCP writes, use the **API path** (`name`, `details.tagline`, `saleLines[].stockCode`). OpenAPI in `lib/api-spec/openapi.yaml` is authoritative for types and enums.
4. Treat [fields.yaml](fields.yaml) as a map from editor UX onto those paths, not as a second schema.

## Visibility classes

Each field is exactly one of:

| Class | Meaning |
|---|---|
| **Shown to customers** | Rendered on the public website. The field entry names the surface (H1, cards, Quick facts, mix table, SEO, and so on). |
| **Public API, not shown** | Included in `PublicProduct` / `PublicProductDetails` but the current pages do not render it. Do not assume customers see it. |
| **Admin-only** | Stored for staff. Stripped by `toPublicDetails` and marked `(Admin-only)` in the editor. Never public. |

A value can be stored, present in the public API, and still unused by the website. Document the current behaviour, not the hoped-for one.

## Draft vs publish

A Draft can be saved with only:

- Product name
- Slug
- Category
- Record type

Publishing also requires tagline, blurb, at least one key attribute, description, SEO title, and SEO description. Sale lines, if present, need unique stock codes and exactly one default.

Published products cannot be saved as drafts. Editor changes replace the live page only when Publish succeeds.

## Listing vs lifecycle

- **Published / Draft / Archived** is lifecycle. Only Published products can be public.
- **Active / Legacy** is listing state on Basics. Only Published + Active products appear in the main catalogue. Legacy stays published as name-only history and cannot have availability.
- **Archive** removes the product from the public website. Restore returns it to Draft.

## Keep these docs in sync

These files are part of the catalogue contract. When a product field, its requiredness, its tab, its allowed values, public redaction, or customer display changes, update:

1. The matching tab markdown
2. `fields.yaml`
3. [CATALOGUE_SYSTEM_GUIDE.md](../../CATALOGUE_SYSTEM_GUIDE.md) section 6 if a grouped visibility row is now wrong

A change is incomplete if the editor, API, or public site moved and this folder still describes the previous behaviour.

See also `.cursor/rules/product-editor-docs.mdc` and `.agents/memory/product-editor-field-docs.md`.
