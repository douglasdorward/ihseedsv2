---
name: Cache freshness regressions
description: How to prove that a publish flow replaces content that was already cached.
---

Cache freshness regressions must render or fetch the old value before publishing the revision, then fetch again and assert the new value is present and the old value is absent.

**Why:** A test that first visits a page only after publishing passes even when stale revalidation remains enabled, because there is no old cache entry to invalidate.

**How to apply:** For publish-to-public-page checks, prime the public route with the original record before saving and publishing the revision. Verify both the refreshed value and removal of the original value.