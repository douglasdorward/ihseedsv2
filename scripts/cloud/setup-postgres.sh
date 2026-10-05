#!/usr/bin/env bash
# Idempotently provision and start a local PostgreSQL 16 instance for
# development, then ensure the application role and database exist.
#
# Safe to run repeatedly: it installs the server only when missing, starts the
# cluster only when it is not already online, and creates the role/database
# only when they are absent.
set -euo pipefail

PG_VERSION=16
DB_NAME="${IHSEEDS_DB_NAME:-ihseeds}"
DB_USER="${IHSEEDS_DB_USER:-ihseeds}"
DB_PASSWORD="${IHSEEDS_DB_PASSWORD:-ihseeds}"

echo "[setup-postgres] ensuring PostgreSQL ${PG_VERSION} is installed"
if ! command -v pg_ctlcluster >/dev/null 2>&1; then
  sudo DEBIAN_FRONTEND=noninteractive apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    "postgresql-${PG_VERSION}" "postgresql-client-${PG_VERSION}"
fi

echo "[setup-postgres] ensuring the cluster is online"
if ! sudo pg_lsclusters -h 2>/dev/null | awk '{print $1, $2, $4}' | grep -q "^${PG_VERSION} main online$"; then
  sudo pg_ctlcluster "${PG_VERSION}" main start
fi

# Wait until the server accepts connections on the local socket.
for _ in $(seq 1 30); do
  if sudo -u postgres pg_isready -q; then
    break
  fi
  sleep 1
done

echo "[setup-postgres] ensuring role and database exist"
sudo -u postgres psql -v ON_ERROR_STOP=1 \
  -v db_user="${DB_USER}" -v db_password="${DB_PASSWORD}" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'db_user', :'db_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = :'db_user')
\gexec
SQL

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}'" | grep -q 1; then
  sudo -u postgres createdb -O "${DB_USER}" "${DB_NAME}"
fi

echo "[setup-postgres] PostgreSQL is ready on 127.0.0.1:5432 (db=${DB_NAME}, user=${DB_USER})"
