import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import {
  categoryPageHeading,
  getCategories,
  getLegacyProducts,
  getProducts,
  getRedirect,
  type CatalogueCategory,
  type CatalogueProduct,
} from "../../lib/catalogue";
import {
  CATALOGUE_INDEX_PATH,
  activeSubcategories,
  categoryPublicPath,
  findRootCategory,
  isSubcategoryIndexable,
  productPublicPath,
  subcategoryPublicPath,
} from "../../lib/catalogue-paths";
import { summariseCategoryProducts } from "../../lib/category-summary";
import { absoluteSiteUrl } from "../../lib/site-url";
import { CategoryAtAGlance } from "./CategoryAtAGlance";
import { CategoryCatalogue } from "./CategoryCatalogue";
import { toListingProduct } from "../../lib/product-listing";
import { forSearchMetadata } from "../../lib/search-metadata";
import { loadSiteSettings } from "../../lib/site-settings";
import { socialMetadata } from "../../lib/social-metadata";
import {
  subcategoryDescription,
  subcategoryHeading,
  subcategoryIntro,
  subcategoryTitle,
} from "../../lib/subcategory-copy";

/** `sub` is set when the page is /products/{category}/{sub}. */
type RouteParams = { category: string; sub?: string };

type ResolvedCategoryPage = {
  root: CatalogueCategory;
  /** The sub-category this page is for, or null on the root category page. */
  sub: CatalogueCategory | null;
  children: CatalogueCategory[];
  path: string;
};

async function redirectUnresolvedCategory(params: RouteParams) {
  const fromPath = `/products/${encodeURIComponent(params.category)}${params.sub ? `/${encodeURIComponent(params.sub)}` : ""}`;
  const toPath = await getRedirect(fromPath);
  if (toPath && toPath !== fromPath) permanentRedirect(toPath);
}

export function resolveCategoryPage(
  categories: CatalogueCategory[],
  params: RouteParams,
): ResolvedCategoryPage | null {
  const root = findRootCategory(categories, params.category);
  if (!root) return null;
  const children = activeSubcategories(categories, root.id);
  if (params.sub === undefined) {
    return { root, sub: null, children, path: categoryPublicPath(root) };
  }
  const sub = children.find((category) => category.slug === params.sub);
  if (!sub) return null;
  return { root, sub, children, path: subcategoryPublicPath(root, sub) };
}

function headingFor(page: ResolvedCategoryPage) {
  return page.sub ? subcategoryHeading(page.root, page.sub) : categoryPageHeading(page.root);
}

/** Products shown on this page: the whole root, or only the sub-category's. */
function productsForPage(page: ResolvedCategoryPage, rootProducts: CatalogueProduct[]) {
  const sub = page.sub;
  return sub ? rootProducts.filter((product) => product.subcategoryId === sub.id) : rootProducts;
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

  const settings = await loadSiteSettings();
  const { sub } = page;
  const copy = sub ? sub : page.root;
  let rawTitle: string;
  let rawDescription: string;
  if (sub) {
    const products = productsForPage(page, productsForRoot(await getProducts(), page.root, page.children));
    const generated = {
      sentence: summariseCategoryProducts(products.map(toListingProduct), subcategoryHeading(page.root, sub), {
        storedRainfall: sub.rainfall,
        rootName: page.root.name,
      }).sentence,
      productCount: products.length,
    };
    rawTitle = subcategoryTitle(page.root, sub);
    rawDescription = subcategoryDescription(page.root, sub, generated);
  } else {
    rawTitle = page.root.seoTitle.trim() || `${categoryPageHeading(page.root)} | IH Seeds`;
    rawDescription = page.root.seoDescription.trim() || page.root.lead.trim();
  }
  const title = forSearchMetadata(rawTitle);
  const description = forSearchMetadata(rawDescription);
  return {
    title,
    description,
    alternates: { canonical: page.path },
    ...(sub && !isSubcategoryIndexable(sub) ? { robots: { index: false, follow: true } } : {}),
    ...socialMetadata(title, description, page.path, {
      override: copy.socialImage || page.root.socialImage,
      siteImage: settings.homepage.socialImageSrc,
      siteAssetId: settings.homepage.socialImageAssetId,
      socialTitle: forSearchMetadata(copy.socialTitle?.trim() || title),
      socialDescription: forSearchMetadata(copy.socialDescription?.trim() || description),
    }),
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
  const { sub } = page;
  // Legacy lines are listed per root category, so they stay off sub-category pages.
  const legacy = sub ? [] : await getLegacyProducts(page.root.name);
  const allRootProducts = productsForRoot(products, page.root, page.children);
  const rootListingProducts = allRootProducts.map(toListingProduct);
  const rootProducts = productsForPage(page, allRootProducts);
  const listingProducts = rootProducts.map(toListingProduct);
  const heading = headingFor(page);
  const title = splitHeading(heading);
  const description = sub
    ? subcategoryIntro(page.root, sub, {
        ...summariseCategoryProducts(listingProducts, heading, {
          storedRainfall: sub.rainfall,
          rootName: page.root.name,
        }),
        productCount: listingProducts.length,
      })
    : page.root.seoDescription.trim() || page.root.lead.trim();
  const faqs = completeCategoryFaqs((sub ?? page.root).faqs);
  const breadcrumbItems = [
    { name: "Products", item: CATALOGUE_INDEX_PATH },
    { name: page.root.name, item: categoryPublicPath(page.root) },
    ...(sub ? [{ name: sub.name, item: page.path }] : []),
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
      itemListElement: rootProducts.map((product, index) => {
        const photo = product.details.photos?.find((item) => item.src?.trim())?.src?.trim();
        const tagline = product.details.tagline?.trim();
        return {
          "@type": "ListItem",
          position: index + 1,
          name: product.name,
          url: absoluteSiteUrl(productPublicPath(product, categories)),
          ...(photo ? { image: absoluteSiteUrl(photo) } : {}),
          ...(tagline ? { description: tagline } : {}),
        };
      }),
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
          <Link href={CATALOGUE_INDEX_PATH} style={{ textDecoration: "none", color: "inherit" }}>Products</Link> /{" "}
          {sub ? (
            <>
              <Link href={categoryPublicPath(page.root)} style={{ textDecoration: "none", color: "inherit" }}>{page.root.name}</Link> / {sub.name}
            </>
          ) : page.root.name}
        </div>
        <div className="category-intro" style={{ maxWidth: 1180, margin: "0 auto", padding: "12px 40px 48px", display: "flex", flexDirection: "column", gap: 20 }}>
          <h1 style={{ margin: 0, fontSize: 48, lineHeight: 1.2, fontWeight: 300, color: "var(--green)" }}>{title.light} <span style={{ fontWeight: 700 }}>{title.bold}</span></h1>
          <p style={{ margin: 0, fontSize: 18, lineHeight: 1.6, color: "var(--black-green)", maxWidth: "64ch" }}>{description}</p>
          <p className="pasture-selector-banner">Not sure where to start? <Link href="/pasture-selector">Try the Pasture Selector</Link> or <Link href="/contact">Contact Us</Link></p>
        </div>
      </section>

      <CategoryCatalogue
        root={page.root}
        childCategories={page.children}
        activeSubId={sub?.id ?? null}
        products={rootListingProducts}
        categories={categories}
      />

      <CategoryAtAGlance root={page.root} sub={sub} products={listingProducts} categories={categories} />

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
                <h2 style={{ margin: 0, fontSize: 30, fontWeight: 700, color: "var(--green)", marginBottom: 12 }}>Also in our catalogue</h2>
                <p style={{ margin: 0, fontSize: 16, color: "var(--black-green)" }}>These lines are not on our current price list. Ask us about availability or a custom mix.</p>
              </div>
              <Link href="/contact" className="button button-outline" style={{ background: "transparent" }}>Contact us</Link>
            </div>
            <div className="legacy-grid">
              <div className="legacy-group">
                <h3>{page.root.name} Legacy Lines</h3>
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
