#!/bin/bash
set -e
pnpm install --frozen-lockfile
# Apply the numbered SQL migrations. Do not use `drizzle-kit push` here: the
# Drizzle schema does not describe every table, rule and index those migrations
# create, so a push proposes dropping live structures (including the migration
# journal) and cannot run unattended.
pnpm --filter db migrate
