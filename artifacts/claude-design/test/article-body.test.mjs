import assert from "node:assert/strict";
import test from "node:test";
import { appendArticleImage, articleBodyAssetIds, bodyHasText, markdownToHtml, normalizeArticleBody, sanitizeArticleHtml } from "../src/article-body.ts";

test("sanitizeArticleHtml keeps document tags and drops scripts", () => {
  const html = sanitizeArticleHtml('<p>Safe <strong>copy</strong></p><script>alert(1)</script><a href="javascript:alert(1)">bad</a><a href="/products/ryegrass">Ryegrass</a>');
  assert.equal(html.includes("<script"), false);
  assert.equal(html.includes("javascript:"), false);
  assert.equal(html.includes('<a href="/products/ryegrass">Ryegrass</a>'), true);
  assert.equal(html.includes("<strong>copy</strong>"), true);
});

test("markdownToHtml converts existing article markdown", () => {
  assert.equal(
    markdownToHtml("## When to sow\n\nAim for a **reliable** autumn break."),
    "<h2>When to sow</h2><p>Aim for a <strong>reliable</strong> autumn break.</p>",
  );
});

test("sanitizeArticleHtml keeps library images and drops unsafe ones", () => {
  const html = sanitizeArticleHtml('<p><img src="/api/media/4bb9e866-9848-4894-8bd3-95198eb7fb92" alt="Clover"></p><img src="javascript:alert(1)" alt="bad">');
  assert.equal(html.includes('/api/media/4bb9e866-9848-4894-8bd3-95198eb7fb92'), true);
  assert.equal(html.includes('alt="Clover"'), true);
  assert.equal(html.includes("javascript:"), false);
});

test("an image-only article body is kept", () => {
  const html = '<p><img src="/api/media/4bb9e866-9848-4894-8bd3-95198eb7fb92" alt="Clover"></p>';
  assert.equal(bodyHasText(html), true);
  assert.equal(normalizeArticleBody(html), html);
});

test("appendArticleImage adds a library photo and records its asset id", () => {
  const next = appendArticleImage("<p>Sowing notes</p>", "/api/admin/media/4bb9e866-9848-4894-8bd3-95198eb7fb92/preview", "Clover");
  assert.equal(next.includes("<p>Sowing notes</p>"), true);
  assert.equal(next.includes('<img src="/api/media/4bb9e866-9848-4894-8bd3-95198eb7fb92" alt="Clover">'), true);
  assert.deepEqual(articleBodyAssetIds(next), ["4bb9e866-9848-4894-8bd3-95198eb7fb92"]);
});

test("normalizeArticleBody treats empty editor markup as blank", () => {
  assert.equal(bodyHasText("<p><br></p>"), false);
  assert.equal(normalizeArticleBody("<p></p>"), "");
  assert.equal(normalizeArticleBody("Hello paddock"), "<p>Hello paddock</p>");
});
