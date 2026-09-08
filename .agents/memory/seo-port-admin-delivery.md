---
name: SEO port admin delivery
description: Approved runtime boundary between the Next.js public frontend and the existing Vite admin.
---

The public, indexable site belongs in Next.js, while Express may serve the unchanged compiled Vite admin at `/admin`.

**Why:** The original two-process port plan assumed Express already delivered the admin, but it only exposed APIs. The user approved this narrow backend exception because it preserves the simpler production architecture and does not affect public SEO.

**How to apply:** Keep admin source markup and styling unchanged, build it with the `/admin/` base path, and reserve Next.js server rendering for public routes. Do not turn the admin into part of the SEO surface.