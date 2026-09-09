import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

const outputPath = join(dirname(fileURLToPath(import.meta.url)), "seed", "catalogue.json");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  const [
    categories,
    products,
    saleLines,
    options,
    drafts,
    redirects,
  ] = await Promise.all([
    pool.query(`SELECT id AS "sourceId", parent_id AS "sourceParentId", slug, name,
      group_label AS "groupLabel", lead, page_heading AS "pageHeading",
      seo_title AS "seoTitle", seo_description AS "seoDescription", rainfall,
      image, sort_order AS "sortOrder", active
      FROM ih_catalogue_categories ORDER BY parent_id NULLS FIRST, sort_order, id`),
    pool.query(`SELECT p.name, p.slug, p.price, p.pack_size AS "packSize",
      p.status, p.note, p.category, c.slug AS "subcategorySlug",
      pc.slug AS "subcategoryParentSlug", p.tech_sheet AS "techSheet",
      p.guide_year AS "guideYear", p.description_source AS "descriptionSource",
      p.website_url_legacy AS "websiteUrlLegacy",
      p.availability_override AS "availabilityOverride",
      p.listing_override AS "listingOverride", p.publish_status AS "publishStatus",
      p.published_at AS "publishedAt", p.details
      FROM ih_products p
      LEFT JOIN ih_catalogue_categories c ON c.id = p.subcategory_id
      LEFT JOIN ih_catalogue_categories pc ON pc.id = c.parent_id
      ORDER BY p.id`),
    pool.query(`SELECT p.slug AS "productSlug", s.stock_code AS "stockCode",
      s.seed_form AS "seedForm", s.seed_grade AS "seedGrade",
      s.pack_kg AS "packKg", s.pack_unit AS "packUnit",
      s.availability, s.price_display AS "priceDisplay",
      s.is_default AS "isDefault", s.sort_order AS "sortOrder"
      FROM ih_sale_lines s JOIN ih_products p ON p.id = s.product_id
      ORDER BY p.id, s.sort_order, s.id`),
    pool.query(`SELECT list_name AS "listName", value, sort_order AS "sortOrder"
      FROM ih_product_options ORDER BY list_name, sort_order, id`),
    pool.query(`SELECT p.slug AS "productSlug", d.snapshot
      FROM ih_product_drafts d JOIN ih_products p ON p.id = d.product_id
      ORDER BY p.id`),
    pool.query(`SELECT from_path AS "fromPath", to_path AS "toPath"
      FROM ih_redirects ORDER BY from_path`),
  ]);

  const seed = {
    version: 1,
    categories: categories.rows,
    products: products.rows,
    saleLines: saleLines.rows,
    options: options.rows,
    drafts: drafts.rows,
    redirects: redirects.rows,
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(seed, null, 2)}\n`, "utf8");
  console.log(`Exported catalogue seed to ${outputPath}`);
  console.log(`Products: ${seed.products.length}; enquiries exported: 0`);
} finally {
  await pool.end();
}