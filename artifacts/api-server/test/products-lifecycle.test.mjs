import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createServer } from "node:net";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import xlsx from "xlsx";

const serverRoot = new URL("..", import.meta.url);
const testRunId = `${process.pid}-${Date.now()}`;
const createdProductIds = [];
let child;
let baseUrl;
let webChild;
let webBaseUrl;

async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : null;
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  assert.ok(port, "Expected the test port to be assigned");
  return port;
}

async function waitForServer() {
  let lastError;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`API server exited before becoming ready: ${lastError?.message ?? "unknown error"}`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/healthz`);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`API server did not become ready: ${lastError?.message ?? "unknown error"}`);
}

async function waitForWeb() {
  let lastError;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (webChild.exitCode !== null) {
      throw new Error(`Public web server exited before becoming ready: ${lastError?.message ?? "unknown error"}`);
    }
    try {
      const response = await fetch(webBaseUrl);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Public web server did not become ready: ${lastError?.message ?? "unknown error"}`);
}

async function stopChild(processToStop) {
  if (!processToStop || processToStop.exitCode !== null) return;
  processToStop.kill("SIGTERM");
  await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      processToStop.kill("SIGKILL");
      resolve();
    }, 2_000);
    processToStop.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

async function request(method, path, body) {
  const response = await fetch(`${baseUrl}/api${path}`, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = text;
  }
  return { response, data };
}

function assertStatus(result, status) {
  assert.equal(result.response.status, status, JSON.stringify(result.data));
  return result.data;
}

function sql(query) {
  return execFileSync("psql", [process.env.DATABASE_URL, "-X", "-v", "ON_ERROR_STOP=1", "-At", "-F", "\t", "-c", query], {
    encoding: "utf8",
  }).trim();
}

function runMigrations() {
  execFileSync(process.execPath, ["./migrate.mjs"], {
    cwd: new URL("../../../lib/db", import.meta.url),
    env: process.env,
    encoding: "utf8",
  });
}

function draftPayload(product, overrides = {}) {
  return {
    name: overrides.name ?? product.name,
    price: overrides.price ?? product.price,
    packSize: overrides.packSize ?? product.packSize,
    status: overrides.status ?? product.status,
    note: overrides.note ?? product.note,
    category: overrides.category ?? product.category,
    subcategoryId: overrides.subcategoryId ?? product.subcategoryId ?? null,
    techSheet: overrides.techSheet ?? product.techSheet,
    listingState: overrides.listingState ?? product.listingState ?? "Active",
    details: overrides.details ?? product.details,
    saleLines: overrides.saleLines ?? product.saleLines ?? [],
  };
}

function insertLeftoverDraft(product, overrides = {}) {
  const snapshot = draftPayload(product, overrides);
  if (overrides.omitSaleLines) delete snapshot.saleLines;
  const encoded = JSON.stringify(snapshot).replaceAll("'", "''");
  sql(`
    INSERT INTO ih_product_drafts (product_id, snapshot)
    VALUES (${product.id}, '${encoded}'::jsonb)
    ON CONFLICT (product_id) DO UPDATE SET snapshot = EXCLUDED.snapshot, updated_at = now()
  `);
}

async function createProduct(label, overrides = {}) {
  const slug = `lifecycle-test-${testRunId}-${label}`;
  const product = assertStatus(await request("POST", "/products", {
    name: `Lifecycle test ${testRunId} ${label}`,
    slug,
    price: "$30.00 per kg",
    packSize: "25 kg bag",
    status: "in-stock",
    note: "Lifecycle test record",
    category: overrides.category ?? "Automated tests",
    subcategoryId: overrides.subcategoryId ?? null,
    techSheet: "",
    details: { recordType: "Variety" },
  }), 201);
  createdProductIds.push(product.id);
  return assertStatus(await request("POST", `/admin/products/${product.id}/draft`, draftPayload(product, {
    details: {
      ...product.details,
      tagline: "Lifecycle test tagline",
      blurb: "Lifecycle test blurb",
      keyAttributes: ["Lifecycle tested"],
      distributionNote: "Distributed for lifecycle tests.",
      description: "Lifecycle test product description.",
      seoTitle: "Lifecycle test SEO title",
      seoDescription: "Lifecycle test SEO description.",
    },
  })), 200);
}

async function adminProduct(id) {
  return assertStatus(await request("GET", `/admin/products/${id}`), 200);
}

async function publicProducts() {
  return assertStatus(await request("GET", "/products"), 200);
}

async function availability() {
  return assertStatus(await request("GET", "/availability"), 200);
}

function includesProduct(products, id) {
  return products.some((product) => product.id === id);
}

test("committed workbook products keep valid lifecycle boundaries and drafts remain private", async (t) => {
  const source = await readFile(new URL("../../../attached_assets/0_IH_Seeds_-_Product_Data_Workbook_(pre-filled)_-_description_1788757020628.xlsx", import.meta.url));
  const workbook = xlsx.read(source);
  const workbookSlugs = xlsx.utils.sheet_to_json(workbook.Sheets["1 Products"], { defval: "", raw: false })
    .map((row) => String(row.slug ?? "")).filter(Boolean);
  const quotedSlugs = workbookSlugs.map((slug) => `'${slug.replaceAll("'", "''")}'`).join(", ");
  const importedTotal = Number(sql(`SELECT COUNT(*) FROM ih_products WHERE slug IN (${quotedSlugs})`));
  if (importedTotal !== workbookSlugs.length) {
    t.skip("Catalogue workbook has not been committed in this environment yet");
    return;
  }
  const invalidLifecycleCount = Number(sql(`
    SELECT COUNT(*)
    FROM ih_products
    WHERE slug IN (${quotedSlugs})
      AND publish_status NOT IN ('Published', 'Draft')
  `));
  assert.equal(invalidLifecycleCount, 0);
  const draftIds = new Set(sql(`SELECT id FROM ih_products WHERE slug IN (${quotedSlugs}) AND publish_status = 'Draft'`)
    .split("\n").filter(Boolean).map(Number));
  assert.equal((await publicProducts()).some((product) => draftIds.has(product.id)), false);
});

test("redirect lookup returns JSON while the legacy public route emits the HTTP redirect", async () => {
  const expectedRedirects = new Map([
    ["/product/souwest-pasture-mix-2", "/products/mixes/souwest-pasture-mix"],
    ["/product/avalon-persistent-perennial-ryegrass", "/products/ryegrass"],
    ["/product/hard-seeded-persian-clover", "/products/clovers"],
    ["/product/soft-seeded-persian-clover", "/products/clovers"],
    ["/product/icon-lucerne", "/products/lucerne"],
    ["/product/anywhere-tall-fescue", "/products/fescues-other-grasses"],
    ["/product/nemnuke-biofumigant", "/products/forage-grain-crops"],
    ["/product/parafield-peas", "/products/forage-grain-crops"],
  ]);
  const categories = assertStatus(await request("GET", "/categories"), 200);
  const rootByName = new Map(categories.filter((category) => category.parentId === null).map((category) => [category.name, category.slug]));
  for (const [fromPath, toPath] of expectedRedirects) {
    const slug = fromPath.slice("/product/".length);
    const live = sql(`
      SELECT category
      FROM ih_products
      WHERE slug = '${slug.replaceAll("'", "''")}'
        AND publish_status = 'Published'
        AND listing_override = 'Active'
    `).trim();
    const lookup = assertStatus(await request("GET", `/redirects/lookup?fromPath=${encodeURIComponent(fromPath)}`), 200);
    if (live) {
      assert.deepEqual(lookup, { toPath: `/products/${rootByName.get(live)}/${slug}` });
      continue;
    }
    assert.deepEqual(lookup, { toPath });
  }
  assertStatus(await request("GET", "/redirects/lookup?fromPath=%2Fproduct%2Fnot-registered"), 404);

  const redirect = await fetch(`${baseUrl}/product/souwest-pasture-mix-2`, { redirect: "manual" });
  assert.equal(redirect.status, 301);
  assert.equal(redirect.headers.get("location"), "/products/mixes/souwest-pasture-mix");

  assert.equal(Number(sql(`
    SELECT COUNT(*)
    FROM ih_products
    WHERE (slug, website_url_legacy) IN (
      ('souwest-pasture-mix', 'https://irwinhunter.com.au/product/souwest-pasture-mix-2/'),
      ('avalon-persistent-perennial-ryegrass', 'https://irwinhunter.com.au/product/avalon-persistent-perennial-ryegrass/'),
      ('hard-seeded-persian-clover', 'https://irwinhunter.com.au/product/hard-seeded-persian-clover/'),
      ('icon-lucerne', 'https://irwinhunter.com.au/product/icon-lucerne/'),
      ('anywhere-tall-fescue', 'https://irwinhunter.com.au/product/anywhere-tall-fescue/'),
      ('nemnuke-biofumigant', 'https://irwinhunter.com.au/product/nemnuke-biofumigant/'),
      ('parafield-peas', 'https://irwinhunter.com.au/product/parafield-peas/')
    )
  `)), 7);
  assert.ok(Number(sql(`
    SELECT COUNT(*)
    FROM ih_products
    WHERE website_url_legacy LIKE 'https://irwinhunter.com.au/product/%'
  `)) >= 77);
});

test("sitemap contains only canonical Active Published product paths", async () => {
  const publicCatalogue = await publicProducts();
  const categories = assertStatus(await request("GET", "/categories"), 200);
  const rootByName = new Map(categories.filter((category) => category.parentId === null).map((category) => [category.name, category.slug]));
  const categorySlug = (product) => rootByName.get(product.category)
    || product.category.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    || "catalogue";
  const response = await fetch(`${baseUrl}/api/sitemap-products`);
  assert.equal(response.status, 200);
  const xml = await response.text();
  const locations = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
  assert.deepEqual(
    locations.sort(),
    publicCatalogue.map((product) => `/products/${categorySlug(product)}/${encodeURIComponent(product.slug)}`).sort(),
  );
});

test("drafts require only identity fields while publishing requires public catalogue fields", async () => {
  const incompleteDraft = await request("POST", "/products", {
    name: `Incomplete lifecycle draft ${testRunId}`,
    slug: "",
    price: "",
    packSize: "",
    status: "in-stock",
    note: "",
    category: "",
    techSheet: "",
  });
  assertStatus(incompleteDraft, 400);
  assert.match(incompleteDraft.data.error, /Slug/);
  assert.match(incompleteDraft.data.error, /Category/);
  assert.match(incompleteDraft.data.error, /Record type/);

  const slug = `minimal-lifecycle-draft-${testRunId}`;
  const product = assertStatus(await request("POST", "/products", {
    name: `Minimal lifecycle draft ${testRunId}`,
    slug,
    price: "",
    packSize: "",
    status: "in-stock",
    note: "",
    category: "Automated tests",
    techSheet: "",
    details: {
      recordType: "Variety",
    },
  }), 201);
  createdProductIds.push(product.id);

  assert.equal(product.publishStatus, "Draft");
  assert.equal(product.slug, slug);
  assert.equal(includesProduct(await publicProducts(), product.id), false);

  const missingDraftCategory = await request("POST", `/admin/products/${product.id}/draft`, draftPayload(product, {
    category: "",
  }));
  assertStatus(missingDraftCategory, 400);
  assert.match(missingDraftCategory.data.error, /Category/);

  const missingDraftRecordType = await request("POST", `/admin/products/${product.id}/draft`, draftPayload(product, {
    details: { ...product.details, recordType: "" },
  }));
  assertStatus(missingDraftRecordType, 400);
  assert.match(missingDraftRecordType.data.error, /Record type/);

  const publishResult = await request("POST", `/admin/products/${product.id}/publish`);
  assertStatus(publishResult, 400);
  assert.match(publishResult.data.error, /Tagline/);
  assert.match(publishResult.data.error, /Blurb/);
  assert.match(publishResult.data.error, /Key attributes/);
  assert.match(publishResult.data.error, /Product description/);
  assert.match(publishResult.data.error, /SEO title/);
  assert.match(publishResult.data.error, /SEO description/);
  assert.deepEqual(
    publishResult.data.issues.map((issue) => issue.field),
    [
      "details.tagline",
      "details.blurb",
      "details.keyAttributes",
      "details.description",
      "details.seoTitle",
      "details.seoDescription",
    ],
  );
});

test("draft saves persist sale lines without making the product public", async () => {
  const product = await createProduct("sale-lines-draft");
  const saleLines = [{
    stockCode: `life-${testRunId}`,
    seedForm: "",
    seedGrade: "",
    packKg: 25,
    packUnit: "kg",
    availability: "Good stock",
    priceDisplay: "Contact for pricing",
    isDefault: true,
    sortOrder: 0,
  }];
  const saved = assertStatus(await request("POST", `/admin/products/${product.id}/draft`, draftPayload(product, {
    saleLines,
  })), 200);
  assert.equal(saved.saleLines.length, 1);
  assert.equal(saved.saleLines[0].stockCode, saleLines[0].stockCode);
  assert.equal(includesProduct(await publicProducts(), product.id), false);

  const published = assertStatus(await request("POST", `/admin/products/${product.id}/publish`), 200);
  assert.equal(published.saleLines[0].stockCode, saleLines[0].stockCode);
  assert.equal((await publicProducts()).find((item) => item.id === product.id).saleLines[0].stockCode, saleLines[0].stockCode);
});

test("leftover drafts that omit sale lines keep live pack sizes on publish and restore", async () => {
  const product = await createProduct("leftover-sale-lines");
  const saleLines = [{
    stockCode: `keep-${testRunId}`,
    seedForm: "",
    seedGrade: "",
    packKg: 25,
    packUnit: "kg",
    availability: "Good stock",
    priceDisplay: "Contact for pricing",
    isDefault: true,
    sortOrder: 0,
  }];
  assertStatus(await request("POST", `/admin/products/${product.id}/draft`, draftPayload(product, {
    saleLines,
  })), 200);
  const published = assertStatus(await request("POST", `/admin/products/${product.id}/publish`), 200);
  assert.equal(published.saleLines[0].stockCode, saleLines[0].stockCode);

  const leftoverPublishName = `Leftover publish ${testRunId}`;
  insertLeftoverDraft(published, { name: leftoverPublishName, omitSaleLines: true });
  const republished = assertStatus(await request("POST", `/admin/products/${product.id}/publish`), 200);
  assert.equal(republished.name, leftoverPublishName);
  assert.equal(republished.saleLines.length, 1);
  assert.equal(republished.saleLines[0].stockCode, saleLines[0].stockCode);
  assert.equal((await publicProducts()).find((item) => item.id === product.id).saleLines[0].stockCode, saleLines[0].stockCode);

  const leftoverRestoreName = `Leftover restore ${testRunId}`;
  insertLeftoverDraft(republished, { name: leftoverRestoreName, omitSaleLines: true });
  assertStatus(await request("POST", `/admin/products/${product.id}/archive`), 200);
  const restored = assertStatus(await request("POST", `/admin/products/${product.id}/restore`), 200);
  assert.equal(restored.lifecycleStatus, "Draft");
  assert.equal(restored.name, leftoverRestoreName);
  assert.equal(restored.saleLines.length, 1);
  assert.equal(restored.saleLines[0].stockCode, saleLines[0].stockCode);
});

test("leftover catalogue redirects do not hide a restored Active product page", async () => {
  const product = await createProduct("legacy-redirect");
  const published = assertStatus(await request("POST", `/admin/products/${product.id}/publish`), 200);
  const fromPath = `/product/${published.slug}`;
  const toPath = "/products/forage-grain-crops";
  sql(`
    INSERT INTO ih_redirects (from_path, to_path)
    VALUES ('${fromPath.replaceAll("'", "''")}', '${toPath}')
    ON CONFLICT (from_path) DO UPDATE SET to_path = EXCLUDED.to_path, updated_at = now()
  `);
  const liveLookup = assertStatus(await request("GET", `/redirects/lookup?fromPath=${encodeURIComponent(fromPath)}`), 200);
  assert.equal(liveLookup.toPath.startsWith("/products/"), true);
  assert.equal(liveLookup.toPath.endsWith(`/${published.slug}`), true);
  assert.equal((await publicProducts()).some((item) => item.slug === published.slug), true);

  assertStatus(await request("POST", `/admin/products/${published.id}/publish`, draftPayload(published, {
    listingState: "Legacy",
  })), 200);
  assert.deepEqual(
    assertStatus(await request("GET", `/redirects/lookup?fromPath=${encodeURIComponent(fromPath)}`), 200),
    { toPath },
  );
  sql(`DELETE FROM ih_redirects WHERE from_path = '${fromPath.replaceAll("'", "''")}'`);
});

test("manual listing state takes precedence over sale-line availability", async () => {
  const product = await createProduct("listing-state");
  const saleLines = [{
    stockCode: `list-${testRunId}`,
    seedForm: "",
    seedGrade: "",
    packKg: 25,
    packUnit: "kg",
    availability: "Unavailable",
    priceDisplay: "Contact for pricing",
    isDefault: true,
    sortOrder: 0,
  }];
  assertStatus(await request("POST", `/admin/products/${product.id}/draft`, draftPayload(product, {
    listingState: "Active",
    saleLines,
  })), 200);
  assertStatus(await request("POST", `/admin/products/${product.id}/publish`), 200);
  assert.equal(includesProduct(await publicProducts(), product.id), true);

  const legacy = assertStatus(await request("POST", `/admin/products/${product.id}/publish`, draftPayload(product, {
    listingState: "Legacy",
    saleLines: [{ ...saleLines[0], availability: "Good stock" }],
  })), 200);
  assert.equal(legacy.listingState, "Legacy");
  assert.equal(legacy.saleLines[0].availability, "Unavailable");
  assert.equal(includesProduct(await publicProducts(), product.id), false);
  assert.equal(includesProduct(await availability(), product.id), false);
  const names = assertStatus(await request("GET", `/products/category/${encodeURIComponent(product.category)}/legacy`), 200);
  assert.equal(names.some((item) => item.name === product.name), true);
});

test("inactive taxonomy cannot be newly assigned but an existing assignment remains publishable", async () => {
  const suffix = `inactive-category-${testRunId}`;
  const categoryInput = (slug, active = true) => ({
    parentId: null, slug, name: slug, groupLabel: "Automated tests", lead: "", rainfall: "", image: "", sortOrder: 999, active,
  });
  const retained = assertStatus(await request("POST", "/admin/categories", categoryInput(`${suffix}-retained`)), 201);
  const blocked = assertStatus(await request("POST", "/admin/categories", categoryInput(`${suffix}-blocked`)), 201);
  const retainedProduct = await createProduct("inactive-retained", { subcategoryId: retained.id });
  const pendingProduct = await createProduct("inactive-pending");
  try {
    assertStatus(await request("POST", `/admin/products/${retainedProduct.id}/publish`), 200);
    assertStatus(await request("PATCH", `/admin/categories/${retained.id}`, { active: false }), 200);
    assertStatus(await request("POST", `/admin/products/${retainedProduct.id}/publish`, draftPayload(retainedProduct, {
      name: `Inactive retained revision ${testRunId}`,
      subcategoryId: retained.id,
    })), 200);

    assertStatus(await request("POST", `/products`, {
      name: `Inactive blocked ${testRunId}`, slug: `${suffix}-blocked-product`, price: "", packSize: "",
      status: "in-stock", note: "", category: "", subcategoryId: retained.id, techSheet: "",
    }), 400);
    assertStatus(await request("POST", `/admin/products/${pendingProduct.id}/draft`, draftPayload(pendingProduct, {
      subcategoryId: blocked.id,
    })), 200);
    assertStatus(await request("PATCH", `/admin/categories/${blocked.id}`, { active: false }), 200);
    assertStatus(await request("POST", `/admin/products/${pendingProduct.id}/publish`), 400);
  } finally {
    await request("DELETE", `/products/${retainedProduct.id}`);
    await request("DELETE", `/products/${pendingProduct.id}`);
    await request("DELETE", `/admin/categories/${retained.id}`);
    await request("DELETE", `/admin/categories/${blocked.id}`);
  }
});

test("renaming a root taxonomy category updates assigned product and draft labels atomically", async () => {
  const suffix = `rename-category-${testRunId}`;
  const root = assertStatus(await request("POST", "/admin/categories", {
    parentId: null, slug: `${suffix}-root`, name: `Original root ${testRunId}`, groupLabel: "Automated tests",
    lead: "", rainfall: "", image: "", sortOrder: 999, active: true,
  }), 201);
  const child = assertStatus(await request("POST", "/admin/categories", {
    parentId: root.id, slug: `${suffix}-child`, name: `Child ${testRunId}`, groupLabel: "Automated tests",
    lead: "", rainfall: "", image: "", sortOrder: 999, active: true,
  }), 201);
  const rootProduct = await createProduct("rename-root", { subcategoryId: root.id });
  const childProduct = await createProduct("rename-child", { subcategoryId: child.id });
  try {
    assertStatus(await request("POST", `/admin/products/${rootProduct.id}/publish`), 200);
    assertStatus(await request("POST", `/admin/products/${childProduct.id}/publish`), 200);

    const renamed = `Renamed root ${testRunId}`;
    assertStatus(await request("PATCH", `/admin/categories/${root.id}`, { name: renamed }), 200);
    assert.equal((await adminProduct(rootProduct.id)).category, renamed);
    const childAdmin = await adminProduct(childProduct.id);
    assert.equal(childAdmin.category, renamed);
    assert.equal(childAdmin.draft, null);
  } finally {
    await request("DELETE", `/products/${rootProduct.id}`);
    await request("DELETE", `/products/${childProduct.id}`);
    await request("DELETE", `/admin/categories/${child.id}`);
    await request("DELETE", `/admin/categories/${root.id}`);
  }
});

test("the one-time migration corrects legacy published seed categories without changing lifecycle state", async () => {
  const expected = new Map([
    ["silahay-mix", { name: "Silahay™ Mix", category: "Specialty Mixes" }],
    ["self-regeneration-pasture-mix", { name: "Self Regeneration Pasture Mix", category: "Specialty Mixes" }],
    ["ceres-pg-one50-ryegrass", { name: "Ceres PG One50 Ryegrass", category: "Ryegrasses" }],
    ["margurita-french-serradella", { name: "Margurita French Serradella", category: "Serradellas & Medics" }],
    ["sardi-seven-lucerne", { name: "SARDI Seven Lucerne", category: "Lucerne" }],
    ["dalkeith-subterranean-clover", { name: "Dalkeith Subterranean Clover", category: "Clovers" }],
  ]);
  const slugs = [...expected.keys()];
  const quotedSlugs = slugs.map((slug) => `'${slug.replaceAll("'", "''")}'`).join(", ");
  const originalRows = sql(`
    SELECT slug, name, category, publish_status
    FROM ih_products
    WHERE slug IN (${quotedSlugs})
    ORDER BY slug
  `).split("\n").filter(Boolean).map((row) => row.split("\t"));
  assert.equal(originalRows.length, expected.size);

  try {
    for (const [slug, fixture] of expected) {
      sql(`
        UPDATE ih_products
        SET name = '${fixture.name.replaceAll("'", "''")}'
        WHERE slug = '${slug.replaceAll("'", "''")}'
      `);
    }
    sql(`
      UPDATE ih_products
      SET category = 'Other'
      WHERE slug IN (${quotedSlugs})
        AND publish_status = 'Published'
        AND NOT EXISTS (
          SELECT 1 FROM ih_product_drafts d WHERE d.product_id = ih_products.id
        )
    `);
    sql(`DELETE FROM ih_schema_migrations WHERE name = '0002_correct_catalogue_categories.sql'`);
    runMigrations();

    const products = await publicProducts();
    for (const [slug, fixture] of expected) {
      const product = products.find((item) => item.slug === slug);
      assert.ok(product, `Expected ${slug} in the public catalogue`);
      assert.equal(product.category, fixture.category);
      assert.equal(sql(`SELECT publish_status FROM ih_products WHERE id = ${product.id}`), "Published");
    }
  } finally {
    for (const [slug, name, category, publishStatus] of originalRows) {
      sql(`
        UPDATE ih_products
        SET name = '${name.replaceAll("'", "''")}',
            category = '${category.replaceAll("'", "''")}'
        WHERE slug = '${slug.replaceAll("'", "''")}'
          AND publish_status = '${publishStatus.replaceAll("'", "''")}'
      `);
    }
  }
});

test("a later published category choice for a seed product is not reverted", async () => {
  const publicProduct = (await publicProducts()).find((item) => item.slug === "ceres-pg-one50-ryegrass");
  assert.ok(publicProduct);
  const product = await adminProduct(publicProduct.id);
  const otherCategory = assertStatus(await request("GET", "/categories"), 200)
    .find((category) => category.slug === "other");
  assert.ok(otherCategory);
  const timestamps = sql(`
    SELECT published_at::text, updated_at::text, COALESCE(subcategory_id::text, '')
    FROM ih_products
    WHERE id = ${product.id}
  `).split("\t");

  try {
    assertStatus(await request("POST", `/admin/products/${product.id}/publish`, draftPayload(product, {
      category: "Other",
      subcategoryId: otherCategory.id,
      details: {
        ...product.details,
        recordType: "Variety",
        tagline: "Migration regression tagline",
        blurb: "Migration regression blurb",
        keyAttributes: ["Regression tested"],
        distributionNote: "",
        description: "Migration regression test product description.",
        seoTitle: "Migration regression SEO title",
        seoDescription: "Migration regression SEO description.",
      },
    })), 200);
    runMigrations();

    const published = (await publicProducts()).find((item) => item.id === product.id);
    assert.ok(published);
    assert.equal(published.category, otherCategory.name);
    assert.equal(sql(`SELECT publish_status FROM ih_products WHERE id = ${product.id}`), "Published");
  } finally {
    sql(`
      DELETE FROM ih_product_drafts WHERE product_id = ${product.id};
      UPDATE ih_products
      SET category = '${product.category.replaceAll("'", "''")}',
          subcategory_id = ${timestamps[2] ? Number(timestamps[2]) : "NULL"},
          published_at = '${timestamps[0].replaceAll("'", "''")}'::timestamptz,
          updated_at = '${timestamps[1].replaceAll("'", "''")}'::timestamptz
      WHERE id = ${product.id}
    `);
  }
});

test("taxonomy slug migration redirects inactive children safely and singleton active children to their parent", () => {
  const rootSlug = `taxonomy-migration-${testRunId}`;
  const activeOldSlug = `${rootSlug}-pasture`;
  const inactiveOldSlug = `${rootSlug}-equine`;
  const inactiveParentSlug = `${rootSlug}-inactive-parent`;
  const inactiveParentChildOldSlug = `${inactiveParentSlug}-pasture`;
  const collisionRootSlug = `${rootSlug}-collision`;
  const collisionOldSlug = `${collisionRootSlug}-foo`;
  const rootId = Number(sql(`
    INSERT INTO ih_catalogue_categories (slug, name, group_label, active)
    VALUES ('${rootSlug}', 'Migration root ${testRunId}', 'Automated tests', true)
    RETURNING id
  `).split("\n")[0]);
  const activeId = Number(sql(`
    INSERT INTO ih_catalogue_categories (parent_id, slug, name, group_label, active)
    VALUES (${rootId}, '${activeOldSlug}', 'Pasture', 'Automated tests', true)
    RETURNING id
  `).split("\n")[0]);
  const inactiveId = Number(sql(`
    INSERT INTO ih_catalogue_categories (parent_id, slug, name, group_label, active)
    VALUES (${rootId}, '${inactiveOldSlug}', 'Equine', 'Automated tests', false)
    RETURNING id
  `).split("\n")[0]);
  const inactiveParentId = Number(sql(`
    INSERT INTO ih_catalogue_categories (slug, name, group_label, active)
    VALUES ('${inactiveParentSlug}', 'Inactive migration root ${testRunId}', 'Automated tests', false)
    RETURNING id
  `).split("\n")[0]);
  const inactiveParentChildId = Number(sql(`
    INSERT INTO ih_catalogue_categories (parent_id, slug, name, group_label, active)
    VALUES (${inactiveParentId}, '${inactiveParentChildOldSlug}', 'Pasture', 'Automated tests', true)
    RETURNING id
  `).split("\n")[0]);
  const collisionRootId = Number(sql(`
    INSERT INTO ih_catalogue_categories (slug, name, group_label, active)
    VALUES ('${collisionRootSlug}', 'Collision migration root ${testRunId}', 'Automated tests', true)
    RETURNING id
  `).split("\n")[0]);
  const canonicalCollisionChildId = Number(sql(`
    INSERT INTO ih_catalogue_categories (parent_id, slug, name, group_label, active)
    VALUES (${collisionRootId}, 'foo', 'Existing foo', 'Automated tests', true)
    RETURNING id
  `).split("\n")[0]);
  const normalizedCollisionChildId = Number(sql(`
    INSERT INTO ih_catalogue_categories (parent_id, slug, name, group_label, active)
    VALUES (${collisionRootId}, '${collisionOldSlug}', 'Prefixed foo', 'Automated tests', true)
    RETURNING id
  `).split("\n")[0]);
  try {
    sql(`DELETE FROM ih_schema_migrations WHERE name = '0011_normalize_taxonomy_child_slugs.sql'`);
    runMigrations();

    assert.equal(sql(`SELECT slug FROM ih_catalogue_categories WHERE id = ${activeId}`), "pasture");
    assert.equal(sql(`SELECT slug FROM ih_catalogue_categories WHERE id = ${inactiveId}`), "equine");
    assert.equal(sql(`SELECT slug FROM ih_catalogue_categories WHERE id = ${inactiveParentChildId}`), "pasture");
    assert.equal(sql(`SELECT slug FROM ih_catalogue_categories WHERE id = ${canonicalCollisionChildId}`), "foo");
    assert.equal(sql(`SELECT slug FROM ih_catalogue_categories WHERE id = ${normalizedCollisionChildId}`), "foo-2");
    assert.equal(
      sql(`SELECT to_path FROM ih_redirects WHERE from_path = '/products/${rootSlug}/${activeOldSlug}'`),
      `/products/${rootSlug}`,
    );
    assert.equal(
      sql(`SELECT to_path FROM ih_redirects WHERE from_path = '/products/${collisionRootSlug}/${collisionOldSlug}'`),
      `/products/${collisionRootSlug}/foo-2`,
    );
    assert.equal(
      sql(`SELECT to_path FROM ih_redirects WHERE from_path = '/products/${inactiveParentSlug}/${inactiveParentChildOldSlug}'`),
      "/products",
    );
    assert.equal(
      sql(`SELECT to_path FROM ih_redirects WHERE from_path = '/products/${rootSlug}/${inactiveOldSlug}'`),
      `/products/${rootSlug}`,
    );
  } finally {
    sql(`
      DELETE FROM ih_redirects
      WHERE from_path IN (
        '/products/${rootSlug}/${activeOldSlug}',
        '/products/${rootSlug}/${inactiveOldSlug}',
        '/products/${inactiveParentSlug}/${inactiveParentChildOldSlug}',
        '/products/${collisionRootSlug}/${collisionOldSlug}'
      );
      DELETE FROM ih_catalogue_categories WHERE id IN (
        ${activeId}, ${inactiveId}, ${inactiveParentChildId},
        ${canonicalCollisionChildId}, ${normalizedCollisionChildId}
      );
      DELETE FROM ih_catalogue_categories WHERE id = ${rootId};
      DELETE FROM ih_catalogue_categories WHERE id = ${inactiveParentId};
      DELETE FROM ih_catalogue_categories WHERE id = ${collisionRootId};
    `);
  }
});

test("category administration enforces nesting, activation, and deletion protection", async () => {
  const suffix = `category-test-${testRunId}`;
  const categoryInput = (slug, name, parentId = null) => ({
    parentId,
    slug,
    name,
    groupLabel: "Automated tests",
    lead: "Category API test",
    pageHeading: "",
    seoTitle: "",
    seoDescription: "",
    rainfall: "Any",
    image: "",
    sortOrder: 999,
    active: true,
  });
  const parent = assertStatus(await request("POST", "/admin/categories",
    categoryInput(`${suffix}-parent`, `Category parent ${testRunId}`)), 201);
  assert.deepEqual(parent.faqs, []);
  const child = assertStatus(await request("POST", "/admin/categories",
    categoryInput(`${suffix}-child`, `Category child ${testRunId}`, parent.id)), 201);
  try {
    assertStatus(await request("POST", "/admin/categories",
      categoryInput(`${suffix}-grandchild`, `Category grandchild ${testRunId}`, child.id)), 400);
    assertStatus(await request("POST", "/admin/categories",
      categoryInput(parent.slug, `Duplicate slug ${testRunId}`)), 409);
    const updatedSlug = `${suffix}-parent-updated`;
    const updated = assertStatus(await request("PATCH", `/admin/categories/${parent.id}`, {
      slug: updatedSlug,
      pageHeading: "Automated Category Seed",
      seoTitle: "Automated Category Seed | IH Seeds",
      seoDescription: "Editable category SEO description.",
    }), 200);
    assert.equal(updated.slug, updatedSlug);
    assert.equal(updated.pageHeading, "Automated Category Seed");
    assert.equal(updated.seoTitle, "Automated Category Seed | IH Seeds");
    assert.equal(updated.seoDescription, "Editable category SEO description.");
    const withFaqs = assertStatus(await request("PATCH", `/admin/categories/${parent.id}`, {
      faqs: [
        { question: "Can I buy seed direct?", answer: "We supply through rural resellers." },
        { question: "   ", answer: "Dropped empty question." },
        { question: "Is the seed tested?", answer: "Every line is germination and purity tested." },
      ],
    }), 200);
    assert.deepEqual(withFaqs.faqs, [
      { question: "Can I buy seed direct?", answer: "We supply through rural resellers." },
      { question: "Is the seed tested?", answer: "Every line is germination and purity tested." },
    ]);
    assert.deepEqual(
      assertStatus(await request("GET", `/redirects/lookup?fromPath=${encodeURIComponent(`/products/${parent.slug}`)}`), 200),
      { toPath: `/products/${updatedSlug}` },
    );
    const unrelatedUpdate = assertStatus(await request("PATCH", `/admin/categories/${parent.id}`, { active: false }), 200);
    assert.equal(unrelatedUpdate.pageHeading, "Automated Category Seed");
    assert.equal(unrelatedUpdate.seoTitle, "Automated Category Seed | IH Seeds");
    assert.equal(unrelatedUpdate.seoDescription, "Editable category SEO description.");
    assert.deepEqual(unrelatedUpdate.faqs, withFaqs.faqs);
    assertStatus(await request("PATCH", `/admin/categories/${parent.id}`, { active: true }), 200);
    const normalizedChild = assertStatus(await request("PATCH", `/admin/categories/${child.id}`, {
      slug: `${updatedSlug}-${suffix}-child-updated`,
    }), 200);
    assert.equal(normalizedChild.slug, `${suffix}-child-updated`);

    const product = await createProduct("category-draft-reference");
    assertStatus(await request("POST", `/admin/products/${product.id}/publish`, draftPayload(product, {
      subcategoryId: child.id,
    })), 200);
    assertStatus(await request("DELETE", `/admin/categories/${child.id}`), 409);

    assertStatus(await request("PATCH", `/admin/categories/${parent.id}`, { active: false }), 200);
    const publicCategories = assertStatus(await request("GET", "/categories"), 200);
    assert.equal(publicCategories.some((category) => category.id === parent.id), false);
    assert.equal(publicCategories.some((category) => category.id === child.id), false);
    assertStatus(await request("DELETE", `/admin/categories/${parent.id}`), 409);

    assertStatus(await request("DELETE", `/products/${product.id}`), 204);
    assertStatus(await request("DELETE", `/admin/categories/${child.id}`), 204);
    assertStatus(await request("DELETE", `/admin/categories/${parent.id}`), 204);
  } finally {
    // Deletes are intentionally best-effort because a prior assertion may have removed either row.
    await request("DELETE", `/admin/categories/${child.id}`);
    await request("DELETE", `/admin/categories/${parent.id}`);
  }
});

test("taxonomy deactivation redirects removed paths and moving a child updates live and draft root labels", async () => {
  const suffix = `taxonomy-routing-${testRunId}`;
  const categoryInput = (slug, name, parentId = null) => ({
    parentId, slug, name, groupLabel: "Automated tests", lead: "", rainfall: "", image: "",
    sortOrder: 999, active: true,
  });
  const redirectRoot = assertStatus(await request("POST", "/admin/categories",
    categoryInput(`${suffix}-redirect-root`, `Redirect root ${testRunId}`)), 201);
  const removedChild = assertStatus(await request("POST", "/admin/categories",
    categoryInput(`${suffix}-removed`, "Removed child", redirectRoot.id)), 201);
  const retainedChild = assertStatus(await request("POST", "/admin/categories",
    categoryInput(`${suffix}-retained`, "Retained child", redirectRoot.id)), 201);
  const sourceRoot = assertStatus(await request("POST", "/admin/categories",
    categoryInput(`${suffix}-source`, `Source root ${testRunId}`)), 201);
  const destinationRoot = assertStatus(await request("POST", "/admin/categories",
    categoryInput(`${suffix}-destination`, `Destination root ${testRunId}`)), 201);
  const movedChild = assertStatus(await request("POST", "/admin/categories",
    categoryInput(`${suffix}-moved`, "Moved child", sourceRoot.id)), 201);
  const product = await createProduct("taxonomy-move", { subcategoryId: movedChild.id });
  try {
    assertStatus(await request("PATCH", `/admin/categories/${removedChild.id}`, { active: false }), 200);
    assert.deepEqual(
      assertStatus(await request("GET", `/redirects/lookup?fromPath=${encodeURIComponent(`/products/${redirectRoot.slug}/${removedChild.slug}`)}`), 200),
      { toPath: `/products/${redirectRoot.slug}` },
    );
    assert.equal((await request("GET", "/categories")).data.some((category) => category.id === removedChild.id), false);

    assertStatus(await request("PATCH", `/admin/categories/${redirectRoot.id}`, { active: false }), 200);
    assert.deepEqual(
      assertStatus(await request("GET", `/redirects/lookup?fromPath=${encodeURIComponent(`/products/${redirectRoot.slug}`)}`), 200),
      { toPath: "/products" },
    );

    assertStatus(await request("POST", `/admin/products/${product.id}/publish`), 200);
    assertStatus(await request("PATCH", `/admin/categories/${movedChild.id}`, { parentId: destinationRoot.id }), 200);
    const categories = assertStatus(await request("GET", "/categories"), 200);
    assert.equal(categories.find((category) => category.id === movedChild.id)?.parentId, destinationRoot.id);
    assert.deepEqual(
      assertStatus(await request("GET", `/redirects/lookup?fromPath=${encodeURIComponent(`/products/${sourceRoot.slug}/${movedChild.slug}`)}`), 200),
      { toPath: `/products/${destinationRoot.slug}` },
    );
    assertStatus(await request("GET", `/redirects/lookup?fromPath=${encodeURIComponent(`/products/${sourceRoot.slug}`)}`), 404);
    const movedProduct = await adminProduct(product.id);
    assert.equal(movedProduct.category, destinationRoot.name);
    assert.equal(movedProduct.draft, null);
    assert.deepEqual(
      assertStatus(await request("GET", `/redirects/lookup?fromPath=${encodeURIComponent(`/products/${sourceRoot.slug}/${movedProduct.slug}`)}`), 200),
      { toPath: `/products/${destinationRoot.slug}/${movedProduct.slug}` },
    );

    assertStatus(await request("PATCH", `/admin/categories/${movedChild.id}`, { parentId: null }), 200);
    const promotedCategories = assertStatus(await request("GET", "/categories"), 200);
    assert.equal(promotedCategories.find((category) => category.id === movedChild.id)?.parentId, null);
    assert.deepEqual(
      assertStatus(await request("GET", `/redirects/lookup?fromPath=${encodeURIComponent(`/products/${destinationRoot.slug}/${movedChild.slug}`)}`), 200),
      { toPath: `/products/${movedChild.slug}` },
    );
    assertStatus(await request("GET", `/redirects/lookup?fromPath=${encodeURIComponent(`/products/${destinationRoot.slug}`)}`), 404);
    const promotedProduct = await adminProduct(product.id);
    assert.equal(promotedProduct.category, movedChild.name);
    assert.equal(promotedProduct.draft, null);
  } finally {
    await request("DELETE", `/products/${product.id}`);
    for (const category of [removedChild, retainedChild, movedChild, redirectRoot, sourceRoot, destinationRoot]) {
      await request("DELETE", `/admin/categories/${category.id}`);
    }
  }
});

test("deleting taxonomy preserves removed and sibling canonical paths", async () => {
  const suffix = `taxonomy-delete-${testRunId}`;
  const categoryInput = (slug, name, parentId = null) => ({
    parentId, slug, name, groupLabel: "Automated tests", lead: "", rainfall: "", image: "",
    sortOrder: 999, active: true,
  });
  const root = assertStatus(await request("POST", "/admin/categories",
    categoryInput(`${suffix}-root`, `Delete root ${testRunId}`)), 201);
  const deletedChild = assertStatus(await request("POST", "/admin/categories",
    categoryInput(`${suffix}-deleted`, "Deleted child", root.id)), 201);
  const survivingChild = assertStatus(await request("POST", "/admin/categories",
    categoryInput(`${suffix}-surviving`, "Surviving child", root.id)), 201);
  try {
    assertStatus(await request("DELETE", `/admin/categories/${deletedChild.id}`), 204);
    assert.deepEqual(
      assertStatus(await request("GET", `/redirects/lookup?fromPath=${encodeURIComponent(`/products/${root.slug}/${deletedChild.slug}`)}`), 200),
      { toPath: `/products/${root.slug}` },
    );
    assert.deepEqual(
      assertStatus(await request("GET", `/redirects/lookup?fromPath=${encodeURIComponent(`/products/${root.slug}/${survivingChild.slug}`)}`), 200),
      { toPath: `/products/${root.slug}` },
    );

    assertStatus(await request("DELETE", `/admin/categories/${survivingChild.id}`), 204);
    assertStatus(await request("DELETE", `/admin/categories/${root.id}`), 204);
    assert.deepEqual(
      assertStatus(await request("GET", `/redirects/lookup?fromPath=${encodeURIComponent(`/products/${root.slug}`)}`), 200),
      { toPath: "/products" },
    );
  } finally {
    await request("DELETE", `/admin/categories/${deletedChild.id}`);
    await request("DELETE", `/admin/categories/${survivingChild.id}`);
    await request("DELETE", `/admin/categories/${root.id}`);
  }
});

test("root category slug categories is reserved for the catalogue index", async () => {
  const created = await request("POST", "/admin/categories", {
    parentId: null,
    slug: "categories",
    name: "Categories",
    groupLabel: "Automated tests",
    lead: "",
    rainfall: "",
    image: "",
    sortOrder: 999,
    active: true,
  });
  assert.equal(created.response.status, 400);
  assert.match(JSON.stringify(created.data), /reserved for the catalogue index/i);
});

before(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for lifecycle API tests");
  }
  const port = await freePort();
  baseUrl = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ["--enable-source-maps", "./dist/index.mjs"], {
    cwd: new URL(serverRoot).pathname,
    env: { ...process.env, NODE_ENV: "test", PORT: String(port), AI_EXTRACT_STUB: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  child.on("exit", (code, signal) => {
    if (code !== 0 && code !== null) {
      stderr = `${stderr}\n(exit code ${code}, signal ${signal ?? "none"})`;
    }
  });
  await waitForServer().catch((error) => {
    throw new Error(`${error.message}\n${stderr}`);
  });

  execFileSync("pnpm", ["--filter", "@workspace/web", "run", "build"], {
    cwd: new URL("../../..", import.meta.url),
    env: { ...process.env, API_BASE: baseUrl },
    encoding: "utf8",
  });
  const webPort = await freePort();
  webBaseUrl = `http://127.0.0.1:${webPort}`;
  webChild = spawn("pnpm", ["--dir", "artifacts/web", "exec", "next", "start", "-p", String(webPort)], {
    cwd: new URL("../../..", import.meta.url),
    env: { ...process.env, API_BASE: baseUrl },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let webStderr = "";
  webChild.stderr.setEncoding("utf8");
  webChild.stderr.on("data", (chunk) => {
    webStderr += chunk;
  });
  await waitForWeb().catch((error) => {
    throw new Error(`${error.message}\n${webStderr}`);
  });
});

after(async () => {
  for (const id of createdProductIds) {
    await request("DELETE", `/products/${id}`);
  }
  await stopChild(webChild);
  await stopChild(child);
});

test("catalogue lifecycle transition matrix protects public content", async () => {
  const product = await createProduct("matrix");

  assert.equal(product.publishStatus, "Draft");
  assert.equal(includesProduct(await publicProducts(), product.id), false);
  assert.equal(includesProduct(await availability(), product.id), false);

  const invalidDetails = {
    ...product.details,
    components: [{
      productLink: `missing-product-${testRunId}`,
      speciesName: "Unknown",
      inclusionRate: null,
      unit: "%",
      note: "",
    }],
  };
  assertStatus(await request("POST", `/products/${product.id + 999999}/draft`, draftPayload(product)), 404);
  assertStatus(await request("POST", "/products", {
    name: `Lifecycle invalid reference ${testRunId}`,
    slug: `lifecycle-invalid-${testRunId}`,
    price: product.price,
    packSize: product.packSize,
    status: product.status,
    note: product.note,
    category: product.category,
    techSheet: product.techSheet,
    details: invalidDetails,
  }), 400);
  assertStatus(await request("POST", `/admin/products/${product.id}/draft`, draftPayload(product, {
    details: invalidDetails,
  })), 400);

  const published = assertStatus(await request("POST", `/admin/products/${product.id}/publish`), 200);
  assert.equal(published.lifecycleStatus, "Published");
  assert.equal(published.hasDraft, false);
  const publicProduct = (await publicProducts()).find((item) => item.id === product.id);
  assert.ok(publicProduct);
  assert.equal(publicProduct.listingState, "Active");
  assert.equal(publicProduct.category, "Automated tests");
  for (const adminOnly of ["descriptionSource", "websiteUrlLegacy", "availabilityOverride", "listingOverride", "publishStatus", "publishedAt", "createdAt", "updatedAt"]) {
    assert.equal(adminOnly in publicProduct, false, `Public product exposed ${adminOnly}`);
  }
   assert.equal("notes" in publicProduct.details, false, "Public product exposed internal notes");
   assert.equal("bredByOrigin" in publicProduct.details, false, "Public product exposed breeder provenance");
   assert.equal("supplierName" in publicProduct.details, false, "Public product exposed supplier identity");
   assert.equal(publicProduct.details.tagline, "Lifecycle test tagline");
   assert.equal(publicProduct.details.blurb, "Lifecycle test blurb");
   assert.deepEqual(publicProduct.details.keyAttributes, ["Lifecycle tested"]);
   assert.equal(publicProduct.details.distributionNote, "Distributed for lifecycle tests.");
  assert.equal(includesProduct(await availability(), product.id), true);
  const originalRenderedPage = await fetch(`${webBaseUrl}/product/${product.slug}`);
  assert.equal(originalRenderedPage.status, 200);
  assert.match(await originalRenderedPage.text(), /Lifecycle test blurb/);

  const revisionName = `Lifecycle revision ${testRunId}`;
  const revisionBlurb = `Latest editor blurb ${testRunId}`;
  const parkedDraft = await request("POST", `/admin/products/${product.id}/draft`, draftPayload(product, {
    name: revisionName,
    details: { ...product.details, blurb: revisionBlurb },
  }));
  assertStatus(parkedDraft, 409);
  assert.match(parkedDraft.data.error, /cannot be saved as drafts/i);
  assert.equal((await publicProducts()).find((item) => item.id === product.id).name, product.name);

  const blockedPublish = await request("POST", `/admin/products/${product.id}/publish`, draftPayload(product, {
    name: `Unpublished incomplete ${testRunId}`,
    details: { ...product.details, tagline: "" },
  }));
  assertStatus(blockedPublish, 400);
  assert.match(blockedPublish.data.error, /Tagline/);
  assert.equal((await adminProduct(product.id)).name, product.name);
  assert.equal((await publicProducts()).find((item) => item.id === product.id).name, product.name);

  const promoted = assertStatus(await request("POST", `/admin/products/${product.id}/publish`, draftPayload(product, {
    name: revisionName,
    price: "$35.00 per kg",
    details: {
      ...product.details,
      blurb: revisionBlurb,
    },
  })), 200);
  assert.equal(promoted.lifecycleStatus, "Published");
  assert.equal(promoted.name, revisionName);
  assert.equal(promoted.details.blurb, revisionBlurb);
  assert.equal(promoted.hasDraft, false);
  const publishedRevision = (await publicProducts()).find((item) => item.id === product.id);
  assert.equal(publishedRevision.name, revisionName);
  assert.equal(publishedRevision.details.blurb, revisionBlurb);

  const stockUpdated = assertStatus(await request("PATCH", `/products/${product.id}`, { status: "low" }), 200);
  assert.equal(stockUpdated.status, "low");
  assert.equal((await adminProduct(product.id)).status, "low");
  assert.equal((await adminProduct(product.id)).draft, null);
  assert.equal((await availability()).find((item) => item.id === product.id).status, "low");

  assertStatus(await request("PATCH", `/products/${product.id}`, { name: `Illegal live edit ${testRunId}` }), 409);
  const unchangedLive = await adminProduct(product.id);
  assert.equal(unchangedLive.name, revisionName);
  assert.equal(unchangedLive.draft, null);
  const publicDetailResponse = await fetch(`${baseUrl}/api/products/slug/${product.slug}`);
  assert.equal(publicDetailResponse.status, 200);
  assert.equal(publicDetailResponse.headers.get("cache-control"), "no-store");
  assert.equal((await publicDetailResponse.json()).details.blurb, revisionBlurb);
  const renderedProductPage = await fetch(`${webBaseUrl}/product/${product.slug}`);
  assert.equal(renderedProductPage.status, 200);
  const renderedProductHtml = await renderedProductPage.text();
  assert.match(renderedProductHtml, new RegExp(revisionBlurb));
  assert.doesNotMatch(renderedProductHtml, /Lifecycle test blurb/);

  const archivedRevisionName = `Archived revision ${testRunId}`;
  insertLeftoverDraft(promoted, { name: archivedRevisionName });
  const archived = assertStatus(await request("POST", `/admin/products/${product.id}/archive`), 200);
  assert.equal(archived.lifecycleStatus, "Archived");
  assert.equal(includesProduct(await publicProducts(), product.id), false);
  assert.equal(includesProduct(await availability(), product.id), false);

  const restored = assertStatus(await request("POST", `/admin/products/${product.id}/restore`), 200);
  assert.equal(restored.lifecycleStatus, "Draft");
  assert.equal(restored.name, archivedRevisionName);
  assert.equal(restored.hasDraft, false);
  assert.equal(includesProduct(await publicProducts(), product.id), false);
  assert.equal(includesProduct(await availability(), product.id), false);

  const republished = assertStatus(await request("POST", `/admin/products/${product.id}/publish`), 200);
  assert.equal(republished.lifecycleStatus, "Published");
  assert.equal(republished.name, archivedRevisionName);

  const discardedName = `Discarded revision ${testRunId}`;
  insertLeftoverDraft(republished, { name: discardedName });
  assert.equal((await adminProduct(product.id)).hasDraft, true);
  const discarded = assertStatus(await request("POST", `/admin/products/${product.id}/discard-draft`), 200);
  assert.equal(discarded.lifecycleStatus, "Published");
  assert.equal(discarded.name, archivedRevisionName);
  assert.equal(discarded.hasDraft, false);
  assert.equal((await publicProducts()).find((item) => item.id === product.id).name, archivedRevisionName);

  assertStatus(await request("POST", "/admin/products/not-an-id/publish"), 400);
  assertStatus(await request("GET", "/admin/products/999999999"), 404);
});

test("source workbook reports publish gaps while exported legacy records round-trip safely", async () => {
  const source = await readFile(new URL("../../../attached_assets/0_IH_Seeds_-_Product_Data_Workbook_(pre-filled)_-_description_1788757020628.xlsx", import.meta.url));
  const sourceBook = xlsx.read(source);
  const sourceProducts = xlsx.utils.sheet_to_json(sourceBook.Sheets["1 Products"], { defval: "", raw: false });
  const sourceHeaders = Object.keys(sourceProducts[0]);
  assert.equal(sourceHeaders.length, 65);
  assert.deepEqual(sourceHeaders.slice(sourceHeaders.indexOf("tagline"), sourceHeaders.indexOf("description") + 1), [
    "tagline", "blurb", "key_attributes", "description",
  ]);
  assert.equal(sourceHeaders.at(-1), "distribution_note");
  assert.equal(new Set(sourceProducts.map((row) => row.slug)).size, sourceProducts.length);
  assert.equal(sourceProducts.every((row) => ["Published", "Draft", "Archived"].includes(row.status)), true);
  const describedProduct = sourceProducts.find((row) => String(row.description).includes("\n"));
  assert.ok(describedProduct, "Expected revised source workbook to contain a multiline product description");
  assert.ok(String(describedProduct.tagline).trim());
  assert.ok(String(describedProduct.blurb).trim());
  assert.ok(String(describedProduct.key_attributes).split("|").some((attribute) => attribute.trim()));
  const sourceComponents = xlsx.utils.sheet_to_json(sourceBook.Sheets["5 Mix components"], { defval: "", raw: false });
  assert.equal(Object.keys(sourceComponents[0]).includes("component_description"), true);
  assert.equal(sourceComponents.filter((row) => String(row.component_description).trim()).length, 121);
  const sourceReport = assertStatus(await request("POST", "/admin/import/dry-run", {
    workbookBase64: source.toString("base64"),
  }), 200);
  assert.equal(sourceReport.issues.some((issue) => issue.column === "status" &&
    /Published products require:.*SEO (title|description)/.test(issue.problem)), true);
  assert.equal(sourceReport.issues.some((issue) => issue.column === "status" &&
    /Invalid lifecycle status/.test(issue.problem)), false);
  assert.deepEqual(Object.fromEntries(Object.entries(sourceReport.sheets).slice(0, 7).map(([name, report]) => [name, report.rows])), {
    "1 Products": 150,
    "2 Sowing rates": 242,
    "3 Category specifics": 150,
    "4 Sale lines": 112,
    "5 Mix components": 125,
    "6 Companions": 229,
    "7 Website SEO": 79,
  });
  assert.deepEqual(Object.fromEntries(Object.entries(sourceReport.sheets).slice(0, 7).map(([name, report]) => [name, {
    accepted: report.accepted, skipped: report.skipped,
  }])), {
    "1 Products": { accepted: 150, skipped: 0 },
    "2 Sowing rates": { accepted: 242, skipped: 0 },
    "3 Category specifics": { accepted: 150, skipped: 0 },
    "4 Sale lines": { accepted: 102, skipped: 10 },
    "5 Mix components": { accepted: 125, skipped: 0 },
    "6 Companions": { accepted: 229, skipped: 0 },
    "7 Website SEO": { accepted: 79, skipped: 0 },
  });

  const exportResponse = await fetch(`${baseUrl}/api/admin/import/export`);
  assert.equal(exportResponse.status, 200);
  const exported = Buffer.from(await exportResponse.arrayBuffer());
  const book = xlsx.read(exported, { type: "buffer" });
  assert.deepEqual(book.SheetNames, [
    "1 Products", "2 Sowing rates", "3 Category specifics", "4 Sale lines",
    "5 Mix components", "6 Companions", "7 Website SEO", "8 Categories", "9 Redirects",
    "10 Product FAQs", "Lists",
  ]);
  const listsIndex = book.SheetNames.indexOf("Lists");
  assert.equal(book.Workbook?.Sheets?.[listsIndex]?.Hidden, 1);
   const exportedProducts = xlsx.utils.sheet_to_json(book.Sheets["1 Products"], {
     header: 1,
     defval: "",
     raw: false,
   });
   const productHeaders = exportedProducts[0];
   assert.equal(productHeaders.includes("summary"), false);
   assert.deepEqual(productHeaders.slice(productHeaders.indexOf("tagline"), productHeaders.indexOf("description") + 1), [
     "tagline", "blurb", "key_attributes", "description",
   ]);
   assert.equal(productHeaders.at(-1), "distribution_note");
    const exportedComponents = xlsx.utils.sheet_to_json(book.Sheets["5 Mix components"], {
      header: 1,
      defval: "",
      raw: false,
    });
    assert.equal(exportedComponents[0].includes("component_description"), true);
  const exportedSeo = xlsx.utils.sheet_to_json(book.Sheets["7 Website SEO"], { header: 1, defval: "", raw: false });
  assert.equal(["social_title", "social_description", "social_image", "canonical_url", "robots_index"]
    .every((column) => exportedSeo[0].includes(column)), true);
  const exportedCategories = xlsx.utils.sheet_to_json(book.Sheets["8 Categories"], { header: 1, defval: "", raw: false });
  assert.equal(["parent_slug", "slug", "page_heading", "seo_title", "seo_description", "lead", "rainfall", "image", "active"]
    .every((column) => exportedCategories[0].includes(column)), true);
  const exportedRedirects = xlsx.utils.sheet_to_json(book.Sheets["9 Redirects"], { header: 1, defval: "", raw: false });
  assert.equal(["from_path", "to_path"].every((column) => exportedRedirects[0].includes(column)), true);
  const exportedFaqs = xlsx.utils.sheet_to_json(book.Sheets["10 Product FAQs"], { header: 1, defval: "", raw: false });
  assert.equal(["slug", "product_name", "question", "answer"].every((column) => exportedFaqs[0].includes(column)), true);
  assert.equal(["photo_1", "photo_2", "photo_3"].every((column) => productHeaders.includes(column)), true);

  const exportReport = assertStatus(await request("POST", "/admin/import/dry-run", {
    workbookBase64: exported.toString("base64"),
  }), 200);
  assert.deepEqual(exportReport.issues, []);
  assert.equal(exportReport.sheets["1 Products"].rows > 0, true);
});

test("product FAQs export, replace, overlay, and validate through the workbook", async () => {
  const categories = assertStatus(await request("GET", "/categories"), 200);
  const other = categories.find((category) => category.slug === "other");
  assert.ok(other, "Expected the seeded Other category");
  const product = await createProduct("workbook-faqs", { category: other.name, subcategoryId: other.id });
  const storedFaqs = [
    { question: "When should I sow this?", answer: "Sow after the autumn break.\n\nKeep soil moisture in mind." },
    { question: "Can I graze it early?", answer: "" },
  ];
  assertStatus(await request("POST", `/admin/products/${product.id}/draft`, draftPayload(product, {
    details: { ...product.details, faqs: storedFaqs },
  })), 200);

  const exported = Buffer.from(await (await fetch(`${baseUrl}/api/admin/import/export`)).arrayBuffer());
  const exportedBook = xlsx.read(exported);
  const exportedFaqRows = xlsx.utils.sheet_to_json(exportedBook.Sheets["10 Product FAQs"], { defval: "", raw: false })
    .filter((row) => row.slug === product.slug);
  assert.deepEqual(exportedFaqRows.map((row) => ({ question: row.question, answer: row.answer })), storedFaqs);

  const productRow = {
    slug: product.slug,
    product_name: product.name,
    category: other.name,
    record_type: "Variety",
  };
  const makeFaqWorkbook = ({ faqRows, includeFaqSheet = true }) => {
    const book = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(book, xlsx.utils.json_to_sheet([productRow]), "1 Products");
    if (includeFaqSheet) {
      xlsx.utils.book_append_sheet(
        book,
        xlsx.utils.json_to_sheet(faqRows.length ? faqRows : [{ slug: "", product_name: "", question: "", answer: "" }]),
        "10 Product FAQs",
      );
    }
    xlsx.utils.book_append_sheet(book, xlsx.utils.json_to_sheet([{ category: other.name, record_type: "Variety" }]), "Lists");
    return xlsx.write(book, { type: "buffer", bookType: "xlsx" });
  };
  const commitWorkbookFile = async (buffer) => {
    const report = assertStatus(await request("POST", "/admin/import/dry-run", {
      workbookBase64: buffer.toString("base64"),
    }), 200);
    assert.deepEqual(report.issues, []);
    assertStatus(await request("POST", "/admin/import/commit", {
      workbookBase64: buffer.toString("base64"),
      token: report.token,
    }), 200);
  };

  const replacementFaqs = [
    { slug: product.slug, product_name: product.name, question: "Is it drought tolerant?", answer: "It suits medium-rainfall country." },
  ];
  await commitWorkbookFile(makeFaqWorkbook({ faqRows: replacementFaqs }));
  assert.deepEqual((await adminProduct(product.id)).details.faqs, [
    { question: "Is it drought tolerant?", answer: "It suits medium-rainfall country." },
  ]);

  await commitWorkbookFile(makeFaqWorkbook({ faqRows: [], includeFaqSheet: false }));
  assert.deepEqual((await adminProduct(product.id)).details.faqs, [
    { question: "Is it drought tolerant?", answer: "It suits medium-rainfall country." },
  ]);

  await commitWorkbookFile(makeFaqWorkbook({
    faqRows: [{ slug: product.slug, product_name: product.name, question: "", answer: "" }],
  }));
  assert.deepEqual((await adminProduct(product.id)).details.faqs, []);

  const tooMany = assertStatus(await request("POST", "/admin/import/dry-run", {
    workbookBase64: makeFaqWorkbook({
      faqRows: Array.from({ length: 11 }, (_, index) => ({
        slug: product.slug, product_name: product.name, question: `Question ${index + 1}`, answer: `Answer ${index + 1}`,
      })),
    }).toString("base64"),
  }), 200);
  assert.equal(tooMany.issues.some((issue) => issue.sheet === "10 Product FAQs" && /maximum is 10/.test(issue.problem)), true);

  const tooLong = assertStatus(await request("POST", "/admin/import/dry-run", {
    workbookBase64: makeFaqWorkbook({
      faqRows: [{ slug: product.slug, product_name: product.name, question: "Q".repeat(181), answer: "A" }],
    }).toString("base64"),
  }), 200);
  assert.equal(tooLong.issues.some((issue) => issue.sheet === "10 Product FAQs" && issue.column === "question"), true);
});

test("published workbook rows enforce content fields and retain products absent from an upsert", async () => {
  const categories = assertStatus(await request("GET", "/categories"), 200);
  const other = categories.find((category) => category.slug === "other");
  assert.ok(other, "Expected the seeded Other category");
  const imported = await createProduct("workbook-upsert", { category: other.name, subcategoryId: other.id });
  const absent = await createProduct("workbook-absent", { category: other.name, subcategoryId: other.id });
  const sourceDescription = "First editorial paragraph.\n\nSecond editorial paragraph.";
  const legacyWebsiteUrl = `https://irwinhunter.com.au/product/${imported.slug}/`;
  const productRow = {
    slug: imported.slug,
    product_name: imported.name,
    category: other.name,
    sub_category: "",
    record_type: "Mix",
    tagline: "Workbook published tagline",
    blurb: "Workbook published blurb",
    key_attributes: "First attribute| Second attribute ",
    description: sourceDescription,
    status: "Published",
    distribution_note: "Workbook distribution note",
  };
  const makeWorkbook = (row) => {
    const book = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(book, xlsx.utils.json_to_sheet([row]), "1 Products");
    if (row.status === "Published") {
      xlsx.utils.book_append_sheet(book, xlsx.utils.json_to_sheet([{
        product_slug: row.slug,
        product_url: legacyWebsiteUrl,
        seo_title: "Workbook SEO title",
        meta_description: "Workbook SEO description.",
        social_title: "Workbook social title",
        social_description: "Workbook social description.",
        social_image: "https://example.com/share.jpg",
        canonical_url: "https://example.com/product/canonical",
        robots_index: "N",
      }]), "7 Website SEO");
    }
    xlsx.utils.book_append_sheet(book, xlsx.utils.json_to_sheet([{ category: other.name, record_type: "Mix" }]), "Lists");
    return xlsx.write(book, { type: "buffer", bookType: "xlsx" });
  };
  const malformed = { ...productRow, key_attributes: " | ", status: "Published" };
  const invalidStatus = { ...productRow, status: "Live" };
  for (const row of [malformed, invalidStatus]) {
    const report = assertStatus(await request("POST", "/admin/import/dry-run", {
      workbookBase64: makeWorkbook(row).toString("base64"),
    }), 200);
    assert.equal(report.issues.some((issue) => issue.column === "status"), true);
  }

  const workbook = makeWorkbook(productRow);
  const report = assertStatus(await request("POST", "/admin/import/dry-run", {
    workbookBase64: workbook.toString("base64"),
  }), 200);
  assert.deepEqual(report.issues, []);
  assertStatus(await request("POST", "/admin/import/commit", {
    workbookBase64: workbook.toString("base64"),
    token: report.token,
  }), 200);

  const published = (await publicProducts()).find((product) => product.id === imported.id);
  assert.ok(published);
  assert.equal(published.details.tagline, productRow.tagline);
  assert.equal(published.details.blurb, productRow.blurb);
  assert.deepEqual(published.details.keyAttributes, ["First attribute", "Second attribute"]);
  assert.equal(published.details.distributionNote, productRow.distribution_note);
  assert.equal(published.details.description, sourceDescription);
  assert.equal("bredByOrigin" in published.details, false);
  assert.equal("supplierName" in published.details, false);
  assert.equal((await adminProduct(imported.id)).websiteUrlLegacy, legacyWebsiteUrl);
  assert.equal((await adminProduct(imported.id)).details.socialTitle, "Workbook social title");
  assert.equal((await adminProduct(imported.id)).details.socialDescription, "Workbook social description.");
  assert.equal((await adminProduct(imported.id)).details.socialImage, "https://example.com/share.jpg");
  assert.equal((await adminProduct(imported.id)).details.canonicalUrl, "https://example.com/product/canonical");
  assert.equal((await adminProduct(imported.id)).details.robotsIndex, false);
  assert.equal((await adminProduct(absent.id)).id, absent.id, "Absent workbook products must be retained");

  const exported = Buffer.from(await (await fetch(`${baseUrl}/api/admin/import/export`)).arrayBuffer());
  const exportedBook = xlsx.read(exported);
  const exportedRow = xlsx.utils.sheet_to_json(exportedBook.Sheets["1 Products"], { defval: "", raw: false })
    .find((row) => row.slug === imported.slug);
  assert.ok(exportedRow);
  assert.equal(exportedRow.description, sourceDescription);
  assert.equal(exportedRow.tagline, productRow.tagline);
  assert.equal(exportedRow.blurb, productRow.blurb);
  assert.equal(exportedRow.key_attributes, "First attribute|Second attribute");
  assert.equal(exportedRow.distribution_note, productRow.distribution_note);
  const exportedSeoRow = xlsx.utils.sheet_to_json(exportedBook.Sheets["7 Website SEO"], { defval: "", raw: false })
    .find((row) => row.product_slug === imported.slug);
  assert.ok(exportedSeoRow);
  assert.equal(exportedSeoRow.social_title, "Workbook social title");
  assert.equal(exportedSeoRow.canonical_url, "https://example.com/product/canonical");
  assert.equal(exportedSeoRow.robots_index, "N");
  const exportedCategoryRow = xlsx.utils.sheet_to_json(exportedBook.Sheets["8 Categories"], { defval: "", raw: false })
    .find((row) => row.slug === other.slug);
  assert.ok(exportedCategoryRow);
  assert.equal(exportedCategoryRow.name, other.name);
  const reimport = assertStatus(await request("POST", "/admin/import/dry-run", {
    workbookBase64: exported.toString("base64"),
  }), 200);
  assert.deepEqual(reimport.issues, []);

  const legacy = await createProduct("workbook-legacy", { category: other.name, subcategoryId: other.id });
  assertStatus(await request("POST", `/admin/products/${legacy.id}/publish`), 200);
  // Simulate an old Published JSON payload that predates blurb. This record is
  // test-owned, so the compatibility check never mutates catalogue fixtures.
  sql(`UPDATE ih_products SET details = details - 'blurb' WHERE id = ${legacy.id}`);
  const legacyExport = Buffer.from(await (await fetch(`${baseUrl}/api/admin/import/export`)).arrayBuffer());
  const legacyRow = xlsx.utils.sheet_to_json(xlsx.read(legacyExport).Sheets["1 Products"], { defval: "", raw: false })
    .find((row) => row.slug === legacy.slug);
  assert.equal(legacyRow.status, "", "Invalid legacy Published content exports as preserve-status");

  const preserveWorkbook = makeWorkbook({ slug: legacy.slug, status: "" });
  const preserveReport = assertStatus(await request("POST", "/admin/import/dry-run", {
    workbookBase64: preserveWorkbook.toString("base64"),
  }), 200);
  assertStatus(await request("POST", "/admin/import/commit", {
    workbookBase64: preserveWorkbook.toString("base64"), token: preserveReport.token,
  }), 200);
  const degradedWorkbook = makeWorkbook({ slug: legacy.slug, status: "", key_attributes: " | " });
  const degradedReport = assertStatus(await request("POST", "/admin/import/dry-run", {
    workbookBase64: degradedWorkbook.toString("base64"),
  }), 200);
  assertStatus(await request("POST", "/admin/import/commit", {
    workbookBase64: degradedWorkbook.toString("base64"), token: degradedReport.token,
  }), 400);
});

test("category workbook import keeps child rows listed before their parent and reports unknown parents", async () => {
  const suffix = `cat-order-${testRunId}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const parentSlug = `${suffix}-root`;
  const childSlug = `${suffix}-child`;
  const orphanSlug = `${suffix}-orphan`;
  const makeWorkbook = (rows) => {
    const book = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(book, xlsx.utils.json_to_sheet(rows), "8 Categories");
    xlsx.utils.book_append_sheet(book, xlsx.utils.json_to_sheet([{ category: "Automated tests", record_type: "Mix" }]), "Lists");
    return xlsx.write(book, { type: "buffer", bookType: "xlsx" });
  };
  const unknownParent = makeWorkbook([{
    parent_slug: `${suffix}-missing`, slug: orphanSlug, name: `Orphan ${testRunId}`, active: "Y",
  }]);
  const unknownReport = assertStatus(await request("POST", "/admin/import/dry-run", {
    workbookBase64: unknownParent.toString("base64"),
  }), 200);
  assert.equal(unknownReport.issues.some((issue) => issue.column === "parent_slug"), true);

  const childFirst = makeWorkbook([
    { parent_slug: parentSlug, slug: childSlug, name: `Child ${testRunId}`, active: "Y" },
    { parent_slug: "", slug: parentSlug, name: `Root ${testRunId}`, active: "Y" },
  ]);
  const report = assertStatus(await request("POST", "/admin/import/dry-run", {
    workbookBase64: childFirst.toString("base64"),
  }), 200);
  assert.deepEqual(report.issues, []);
  let parent;
  let child;
  try {
    assertStatus(await request("POST", "/admin/import/commit", {
      workbookBase64: childFirst.toString("base64"),
      token: report.token,
    }), 200);
    const categories = assertStatus(await request("GET", "/admin/categories"), 200);
    parent = categories.find((category) => category.slug === parentSlug);
    child = categories.find((category) => category.parentId === parent?.id && category.slug === childSlug);
    assert.ok(parent, "Expected the workbook root category to be created");
    assert.ok(child, "Expected the child category listed before its parent to be created");
    assert.equal(child.name, `Child ${testRunId}`);
  } finally {
    if (child) await request("DELETE", `/admin/categories/${child.id}`);
    if (parent) await request("DELETE", `/admin/categories/${parent.id}`);
  }
});

test("taxonomy assignment on a draft stays private until publish, and published edits go live immediately", async () => {
  const product = await createProduct("taxonomy-assignment");
  const categories = assertStatus(await request("GET", "/admin/categories"), 200);
  const ryegrass = categories.find((category) => category.slug === "ryegrass");
  assert.ok(ryegrass, "Expected seeded ryegrass taxonomy category");

  const drafted = assertStatus(await request("POST", `/admin/products/${product.id}/draft`, draftPayload(product, {
    category: "Not the taxonomy display name",
    subcategoryId: ryegrass.id,
  })), 200);
  assert.equal(drafted.subcategoryId, ryegrass.id);
  assert.equal(drafted.category, ryegrass.name);
  assert.equal(includesProduct(await publicProducts(), product.id), false);

  const initiallyPublished = assertStatus(await request("POST", `/admin/products/${product.id}/publish`), 200);
  assert.equal(initiallyPublished.subcategoryId, ryegrass.id);
  assert.equal((await publicProducts()).find((item) => item.id === product.id).subcategoryId, ryegrass.id);

  const clovers = categories.find((category) => category.slug === "clovers");
  assert.ok(clovers, "Expected seeded clover taxonomy category");
  const published = assertStatus(await request("POST", `/admin/products/${product.id}/publish`, draftPayload(initiallyPublished, {
    category: "Not the taxonomy display name",
    subcategoryId: clovers.id,
  })), 200);
  assert.equal(published.subcategoryId, clovers.id);
  assert.equal(published.category, clovers.name);
  const publicProduct = (await publicProducts()).find((item) => item.id === product.id);
  assert.equal(publicProduct.subcategoryId, clovers.id);
  assert.equal(publicProduct.category, clovers.name);
});

test("generic updates cannot race publish or archive into live content", async () => {
  const publishRaceProduct = await createProduct("publish-race");
  const published = assertStatus(await request("POST", `/admin/products/${publishRaceProduct.id}/publish`), 200);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const revisionName = `Publish race revision ${testRunId} ${attempt}`;
    const [patch, publish] = await Promise.all([
      request("PATCH", `/products/${published.id}`, { name: `Raced live edit ${testRunId} ${attempt}` }),
      request("POST", `/admin/products/${published.id}/publish`, draftPayload(published, {
        name: revisionName,
      })),
    ]);
    assertStatus(patch, 409);
    const result = assertStatus(publish, 200);
    assert.equal(result.name, revisionName);
    assert.equal((await adminProduct(published.id)).name, revisionName);
  }

  const archiveRaceProduct = await createProduct("archive-race");
  const archivePublished = assertStatus(await request("POST", `/admin/products/${archiveRaceProduct.id}/publish`), 200);
  const [patch, archive] = await Promise.all([
    request("PATCH", `/products/${archivePublished.id}`, { name: `Raced archive edit ${testRunId}` }),
    request("POST", `/admin/products/${archivePublished.id}/archive`),
  ]);
  assertStatus(patch, 409);
  const archived = assertStatus(archive, 200);
  assert.equal(archived.lifecycleStatus, "Archived");
  assert.equal(archived.name, archivePublished.name);
  assert.equal((await adminProduct(archivePublished.id)).name, archivePublished.name);
  assert.equal(includesProduct(await publicProducts(), archivePublished.id), false);
  assert.equal(includesProduct(await availability(), archivePublished.id), false);
});

test("companion products save by slug while self and unknown references identify the companion field", async () => {
  const product = await createProduct("companion-owner");
  const companion = await createProduct("companion-target");
  const longSlug = `long-companion-${testRunId}-${"x".repeat(125)}`;
  const longSlugCompanion = assertStatus(await request("POST", "/products", {
    name: `Long slug companion ${testRunId}`,
    slug: longSlug,
    price: "",
    packSize: "",
    status: "in-stock",
    note: "",
    category: "Automated tests",
    subcategoryId: null,
    techSheet: "",
    details: { recordType: "Variety" },
  }), 201);
  createdProductIds.push(longSlugCompanion.id);

  const validDraft = assertStatus(await request("POST", `/admin/products/${product.id}/draft`, draftPayload(product, {
    details: { ...product.details, companionSpecies: [companion.slug] },
  })), 200);
  assert.deepEqual(validDraft.details.companionSpecies, [companion.slug]);
  assert.equal(validDraft.draft, null);
  const published = assertStatus(await request("POST", `/admin/products/${product.id}/publish`), 200);
  assert.deepEqual(published.details.companionSpecies, [companion.slug]);

  const longSlugPublish = assertStatus(await request("POST", `/admin/products/${product.id}/publish`, draftPayload(published, {
    details: { ...published.details, companionSpecies: [longSlug] },
  })), 200);
  assert.deepEqual(longSlugPublish.details.companionSpecies, [longSlug]);

  for (const invalidSlug of [product.slug, `unknown-companion-${testRunId}`]) {
    const result = await request("POST", `/admin/products/${product.id}/publish`, draftPayload(published, {
      details: { ...published.details, companionSpecies: [invalidSlug] },
    }));
    assertStatus(result, 400);
    assert.match(result.data.error, /Companion species/);
    assert.deepEqual(result.data.issues, [{
      field: "details.companionSpecies",
      label: "Companion species",
      values: [invalidSlug],
    }]);
  }

  const selfCreateSlug = `self-companion-${testRunId}`;
  const selfCreate = await request("POST", "/products", {
    name: `Self companion ${testRunId}`, slug: selfCreateSlug, price: "", packSize: "",
    status: "in-stock", note: "", category: "Automated tests", subcategoryId: null, techSheet: "",
    details: { recordType: "Variety", companionSpecies: [selfCreateSlug] },
  });
  assertStatus(selfCreate, 400);
  assert.equal(selfCreate.data.issues[0].field, "details.companionSpecies");

  sql(`
    UPDATE ih_products
    SET details = jsonb_set(details, '{companionSpecies}', '["unknown-legacy-companion"]'::jsonb)
    WHERE id = ${product.id}
  `);
  const legacyPublish = await request("POST", `/admin/products/${product.id}/publish`);
  assertStatus(legacyPublish, 400);
  assert.equal(legacyPublish.data.issues[0].field, "details.companionSpecies");
});

function textPdfBase64(text) {
  const escaped = text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const content = `BT /F1 12 Tf 72 720 Td (${escaped}) Tj ET`;
  const pdf = `%PDF-1.1
1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj
2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj
3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj
4 0 obj<< /Length ${content.length} >>stream
${content}
endstream
endobj
5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj
trailer<< /Root 1 0 R >>
%%EOF
`;
  return Buffer.from(pdf).toString("base64");
}

test("PDF extraction sanitizes the patch and does not write a Published product", async () => {
  const product = await createProduct("ai-extract");
  const published = assertStatus(await request("POST", `/admin/products/${product.id}/publish`), 200);
  assert.equal(published.publishStatus, "Published");
  const liveTagline = published.details.tagline;

  const extracted = await request("POST", "/admin/ai/extract", {
    productId: product.id,
    files: [{ filename: "lifecycle-test-ai-extract.pdf", data: textPdfBase64("Winter active tetraploid ryegrass for dairy systems") }],
    stubPatch: {
      saleLines: [{ stockCode: "FAKECODE", isDefault: true }],
      unknownField: "drop me",
      details: {
        bredByOrigin: "Barenbrug",
        supplierName: "Secret Supplier Ltd",
        tagline: "Barenbrug winter ryegrass",
        blurb: "A reliable winter-active ryegrass for dairy systems.",
        ploidy: "Tetraploid",
        keyAttributes: ["Winter growth", "Dairy fit"],
      },
    },
  });
  const body = assertStatus(extracted, 200);
  const paths = body.suggestions.map((suggestion) => suggestion.path);
  assert.equal(paths.includes("saleLines"), false);
  assert.equal(paths.includes("unknownField"), false);
  assert.equal(paths.includes("details.bredByOrigin"), false);
  assert.equal(paths.includes("details.tagline"), false);
  assert.equal(paths.includes("details.ploidy"), false);
  assert.ok(paths.includes("details.blurb"));
  assert.ok(paths.includes("details.keyAttributes"));
  assert.ok(paths.includes("techSheet"));
  assert.match(JSON.stringify(body.warnings), /Ignored saleLines|Dropped unknown field|private breeder|not fillable/i);

  const after = await adminProduct(product.id);
  assert.equal(after.details.tagline, liveTagline);
  assert.equal(after.details.blurb, published.details.blurb);
  assert.equal(after.publishStatus, "Published");
  assert.equal(after.hasDraft, false);
});

test("tech sheet queue matches a filename to a product without publishing", async () => {
  const product = await createProduct("queue-match");
  const uploaded = await request("POST", "/admin/tech-sheets", {
    files: [{ filename: `${product.slug}-product-information.pdf`, data: textPdfBase64("Queue match tech sheet") }],
    stubPatch: { details: { blurb: "Queued blurb from the tech sheet." } },
  });
  const items = assertStatus(uploaded, 201);
  assert.equal(items.length, 1);
  assert.equal(items[0].productId, product.id);
  assert.equal(items[0].status, "ready");
  const file = await fetch(`${baseUrl}${items[0].fileUrl}`);
  assert.equal(file.status, 200);
  assert.match(file.headers.get("content-type") ?? "", /pdf/);
  const after = await adminProduct(product.id);
  assert.notEqual(after.details.blurb, "Queued blurb from the tech sheet.");
});
