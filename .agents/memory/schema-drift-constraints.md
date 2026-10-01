---
name: Schema drift outside migrations
description: Dev and prod databases can carry constraints that no migration file creates; tests built only from migrations will miss them.
---

The real databases have held CHECK constraints that appear in no migration
file and nowhere in the schema code (found on media reference owner types: it
allowed only product/category/static while the code also wrote article and
reseller, so live article hero attaches failed).

**Why:** a disposable test DB built from migrations alone does not reproduce the
constraint, so tests pass while the live app fails. The lifecycle runner copies
the dev schema with pg_dump first, which does catch this kind of drift.

**How to apply:** when a live-only database error names a constraint, compare
`pg_get_constraintdef` in dev and prod (prod read-only) before trusting tests.
Fix with an idempotent DROP IF EXISTS / ADD migration in dev, and declare the
constraint in the Drizzle schema. Republishing then diffs dev into prod.

**Publish diff gap (seen 2026-10-01):** the publish schema diff did NOT update a
CHECK constraint whose definition changed but whose name stayed the same; prod
kept the old rule after a successful publish. Give the replacement constraint a
NEW name (drop old name + add new name) so the diff sees a drop and an add.
Name-only changes (e.g. a unique-constraint rename) have reached prod this way.
After publishing, verify prod with read-only `pg_get_constraintdef`.
