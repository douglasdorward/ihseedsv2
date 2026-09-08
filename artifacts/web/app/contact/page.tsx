import type { Metadata } from "next";
import { ContactPage } from "./ContactPage";

export const metadata: Metadata = {
  title: "Contact IH Seeds | Pasture Seed Advice",
  description: "Contact IH Seeds for pasture seed advice, sowing rates, availability, pricing and help finding a rural reseller in Western Australia.",
};

export default function Contact() {
  return <ContactPage />;
}