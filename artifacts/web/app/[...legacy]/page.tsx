import { notFound, permanentRedirect } from "next/navigation";
import { getRedirect } from "../../lib/catalogue";

type Props = { params: Promise<{ legacy: string[] }> };

export default async function LegacyPathRedirect({ params }: Props) {
  const { legacy } = await params;
  const fromPath = `/${legacy.join("/")}`;
  const redirect = await getRedirect(fromPath, { fresh: true });
  if (redirect) permanentRedirect(redirect);
  notFound();
}
