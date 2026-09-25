import { getCategories, getProducts } from "../../lib/catalogue";
import { buildLlmsTxt } from "../../lib/llms-txt";

export async function GET() {
  const [products, categories] = await Promise.all([
    getProducts().catch(() => []),
    getCategories().catch(() => []),
  ]);

  return new Response(buildLlmsTxt({ products, categories }), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
