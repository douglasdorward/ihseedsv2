import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createServer } from "node:net";
import { after, afterEach, before, test } from "node:test";
import { fileURLToPath } from "node:url";

const serverRoot = new URL("..", import.meta.url);
const testRunId = `${process.pid}-${Date.now()}`;
const createdProductIds = [];
const createdArticleIds = [];
const createdAssetIds = [];
let child;
let baseUrl;

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const PNG_RED_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVQImWP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==",
  "base64",
);

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
  assert.ok(port);
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

async function request(method, path, body, raw) {
  const response = await fetch(`${baseUrl}/api${path}`, {
    method,
    headers: raw
      ? { "content-type": "image/png" }
      : body === undefined ? undefined : { "content-type": "application/json" },
    body: raw ? body : body === undefined ? undefined : JSON.stringify(body),
  });
  const buffer = Buffer.from(await response.arrayBuffer());
  const text = buffer.toString("utf8");
  let data;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = buffer;
  }
  return { response, data, buffer };
}

function assertStatus(result, status) {
  assert.equal(result.response.status, status, typeof result.data === "object" ? JSON.stringify(result.data) : String(result.data));
  return result.data;
}

function isWebp(buffer) {
  return buffer.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WEBP";
}

async function uploadPng(filename = `media-${testRunId}.png`, bytes = PNG_1X1) {
  const requested = assertStatus(await request("POST", "/admin/media/upload-request", {
    originalFilename: filename,
    contentType: "image/png",
    bytes: bytes.length,
  }), 201);
  createdAssetIds.push(requested.assetId);
  assertStatus(await request("PUT", `/admin/media/${requested.assetId}/object`, bytes, true), 204);
  const completed = await request("POST", `/admin/media/${requested.assetId}/complete`);
  return { requested, completed };
}

before(async () => {
  if (!process.env.DATABASE_URL) {
    return;
  }
  const port = await freePort();
  baseUrl = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ["--enable-source-maps", "./dist/index.mjs"], {
    cwd: fileURLToPath(serverRoot),
    env: {
      ...process.env,
      NODE_ENV: process.env.CATALOGUE_TEST_DATABASE ? "test" : "development",
      ...(process.env.CATALOGUE_TEST_DATABASE ? { ADMIN_TEST_BYPASS: "1" } : {}),
      PORT: String(port),
      APP_STORAGE_BACKEND: "local",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  await waitForServer().catch((error) => {
    throw new Error(`${error.message}\n${stderr}`);
  });
});

afterEach(async () => {
  for (const id of createdProductIds) {
    await request("DELETE", `/products/${id}`).catch(() => {});
  }
  createdProductIds.length = 0;
  for (const id of createdArticleIds) {
    await request("DELETE", `/admin/articles/${id}`).catch(() => {});
  }
  createdArticleIds.length = 0;
  for (const id of createdAssetIds) {
    await request("DELETE", `/admin/media/${id}`, { confirm: true }).catch(() => {});
  }
  createdAssetIds.length = 0;
});

after(async () => {
  await stopChild(child);
});

test("jpeg/png upload completes as a WebP library asset", async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip("DATABASE_URL is not set");
    return;
  }
  const { completed } = await uploadPng("holdfast-gt-hero.png");
  const asset = assertStatus(completed, 200);
  assert.equal(asset.status, "Ready");
  assert.equal(asset.contentType, "image/webp");
  assert.equal(asset.defaultAlt, "Holdfast Gt Hero");
  assert.ok(asset.width >= 1);
  assert.ok(asset.height >= 1);
  const preview = await request("GET", `/admin/media/${asset.id}/preview`);
  assert.equal(preview.response.status, 200);
  assert.match(preview.response.headers.get("content-type") ?? "", /image\/webp/);
  assert.ok(isWebp(preview.buffer));
});

test("identical WebP conversion is reused as a duplicate", async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip("DATABASE_URL is not set");
    return;
  }
  const first = assertStatus((await uploadPng(`dup-a-${testRunId}.png`)).completed, 200);
  const second = await uploadPng(`dup-b-${testRunId}.png`);
  assert.equal(second.completed.response.status, 409);
  assert.equal(second.completed.data.asset.id, first.id);
});

test("reusing a duplicate fills a blank default alt from the filename", async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip("DATABASE_URL is not set");
    return;
  }
  const first = assertStatus((await uploadPng(`blank-alt-${testRunId}.png`)).completed, 200);
  assertStatus(await request("PATCH", `/admin/media/${first.id}`, { defaultAlt: "" }), 200);
  const blank = assertStatus(await request("GET", `/admin/media/${first.id}`), 200);
  assert.equal(blank.defaultAlt, "");

  const second = await uploadPng("margurita-serradella.png");
  assert.equal(second.completed.response.status, 409);
  assert.equal(second.completed.data.asset.id, first.id);
  assert.equal(second.completed.data.asset.defaultAlt, "Margurita Serradella");
});

test("public media is 404 until a product with that asset is published", async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip("DATABASE_URL is not set");
    return;
  }
  const asset = assertStatus((await uploadPng(`pub-${testRunId}.png`)).completed, 200);
  const unpublished = await request("GET", `/media/${asset.id}`);
  assert.equal(unpublished.response.status, 404);

  const slug = `media-lib-${testRunId}`;
  const created = assertStatus(await request("POST", "/products", {
    name: `Media library ${testRunId}`,
    slug,
    price: "",
    packSize: "",
    status: "in-stock",
    note: "",
    category: "Automated tests",
    subcategoryId: null,
    techSheet: "",
    details: { recordType: "Variety" },
  }), 201);
  createdProductIds.push(created.id);
  const photos = [{
    slot: "Photo 1 · Hero",
    file: asset.originalFilename,
    rating: "",
    src: `/api/media/${asset.id}`,
    assetId: asset.id,
    format: "webp",
    role: "hero",
  }];
  const drafted = assertStatus(await request("POST", `/admin/products/${created.id}/draft`, {
    name: created.name,
    price: created.price,
    packSize: created.packSize,
    status: created.status,
    note: created.note,
    category: created.category,
    subcategoryId: created.subcategoryId,
    techSheet: "",
    details: {
      ...created.details,
      tagline: "Media tagline",
      blurb: "Media blurb",
      keyAttributes: ["Has a photo"],
      description: "Media description",
      seoTitle: "Media SEO title",
      seoDescription: "Media SEO description",
      photos,
    },
  }), 200);
  const stillPrivate = await request("GET", `/media/${asset.id}`);
  assert.equal(stillPrivate.response.status, 404);

  assertStatus(await request("POST", `/admin/products/${drafted.id}/publish`, {
    name: drafted.name,
    price: drafted.price,
    packSize: drafted.packSize,
    status: drafted.status,
    note: drafted.note,
    category: drafted.category,
    subcategoryId: drafted.subcategoryId,
    techSheet: "",
    details: drafted.details,
  }), 200);
  const published = await request("GET", `/media/${asset.id}`);
  assert.equal(published.response.status, 200);
  assert.ok(isWebp(published.buffer));
  assert.equal(published.response.headers.get("cache-control"), "public, max-age=604800");

  const card = await request("GET", `/media/${asset.id}?size=card`);
  assert.equal(card.response.status, 200);
  assert.ok(isWebp(card.buffer));
  assert.equal(card.response.headers.get("cache-control"), "public, max-age=604800");
});

test("unpublished media stays private even when a card size is requested", async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip("DATABASE_URL is not set");
    return;
  }
  const asset = assertStatus((await uploadPng(`card-private-${testRunId}.png`)).completed, 200);
  const unpublished = await request("GET", `/media/${asset.id}?size=card`);
  assert.equal(unpublished.response.status, 404);
});

function sql(query) {
  return execFileSync("psql", [process.env.DATABASE_URL, "-X", "-v", "ON_ERROR_STOP=1", "-At", "-c", query], {
    encoding: "utf8",
  }).trim();
}

function quoted(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function refineNeeded() {
  return assertStatus(await request("GET", "/admin/media/refine-status"), 200).needed;
}

async function refineAll(limit) {
  const totals = { refined: 0, upToDate: 0, skipped: 0, failed: 0, batches: 0, firstTotal: null };
  let after = null;
  for (;;) {
    const body = after ? { after, limit } : { limit };
    const batch = assertStatus(await request("POST", "/admin/media/refine", body), 200);
    totals.batches += 1;
    const count = batch.refined + batch.upToDate + batch.skipped + batch.failed;
    assert.ok(count <= limit, "a batch never exceeds its limit");
    for (const key of ["refined", "upToDate", "skipped", "failed"]) totals[key] += batch[key];
    const handled = totals.refined + totals.upToDate + totals.skipped + totals.failed;
    // The client's total is what it has handled plus what the server says is left.
    if (totals.firstTotal === null) totals.firstTotal = handled + batch.remaining;
    assert.equal(handled + batch.remaining, totals.firstTotal, "the progress total stays stable");
    if (batch.done) {
      assert.equal(batch.nextCursor, null);
      assert.equal(batch.remaining, 0);
      return totals;
    }
    assert.equal(typeof batch.nextCursor, "string");
    after = batch.nextCursor;
    assert.ok(totals.batches < 1000, "refine batches must finish");
  }
}

test("new uploads are already refined and current images are never re-encoded", async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip("DATABASE_URL is not set");
    return;
  }
  const before = await refineNeeded();
  const current = await uploadPng(`refine-current-${testRunId}.png`, PNG_1X1);
  assertStatus(current.completed, 200);
  const oversized = await uploadPng(`refine-oversized-${testRunId}.png`, PNG_RED_1X1);
  assertStatus(oversized.completed, 200);
  assert.equal(await refineNeeded(), before, "fresh uploads already have both variants");

  // Simulate assets from before variant tracking: one whose files are already
  // current, and one recorded as larger than the 1600px master.
  const currentId = current.requested.assetId;
  const oversizedId = oversized.requested.assetId;
  const currentSha = sql(`SELECT sha256 FROM ih_media_assets WHERE id = ${quoted(currentId)}`);
  sql(`UPDATE ih_media_assets SET variants_version = 0 WHERE id IN (${quoted(currentId)}, ${quoted(oversizedId)})`);
  sql(`UPDATE ih_media_assets SET width = 3200 WHERE id = ${quoted(oversizedId)}`);
  assert.equal(await refineNeeded(), before + 2);

  const totals = await refineAll(5);
  assert.equal(totals.upToDate + totals.refined + totals.skipped + totals.failed, before + 2);
  assert.ok(totals.upToDate >= 1, "the already-current asset is stamped, not re-encoded");
  assert.ok(totals.refined >= 1, "the oversized asset is re-encoded");
  assert.equal(await refineNeeded(), totals.skipped + totals.failed);

  assert.equal(sql(`SELECT variants_version || ':' || sha256 FROM ih_media_assets WHERE id = ${quoted(currentId)}`), `1:${currentSha}`);
  assert.equal(sql(`SELECT variants_version || ':' || width FROM ih_media_assets WHERE id = ${quoted(oversizedId)}`), "1:1");

  const again = await refineAll(5);
  assert.equal(again.refined + again.upToDate, 0, "a second run has nothing left to refine");
});

test("refine walks images that need it in batches and reports progress", async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip("DATABASE_URL is not set");
    return;
  }
  const ours = [];
  for (const [index, bytes] of [PNG_1X1, PNG_RED_1X1].entries()) {
    const { requested, completed } = await uploadPng(`refine-batch-${index}-${testRunId}.png`, bytes);
    assertStatus(completed, 200);
    ours.push(requested.assetId);
  }
  sql(`UPDATE ih_media_assets SET variants_version = 0 WHERE id IN (${ours.map(quoted).join(", ")})`);
  const needed = await refineNeeded();
  assert.ok(needed >= ours.length);

  const totals = await refineAll(1);
  assert.equal(totals.firstTotal, needed);
  assert.equal(totals.refined + totals.upToDate + totals.skipped + totals.failed, needed, "every image needing it is handled exactly once");
  assert.equal(totals.batches, needed);

  for (const id of ours) {
    assert.equal(sql(`SELECT variants_version FROM ih_media_assets WHERE id = ${quoted(id)}`), "1");
  }

  assert.equal((await request("POST", "/admin/media/refine", { limit: 0 })).response.status, 400);
  assert.equal((await request("POST", "/admin/media/refine", { limit: 26 })).response.status, 400);
  assert.equal((await request("POST", "/admin/media/refine", { after: 42 })).response.status, 400);
});

test("confirmed delete also clears references from older site versions", async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip("DATABASE_URL is not set");
    return;
  }
  const stale = await uploadPng(`delete-stale-${testRunId}.png`, PNG_1X1);
  assertStatus(stale.completed, 200);
  const other = await uploadPng(`delete-other-${testRunId}.png`, PNG_RED_1X1);
  assertStatus(other.completed, 200);
  const staleId = stale.requested.assetId;
  const otherId = other.requested.assetId;
  sql(`INSERT INTO ih_media_references (asset_id, owner_type, owner_id, owner_name, field, usage_state)
    VALUES (${quoted(staleId)}, 'static', 'static:/resources:test', '/resources', 'Static source literal', 'Published')`);
  const deleted = await request("POST", "/admin/media/bulk-delete", { ids: [staleId, otherId], confirm: true });
  assert.equal(deleted.response.status, 204);
  assert.equal((await request("GET", `/admin/media/${staleId}`)).response.status, 404);
  assert.equal((await request("GET", `/admin/media/${otherId}`)).response.status, 404);
  assert.equal(sql(`SELECT count(*) FROM ih_media_references WHERE asset_id IN (${quoted(staleId)}, ${quoted(otherId)})`), "0");
});

test("attach inserts the new image as hero and shifts existing photos", async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip("DATABASE_URL is not set");
    return;
  }
  const created = assertStatus(await request("POST", "/products", {
    name: `Media attach ${testRunId}`,
    slug: `media-attach-${testRunId}`,
    price: "",
    packSize: "",
    status: "in-stock",
    note: "",
    category: "Automated tests",
    subcategoryId: null,
    techSheet: "",
    details: { recordType: "Variety" },
  }), 201);
  createdProductIds.push(created.id);

  const first = assertStatus((await uploadPng(`attach-a-${testRunId}.png`)).completed, 200);
  const attached = assertStatus(await request("POST", `/admin/media/${first.id}/attach`, { productId: created.id }), 200);
  assert.equal(attached.defaultAlt, created.name);
  const afterFirst = assertStatus(await request("GET", `/admin/products/${created.id}`), 200);
  assert.equal(afterFirst.details.photos[0].assetId, first.id);
  assert.equal(afterFirst.details.photos[0].role, "hero");
  assert.equal(afterFirst.details.photos[0].slot, "Photo 1 · Hero");
  assert.equal(afterFirst.details.photos[0].alt, created.name);

  const secondUpload = await uploadPng(`attach-b-${testRunId}.png`, PNG_RED_1X1);
  const second = assertStatus(secondUpload.completed, 200);
  assertStatus(await request("POST", `/admin/media/${second.id}/attach`, { productId: created.id }), 200);
  const afterSecond = assertStatus(await request("GET", `/admin/products/${created.id}`), 200);
  assert.equal(afterSecond.details.photos[0].assetId, second.id);
  assert.equal(afterSecond.details.photos[1].assetId, first.id);
  assert.equal(afterSecond.details.photos[1].slot, "Photo 2");
});

test("attach sets a library image as an article hero", async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip("DATABASE_URL is not set");
    return;
  }
  const article = assertStatus(await request("POST", "/admin/articles", {
    title: `Media attach article ${testRunId}`,
    slug: `media-attach-article-${testRunId}`,
    excerpt: "Attach test excerpt",
    body: "Attach test body",
    seoTitle: "Attach test SEO",
    seoDescription: "Attach test SEO description",
  }), 201);
  createdArticleIds.push(article.id);
  assert.equal(article.heroImageAssetId, null);

  const uploaded = assertStatus((await uploadPng(`attach-article-${testRunId}.png`)).completed, 200);
  const attached = assertStatus(await request("POST", `/admin/media/${uploaded.id}/attach`, { articleId: article.id }), 200);
  assert.equal(attached.id, uploaded.id);
  assert.equal(attached.defaultAlt, article.title);
  assert.equal(attached.usageSummary.article, 1);
  assert.equal(attached.usageSummary.draft, 1);
  assert.equal(attached.usageSummary.published, 0);

  const afterAttach = assertStatus(await request("GET", `/admin/articles/${article.id}`), 200);
  assert.equal(afterAttach.heroImageAssetId, uploaded.id);
  assert.equal(afterAttach.heroImageSrc, `/api/media/${uploaded.id}`);

  const missing = await request("POST", `/admin/media/${uploaded.id}/attach`, { articleId: 999999999 });
  assert.equal(missing.response.status, 404);
});

test("attach requires exactly one of productId or articleId", async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip("DATABASE_URL is not set");
    return;
  }
  const uploaded = assertStatus((await uploadPng(`attach-target-${testRunId}.png`)).completed, 200);
  const neither = await request("POST", `/admin/media/${uploaded.id}/attach`, {});
  assert.equal(neither.response.status, 400);
  const both = await request("POST", `/admin/media/${uploaded.id}/attach`, { productId: 1, articleId: 1 });
  assert.equal(both.response.status, 400);
  const invalid = await request("POST", `/admin/media/${uploaded.id}/attach`, { articleId: "abc" });
  assert.equal(invalid.response.status, 400);
});

test("product photos can be deleted and remaining photos move up", async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip("DATABASE_URL is not set");
    return;
  }
  const created = assertStatus(await request("POST", "/products", {
    name: `Media gallery delete ${testRunId}`,
    slug: `media-gallery-delete-${testRunId}`,
    price: "",
    packSize: "",
    status: "in-stock",
    note: "",
    category: "Automated tests",
    subcategoryId: null,
    techSheet: "",
    details: { recordType: "Variety" },
  }), 201);
  createdProductIds.push(created.id);

  const first = assertStatus((await uploadPng(`gallery-a-${testRunId}.png`)).completed, 200);
  assertStatus(await request("POST", `/admin/media/${first.id}/attach`, { productId: created.id }), 200);
  const second = assertStatus((await uploadPng(`gallery-b-${testRunId}.png`, PNG_RED_1X1)).completed, 200);
  assertStatus(await request("POST", `/admin/media/${second.id}/attach`, { productId: created.id }), 200);

  assertStatus(await request("DELETE", `/admin/media/${first.id}`, { confirm: true }), 204);
  const afterFirstDelete = assertStatus(await request("GET", `/admin/products/${created.id}`), 200);
  assert.equal(afterFirstDelete.details.photos[0].assetId, second.id);
  assert.ok(!afterFirstDelete.details.photos[1]?.assetId);
  assert.equal(afterFirstDelete.details.photos[1]?.src ?? "", "");
  const missing = await request("GET", `/admin/media/${first.id}`);
  assert.equal(missing.response.status, 404);

  assertStatus(await request("DELETE", `/admin/media/${second.id}`, { confirm: true }), 204);
  const afterHeroDelete = assertStatus(await request("GET", `/admin/products/${created.id}`), 200);
  assert.equal(afterHeroDelete.details.photos[0]?.assetId ?? "", "");
  assert.equal(afterHeroDelete.details.photos[0]?.src ?? "", "");
});

test("extra-slot photos can be deleted without leaving the hero", async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip("DATABASE_URL is not set");
    return;
  }
  const created = assertStatus(await request("POST", "/products", {
    name: `Media extra slot ${testRunId}`,
    slug: `media-extra-slot-${testRunId}`,
    price: "",
    packSize: "",
    status: "in-stock",
    note: "",
    category: "Automated tests",
    subcategoryId: null,
    techSheet: "",
    details: { recordType: "Variety" },
  }), 201);
  createdProductIds.push(created.id);

  const hero = assertStatus((await uploadPng(`extra-hero-${testRunId}.png`)).completed, 200);
  const extra = assertStatus((await uploadPng(`extra-slot-${testRunId}.png`, PNG_RED_1X1)).completed, 200);
  assertStatus(await request("POST", `/admin/products/${created.id}/draft`, {
    name: created.name,
    price: created.price,
    packSize: created.packSize,
    status: created.status,
    note: created.note,
    category: created.category,
    subcategoryId: created.subcategoryId,
    techSheet: "",
    details: {
      ...created.details,
      tagline: "Media tagline",
      blurb: "Media blurb",
      keyAttributes: ["Has extra photo"],
      description: "Media description",
      seoTitle: "Media SEO title",
      seoDescription: "Media SEO description",
      photos: [
        {
          slot: "Photo 1 · Hero",
          file: hero.originalFilename,
          rating: "",
          src: `/api/media/${hero.id}`,
          assetId: hero.id,
          format: "webp",
          role: "hero",
        },
        {
          slot: "Photo 2",
          file: extra.originalFilename,
          rating: "",
          src: `/api/media/${extra.id}`,
          assetId: extra.id,
          format: "webp",
        },
      ],
    },
  }), 200);

  assertStatus(await request("DELETE", `/admin/media/${extra.id}`, { confirm: true }), 204);
  const afterDelete = assertStatus(await request("GET", `/admin/products/${created.id}`), 200);
  assert.equal(afterDelete.details.photos[0].assetId, hero.id);
  assert.ok(!afterDelete.details.photos[1]?.assetId);

  assertStatus(await request("DELETE", `/admin/media/${hero.id}`, { confirm: true }), 204);
  const afterHeroDelete = assertStatus(await request("GET", `/admin/products/${created.id}`), 200);
  assert.equal(afterHeroDelete.details.photos[0]?.assetId ?? "", "");
});

test("complete uses owner context and keeps an editor-typed alt", async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip("DATABASE_URL is not set");
    return;
  }
  const requested = assertStatus(await request("POST", "/admin/media/upload-request", {
    originalFilename: "paddock-photo.png",
    contentType: "image/png",
    bytes: PNG_RED_1X1.length,
  }), 201);
  createdAssetIds.push(requested.assetId);
  assertStatus(await request("PUT", `/admin/media/${requested.assetId}/object`, PNG_RED_1X1, true), 204);
  const completed = assertStatus(await request("POST", `/admin/media/${requested.assetId}/complete`, {
    ownerName: "Holdfast GT",
    role: "hero",
  }), 200);
  assert.equal(completed.defaultAlt, "Holdfast GT");

  assertStatus(await request("PATCH", `/admin/media/${requested.assetId}`, {
    defaultAlt: "Cattle grazing Holdfast GT",
  }), 200);
  const created = assertStatus(await request("POST", "/products", {
    name: `Alt keep ${testRunId}`,
    slug: `alt-keep-${testRunId}`,
    price: "",
    packSize: "",
    status: "in-stock",
    note: "",
    category: "Automated tests",
    subcategoryId: null,
    techSheet: "",
    details: { recordType: "Variety" },
  }), 201);
  createdProductIds.push(created.id);
  const attached = assertStatus(await request("POST", `/admin/media/${requested.assetId}/attach`, { productId: created.id }), 200);
  assert.equal(attached.defaultAlt, "Cattle grazing Holdfast GT");
  const product = assertStatus(await request("GET", `/admin/products/${created.id}`), 200);
  assert.equal(product.details.photos[0].alt, "Cattle grazing Holdfast GT");
});
