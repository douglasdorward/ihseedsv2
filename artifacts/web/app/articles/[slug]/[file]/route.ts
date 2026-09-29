import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function apiUrl(path: string) {
  const base = process.env.API_BASE?.replace(/\/+$/, "");
  if (!base) throw new Error("API_BASE environment variable is required.");
  return `${base}${path}`;
}

export async function GET(_request: Request, context: { params: Promise<{ slug: string; file: string }> }) {
  const { slug, file } = await context.params;
  if (!SLUG.test(slug) || !file.toLowerCase().endsWith(".pdf")) {
    return new NextResponse("Not found", { status: 404 });
  }
  const pdfSlug = file.slice(0, -".pdf".length);
  if (!SLUG.test(pdfSlug)) return new NextResponse("Not found", { status: 404 });

  let response: Response;
  try {
    response = await fetch(apiUrl(`/api/articles/slug/${encodeURIComponent(slug)}/pdfs/${encodeURIComponent(pdfSlug)}`), {
      cache: "no-store",
    });
  } catch (error) {
    console.error(`Article PDF request failed for ${slug}/${file}`, error);
    return new NextResponse("PDF could not be loaded.", { status: 502 });
  }
  if (!response.ok) return new NextResponse("Not found", { status: response.status === 404 ? 404 : 502 });

  const bytes = new Uint8Array(await response.arrayBuffer());
  const headers = new Headers();
  headers.set("Content-Type", "application/pdf");
  headers.set("Content-Disposition", response.headers.get("content-disposition") ?? `inline; filename="${pdfSlug}.pdf"`);
  headers.set("Content-Length", String(bytes.byteLength));
  headers.set("Cache-Control", "public, max-age=300");
  const robots = response.headers.get("x-robots-tag");
  if (robots) headers.set("X-Robots-Tag", robots);
  return new NextResponse(bytes, { headers });
}
