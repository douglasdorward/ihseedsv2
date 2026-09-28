---
name: Build API maintenance isolation
description: Keep catalogue repair work outside the temporary build API startup path.
---

The temporary catalogue API used by the web build must not perform media repairs or backfills before listening.

**Why:** A publishing failure timed out waiting for the temporary API after a photo-link repair was added to the shared server entrypoint. Invoking the compiled server directly bypasses package-script maintenance, but cannot bypass maintenance embedded in that entrypoint.

**How to apply:** Keep repair work in explicit maintenance paths and preserve its functionality there. Review shared startup changes against the build's readiness deadline; do not simply extend the timeout to accommodate catalogue-wide writes.