import { notFound, permanentRedirect, redirect } from "next/navigation";
import { getRedirectTarget } from "../../../lib/catalogue";

type Props = { params: Promise<{ slug: string }> };

export default async function LegacyProductRedirect({ params }: Props) {
  const { slug } = await params;
  const target = await getRedirectTarget(`/product/${slug}`);
  if (target) {
    if (target.permanent) permanentRedirect(target.toPath);
    redirect(target.toPath);
  }
  notFound();
}
