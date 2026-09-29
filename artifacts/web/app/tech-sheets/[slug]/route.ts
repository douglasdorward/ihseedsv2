import { NextResponse } from "next/server";
import {
  currentTechSheet,
  ensureTechSheetStored,
  isTechSheetRefresh,
  TECH_SHEET_REFRESH_HEADER,
  techSheetDownloadName,
  techSheetPdf,
} from "../../../lib/tech-sheet-pdf";

export const dynamic = "force-dynamic";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function pdfResponse(bytes: Buffer, filename: string, request: Request, etag: string) {
  const size = bytes.length;
  const headers = {
    ETag: etag,
    "Content-Type": "application/pdf",
    "Content-Disposition": `inline; filename="${filename}"`,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-cache",
  };
  const range = request.headers.get("range");
  if (!range) {
    return new NextResponse(new Uint8Array(bytes), {
      headers: { ...headers, "Content-Length": String(size) },
    });
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  if (!match) {
    return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  }
  let start = match[1] ? Number(match[1]) : NaN;
  let end = match[2] ? Number(match[2]) : size - 1;
  if (!match[1] && match[2]) {
    start = Math.max(size - Number(match[2]), 0);
    end = size - 1;
  }
  if (!Number.isInteger(start) || start < 0 || start >= size || end < start) {
    return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  }
  end = Math.min(end, size - 1);
  const slice = bytes.subarray(start, end + 1);
  return new NextResponse(new Uint8Array(slice), {
    status: 206,
    headers: {
      ...headers,
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Content-Length": String(slice.length),
    },
  });
}

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  if (!SLUG.test(slug)) return new NextResponse("Not found", { status: 404 });
  const prepareOnly = isTechSheetRefresh(request.headers.get(TECH_SHEET_REFRESH_HEADER));
  try {
    const sheet = await currentTechSheet(slug);
    if (!sheet) return new NextResponse("Not found", { status: 404 });
    if (prepareOnly) {
      const state = await ensureTechSheetStored(slug, sheet);
      return new NextResponse(null, { status: 204, headers: { "X-Tech-Sheet": state } });
    }
    if (request.headers.get("if-none-match") === `"${sheet.version}"`) {
      return new NextResponse(null, { status: 304, headers: { ETag: `"${sheet.version}"`, "Cache-Control": "private, no-cache" } });
    }
    const pdf = await techSheetPdf(slug, sheet);
    if (!pdf) return new NextResponse("Not found", { status: 404 });
    return pdfResponse(pdf.bytes, techSheetDownloadName(pdf.sheet.product.name), request, `"${pdf.sheet.version}"`);
  } catch (error) {
    console.error(`Tech sheet generation failed for ${slug}`, error);
    return new NextResponse(
      "Sorry, this tech sheet can't be downloaded right now. Please try again in a few minutes, or contact us and we'll send it to you.",
      { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "Retry-After": "60" } },
    );
  }
}
