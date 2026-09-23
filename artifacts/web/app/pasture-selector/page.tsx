import type { Metadata } from "next";
import Link from "next/link";
import { getCategories, getProducts } from "../../lib/catalogue";
import { pageSearchParams, selectorContactHref } from "../../lib/pasture-selector";
import { absoluteSiteUrl } from "../../lib/site-url";
import { PastureSelector } from "./PastureSelector";

const DESCRIPTION = "Answer four questions about your paddock — rainfall, soil, what you're growing it for and how long it needs to last — and see pasture seed that suits it.";

const FAQS = [
  {
    question: "How do I know which pasture seed suits my paddock?",
    answer: "Start with the four things that decide it: your average rainfall, your soil type, what you are growing the feed for, and how long you need the stand to last. Our selector asks those four questions and shows the varieties and mixes that fit. If your block holds more than one soil, run it once for each.",
  },
  {
    question: "What can I sow on a salty, waterlogged flat?",
    answer: "Puccinellia is our first choice for salt-affected ground that holds water — it handles both, on loam to heavy soils, from around 350 mm. Tall Wheatgrass is the alternative from 450 mm and copes with a wider soil range. Get a soil test first: salinity and waterlogging together need the drainage understood before you spend on seed.",
  },
  {
    question: "Which pasture species will grow on less than 350 mm of rain?",
    answer: "More than you would expect. Diamanti Bladder Clover and Fran₂o French Serradella are rated from 250 mm, Sceptre Lucerne from 280 mm, and the Rhodes grasses from 300 mm. These are supplier minimums, not targets — at the bottom of a variety's range, establishment year management and sowing on a decent break matter more than the variety itself.",
  },
  {
    question: "What should I sow on deep sand?",
    answer: "Serradella is the standout legume on deep, low-fertility sand — Fran₂o and Serramax both suit sand through to loam and tolerate acid soils. Casbah Biserrula is another option on the lightest country. For a grass, the Rhodes grasses handle sand from around 300 mm. Inoculate legumes correctly; on sand it makes the difference between a stand and a failure.",
  },
  {
    question: "I want a pasture that comes back every year without resowing. What do I sow?",
    answer: "You want self-regenerating annual legumes — subterranean clover, serradella or medic — which set hard seed and germinate again after the break. Our Self Regeneration Mix is built around them and suits 350 mm and up across light sand to heavy soils. The key is letting the stand set seed in year one before you graze it hard.",
  },
  {
    question: "What is the difference between an annual and a perennial pasture?",
    answer: "An annual grows, sets seed and dies within the season, so you resow it or rely on it self-regenerating. A perennial stays in the ground for several years, giving you feed outside the growing season and holding soil together. Annuals give faster feed in year one; perennials cost more to establish and pay it back over time.",
  },
  {
    question: "Which mix suits a high rainfall South West grazing paddock?",
    answer: "Our SouWest Pasture Mix is built for 500 mm and above, on sand through to heavy soils, and it is the one most South West graziers start with. MaxiMix suits 450 mm and up for general grazing, and Silahay is the pick if the paddock is going into hay or silage. All three are blended to order.",
  },
  {
    question: "What is the best pasture mix for horses?",
    answer: "Our Equi1st Pasture Mix is blended specifically for horse paddocks, suited to 400 mm and above on sand through to heavy soils. Horse pasture is a different problem from cattle pasture — the balance of species matters more than raw production, and stocking pressure is usually the limiting factor. Talk to us about paddock size before you order.",
  },
  {
    question: "My soil test came back under pH 5. What will grow?",
    answer: "Acid soils suit the hard-seeded legumes: Serramax Serradella, Casbah Biserrula and Paradana Balansa Clover all tolerate low pH, and Paradana handles waterlogging as well. Treposno Cocksfoot is a perennial grass option from 450 mm. Liming is still worth costing out — it lifts what you can grow rather than limiting you to tolerant species.",
  },
  {
    question: "How much seed do I need per hectare?",
    answer: "It depends on the species, whether it is sown alone or in a mix, and whether the paddock is dryland or irrigated. Every product page on this site carries its sowing rate, and our mixes are blended to order with the rate set for the blend. Send us the paddock size and we will work the quantity out with you.",
  },
] as const;

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
