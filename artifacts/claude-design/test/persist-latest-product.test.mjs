import assert from "node:assert/strict";
import test from "node:test";
import { persistLatestProductAndPublish } from "../src/persist-latest-product.ts";

test("publish saves the latest editor snapshot first and reconciles both server responses", async () => {
  let editorDraft = { details: { blurb: "Old blurb" } };
  const calls = [];
  const reconciled = [];

  editorDraft = { details: { blurb: "Latest editor blurb" } };
  const published = await persistLatestProductAndPublish({
    getLatestDraft: () => editorDraft,
    saveDraft: async (draft) => {
      calls.push(["save", draft.details.blurb]);
      return { id: 1, lifecycleStatus: "Published", hasDraft: true, draft };
    },
    publish: async () => {
      calls.push(["publish"]);
      return { id: 1, lifecycleStatus: "Published", hasDraft: false, details: editorDraft.details };
    },
    reconcile: (product) => reconciled.push(product),
  });

  assert.deepEqual(calls, [
    ["save", "Latest editor blurb"],
    ["publish"],
  ]);
  assert.equal(reconciled[0].draft.details.blurb, "Latest editor blurb");
  assert.equal(reconciled[1], published);
  assert.equal(published.details.blurb, "Latest editor blurb");
});