---
name: SEO port admin delivery
description: Approved runtime boundary between the Next.js public frontend and the existing Vite admin.
---

The public, indexable site belongs in Next.js, while Express may serve the unchanged compiled Vite admin at `/admin`.

For dynamic catalogue pages, SEO metadata must come from the admin-managed published product record through the public API. Next.js renders that data but must not become a second content store; draft and archived values remain private.

**Why:** The original two-process port plan assumed Express already delivered the admin, but it only exposed APIs. The user approved this narrow backend exception because it preserves the simpler production architecture and does not affect public SEO.

**How to apply:** Keep admin source markup and styling unchanged, build it with the `/admin/` base path, and reserve Next.js server rendering for public routes. Static marketing pages may use code-owned metadata; product metadata uses the published SEO fields and their documented fallbacks. Do not turn the admin into part of the SEO surface.