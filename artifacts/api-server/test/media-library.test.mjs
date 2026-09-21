import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { after, afterEach, before, test } from "node:test";

const serverRoot = new URL("..", import.meta.url);
const testRunId = `${process.pid}-${Date.now()}`;
const createdProductIds = [];
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
    cwd: new URL(serverRoot).pathname,
    env: { ...process.env, NODE_ENV: "development", PORT: String(port), APP_STORAGE_BACKEND: "local" },
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

  const blocked = await request("DELETE", `/admin/media/${asset.id}`, { confirm: true });
  assert.equal(blocked.response.status, 409);

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
