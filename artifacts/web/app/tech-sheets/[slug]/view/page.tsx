import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TechSheetDocument } from "../../../../components/pdf/TechSheetDocument";
import { getCategories, getProductBySlug, productPageHeading } from "../../../../lib/catalogue";
import { productPublicPath } from "../../../../lib/catalogue-paths";
import { absoluteSiteUrl } from "../../../../lib/site-url";

type RouteParams = { slug: string };

export async function generateMetadata({ params }: { params: Promise<RouteParams> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Technical sheet | IH Seeds", robots: { index: false, follow: false } };
  return {
    title: `${productPageHeading(product)} technical sheet | IH Seeds`,
    robots: { index: false, follow: false },
  };
}

export default async function TechSheetViewPage({ params }: { params: Promise<RouteParams> }) {
  const { slug } = await params;
  const [product, categories] = await Promise.all([getProductBySlug(slug), getCategories()]);
  if (!product) notFound();
  return (
    <TechSheetDocument
      product={product}
      productUrl={absoluteSiteUrl(productPublicPath(product, categories))}
      year={new Date().getFullYear()}
      downloadHref={`/tech-sheets/${product.slug}`}
    />
  );
}
