# IH Seeds replacement-domain SEO audit

**Audit date:** 16 September 2026  
**Scope:** Public IH Seeds website as the replacement for `www.irwinhunter.com.au`  
**Environment:** Local development workflows and the attached current-site workbook. Google Search Console, Analytics, backlink data, and the production edge were not accessed.

This document records audit findings only. No SEO, catalogue, redirect, or content fixes were implemented as part of the audit.

## Executive summary

The public Next.js routes are server-rendered and the current active catalogue has 18 root category records and 71 public product records. The normal product and category pages return SSR HTML with a title, one H1, and visible content. The migration redirect register also matches the attached workbook at the source-list level: 77 workbook URLs produce 77 stored redirect rows.

The replacement site is not ready to preserve search visibility because the standard crawl signals are incomplete and several imported redirects do not reach an indexable canonical page:

- `/robots.txt` and `/sitemap.xml` both return `404`.
- Canonical URLs observed in HTML use `https://irwinhunter.com.au`, not the required `https://www.irwinhunter.com.au`.
- Static pages and category pages do not emit complete social metadata, and the public site has no Organization/WebSite structured data.
- The API sitemap is not a public sitemap, contains only product URLs, emits relative locations when `PUBLIC_SITE_URL` is unset, and does not exclude products whose SEO setting is `noindex`.
- Six of 77 imported product redirects fail at the destination: two return `404`, and four return a `308` redirect to the same URL.
- Eight active empty root categories in the current development catalogue are crawlable; seven have browser-generated names and blank descriptions. They are not linked from the main category navigation.
- `/admin` returns a `200` authenticated application shell, while no robots policy exists to keep it out of the public crawl surface.

## Route and rendering inventory

| Surface | Route pattern | Expected indexability | Audit result |
| --- | --- | --- | --- |
| Home | `/` | Index | `200`; SSR heading and body content present |
| Catalogue index | `/products` | Index | `200`; SSR listing, one H1 |
| Root categories | `/products/{category}` | Index when active and useful | 18 active roots returned `200`; one H1 and two JSON-LD blocks each |
| Product details | `/products/{category}/{product}` | Index when Published and Active/New, unless explicitly noindex | 71 current product paths returned `200`; one H1 and product/breadcrumb JSON-LD |
| Availability | `/availability` | Index | `200`; SSR product links and availability text |
| Resources | `/resources` | Index | `200`; SSR resource and tech-sheet content |
| Guide | `/guide` | Index | `200`; SSR guide copy and PDF link |
| About | `/about` | Index | `200`; SSR company copy and one H1 |
| Contact | `/contact` | Index | `200`; SSR contact copy and one H1 |
| Catalogue alias | `/products/categories` | Redirect | `308` to `/products` |
| Legacy products | `/product/{slug}` | Redirect only when registered | Registered sources are middleware/API redirects; unknown paths return `404` |
| Admin | `/admin` | Authenticated, not indexable | `200` admin shell; no public robots policy currently blocks it |
| API | `/api/*` | Not an HTML index surface | API-only; excluded from the public route inventory |

The six category paths linked by the catalogue page are `mixes`, `clovers`, `ryegrass`, `forage-grain-crops`, `sub-tropical-grasses`, and `fescues-other-grasses`. Other active category records can be reached from some product/category relationships, but empty browser-generated roots have no useful internal discovery path.

## Confirmed findings

Severity uses **Critical** for a migration-blocking crawl/indexability failure, **High** for a defect that can directly lose indexed URLs or social/search signals, and **Medium** for a material quality, performance, or maintenance risk.

### SEO-001 — Standard robots and sitemap endpoints are missing

**Severity:** Critical  
**Status:** Confirmed defect  
**Affected routes:** `/robots.txt`, `/sitemap.xml`

**Evidence:**

- `artifacts/web/app/robots.ts` does not exist.
- `artifacts/web/app/sitemap.ts` does not exist.
- Live requests to both routes returned `404 Not Found` with `text/html`, not their required content types.
- The API exposes `/api/sitemap-products`, but it is not the standard public sitemap route.

**Search/user impact:** Search engines receive neither a crawl policy nor a discoverable URL inventory. This is especially risky during a domain replacement because the replacement host has no reliable way to communicate its preferred sitemap and the admin surface is not disallowed.

**Recommended implementation:** Add public Next metadata routes for `robots.txt` and `sitemap.xml`. The robots response should identify the canonical HTTPS `www` host and sitemap, and disallow authenticated/admin and API paths. The sitemap should include only canonical, indexable public pages and use the same host and trailing-slash policy everywhere.

### SEO-002 — Canonical host policy is wrong and incomplete

**Severity:** High  
**Status:** Confirmed defect  
**Affected routes:** All pages with a canonical; all static pages without one

**Evidence:**

- `artifacts/web/lib/site-url.ts` defaults to `https://irwinhunter.com.au`, without `www`.
- A live `/products` response emitted `<link rel="canonical" href="https://irwinhunter.com.au/products">`.
- Live category and product responses emitted the same non-`www` host.
- Home, About, Availability, Guide, Resources, and Contact have titles/descriptions but no `alternates.canonical`, so they emit no canonical link.
- `artifacts/web/lib/product-url.ts` accepts an absolute HTTP(S) product canonical override, including an external host. That can bypass the same-domain policy when populated.

**Search/user impact:** Search engines can treat the non-`www` host as the preferred replacement, while pages without canonicals rely on inference. An external product override can split signals outside the replacement site.

**Recommended implementation:** Make the production URL policy explicit and fail validation when it is not HTTPS `www.irwinhunter.com.au`. Emit canonical URLs for every indexable public page. Restrict or validate product canonical overrides against the approved same-domain policy, and document the selected no-trailing-slash convention.

### SEO-003 — Social metadata and site-level structured data are incomplete

**Severity:** High  
**Status:** Confirmed defect  
**Affected routes:** Home, About, Availability, Guide, Resources, Contact, all category pages

**Evidence:**

- Static page metadata defines only `title` and `description`; no `openGraph` or `twitter` fields are declared.
- Category metadata defines title, description, and canonical only.
- Live category responses contain no Open Graph/Twitter tags.
- Product pages do emit Open Graph and Twitter metadata, plus `Product` and `BreadcrumbList` JSON-LD.
- Category pages emit `BreadcrumbList` and `ItemList` JSON-LD, and optional FAQ JSON-LD.
- No public page emits Organization or WebSite JSON-LD. Contact has no LocalBusiness/Organization schema.

**Search/user impact:** Shared links for the core marketing, resource, guide, availability, and category pages have no controlled title, description, or image. The replacement site also lacks a stable entity/site graph for search engines.

**Recommended implementation:** Add page-appropriate Open Graph/Twitter metadata and same-domain image URLs to public marketing and category pages. Add a site-level Organization/WebSite graph, then add BreadcrumbList or other schema only where it accurately represents visible page content. Keep FAQ schema synchronized with visible FAQs.

### SEO-004 — Sitemap generation can publish non-canonical or noindex URLs

**Severity:** High  
**Status:** Confirmed code defect; current dataset has no false noindex rows

**Affected surface:** `/api/sitemap-products` and the future public sitemap

**Evidence:**

- `artifacts/api-server/src/routes/products.ts` filters the API sitemap to Published and Active listings, but does not filter `details.robotsIndex === false`.
- The API sitemap contains only product URLs; it does not include the home, catalogue, active category, guide, resources, availability, about, or contact pages.
- `canonicalProductUrl()` returns relative `<loc>` values when `PUBLIC_SITE_URL` is empty.
- In the current development data, 71 active products were returned and none had `robotsIndex: false`; this means the defect is latent rather than observed in the current rows.

**Search/user impact:** A future noindex product can be submitted in the sitemap, and relative locations are not a complete same-domain sitemap contract. Important public pages would be omitted from discovery.

**Recommended implementation:** Make one canonical sitemap source that applies the same Published/Active-or-New/noindex/canonical rules as page rendering. Include the full public route inventory and emit absolute `https://www.irwinhunter.com.au` locations only.

### SEO-005 — Six imported product redirects do not reach an indexable canonical page

**Severity:** High  
**Status:** Confirmed defect  
**Affected legacy sources:** Six of the 77 workbook URLs

**Evidence:**

The attached `1 Products` workbook contains 77 current-site `website_url` values. Development data contains 77 matching redirect rows. A direct HTTP check of every normalized source path found 77 `301` responses, but the following destinations fail:

| Legacy source | Redirect destination | Destination result |
| --- | --- | --- |
| `/product/avalon-persistent-perennial-ryegrass` | `/products/ryegrass/avalon-perennial-ryegrass` | `404` |
| `/product/hard-seeded-persian-clover` | `/products/clovers/persian-clover` | `404` |
| `/product/anywhere-tall-fescue` | `/products/fescues-other-grasses/anywhere-tall-fescue` | `308` to itself |
| `/product/icon-lucerne` | `/products/lucerne/icon-lucerne` | `308` to itself |
| `/product/nemnuke-biofumigant` | `/products/forage-grain-crops/nemnuke-biofumigant` | `308` to itself |
| `/product/parafield-peas` | `/products/forage-grain-crops/parafield-peas` | `308` to itself |

The remaining 71 workbook sources returned `301` and reached a `200` product or category response. Database comparison found zero source omissions, extras, self-redirect rows, legacy `/product/...` targets, or calculated destination mismatches; the defect is in the live destination resolution for these six records.

**Search/user impact:** Six current-site URLs either lose users and link equity at a 404 or cannot complete a redirect chain. This is a direct migration visibility failure.

**Recommended implementation:** Resolve each source to an existing canonical product route or an intentional category destination, then verify both slash variants, one-hop completion, `200` destination status, canonical tag, and absence of loops. Keep the attached workbook/current-site export as the source of truth; do not add unrelated historical redirects.

### SEO-006 — Empty and browser-generated category roots are crawlable and thin

**Severity:** Medium  
**Status:** Confirmed in the development catalogue; production confirmation required

**Affected routes:** `/products/other` and seven `browser-*` root category paths

**Evidence:**

- The current API response contains 18 active root categories.
- Eight have no current product count: `other` plus seven roots named `Browser media category ...` or `Browser photo category ...`.
- The browser-generated roots have blank `lead`, `seoTitle`, and `seoDescription` values. Their live pages still return `200`, an indexable page shell, and a fallback title such as `Browser media category ... Seed | IH Seeds`.
- The catalogue page links only six root category routes, so these empty roots are not part of the main category discovery path.

**Search/user impact:** If these development records reach production, search engines can crawl thin, test-named pages with no useful catalogue content. They also create orphaned crawlable URLs.

**Recommended implementation:** Before generating a sitemap, remove or deactivate test-only taxonomy records and decide whether an intentionally empty business category should be indexable. Give every retained indexable category useful copy, a canonical, internal links, and a product/content threshold.

### SEO-007 — Image text and product imagery are incomplete

**Severity:** Medium  
**Status:** Confirmed quality gap

**Evidence:**

- Important marketing imagery in About, Home, category features, and resource cards is rendered as CSS `backgroundImage`, so it has no image `alt` text.
- The live current catalogue has 40 of 71 products without a product photo. Product cards and hero sections fall back to the IH Seeds logo with an empty `alt` attribute.
- The guide page has a real `<img>` with `alt="Seed Guide Cover"`, and the brand logo has descriptive alt text.

**Search/user impact:** Image search and assistive technology receive little descriptive context for key content images; generic logo fallbacks do not help product discovery.

**Recommended implementation:** Decide which imagery is decorative. Use semantic images with useful alt text for informative photos, add editor validation for product social/hero imagery where required, and provide stable same-domain social images. This does not require adding alt text to decorative background layers.

### SEO-008 — Policy URLs redirect to Contact instead of providing policy content

**Severity:** Medium  
**Status:** Confirmed route behavior

**Affected routes:** `/terms-and-conditions`, `/privacy`

**Evidence:** `artifacts/web/next.config.mjs` permanently redirects both policy paths to `/contact`; there are no policy page modules in the public route inventory.

**Search/user impact:** Existing users or crawlers following policy URLs arrive at an unrelated contact page. This creates a content mismatch and leaves privacy/terms information undiscoverable.

**Recommended implementation:** Confirm the legal content and migration requirement with the owner. Either provide real policy pages with their own metadata and internal links or intentionally retire the old URLs with a documented status and destination. This audit did not change legal content.

### SEO-009 — Public response caching and asset delivery create performance risk

**Severity:** Medium  
**Status:** Confirmed implementation risk; production Web Vitals not measured

**Evidence:**

- Catalogue fetches use `cache: "no-store"` in `artifacts/web/lib/catalogue.ts`.
- Live public HTML responses use `Cache-Control: no-store, must-revalidate`.
- Measured local SSR response sizes included approximately 853 KB for `/products`, 764 KB for `/resources`, and 458 KB for `/availability`.
- The public app uses CSS background images and direct external Unsplash URLs rather than a responsive image pipeline. Production output has not been tested with real-device Web Vitals.

**Search/user impact:** Large HTML/data payloads, uncached catalogue reads, and unoptimized responsive imagery can increase mobile LCP/INP/TTFB and make crawls more expensive, even though the mobile screenshot rendered without an obvious layout break.

**Recommended implementation:** Preserve freshness where required, but add bounded caching/revalidation and invalidate it on published catalogue changes. Measure production Core Web Vitals on representative mobile routes, then optimize image dimensions/formats, loading priority, and resource caching based on those measurements.

### SEO-010 — Public security/header posture is not documented or consistently enforced

**Severity:** Medium  
**Status:** Confirmed implementation gap

**Evidence:**

- `artifacts/web/next.config.mjs` defines no response security headers.
- Live Next public responses include `X-Powered-By: Next.js` and no observed HSTS, CSP, Referrer-Policy, or Permissions-Policy headers.
- The API response has different header behavior from the public Next response.

**Search/user impact:** This is primarily a security and trust risk, but inconsistent edge/header behavior can affect resource loading, mixed-content safety, and the reliability of crawler/social fetches. The public admin shell is also not separated by a robots policy (see SEO-001).

**Recommended implementation:** Establish the production header policy at the public edge/Next layer, remove framework disclosure where appropriate, and verify CSP allows only the intended API, media, image, and analytics origins. Validate HTTPS redirect/HSTS behavior on both `www` and the non-`www` host in production.

## Passed checks and non-defects

- The active product and category pages rendered meaningful content in the initial HTML response; they do not depend on client-side JavaScript for their primary text.
- All 18 crawled active root category routes returned `200`, one H1, and category/breadcrumb structured data.
- All 71 crawled active product routes returned `200`, one H1, product/breadcrumb structured data, Open Graph tags, and Twitter tags.
- Current static page titles and descriptions are distinct and useful at a basic level.
- Current product titles and fallback descriptions were distinct in the 71-row development API sample.
- The registered redirect table is source-complete against the attached workbook at the row/path level. The six destination failures are the remaining issue.
- The mobile home screenshot showed a responsive header, menu control, readable hero content, and no obvious horizontal overflow at 390px wide. This is not a substitute for production device or Web Vitals testing.
- No duplicate-content defect was confirmed from the local route/content sample. Production duplicate checks and historical URL coverage remain outside this local audit.

## Recommended implementation work, in priority order

1. Correct the six redirect destinations and verify the complete workbook source list with a one-hop HTTP test.
2. Set and enforce the canonical production origin as `https://www.irwinhunter.com.au`; add canonicals to every indexable static and category page.
3. Add public `robots.txt` and `sitemap.xml` routes, with absolute same-domain URLs and the full indexable route inventory.
4. Keep noindex products out of the sitemap and define the exact Published/Active/New inclusion rule.
5. Remove or deactivate browser-generated/empty taxonomy roots before publishing the sitemap.
6. Add static/category Open Graph, Twitter, Organization, WebSite, and applicable breadcrumb/site schema.
7. Resolve policy URL content and confirm whether the existing hardcoded non-product redirects remain within the approved migration scope.
8. Run production-edge checks for host/protocol redirects, headers, image delivery, mobile Core Web Vitals, and connected Search Console coverage after implementation.

## Limitations and handoff

This audit did not access production, Google Search Console, Analytics, backlink tools, or the live old site. It cannot confirm DNS/edge behavior, existing indexed URL counts, ranking changes, canonical behavior under production environment variables, or production Web Vitals. Those checks should be run after the implementation work above and before the DNS/domain cutover.