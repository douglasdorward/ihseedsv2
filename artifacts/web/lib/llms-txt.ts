import type { CatalogueCategory, CatalogueProduct } from "./catalogue";
import { CATALOGUE_INDEX_PATH, productPublicPath } from "./catalogue-paths";
import { PASTURE_SELECTOR_FAQS } from "./pasture-selector-faqs";
import { productCanonicalUrl } from "./product-url";
import { absoluteSiteUrl } from "./site-url";

type Faq = { question?: string; answer?: string };

const START_HERE = [
  ["/", "Home", "Western Australia's pasture seed specialists."],
  [CATALOGUE_INDEX_PATH, "Products", "Varieties and mixes."],
  ["/availability", "Availability", "What is in stock."],
  ["/pasture-selector", "Pasture selector", "Match a paddock to pasture seed."],
  ["/guide", "Seed guide", "Sowing and species guide."],
  ["/resources", "Resources", "Articles and regional advice."],
  ["/about", "About", "Irwin Hunter & Co."],
  ["/contact", "Contact", "Orders and paddock enquiries."],
] as const;

function completeFaqs(faqs: readonly Faq[] | undefined) {
  return (faqs ?? [])
    .map((faq) => ({ question: faq.question?.trim() ?? "", answer: faq.answer?.trim() ?? "" }))
    .filter((faq) => faq.question && faq.answer);
}

function link(name: string, url: string, note?: string) {
  const label = name.replace(/[\[\]]/g, "");
  const item = `- [${label}](${url})`;
  return note ? `${item}: ${note.replace(/\s+/g, " ").trim()}` : item;
}

function faqNote(faqs: readonly Faq[]) {
  return completeFaqs(faqs).map((faq) => faq.question).join("; ");
}

function publicCategory(category: CatalogueCategory) {
  return category.parentId === null && category.active && (category.productCount ?? 0) > 0;
}

export function buildLlmsTxt(input: {
  products: CatalogueProduct[];
  categories: CatalogueCategory[];
  pastureFaqs?: readonly Faq[];
}) {
  const pastureFaqs = input.pastureFaqs ?? PASTURE_SELECTOR_FAQS;
  const categories = input.categories.filter(publicCategory);
  const faqLinks = [
    link(
      "Pasture selector",
      `${absoluteSiteUrl("/pasture-selector")}#faqs`,
      faqNote(pastureFaqs),
    ),
  ];

  for (const category of input.categories) {
    if (!publicCategory(category)) continue;
    const note = faqNote(category.faqs ?? []);
    if (!note) continue;
    faqLinks.push(link(category.name, `${absoluteSiteUrl(`/products/${category.slug}`)}#faqs`, note));
  }

  for (const product of input.products) {
    if (product.details.robotsIndex === false) continue;
    const note = faqNote(product.details.faqs);
    if (!note) continue;
    const path = productCanonicalUrl(
      product.details.canonicalUrl,
      productPublicPath(product, input.categories),
    );
    faqLinks.push(link(product.name, `${absoluteSiteUrl(path)}#faqs`, note));
  }

  const lines = [
    "# IH Seeds",
    "",
    "> Western Australian pasture seed merchant (Irwin Hunter & Co). Varieties, mixes, availability, and paddock advice.",
    "",
    "Variety pages live under each category. The sitemap lists them. Pages with FAQs link to `#faqs`, and those pages also include FAQPage JSON-LD.",
    "",
    "## Start here",
    "",
    ...START_HERE.map(([path, name, note]) => link(name, absoluteSiteUrl(path), note)),
    "",
    "## Catalogue",
    "",
    ...categories.map((category) => link(category.name, absoluteSiteUrl(`/products/${category.slug}`))),
    "",
    "## FAQs",
    "",
    ...faqLinks,
    "",
  ];

  return lines.join("\n");
}
