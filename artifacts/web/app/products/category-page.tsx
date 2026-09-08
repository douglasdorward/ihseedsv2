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
import { absoluteSiteUrl } from "../../lib/site-url";
import { CategoryCatalogue } from "./CategoryCatalogue";

type RouteParams = { category: string; subcategory?: string };

type ResolvedCategoryPage = {
  root: CatalogueCategory;
  selected: CatalogueCategory;
  children: CatalogueCategory[];
  initialGroup: number | "All";
  path: string;
};

function categoryRoutePath(params: RouteParams) {
  const segments = [params.category, params.subcategory].filter(
    (segment): segment is string => Boolean(segment),
  );
  return `/products/${segments.map(encodeURIComponent).join("/")}`;
}

async function redirectUnresolvedCategory(params: RouteParams) {
  const fromPath = categoryRoutePath(params);
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

  const children = activeChildren(categories, root.id);
  if (!params.subcategory) {
    return {
      root,
      selected: root,
      children,
      initialGroup: "All",
      path: `/products/${root.slug}`,
    };
  }

  if (children.length < 2) return null;
  const child = children.find((category) => category.slug === params.subcategory);
  if (!child) return null;

  return {
    root,
    selected: child,
    children,
    initialGroup: child.id,
    path: `/products/${root.slug}/${child.slug}`,
  };
}

function headingFor(page: ResolvedCategoryPage) {
  if (page.selected.pageHeading.trim()) return page.selected.pageHeading.trim();
  return `${page.selected.name} Seed`;
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
    title: page.selected.seoTitle.trim() || `${page.selected.name} Seed | IH Seeds`,
    description:
      page.selected.seoDescription.trim() ||
      page.selected.lead.trim() ||
      page.root.lead,
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

  const products = await getProducts();
  const legacy = await getLegacyProducts(page.root.name);
  const rootProducts = productsForRoot(products, page.root, page.children);
  const heading = headingFor(page);
  const title = splitHeading(heading);
  const description =
    page.selected.seoDescription.trim() ||
    page.selected.lead.trim() ||
    page.root.lead;
  const structuredProducts = page.initialGroup === "All"
    ? rootProducts
    : rootProducts.filter((product) => product.subcategoryId === page.initialGroup);
  const breadcrumbItems = [
    { name: "Products", item: "/products" },
    { name: page.root.name, item: `/products/${page.root.slug}` },
    ...(page.selected.id !== page.root.id && page.children.length > 1
      ? [{ name: page.selected.name, item: page.path }]
      : []),
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
      itemListElement: structuredProducts.map((product, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: product.name,
        url: absoluteSiteUrl(`/product/${product.slug}`),
      })),
    },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <section style={{ background: "var(--sage)" }}>
        <div className="page-breadcrumb" style={{ maxWidth: 1180, margin: "0 auto", padding: "32px 40px 12px", fontSize: 14, fontWeight: 600, color: "var(--muted)" }}>
          <Link href="/products" style={{ textDecoration: "none", color: "inherit" }}>Products</Link> / {page.selected.id !== page.root.id && page.children.length > 1 ? `${page.root.name} / ${page.selected.name}` : page.root.name}
        </div>
        <div className="page-hero-grid" style={{ maxWidth: 1180, margin: "0 auto", padding: "12px 40px 72px", display: "grid", gridTemplateColumns: "minmax(0,1.15fr) minmax(0,1fr)", gap: 64, alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <h1 style={{ margin: 0, fontSize: 48, lineHeight: 1.2, fontWeight: 300, color: "var(--green)" }}>{title.light} <span style={{ fontWeight: 700 }}>{title.bold}</span></h1>
            <p style={{ margin: 0, fontSize: 18, lineHeight: 1.6, color: "var(--black-green)", maxWidth: "52ch" }}>{description}</p>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", paddingTop: 8 }}>
              <a href="/IH-Seeds-2026-Pasture-Seed-Guide.pdf" className="button button-primary" download>Download the 2026 Pasture Seed Guide</a>
            </div>
          </div>
          <div style={{ borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 10px rgba(29,40,28,0.10)", minHeight: 340, background: "#C5CCC5" }}>
            <div role="img" aria-label={page.selected.name} style={{ display: "block", width: "100%", height: 340, backgroundImage: `url(${page.selected.image || page.root.image})`, backgroundSize: "cover", backgroundPosition: "center" }} />
          </div>
        </div>
      </section>

      <CategoryCatalogue
        root={page.root}
        childCategories={page.children}
        products={rootProducts}
        initialGroup={page.initialGroup}
      />

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
    </>
  );
}