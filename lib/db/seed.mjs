import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

const seedPath = join(dirname(fileURLToPath(import.meta.url)), "seed", "catalogue.json");
const seed = JSON.parse(await readFile(seedPath, "utf8"));
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();

try {
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(hashtext('ih_catalogue_seed'))");

  const existing = await client.query("SELECT count(*)::integer AS count FROM ih_products");
  if (existing.rows[0].count > 0) {
    console.log(`Catalogue seed skipped: ih_products already contains ${existing.rows[0].count} records`);
    await client.query("COMMIT");
  } else {
    const categoryIds = new Map();
    const pendingCategories = [...seed.categories];

    while (pendingCategories.length > 0) {
      let insertedThisPass = 0;
      for (let index = pendingCategories.length - 1; index >= 0; index -= 1) {
        const category = pendingCategories[index];
        const parentId = category.sourceParentId === null
          ? null
          : categoryIds.get(category.sourceParentId);
        if (category.sourceParentId !== null && parentId === undefined) continue;

        const result = await client.query(
          `INSERT INTO ih_catalogue_categories
            (parent_id, slug, name, group_label, lead, page_heading, seo_title,
             seo_description, rainfall, image, sort_order, active)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
           ON CONFLICT ((COALESCE(parent_id, 0)), slug) DO UPDATE SET
             name=EXCLUDED.name, group_label=EXCLUDED.group_label, lead=EXCLUDED.lead,
             page_heading=EXCLUDED.page_heading, seo_title=EXCLUDED.seo_title,
             seo_description=EXCLUDED.seo_description, rainfall=EXCLUDED.rainfall,
             image=EXCLUDED.image, sort_order=EXCLUDED.sort_order, active=EXCLUDED.active
           RETURNING id`,
          [parentId, category.slug, category.name, category.groupLabel, category.lead,
            category.pageHeading, category.seoTitle, category.seoDescription,
            category.rainfall, category.image, category.sortOrder, category.active],
        );
        categoryIds.set(category.sourceId, result.rows[0].id);
        pendingCategories.splice(index, 1);
        insertedThisPass += 1;
      }
      if (insertedThisPass === 0) {
        throw new Error("Catalogue seed contains an unresolved category parent relationship");
      }
    }

    const categoryByPath = new Map();
    for (const category of seed.categories) {
      const parent = category.sourceParentId === null
        ? null
        : seed.categories.find((candidate) => candidate.sourceId === category.sourceParentId);
      categoryByPath.set(`${parent?.slug ?? ""}/${category.slug}`, categoryIds.get(category.sourceId));
    }

    const productIds = new Map();
    const listingByProductId = new Map();
    const saleLinesBySlug = new Map();
    for (const line of seed.saleLines) {
      const lines = saleLinesBySlug.get(line.productSlug) ?? [];
      lines.push(line);
      saleLinesBySlug.set(line.productSlug, lines);
    }
    const seedListingState = (product) => {
      if (product.listingState === "Legacy" || product.listingOverride === "Force legacy" || product.listingOverride === "Legacy") return "Legacy";
      if (product.listingState === "New") return "New";
      if (product.listingState === "Active" || product.listingOverride === "Force active" || product.listingOverride === "Active") return "Active";
      const lines = saleLinesBySlug.get(product.slug) ?? [];
      if (lines.length === 0) return "Active";
      return lines.some((line) => line.availability !== "Unavailable") ? "Active" : "Legacy";
    };
    for (const product of seed.products) {
      const subcategoryId = product.subcategorySlug
        ? categoryByPath.get(`${product.subcategoryParentSlug ?? ""}/${product.subcategorySlug}`) ?? null
        : null;
      const listingState = seedListingState(product);
      const result = await client.query(
        `INSERT INTO ih_products
          (name, slug, price, pack_size, status, note, category, subcategory_id,
           tech_sheet, guide_year, description_source, website_url_legacy,
           availability_override, listing_override, publish_status, published_at, details)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
         RETURNING id`,
        [product.name, product.slug, product.price, product.packSize, product.status,
          product.note, product.category, subcategoryId, product.techSheet,
          product.guideYear, product.descriptionSource, product.websiteUrlLegacy,
          listingState === "Legacy" ? null : product.availabilityOverride, listingState, product.publishStatus,
          product.publishedAt, product.details],
      );
      productIds.set(product.slug, result.rows[0].id);
      listingByProductId.set(result.rows[0].id, listingState);
    }

    for (const line of seed.saleLines) {
      const productId = productIds.get(line.productSlug);
      if (!productId) throw new Error(`Unknown product slug for sale line: ${line.productSlug}`);
      const availability = listingByProductId.get(productId) === "Legacy" ? "Unavailable" : line.availability;
      await client.query(
        `INSERT INTO ih_sale_lines
          (product_id, stock_code, seed_form, seed_grade, pack_kg, pack_unit,
           availability, price_display, is_default, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (stock_code) DO UPDATE SET
           product_id=EXCLUDED.product_id, seed_form=EXCLUDED.seed_form,
           seed_grade=EXCLUDED.seed_grade, pack_kg=EXCLUDED.pack_kg,
           pack_unit=EXCLUDED.pack_unit, availability=EXCLUDED.availability,
           price_display=EXCLUDED.price_display, is_default=EXCLUDED.is_default,
           sort_order=EXCLUDED.sort_order`,
        [productId, line.stockCode, line.seedForm, line.seedGrade, line.packKg,
          line.packUnit, availability, line.priceDisplay, line.isDefault, line.sortOrder],
      );
    }

    for (const option of seed.options) {
      await client.query(
        `INSERT INTO ih_product_options (list_name, value, sort_order)
         VALUES ($1,$2,$3)
         ON CONFLICT (list_name, value) DO UPDATE SET sort_order=EXCLUDED.sort_order`,
        [option.listName, option.value, option.sortOrder],
      );
    }

    for (const redirect of seed.redirects) {
      await client.query(
        `INSERT INTO ih_redirects (from_path, to_path) VALUES ($1,$2)
         ON CONFLICT (from_path) DO UPDATE SET to_path=EXCLUDED.to_path`,
        [redirect.fromPath, redirect.toPath],
      );
    }

    for (const draft of seed.drafts) {
      const productId = productIds.get(draft.productSlug);
      if (!productId) throw new Error(`Unknown product slug for draft: ${draft.productSlug}`);
      await client.query(
        `INSERT INTO ih_product_drafts (product_id, snapshot) VALUES ($1,$2)
         ON CONFLICT (product_id) DO UPDATE SET snapshot=EXCLUDED.snapshot, updated_at=now()`,
        [productId, draft.snapshot],
      );
    }

    await client.query("COMMIT");
    console.log(`Catalogue seed imported ${seed.products.length} products; enquiries imported: 0`);
  }
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}