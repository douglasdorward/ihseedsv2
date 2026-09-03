---
name: Imported bundle entry verification
description: A migration caveat for large self-unpacking Claude HTML exports.
---

After converting an imported Claude bundle to a normal app, verify the HTML served at the root contains the intended module entry.

**Why:** Self-unpacking exports can remain the active entry while new application source exists alongside them, making source-level checks misleading.

**How to apply:** After migration, fetch the proxied root and confirm it references the intended module before visual testing.