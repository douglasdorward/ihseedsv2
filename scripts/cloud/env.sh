# Shared environment variables for the IH Seeds development setup.
# Sourced by the Cloud Agent install/start scripts and terminals.
#
# The connection string points at the local PostgreSQL instance provisioned by
# scripts/cloud/setup-postgres.sh. Credentials are intentionally local-only
# development defaults and are not secrets.
export DATABASE_URL="${DATABASE_URL:-postgresql://ihseeds:ihseeds@127.0.0.1:5432/ihseeds}"

# The Express API server listens here; the Next.js public site proxies /api and
# /admin to it (see artifacts/web/next.config.mjs).
export API_PORT="${API_PORT:-8080}"
export API_BASE="${API_BASE:-http://localhost:${API_PORT}}"
