#!/usr/bin/env bash
# Cloud Agent start phase: per-boot runtime reconciliation.
#
# Brings PostgreSQL online (its data directory persists in the environment
# snapshot) and confirms the schema is present. The migration replay is a clean
# no-op once the ledger is populated, so this is fast and safe on every boot.
# Application dev servers run from the environment's terminals.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT_DIR}"

# shellcheck source=scripts/cloud/env.sh
source "${ROOT_DIR}/scripts/cloud/env.sh"

echo "[start] ensuring PostgreSQL is online"
bash "${ROOT_DIR}/scripts/cloud/setup-postgres.sh"

echo "[start] reconciling database schema"
pnpm --filter @workspace/db exec node bootstrap.mjs

echo "[start] ready"
