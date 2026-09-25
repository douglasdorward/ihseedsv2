import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createServer } from "node:net";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import xlsx from "xlsx";

const serverRoot = fileURLToPath(new URL("..", import.meta.url));
const webRoot = fileURLToPath(new URL("../../web", import.meta.url));
const nextBin = join(webRoot, "node_modules/.bin/next");
const testRunId = `${process.pid}-${Date.now()}`;
const createdProductIds = [];
const createdArticleIds = [];
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
    cwd: fileURLToPath(new URL("../../../lib/db", import.meta.url)),
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

test("only registered redirect paths resolve through lookup and the legacy HTTP route", async () => {
  const fromPath = `/product/registered-${testRunId}`;
  const toPath = `/products/other/registered-${testRunId}`;
  sql(`INSERT INTO ih_redirects (from_path, to_path) VALUES ('${fromPath}', '${toPath}')`);
  assert.deepEqual(
    assertStatus(await request("GET", `/redirects/lookup?fromPath=${encodeURIComponent(fromPath)}`), 200),
    { toPath },
  );
  assertStatus(await request("GET", "/redirects/lookup?fromPath=%2Fproduct%2Fnot-registered"), 404);
  const redirect = await fetch(`${baseUrl}${fromPath}`, { redirect: "manual" });
  assert.equal(redirect.status, 301);
  assert.equal(redirect.headers.get("location"), toPath);
  sql(`DELETE FROM ih_redirects WHERE from_path = '${fromPath}'`);
});

function publicOrigin() {
  const raw = (process.env.PUBLIC_SITE_URL || "https://www.irwinhunter.com.au").trim().replace(/\/+$/, "")
    || "https://www.irwinhunter.com.au";
  const url = new URL(raw);
  if (url.hostname === "irwinhunter.com.au") url.hostname = "www.irwinhunter.com.au";
  return url.origin;
}

test("sitemap contains only canonical Active Published product paths", async () => {
  const publicCatalogue = await publicProducts();
  const categories = assertStatus(await request("GET", "/categories"), 200);
  const rootByName = new Map(categories.filter((category) => category.parentId === null).map((category) => [category.name, category.slug]));
  const categorySlug = (product) => rootByName.get(product.category)
    || product.category.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    || "catalogue";
  const origin = publicOrigin();
  const expectedLoc = (product) => {
    const fallback = `/products/${categorySlug(product)}/${encodeURIComponent(product.slug)}`;
    const override = typeof product.details.canonicalUrl === "string" ? product.details.canonicalUrl.trim() : "";
    if (override.startsWith("/") && !override.startsWith("//") && !override.startsWith("/\\")) {
      return `${origin}${override}`;
    }
    try {
      const url = new URL(override);
      const expectedHost = new URL(origin).hostname.replace(/^www\./, "");
      if (["http:", "https:"].includes(url.protocol) && url.hostname.replace(/^www\./, "") === expectedHost) {
        return `${origin}${`${url.pathname}${url.search}`.replace(/\/+$/, "") || "/"}`;
      }
    } catch {
      // Off-site or invalid overrides keep the nested product path.
    }
    return `${origin}${fallback}`;
  };
  const response = await fetch(`${baseUrl}/api/sitemap-products`);
  assert.equal(response.status, 200);
  const xml = await response.text();
  const locations = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
  assert.deepEqual(
    locations.sort(),
    publicCatalogue
      .filter((product) => product.details.robotsIndex !== false)
      .map((product) => expectedLoc(product))
      .sort(),
  );
  assert.equal([...xml.matchAll(/<lastmod>.*?<\/lastmod>/g)].length, locations.length);
  const entries = assertStatus(await request("GET", "/sitemap-product-entries"), 200);
  assert.deepEqual(
    entries.map((entry) => entry.slug).sort(),
    publicCatalogue.filter((product) => product.details.robotsIndex !== false).map((product) => product.slug).sort(),
  );
  assert.equal(entries.every((entry) => Number.isNaN(Date.parse(entry.lastModified)) === false), true);
  for (const entry of entries) {
    assert.deepEqual(Object.keys(entry).sort(), ["lastModified", "slug"]);
  }
});

test("public sitemap.xml and robots.txt are the crawl contract", async () => {
  const origin = publicOrigin();
  const robots = await fetch(`${webBaseUrl}/robots.txt`);
  assert.equal(robots.status, 200);
  const robotsBody = await robots.text();
  assert.match(robotsBody, /Disallow:\s*\/admin/i);
  assert.match(robotsBody, /Disallow:\s*\/api/i);
  assert.match(robotsBody, new RegExp(`Sitemap:\\s*${origin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/sitemap\\.xml`));

  const response = await fetch(`${webBaseUrl}/sitemap.xml`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /xml/);
  const xml = await response.text();
  assert.match(xml, /<urlset/);
  const locations = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
  assert.equal(locations.some((loc) => loc.startsWith(`${origin}/`)), true);
  assert.equal(locations.every((loc) => loc.startsWith(origin)), true);
  assert.equal(locations.includes(`${origin}/`), true);
  assert.equal(locations.includes(`${origin}/products`), true);
  assert.equal(locations.includes(`${origin}/resources`), true);
  assert.equal(locations.includes(`${origin}/privacy`), true);
  assert.equal(locations.includes(`${origin}/terms-and-conditions`), true);
  assert.equal(locations.includes(`${origin}/admin`), false);
  const articles = assertStatus(await request("GET", "/articles"), 200)
    .filter((article) => article.robotsIndex !== false);
  assert.equal(articles.every((article) => locations.includes(`${origin}/resources/${article.slug}`)), true);
});

test("product sitemap uses same-origin canonical overrides, lastmod, and omits noindex", async () => {
  const origin = publicOrigin();
  const overridePath = `/products/automated-tests/canonical-override-${testRunId}`;
  const indexed = await createProduct("sitemap-canonical");
  const hidden = await createProduct("sitemap-noindex");
  assertStatus(await request("POST", `/admin/products/${indexed.id}/publish`, draftPayload(indexed, {
    details: { ...indexed.details, canonicalUrl: overridePath },
  })), 200);
  assertStatus(await request("POST", `/admin/products/${hidden.id}/publish`, draftPayload(hidden, {
    details: { ...hidden.details, robotsIndex: false },
  })), 200);

  const xml = await (await fetch(`${baseUrl}/api/sitemap-products`)).text();
  assert.match(xml, new RegExp(`<loc>${origin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}${overridePath}</loc>`));
  assert.match(xml, /<lastmod>\d{4}-\d{2}-\d{2}T/);
  assert.doesNotMatch(xml, new RegExp(`/products/automated-tests/${hidden.slug}`));

  const entries = assertStatus(await request("GET", "/sitemap-product-entries"), 200);
  assert.equal(entries.some((entry) => entry.slug === indexed.slug), true);
  assert.equal(entries.some((entry) => entry.slug === hidden.slug), false);

  const publicXml = await (await fetch(`${webBaseUrl}/sitemap.xml`)).text();
  assert.match(publicXml, new RegExp(`${origin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}${overridePath}`));
  assert.doesNotMatch(publicXml, new RegExp(`/products/automated-tests/${hidden.slug}`));
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

test("public sale lines use default, positive pack size, stock code, then stable order", async () => {
  const product = await createProduct("sale-line-order");
  const line = (stockCode, packKg, isDefault = false) => ({
    stockCode: `${stockCode}-${testRunId}`,
    seedForm: "",
    seedGrade: "",
    packKg,
    packUnit: "kg",
    availability: "Good stock",
    priceDisplay: "Contact for pricing",
    isDefault,
    sortOrder: 999,
  });
  const saleLines = [
    line("z-null", null),
    line("b-zero", 0),
    line("c-25", 25),
    line("a-10", 10),
    line("default-50", 50, true),
  ];
  assertStatus(await request("POST", `/admin/products/${product.id}/draft`, draftPayload(product, {
    saleLines,
  })), 200);
  assertStatus(await request("POST", `/admin/products/${product.id}/publish`), 200);
  const publicProduct = (await publicProducts()).find((item) => item.id === product.id);
  assert.ok(publicProduct);
  assert.deepEqual(publicProduct.saleLines.map((item) => item.stockCode), [
    `default-50-${testRunId}`,
    `a-10-${testRunId}`,
    `c-25-${testRunId}`,
    `b-zero-${testRunId}`,
    `z-null-${testRunId}`,
  ]);
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

test("redirect lookup follows only the registered table entry", async () => {
  const product = await createProduct("legacy-redirect");
  const published = assertStatus(await request("POST", `/admin/products/${product.id}/publish`), 200);
  const fromPath = `/product/${published.slug}`;
  const toPath = "/products/forage-grain-crops";
  sql(`
    INSERT INTO ih_redirects (from_path, to_path)
    VALUES ('${fromPath.replaceAll("'", "''")}', '${toPath}')
    ON CONFLICT (from_path) DO UPDATE SET to_path = EXCLUDED.to_path, updated_at = now()
  `);
  assert.deepEqual(
    assertStatus(await request("GET", `/redirects/lookup?fromPath=${encodeURIComponent(fromPath)}`), 200),
    { toPath },
  );
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

test("redirect lookup does not steal a live product canonical path", async () => {
  const product = await createProduct("canonical-steal");
  const published = assertStatus(await request("POST", `/admin/products/${product.id}/publish`), 200);
  const categories = assertStatus(await request("GET", "/categories"), 200);
  const root = categories.find((category) => category.parentId === null && category.name === published.category);
  const categorySlug = root?.slug || published.category.toLowerCase().normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "catalogue";
  const canonical = `/products/${categorySlug}/${published.slug}`;
  sql(`
    INSERT INTO ih_redirects (from_path, to_path)
    VALUES ('${canonical.replaceAll("'", "''")}', '/products/${categorySlug}')
    ON CONFLICT (from_path) DO UPDATE SET to_path = EXCLUDED.to_path, updated_at = now()
  `);
  assert.equal(
    (await request("GET", `/redirects/lookup?fromPath=${encodeURIComponent(canonical)}`)).response.status,
    404,
  );
  const page = await fetch(`${webBaseUrl}${canonical}`, { redirect: "manual" });
  assert.equal(page.status, 200);
  sql(`DELETE FROM ih_redirects WHERE from_path = '${canonical.replaceAll("'", "''")}'`);
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

  const listedNew = assertStatus(await request("POST", `/admin/products/${product.id}/publish`, draftPayload(product, {
    listingState: "New",
    saleLines,
  })), 200);
  assert.equal(listedNew.listingState, "New");
  const publicNew = (await publicProducts()).find((item) => item.id === product.id);
  assert.ok(publicNew);
  assert.equal(publicNew.listingState, "New");
  assert.equal(includesProduct(await availability(), product.id), true);

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
    assertStatus(await request("GET", `/redirects/lookup?fromPath=${encodeURIComponent(`/products/${parent.slug}`)}`), 404);
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

test("taxonomy changes do not create redirects and moving a child updates live and draft root labels", async () => {
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
    assertStatus(await request("GET", `/redirects/lookup?fromPath=${encodeURIComponent(`/products/${redirectRoot.slug}/${removedChild.slug}`)}`), 404);
    assert.equal((await request("GET", "/categories")).data.some((category) => category.id === removedChild.id), false);

    assertStatus(await request("PATCH", `/admin/categories/${redirectRoot.id}`, { active: false }), 200);
    assertStatus(await request("GET", `/redirects/lookup?fromPath=${encodeURIComponent(`/products/${redirectRoot.slug}`)}`), 404);

    assertStatus(await request("POST", `/admin/products/${product.id}/publish`), 200);
    assertStatus(await request("PATCH", `/admin/categories/${movedChild.id}`, { parentId: destinationRoot.id }), 200);
    const categories = assertStatus(await request("GET", "/categories"), 200);
    assert.equal(categories.find((category) => category.id === movedChild.id)?.parentId, destinationRoot.id);
    assertStatus(await request("GET", `/redirects/lookup?fromPath=${encodeURIComponent(`/products/${sourceRoot.slug}/${movedChild.slug}`)}`), 404);
    assertStatus(await request("GET", `/redirects/lookup?fromPath=${encodeURIComponent(`/products/${sourceRoot.slug}`)}`), 404);
    const movedProduct = await adminProduct(product.id);
    assert.equal(movedProduct.category, destinationRoot.name);
    assert.equal(movedProduct.draft, null);
    assertStatus(await request("GET", `/redirects/lookup?fromPath=${encodeURIComponent(`/products/${sourceRoot.slug}/${movedProduct.slug}`)}`), 404);

    assertStatus(await request("PATCH", `/admin/categories/${movedChild.id}`, { parentId: null }), 200);
    const promotedCategories = assertStatus(await request("GET", "/categories"), 200);
    assert.equal(promotedCategories.find((category) => category.id === movedChild.id)?.parentId, null);
    assertStatus(await request("GET", `/redirects/lookup?fromPath=${encodeURIComponent(`/products/${destinationRoot.slug}/${movedChild.slug}`)}`), 404);
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

test("deleting taxonomy does not create redirect records", async () => {
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
    assertStatus(await request("GET", `/redirects/lookup?fromPath=${encodeURIComponent(`/products/${root.slug}/${deletedChild.slug}`)}`), 404);
    assertStatus(await request("GET", `/redirects/lookup?fromPath=${encodeURIComponent(`/products/${root.slug}/${survivingChild.slug}`)}`), 404);

    assertStatus(await request("DELETE", `/admin/categories/${survivingChild.id}`), 204);
    assertStatus(await request("DELETE", `/admin/categories/${root.id}`), 204);
    assertStatus(await request("GET", `/redirects/lookup?fromPath=${encodeURIComponent(`/products/${root.slug}`)}`), 404);
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
  if (!/^ih_catalogue_test_\d+_\d+$/.test(process.env.CATALOGUE_TEST_DATABASE ?? "")) {
    throw new Error("Lifecycle API tests must run through the isolated lifecycle-test runner");
  }
  const activeDatabase = sql("SELECT current_database()");
  if (activeDatabase !== process.env.CATALOGUE_TEST_DATABASE) {
    throw new Error(`Refusing destructive lifecycle tests in database ${activeDatabase}`);
  }
  const port = await freePort();
  baseUrl = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ["--enable-source-maps", "./dist/index.mjs"], {
    cwd: serverRoot,
    env: {
      ...process.env,
      NODE_ENV: "test",
      ADMIN_TEST_BYPASS: "1",
      PORT: String(port),
      AI_EXTRACT_STUB: "1",
      APP_STORAGE_BACKEND: "local",
    },
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

  const nextEnvPath = new URL("../../web/next-env.d.ts", import.meta.url);
  const nextEnvBeforeBuild = await readFile(nextEnvPath, "utf8");
  try {
    execFileSync(nextBin, ["build"], {
      cwd: webRoot,
      env: {
        ...process.env,
        NODE_ENV: "production",
        API_BASE: baseUrl,
        NEXT_DIST_DIR: ".next-lifecycle",
        NEXT_TSCONFIG_PATH: "tsconfig.lifecycle.json",
      },
      encoding: "utf8",
    });
  } finally {
    await writeFile(nextEnvPath, nextEnvBeforeBuild);
  }
  const webPort = await freePort();
  webBaseUrl = `http://127.0.0.1:${webPort}`;
  webChild = spawn(nextBin, ["start", "-p", String(webPort)], {
    cwd: webRoot,
    env: {
      ...process.env,
      NODE_ENV: "production",
      API_BASE: baseUrl,
      NEXT_DIST_DIR: ".next-lifecycle",
      NEXT_TSCONFIG_PATH: "tsconfig.lifecycle.json",
    },
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
  for (const id of createdArticleIds) {
    await request("DELETE", `/admin/articles/${id}`).catch(() => {});
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
  const unregisteredLegacyPage = await fetch(`${webBaseUrl}/product/${product.slug}`);
  assert.equal(unregisteredLegacyPage.status, 404);
  const originalRenderedPage = await fetch(`${webBaseUrl}/products/automated-tests/${product.slug}`);
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
  const adminAfterStock = await adminProduct(product.id);
  assert.equal(adminAfterStock.status, "low");
  assert.equal(adminAfterStock.availabilityOverride, "Low stock");
  assert.equal(adminAfterStock.draft, null);
  assert.equal((await availability()).find((item) => item.id === product.id).status, "low");
  assert.equal((await publicProducts()).find((item) => item.id === product.id).status, "low");

  assertStatus(await request("PATCH", `/products/${product.id}`, { name: `Illegal live edit ${testRunId}` }), 409);
  const unchangedLive = await adminProduct(product.id);
  assert.equal(unchangedLive.name, revisionName);
  assert.equal(unchangedLive.draft, null);
  const publicDetailResponse = await fetch(`${baseUrl}/api/products/slug/${product.slug}`);
  assert.equal(publicDetailResponse.status, 200);
  assert.equal(publicDetailResponse.headers.get("cache-control"), "no-store");
  assert.equal((await publicDetailResponse.json()).details.blurb, revisionBlurb);
  const renderedProductPage = await fetch(`${webBaseUrl}/products/automated-tests/${product.slug}`);
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

test("status patch updates derived stock without publishing leftover drafts", async () => {
  const product = await createProduct("bulk-stock");
  const leftoverName = `Leftover stock copy ${testRunId}`;
  const saleLines = [{
    stockCode: `bulk-${testRunId}`,
    seedForm: "",
    seedGrade: "",
    packKg: 25,
    packUnit: "kg",
    availability: "Good stock",
    priceDisplay: "Contact for pricing",
    isDefault: true,
    sortOrder: 0,
  }];
  const published = assertStatus(await request("POST", `/admin/products/${product.id}/publish`, draftPayload(product, {
    saleLines,
  })), 200);
  assert.equal(published.saleLines[0].availability, "Good stock");
  insertLeftoverDraft(published, {
    name: leftoverName,
    saleLines: [{ ...saleLines[0], availability: "Good stock" }],
  });

  const stockUpdated = assertStatus(await request("PATCH", `/products/${product.id}`, { status: "low" }), 200);
  assert.equal(stockUpdated.status, "low");

  const admin = await adminProduct(product.id);
  assert.equal(admin.name, published.name);
  assert.equal(admin.status, "low");
  assert.equal(admin.availabilityOverride, null);
  assert.equal(admin.saleLines[0].availability, "Low stock");
  assert.equal(admin.hasDraft, true);
  assert.equal(admin.draft.name, leftoverName);
  assert.equal(admin.draft.saleLines[0].availability, "Low stock");

  const publicProduct = (await publicProducts()).find((item) => item.id === product.id);
  assert.ok(publicProduct);
  assert.equal(publicProduct.name, published.name);
  assert.equal(publicProduct.status, "low");
  assert.equal(publicProduct.saleLines[0].availability, "Low stock");
  assert.equal((await availability()).find((item) => item.id === product.id).status, "low");

  assertStatus(await request("PATCH", `/products/${product.id}`, { name: `Illegal stock publish ${testRunId}` }), 409);
  const unchanged = await adminProduct(product.id);
  assert.equal(unchanged.name, published.name);
  assert.equal(unchanged.draft.name, leftoverName);
  assert.equal((await publicProducts()).find((item) => item.id === product.id).name, published.name);
});

test("export workbook matches the authoritative contract and round-trips cleanly", async () => {
  const exportResponse = await fetch(`${baseUrl}/api/admin/import/export`);
  assert.equal(exportResponse.status, 200);
  const exported = Buffer.from(await exportResponse.arrayBuffer());
  const book = xlsx.read(exported, { type: "buffer" });
  assert.deepEqual(book.SheetNames, ["1 Products", "2 Sowing rates", "3 Category specifics", "4 Sale lines",
    "5 Mix components", "7 Website SEO", "10 Product FAQs", "Lists"]);
  const listsIndex = book.SheetNames.indexOf("Lists");
  assert.equal(book.Workbook?.Sheets?.[listsIndex]?.Hidden ?? 0, 0);
  const headers = (name) => xlsx.utils.sheet_to_json(book.Sheets[name], { header: 1, defval: "", raw: false })[0];
  assert.deepEqual(headers("1 Products"), ["slug", "product_name", "category", "sub_category", "record_type", "botanical_name", "persistency_type", "australian_bred", "tagline", "blurb", "key_attributes", "description", "distribution_note", "rainfall_min_mm", "soil_ph_min", "soil_ph_scale", "soil_range_lightest", "soil_range_heaviest", "sowing_depth_min_cm", "sowing_depth_max_cm", "tolerance", "end_use", "livestock", "disease_pest_resistance", "stand_life_notes", "grazing_management_notes", "pbr_protected", "pbr_details", "certification", "formulation_year", "related_products", "photo_1", "tech_sheet_pdf_path", "website_url", "listing_state", "listing_override", "availability", "status"]);
  assert.deepEqual(headers("2 Sowing rates"), ["slug", "context", "min", "max", "unit"]);
  assert.deepEqual(headers("3 Category specifics"), ["slug", "category", "ploidy", "heading_date", "heading_offset_days", "argt_resistant", "endophyte", "growth_season", "maturity_days", "hard_seed_level", "oestrogen_level", "bloat_risk", "flower_colour", "winter_activity", "growing_season", "weeks_to_first_grazing", "prussic_acid_risk", "regrowth", "flowering_window", "product_form", "application_rate"]);
  assert.deepEqual(headers("4 Sale lines"), ["slug", "stock_code", "seed_form", "pack_kg", "pack_unit", "availability", "price_display", "is_default"]);
  assert.deepEqual(headers("5 Mix components"), ["mix_slug", "component_slug", "component_name", "inclusion_rate", "rate_unit", "component_description"]);
  assert.deepEqual(headers("7 Website SEO"), ["product_slug", "h1", "seo_title", "meta_description", "social_title", "social_description", "social_image", "canonical_url", "robots_index"]);
  assert.deepEqual(headers("10 Product FAQs"), ["slug", "product_name", "question", "answer"]);
  assert.equal(headers("Lists").includes("seed_grade"), false);
  assert.equal(headers("Lists").includes("guide_section"), false);
  assert.equal(headers("1 Products").includes("photo_2"), false);
  assert.equal(headers("1 Products").includes("featured"), false);

  const exportReport = assertStatus(await request("POST", "/admin/import/dry-run", {
    workbookBase64: exported.toString("base64"),
  }), 200);
  assert.deepEqual(exportReport.issues, []);
  assert.deepEqual(exportReport.warnings, []);
  assert.equal(exportReport.sheets["1 Products"].rows > 0, true);
});

test("product FAQs export, replace, clear, and validate through the workbook", async () => {
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
  assert.deepEqual((await adminProduct(product.id)).details.faqs, []);

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

test("malformed product identities and legacy URLs cannot trigger catalogue replacement", async () => {
  const sentinel = await createProduct("workbook-identity-sentinel");
  const makeIdentityWorkbook = (productRows) => {
    const book = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(book, xlsx.utils.json_to_sheet(productRows), "1 Products");
    xlsx.utils.book_append_sheet(book, xlsx.utils.json_to_sheet([{
      category: "Other",
      record_type: "Variety",
    }]), "Lists");
    return xlsx.write(book, { type: "buffer", bookType: "xlsx" });
  };
  const complete = {
    slug: `identity-${testRunId}`,
    product_name: "Identity validation fixture",
    category: "Other",
    record_type: "Variety",
    status: "Draft",
  };
  for (const required of ["slug", "product_name", "category", "record_type"]) {
    const workbook = makeIdentityWorkbook([{ ...complete, [required]: "" }]);
    const report = assertStatus(await request("POST", "/admin/import/dry-run", {
      workbookBase64: workbook.toString("base64"),
    }), 200);
    assert.equal(report.issues.some((issue) => issue.sheet === "1 Products" && issue.column === required), true);
    const blocked = await request("POST", "/admin/import/commit", {
      workbookBase64: workbook.toString("base64"),
      token: report.token,
    });
    assert.equal(blocked.response.status, 400);
    assert.equal((await request("GET", `/admin/products/${sentinel.id}`)).response.status, 200);
  }
  const duplicateWorkbook = makeIdentityWorkbook([
    complete,
    { ...complete, product_name: "Duplicate identity fixture" },
  ]);
  const duplicateReport = assertStatus(await request("POST", "/admin/import/dry-run", {
    workbookBase64: duplicateWorkbook.toString("base64"),
  }), 200);
  assert.equal(duplicateReport.issues.some((issue) => issue.column === "slug" && /Duplicate product slug/.test(issue.problem)), true);
  const blockedDuplicate = await request("POST", "/admin/import/commit", {
    workbookBase64: duplicateWorkbook.toString("base64"),
    token: duplicateReport.token,
  });
  assert.equal(blockedDuplicate.response.status, 400);
  assert.equal((await request("GET", `/admin/products/${sentinel.id}`)).response.status, 200);

  for (const websiteUrl of [
    "https://example.com/product/not-current-site",
    `https://www.irwinhunter.com.au/products/other/${complete.slug}`,
    "not a URL",
  ]) {
    const workbook = makeIdentityWorkbook([{ ...complete, website_url: websiteUrl }]);
    const report = assertStatus(await request("POST", "/admin/import/dry-run", {
      workbookBase64: workbook.toString("base64"),
    }), 200);
    assert.equal(report.issues.some((issue) => issue.column === "website_url"), true);
    const blocked = await request("POST", "/admin/import/commit", {
      workbookBase64: workbook.toString("base64"),
      token: report.token,
    });
    assert.equal(blocked.response.status, 400);
    assert.equal((await request("GET", `/admin/products/${sentinel.id}`)).response.status, 200);
  }

  const duplicateLegacyUrl = "https://www.irwinhunter.com.au/product/shared-old-path/";
  const duplicateUrlWorkbook = makeIdentityWorkbook([
    { ...complete, website_url: duplicateLegacyUrl },
    { ...complete, slug: `${complete.slug}-second`, website_url: duplicateLegacyUrl },
  ]);
  const duplicateUrlReport = assertStatus(await request("POST", "/admin/import/dry-run", {
    workbookBase64: duplicateUrlWorkbook.toString("base64"),
  }), 200);
  assert.equal(duplicateUrlReport.issues.some((issue) => issue.column === "website_url" &&
    /Duplicate legacy website path/.test(issue.problem)), true);
});

test("published workbook rows enforce content fields and delete products absent from an upsert", async () => {
  const categories = assertStatus(await request("GET", "/categories"), 200);
  const other = categories.find((category) => category.slug === "other");
  assert.ok(other, "Expected the seeded Other category");
  const imported = await createProduct("workbook-upsert", { category: other.name, subcategoryId: other.id });
  const absent = await createProduct("workbook-absent", { category: other.name, subcategoryId: other.id });
  const oldAssetId = `workbook-old-photo-${testRunId}`;
  sql(`
    INSERT INTO ih_media_assets (id, status, original_filename, storage_kind, object_path)
    VALUES ('${oldAssetId}', 'Ready', 'old-photo.jpg', 'legacy', '/legacy/old-photo.jpg');
    UPDATE ih_products
    SET listing_override = 'Legacy',
        details = jsonb_set(
          jsonb_set(
            jsonb_set(
              jsonb_set(details, '{bredByOrigin}', '"Preserved legacy value"'),
              '{supplierName}',
              '"Preserved supplier"'
            ),
            '{photos}',
            '[{"slot":"Photo 1 · Hero","file":"old-photo.jpg","rating":"","src":"","role":"hero","assetId":"${oldAssetId}"}]'::jsonb
          ),
          '{components}',
          '[
            {"productLink":"","speciesName":"Legacy component","inclusionRate":25,"unit":"%","description":"Old description","note":"Preserved component note"},
            {"productLink":"","speciesName":"Removed component","inclusionRate":15,"unit":"%","description":"Removed description","note":"Must not transfer"}
          ]'::jsonb
        )
    WHERE id = ${imported.id};
    INSERT INTO ih_media_references (asset_id, owner_type, owner_id, owner_name, field, role, usage_state)
    VALUES (
      '${oldAssetId}',
      'product',
      '${imported.id}',
      '${imported.name.replaceAll("'", "''")}',
      'details.photos[0]',
      'hero',
      'Draft'
    );
  `);
  insertLeftoverDraft(imported, { name: `Stale pre-import draft ${testRunId}` });
  const sourceDescription = "First editorial paragraph.\n\nSecond editorial paragraph.";
  const legacyWebsiteUrl = `https://irwinhunter.com.au/product/${imported.slug}/`;
  const staleRedirectPath = `/product/stale-${testRunId}`;
  sql(`INSERT INTO ih_redirects (from_path, to_path) VALUES ('${staleRedirectPath}', '/products/other/stale')`);
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
    website_url: legacyWebsiteUrl,
    status: "Published",
    distribution_note: "Workbook distribution note",
  };
  const makeWorkbook = (row) => {
    const book = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(book, xlsx.utils.json_to_sheet([row]), "1 Products");
    if (row.status === "Published") {
      xlsx.utils.book_append_sheet(book, xlsx.utils.json_to_sheet([{
        product_slug: row.slug,
         product_url: "https://legacy.example/ignored",
         menu_label: "Legacy menu label must not become SEO",
        seo_title: "Workbook SEO title",
        meta_description: "Workbook SEO description.",
        social_title: "Workbook social title",
        social_description: "Workbook social description.",
        social_image: "https://example.com/share.jpg",
        canonical_url: "https://example.com/product/canonical",
        robots_index: "N",
      }]), "7 Website SEO");
    }
    xlsx.utils.book_append_sheet(book, xlsx.utils.json_to_sheet([
      {
        mix_slug: row.slug,
        component_slug: "",
        component_name: "Replacement component",
        inclusion_rate: 10,
        rate_unit: "%",
        component_description: "New component",
      },
      {
        mix_slug: row.slug,
        component_slug: "",
        component_name: "Legacy component",
        inclusion_rate: 30,
        rate_unit: "%",
        component_description: "Updated description",
      },
    ]), "5 Mix components");
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
  const importedAdmin = await adminProduct(imported.id);
  assert.equal(importedAdmin.details.bredByOrigin, "Preserved legacy value");
  assert.equal(importedAdmin.details.supplierName, "Preserved supplier");
  assert.equal(importedAdmin.details.components[0].note, "");
  assert.equal(importedAdmin.details.components[1].note, "Preserved component note");
  assert.equal(importedAdmin.details.components[1].description, "Updated description");
  assert.equal(importedAdmin.listingState, "Active");
  assert.equal(importedAdmin.hasDraft, false);
  assert.equal(importedAdmin.draft, null);
  assert.equal(sql(`SELECT count(*) FROM ih_media_references WHERE owner_type = 'product' AND owner_id = '${imported.id}'`), "0");
  assert.equal(importedAdmin.websiteUrlLegacy, legacyWebsiteUrl);
  assert.equal(sql("SELECT count(*) FROM ih_redirects"), "1");
  assert.equal(sql(`SELECT to_path FROM ih_redirects WHERE from_path = '/product/${imported.slug}'`),
    `/products/${other.slug}/${imported.slug}`);
  assert.equal(sql(`SELECT count(*) FROM ih_redirects WHERE from_path = '${staleRedirectPath}'`), "0");
  assert.equal(importedAdmin.details.seoTitle, "Workbook SEO title");
  assert.equal((await adminProduct(imported.id)).details.socialTitle, "Workbook social title");
  assert.equal((await adminProduct(imported.id)).details.socialDescription, "Workbook social description.");
  assert.equal((await adminProduct(imported.id)).details.socialImage, "https://example.com/share.jpg");
  assert.equal((await adminProduct(imported.id)).details.canonicalUrl, "https://example.com/product/canonical");
  assert.equal((await adminProduct(imported.id)).details.robotsIndex, false);
  assert.equal((await request("GET", `/admin/products/${absent.id}`)).response.status, 404,
    "Products absent from the authoritative workbook are deleted");

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
  const reimport = assertStatus(await request("POST", "/admin/import/dry-run", {
    workbookBase64: exported.toString("base64"),
  }), 200);
  assert.deepEqual(reimport.issues, []);

});

test("blank workbook social image stores the hero photo and NULL stays empty", async () => {
  const categories = assertStatus(await request("GET", "/categories"), 200);
  const other = categories.find((category) => category.slug === "other");
  assert.ok(other, "Expected the seeded Other category");
  const product = await createProduct("workbook-social-hero", { category: other.name, subcategoryId: other.id });
  const hero = "https://example.com/hero.jpg";
  const makeWorkbook = ({ socialImage, includeSeoSheet }) => {
    const book = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(book, xlsx.utils.json_to_sheet([{
      slug: product.slug,
      product_name: product.name,
      category: other.name,
      record_type: "Variety",
      status: "Draft",
      photo_1: hero,
    }]), "1 Products");
    if (includeSeoSheet) {
      xlsx.utils.book_append_sheet(book, xlsx.utils.json_to_sheet([{
        product_slug: product.slug,
        social_image: socialImage,
      }]), "7 Website SEO");
    }
    xlsx.utils.book_append_sheet(book, xlsx.utils.json_to_sheet([{ category: other.name, record_type: "Variety" }]), "Lists");
    return xlsx.write(book, { type: "buffer", bookType: "xlsx" });
  };
  const commitWorkbook = async (options) => {
    const workbook = makeWorkbook(options);
    const report = assertStatus(await request("POST", "/admin/import/dry-run", {
      workbookBase64: workbook.toString("base64"),
    }), 200);
    assert.deepEqual(report.issues, []);
    assertStatus(await request("POST", "/admin/import/commit", {
      workbookBase64: workbook.toString("base64"),
      token: report.token,
    }), 200);
  };

  await commitWorkbook({ socialImage: "", includeSeoSheet: true });
  assert.equal((await adminProduct(product.id)).details.socialImage, hero);

  await commitWorkbook({ socialImage: "NULL", includeSeoSheet: true });
  assert.equal((await adminProduct(product.id)).details.socialImage, "");

  await commitWorkbook({ includeSeoSheet: false });
  assert.equal((await adminProduct(product.id)).details.socialImage, hero);

  await commitWorkbook({ socialImage: "https://example.com/share.jpg", includeSeoSheet: true });
  assert.equal((await adminProduct(product.id)).details.socialImage, "https://example.com/share.jpg");
});

test("retired companion, category, and redirect sheets are ignored with exact warnings", async () => {
  const book = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(book, xlsx.utils.json_to_sheet([{
    slug: `ignored-sheets-${testRunId}`, product_name: "Ignored sheets fixture",
    category: "Other", record_type: "Variety", status: "Draft",
  }]), "1 Products");
  xlsx.utils.book_append_sheet(book, xlsx.utils.json_to_sheet([{ slug: "ignored", companion_slug: "missing" }]), "6 Companions");
  xlsx.utils.book_append_sheet(book, xlsx.utils.json_to_sheet([{ slug: "ignored-category", name: "Ignored" }]), "8 Categories");
  xlsx.utils.book_append_sheet(book, xlsx.utils.json_to_sheet([{ from_path: "/old", to_path: "/new" }]), "9 Redirects");
  xlsx.utils.book_append_sheet(book, xlsx.utils.json_to_sheet([{ category: "Other", record_type: "Variety" }]), "Lists");
  const workbook = xlsx.write(book, { type: "buffer", bookType: "xlsx" });
  const report = assertStatus(await request("POST", "/admin/import/dry-run", {
    workbookBase64: workbook.toString("base64"),
  }), 200);
  assert.deepEqual(report.issues, []);
  assert.deepEqual(report.warnings, [
    "Sheet 6 Companions is no longer imported",
    "Sheet 8 Categories is no longer imported",
    "Sheet 9 Redirects is no longer imported",
  ]);
});

test("related product references must resolve within the uploaded workbook", async () => {
  const book = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(book, xlsx.utils.json_to_sheet([{
    slug: `related-invalid-${testRunId}`, product_name: "Related invalid fixture",
    category: "Other", record_type: "Variety", related_products: "missing-related-product",
  }]), "1 Products");
  xlsx.utils.book_append_sheet(book, xlsx.utils.json_to_sheet([{ category: "Other", record_type: "Variety" }]), "Lists");
  const report = assertStatus(await request("POST", "/admin/import/dry-run", {
    workbookBase64: xlsx.write(book, { type: "buffer", bookType: "xlsx" }).toString("base64"),
  }), 200);
  assert.equal(report.issues.some((issue) => issue.column === "related_products" &&
    /Unresolved product reference/.test(issue.problem)), true);
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

test("companion references are no longer validated by product publishing", async () => {
  const product = await createProduct("companion-owner");
  const result = assertStatus(await request("POST", `/admin/products/${product.id}/publish`, draftPayload(product, {
    details: { ...product.details, companionSpecies: [`unknown-companion-${testRunId}`] },
  })), 200);
  assert.deepEqual(result.details.companionSpecies, [`unknown-companion-${testRunId}`]);
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

test("site settings persist homepage and seed guide content for the public site", async () => {
  const original = assertStatus(await request("GET", "/site-settings"), 200);
  assert.equal(original.homepage.heroHeading, "Pasture Seed Specialists");
  assert.equal(original.seedGuide.navTitle, "Seed Guide 2026");
  assert.equal(original.seedGuide.pdfPublicUrl, "/IH-Seeds-2026-Pasture-Seed-Guide.pdf");

  const product = await createProduct("best-seller");
  const published = assertStatus(await request("POST", `/admin/products/${product.id}/publish`), 200);

  const saved = assertStatus(await request("PUT", "/admin/site-settings", {
    homepage: {
      ...original.homepage,
      heroEyebrow: "Lifecycle",
      heroHeading: "Edited specialists",
      heroBody: "We blend {productCount} for tests.",
      aboutBody: "Lifecycle About Us blurb.",
      bestSellerSlugs: [published.slug, "missing-best-seller"],
    },
    seedGuide: {
      navTitle: "Seed Guide Test",
      cardHeading: "Lifecycle seed guide card",
      cardButtonLabel: "Download the test guide",
      cardImageSrc: original.seedGuide.cardImageSrc,
      cardImageAssetId: original.seedGuide.cardImageAssetId,
      pageTitle: "Test Pasture Seed Guide",
      pageIntro: original.seedGuide.pageIntro,
      pageButtonLabel: original.seedGuide.pageButtonLabel,
    },
  }), 200);
  assert.equal(saved.homepage.heroHeading, "Edited specialists");
  assert.equal(saved.homepage.aboutBody, "Lifecycle About Us blurb.");
  assert.deepEqual(saved.homepage.bestSellerSlugs, [published.slug, "missing-best-seller"]);
  assert.equal(saved.seedGuide.navTitle, "Seed Guide Test");
  assert.equal(saved.seedGuide.pdfPublicUrl, "/IH-Seeds-2026-Pasture-Seed-Guide.pdf");

  const publicSettings = assertStatus(await request("GET", "/site-settings"), 200);
  assert.equal(publicSettings.homepage.heroHeading, "Edited specialists");
  assert.equal(publicSettings.seedGuide.navTitle, "Seed Guide Test");

  const homePage = await fetch(webBaseUrl);
  assert.equal(homePage.status, 200);
  const homeHtml = await homePage.text();
  assert.match(homeHtml, /Edited specialists/);
  assert.match(homeHtml, /Lifecycle About Us blurb/);
  assert.match(homeHtml, /Lifecycle seed guide card/);
  assert.match(homeHtml, /Seed Guide Test/);
  assert.match(homeHtml, new RegExp(`card-product-${published.id}`));

  const rejectedPdf = await request("POST", "/admin/site-settings/seed-guide-pdf", {
    filename: "not-a-pdf.txt",
    data: Buffer.from("hello").toString("base64"),
  });
  assert.equal(rejectedPdf.response.status, 400);

  const uploadedPdf = assertStatus(await request("POST", "/admin/site-settings/seed-guide-pdf", {
    filename: "lifecycle-seed-guide.pdf",
    data: textPdfBase64("Lifecycle seed guide"),
  }), 200);
  assert.equal(uploadedPdf.seedGuide.pdfFilename, "lifecycle-seed-guide.pdf");
  assert.equal(uploadedPdf.seedGuide.pdfPublicUrl, "/api/site/seed-guide.pdf");
  const pdf = await fetch(`${baseUrl}/api/site/seed-guide.pdf`);
  assert.equal(pdf.status, 200);
  assert.match(pdf.headers.get("content-type") ?? "", /pdf/);

  assertStatus(await request("PUT", "/admin/site-settings", {
    homepage: original.homepage,
    seedGuide: {
      navTitle: original.seedGuide.navTitle,
      cardHeading: original.seedGuide.cardHeading,
      cardButtonLabel: original.seedGuide.cardButtonLabel,
      cardImageSrc: original.seedGuide.cardImageSrc,
      cardImageAssetId: original.seedGuide.cardImageAssetId,
      pageTitle: original.seedGuide.pageTitle,
      pageIntro: original.seedGuide.pageIntro,
      pageButtonLabel: original.seedGuide.pageButtonLabel,
    },
  }), 200);
});

test("published blog articles appear on Resources immediately and drafts stay private", async () => {
  const slug = `lifecycle-article-${testRunId}`;
  const originalTitle = `Lifecycle original ${testRunId}`;
  const revisedTitle = `Lifecycle revised ${testRunId}`;
  const payload = {
    title: originalTitle,
    slug,
    excerpt: "Lifecycle article excerpt",
    body: "## Sowing window\n\nLifecycle body copy with a [contact link](/contact).",
    tags: ["Editorial"],
    seoTitle: `${originalTitle} | IH Seeds`,
    seoDescription: "Lifecycle article SEO description",
  };
  const incomplete = assertStatus(await request("POST", "/admin/articles", {
    title: `Incomplete ${testRunId}`,
    slug: `incomplete-article-${testRunId}`,
  }), 201);
  createdArticleIds.push(incomplete.id);
  const blockedPublish = await request("POST", `/admin/articles/${incomplete.id}/publish`);
  assert.equal(blockedPublish.response.status, 400);
  assert.match(JSON.stringify(blockedPublish.data), /Excerpt|Article body|SEO title|SEO description/);

  const created = assertStatus(await request("POST", "/admin/articles", payload), 201);
  createdArticleIds.push(created.id);
  assert.equal(created.publishStatus, "Draft");
  assert.equal((await request("GET", "/articles")).data.some((item) => item.id === created.id), false);
  assert.equal((await request("GET", `/articles/slug/${slug}`)).response.status, 404);

  const publicBeforePublish = await fetch(`${webBaseUrl}/resources`);
  assert.equal(publicBeforePublish.status, 200);
  const resourcesBefore = await publicBeforePublish.text();
  assert.doesNotMatch(resourcesBefore, new RegExp(originalTitle));

  const published = assertStatus(await request("POST", `/admin/articles/${created.id}/publish`), 200);
  assert.equal(published.publishStatus, "Published");
  const listed = assertStatus(await request("GET", "/articles"), 200);
  assert.equal(listed.some((item) => item.slug === slug), true);
  const publicArticle = assertStatus(await request("GET", `/articles/slug/${slug}`), 200);
  assert.equal(publicArticle.title, originalTitle);
  assert.equal("publishStatus" in publicArticle, false);
  assert.equal("heroImageAssetId" in publicArticle, false);

  const primedIndex = await fetch(`${webBaseUrl}/resources`);
  assert.equal(primedIndex.status, 200);
  assert.match(await primedIndex.text(), new RegExp(originalTitle));
  const primedPage = await fetch(`${webBaseUrl}/resources/${slug}`);
  assert.equal(primedPage.status, 200);
  const primedHtml = await primedPage.text();
  assert.match(primedHtml, new RegExp(originalTitle));
  assert.match(primedHtml, /Lifecycle article SEO description/);
  assert.match(primedHtml, /"@type":"Article"|og:type" content="article"/);

  const duplicate = await request("POST", "/admin/articles", { title: "Duplicate slug", slug, excerpt: "x", body: "y", seoTitle: "SEO", seoDescription: "SEO desc" });
  assert.equal(duplicate.response.status, 409);

  const invalidLink = await request("PATCH", `/admin/articles/${created.id}`, {
    relatedProductSlugs: [`missing-article-product-${testRunId}`],
  });
  assert.equal(invalidLink.response.status, 400);
  assert.match(JSON.stringify(invalidLink.data), /invalid product references/i);

  const product = await createProduct("article-link");
  const publishedProduct = assertStatus(await request("POST", `/admin/products/${product.id}/publish`), 200);
  assertStatus(await request("PATCH", `/admin/articles/${created.id}`, {
    title: revisedTitle,
    seoTitle: `${revisedTitle} | IH Seeds`,
    relatedProductSlugs: [publishedProduct.slug],
  }), 200);

  const revisedApi = assertStatus(await request("GET", `/articles/slug/${slug}`), 200);
  assert.equal(revisedApi.title, revisedTitle);
  assert.deepEqual(revisedApi.relatedProductSlugs, [publishedProduct.slug]);

  const revisedPage = await fetch(`${webBaseUrl}/resources/${slug}`);
  assert.equal(revisedPage.status, 200);
  const revisedHtml = await revisedPage.text();
  assert.match(revisedHtml, new RegExp(revisedTitle));
  assert.doesNotMatch(revisedHtml, new RegExp(originalTitle));
  assert.match(revisedHtml, new RegExp(publishedProduct.name));

  const sitemap = await fetch(`${baseUrl}/api/sitemap-articles`);
  assert.equal(sitemap.status, 200);
  const articleSitemap = await sitemap.text();
  assert.match(articleSitemap, new RegExp(`/resources/${slug}`));
  assert.match(articleSitemap, /<lastmod>\d{4}-\d{2}-\d{2}T/);
  const publicSitemap = await fetch(`${webBaseUrl}/sitemap.xml`);
  assert.equal(publicSitemap.status, 200);
  const publicSitemapXml = await publicSitemap.text();
  assert.match(publicSitemapXml, new RegExp(`/resources/${slug}`));
  assert.match(publicSitemapXml, new RegExp(`<loc>[^<]*/resources/${slug}</loc>\\s*<lastmod>`));

  assertStatus(await request("POST", `/admin/articles/${created.id}/unpublish`), 200);
  assert.equal((await request("GET", `/articles/slug/${slug}`)).response.status, 404);
  const unpublishedPage = await fetch(`${webBaseUrl}/resources/${slug}`);
  assert.equal(unpublishedPage.status, 404);
  const unpublishedIndex = await fetch(`${webBaseUrl}/resources`);
  assert.doesNotMatch(await unpublishedIndex.text(), new RegExp(revisedTitle));
});

function articleWorkbook(rows) {
  const book = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(book, xlsx.utils.json_to_sheet(rows), "Articles");
  return xlsx.write(book, { type: "buffer", bookType: "xlsx" });
}

test("blog article Excel import keeps HTML formatting and upserts by slug", async () => {
  const htmlSlug = `import-html-${testRunId}`;
  const markdownSlug = `import-md-${testRunId}`;
  const workbook = articleWorkbook([
    {
      title: `HTML import ${testRunId}`,
      slug: htmlSlug,
      excerpt: "HTML import excerpt",
      body: "<h2>Sowing window</h2><p>Plant <strong>early</strong> in autumn.</p>",
      tags: "Editorial|Sowing & Timing",
      seo_title: `HTML import ${testRunId} | IH Seeds`,
      seo_description: "HTML import SEO description",
      publish_status: "Published",
    },
    {
      title: `Markdown import ${testRunId}`,
      slug: markdownSlug,
      excerpt: "Markdown import excerpt",
      body: "## Feed planning\n\nUse **ryegrass** this season.",
      seo_title: `Markdown import ${testRunId} | IH Seeds`,
      seo_description: "Markdown import SEO description",
      publish_status: "Draft",
    },
  ]);
  const dryRun = assertStatus(await request("POST", "/admin/articles/import/dry-run", {
    workbookBase64: workbook.toString("base64"),
  }), 200);
  assert.equal(dryRun.created, 2);
  assert.equal(dryRun.issues.length, 0);
  assertStatus(await request("POST", "/admin/articles/import/commit", {
    workbookBase64: workbook.toString("base64"),
    token: dryRun.token,
  }), 200);

  const listed = assertStatus(await request("GET", "/admin/articles"), 200);
  const htmlArticle = listed.find((item) => item.slug === htmlSlug);
  const markdownArticle = listed.find((item) => item.slug === markdownSlug);
  assert.ok(htmlArticle);
  assert.ok(markdownArticle);
  createdArticleIds.push(htmlArticle.id, markdownArticle.id);
  assert.match(htmlArticle.body, /<h2>Sowing window<\/h2>/);
  assert.match(htmlArticle.body, /<strong>early<\/strong>/);
  assert.equal(htmlArticle.publishStatus, "Published");
  assert.match(markdownArticle.body, /<h2>Feed planning<\/h2>/);
  assert.match(markdownArticle.body, /<strong>ryegrass<\/strong>/);
  assert.equal(markdownArticle.publishStatus, "Draft");
  assert.equal((await request("GET", "/articles")).data.some((item) => item.slug === htmlSlug), true);
  assert.equal((await request("GET", `/articles/slug/${markdownSlug}`)).response.status, 404);

  const updateWorkbook = articleWorkbook([{
    title: `HTML import revised ${testRunId}`,
    slug: htmlSlug,
    excerpt: "HTML import excerpt",
    body: "<h3>Updated window</h3><p>Still <em>early</em>.</p>",
    seo_title: `HTML import revised ${testRunId} | IH Seeds`,
    seo_description: "HTML import SEO description",
    publish_status: "Published",
  }]);
  const updateDryRun = assertStatus(await request("POST", "/admin/articles/import/dry-run", {
    workbookBase64: updateWorkbook.toString("base64"),
  }), 200);
  assert.equal(updateDryRun.created, 0);
  assert.equal(updateDryRun.updated, 1);
  assertStatus(await request("POST", "/admin/articles/import/commit", {
    workbookBase64: updateWorkbook.toString("base64"),
    token: updateDryRun.token,
  }), 200);
  const revised = assertStatus(await request("GET", `/articles/slug/${htmlSlug}`), 200);
  assert.equal(revised.title, `HTML import revised ${testRunId}`);
  assert.match(revised.body, /<h3>Updated window<\/h3>/);

  const exported = await fetch(`${baseUrl}/api/admin/articles/export`);
  assert.equal(exported.status, 200);
  const exportedBook = xlsx.read(Buffer.from(await exported.arrayBuffer()), { type: "buffer" });
  assert.ok(exportedBook.Sheets.Articles);
  const exportedRows = xlsx.utils.sheet_to_json(exportedBook.Sheets.Articles, { defval: "", raw: false });
  const exportedHeaders = xlsx.utils.sheet_to_json(exportedBook.Sheets.Articles, { header: 1 })[0];
  assert.equal(exportedRows.some((row) => row.slug === htmlSlug), true);
  assert.equal(exportedHeaders.includes("published_at"), true);
  assert.ok(exportedBook.Sheets["Agent prompt"]);

  const template = await fetch(`${baseUrl}/api/admin/articles/import/template`);
  assert.equal(template.status, 200);
  const templateBook = xlsx.read(Buffer.from(await template.arrayBuffer()), { type: "buffer" });
  const templateHeaders = xlsx.utils.sheet_to_json(templateBook.Sheets.Articles, { header: 1 })[0];
  assert.deepEqual(templateHeaders, ["title", "slug", "excerpt", "body", "tags", "hero_image_src", "related_product_slugs", "seo_title", "seo_description", "social_title", "social_description", "social_image", "robots_index", "publish_status", "published_at", "scheduled_publish_at"]);
  assert.ok(templateBook.Sheets.Products);
  const productHeaders = xlsx.utils.sheet_to_json(templateBook.Sheets.Products, { header: 1 })[0];
  assert.deepEqual(productHeaders, ["slug", "name", "category", "category_slug", "path"]);
  const productRows = xlsx.utils.sheet_to_json(templateBook.Sheets.Products, { defval: "", raw: false });
  const catalogue = assertStatus(await request("GET", "/admin/products"), 200);
  const linkable = catalogue.find((product) => product.publishStatus === "Published" && product.listingState !== "Legacy");
  assert.ok(linkable);
  assert.equal(productRows.some((row) => row.slug === linkable.slug && String(row.category_slug).length > 0 && String(row.path).startsWith("/products/")), true);
  assert.ok(templateBook.Sheets.Categories);
  const categoryHeaders = xlsx.utils.sheet_to_json(templateBook.Sheets.Categories, { header: 1 })[0];
  assert.deepEqual(categoryHeaders, ["slug", "name", "path"]);
  const categoryRows = xlsx.utils.sheet_to_json(templateBook.Sheets.Categories, { defval: "", raw: false });
  const categories = assertStatus(await request("GET", "/admin/categories"), 200);
  const rootCategory = categories.find((category) => category.parentId == null && category.active);
  assert.ok(rootCategory);
  assert.equal(categoryRows.some((row) => row.slug === rootCategory.slug && row.path === `/products/${rootCategory.slug}`), true);
  const promptSheet = xlsx.utils.sheet_to_json(templateBook.Sheets["Agent prompt"], { header: 1, defval: "" });
  assert.match(String(promptSheet[1]?.[0] ?? ""), /published_at/);
  const prompt = await fetch(`${baseUrl}/api/admin/articles/import/prompt`);
  assert.equal(prompt.status, 200);
  assert.match(await prompt.text(), /published_at: optional public date for backdating/);
});

test("blog articles can be backdated on import, patch, and publish", async () => {
  const slug = `backdated-article-${testRunId}`;
  const publishedAt = "2024-03-18T01:00:00.000Z";
  const workbook = articleWorkbook([{
    title: `Backdated import ${testRunId}`,
    slug,
    excerpt: "Backdated import excerpt",
    body: "<p>Backdated body copy.</p>",
    seo_title: `Backdated import ${testRunId} | IH Seeds`,
    seo_description: "Backdated import SEO description",
    publish_status: "Published",
    published_at: publishedAt,
  }]);
  const dryRun = assertStatus(await request("POST", "/admin/articles/import/dry-run", {
    workbookBase64: workbook.toString("base64"),
  }), 200);
  assert.equal(dryRun.created, 1);
  assert.equal(dryRun.issues.length, 0);
  assert.match(dryRun.plannedChanges.join("\n"), /publish dated 2024-03-18T01:00:00.000Z/);
  assertStatus(await request("POST", "/admin/articles/import/commit", {
    workbookBase64: workbook.toString("base64"),
    token: dryRun.token,
  }), 200);

  const listed = assertStatus(await request("GET", "/admin/articles"), 200);
  const imported = listed.find((item) => item.slug === slug);
  assert.ok(imported);
  createdArticleIds.push(imported.id);
  assert.equal(imported.publishStatus, "Published");
  assert.equal(imported.publishedAt, publishedAt);
  const publicImported = assertStatus(await request("GET", `/articles/slug/${slug}`), 200);
  assert.equal(publicImported.publishedAt, publishedAt);

  const futureImport = assertStatus(await request("POST", "/admin/articles/import/dry-run", {
    workbookBase64: articleWorkbook([{
      title: `Future dated ${testRunId}`,
      slug: `future-dated-${testRunId}`,
      excerpt: "Future excerpt",
      body: "<p>Future body copy.</p>",
      seo_title: `Future dated ${testRunId} | IH Seeds`,
      seo_description: "Future dated SEO description",
      publish_status: "Published",
      published_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    }]).toString("base64"),
  }), 200);
  assert.equal(futureImport.created, 0);
  assert.equal(futureImport.issues.some((issue) => issue.column === "published_at"), true);

  const futurePatch = await request("PATCH", `/admin/articles/${imported.id}`, {
    publishedAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
  });
  assert.equal(futurePatch.response.status, 400);

  const revisedDate = "2023-11-02T08:30:00.000Z";
  const patched = assertStatus(await request("PATCH", `/admin/articles/${imported.id}`, {
    publishedAt: revisedDate,
  }), 200);
  assert.equal(patched.publishedAt, revisedDate);
  assert.equal((await request("GET", `/articles/slug/${slug}`)).data.publishedAt, revisedDate);

  const draft = assertStatus(await request("POST", "/admin/articles", {
    title: `Backdated publish ${testRunId}`,
    slug: `backdated-publish-${testRunId}`,
    excerpt: "Backdated publish excerpt",
    body: "<p>Backdated publish body.</p>",
    seoTitle: `Backdated publish ${testRunId} | IH Seeds`,
    seoDescription: "Backdated publish SEO description",
  }), 201);
  createdArticleIds.push(draft.id);
  const publishPast = "2022-06-15T00:00:00.000Z";
  const published = assertStatus(await request("POST", `/admin/articles/${draft.id}/publish`, {
    publishedAt: publishPast,
  }), 200);
  assert.equal(published.publishStatus, "Published");
  assert.equal(published.publishedAt, publishPast);
  const futurePublish = await request("POST", `/admin/articles/${draft.id}/publish`, {
    publishedAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
  });
  assert.equal(futurePublish.response.status, 400);
});

test("scheduled blog articles stay private until the publish time", async () => {
  const slug = `scheduled-article-${testRunId}`;
  const title = `Scheduled article ${testRunId}`;
  const created = assertStatus(await request("POST", "/admin/articles", {
    title,
    slug,
    excerpt: "Scheduled excerpt",
    body: "<p>Scheduled body copy.</p>",
    seoTitle: `${title} | IH Seeds`,
    seoDescription: "Scheduled SEO description",
  }), 201);
  createdArticleIds.push(created.id);

  const past = await request("POST", `/admin/articles/${created.id}/schedule`, {
    scheduledPublishAt: new Date(Date.now() - 60_000).toISOString(),
  });
  assert.equal(past.response.status, 400);

  const future = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  const scheduled = assertStatus(await request("POST", `/admin/articles/${created.id}/schedule`, {
    scheduledPublishAt: future,
  }), 200);
  assert.equal(scheduled.publishStatus, "Scheduled");
  assert.equal((await request("GET", "/articles")).data.some((item) => item.slug === slug), false);
  assert.equal((await request("GET", `/articles/slug/${slug}`)).response.status, 404);

  sql(`UPDATE ih_articles SET scheduled_publish_at = now() - interval '1 minute' WHERE id = ${created.id}`);
  const listed = assertStatus(await request("GET", "/articles"), 200);
  assert.equal(listed.some((item) => item.slug === slug), true);
  const publicArticle = assertStatus(await request("GET", `/articles/slug/${slug}`), 200);
  assert.equal(publicArticle.title, title);
  const live = assertStatus(await request("GET", `/admin/articles/${created.id}`), 200);
  assert.equal(live.publishStatus, "Published");
  assert.equal(live.scheduledPublishAt, null);
});


