---
name: Web font loading mode
description: Why the public site's Raleway font uses display swap rather than optional.
---
Keep Raleway on `display: "swap"` with the metric-matched Arial fallback; do not switch back to `"optional"`.

**Why:** `"optional"` was tried to remove homepage layout shift, but on slow first loads (always in the dev preview) browsers kept the fallback font for the whole visit and the user reported "the font looks funny / not Raleway". (2026-11-01)

**How to apply:** fix layout shift with fallback metric overrides or reserved space, never by letting the brand font be skipped.
