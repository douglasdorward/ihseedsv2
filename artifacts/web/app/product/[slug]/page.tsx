import { notFound, permanentRedirect } from "next/navigation";
import { getRedirect } from "../../../lib/catalogue";

type Props = { params: Promise<{ slug: string }> };

export default async function LegacyProductRedirect({ params }: Props) {
  const { slug } = await params;
  const redirect = await getRedirect(`/product/${slug}`);
  if (redirect) permanentRedirect(redirect);
  notFound();
}
