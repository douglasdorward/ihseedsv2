import { notFound, permanentRedirect } from "next/navigation";
import { getCategories, getProductBySlug, getRedirect } from "../../../lib/catalogue";
import { productPublicPath } from "../../../lib/catalogue-paths";

type Props = { params: Promise<{ slug: string }> };

export default async function LegacyProductRedirect({ params }: Props) {
  const { slug } = await params;
  const [product, categories] = await Promise.all([getProductBySlug(slug), getCategories()]);
  if (product) permanentRedirect(productPublicPath(product, categories));
  const redirect = await getRedirect(`/product/${slug}`);
  if (redirect) permanentRedirect(redirect);
  notFound();
}
