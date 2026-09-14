import type { Metadata } from "next";
import { NestedProductPage, productMetadata } from "../../product-page";

type Props = { params: Promise<{ category: string; product: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return productMetadata(await params);
}

export default async function ProductRoute({ params }: Props) {
  return <NestedProductPage params={await params} />;
}
