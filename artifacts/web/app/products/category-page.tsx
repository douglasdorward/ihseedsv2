import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import {
  getCategories,
  getLegacyProducts,
  getProducts,
  getRedirect,
  type CatalogueCategory,
  type CatalogueProduct,
} from "../../lib/catalogue";
import { CATALOGUE_INDEX_PATH, productPublicPath } from "../../lib/catalogue-paths";
import { absoluteSiteUrl } from "../../lib/site-url";
import { CategoryCatalogue } from "./CategoryCatalogue";
import { forSearchMetadata } from "../../lib/search-metadata";
import { loadSiteSettings } from "../../lib/site-settings";

type RouteParams = { category: string };

type ResolvedCategoryPage = {
  root: CatalogueCategory;
  children: CatalogueCategory[];
  path: string;
};

async function redirectUnresolvedCategory(params: RouteParams) {
  const fromPath = `/products/${encodeURIComponent(params.category)}`;
  const toPath = await getRedirect(fromPath);
  if (toPath && toPath !== fromPath) permanentRedirect(toPath);
}

function activeChildren(categories: CatalogueCategory[], rootId: number) {
  return categories
    .filter((category) => category.parentId === rootId && category.active)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function resolveCategoryPage(
  categories: CatalogueCategory[],
  params: RouteParams,
): ResolvedCategoryPage | null {
  const root = categories.find(
    (category) =>
      category.parentId === null &&
      category.active &&
      category.slug === params.category,
  );
  if (!root) return null;
  return {
    root,
    children: activeChildren(categories, root.id),
    path: `/products/${root.slug}`,
  };
}

function headingFor(page: ResolvedCategoryPage) {
  if (page.root.pageHeading.trim()) return page.root.pageHeading.trim();
  return `${page.root.name} Seed`;
}

function completeCategoryFaqs(faqs: CatalogueCategory["faqs"]) {
  return (faqs ?? [])
    .map((faq) => ({ question: faq.question?.trim() ?? "", answer: faq.answer?.trim() ?? "" }))
    .filter((faq) => faq.question && faq.answer)
    .slice(0, 20);
}

function splitHeading(heading: string) {
  const words = heading.split(" ");
  return {
    light: words.length > 1
      ? words.slice(0, words.length > 2 ? -2 : -1).join(" ")
      : words[0],
    bold: words.length > 1
      ? words.slice(words.length > 2 ? -2 : -1).join(" ")
      : "",
  };
}

function productsForRoot(
  products: CatalogueProduct[],
  root: CatalogueCategory,
  children: CatalogueCategory[],
) {
  const visibleIds = new Set([root.id, ...children.map((category) => category.id)]);
  return products.filter(
    (product) =>
      product.category === root.name ||
      (product.subcategoryId != null && visibleIds.has(product.subcategoryId)),
  );
}

export async function categoryMetadata(params: RouteParams): Promise<Metadata> {
  const categories = await getCategories();
  const page = resolveCategoryPage(categories, params);
  if (!page) {
    await redirectUnresolvedCategory(params);
    return {};
  }

  return {
    title: forSearchMetadata(page.root.seoTitle.trim() || `${page.root.name} Seed | IH Seeds`),
    description: forSearchMetadata(
      page.root.seoDescription.trim() || page.root.lead.trim(),
    ),
    alternates: { canonical: page.path },
  };
}

export async function CategoryPage({ params }: { params: RouteParams }) {
  const categories = await getCategories();
  const page = resolveCategoryPage(categories, params);
  if (!page) {
    await redirectUnresolvedCategory(params);
    notFound();
  }

  const [products, settings] = await Promise.all([getProducts(), loadSiteSettings()]);
  const legacy = await getLegacyProducts(page.root.name);
  const rootProducts = productsForRoot(products, page.root, page.children);
  const heading = headingFor(page);
  const title = splitHeading(heading);
  const description = page.root.seoDescription.trim() || page.root.lead.trim();
  const faqs = completeCategoryFaqs(page.root.faqs);
  const breadcrumbItems = [
    { name: "Products", item: CATALOGUE_INDEX_PATH },
    { name: page.root.name, item: page.path },
  ];
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: breadcrumbItems.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: item.name,
        item: absoluteSiteUrl(item.item),
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: heading,
      itemListElement: rootProducts.map((product, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: product.name,
        url: absoluteSiteUrl(productPublicPath(product, categories)),
      })),
    },
    ...(faqs.length > 0
      ? [{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqs.map((faq) => ({
            "@type": "Question",
            name: faq.question,
            acceptedAnswer: { "@type": "Answer", text: faq.answer },
          })),
        }]
      : []),
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <section style={{ background: "var(--sage)" }}>
        <div className="page-breadcrumb" style={{ maxWidth: 1180, margin: "0 auto", padding: "32px 40px 12px", fontSize: 14, fontWeight: 600, color: "var(--muted)" }}>
          <Link href={CATALOGUE_INDEX_PATH} style={{ textDecoration: "none", color: "inherit" }}>Products</Link> / {page.root.name}
        </div>
        <div className="category-intro" style={{ maxWidth: 1180, margin: "0 auto", padding: "12px 40px 48px", display: "flex", flexDirection: "column", gap: 20 }}>
          <h1 style={{ margin: 0, fontSize: 48, lineHeight: 1.2, fontWeight: 300, color: "var(--green)" }}>{title.light} <span style={{ fontWeight: 700 }}>{title.bold}</span></h1>
          <p style={{ margin: 0, fontSize: 18, lineHeight: 1.6, color: "var(--black-green)", maxWidth: "64ch" }}>{description}</p>
        </div>
      </section>

      <CategoryCatalogue
        root={page.root}
        childCategories={page.children}
        products={rootProducts}
        categories={categories}
      />

      {faqs.length > 0 && (
        <section className="product-faq-section" id="faqs" aria-labelledby="category-faq-heading">
          <div className="product-faq-inner">
            <h2 id="category-faq-heading">FAQs</h2>
            <div className="product-faq-list">
              {faqs.map((faq, index) => (
                <details className="product-faq-item" key={`${faq.question}-${index}`}>
                  <summary>{faq.question}</summary>
                  <p>{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      {legacy.length > 0 && (
        <section id="catalogue" style={{ background: "#EFF1EE", padding: "64px 40px" }}>
          <div style={{ maxWidth: 1180, margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 32, marginBottom: 48 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 30, fontWeight: 700, color: "var(--green)", marginBottom: 12 }}>Also in our catalogue</h3>
                <p style={{ margin: 0, fontSize: 16, color: "var(--black-green)" }}>These lines are not on our current price list. Ask us about availability or a custom mix.</p>
              </div>
              <Link href="/contact" className="button button-outline" style={{ background: "transparent" }}>Contact us</Link>
            </div>
            <div className="legacy-grid">
              <div className="legacy-group">
                <h6>{page.root.name} Legacy Lines</h6>
                <ul>
                  {legacy.map((item, index) => (
                    <li key={`${item.name}-${index}`}>{item.name}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>
      )}

      <section style={{ background: "var(--sage)" }}>
        <div className="category-guide-cta" style={{ maxWidth: 1180, margin: "0 auto", padding: "64px 40px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 32 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: "54ch" }}>
            <h2 style={{ margin: 0, fontSize: 30, fontWeight: 700, color: "var(--green)" }}>{settings.seedGuide.pageTitle}</h2>
            <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: "var(--black-green)" }}>Every line in this category, with sowing rates and regional notes.</p>
          </div>
          <a href={settings.seedGuide.pdfPublicUrl} className="button button-primary" download>{settings.seedGuide.cardButtonLabel}</a>
        </div>
      </section>
    </>
  );
}
