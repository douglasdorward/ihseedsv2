# Image loading

How public-site photos are sized, prepared and cached, and the measurements behind it.

## How it works

- **Capped widths.** Photos are offered at a short list of widths (`deviceSizes` 640/828/1200/1600/2048, `imageSizes` 96/128/256/384). The shared loader (`artifacts/web/lib/image-loader.ts`) never asks for more than the stored copy: library card copies (`?size=card`, 800px) stop at 828, full copies stop at 1600, and built-in Unsplash placeholders stop at their stated width. Larger screens share that one copy instead of each width being made separately.
- **Size hints.** `lib/image-sizes.ts` holds the `sizes` value for each kind of photo, matched to the displayed width in the CSS grids. Use plain `vw` values, not `calc()`: next/image drops the small widths from a srcset when the only `vw` it finds is `100vw`.
- **Warm-up.** On every production server start, `instrumentation.ts` waits 10s, then reads `/`, `/products`, `/articles`, their pagination and every category page, and requests the 256/384/828/1200/1600 versions their photos use, one at a time. Failures are logged as `[image-warmup]` lines and skipped. `IMAGE_WARMUP=0` turns it off; `IMAGE_WARMUP=1` turns it on in development; `IMAGE_WARMUP_DELAY_MS` changes the delay.
- **Browser caching.** Fixed images in `public/` (`IMMUTABLE_PUBLIC_FILES` in `next.config.mjs`) are kept for a year; rename a file when its content changes. Favicons and the default social image are kept for a day because they must keep their names.
- Hosting marks every response `private`, so there is no shared edge cache; browser caching still applies.

## Measuring

```
node artifacts/web/scripts/measure-images.mjs https://irwinhunter.com.au / /products
```

Phone is 390x844 at 3x; desktop is 1440x900 at 1x. Pages are scrolled to the bottom so lazy photos load.

## Results (6 October 2026)

Before: live site. After: local production build against the development catalogue (different photos, so compare request counts, widths and waits rather than exact bytes).

| Page / viewport | Before: images, KB, widths | After: images, KB, widths |
| --- | --- | --- |
| `/` phone | 15, 700 KB, 1080/1200 | 13, 388 KB, 828/1200 |
| `/` desktop | 15, 561 KB, 384/640/750/1920 | 13, 311 KB, 256/828/1200 |
| `/products` phone | 28, 925 KB, 1200 | 28, 942 KB, 828/1200 |
| `/products` desktop | 28, 372 KB, 384/750 | 28, 235 KB, 256/828 |

- Card photos were previously offered at widths up to 3840; every width above 800 returned the same 800px picture under a new cache entry. Phones and desktops now share the 828 copy.
- First visit after a restart, per photo: before, an unprepared photo took 0.6–1.1s on the live site (12 of 25 `/products` phone photos were unprepared). After a restart without warm-up, the local median was 0.9–1.3s. After the warm-up finished (305 photos from 18 pages in about 4.5 minutes), every photo on both pages was ready: median 3–13ms, worst 42ms locally.
- Card photos on 1x desktops are now 256px for cards shown at about 245px (previously 384px). High-density screens get the 828 copy (previously 750), so no photo is softer.

## Hero photos (6 October 2026)

The large photo at the top of product pages, article pages and the About page is marked `priority`, like the homepage hero. It is preloaded in the page head with high fetch priority instead of lazy loading. Photos further down those pages still load on scroll. New full-width or above-the-fold heroes should do the same; cards and lists should not.

```
node artifacts/web/scripts/measure-hero.mjs <base> <path> [runs]
```

Phone is 390x844 at 3x on a slow 4G connection with 4x CPU slowdown; desktop is 1440x900 unthrottled. Browser cache off, optimiser copies already prepared. Medians of 5 runs on a local production build, in ms from navigation start.

| Page / viewport | Before: hero requested, hero loaded | After: hero requested, hero loaded |
| --- | --- | --- |
| Product (Dalkeith sub clover) phone | 3123, 3628 | 801, 1441 |
| Product desktop | 959, 991 | 222, 285 |
| Article (SouWest mix) phone | 2562, 2903 | 857, 1346 |
| Article desktop | 581, 628 | 191, 267 |
| About phone | 3151, 3654 | 856, 1508 |
| About desktop | 840, 868 | 205, 266 |

- Photo widths are unchanged (1200 on phones, 1600 on desktop, 640 for the About photo on desktop).
- On phones, the hero photo now finishes loading about 2 seconds sooner. The browser's Largest Contentful Paint figure improved less and varied by up to 0.7s between runs (product phone 4212 before, 3048–3752 after). After this change, the page's text and scripts take longer than the photo on the slow phone profile.
