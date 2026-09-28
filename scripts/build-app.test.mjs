import assert from "node:assert/strict";
import { basename } from "node:path";
import test from "node:test";
import { readFileSync } from "node:fs";
import { temporaryBuildApiCommand } from "./build-app-config.mjs";

test("the temporary build API starts the compiled server without maintenance commands", () => {
  assert.match(basename(temporaryBuildApiCommand.command), /^node(?:js)?$/);
  assert.deepEqual(temporaryBuildApiCommand.args, [
    "--enable-source-maps",
    "artifacts/api-server/dist/index.mjs",
  ]);

  const command = [temporaryBuildApiCommand.command, ...temporaryBuildApiCommand.args].join(" ");
  for (const forbidden of ["pnpm", "seed", "backfill", "migrate"]) {
    assert.doesNotMatch(command, new RegExp(`\\b${forbidden}\\b`, "i"));
  }
});

test("the compiled API entrypoint does not run media maintenance before listening", () => {
  const entry = readFileSync(new URL("../artifacts/api-server/src/index.ts", import.meta.url), "utf8");
  assert.doesNotMatch(entry, /repairProductPhotoLinks|backfillMediaUsage/);
  const scripts = JSON.parse(readFileSync(new URL("../artifacts/api-server/package.json", import.meta.url), "utf8")).scripts;
  assert.match(scripts.start, /backfill:media/);
  const maintenance = readFileSync(new URL("../artifacts/api-server/src/lib/media-usage.ts", import.meta.url), "utf8");
  assert.match(maintenance.slice(maintenance.indexOf("export async function backfillMediaUsage")), /assetIdFromPhoto/);
});