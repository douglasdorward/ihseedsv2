import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { build } from "../../api-server/node_modules/esbuild/lib/main.js";
import { join } from "node:path";
import { test } from "node:test";

const source = new URL("../src/password-recovery.ts", import.meta.url).pathname;
const bundle = join("/tmp", `ih-password-recovery-${process.pid}.mjs`);

test("password recovery retries reconciliation without resetting Clerk twice", async () => {
  await build({ entryPoints: [source], bundle: true, format: "esm", platform: "node", outfile: bundle });
  try {
    const { completePasswordRecovery } = await import(`file://${bundle}?v=${Date.now()}`);
    let resetCalls = 0;
    let activeCalls = 0;
    let reconcileCalls = 0;
    let providerCompleted = false;
    let failReconciliation = true;

    const dependencies = {
      password: "a password that is never logged",
      providerCompleted,
      resetPassword: async () => {
        resetCalls += 1;
        return { status: "complete", createdSessionId: "session-1" };
      },
      setActive: async () => {
        activeCalls += 1;
      },
      onProviderCompleted: () => {
        providerCompleted = true;
      },
      reconcile: async () => {
        reconcileCalls += 1;
        if (failReconciliation) throw new Error("temporary backend failure");
      },
    };

    await assert.rejects(completePasswordRecovery(dependencies), /temporary backend failure/);
    assert.equal(resetCalls, 1);
    assert.equal(activeCalls, 1);
    assert.equal(reconcileCalls, 1);
    assert.equal(providerCompleted, true);

    failReconciliation = false;
    await completePasswordRecovery({ ...dependencies, providerCompleted });
    assert.equal(resetCalls, 1);
    assert.equal(activeCalls, 1);
    assert.equal(reconcileCalls, 2);
  } finally {
    await rm(bundle, { force: true });
  }
});