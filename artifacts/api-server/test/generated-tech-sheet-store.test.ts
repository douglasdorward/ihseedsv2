import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer, type IncomingHttpHeaders } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

process.env.DATABASE_URL ??= "postgres://localhost/unused";
const uploads = await mkdtemp(path.join(tmpdir(), "tech-sheet-store-"));
process.env.APP_STORAGE_BACKEND = "local";
process.env.APP_UPLOADS_DIR = uploads;

const {
  canStoreGeneratedTechSheet,
  generatedTechSheetKey,
  generatedTechSheetPrefix,
  isTechSheetVersion,
  prebuildGeneratedTechSheet,
  removeGeneratedTechSheets,
  techSheetStoreToken,
  techSheetWebBase,
} = await import("../src/lib/generated-tech-sheet.ts");
const { listStoredFiles, putStoredFile, storedFileExists } = await import("../src/lib/app-storage.ts");

test.after(async () => {
  await rm(uploads, { recursive: true, force: true });
});

const V1 = "a".repeat(64);
const V2 = "b".repeat(64);

function withEnv(values: Record<string, string | undefined>, run: () => Promise<void> | void) {
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  const restore = () => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
  return Promise.resolve().then(run).finally(restore);
}

test("a loopback address alone cannot store a sheet, because the website proxies /api over loopback", () => withEnv({ TECH_SHEET_REFRESH_TOKEN: undefined, SESSION_SECRET: undefined }, () => {
  assert.equal(techSheetStoreToken(), null);
  assert.equal(canStoreGeneratedTechSheet(undefined), false);
  assert.equal(canStoreGeneratedTechSheet("local-tech-sheet-refresh"), false);
}));

test("the website's token, derived from the shared session secret, allows storing", () => withEnv({ TECH_SHEET_REFRESH_TOKEN: undefined, SESSION_SECRET: "session-secret" }, () => {
  const token = techSheetStoreToken();
  assert.match(token ?? "", /^[a-f0-9]{64}$/);
  assert.notEqual(token, "session-secret");
  assert.equal(canStoreGeneratedTechSheet(token ?? undefined), true);
  assert.equal(canStoreGeneratedTechSheet("wrong"), false);
  assert.equal(canStoreGeneratedTechSheet(undefined), false);
}));

test("a configured token replaces the derived one", () => withEnv({ TECH_SHEET_REFRESH_TOKEN: "production-token", SESSION_SECRET: "session-secret" }, () => {
  assert.equal(canStoreGeneratedTechSheet("production-token"), true);
  assert.equal(canStoreGeneratedTechSheet("production-tokex"), false);
}));

test("stored sheets are named by content fingerprint, separately for the live site and development", () => {
  assert.equal(isTechSheetVersion(V1), true);
  assert.equal(isTechSheetVersion("../../etc"), false);
  assert.equal(isTechSheetVersion("A".repeat(64)), false);
  assert.equal(generatedTechSheetKey("maximix", V1, {}), `generated-tech-sheets/development/maximix/${V1}.pdf`);
  assert.equal(generatedTechSheetKey("maximix", V1, { REPLIT_DEPLOYMENT: "1" }), `generated-tech-sheets/production/maximix/${V1}.pdf`);
  assert.notEqual(generatedTechSheetKey("maximix", V1, {}), generatedTechSheetKey("maximix", V2, {}));
});

test("a product change leaves the old sheet unservable and storing the new one removes it", () => withEnv({ REPLIT_DEPLOYMENT: undefined }, async () => {
  const pdf = Buffer.from("%PDF-1.7 test");
  await putStoredFile("generated-tech-sheets/maximix.pdf", pdf, "application/pdf");
  await putStoredFile(generatedTechSheetKey("maximix", V1), pdf, "application/pdf");
  await putStoredFile(generatedTechSheetKey("maximix-two", V1), pdf, "application/pdf");

  // After an edit the website asks for V2; the V1 file is never looked up.
  assert.equal(await storedFileExists(generatedTechSheetKey("maximix", V2)), false);

  await putStoredFile(generatedTechSheetKey("maximix", V2), pdf, "application/pdf");
  await removeGeneratedTechSheets("maximix", V2);

  assert.deepEqual(await listStoredFiles(generatedTechSheetPrefix("maximix")), [generatedTechSheetKey("maximix", V2)]);
  assert.equal(await storedFileExists("generated-tech-sheets/maximix.pdf"), false);
  assert.equal(await storedFileExists(generatedTechSheetKey("maximix-two", V1)), true, "a product whose slug starts the same is untouched");

  await removeGeneratedTechSheets("maximix");
  assert.deepEqual(await listStoredFiles(generatedTechSheetPrefix("maximix")), []);
}));

test("preparing a sheet calls the website at the configured address", async () => {
  const seen: Array<{ url: string | undefined; headers: IncomingHttpHeaders }> = [];
  const server = createServer((req, res) => {
    seen.push({ url: req.url, headers: req.headers });
    res.writeHead(204).end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  try {
    await withEnv({ WEB_BASE: `http://127.0.0.1:${port}/`, TECH_SHEET_REFRESH_TOKEN: "shared-token" }, async () => {
      assert.equal(techSheetWebBase(), `http://127.0.0.1:${port}`);
      assert.equal(await prebuildGeneratedTechSheet("maximix"), true);
    });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  assert.equal(seen.length, 1);
  assert.equal(seen[0].url, "/tech-sheets/maximix");
  assert.equal(seen[0].headers["x-tech-sheet-refresh"], "shared-token");
});

test("without a configured website address nothing is called", () => withEnv({ WEB_BASE: undefined }, async () => {
  assert.equal(techSheetWebBase(), null);
  assert.equal(await prebuildGeneratedTechSheet("maximix"), false);
}));
