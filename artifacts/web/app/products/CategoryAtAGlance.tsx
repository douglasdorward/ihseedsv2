import Link from "next/link";
import { Icon } from "../../components/Icon";
import type { CatalogueCategory } from "../../lib/catalogue";
import {
  activeSubcategories,
  categoryPublicPath,
  productPublicPath,
  subcategoryPublicPath,
} from "../../lib/catalogue-paths";
import { buildCategoryComparison, summariseCategoryProducts } from "../../lib/category-summary";
import type { ListingProduct } from "../../lib/product-listing";
import { subcategoryHeading } from "../../lib/subcategory-copy";

function guideParagraphs(value: string | undefined) {
  return (value ?? "")
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);
}

/**
 * Crawlable, server-rendered category overview. The facts and comparison table
 * are computed from the products on the page, so they follow the catalogue.
 * The buying guide is optional admin-written text.
 */
export function CategoryAtAGlance({
  root,
  sub,
  products,
  categories,
}: {
  root: CatalogueCategory;
  /** When set, the section describes this sub-category's products only. */
  sub?: CatalogueCategory | null;
  products: ListingProduct[];
  categories: CatalogueCategory[];
}) {
  const current = sub ?? root;
  const subjectName = sub ? subcategoryHeading(root, sub) : root.name;
  const summary = summariseCategoryProducts(products, subjectName, {
    storedRainfall: current.rainfall,
    rootName: root.name,
  });
  const comparison = buildCategoryComparison(products, subjectName, root.name);
  const paragraphs = guideParagraphs(current.buyingGuide);
  const hasTable = comparison.rows.length > 1 && comparison.columns.length > 1;
  if (!summary.facts.length && !paragraphs.length && !hasTable) return null;

  const related: Array<{ id: number; name: string; href: string }> = sub
    ? [
        { id: root.id, name: `all ${root.name}`, href: categoryPublicPath(root) },
        ...activeSubcategories(categories, root.id)
          .filter((category) => category.id !== sub.id && (category.productCount ?? 0) > 0)
          .slice(0, 3)
          .map((category) => ({ id: category.id, name: category.name, href: subcategoryPublicPath(root, category) })),
      ]
    : categories
      .filter((category) => category.parentId === null && category.active && category.id !== root.id && (category.productCount ?? 0) > 0)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .slice(0, 4)
      .map((category) => ({ id: category.id, name: category.name, href: categoryPublicPath(category) }));

  return (
    <section className="category-glance" id="choosing" aria-labelledby="category-glance-heading">
      <div className="category-glance-inner">
        <h2 id="category-glance-heading">Choosing {subjectName}</h2>
        {summary.sentence && <p className="category-glance-summary">{summary.sentence}</p>}

        {summary.facts.length > 0 && (
          <dl className="category-glance-facts">
            {summary.facts.map((fact) => (
              <div className="category-glance-fact" key={fact.label}>
                <span className="category-glance-icon"><Icon name={fact.icon} size={22} /></span>
                <div>
                  <dt>{fact.label}</dt>
                  <dd>{fact.value}</dd>
                </div>
              </div>
            ))}
          </dl>
        )}

        {paragraphs.length > 0 && (
          <div className="category-glance-guide">
            {paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
          </div>
        )}

        {hasTable && (
          <>
            <h3>Compare {subjectName.toLowerCase()} at a glance</h3>
            <div className="comparison-table-wrapper">
              <table className="comparison-table category-glance-table">
                <caption className="category-glance-caption">{subjectName}: key differences between lines</caption>
                <thead>
                  <tr>{comparison.columns.map((column) => <th key={column} scope="col">{column}</th>)}</tr>
                </thead>
                <tbody>
                  {comparison.rows.map((row) => (
                    <tr key={row.product.id}>
                      <th scope="row"><Link href={productPublicPath(row.product, categories)}>{row.product.name}</Link></th>
                      {row.cells.map((cell, index) => <td key={index}>{cell}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <p className="category-glance-links">
          Match a paddock to the right seed with the <Link href="/pasture-selector">Pasture Selector</Link>
          {" "}or read the <Link href="/guide">seed guide</Link>.
          {related.length > 0 && (
            <>
              {" "}Also see{" "}
              {related.map((category, index) => (
                <span key={category.id}>
                  {index > 0 && (index === related.length - 1 ? " and " : ", ")}
                  <Link href={category.href}>{category.name}</Link>
                </span>
              ))}
              .
            </>
          )}
        </p>
      </div>
    </section>
  );
}
