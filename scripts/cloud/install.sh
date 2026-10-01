#!/usr/bin/env bash
# Cloud Agent install phase: prepare durable, source-derived state.
#
# Idempotent by design so it can run against a fresh machine or a cached
# snapshot: it provisions PostgreSQL, installs workspace dependencies, syncs
# and seeds the database schema, and builds the API server plus the admin app
# that the API server serves. Long-running dev servers are started from the
# environment's terminals, not here.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT_DIR}"

# shellcheck source=scripts/cloud/env.sh
source "${ROOT_DIR}/scripts/cloud/env.sh"

echo "[install] provisioning PostgreSQL"
bash "${ROOT_DIR}/scripts/cloud/setup-postgres.sh"

echo "[install] installing workspace dependencies"
pnpm install --frozen-lockfile

echo "[install] syncing and seeding the database schema"
pnpm --filter @workspace/db run push
pnpm --filter @workspace/db exec node bootstrap.mjs

echo "[install] building the API server and admin app"
pnpm run build:api

echo "[install] done"
