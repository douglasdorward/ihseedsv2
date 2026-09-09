import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

const migrationDir = join(dirname(fileURLToPath(import.meta.url)), "drizzle");
const migrationFiles = (await readdir(migrationDir))
  .filter((file) => file.endsWith(".sql"))
  .sort();
const migrations = await Promise.all(migrationFiles.map(async (file) => {
  const sql = await readFile(join(migrationDir, file), "utf8");
  return { file, sql, checksum: createHash("sha256").update(sql).digest("hex") };
}));
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();

try {
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(hashtext('ih_schema_migrations'))");
  await client.query(`
    CREATE TABLE IF NOT EXISTS "ih_schema_migrations" (
      "name" text PRIMARY KEY,
      "checksum" text NOT NULL,
      "applied_at" timestamp with time zone NOT NULL DEFAULT now()
    )
  `);

  const applied = await client.query('SELECT count(*)::integer AS count FROM "ih_schema_migrations"');
  if (applied.rows[0].count === 0) {
    const latestSchema = await client.query(`
      SELECT
        to_regclass('ih_products') IS NOT NULL
        AND to_regclass('ih_product_drafts') IS NOT NULL
        AND to_regclass('ih_catalogue_categories') IS NOT NULL
        AND to_regclass('ih_sale_lines') IS NOT NULL
        AND to_regclass('ih_redirects') IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = current_schema() AND table_name = 'ih_products'
            AND column_name = 'listing_override'
        )
        AND EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = current_schema() AND table_name = 'ih_catalogue_categories'
            AND column_name = 'seo_description'
        )
        AND EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = current_schema() AND table_name = 'ih_sale_lines'
            AND column_name = 'availability' AND is_nullable = 'YES'
        ) AS ready
    `);
    if (latestSchema.rows[0].ready) {
      for (const migration of migrations) {
        await client.query(
          'INSERT INTO "ih_schema_migrations" ("name", "checksum") VALUES ($1, $2)',
          [migration.file, migration.checksum],
        );
      }
      console.log(`Baselined ${migrations.length} migrations for an existing latest-version schema`);
    }
  }

  for (const { file, sql, checksum } of migrations) {
    const existing = await client.query(
      'SELECT "checksum" FROM "ih_schema_migrations" WHERE "name" = $1',
      [file],
    );
    if (existing.rows[0]) {
      if (existing.rows[0].checksum !== checksum) {
        throw new Error(`Applied migration ${file} has changed`);
      }
      continue;
    }
    await client.query(sql);
    await client.query(
      'INSERT INTO "ih_schema_migrations" ("name", "checksum") VALUES ($1, $2)',
      [file, checksum],
    );
    console.log(`Applied database migration ${file}`);
  }

  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}