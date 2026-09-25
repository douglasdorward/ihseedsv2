import type { Metadata } from "next";
import Link from "next/link";
import { getCategories, getProducts } from "../../lib/catalogue";
import { pageSearchParams, selectorContactHref } from "../../lib/pasture-selector";
import { PASTURE_SELECTOR_FAQS } from "../../lib/pasture-selector-faqs";
import { absoluteSiteUrl } from "../../lib/site-url";
import { PastureSelector } from "./PastureSelector";

const DESCRIPTION = "Answer four questions about your paddock — rainfall, soil, what you're growing it for and how long it needs to last — and see pasture seed that suits it.";
const FAQS = PASTURE_SELECTOR_FAQS;

const CHECKLIST = [
  "Soil test for pH and phosphorus before you choose a variety.",
  "Map the soils paddock by paddock. One block often holds more than one.",
  "Match the cultivar to waterlogging risk, not just to the soil name.",
  "Inoculate and treat the seed for the species you are sowing.",
  "Sow at the depth and rate on the product page.",
  "Plan the grazing goal into the mix before the seed goes in the ground.",
];

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Pasture Seed Selector WA | IH Seeds",
    description: DESCRIPTION,
    alternates: { canonical: "/pasture-selector" },
  };
}

export default async function PastureSelectorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [params, products, categories] = await Promise.all([
    searchParams.then(pageSearchParams),
    getProducts(),
    getCategories(),
  ]);
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: absoluteSiteUrl("/") },
      { "@type": "ListItem", position: 2, name: "Pasture selector", item: absoluteSiteUrl("/pasture-selector") },
    ],
  };
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([breadcrumbJsonLd, faqJsonLd]).replace(/</g, "\\u003c") }}
      />
      <section className="pasture-page">
        <div className="pasture-intro">
          <nav className="pasture-breadcrumb" aria-label="Breadcrumb">
            <Link href="/">Home</Link> / Pasture selector
          </nav>
          <h1>Pasture Seed Selector for Western Australia</h1>
          <p>
            What pasture should I sow on this paddock? Start with the four things that decide it: your average rainfall, your soil, what you are growing the feed for, and how long you need the stand to last. This page asks those questions and shows the Western Australian pasture seed — varieties and ready-made mixes — that fits the answers.
          </p>
          <p>
            Use it when you are asking what pasture should I sow, which pasture seed suits sandy soil in Western Australia, what grows on 400 mm of rainfall, or which pasture comes back every year. The rainfall figure is the supplier&apos;s stated minimum. It only rules out varieties that need more rain than you reliably get. It does not rank what remains, and it is not a verdict that a variety is the best choice at that rainfall. If the block holds more than one soil, run the selector once for each.
          </p>
        </div>

        <PastureSelector initialQuery={params.toString()} products={products} categories={categories} />

        <section className="pasture-enquiry" aria-labelledby="pasture-enquiry-heading">
          <h2 id="pasture-enquiry-heading">Not sure? Send us the paddock.</h2>
          <p>Tell us the rainfall, the soil and what you are growing it for. We will come back with a variety or a mix, and the quantity for the area you are sowing.</p>
          <a id="pasture-enquiry-link" className="button button-primary" href={selectorContactHref(params)}>Send us the paddock</a>
        </section>

        <section className="pasture-checklist" aria-labelledby="pasture-checklist-heading">
          <h2 id="pasture-checklist-heading">Before you order</h2>
          <ul>
            {CHECKLIST.map((item) => <li key={item}>{item}</li>)}
          </ul>
          <p className="pasture-disclaimer">Rainfall figures and soil ranges on this page are supplier-stated minimums and regional guidance. They are not a recommendation for your paddock.</p>
        </section>
      </section>

      <section className="product-faq-section" id="faqs" aria-labelledby="pasture-faq-heading">
        <div className="product-faq-inner">
          <h2 id="pasture-faq-heading">FAQs</h2>
          <div className="product-faq-list">
            {FAQS.map((faq) => (
              <details className="product-faq-item" key={faq.question}>
                <summary>{faq.question}</summary>
                <p>{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
