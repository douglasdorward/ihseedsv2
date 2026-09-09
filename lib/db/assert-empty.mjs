import pg from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  const table = await pool.query("SELECT to_regclass('ih_products') AS name");
  if (table.rows[0].name) {
    const products = await pool.query("SELECT count(*)::integer AS count FROM ih_products");
    if (products.rows[0].count > 0) {
      throw new Error(
        `Refusing first-time database setup: ih_products already contains ${products.rows[0].count} records`,
      );
    }
  }
} finally {
  await pool.end();
}