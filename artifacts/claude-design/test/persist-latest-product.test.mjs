import assert from "node:assert/strict";
import test from "node:test";
import { persistLatestProductAndPublish } from "../src/persist-latest-product.ts";

test("publish sends the latest editor snapshot and reconciles the published product", async () => {
  let editorDraft = { details: { blurb: "Old blurb" } };
  const calls = [];
  const reconciled = [];

  editorDraft = { details: { blurb: "Latest editor blurb" } };
  const published = await persistLatestProductAndPublish({
    getLatestDraft: () => editorDraft,
    publish: async (draft) => {
      calls.push(["publish", draft.details.blurb]);
      return { id: 1, lifecycleStatus: "Published", hasDraft: false, details: draft.details };
    },
    reconcile: (product) => reconciled.push(product),
  });

  assert.deepEqual(calls, [
    ["publish", "Latest editor blurb"],
  ]);
  assert.equal(reconciled[0], published);
  assert.equal(published.details.blurb, "Latest editor blurb");
});

test("publish saves the latest draft before publishing it", async () => {
  let editorDraft = { details: { blurb: "Unsaved blurb" } };
  const calls = [];

  const published = await persistLatestProductAndPublish({
    getLatestDraft: () => editorDraft,
    saveDraft: async (draft) => {
      calls.push(["save", draft.details.blurb]);
      editorDraft = { details: { blurb: `${draft.details.blurb} (saved)` } };
    },
    publish: async (draft) => {
      calls.push(["publish", draft.details.blurb]);
      return { id: 1, lifecycleStatus: "Published", details: draft.details };
    },
    reconcile: () => {},
  });

  assert.deepEqual(calls, [
    ["save", "Unsaved blurb"],
    ["publish", "Unsaved blurb (saved)"],
  ]);
  assert.equal(published.details.blurb, "Unsaved blurb (saved)");
});
