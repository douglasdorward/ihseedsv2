import assert from "node:assert/strict";
import { test } from "node:test";
import { ARTICLE_PDF_LIMIT } from "@workspace/db/schema";
import {
  ARTICLE_PDF_MAX_BYTES,
  adminArticlePdfs,
  assertPdfRoom,
  decodeArticlePdf,
  pdfContentDisposition,
  publicArticlePdfAccess,
  publicArticlePdfs,
  uniquePdfSlug,
} from "../src/lib/article-pdf.ts";

const samplePdf = Buffer.from("%PDF-1.4\n%test\n");

test("decodeArticlePdf accepts a PDF and rejects other files and oversize uploads", () => {
  const decoded = decodeArticlePdf(samplePdf.toString("base64"), "rates.pdf");
  assert.equal(decoded.subarray(0, 4).toString(), "%PDF");

  const dataUrl = `data:application/pdf;base64,${samplePdf.toString("base64")}`;
  assert.equal(decodeArticlePdf(dataUrl, "rates.pdf").length, samplePdf.length);

  assert.throws(() => decodeArticlePdf(Buffer.from("not a pdf").toString("base64"), "notes.txt"), /not a PDF/);
  assert.throws(() => decodeArticlePdf("", "empty.pdf"), /must be a PDF/);

  const tooLarge = Buffer.alloc(ARTICLE_PDF_MAX_BYTES + 1, 0);
  tooLarge.set(samplePdf.subarray(0, 4), 0);
  assert.throws(() => decodeArticlePdf(tooLarge.toString("base64"), "huge.pdf"), /15 MB/);
});

test("draft and scheduled article PDFs stay private, and noindex follows the article", () => {
  assert.deepEqual(publicArticlePdfAccess(null), { ok: false });
  assert.deepEqual(publicArticlePdfAccess({ publishStatus: "Draft", robotsIndex: true }), { ok: false });
  assert.deepEqual(publicArticlePdfAccess({ publishStatus: "Scheduled", robotsIndex: true }), { ok: false });
  assert.deepEqual(publicArticlePdfAccess({ publishStatus: "Published", robotsIndex: true }), { ok: true, noindex: false });
  assert.deepEqual(publicArticlePdfAccess({ publishStatus: "Published", robotsIndex: false }), { ok: true, noindex: true });
});

test("PDF addresses are stable slugs and public records omit the storage key", () => {
  assert.equal(uniquePdfSlug("Ryegrass sowing rates", []), "ryegrass-sowing-rates");
  assert.equal(uniquePdfSlug("Ryegrass sowing rates!", ["ryegrass-sowing-rates"]), "ryegrass-sowing-rates-2");
  assert.throws(() => assertPdfRoom(ARTICLE_PDF_LIMIT), /8 PDFs/);
  assert.doesNotThrow(() => assertPdfRoom(ARTICLE_PDF_LIMIT - 1));

  const stored = [{
    slug: "ryegrass-sowing-rates",
    title: "Ryegrass sowing rates",
    filename: "rates.pdf",
    storageKey: "articles/4/ryegrass-sowing-rates.pdf",
    bytes: samplePdf.length,
  }];
  assert.deepEqual(publicArticlePdfs("autumn-sowing", stored), [{
    slug: "ryegrass-sowing-rates",
    title: "Ryegrass sowing rates",
    href: "/articles/autumn-sowing/ryegrass-sowing-rates.pdf",
  }]);
  assert.deepEqual(adminArticlePdfs(stored), [{
    slug: "ryegrass-sowing-rates",
    title: "Ryegrass sowing rates",
    filename: "rates.pdf",
    bytes: samplePdf.length,
  }]);
  assert.equal(pdfContentDisposition('say "hello".pdf').includes('"'), true);
  assert.equal(pdfContentDisposition('say "hello".pdf').includes('say "hello"'), false);
});
