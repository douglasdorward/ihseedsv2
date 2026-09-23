import assert from "node:assert/strict";
import test from "node:test";
import { getProducts } from "./catalogue";

test("catalogue requests preserve Next.js dynamic-rendering signals", async (t) => {
  const previousBase = process.env.API_BASE;
  process.env.API_BASE = "http://catalogue.test";
  t.after(() => {
    if (previousBase === undefined) delete process.env.API_BASE;
    else process.env.API_BASE = previousBase;
  });
  const signal = Object.assign(new Error("Dynamic server usage"), { digest: "DYNAMIC_SERVER_USAGE" });
  t.mock.method(globalThis, "fetch", async () => { throw signal; });
  await assert.rejects(getProducts(), (error) => error === signal);
});

test("catalogue requests still explain genuine network failures", async (t) => {
  const previousBase = process.env.API_BASE;
  process.env.API_BASE = "http://catalogue.test";
  t.after(() => {
    if (previousBase === undefined) delete process.env.API_BASE;
    else process.env.API_BASE = previousBase;
  });
  const failure = new Error("fetch failed", { cause: { code: "ECONNREFUSED" } });
  t.mock.method(globalThis, "fetch", async () => { throw failure; });
  await assert.rejects(getProducts(), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.match(error.message, /Catalogue API could not be reached.*ECONNREFUSED/);
    assert.equal(error.cause, failure);
    return true;
  });
});