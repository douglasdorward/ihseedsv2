import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

// Fresh-database bootstrap for local / Cloud Agent development.
//
// The base tables are created by `drizzle-kit push` from the Drizzle schema
// (see package.json `push`). The SQL files in ./drizzle then layer on data
// seeds and incremental adjustments and are replayed by ./migrate.mjs, which
// api-server's `start` runs on every boot.
//
// One historical data-seed migration (0003_catalogue_categories) uses
// `INSERT ... ON CONFLICT ("slug")`, which assumes a standalone UNIQUE on
// ih_catalogue_categories.slug. The current schema instead enforces a
// composite unique index on (COALESCE(parent_id, 0), slug), so a freshly
// pushed database has no arbiter index for that ON CONFLICT and the replay
// fails. Editing the committed migration is not an option: migrate.mjs guards
// against changed checksums and would break existing deployments.
//
// This script bridges that gap for a fresh database only: it creates a
// transient standalone UNIQUE index on slug, runs the normal migration replay
// (which also records every migration in ih_schema_migrations so subsequent
// `migrate` runs are a clean no-op), then drops the transient index so the
// resulting schema matches the Drizzle definitions. It is safe to run
// repeatedly; once the ledger is populated the replay applies nothing.

const here = dirname(fileURLToPath(import.meta.url));

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

const TEMP_INDEX = "ih_catalogue_categories_slug_bootstrap_unique";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function ledgerComplete(client) {
  const ledger = await client.query(
    "SELECT to_regclass('public.ih_schema_migrations') IS NOT NULL AS exists",
  );
  if (!ledger.rows[0]?.exists) return false;
  const { rows } = await client.query(
    'SELECT count(*)::int AS applied FROM "ih_schema_migrations"',
  );
  return rows[0].applied > 0;
}

const client = await pool.connect();
let createdTempIndex = false;
try {
  if (await ledgerComplete(client)) {
    console.log("Database migrations already recorded; nothing to bootstrap.");
  } else {
    await client.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "${TEMP_INDEX}" ON "ih_catalogue_categories" ("slug")`,
    );
    createdTempIndex = true;
  }
} finally {
  client.release();
}

const migrate = spawnSync(process.execPath, [join(here, "migrate.mjs")], {
  stdio: "inherit",
  env: process.env,
});

if (createdTempIndex) {
  const cleanup = await pool.connect();
  try {
    await cleanup.query(`DROP INDEX IF EXISTS "${TEMP_INDEX}"`);
  } finally {
    cleanup.release();
  }
}

await pool.end();

if (migrate.status !== 0) {
  process.exit(migrate.status ?? 1);
}
