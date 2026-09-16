import assert from "node:assert/strict";
import { basename } from "node:path";
import test from "node:test";
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