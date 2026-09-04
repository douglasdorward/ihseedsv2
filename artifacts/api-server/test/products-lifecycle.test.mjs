import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createServer } from "node:net";
import { after, before, test } from "node:test";

const serverRoot = new URL("..", import.meta.url);
const testRunId = `${process.pid}-${Date.now()}`;
const createdProductIds = [];
let child;
let baseUrl;

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
    details: overrides.details ?? product.details,
  };
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
  }), 201);
  createdProductIds.push(product.id);
  return assertStatus(await request("POST", `/admin/products/${product.id}/draft`, draftPayload(product, {
    details: {
      ...product.details,
      summary: "Lifecycle test summary",
      description: "Lifecycle test product description.",
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

test("drafts only require a product name but publishing requires public catalogue fields", async () => {
  const product = assertStatus(await request("POST", "/products", {
    name: `Incomplete lifecycle draft ${testRunId}`,
    slug: "",
    price: "",
    packSize: "",
    status: "in-stock",
    note: "",
    category: "",
    techSheet: "",
  }), 201);
  createdProductIds.push(product.id);

  assert.equal(product.publishStatus, "Draft");
  assert.ok(product.slug, "Expected a stable slug to be generated from the product name");
  assert.equal(includesProduct(await publicProducts(), product.id), false);

  const publishResult = await request("POST", `/admin/products/${product.id}/publish`);
  assertStatus(publishResult, 400);
  assert.match(publishResult.data.error, /Category/);
  assert.match(publishResult.data.error, /Summary/);
  assert.match(publishResult.data.error, /Product description/);
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
    assertStatus(await request("POST", `/admin/products/${retainedProduct.id}/draft`, draftPayload(retainedProduct, {
      name: `Inactive retained revision ${testRunId}`,
      subcategoryId: retained.id,
    })), 200);
    assertStatus(await request("POST", `/admin/products/${retainedProduct.id}/publish`), 200);

    assertStatus(await request("POST", `/products`, {
      name: `Inactive blocked ${testRunId}`, slug: `${suffix}-blocked-product`, price: "", packSize: "",
      status: "in-stock", note: "", category: "", subcategoryId: retained.id, techSheet: "",
    }), 400);
    assertStatus(await request("POST", `/admin/products/${pendingProduct.id}/publish`), 200);
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
    const publishedChild = assertStatus(await request("POST", `/admin/products/${childProduct.id}/publish`), 200);
    assertStatus(await request("POST", `/admin/products/${childProduct.id}/draft`, draftPayload(publishedChild, {
      name: `Renamed category draft ${testRunId}`,
      subcategoryId: child.id,
    })), 200);

    const renamed = `Renamed root ${testRunId}`;
    assertStatus(await request("PATCH", `/admin/categories/${root.id}`, { name: renamed }), 200);
    assert.equal((await adminProduct(rootProduct.id)).category, renamed);
    const childAdmin = await adminProduct(childProduct.id);
    assert.equal(childAdmin.category, renamed);
    assert.equal(childAdmin.draft.category, renamed);
  } finally {
    await request("DELETE", `/products/${rootProduct.id}`);
    await request("DELETE", `/products/${childProduct.id}`);
    await request("DELETE", `/admin/categories/${child.id}`);
    await request("DELETE", `/admin/categories/${root.id}`);
  }
});

test("the one-time migration corrects legacy published seed categories without changing lifecycle state", async () => {
  const expectedCategories = new Map([
    ["silahay-mix", "Specialty Mixes"],
    ["self-regeneration-pasture-mix", "Specialty Mixes"],
    ["ceres-pg-one50-ryegrass", "Ryegrasses"],
    ["margurita-french-serradella", "Serradellas & Medics"],
    ["sardi-seven-lucerne", "Lucerne"],
    ["dalkeith-subterranean-clover", "Clovers"],
  ]);
  const slugs = [...expectedCategories.keys()];
  const quotedSlugs = slugs.map((slug) => `'${slug.replaceAll("'", "''")}'`).join(", ");
  const originalRows = sql(`
    SELECT slug, category, publish_status
    FROM ih_products
    WHERE slug IN (${quotedSlugs})
    ORDER BY slug
  `).split("\n").filter(Boolean).map((row) => row.split("\t"));
  assert.equal(originalRows.length, expectedCategories.size);

  try {
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
    for (const [slug, expectedCategory] of expectedCategories) {
      const product = products.find((item) => item.slug === slug);
      assert.ok(product, `Expected ${slug} in the public catalogue`);
      assert.equal(product.category, expectedCategory);
      assert.equal(product.publishStatus, "Published");
    }
  } finally {
    for (const [slug, category, publishStatus] of originalRows) {
      sql(`
        UPDATE ih_products
        SET category = '${category.replaceAll("'", "''")}'
        WHERE slug = '${slug.replaceAll("'", "''")}'
          AND publish_status = '${publishStatus.replaceAll("'", "''")}'
      `);
    }
  }
});

test("a later published category choice for a seed product is not reverted", async () => {
  const product = (await publicProducts()).find((item) => item.slug === "ceres-pg-one50-ryegrass");
  assert.ok(product);
  const otherCategory = assertStatus(await request("GET", "/categories"), 200)
    .find((category) => category.slug === "other");
  assert.ok(otherCategory);
  const timestamps = sql(`
    SELECT published_at::text, updated_at::text, COALESCE(subcategory_id::text, '')
    FROM ih_products
    WHERE id = ${product.id}
  `).split("\t");

  try {
    assertStatus(await request("POST", `/admin/products/${product.id}/draft`, draftPayload(product, {
      category: "Other",
      subcategoryId: otherCategory.id,
      details: {
        ...product.details,
        recordType: "Variety",
        summary: "Migration regression test summary",
        description: "Migration regression test product description.",
      },
    })), 200);
    assertStatus(await request("POST", `/admin/products/${product.id}/publish`), 200);
    runMigrations();

    const published = (await publicProducts()).find((item) => item.id === product.id);
    assert.ok(published);
    assert.equal(published.category, otherCategory.name);
    assert.equal(published.publishStatus, "Published");
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

test("category administration enforces nesting, activation, and deletion protection", async () => {
  const suffix = `category-test-${testRunId}`;
  const categoryInput = (slug, name, parentId = null) => ({
    parentId,
    slug,
    name,
    groupLabel: "Automated tests",
    lead: "Category API test",
    rainfall: "Any",
    image: "",
    sortOrder: 999,
    active: true,
  });
  const parent = assertStatus(await request("POST", "/admin/categories",
    categoryInput(`${suffix}-parent`, `Category parent ${testRunId}`)), 201);
  const child = assertStatus(await request("POST", "/admin/categories",
    categoryInput(`${suffix}-child`, `Category child ${testRunId}`, parent.id)), 201);
  try {
    assertStatus(await request("POST", "/admin/categories",
      categoryInput(`${suffix}-grandchild`, `Category grandchild ${testRunId}`, child.id)), 400);
    assertStatus(await request("POST", "/admin/categories",
      categoryInput(parent.slug, `Duplicate slug ${testRunId}`)), 409);

    const product = await createProduct("category-draft-reference");
    const publishedProduct = assertStatus(await request("POST", `/admin/products/${product.id}/publish`), 200);
    assertStatus(await request("POST", `/admin/products/${product.id}/draft`, draftPayload(publishedProduct, {
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

before(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for lifecycle API tests");
  }
  const port = await freePort();
  baseUrl = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ["--enable-source-maps", "./dist/index.mjs"], {
    cwd: new URL(serverRoot).pathname,
    env: { ...process.env, NODE_ENV: "test", PORT: String(port) },
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
});

after(async () => {
  for (const id of createdProductIds) {
    await request("DELETE", `/products/${id}`);
  }
  if (!child || child.exitCode !== null) return;
  child.kill("SIGTERM");
  await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      resolve();
    }, 2_000);
    child.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
  });
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
  assert.equal(publicProduct.category, "Automated tests");
  assert.equal(includesProduct(await availability(), product.id), true);

  const revisionName = `Lifecycle revision ${testRunId}`;
  const revised = assertStatus(await request("POST", `/admin/products/${product.id}/draft`, draftPayload(product, {
    name: revisionName,
    price: "$35.00 per kg",
  })), 200);
  assert.equal(revised.lifecycleStatus, "Published");
  assert.equal(revised.name, product.name);
  assert.equal(revised.hasDraft, true);
  assert.equal(revised.draft.name, revisionName);
  assert.equal((await publicProducts()).find((item) => item.id === product.id).name, product.name);

  const stockUpdated = assertStatus(await request("PATCH", `/products/${product.id}`, { status: "low" }), 200);
  assert.equal(stockUpdated.status, "low");
  assert.equal((await adminProduct(product.id)).draft.status, "low");
  assert.equal((await availability()).find((item) => item.id === product.id).status, "low");

  assertStatus(await request("PATCH", `/products/${product.id}`, { name: `Illegal live edit ${testRunId}` }), 409);
  const unchangedLive = await adminProduct(product.id);
  assert.equal(unchangedLive.name, product.name);
  assert.equal(unchangedLive.draft.name, revisionName);

  const promoted = assertStatus(await request("POST", `/admin/products/${product.id}/publish`), 200);
  assert.equal(promoted.lifecycleStatus, "Published");
  assert.equal(promoted.name, revisionName);
  assert.equal(promoted.hasDraft, false);
  assert.equal((await publicProducts()).find((item) => item.id === product.id).name, revisionName);

  const archivedRevisionName = `Archived revision ${testRunId}`;
  assertStatus(await request("POST", `/admin/products/${product.id}/draft`, draftPayload(promoted, {
    name: archivedRevisionName,
  })), 200);
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
  assertStatus(await request("POST", `/admin/products/${product.id}/draft`, draftPayload(republished, {
    name: discardedName,
  })), 200);
  const discarded = assertStatus(await request("POST", `/admin/products/${product.id}/discard-draft`), 200);
  assert.equal(discarded.lifecycleStatus, "Published");
  assert.equal(discarded.name, archivedRevisionName);
  assert.equal(discarded.hasDraft, false);
  assert.equal((await publicProducts()).find((item) => item.id === product.id).name, archivedRevisionName);

  assertStatus(await request("POST", "/admin/products/not-an-id/publish"), 400);
  assertStatus(await request("GET", "/admin/products/999999999"), 404);
});

test("taxonomy assignment is saved as a draft and only reaches public products on publish", async () => {
  const product = await createProduct("taxonomy-assignment");
  const categories = assertStatus(await request("GET", "/admin/categories"), 200);
  const ryegrass = categories.find((category) => category.slug === "ryegrass");
  assert.ok(ryegrass, "Expected seeded ryegrass taxonomy category");

  const initiallyPublished = assertStatus(await request("POST", `/admin/products/${product.id}/publish`), 200);
  assert.equal(initiallyPublished.subcategoryId, null);
  assert.equal((await publicProducts()).find((item) => item.id === product.id).subcategoryId, null);

  const revised = assertStatus(await request("POST", `/admin/products/${product.id}/draft`, draftPayload(initiallyPublished, {
    category: "Not the taxonomy display name",
    subcategoryId: ryegrass.id,
  })), 200);
  assert.equal(revised.subcategoryId, null);
  assert.equal(revised.draft.subcategoryId, ryegrass.id);
  assert.equal(revised.draft.category, ryegrass.name);
  const stillPublic = (await publicProducts()).find((item) => item.id === product.id);
  assert.equal(stillPublic.subcategoryId, null);
  assert.equal(stillPublic.category, "Automated tests");

  const published = assertStatus(await request("POST", `/admin/products/${product.id}/publish`), 200);
  assert.equal(published.subcategoryId, ryegrass.id);
  assert.equal(published.category, ryegrass.name);
  const publicProduct = (await publicProducts()).find((item) => item.id === product.id);
  assert.equal(publicProduct.subcategoryId, ryegrass.id);
  assert.equal(publicProduct.category, ryegrass.name);
});

test("generic updates cannot race publish or archive into live content", async () => {
  const publishRaceProduct = await createProduct("publish-race");
  const published = assertStatus(await request("POST", `/admin/products/${publishRaceProduct.id}/publish`), 200);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const revisionName = `Publish race revision ${testRunId} ${attempt}`;
    assertStatus(await request("POST", `/admin/products/${published.id}/draft`, draftPayload(published, {
      name: revisionName,
    })), 200);
    const [patch, publish] = await Promise.all([
      request("PATCH", `/products/${published.id}`, { name: `Raced live edit ${testRunId} ${attempt}` }),
      request("POST", `/admin/products/${published.id}/publish`),
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