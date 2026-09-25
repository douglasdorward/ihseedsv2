# IH Seeds SEO audit

**Audit date:** 23 September 2026
**Supersedes:** the 22 September 2026 audit in this file
**Scope:** The replacement Next.js site, the seed catalogue, and the live WordPress host at `irwinhunter.com.au`
**Environment:** `lib/db/seed/catalogue.json` (106 published products, 10 active root categories, `/products/other` inactive) and a fetch of the live host on 23 September 2026. Google Search Console, Analytics, backlinks, and field Core Web Vitals were not accessed. The new app is not what the live host is serving.

This document records findings only. No SEO, redirect, catalogue, or content fixes were made.

## Executive summary

The replacement app is ready to be crawled once it is the site on the host: titles, descriptions, and canonicals exist on the indexable routes, `robots.txt` and a `www` sitemap exist, and product, category, article, and pasture-selector pages emit useful JSON-LD.

Google is still indexing the WordPress site, and the host canonical points the wrong way for the new app. `www.irwinhunter.com.au` 301s to `https://irwinhunter.com.au/`. The new app writes every canonical and sitemap URL as `https://www.irwinhunter.com.au` and does not issue an HTTP host redirect. Live `robots.txt` is empty. The live sitemap lists 161 URLs (79 products, 29 posts, 44 pages, 9 categories).

Of the 79 live product URLs, 71 have no redirect row. Seven of the eight that exist 301 to a category. The one product-level redirect is `/product/souwest-pasture-mix-2`. The SouWest URL in the live sitemap, `/product/souwest-pasture-mix`, has no redirect.

On the catalogue itself, body copy is strong (median about 318 words) and titles and meta descriptions are not. Rendered product titles average 19 characters. None of the 76 custom SEO titles include the brand. “Western Australia” appears in 7 of 106 title-plus-description pairs. Product and category FAQs are empty. 54 published products have no photo, and the 52 photos that exist are still on the apex WordPress host, with no alt text.

## Live host, 23 September 2026

- Home title: `IH Seeds Pty Ltd`. Meta description: `Western Australia's Leading Seed Merchant`. Canonical: `https://irwinhunter.com.au/`. `lang` is `en-US`. One H1: “Welcome to IH Seeds”. Open Graph and JSON-LD are present.
- `https://www.irwinhunter.com.au/` returns a WordPress 301 to the apex.
- `robots.txt` is an empty 200.
- Sitemap index at `/sitemaps.xml`: 29 posts, 44 pages, 79 products, 9 categories, 0 tags.

Same-path pages can be replaced in place: `/`, `/contact`, `/products`, `/privacy`, `/terms-and-conditions`. They do not need a redirect.

## Migration gaps

- **71 of 79** live `/product/{slug}` URLs have no redirect. 70 of those paths are already stored on a published product as `websiteUrlLegacy`, including MaxiMix, Safeguard, Silahay, and Equi1st. `/product/souwest-pasture-mix` is in the sitemap and is not stored on the published SouWest product.
- **7 redirects land on a category:** Anywhere tall fescue, Avalon, Icon lucerne, hard-seeded Persian clover, soft-seeded Persian clover, NemNuke, Parafield peas.
- **29 posts** have no redirect, including “Essential pasture legumes for WA” and “Tetraploid or diploid ryegrass”. The seed file contains no articles.
- **9 `/category/` URLs** are uncovered, including `/category/ryegrass/`, `/category/mixes/`, and `/category/lucerne/`. The Next config redirects `/annual-ryegrass` and `/news`, not `/category/ryegrass` or `/category/news`.
- **`/publications-and-news`** is in the page sitemap and is not redirected. `/news` and `/publications` are.
- Old guide, availability, about, and rainfall-map paths are redirected, including `/rainfall-map` to `/pasture-selector`.

## Catalogue on-page

- **Titles.** 63 of 106 rendered titles are 20 characters or shorter. 0 are longer than 45. There is no title template, so a custom SEO title drops “| IH Seeds”.
- **Descriptions.** 22 are in the 120–160 character band. 74 are longer than 160. 4 are under 50 characters.
- **Thin published products.** Demo Mix (`demo-mix`), New product 1 (`newproduct1`), and Ceres PG One50 (`ceres-pg-one50-ryegrass`, SEO title “Migration regression SEO title”) are published and indexable. SARDI Seven has no blurb.
- **Keywords in product title plus description:** seed 51, clover 24, “wa” 22, pasture 20, ryegrass 17, rainfall 13, “western australia” 7.
- **FAQs.** 0 of 106 products. 0 of 10 active categories. FAQPage schema only prints when both fields exist. The pasture selector is the exception: 10 questions, with FAQPage and BreadcrumbList JSON-LD.
- **Category SEO.** All 10 active roots have empty `seoTitle`, `seoDescription`, and `pageHeading`. Rainfall is stored (ryegrass `500–900+ mm`) and the public category type does not include it, so the page shows the one-sentence lead only.
- **Images.** 54 products have no photo. 52 photo URLs are on `irwinhunter.com.au`. Alt text is empty on all of them. 56 categories share 5 Unsplash URLs.
- **Offers.** Sale lines say “Contact for pricing”, so Product schema has availability and no price.
- **Slug collisions.** `tall-fescue`, `puccinellia`, and `carpet-grass` are both a product and a child category. The nested URL resolves to the product. `/products/{child-slug}` is not a root, so that short path 404s.
- **`/products/other`** is inactive and excluded from the sitemap.

## Technical and citation

In place: canonicals on home, catalogue, categories, products, articles, availability, resources, guide, pasture selector, about, contact, privacy, and terms. `/llms.txt` and `/llms-full.txt` are served from the public catalogue. Organization JSON-LD on every page, with the legal name as `alternateName`. Product, Offer, and BreadcrumbList on products. ItemList on categories. Article schema on articles. Tech-sheet HTML is `noindex`.

Not in place:

- Open Graph and Twitter on home, categories, and the marketing pages. No site-wide default share image. Product and article social fields are empty, so previews use the first photo or a stock hero.
- WebSite and LocalBusiness schema. Organization `logo`, `telephone`, `taxID`, `areaServed`, and `sameAs`. Company phone and ABN defaults are blank, while product pages fall back to a hardcoded office number.
- `lang` is `en`. No `not-found.tsx`. Catalogue fetches are `cache: "no-store"`. Heroes are CSS backgrounds. No `next/image`.
- PDF tech sheets send no `X-Robots-Tag`. `/api/sitemap-products` and `/api/sitemap-articles` duplicate the app sitemap; `/api` is disallowed on the web host.
- The pasture selector is not in the header or footer.
- Availability has no visible last-updated date.

## Recommended order

1. 301 one host to the other before the new app is served. The app currently assumes `www`.
2. Add the 71 missing `/product/` redirects to the nested product URL, and retarget the 7 category destinations. Include `/product/souwest-pasture-mix`.
3. Redirect or replace the 29 posts and the `/category/` hubs. `/publications-and-news` needs its own rule.
4. Unpublish Demo Mix, New product 1, the migration-regression ryegrass, and fill or hide SARDI Seven.
5. Rewrite short product titles so they name the variety, the species, and Western Australia or pasture seed, and cut descriptions that run past about 160 characters.
6. Write category SEO titles, descriptions, and headings, and print the stored rainfall band. Add FAQs where the schema is already wired.
7. Host images on the new origin and set alt text. Add a default Open Graph image, then category and marketing tags.
8. Add logo, phone, service area, and profile URLs to Organization once they are confirmed. Link the pasture selector from the header or footer.

## Limitations

Search Console, Analytics, backlinks, and field Core Web Vitals were not available. Seed counts can differ from a database editors have changed. Article URLs on a running database were not counted; the seed file has none.
