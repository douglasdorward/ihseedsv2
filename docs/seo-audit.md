# IH Seeds replacement-domain SEO + AEO/GEO audit

**Audit date:** 18 September 2026  
**Supersedes:** 16 September 2026 findings-only audit in this file  
**Scope:** Public IH Seeds website as the replacement for `www.irwinhunter.com.au`, including answer-engine (AEO) and generative-engine (GEO) citation readiness  
**Environment:** Local Next.js (`http://127.0.0.1:3000`) and API (`http://127.0.0.1:8080`) against the current development catalogue. Google Search Console, Analytics, backlink data, and the production edge were not accessed.

This document records audit findings only. No SEO, AEO, GEO, catalogue, redirect, or content fixes were implemented as part of the audit.

**Follow-up (18 September 2026):** Public `/robots.txt` and `/sitemap.xml` now exist. Robots names the canonical `www` sitemap and disallows `/admin` and `/api`. The public sitemap uses absolute `www` locations, includes published blog posts, omits noindex URLs, and emits `<lastmod>` for products and articles. `/llms.txt` is still missing.

## Executive summary

The public Next.js routes are still server-rendered. The current catalogue has **11 active root categories**, **103 public products**, and **6 published articles**. Normal product, category, and article pages return SSR HTML with a title, one H1, and visible body copy.

The replacement site is still not ready to preserve search visibility or to be cited reliably by answer/generative engines. Standard crawl endpoints remain missing, the canonical host is still non-`www`, and the workbook legacy-URL register has **regressed**: 70 of 77 current-site `/product/{slug}` URLs now 404.

Headline results:

- `/llms.txt` and `/llms-full.txt` return `404` HTML. `/robots.txt` and `/sitemap.xml` now exist (see the follow-up note above).
- Canonical URLs still use `https://irwinhunter.com.au`, not `https://www.irwinhunter.com.au`. Home, About, Availability, Guide, Resources, and Contact still omit canonicals.
- 70 of 77 workbook `website_url` paths have no redirect row and return `404`. The six destinations that failed on 16 September now `301` to live category pages.
- Three published products (`tall-fescue`, `puccinellia`, `carpet-grass`) cannot be reached at their canonical nested URLs: middleware `301`s those paths to the parent category, while `/api/sitemap-products` still lists them.
- Product and article pages emit Open Graph, Twitter, and relevant JSON-LD. Static and category pages still do not. No page emits site-level Organization or WebSite schema.
- No product or category FAQ is populated, so FAQPage schema never appears. Contact NAP is visible but uses a placeholder phone number and has no LocalBusiness schema.
- `/admin` still returns `200` with no robots policy.

## What changed since 16 September 2026

| Area | 16 September | 18 September |
| --- | --- | --- |
| Public products | 71 | 103 |
| Active root categories | 18, including seven `browser-*` empties | 11; browser-generated roots are gone |
| Articles | Not in the public route inventory | 6 indexable `/resources/{slug}` pages with Article JSON-LD |
| `/products` canonical | Missing | Present (`https://irwinhunter.com.au/products`) |
| Workbook `/product/{slug}` redirects | 77 sources `301`; 6 destinations failed | 7 sources `301` to live pages; **70 sources `404`** |
| Empty crawlable roots | 8 | 1 (`/products/other`) |
| Public FAQ content | Not sampled as a zero-count | **0** product FAQs and **0** category FAQs |

## Route and rendering inventory

| Surface | Route pattern | Expected indexability | Audit result |
| --- | --- | --- | --- |
| Home | `/` | Index | `200`; SSR heading and body; no canonical; no OG/JSON-LD |
| Catalogue index | `/products` | Index | `200`; SSR listing; canonical present; ~724 KB HTML |
| Root categories | `/products/{category}` | Index when active and useful | 11 active roots `200`; one H1; BreadcrumbList + ItemList; no OG |
| Product details | `/products/{category}/{product}` | Index when Published and Active/New, unless noindex | 100 of 103 canonical paths `200` with Product JSON-LD; 3 collide with child-category redirects and `301` to the parent |
| Availability | `/availability` | Index | `200`; SSR product links; ~638 KB; no canonical/OG |
| Resources index | `/resources` | Index | `200`; SSR article and tech-sheet listing; no canonical/OG |
| Resource article | `/resources/{slug}` | Index unless `robotsIndex` is false | 6 published articles `200`; canonical, OG `article`, Twitter, Article + BreadcrumbList JSON-LD |
| Guide | `/guide` | Index | `200`; SSR copy and PDF link; no canonical/OG |
| About | `/about` | Index | `200`; SSR company copy; no canonical/OG |
| Contact | `/contact` | Index | `200`; SSR NAP and enquiry form; no LocalBusiness schema |
| Catalogue alias | `/products/categories` | Redirect | `301` to `/products` |
| Legacy products | `/product/{slug}` | Redirect when registered | 8 registered `/product/` rows `301`; unknown paths, including 70 workbook URLs, `404` |
| Trailing slash | `/{path}/` | Redirect to no slash | Next `308` to the non-slash path |
| Policy URLs | `/privacy`, `/terms-and-conditions` | Real policy content or documented retirement | `308` to `/contact` |
| Admin | `/admin` | Authenticated, not indexable | `200` Express HTML shell; title `Admin — IH Seeds`; no noindex |
| `robots.txt` / `sitemap.xml` | Standard crawler files | Public, correct type | Implemented after this audit: `robots.ts` and `sitemap.ts` |
| `llms.txt` | Standard crawler files | Public, correct type | `404` `text/html` |
| API sitemaps | `/api/sitemap-products`, `/api/sitemap-articles` | Not the public sitemap | Fragment XML; robots now disallows `/api` |

Featured header navigation links six roots: `mixes`, `clovers`, `forage-grain-crops`, `ryegrass`, `sub-tropical-grasses`, `fescues-other-grasses`. `serradella`, `lucerne`, `herbs`, `biologicals`, and empty `other` are omitted from that menu but remain reachable from `/products` except where empty.

## Confirmed findings

Severity uses **Critical** for a migration-blocking crawl/indexability failure, **High** for a defect that can directly lose indexed URLs or social/search/citation signals, and **Medium** for a material quality, performance, or maintenance risk.

Status is relative to the 16 September audit: **still open**, **regressed**, **partially fixed**, or **new**.

### SEO-001 — Standard robots and sitemap endpoints are missing

**Severity:** Critical  
**Status:** Implemented after this audit  
**Affected routes:** `/robots.txt`, `/sitemap.xml`

**Evidence:**

- `artifacts/web/app/robots.ts` and `artifacts/web/app/sitemap.ts` now exist.
- `/robots.txt` names the canonical HTTPS `www` host and `/sitemap.xml`, and disallows `/admin` and `/api`.
- `/sitemap.xml` is the public crawl inventory: absolute `www` locations, static marketing URLs, active non-empty root categories, indexable products, and published articles, with `<lastmod>` on products and articles.

**Search/user impact:** Search engines and AI crawlers have a crawl policy and a discoverable URL inventory. `/llms.txt` remains missing.

**Recommended implementation:** Add public Next metadata routes for `robots.txt` and `sitemap.xml`. Robots should name the canonical HTTPS `www` host and sitemap, allow major search and AI crawlers, and disallow `/admin` and `/api` (except any intentional public files). The sitemap should include only canonical, indexable, `200` public URLs.

### SEO-002 — Canonical host policy is wrong and incomplete

**Severity:** High  
**Status:** Partially fixed  
**Affected routes:** All pages with a canonical; all static pages without one

**Evidence:**

- `artifacts/web/lib/site-url.ts` still defaults to `https://irwinhunter.com.au` (no `www`). Live canonicals used that host.
- `/products`, all 11 category pages, 103 product-route responses, and 6 articles now emit `<link rel="canonical">`.
- Home, About, Availability, Guide, Resources, and Contact still have titles/descriptions only — no `alternates.canonical`.
- `productCanonicalUrl()` still accepts an absolute HTTP(S) override on any host. Current rows have no override populated.
- Trailing-slash policy is consistent: `/products/` and `/about/` `308` to the non-slash path; canonicals omit the slash.

**Search/user impact:** Search engines and citation systems can treat the non-`www` host as the preferred replacement. Pages without canonicals rely on inference. External overrides can still split signals.

**Recommended implementation:** Fail validation unless `PUBLIC_SITE_URL` is `https://www.irwinhunter.com.au`. Emit canonicals on every indexable public page. Restrict product canonical overrides to that origin.

### SEO-003 — Social metadata and site-level structured data are incomplete

**Severity:** High  
**Status:** Partially fixed  
**Affected routes:** Home, About, Availability, Guide, Resources, Contact, all category pages; site-wide entity graph

**Evidence:**

- Product pages emit Open Graph (`og:type` is `website`, not product), Twitter `summary_large_image`, Product + BreadcrumbList JSON-LD, and optional FAQPage (unused; see AEO-001). Sample `/products/ryegrass/safeguard-annual-ryegrass` JSON-LD image still points at `https://irwinhunter.com.au/wp-content/uploads/...`.
- Article pages emit OG `article` (with published/modified times), Twitter, Article + BreadcrumbList JSON-LD. Author and publisher are Organization `IH Seeds` with no `sameAs`, logo, or person byline.
- Category pages emit BreadcrumbList and ItemList only. No Open Graph or Twitter.
- Static marketing pages define title and description only.
- No public page emits Organization, WebSite, or LocalBusiness JSON-LD.

**Search/user impact:** Shared links for core marketing and category URLs have no controlled image or social title. The site still lacks a stable entity graph for search and answer engines.

**Recommended implementation:** Add OG/Twitter and same-domain images to static and category pages. Add a site-level Organization/WebSite graph (and LocalBusiness on Contact if the NAP is real). Keep Product `og:type` and image URLs aligned with the canonical host.

### SEO-004 — Sitemap generation can publish non-canonical, relative, or redirecting URLs

**Severity:** High  
**Status:** Implemented after this audit for the public `/sitemap.xml` contract  
**Affected surface:** `/sitemap.xml`; `/api/sitemap-products` and `/api/sitemap-articles` remain internal fragments

**Evidence:**

- Public `/sitemap.xml` now uses absolute `www` locations, includes marketing URLs, categories, indexable products, and articles, and excludes `robotsIndex === false`.
- Product and article entries emit `<lastmod>`. Product lastmod comes from a sitemap-only inventory, not the public product card payload.
- Product sitemap locations use the same same-origin canonical helper as the product page.
- `/api/sitemap-products` and `/api/sitemap-articles` still exist as fragments and are disallowed in `robots.txt`.

**Search/user impact:** The submitted sitemap is the Next `/sitemap.xml` inventory rather than the incomplete API fragments.

**Recommended implementation:** One canonical sitemap source, absolute `www` locations only, the full indexable inventory, noindex excluded, and no URL that does not return `200` with a matching canonical.

### SEO-005 — Most imported product redirects no longer reach the replacement site

**Severity:** Critical  
**Status:** Regressed  
**Affected legacy sources:** 77 workbook `website_url` values on `irwinhunter.com.au/product/...`

**Evidence:**

The current seed/workbook still contains 77 unique `websiteUrlLegacy` paths. Live redirect lookup and HTTP checks found:

| Result | Count | Notes |
| --- | --- | --- |
| Lookup missing, HTTP `404` | 70 | Includes live products such as `/product/maximix`, `/product/safeguard-annual-ryegrass`, `/product/urana-sub-clover` |
| `301` to a live `200` page | 7 | The previous six broken sources now land on category pages; `/product/souwest-pasture-mix-2` lands on the SouWest product |
| Canonical SouWest legacy URL | `/product/souwest-pasture-mix` | `404`; only the `-2` alias is registered |

The six destinations that failed on 16 September now succeed as category landings:

| Legacy source | Redirect destination | Destination result |
| --- | --- | --- |
| `/product/avalon-persistent-perennial-ryegrass` | `/products/ryegrass` | `200` |
| `/product/hard-seeded-persian-clover` | `/products/clovers` | `200` |
| `/product/anywhere-tall-fescue` | `/products/fescues-other-grasses` | `200` |
| `/product/icon-lucerne` | `/products/lucerne` | `200` |
| `/product/nemnuke-biofumigant` | `/products/forage-grain-crops` | `200` |
| `/product/parafield-peas` | `/products/forage-grain-crops` | `200` |

All 70 missing sources correspond to a currently published public product. The defect is missing redirect rows, not missing products.

**Search/user impact:** Almost the entire current-site product URL inventory 404s on the replacement host. This is a direct migration visibility failure and is worse than 16 September.

**Recommended implementation:** Restore a `301` from every workbook `/product/{slug}` (and slash variant) to the live nested canonical, or to an intentional category landing when the product no longer exists. Verify one-hop completion, `200` destination, canonical tag, and no loops. Keep `/product/souwest-pasture-mix` in that register.

### SEO-006 — Empty category root is still crawlable

**Severity:** Medium  
**Status:** Partially fixed  
**Affected routes:** `/products/other`

**Evidence:**

- Seven `browser-*` empty roots from 16 September are gone.
- `/products/other` remains active, returns `200`, uses the fallback title `Other Products Seed | IH Seeds`, has blank `seoTitle` / `seoDescription`, and has product count 0.
- It is not in the featured nav. `/products` only links roots that currently have products, so discovery is weak but the URL is still crawlable.

**Search/user impact:** A thin, empty category can still be indexed if discovered via sitemap, leftover links, or direct URL.

**Recommended implementation:** Deactivate or noindex empty roots before publishing a sitemap. Give every retained indexable category unique SEO title, description, and useful copy.

### SEO-007 — Image text and product imagery are incomplete

**Severity:** Medium  
**Status:** Still open  
**Evidence:**

- Home, About, category features, article heroes, and resource cards still use CSS `backgroundImage`, so those photos have no `alt`.
- 55 of 103 products have no product photo. Listing cards and product heroes fall back to a logo/`product-fallback.svg` with an empty `alt`. `/products` HTML contained 55 empty alts.
- Of the 48 products with photos, 42 use `irwinhunter.com.au` WordPress URLs and 6 use same-origin `/api/media/...`. No product has `socialImage` set.
- All 11 category images are Unsplash URLs. Five of six article heroes are Unsplash; one uses `/api/media/...`.
- Guide cover remains a real `<img>` with a descriptive alt. Brand logo alt remains `IH Seeds — Irwin Hunter & Co`.

**Search/user impact:** Image search and assistive technology get little product context. Social and schema images often point at the old WordPress host or at generic stock photos, which weakens both SEO and citation.

**Recommended implementation:** Use semantic images with useful alt text for informative photos. Host social/schema images on the canonical `www` origin. Treat Unsplash and empty logo fallbacks as decorative or replace them before launch.

### SEO-008 — Policy URLs redirect to Contact instead of providing policy content

**Severity:** Medium  
**Status:** Still open  
**Affected routes:** `/terms-and-conditions`, `/privacy`

**Evidence:** `artifacts/web/next.config.mjs` still permanently redirects both paths to `/contact`. Live responses are `308` to `/contact`. There are no policy page modules.

**Search/user impact:** Crawlers and users following policy URLs arrive at an unrelated contact page.

**Recommended implementation:** Confirm the legal requirement. Provide real policy pages with their own metadata, or retire the old URLs with a documented status.

### SEO-009 — Public response caching and asset delivery create performance risk

**Severity:** Medium  
**Status:** Still open  
**Evidence:**

- Catalogue fetches still use `cache: "no-store"` in `artifacts/web/lib/catalogue.ts`.
- Public HTML responses use `Cache-Control: no-store, must-revalidate`.
- Measured local SSR sizes: `/products` ~724 KB, `/availability` ~638 KB, `/resources` ~614 KB, product pages typically ~140 KB (max ~177 KB for `/products/mixes/maximix`).
- CSS background images and direct Unsplash/WordPress URLs are still used instead of a responsive same-origin image pipeline.
- Production Web Vitals were not measured.

**Search/user impact:** Large uncached HTML and unoptimized images increase TTFB/LCP and crawl cost.

**Recommended implementation:** Add bounded revalidation for published catalogue reads, then measure mobile Web Vitals on representative routes before optimizing images.

### SEO-010 — Public security/header posture is not documented or consistently enforced

**Severity:** Medium  
**Status:** Still open  
**Evidence:**

- `artifacts/web/next.config.mjs` still defines no security headers.
- Public Next responses include `X-Powered-By: Next.js` and no HSTS, CSP, Referrer-Policy, or Permissions-Policy.
- `/admin` is `X-Powered-By: Express` with `Cache-Control: public, max-age=0`.

**Search/user impact:** Primarily a trust/security gap; inconsistent headers also affect crawler and social fetch reliability.

**Recommended implementation:** Set the header policy at the public edge/Next layer, hide framework disclosure, and verify HTTPS/HSTS on both hosts in production.

### SEO-011 — Three published products are unreachable at their canonical nested URLs

**Severity:** High  
**Status:** New  
**Affected routes:**

- `/products/fescues-other-grasses/tall-fescue`
- `/products/fescues-other-grasses/puccinellia`
- `/products/sub-tropical-grasses/carpet-grass`

**Evidence:**

- Each slug is both a published Active product and an active child category under the same root.
- `GET /api/redirects/lookup` returns the parent category. Middleware therefore `301`s the nested product URL before the product page can render.
- `/api/sitemap-products` still lists all three paths.
- `0014_nested_product_urls.sql` skipped *inserting* child-category redirects when a live product owned the slug, but earlier taxonomy redirects remain and win.

**Search/user impact:** Three indexable catalogue products have no reachable canonical URL. The sitemap advertises destinations that never show the product.

**Recommended implementation:** Prefer the product page at `/products/{root}/{slug}` when a live product owns that slug; keep child taxonomy off the public nested path (already the intended contract). Remove or override the colliding redirect rows, then confirm the three URLs `200` with Product JSON-LD.

### SEO-012 — Category SEO fields are blank, so titles collapse to a shared pattern

**Severity:** Medium  
**Status:** New  
**Affected routes:** All 11 `/products/{category}` pages

**Evidence:**

- Every active root has empty `seoTitle`, `seoDescription`, and `pageHeading`.
- Live titles fall back to `{name} Seed | IH Seeds` (for example `Ryegrasses Seed | IH Seeds`).
- Category `rainfall` is present in the API (`500–900+ mm` for ryegrass) but the category intro only renders `lead`.
- Duplicate titles were observed where colliding product URLs `301` onto the category page (`Fescues & Other Grasses Seed | IH Seeds`, `Sub-Tropical Grasses Seed | IH Seeds`).

**Search/user impact:** Category SERP titles are generic and similar. Useful rainfall facts are not in the category lead, which also weakens AEO.

**Recommended implementation:** Fill unique category SEO titles, descriptions, and headings. Surface rainfall and other category facts in visible copy before adding them to schema.

## AEO findings (answer engines)

### AEO-001 — FAQ schema is implemented but the catalogue has no FAQs

**Severity:** High  
**Status:** New  
**Affected routes:** Product and category pages

**Evidence:**

- Product and category templates emit visible `<details>` FAQs and matching `FAQPage` JSON-LD when question and answer are both present.
- Live API data: **0 / 103** products and **0 / 11** categories have a complete FAQ. No live page emitted `FAQPage`.
- Product copy is otherwise extractable: 103/103 have `description`, 101 have `blurb` and `keyAttributes`, 103 have sowing rates, 97 have min rainfall, and Quick facts render as HTML plus Product `additionalProperty`.

**Answer-engine impact:** People Also Ask, FAQ rich results, and AI Overviews have no on-page Q&A to quote. The implementation is fine; the content is missing.

**Recommended implementation:** Add a small set of unique, visible FAQs per category and for high-traffic products (sowing rate, rainfall, livestock, persistence). Keep schema limited to FAQs that appear on the page.

### AEO-002 — Site entity, NAP, and Contact schema are incomplete or unsafe to cite

**Severity:** High  
**Status:** New  
**Affected routes:** All pages; especially `/contact` and `/about`

**Evidence:**

- Visible Contact NAP: `(08) 9123 4567`, `info@irwinhunter.com.au`, `Unit 5, 75 Robinson Avenue, Belmont, WA 6104`, Monday–Friday 8am–5pm AWST.
- The phone number is a `+61891234567` placeholder in `ContactPage.tsx`, not an editor-managed setting.
- No LocalBusiness, Organization, or WebSite JSON-LD. Footer identifies `Irwin Hunter & Co` and Australian Seed Federation membership; titles use `IH Seeds`; canonical host is `irwinhunter.com.au`.
- Article JSON-LD author is Organization `IH Seeds` with no expert byline, credentials, or `sameAs` profile links.

**Answer-engine impact:** Answer engines that quote a phone number, legal name, or “who is IH Seeds / Irwin Hunter” can cite a placeholder or split the brand across three labels.

**Recommended implementation:** Publish one legal entity string, real NAP, Organization/`sameAs` links, and LocalBusiness only after the phone/address are confirmed. Add an expert byline on agronomic articles.

### AEO-003 — Answer-first structure is uneven outside product pages

**Severity:** Medium  
**Status:** New  

**Evidence:**

- Product pages have a single H1, blurb, key attributes, description, and Quick facts — a strong extractable pattern.
- Category intros are one lead sentence and do not use stored rainfall values.
- Home H1 is split across `<span>` + `<strong>` (`Western Australia's` / `Pasture Seed Specialists.`) and concatenates without a space in the accessible string.
- Articles are short (about 1,400–1,500 characters). `/resources/annual-or-perennial-ryegrass` is a good question-style H1; most other article bodies have few intermediate headings. One article body is only 240 characters (`autumn-sowing-window`).
- Availability copy says warehouse levels are “updated weekly” but there is no `dateModified` on that page.
- Growing notes on products sit in `<details>` summaries, which remain in SSR HTML and are usable, but they are not framed as questions.

**Answer-engine impact:** Product specs can be quoted; category and marketing pages are weaker answers to “which ryegrass for X mm rainfall” or “who is IH Seeds”.

**Recommended implementation:** Put one concise answer sentence under each H1. Surface category rainfall. Add dated freshness on Availability. Expand the thinnest article or noindex it.

## GEO findings (generative engines)

### GEO-001 — No AI crawler policy and no `llms.txt`

**Severity:** High  
**Status:** New  
**Affected routes:** `/robots.txt`, `/llms.txt`, `/llms-full.txt`

**Evidence:**

- All three files `404` as HTML.
- There is no allow/deny policy for Googlebot, GPTBot, ClaudeBot, PerplexityBot, Google-Extended, or similar.
- Public content is in SSR HTML (positive), but crawlers have no machine-readable site map or publisher policy.

**Generative-engine impact:** Some AI crawlers treat a missing robots file as allowed, others as unknown. There is no `llms.txt` summary for citation, and `/admin` is not excluded.

**Recommended implementation:** Ship `robots.txt` that allows the chosen search/AI crawlers, blocks `/admin`, and points at `/sitemap.xml`. Add a short `llms.txt` listing canonical pages, entity name, and contact — after the host policy is fixed.

### GEO-002 — Citation graph is split across hosts, brands, and image origins

**Severity:** High  
**Status:** New  

**Evidence:**

- Canonical host `irwinhunter.com.au` vs required `www.irwinhunter.com.au`.
- Brand strings: IH Seeds, Irwin Hunter & Co, `info@irwinhunter.com.au`.
- Product schema/OG images on the old WordPress host; category/article heroes on `images.unsplash.com`; some media on `/api/media/...`.
- Product JSON-LD `url` uses the non-`www` host; at least one product `image` is a relative `/api/media/...` path.
- No `sameAs` set for the company, seed-federation membership, or social/profile URLs.

**Generative-engine impact:** Models grounding on URL + entity + image can treat the old WordPress site, Unsplash, and the replacement site as different sources, or refuse to cite a page whose media lives elsewhere.

**Recommended implementation:** One `www` origin for page, canonical, schema `url`, and images. One Organization node with aliases (`IH Seeds`, `Irwin Hunter & Co`) and `sameAs`.

### GEO-003 — Thin, colliding, or admin URLs can be retrieved as if they were answers

**Severity:** High  
**Status:** New  

**Evidence:**

- `/products/other` is an empty indexable shell.
- Three product sitemap URLs `301` to category pages, so a crawler following the sitemap never sees those products.
- `/admin` returns `200` titled `Admin — IH Seeds` with description `IH Seeds catalogue administration.` and no noindex.
- Policy URLs resolve to Contact, so a model asked for “IH Seeds privacy policy” can cite the enquiry page.

**Generative-engine impact:** Retrieval systems may ingest the admin shell, empty Other Products page, or Contact-as-policy page as site truth.

**Recommended implementation:** Noindex/disallow `/admin`, remove empty taxonomy from the sitemap, and do not let policy or product URLs land on the wrong template.

### GEO-004 — E-E-A-T and freshness signals are thin for generative citation

**Severity:** Medium  
**Status:** New  

**Evidence:**

- Articles include `datePublished` / `dateModified` in OG and JSON-LD (good). Other indexable pages do not.
- No named agronomist/author, no review date on product specs, no visible source for trial claims (“trial data behind them” on Home/About).
- 55 products have no photo; 0 social images; 5/6 articles use Unsplash.
- Product Offers often omit `price` even when a display price exists (Maximix Offer had availability only), so shopping/citation cards lack a grounded price.

**Generative-engine impact:** Models prefer attributable, dated, expert-authored pages with first-party media. The catalogue facts are strong; the trust layer around them is not.

**Recommended implementation:** Named authors or reviewers on articles, visible last-updated on Availability and key products, first-party images, and Offer price only when it is a real numeric price.

## Passed checks and non-defects

- Active product, category, and article pages render primary text in the initial HTML; they do not depend on client JavaScript for that copy.
- 100 reachable product pages returned `200`, one H1, Product + BreadcrumbList JSON-LD, Open Graph, and Twitter tags.
- All 11 active root category pages returned `200`, one H1, and BreadcrumbList/ItemList JSON-LD.
- All 6 article pages returned `200`, one H1, Article JSON-LD, OG `article`, and Twitter tags. Current article `robotsIndex` values are all true; the article sitemap already filters noindex.
- Static titles and descriptions are distinct from each other (Contact is reused only because policy URLs redirect there).
- Product SEO titles in the 103-row sample were unique. 77 products have an explicit `seoTitle`; 101 have `seoDescription` or blurb fallback.
- Trailing-slash canonicalisation is consistent (no-slash).
- `/products/categories` correctly `301`s to `/products`.
- Hardcoded WordPress marketing redirects in `next.config.mjs` (`/about-us` → `/about`, `/news` → `/resources`, `/lucerne` → `/products/lucerne`, and the rest of that list) return `308` to the intended public path.
- HTML language is `lang="en"`. 404 pages emit `noindex`.
- Browser-generated empty taxonomy roots from 16 September are no longer present.
- This local pass did not confirm a duplicate-content defect among the `200` canonical product/article titles. Production duplicate and historical-URL coverage remain outside the local audit.

## Recommended implementation work, in priority order

1. Restore the 77 workbook `/product/{slug}` redirects (including `/product/souwest-pasture-mix`) and verify one-hop HTTP to a `200` canonical page.
2. Fix the three product/child-category slug collisions so those products `200` at their nested URLs and drop out of any redirect table that points at the parent category.
3. Set and enforce `https://www.irwinhunter.com.au`; add canonicals to every remaining indexable static page.
4. Add public `/robots.txt` and `/sitemap.xml` with absolute `www` URLs, the full indexable inventory, noindex/admin excluded, and no redirecting product locs. Add `llms.txt` only after that host policy is stable.
5. Deactivate or noindex `/products/other`; fill category SEO titles/descriptions; decide AI-crawler allow/disallow explicitly.
6. Add Organization/WebSite/LocalBusiness schema from confirmed NAP; replace the placeholder phone before it can be cited. Add OG/Twitter to static and category pages.
7. Populate visible FAQs on categories and key products; keep FAQ schema in sync.
8. Resolve policy URL content; noindex `/admin`.
9. Replace WordPress/Unsplash social and schema images with same-origin assets; add product photos or honest decorative treatment.
10. Run production-edge checks for host/protocol redirects, headers, mobile Core Web Vitals, Search Console coverage, and AI-crawler `robots.txt` behaviour after the work above.

## Limitations and handoff

This audit did not access production, Google Search Console, Analytics, backlink tools, or the live old site. It cannot confirm DNS/edge behaviour, indexed URL counts, ranking changes, canonical behaviour under production `PUBLIC_SITE_URL`, or production Web Vitals. Those checks should run after the implementation work above and before DNS/domain cutover.

AEO/GEO conclusions are based on SSR HTML, schema, entity consistency, and crawler files. They are not based on live ChatGPT, Perplexity, Gemini, or Google AI Overview sampling.
