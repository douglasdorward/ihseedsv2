import assert from "node:assert/strict";
import test from "node:test";
import { uploadCancelCopy } from "../src/upload-cancel-copy.ts";

test("single-file cancel warning names the file and says it will be deleted", () => {
  const copy = uploadCancelCopy(["ryegrass.jpg"]);
  assert.equal(copy.title, "Cancel this upload?");
  assert.match(copy.body, /Are you sure you want to cancel the upload of “ryegrass.jpg”\?/);
  assert.match(copy.body, /deleted from the image library/);
  assert.match(copy.body, /will not be attached to a product/);
  assert.match(copy.body, /cannot be undone/);
  assert.equal(copy.confirmLabel, "Delete upload");
});

test("batch cancel warning lists files and distinguishes Skip from delete", () => {
  const copy = uploadCancelCopy(["one.jpg", "two.jpg"]);
  assert.equal(copy.title, "Cancel these uploads?");
  assert.match(copy.body, /Are you sure you want to cancel these 2 uploads\?/);
  assert.match(copy.body, /“one.jpg”/);
  assert.match(copy.body, /“two.jpg”/);
  assert.match(copy.body, /will not be attached to any product/);
  assert.match(copy.body, /press Skip/);
  assert.equal(copy.confirmLabel, "Delete uploads");
});
