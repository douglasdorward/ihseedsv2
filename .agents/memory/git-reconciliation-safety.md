---
name: Git reconciliation safety
description: How to preserve overlapping work when GitHub and Replit both contain new commits.
---

When GitHub contains concurrent work, reconcile it with a normal Git fetch plus merge/rebase or pull. Do not rebuild a local change as a new GitHub API tree on top of the remote branch when files overlap.

**Why:** Replacing whole file blobs through the GitHub API bypasses Git's three-way merge and can silently disconnect features added by another editor, even though both commits remain in history.

**How to apply:** Keep the working tree clean, fetch normally, inspect divergence, and merge conflicts explicitly. Never reset or replace the admin editor merely to align history; preserve product-page preview, Fill from PDF, Tech sheets, image management, and administrator management together.