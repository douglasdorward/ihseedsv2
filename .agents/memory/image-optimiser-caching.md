---
name: Image optimiser caching
description: Why photo widths are capped, why warm-up crawls rendered pages, and sizes-hint pitfalls.
---
The Next optimiser caches per (src, w, q, accepted format) on the server copy that made it, so every extra width is a cold miss after each publish.

**Why:** live checks showed widths above the stored copy returned identical bytes under new cache entries, and cold misses cost ~0.6–1.1s per photo. Replit adds `private` to all responses, so no edge cache helps; browser Cache-Control max-age still works.

**How to apply:**
- Keep the warm-up deriving URLs from the site's own rendered HTML, not catalogue data, so URLs always match the browser's.
- Write `sizes` with plain vw values; a calc() containing 100vw makes next/image drop the small widths.
- Running `next build` with a new NEXT_DIST_DIR rewrites tsconfig.json/next-env.d.ts; reuse `.next-lifecycle` + `tsconfig.lifecycle.json` for local production builds, and restore next-env.d.ts after.
- Killing `next-server` processes also kills the dev preview's server; restart the web workflow afterwards.
