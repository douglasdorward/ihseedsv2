import type { Metadata } from "next";
import { getCategories, getProducts } from "../../lib/catalogue";
import type { AvailabilityView } from "../../lib/availability-list";
import { AvailabilityContent } from "./AvailabilityContent";
import { siteSocialMetadata } from "../../lib/social-metadata";

const metadata: Metadata = {
  title: "Seed Availability | IH Seeds",
  description: "Check current IH Seeds warehouse availability for pasture seed varieties and mixes supplied through rural resellers across Western Australia.",
  alternates: { canonical: "/availability" },
};

export async function generateMetadata(): Promise<Metadata> {
  return { ...metadata, ...await siteSocialMetadata(metadata.title as string, metadata.description as string, "/availability") };
}

export default async function Availability({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [products, categories, query] = await Promise.all([getProducts(), getCategories(), searchParams]);
  const initialView: AvailabilityView = query.view === "alpha" ? "alpha" : "category";

  return <AvailabilityContent products={products} categories={categories} initialView={initialView} />;
}
