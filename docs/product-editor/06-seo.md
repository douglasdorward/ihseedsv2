# Tab 6 — SEO

Search and sharing metadata. SEO title and SEO description are required to publish. `™` and `®` are stripped from SEO title, SEO description, and social title/description on edit, import, and public metadata. Keep trademarks on the product name, and on H1 if you overwrite it.

## H1

- **API path:** `details.h1`
- **Workbook:** `7 Website SEO.h1`
- **Required:** Draft no / Publish no (blank copies the product name)
- **Customer website:** Product page H1. Blank uses the product name. Trademark symbols stay visible.
- **Public API:** yes (the override, or the product name when blank)
- **Purpose:** Optional page heading override. Leave blank to keep following the product name.
- **How to fill:** The editor copies the product name until you type a different heading. Clear the field, or match the product name, to follow the name again.
- **Constraints:** max 160 characters.

## SEO title

- **API path:** `details.seoTitle`
- **Workbook:** `7 Website SEO` (`seo_title` is the only title source). Cells on `1 Products` are not imported.
- **Required:** Draft no / Publish yes
- **Customer website:** Document title and browser tab. JSON-LD uses the visible product name, not this field. `™` / `®` are stripped.
- **Public API:** yes (already stripped)
- **Purpose:** Search-result title.
- **How to fill:** Plain text, usually including the product and IH Seeds. Do not paste the H1 with trademarks.
- **Constraints:** max 180 characters.

## SEO description

- **API path:** `details.seoDescription`
- **Workbook:** `7 Website SEO.meta_description`
- **Required:** Draft no / Publish yes
- **Customer website:** Meta description. If blank at publish time the API falls back to blurb for the stored public description. Structured-data description uses this (then blurb).
- **Public API:** yes
- **Purpose:** Concise search snippet.
- **How to fill:** Plain sentences. No trademarks. Do not stuff keywords.
- **Constraints:** max 2000 characters.

## Social sharing title

- **API path:** `details.socialTitle`
- **Workbook:** `7 Website SEO.social_title`
- **Required:** no
- **Customer website:** Open Graph title. Blank uses the SEO title (then the document title).
- **Public API:** yes
- **How to fill:** Optional override for Facebook/LinkedIn-style shares. No trademarks.
- **Constraints:** max 180 characters.

## Social sharing description

- **API path:** `details.socialDescription`
- **Workbook:** `7 Website SEO.social_description`
- **Required:** no
- **Customer website:** Open Graph description. Blank uses the SEO description.
- **Public API:** yes
- **How to fill:** Optional share blurb. No trademarks.
- **Constraints:** max 2000 characters.

## Social sharing image

- **API path:** `details.socialImage`
- **Workbook:** `7 Website SEO.social_image`
- **Required:** no
- **Customer website:** Open Graph and Twitter card image. The effective image is resolved in this order: (1) this override, (2) the first product photo (hero), (3) the site-wide sharing image from **Site settings > Social sharing** (a library asset is served as `/api/media/{id}`), (4) the IH Seeds default `/social-share-default.jpg`.
- **Public API:** yes
- **How to fill:** Optional. Pick a product photo slot or paste an HTTPS URL. The SEO tab shows the effective image and a source label (Custom sharing image, First product photo, Site-wide sharing image, or IH Seeds default). **Clear custom image** empties the override so the fallback chain applies; changing the hero later then changes the share image too. Best size 1200 × 630 px.
- **Constraints:** max 500 characters.

## Canonical URL override

- **API path:** `details.canonicalUrl`
- **Workbook:** `7 Website SEO.canonical_url`
- **Required:** no
- **Customer website:** `<link rel="canonical">` and Open Graph URL. Blank uses the normal `/products/{category}/{slug}` URL.
- **Public API:** yes
- **How to fill:** Leave blank unless this page must point at a different public URL. Redirect sources belong in `1 Products.website_url`.
- **Constraints:** max 500 characters; URL.

## Allow search engines to index this product

- **API path:** `details.robotsIndex`
- **Workbook:** `7 Website SEO.robots_index` (`N` publishes noindex; NULL restores the default of indexed)
- **Required:** no (defaults to indexed)
- **Customer website:** When false, the page is published with `noindex, nofollow`. The live page still exists. The public sitemap includes Published + Active or New products except those with search indexing turned off.
- **Public API:** yes
- **How to fill:** Leave on for normal catalogue pages. Turn off only when the page must stay out of search results.

## Site-wide sharing image (Site settings)

Not a product field. Edited at **Site settings > Social sharing** (`/admin/site-settings/social`).

- **API path:** `homepage.socialImageSrc` (string) and `homepage.socialImageAssetId` (string or null; optional for older clients)
- **Customer website:** Share image for any page without its own image, and step 3 of the product and article fallback chain. When `socialImageAssetId` is set, `/api/media/{id}` is used in preference to `socialImageSrc`.
- **How to fill:** Upload a JPEG/PNG/WebP or choose from the Images library, then save. **Reset to default** clears both values so `/social-share-default.jpg` is used. Guide size 1200 × 630 px (about 1.91:1); the editor warns about smaller or very differently shaped images.
- **Icon:** the home screen / share-sheet icon is fixed at `/apple-touch-icon.png` (180 × 180) and is shown read-only on the same page.
