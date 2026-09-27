---
name: Test upload isolation
description: Isolated databases alone do not isolate uploaded files from the running app.
---

Every integration runner that enables local storage must set a temporary APP_UPLOADS_DIR and remove it afterwards.

**Why:** Catalogue tests once used disposable databases but shared the app's local upload directory. A minimal PDF test fixture silently replaced the readable seed guide served by the app.

**How to apply:** Isolate both database and files before starting test API processes. Keep a before/after invariant for important existing uploads when running broad suites.