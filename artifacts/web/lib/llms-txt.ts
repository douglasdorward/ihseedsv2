import type {
  CatalogueArticle,
  CatalogueCategory,
  CatalogueProduct,
  CatalogueResellerBrand,
  PublicSiteCompany,
} from "./catalogue";
import { CATALOGUE_INDEX_PATH, productPublicPath } from "./catalogue-paths";
import { PASTURE_SELECTOR_FAQS } from "./pasture-selector-faqs";
import { formatSoilPh, formatSoilRange, formatSowingRates, getProductQuickFacts } from "./product-quick-facts";
import { productCanonicalUrl } from "./product-url";
import { expandProductCount } from "./site-settings";
import { absoluteSiteUrl } from "./site-url";

type Faq = { question?: string; answer?: string };

export type LlmsSettings = {
  company: PublicSiteCompany;
  homepage: { aboutBody: string };
  seedGuide: { pageTitle: string; pdfPublicUrl: string };
};

export type LlmsInput = {
  products: CatalogueProduct[];
  categories: CatalogueCategory[];
  articles: CatalogueArticle[];
  settings: LlmsSettings;
  resellers?: CatalogueResellerBrand[];
};

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

function sentence(value: string | undefined) {
  const text = value?.replace(/\s+/g, " ").trim() ?? "";
  if (!text) return "";
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function placeFromAddress(address: string) {
  const match = address.trim().match(/,\s*([^,]+),\s*([A-Z]{2,3})\s+\d{4}\s*$/);
  return match ? `${match[1].trim()}, ${match[2]}` : "";
}

function publicCategory(category: CatalogueCategory) {
  return category.parentId === null && category.active && (category.productCount ?? 0) > 0;
}

function listedProducts(products: CatalogueProduct[]) {
  return products.filter((product) => product.details.robotsIndex !== false);
}

function publicCategories(categories: CatalogueCategory[]) {
  return categories
    .filter(publicCategory)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

function listedArticles(articles: CatalogueArticle[]) {
  return articles
    .filter((article) => article.robotsIndex !== false)
    .sort((a, b) => {
      const left = Date.parse(a.publishedAt);
      const right = Date.parse(b.publishedAt);
      const diff = (Number.isNaN(right) ? 0 : right) - (Number.isNaN(left) ? 0 : left);
      return diff || a.title.localeCompare(b.title);
    });
}

function publishedDay(value: string) {
  const time = Date.parse(value);
  if (Number.isNaN(time)) return "";
  return new Date(time).toISOString().slice(0, 10);
}

function productUrl(product: CatalogueProduct, categories: CatalogueCategory[]) {
  const path = productCanonicalUrl(
    product.details.canonicalUrl,
    productPublicPath(product, categories),
  );
  return absoluteSiteUrl(path);
}

function productGroups(products: CatalogueProduct[], categories: CatalogueCategory[]) {
  const listed = listedProducts(products);
  const roots = publicCategories(categories);
  const groups = roots.map((category) => ({
    category,
    products: listed.filter((product) => product.category === category.name),
  })).filter((group) => group.products.length > 0);
  const grouped = new Set(groups.flatMap((group) => group.products));
  const other = listed.filter((product) => !grouped.has(product));
  return { groups, other };
}

function joinAnd(parts: string[]) {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

function resellerLine(brands: CatalogueResellerBrand[] | undefined) {
  if (!brands?.length) return "";
  const outlets = (kind: CatalogueResellerBrand["kind"]) => brands
    .filter((brand) => brand.kind === kind)
    .reduce((count, brand) => count + brand.outlets.length, 0);
  const parts = [
    outlets("elders") ? `Elders (${outlets("elders")} outlets)` : "",
    outlets("nutrien") ? `Nutrien (${outlets("nutrien")} outlets)` : "",
    brands.some((brand) => brand.kind === "independent")
      ? `${brands.filter((brand) => brand.kind === "independent").length} independent stores`
      : "",
  ].filter(Boolean);
  if (!parts.length) return "";
  return `- Sold through rural stores across WA: ${joinAnd(parts)}. Find a store: ${absoluteSiteUrl("/contact")}`;
}

function businessLines(input: LlmsInput, productCount: number) {
  const { company } = input.settings;
  const legal = company.legalName.trim();
  const trading = company.tradingName.trim();
  const title = legal && trading ? `${legal} (${trading})` : legal || trading || "IH Seeds";
  const place = placeFromAddress(company.address);
  const about = expandProductCount(input.settings.homepage.aboutBody, productCount).replace(/\s+/g, " ").trim();
  const summary = [
    `${title} is a Western Australian pasture seed merchant${place ? ` based in ${place}` : ""}.`,
    about,
  ].filter(Boolean).join(" ");
  const contact = [
    company.phone.trim() ? `Phone ${company.phone.trim()}` : "",
    company.email.trim() ? `Email ${company.email.trim()}` : "",
    company.officeHours.trim(),
  ].filter(Boolean);
  const lines = [`# ${title}`, "", `> ${summary}`, ""];
  const stores = resellerLine(input.resellers);
  if (stores) lines.push(stores);
  if (contact.length) lines.push(`- ${contact.join(" · ")}`);
  if (company.address.trim()) lines.push(`- Address: ${company.address.trim()}`);
  if (company.abn.trim()) lines.push(`- ABN ${company.abn.trim()}`);
  lines.push("- Prices and stock change often. Check /availability or contact us; do not quote stock levels from this file.");
  lines.push(`- Full details and FAQ answers: ${absoluteSiteUrl("/llms-full.txt")}`);
  return lines;
}

function productFacts(product: CatalogueProduct) {
  const details = product.details;
  const facts = [
    details.persistencyType?.trim() ?? "",
    details.rainfallMinMm ? `${details.rainfallMinMm} mm+ rainfall` : "",
    formatSoilRange(details) ?? "",
    formatSoilPh(details) ?? "",
    (details.endUse ?? []).map((use) => use.trim()).filter(Boolean).join(", "),
  ].filter(Boolean);
  const sowing = formatSowingRates(details.sowingRates);
  if (sowing) facts.push(`Sowing rate ${sowing}`);
  return facts.join(" · ");
}

function productNote(product: CatalogueProduct) {
  const lead = [sentence(product.details.botanicalName), sentence(product.details.tagline)].filter(Boolean).join(" ");
  const facts = productFacts(product);
  return [lead, facts].filter(Boolean).join(" ");
}

function startHere(settings: LlmsSettings) {
  const guideNote = settings.seedGuide.pageTitle.trim() || "Sowing and species guide.";
  const lines = [
    link("Home", absoluteSiteUrl("/"), "Western Australia's pasture seed specialists."),
    link("Products", absoluteSiteUrl(CATALOGUE_INDEX_PATH), "Varieties and mixes."),
    link("Availability", absoluteSiteUrl("/availability"), "What is in stock."),
    link("Pasture selector", absoluteSiteUrl("/pasture-selector"), "Match a paddock to pasture seed."),
    link("Seed guide", absoluteSiteUrl("/guide"), guideNote),
    link("Resources", absoluteSiteUrl("/resources"), "Articles and regional advice."),
    link("About", absoluteSiteUrl("/about"), "Irwin Hunter & Co."),
    link("Contact", absoluteSiteUrl("/contact"), "Orders and paddock enquiries."),
  ];
  const pdf = settings.seedGuide.pdfPublicUrl.trim();
  if (pdf) {
    const title = settings.seedGuide.pageTitle.trim() || "Seed guide";
    lines.push(link(`${title} (PDF)`, absoluteSiteUrl(pdf)));
  }
  lines.push(link("Sitemap", absoluteSiteUrl("/sitemap.xml")));
  return lines;
}

function questionCount(count: number) {
  return `${count} ${count === 1 ? "question" : "questions"}`;
}

export function buildLlmsTxt(input: LlmsInput) {
  const { groups, other } = productGroups(input.products, input.categories);
  const listedCount = groups.reduce((count, group) => count + group.products.length, 0) + other.length;
  const lines = [
    ...businessLines(input, listedCount),
    "",
    "## Start here",
    "",
    ...startHere(input.settings),
    "",
    "## Products",
    "",
  ];

  for (const group of groups) {
    lines.push(`### ${group.category.name}`);
    const lead = group.category.lead.trim();
    if (lead) lines.push("", lead);
    lines.push("");
    for (const product of group.products) {
      lines.push(link(product.name, productUrl(product, input.categories), productNote(product)));
    }
    lines.push("");
  }

  if (other.length) {
    lines.push("### Other", "");
    for (const product of other) {
      lines.push(link(product.name, productUrl(product, input.categories), productNote(product)));
    }
    lines.push("");
  }

  const articles = listedArticles(input.articles);
  if (articles.length) {
    lines.push("## Articles", "");
    for (const article of articles) {
      lines.push(link(article.title, absoluteSiteUrl(`/resources/${article.slug}`), article.excerpt));
    }
    lines.push("");
  }

  lines.push("## FAQs", "");
  lines.push(link(
    "Pasture selector",
    `${absoluteSiteUrl("/pasture-selector")}#faqs`,
    `${questionCount(PASTURE_SELECTOR_FAQS.length)} on choosing seed by rainfall, soil and purpose`,
  ));
  for (const category of publicCategories(input.categories)) {
    const count = completeFaqs(category.faqs).length;
    if (!count) continue;
    lines.push(link(
      category.name,
      `${absoluteSiteUrl(`/products/${category.slug}`)}#faqs`,
      questionCount(count),
    ));
  }
  lines.push(`- Every product page also has FAQs at #faqs. Full questions and answers are in ${absoluteSiteUrl("/llms-full.txt")}.`);
  lines.push("", "## Optional", "");
  lines.push(link("Privacy", absoluteSiteUrl("/privacy")));
  lines.push(link("Terms and conditions", absoluteSiteUrl("/terms-and-conditions")));
  lines.push("");
  return lines.join("\n");
}

function pushBlock(lines: string[], heading: string, body: string) {
  const text = body.replace(/\s+$/g, "").trim();
  if (!text) return;
  lines.push(`**${heading}**`, "", text, "");
}

function mixComponentLine(component: NonNullable<CatalogueProduct["details"]["components"]>[number]) {
  const name = component.speciesName?.trim() ?? "";
  if (!name) return "";
  const rate = component.inclusionRate != null
    ? ` ${[component.inclusionRate, component.unit?.trim()].filter(Boolean).join(" ")}`
    : "";
  const description = component.description?.replace(/\s+/g, " ").trim() ?? "";
  return description ? `- ${name}${rate}: ${description}` : `- ${name}${rate}`;
}

export function buildLlmsFullTxt(input: LlmsInput) {
  const { groups, other } = productGroups(input.products, input.categories);
  const listedCount = groups.reduce((count, group) => count + group.products.length, 0) + other.length;
  const lines = [...businessLines(input, listedCount), "", "## Pasture selector FAQs", ""];
  for (const faq of PASTURE_SELECTOR_FAQS) {
    lines.push(`### ${faq.question}`, "", faq.answer, "");
  }

  lines.push("## Categories", "");
  for (const category of publicCategories(input.categories)) {
    lines.push(`### ${category.name}`, "", absoluteSiteUrl(`/products/${category.slug}`), "");
    const lead = category.lead.trim();
    if (lead) lines.push(lead, "");
    for (const faq of completeFaqs(category.faqs)) {
      lines.push(`#### ${faq.question}`, "", faq.answer, "");
    }
  }

  lines.push("## Products", "");
  for (const product of [...groups.flatMap((group) => group.products), ...other]) {
    const details = product.details;
    lines.push(`### ${product.name}`, "", productUrl(product, input.categories), "", product.category, "");
    const tagline = details.tagline?.trim();
    if (tagline) lines.push(tagline, "");
    const blurb = details.blurb?.trim();
    if (blurb) lines.push(blurb, "");
    const attributes = (details.keyAttributes ?? []).map((attribute) => attribute.trim()).filter(Boolean);
    if (attributes.length) {
      lines.push("**Key attributes**", "", ...attributes.map((attribute) => `- ${attribute}`), "");
    }
    const facts = getProductQuickFacts(product);
    if (facts.length) {
      lines.push("**Quick facts**", "", ...facts.map((fact) => `- ${fact.label}: ${fact.value}`), "");
    }
    const components = (details.components ?? []).map(mixComponentLine).filter(Boolean);
    if (components.length) lines.push("**Mix components**", "", ...components, "");
    pushBlock(lines, "About this variety", details.description ?? "");
    pushBlock(lines, "Planting & grazing notes", details.grazingManagementNotes ?? "");
    pushBlock(lines, "Disease & pest resistance", details.diseasePestResistance ?? "");
    pushBlock(lines, "Stand life", details.standLifeNotes ?? "");
    const faqs = completeFaqs(details.faqs);
    if (faqs.length) {
      lines.push("**FAQs**", "");
      for (const faq of faqs) lines.push(`#### ${faq.question}`, "", faq.answer, "");
    }
  }

  const articles = listedArticles(input.articles);
  if (articles.length) {
    lines.push("## Articles", "");
    for (const article of articles) {
      lines.push(`### ${article.title}`, "", absoluteSiteUrl(`/resources/${article.slug}`));
      const day = publishedDay(article.publishedAt);
      if (day) lines.push("", day);
      const excerpt = article.excerpt.trim();
      if (excerpt) lines.push("", excerpt);
      lines.push("");
    }
  }

  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
}
