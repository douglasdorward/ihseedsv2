---
name: Generated tech sheet storage
description: How customer tech sheet PDFs stay fresh in App Storage, and the constraints behind the design.
---

Stored customer tech sheets are named by a content fingerprint computed by the website (product JSON, product URL, year, Next build id, template version). Freshness comes from the key, not from invalidation hooks: a stale file is never looked up.

**Why:** hook-based invalidation kept missing paths (category renames, workbook imports, photo swaps). Pre-builds after catalogue changes are only a speed-up.

**How to apply:**
- Anything new printed on the sheet must be part of the fingerprint input, or edits to it will serve old PDFs.
- Keys are namespaced by environment (development/production) because dev and the published site share one bucket; cleanup of superseded versions would otherwise delete the other environment's sheets.
- The store endpoint must require the shared token (derived from SESSION_SECRET). Loopback origin is not proof of an internal caller: the website's /api rewrite reaches the API over loopback.
- The downloaded chrome-headless-shell cannot launch in Replit containers (exit 127, missing libraries); the nix `chromium` on PATH is what actually works. The nix store holds many old Chromium builds, so never pick one in readdir order.
