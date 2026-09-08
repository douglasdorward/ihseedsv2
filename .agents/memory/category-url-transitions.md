---
name: Category URL transitions
description: Canonical redirect rules when taxonomy categories change path or public state.
---

Every formerly public taxonomy path must retain a permanent redirect when a category slug, parent, active state, or single-child sharing state changes. A removed child path falls back to an active parent; unavailable trees fall back to `/products`.

**Why:** Canonical URL preservation is broader than slug renames. Deactivation and cross-parent moves can otherwise create 404s, duplicate catalogue placement, or breadcrumbs that point at the former root.

**How to apply:** Treat category path transitions and assigned product/draft root-label updates as one transaction. Test redirects and catalogue placement for activation changes, sibling-count changes, and parent moves.