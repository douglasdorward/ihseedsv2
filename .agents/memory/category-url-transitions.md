---
name: Category URL transitions
description: Canonical redirect rules when taxonomy categories change path or public state.
---

Every formerly public taxonomy path must retain a permanent redirect when a category slug, parent, or active state changes. Child categories are not public URLs; a removed nested child path falls back to an active parent. Unavailable trees fall back to `/products`.

Live product pages use `/products/{category}/{slug}`. Former `/product/{slug}` addresses redirect to that nested path while the product is Published and Active.

**Why:** Canonical URL preservation is broader than slug renames. Deactivation and cross-parent moves can otherwise create 404s, duplicate catalogue placement, or breadcrumbs that point at the former root.

**How to apply:** Treat category path transitions and assigned product/draft root-label updates as one transaction. Test redirects and catalogue placement for activation changes and parent moves.
