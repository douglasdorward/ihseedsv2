---
name: OpenAPI integer generation
description: Compatibility rule for numeric OpenAPI schemas in this workspace's generated Zod validators.
---

Use `type: number` for non-identifier numeric response fields such as dashboard counts when generated Zod validation is required.

**Why:** The current OpenAPI generator emits `z.int()` for `type: integer`, but the generated validation package resolves to a Zod runtime that does not expose that API, causing code generation's library typecheck to fail.

**How to apply:** Keep identifiers and path parameters aligned with existing contracts, but prefer `number` for new count and summary fields until the generator and Zod runtime are upgraded together.