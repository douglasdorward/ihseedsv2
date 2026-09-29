import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";
import {
  COLUMN_GUIDE_HEADERS,
  COLUMN_GUIDE_SHEET,
  PRODUCT_SHEET_HEADERS,
  appendProductColumnGuide,
  columnGuideGaps,
} from "../src/lib/product-column-guide.ts";

test("column guide explains every exported product column once", () => {
  assert.deepEqual(columnGuideGaps(), []);

  const book = XLSX.utils.book_new();
  appendProductColumnGuide(book);
  assert.deepEqual(book.SheetNames, [COLUMN_GUIDE_SHEET]);
  const rows = XLSX.utils.sheet_to_json<string[]>(book.Sheets[COLUMN_GUIDE_SHEET], { header: 1, defval: "" });
  assert.deepEqual(rows[0], [...COLUMN_GUIDE_HEADERS]);
  assert.equal(book.Sheets[COLUMN_GUIDE_SHEET]["!freeze"]?.ySplit, 1);

  const documented = new Set(rows.slice(1).map((row) => `${row[0]}\t${row[1]}`));
  for (const [sheet, columns] of Object.entries(PRODUCT_SHEET_HEADERS)) {
    for (const column of columns) {
      assert.equal(documented.has(`${sheet}\t${column}`), true, `${sheet}.${column}`);
    }
  }
});

test("column guide is ignored by catalogue import", async () => {
  process.env.DATABASE_URL ||= "postgres://unused:unused@127.0.0.1:1/unused";
  const { dryRunWorkbook, importSheetNames } = await import("../src/lib/workbook.ts");
  assert.equal(importSheetNames.includes(COLUMN_GUIDE_SHEET as (typeof importSheetNames)[number]), false);

  const book = XLSX.utils.book_new();
  appendProductColumnGuide(book);
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet([{
    slug: "guide-check",
    product_name: "Guide check",
    category: "Ryegrasses",
    record_type: "Variety",
  }]), "1 Products");
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([["category"]]), "Lists");
  const report = dryRunWorkbook(XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer);
  assert.equal(report.issues.length, 0);
  assert.equal(report.sheets[COLUMN_GUIDE_SHEET], undefined);
  assert.equal(report.plannedChanges.includes("upsert product guide-check"), true);
});
