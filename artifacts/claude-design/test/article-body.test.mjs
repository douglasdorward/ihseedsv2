import assert from "node:assert/strict";
import test from "node:test";
import { bodyHasText, markdownToHtml, normalizeArticleBody, sanitizeArticleHtml } from "../src/article-body.ts";

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

test("normalizeArticleBody treats empty editor markup as blank", () => {
  assert.equal(bodyHasText("<p><br></p>"), false);
  assert.equal(normalizeArticleBody("<p></p>"), "");
  assert.equal(normalizeArticleBody("Hello paddock"), "<p>Hello paddock</p>");
});
