import assert from "node:assert/strict";
import test from "node:test";
import { adminErrorMessage } from "../src/admin-error.ts";

test("plain API errors are shown as written", () => {
  assert.equal(adminErrorMessage({ error: "Article not found." }, "Fallback"), "Article not found.");
  assert.equal(adminErrorMessage(new Error("HTTP 400 Bad Request: Upload a JPEG, PNG, or WebP image up to 12 MB."), "Fallback"), "Upload a JPEG, PNG, or WebP image up to 12 MB.");
});

test("HTML 500 pages are hidden behind a fallback", () => {
  const html = `HTTP 500
<!DOCTYPE html>
<html><head><title>Error</title></head><body><pre>Internal Server Error</pre></body></html>`;
  assert.equal(adminErrorMessage(new Error(html), "Could not upload that image."), "Could not upload that image.");
});
