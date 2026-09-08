import assert from "node:assert/strict";

const baseUrl = new URL(
  process.env.ROUTED_PRODUCT_BASE_URL ?? "http://localhost:80",
);

async function get(path) {
  const url = new URL(path, baseUrl);
  const response = await fetch(url, { redirect: "manual" });
  return {
    body: await response.text(),
    response,
    url,
  };
}

function assertStatus(result, expected) {
  assert.equal(
    result.response.status,
    expected,
    `${result.url.pathname} returned ${result.response.status}, expected ${expected}`,
  );
}

const home = await get("/");
assertStatus(home, 200);
assert.match(home.body, /\/_next\/static\//, "/ must load Next.js assets");
assert.doesNotMatch(
  home.body,
  /<title>Admin — IH Seeds<\/title>/,
  "/ must not return the retired Vite public shell",
);

for (const path of ["/products", "/products/herbs"]) {
  assertStatus(await get(path), 200);
}

for (const path of [
  "/products/not-a-real-category",
  "/category",
  "/category/herbs",
]) {
  assertStatus(await get(path), 404);
}

for (const path of [
  "/admin",
  "/admin/products",
  "/admin/products/categories",
]) {
  const admin = await get(path);
  assertStatus(admin, 200);
  assert.match(
    admin.body,
    /<title>Admin — IH Seeds<\/title>/,
    `${path} must return the admin bundle`,
  );
  assert.match(
    admin.body,
    /(?:src|href)="\/admin\/assets\/[^"]+"/,
    `${path} must load assets from /admin/`,
  );
  assert.doesNotMatch(
    admin.body,
    /(?:src|href)="\/assets\/[^"]+"/,
    `${path} must not load assets from the public root`,
  );
}

console.info(`Routed product smoke check passed at ${baseUrl.origin}`);