import { getArticles, getCategories, getProducts, getResellers, getSiteSettings } from "./catalogue";
import type { LlmsInput } from "./llms-txt";

export const LLMS_SUCCESS_HEADERS = {
  "Content-Type": "text/plain; charset=utf-8",
  "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=3600",
};

export function llmsUnavailable() {
  return new Response("Temporarily unavailable. Please retry shortly.\n", {
    status: 503,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Retry-After": "300",
      "Cache-Control": "no-store",
    },
  });
}

export async function loadLlmsInput(): Promise<LlmsInput | null> {
  const resellersPromise = getResellers().catch((error: unknown) => {
    console.error(error);
    return [];
  });
  try {
    const [products, categories, articles, settings, resellers] = await Promise.all([
      getProducts(),
      getCategories(),
      getArticles(),
      getSiteSettings(),
      resellersPromise,
    ]);
    return { products, categories, articles, settings, resellers };
  } catch (error) {
    console.error(error);
    return null;
  }
}
