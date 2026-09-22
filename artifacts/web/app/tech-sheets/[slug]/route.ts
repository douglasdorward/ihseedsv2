import { NextResponse } from "next/server";
import { getProductBySlug } from "../../../lib/catalogue";
import { isTechSheetRefresh, TECH_SHEET_REFRESH_HEADER, techSheetDownloadName, techSheetPdf } from "../../../lib/tech-sheet-pdf";

export const dynamic = "force-dynamic";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function pdfResponse(bytes: Buffer, filename: string, request: Request) {
  const size = bytes.length;
  const headers = {
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
  const product = await getProductBySlug(slug);
  if (!product) return new NextResponse("Not found", { status: 404 });
  try {
    const bytes = await techSheetPdf(slug, isTechSheetRefresh(request.headers.get(TECH_SHEET_REFRESH_HEADER)));
    if (!bytes) return new NextResponse("Not found", { status: 404 });
    return pdfResponse(bytes, techSheetDownloadName(product.name), request);
  } catch (error) {
    console.error(`Tech sheet generation failed for ${slug}`, error);
    return new NextResponse("Tech sheet could not be generated.", { status: 500 });
  }
}
