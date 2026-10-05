import assert from "node:assert/strict";
import { test } from "node:test";
import {
  normalizeRedirectPath,
  planRedirectImport,
  type RedirectImportContext,
} from "../src/lib/redirect-import-plan.ts";

function context(overrides: Partial<RedirectImportContext> = {}): RedirectImportContext {
  return {
    existing: new Map(),
    managed: new Set(),
    liveProductPaths: new Set(),
    ...overrides,
  };
}

const header = "from_path,to_path\n";

test("paths and irwinhunter.com.au addresses normalise to a stored path", () => {
  assert.deepEqual(normalizeRedirectPath("/old-page/", "from"), { path: "/old-page" });
  assert.deepEqual(normalizeRedirectPath("https://www.irwinhunter.com.au/old/page/", "from"), { path: "/old/page" });
  assert.deepEqual(normalizeRedirectPath("/new#top", "to"), { path: "/new" });
  assert.deepEqual(normalizeRedirectPath("/tech-sheets?tab=a", "to"), { path: "/tech-sheets?tab=a" });
});

test("invalid addresses are rejected with a reason", () => {
  assert.ok(normalizeRedirectPath("old-page", "from").problem);
  assert.ok(normalizeRedirectPath("//evil.example/x", "to").problem);
  assert.ok(normalizeRedirectPath("https://example.com/x", "to").problem);
  assert.ok(normalizeRedirectPath("/old?x=1", "from").problem);
  assert.ok(normalizeRedirectPath("/has space", "from").problem);
  assert.ok(normalizeRedirectPath("", "to").problem);
  assert.ok(normalizeRedirectPath(`/${"a".repeat(600)}`, "from").problem);
});

test("new rows are created, changed rows updated and identical rows left alone", () => {
  const plan = planRedirectImport(
    `${header}/old-a,/products\n/old-b,/about\n/old-c,/contact\n,\n`,
    context({ existing: new Map([["/old-b", "/contact"], ["/old-c", "/contact"]]) }),
  );
  assert.deepEqual(plan.issues, []);
  assert.equal(plan.skipped, 1);
  assert.equal(plan.unchanged, 1);
  assert.deepEqual(plan.planned.map((item) => [item.fromPath, item.toPath, item.kind]), [
    ["/old-a", "/products", "create"],
    ["/old-b", "/about", "update"],
  ]);
});

test("a missing column is reported once and nothing is planned", () => {
  const plan = planRedirectImport("from,to\n/a,/b\n", context());
  assert.equal(plan.planned.length, 0);
  assert.equal(plan.issues.length, 1);
  assert.equal(plan.issues[0]?.row, 1);
});

test("duplicates, self redirects, reserved paths and the home page are issues", () => {
  const plan = planRedirectImport(
    `${header}/a,/b\n/a/,/c\n/same,/same\n/admin/x,/b\n/api,/b\n/,/b\n`,
    context(),
  );
  assert.deepEqual(plan.issues.map((issue) => issue.row), [3, 4, 5, 6, 7]);
  assert.match(plan.issues[0]?.problem ?? "", /Duplicate of row 2/);
  assert.deepEqual(plan.planned.map((item) => item.fromPath), ["/a"]);
});

test("paths owned by a product or article editor cannot be uploaded over", () => {
  const plan = planRedirectImport(
    `${header}/product/maximix,/products/mixes/other\n/old-blog,/articles/x\n/free,/products\n`,
    context({ managed: new Set(["/product/maximix", "/old-blog"]) }),
  );
  assert.deepEqual(plan.issues.map((issue) => issue.row), [2, 3]);
  assert.deepEqual(plan.planned.map((item) => item.fromPath), ["/free"]);
});

test("a live product page cannot be redirected away", () => {
  const plan = planRedirectImport(
    `${header}/products/lucerne/alpha-1,/products\n`,
    context({ liveProductPaths: new Set(["/products/lucerne/alpha-1"]) }),
  );
  assert.equal(plan.issues.length, 1);
  assert.match(plan.issues[0]?.problem ?? "", /live product/);
  assert.equal(plan.planned.length, 0);
});

test("redirect loops are caught across the file and the existing redirects", () => {
  const inFile = planRedirectImport(`${header}/a,/b\n/b,/a\n`, context());
  assert.equal(inFile.issues.length, 2);
  assert.equal(inFile.planned.length, 0);

  const viaExisting = planRedirectImport(
    `${header}/a,/b\n`,
    context({ existing: new Map([["/b", "/c"], ["/c", "/a"]]) }),
  );
  assert.equal(viaExisting.issues.length, 1);
  assert.match(viaExisting.issues[0]?.problem ?? "", /loop/);

  const chain = planRedirectImport(`${header}/a,/b\n`, context({ existing: new Map([["/b", "/c"]]) }));
  assert.deepEqual(chain.issues, []);
  assert.equal(chain.planned.length, 1);
});

test("a file over the row limit is refused", () => {
  const rows = Array.from({ length: 5001 }, (_, index) => `/old-${index},/new`).join("\n");
  const plan = planRedirectImport(`${header}${rows}\n`, context());
  assert.equal(plan.planned.length, 0);
  assert.match(plan.issues[0]?.problem ?? "", /at most 5000/);
});

test("quoted CSV cells and a byte order mark are handled", () => {
  const plan = planRedirectImport(`\uFEFFfrom_path,to_path\r\n"/old,page","/new"\r\n`, context());
  assert.deepEqual(plan.issues, []);
  assert.deepEqual(plan.planned.map((item) => item.fromPath), ["/old,page"]);
});
