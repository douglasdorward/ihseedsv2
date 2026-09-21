import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TechSheetDocument, withMaxQuickFacts } from "../../../../../components/pdf/TechSheetDocument";
import { getCategories, getProductBySlug, productPageHeading } from "../../../../../lib/catalogue";
import { productPublicPath } from "../../../../../lib/catalogue-paths";
import { absoluteSiteUrl } from "../../../../../lib/site-url";

type RouteParams = { slug: string };

export async function generateMetadata({ params }: { params: Promise<RouteParams> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Tech sheet preview | IH Seeds", robots: { index: false, follow: false } };
  return {
    title: `${productPageHeading(product)} technical sheet | IH Seeds`,
    robots: { index: false, follow: false },
  };
}

export default async function TechSheetPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<RouteParams>;
  searchParams: Promise<{ facts?: string }>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const [product, categories] = await Promise.all([getProductBySlug(slug), getCategories()]);
  if (!product) notFound();
  const maxFacts = query.facts === "max";
  const sheetProduct = maxFacts ? withMaxQuickFacts(product) : product;
  const productUrl = absoluteSiteUrl(productPublicPath(sheetProduct, categories));
  return (
    <TechSheetDocument
      product={sheetProduct}
      productUrl={productUrl}
      year={new Date().getFullYear()}
      maxFacts={maxFacts}
    />
  );
}
