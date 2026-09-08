import type { Metadata } from "next";
import { CategoryPage, categoryMetadata } from "../category-page";

type Props = { params: Promise<{ category: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return categoryMetadata(await params);
}

export default async function CategoryRoute({ params }: Props) {
  return <CategoryPage params={await params} />;
}