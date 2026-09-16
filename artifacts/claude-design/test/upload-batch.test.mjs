import assert from "node:assert/strict";
import test from "node:test";
import { runUploadBatch, successfulUploadValues } from "../src/upload-batch.ts";

test("one rejected upload does not stop the rest of the batch", async () => {
  const attempted = [];
  const settled = [];
  const results = await runUploadBatch(
    ["first", "broken", "last"],
    async (name) => {
      attempted.push(name);
      if (name === "broken") throw new Error("Storage unavailable");
      return `${name}-uploaded`;
    },
    {
      concurrency: 2,
      onSettled: (result) => settled.push(result.status),
    },
  );

  assert.deepEqual(attempted.sort(), ["broken", "first", "last"]);
  assert.equal(results[0].status, "fulfilled");
  assert.equal(results[1].status, "rejected");
  assert.equal(results[2].status, "fulfilled");
  assert.equal(settled.length, 3);
});

test("batch concurrency stays within its configured limit", async () => {
  let active = 0;
  let peak = 0;
  await runUploadBatch(
    [1, 2, 3, 4, 5],
    async (item) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return item;
    },
    { concurrency: 2 },
  );
  assert.equal(peak, 2);
});

test("only completed uploads are handed to the next step", () => {
  const values = successfulUploadValues([
    { status: "complete", value: "first-photo" },
    { status: "failed" },
    { status: "complete", value: "last-photo" },
  ]);
  assert.deepEqual(values, ["first-photo", "last-photo"]);
});