# IH Seeds SEO + GEO audit

**Audit date:** 22 September 2026  
**Supersedes:** the 18 September 2026 replacement-domain audit in this file, which itself superseded the 16 September 2026 findings  
**Scope:** Public IH Seeds website as the replacement for `www.irwinhunter.com.au`, including social-preview metadata and generative-engine (GEO) citation readiness  
**Environment:** Current Next.js metadata, database schema, admin editors, and `lib/db/seed/catalogue.json` (106 published products, 11 active root categories). The local API was not running, so this pass is not a live HTML crawl. Google Search Console, Analytics, backlink data, and the production edge were not accessed.

This document records audit findings only. No SEO, GEO, redirect, catalogue, or content fixes were implemented as part of the audit.

## Executive summary

The public site already has titles, descriptions, and canonicals on the indexable routes, a `www` sitemap and robots file, product and article Open Graph, and site-wide Organization JSON-LD. Product pages also emit Product, Offer, and BreadcrumbList schema. Category pages emit BreadcrumbList and ItemList. FAQPage schema is wired and only prints when a question and answer both exist.

The remaining gaps are empty social and FAQ fields, category and marketing pages with no share metadata, and a few GEO pieces that were never built. Legacy product URLs and three product/category slug collisions are still crawl failures.

Headline results from the seed catalogue:

- Product `socialTitle`, `socialDescription`, and `socialImage` are empty on **0 of 106** published products. Product and category FAQs are empty. Category `seoTitle`, `seoDescription`, and `pageHeading` are empty on **0 of 11** roots.
- Open Graph exists on product and article pages only. Home, about, contact, guide, availability, the resources index, privacy, terms, and every category page have no share image.
- `/llms.txt` and `/llms-full.txt` do not exist. Organization schema has no logo, `sameAs`, or `areaServed`. There is no WebSite or LocalBusiness schema.
- **70 of 77** workbook `/product/{slug}` URLs have no redirect. Three published products (`tall-fescue`, `puccinellia`, `carpet-grass`) share a slug with a child category, so their nested URLs 301 to the parent category.

## What changed since 18 September 2026

These items from the previous audit are no longer open:

- `/robots.txt` and `/sitemap.xml` exist. Robots allows `/`, disallows `/admin`, `/api`, and `/internal`, and points at the `www` sitemap.
- The default public origin is `https://www.irwinhunter.com.au`.
- Canonicals are set on home, catalogue, categories, products, articles, availability, resources, guide, about, contact, privacy, and terms.
- `/privacy` and `/terms-and-conditions` are real pages, not redirects to Contact.
- Every page emits Organization JSON-LD from company settings, with the legal name as `alternateName` when it differs from the trading name.

## Already in place

- Titles, descriptions, and canonicals on home, catalogue, categories, products, articles, availability, resources, guide, about, contact, privacy, and terms.
- `artifacts/web/app/robots.ts` allows `/`, disallows `/admin`, `/api`, and `/internal`, and points at the `www` sitemap.
- `artifacts/web/app/sitemap.ts` lists static pages, non-empty root categories, indexable products, and articles.
- Default public origin is `https://www.irwinhunter.com.au` in `artifacts/web/lib/site-url.ts`.
- Product and article pages emit Open Graph. Product pages also emit Product, Offer, and BreadcrumbList JSON-LD. Articles emit Article JSON-LD. Categories emit BreadcrumbList and ItemList. FAQPage JSON-LD is wired and only prints when a question and answer both exist.
- Every page emits Organization JSON-LD from company settings (`artifacts/web/lib/company.ts`), including legal name as `alternateName` when it differs from the trading name.

## Built, then left empty

These fields have columns or JSON, admin controls, and public fallbacks. The seed catalogue does not fill them, so the public tags fall back to weaker copy or never appear.

- **Product social sharing** (`socialTitle`, `socialDescription`, `socialImage`): **0 of 106** published products. Admin tab 6 can edit them. Product Open Graph therefore uses the SEO title, SEO description, and the first product photo (or the logo fallback).
- **Product FAQs**: **0 of 106**. The FAQ block and FAQPage schema never render.
- **Product H1 override**: **0 of 106**. Pages use the product name.
- **Product SEO title**: **76 of 106** filled. The other 30 use `{name} | IH Seeds`.
- **Product SEO description**: **78 of 106** filled. The rest fall back to the blurb.
- **Product photo alt text**: photos that exist have no `alt`. **52 of 106** published products have no photo at all. **52** photo URLs still point at `irwinhunter.com.au` WordPress uploads.
- **Category SEO**: **0 of 11** roots have `seoTitle`, `seoDescription`, or `pageHeading`. Titles become `{name} Seed | IH Seeds`. Descriptions reuse the one-sentence lead.
- **Category FAQs**: **0**. Same unused FAQPage path as products. The root-category SEO screen in admin can store up to 10.
- **Article social fields**: columns and the blog editor exist. The example article seed sets SEO title and description only, and leaves `socialTitle`, `socialDescription`, and `socialImage` blank. Heroes are Unsplash URLs, so article Open Graph images are stock photos.
- **Canonical URL override and `robotsIndex`**: present and empty or true. That is fine; the computed URL is used and pages stay indexable.
- **Company phone and ABN**: the settings model and admin screen exist. Defaults are blank, so Organization schema omits `telephone` and `taxID`. Address and email are filled.

## Stored, but not shown

- **Category rainfall** is filled for all 11 roots (for example ryegrass `500–900+ mm`) and is in the API row. The public category type in `artifacts/web/lib/catalogue.ts` drops it, and `artifacts/web/app/products/category-page.tsx` only prints the lead. Product pages do show per-product minimum rainfall.
- **Article author** is hardcoded as Organization `IH Seeds`. There is no author column, byline, or credentials.
- **Reseller outlet address, phone, and map URL** render on Contact as HTML only. They are not LocalBusiness nodes.

## Not built

- **`/llms.txt` and `/llms-full.txt`**. No route and no file.
- **Open Graph and Twitter on anything except products and articles.** Home, about, contact, guide, availability, the resources index, privacy, terms, and every category page set title, description, and canonical only. There is no site-wide default share image in `artifacts/web/app/layout.tsx`.
- **Explicit `twitter` metadata.** Product and article pages rely on Open Graph alone. Platforms that only read `twitter:*` get no card.
- **WebSite JSON-LD** (site name, URL, publisher). **LocalBusiness** on Contact (geo, opening hours, `areaServed: Western Australia`). Organization has no `logo`, `sameAs`, or `areaServed`. There is no field for social or federation profile URLs.
- **Per-crawler robots rules.** One `User-agent: *` rule. That allows AI crawlers; it does not name them or point them at a summary file.
- **Resources listing schema**, article `publisher.logo`, and a named author.
- **RSS/Atom** for `/resources`.
- **`lang` is `en`**, not `en-AU`.
- **Custom `not-found.tsx`.** No app 404 module.
- **`next/image`, security headers, and HTML cache policy.** Catalogue fetches are `cache: "no-store"`. Heroes are CSS backgrounds, so most photos have no alt.

## Still broken for crawl and citation

- **70 of 77** workbook `/product/{slug}` URLs have no redirect row (including Maximix and Safeguard). The 7 that exist 301 to a category, not the product. About 170 other redirect rows are old category-test paths.
- **Three slugs are both a product and a child category:** `tall-fescue`, `puccinellia`, `carpet-grass`. Nested product routing 301s those URLs to the parent category, so the product page never renders.
- **`/products/other`** is still an active empty root with blank SEO fields.
- **Availability** has no visible last-updated date. Articles have `datePublished` and `dateModified`; product specs do not.
- Home and about still say trial data sits behind the varieties, with no source, date, or author an answer engine can attribute.

## What this means for sharing and GEO

A link to a product or article can produce a preview, but the preview image is a WordPress file, an Unsplash file, or the logo, because the social-image field is empty. A link to the home page, a category, or Contact has a title and description and no image.

Answer engines can quote product quick facts (rainfall, sowing rate, livestock) from the HTML and Product schema. They cannot quote FAQs, a confirmed phone number, a Western Australia service area, or a stable "who is IH Seeds" graph with logo and profile links. Category pages are the natural answer for "ryegrass for 500–900 mm" and that rainfall figure is stored and then omitted.

## Recommended implementation work, in priority order

1. Restore the 70 legacy `/product/{slug}` redirects to the live product URL, and stop the three slug collisions from 301ing to the parent category.
2. Add Open Graph and Twitter to the layout, with a same-origin default image, then category pages. Populate `socialImage` on products and articles, or intentionally use the first photo as the share image and stop treating the empty social fields as a content task.
3. Fill category SEO titles, descriptions, and headings. Render the stored rainfall band under the category H1.
4. Add a short `llms.txt`, and extend Organization with logo, `areaServed`, and `sameAs` once those URLs are known. Add LocalBusiness on Contact only after the phone number is real.
5. Write a small set of on-page FAQs for the 11 categories and the main products so the existing FAQ schema has something to emit.
6. Noindex or deactivate `/products/other`. Move product and category images onto the `www` host and give informative photos alt text.

## Limitations

This audit did not access production, Google Search Console, Analytics, backlink tools, or a running local API. Counts are from the seed catalogue and may differ if editors have filled fields in the live database since that seed was exported. It cannot confirm DNS or edge behaviour, indexed URL counts, ranking changes, or production Web Vitals.
