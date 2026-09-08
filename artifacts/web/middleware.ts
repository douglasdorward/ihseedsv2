import { NextRequest, NextResponse } from "next/server";

type RedirectLookup = {
  toPath?: unknown;
};

export async function middleware(request: NextRequest) {
  const apiBase = process.env.API_BASE?.replace(/\/+$/, "");
  if (!apiBase) {
    console.error("API_BASE is required for catalogue redirect lookup.");
    return NextResponse.next();
  }

  const fromPath = request.nextUrl.pathname;
  try {
    const response = await fetch(
      `${apiBase}/api/redirects/lookup?fromPath=${encodeURIComponent(fromPath)}`,
      { cache: "no-store" },
    );
    if (response.status === 404) return NextResponse.next();
    if (!response.ok) {
      console.error(`Catalogue redirect lookup failed (${response.status}) for ${fromPath}`);
      return NextResponse.next();
    }

    const redirect = (await response.json()) as RedirectLookup;
    if (
      typeof redirect.toPath !== "string" ||
      !redirect.toPath.startsWith("/") ||
      redirect.toPath === fromPath
    ) {
      console.error(`Catalogue redirect lookup returned an invalid destination for ${fromPath}`);
      return NextResponse.next();
    }

    return NextResponse.redirect(new URL(redirect.toPath, request.url), 301);
  } catch (error) {
    console.error(`Catalogue redirect lookup could not be reached for ${fromPath}`, error);
    return NextResponse.next();
  }
}

export const config = {
  matcher: ["/product/:path*", "/products/:path*"],
};