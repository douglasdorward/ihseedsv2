import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const serverRoot = new URL("..", import.meta.url);
const testRunId = `${process.pid}-${Date.now()}`;
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
  assert.equal(result.response.status, status, typeof result.data === "object" ? JSON.stringify(result.data) : String(result.data));
  return result.data;
}

before(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for reseller API tests");
  }
  if (!/^ih_catalogue_test_\d+_\d+$/.test(process.env.CATALOGUE_TEST_DATABASE ?? "")) {
    throw new Error("Reseller API tests must run through the isolated lifecycle-test runner");
  }
  const port = await freePort();
  baseUrl = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ["--enable-source-maps", "./dist/index.mjs"], {
    cwd: fileURLToPath(serverRoot),
    env: {
      ...process.env,
      NODE_ENV: "test",
      ADMIN_TEST_BYPASS: "1",
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

after(async () => {
  await stopChild(child);
});

describe("reseller API", { concurrency: false }, () => {
  test("public list omits brands that have no listed outlets", async () => {
    const publicList = assertStatus(await request("GET", "/resellers"), 200);
    const adminList = assertStatus(await request("GET", "/admin/resellers"), 200);
    for (const brand of adminList) {
      const listedOutlets = (brand.outlets ?? []).filter((outlet) => outlet.active);
      if (!brand.active || listedOutlets.length === 0) {
        assert.equal(publicList.some((item) => item.id === brand.id), false);
      }
    }
  });

  test("admin can create a brand and listed outlet that appears publicly", async () => {
    const brand = assertStatus(await request("POST", "/admin/resellers", {
      name: `Independent ${testRunId}`,
      kind: "independent",
      website: "https://farmers.example.test",
    }), 201);
    assert.equal(brand.kind, "independent");
    assert.equal(brand.active, true);
    assert.deepEqual(brand.outlets, []);

    const outlet = assertStatus(await request("POST", `/admin/resellers/${brand.id}/outlets`, {
      name: "Narrogin",
      address: "1 Main St",
      suburb: "Narrogin",
      postcode: "6312",
      region: "Wheatbelt",
      phone: "(08) 9881 1111",
      email: "narrogin@example.test",
      mapsUrl: "https://maps.google.com/?q=Narrogin",
    }), 201);
    assert.equal(outlet.name, "Narrogin");
    assert.equal(outlet.active, true);

    const publicList = assertStatus(await request("GET", "/resellers"), 200);
    const listed = publicList.find((item) => item.id === brand.id);
    assert.ok(listed);
    assert.equal(listed.outlets.length, 1);
    assert.equal(listed.outlets[0].name, "Narrogin");
    assert.equal(listed.outlets[0].mapsUrl, "https://maps.google.com/?q=Narrogin");

    const hiddenOutlet = assertStatus(await request("POST", `/admin/resellers/${brand.id}/outlets`, {
      name: "Wagin",
      region: "Wheatbelt",
      active: false,
    }), 201);
    const afterHide = assertStatus(await request("GET", "/resellers"), 200)
      .find((item) => item.id === brand.id);
    assert.equal(afterHide.outlets.some((item) => item.id === hiddenOutlet.id), false);

    assertStatus(await request("PATCH", `/admin/resellers/${brand.id}`, { active: false }), 200);
    const hiddenBrand = assertStatus(await request("GET", "/resellers"), 200)
      .find((item) => item.id === brand.id);
    assert.equal(hiddenBrand, undefined);
  });

  test("CSV import reuses Elders, creates independents, and updates matching outlets", async () => {
    const before = assertStatus(await request("GET", "/admin/resellers"), 200);
    const hadElders = before.some((brand) => brand.name === "Elders");
    const csvText = [
      "brand,kind,website,outlet_name,address,suburb,postcode,region,phone,email,google_pin,coordinates,listed",
      `Elders,elders,,Katanning ${testRunId},15 Clive St,Katanning,6317,Great Southern,(08) 9821 1455,katanning@example.test,https://maps.google.com/?q=Katanning,"-33.689, 117.555",yes`,
      `CRT ${testRunId},independent,https://crt.example.test,Esperance,2 Dempster St,Esperance,6450,Esperance,(08) 9071 3300,,https://maps.app.goo.gl/example,,yes`,
      `CRT ${testRunId},independent,,Esperance,2 Dempster Street,Esperance,6450,Esperance,(08) 9071 3300,esperance@example.test,,"-33.861, 121.891",yes`,
    ].join("\n");

    const dryRun = assertStatus(await request("POST", "/admin/resellers/import/dry-run", { csvText }), 200);
    assert.equal(dryRun.brandsCreated, hadElders ? 1 : 2);
    assert.equal(dryRun.outletsCreated, 2);
    assert.equal(dryRun.outletsUpdated, 1);
    assert.equal(dryRun.issues.length, 0);

    const committed = assertStatus(await request("POST", "/admin/resellers/import/commit", {
      csvText,
      token: dryRun.token,
    }), 200);
    assert.equal(committed.outletsCreated, 2);

    const updateRun = assertStatus(await request("POST", "/admin/resellers/import/dry-run", { csvText }), 200);
    assert.equal(updateRun.brandsCreated, 0);
    assert.equal(updateRun.outletsCreated, 0);
    assert.equal(updateRun.outletsUpdated, 3);

    assertStatus(await request("POST", "/admin/resellers/import/commit", {
      csvText,
      token: updateRun.token,
    }), 200);

    const publicList = assertStatus(await request("GET", "/resellers"), 200);
    const elders = publicList.find((brand) => brand.name === "Elders");
    const crt = publicList.find((brand) => brand.name === `CRT ${testRunId}`);
    assert.ok(elders);
    assert.equal(elders.outlets[0].name, `Katanning ${testRunId}`);
    assert.ok(crt);
    assert.equal(crt.website, "https://crt.example.test");
    assert.equal(crt.outlets.length, 1);
    assert.equal(crt.outlets[0].address, "2 Dempster Street");
    assert.equal(crt.outlets[0].email, "esperance@example.test");
    assert.ok(Math.abs(crt.outlets[0].latitude - -33.861) < 0.000001);
    assert.ok(Math.abs(crt.outlets[0].longitude - 121.891) < 0.000001);
    const katanning = elders.outlets.find((outlet) => outlet.name === `Katanning ${testRunId}`);
    assert.ok(katanning);
    assert.ok(Math.abs(katanning.latitude - -33.689) < 0.000001);
    assert.ok(Math.abs(katanning.longitude - 117.555) < 0.000001);
  });

  test("deleting a brand removes its outlets from the public list", async () => {
    const brand = assertStatus(await request("POST", "/admin/resellers", {
      name: `Delete me ${testRunId}`,
      kind: "independent",
    }), 201);
    assertStatus(await request("POST", `/admin/resellers/${brand.id}/outlets`, {
      name: "Temporary",
      region: "Midwest",
    }), 201);
    const before = assertStatus(await request("GET", "/resellers"), 200);
    assert.ok(before.some((item) => item.id === brand.id));

    const deleted = await request("DELETE", `/admin/resellers/${brand.id}`);
    assert.equal(deleted.response.status, 204);
    const after = assertStatus(await request("GET", "/resellers"), 200);
    assert.equal(after.some((item) => item.id === brand.id), false);
    const missing = await request("GET", `/admin/resellers/${brand.id}`);
    assert.equal(missing.response.status, 404);
  });

  test("a brand logo is returned once and shared by every outlet", async () => {
    const brand = assertStatus(await request("POST", "/admin/resellers", {
      name: `Shared logo ${testRunId}`,
      kind: "independent",
    }), 201);
    assertStatus(await request("POST", `/admin/resellers/${brand.id}/outlets`, {
      name: "North",
      region: "Wheatbelt",
    }), 201);
    assertStatus(await request("POST", `/admin/resellers/${brand.id}/outlets`, {
      name: "South",
      region: "Great Southern",
    }), 201);

    const updated = assertStatus(await request("PATCH", `/admin/resellers/${brand.id}`, {
      logoSrc: "/uploads/resellers/shared-logo.png",
    }), 200);
    assert.equal(updated.logoSrc, "/uploads/resellers/shared-logo.png");
    assert.equal(updated.outlets.length, 2);

    const admin = assertStatus(await request("GET", `/admin/resellers/${brand.id}`), 200);
    assert.equal(admin.logoSrc, "/uploads/resellers/shared-logo.png");
    assert.equal(admin.outlets.every((outlet) => outlet.name === "North" || outlet.name === "South"), true);

    const publicList = assertStatus(await request("GET", "/resellers"), 200);
    const listed = publicList.find((item) => item.id === brand.id);
    assert.equal(listed?.logoSrc, "/uploads/resellers/shared-logo.png");
    assert.equal(listed?.outlets.length, 2);
  });

  test("import template and validation errors are returned", async () => {
    const template = await request("GET", "/admin/resellers/import/template");
    assert.equal(template.response.status, 200);
    assert.match(String(template.data), /brand,kind,website,outlet_name/);

    const invalid = assertStatus(await request("POST", "/admin/resellers/import/dry-run", {
      csvText: "brand,kind,website,outlet_name,address,suburb,postcode,region,phone,email,google_pin,coordinates,listed\n,independent,,Town,,,,,,,,",
    }), 200);
    assert.ok(invalid.issues.some((issue) => issue.column === "brand"));

    const badCoordinates = assertStatus(await request("POST", "/admin/resellers/import/dry-run", {
      csvText: "brand,kind,website,outlet_name,address,suburb,postcode,region,phone,email,google_pin,coordinates,listed\nBad Coords,independent,,Town,,,,,,,,,not-a-place,yes",
    }), 200);
    assert.ok(badCoordinates.issues.some((issue) => issue.column === "coordinates"));

    const created = assertStatus(await request("POST", "/admin/resellers", {
      name: `Unique ${testRunId}`,
      kind: "independent",
    }), 201);
    const duplicate = await request("POST", "/admin/resellers", {
      name: created.name,
      kind: "independent",
    });
    assert.equal(duplicate.response.status, 409);
  });
});
