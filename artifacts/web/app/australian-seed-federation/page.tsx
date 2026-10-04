import type { Metadata } from "next";
import { FederationExplainer } from "../../components/FederationExplainer";
import { FederationSection } from "../../components/FederationSection";
import { siteSocialMetadata } from "../../lib/social-metadata";

const metadata: Metadata = {
  title: "Australian Seed Federation Member | IH Seeds",
  description: "IH Seeds is a member of the Australian Seed Federation and follows its Code of Practice for seed labelling and marketing. Here is what that means for the seed you buy.",
  alternates: { canonical: "/australian-seed-federation" },
};

export async function generateMetadata(): Promise<Metadata> {
  return { ...metadata, ...await siteSocialMetadata(metadata.title as string, metadata.description as string, "/australian-seed-federation") };
}

export default function AustralianSeedFederationPage() {
  return (
    <>
      <FederationSection standalone />
      <FederationExplainer />
    </>
  );
}
