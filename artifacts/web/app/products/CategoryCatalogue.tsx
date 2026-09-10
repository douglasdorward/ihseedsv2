import Link from "next/link";
import { Icon } from "../../components/Icon";
import { StatusPill } from "../../components/StatusPill";
import type { CatalogueCategory, CatalogueProduct } from "../../lib/catalogue";
import { CategoryFilterControls, CategoryViewToggle } from "./CategoryControls";

const imageOptions = [
  "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1530507629858-e4977d30e9e0?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1499529112087-3cb3b73cec95?auto=format&fit=crop&w=900&q=80",
];

function productPath(product: Pick<CatalogueProduct, "name" | "slug">) {
  return `/product/${product.slug}`;
}

function getFactChips(product: CatalogueProduct, subcategoryName?: string) {
  const category = product.category;
  const details = product.details;
  const chips: string[] = [];
  const add = (value: unknown, suffix = "", prefix = "") => {
    if (value && value !== "None" && value !== "Nil") chips.push(`${prefix}${value}${suffix}`);
  };

  if (category === "Ryegrasses") {
    add(details.ploidy);
    add(details.headingDate);
    add(details.rainfallMinMm, " mm+");
  } else if (category === "Clovers") {
    if (subcategoryName) add(subcategoryName);
    add(details.maturityDays, " days");
    add(details.hardSeedLevel, " hard seed");
  } else if (category === "Serradellas & Medics") {
    add(details.flowerColour, " flowered");
    add(details.maturityDays, " days");
    add(product.saleLines?.map((line) => line.seedForm).filter(Boolean).join(" & "));
  } else if (category === "Lucerne") {
    const winterActivity = details.maturityMeasure === "Winter activity rating"
      ? details.maturityDays
      : details.winterActivity;
    if (winterActivity) add(`Winter active ${winterActivity}`);
    add(details.rainfallMinMm, " mm+");
    add(details.sowingRates?.[0]?.context);
  } else if (category === "Fescues & Other Grasses") {
    add(details.endophyte, " endophyte");
    add(details.growthSeason);
    add(details.rainfallMinMm, " mm+");
  } else if (category === "Sub-Tropical Grasses") {
    add(product.saleLines?.[0]?.seedForm);
    add(details.rainfallMinMm, " mm+");
    add(details.sowingRates?.find((rate) => rate.context === "Turf") ? "Pasture & turf" : "Pasture");
  } else if (category === "Herbs") {
    add(details.persistencyType);
    add(details.rainfallMinMm, " mm+");
    add(details.sowingRates?.[0]?.context);
  } else if (category === "Forage & Grain Crops") {
    add(details.growingSeason, " crop");
    add(details.weeksToFirstGrazing, " wks", "Graze ");
    if (subcategoryName) add(subcategoryName);
  } else if (category === "Mixes") {
    if (subcategoryName) add(subcategoryName);
    const rate = details.sowingRates?.[0];
    if (rate?.min && rate.max) add(`${rate.min}–${rate.max} ${rate.unit}`);
    add(details.floweringWindow);
  } else if (category === "Biologicals") {
    add(details.productForm);
    add(details.applicationRate);
    add(product.packSize);
  }

  return chips.filter(Boolean).slice(0, 3);
}

export function CategoryCatalogue({
  root,
  childCategories,
  products,
  initialGroup,
}: {
  root: CatalogueCategory;
  childCategories: CatalogueCategory[];
  products: CatalogueProduct[];
  initialGroup: number | "All";
}) {
  const groups = [
    {
      label: "All",
      id: "All" as const,
      count: products.length,
      href: `/products/${root.slug}`,
    },
    ...childCategories.map((category) => ({
      label: category.name,
      id: category.id,
      count: products.filter((product) => product.subcategoryId === category.id).length,
      href: childCategories.length > 1
        ? `/products/${root.slug}/${category.slug}`
        : `/products/${root.slug}`,
    })),
  ];
  const visibleProducts = products
    .filter((product) => initialGroup === "All" || product.subcategoryId === initialGroup)
    .sort((first, second) => {
      if (first.details.featured !== second.details.featured) {
        return first.details.featured ? -1 : 1;
      }
      return (first.saleLines?.[0]?.sortOrder ?? 0) - (second.saleLines?.[0]?.sortOrder ?? 0);
    });

  return (
    <section style={{ background: "#FFFFFF" }}>
      <div className="page-content" style={{ maxWidth: 1180, margin: "0 auto", padding: "48px 40px 96px", display: "flex", flexDirection: "column", gap: 32 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, borderBottom: "2px solid var(--green)", paddingBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16, flexWrap: "wrap" }}>
            <h2 id="category-products-heading" style={{ margin: 0, fontSize: 30, fontWeight: 700, color: "var(--green)" }}>{initialGroup === "All" ? `${visibleProducts.length} ${root.name.toLowerCase() || "lines"}` : groups.find((group) => group.id === initialGroup)?.label}</h2>
            <CategoryViewToggle />
          </div>
          {groups.length > 1 && (
            <CategoryFilterControls
              groups={groups}
              initialGroup={initialGroup}
              rootHeading={`${visibleProducts.length} ${root.name.toLowerCase() || "lines"}`}
              navigates={initialGroup !== "All"}
            />
          )}
        </div>

          {visibleProducts.length > 0 ? (
            <>
              <div id="category-products-grid" className="category-card-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 32 }}>
                {visibleProducts.map((product, index) => {
                  const subcategory = childCategories.find((category) => category.id === product.subcategoryId)?.name;
                  const chips = getFactChips(product, subcategory);
                  const tagline = product.details.tagline?.trim();
                  return (
                    <Link key={product.id} href={productPath(product)} data-category-product data-subcategory-id={product.subcategoryId ?? ""} style={{ textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column", gap: 16 }}>
                      <div style={{ borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 10px rgba(29,40,28,0.10)", minHeight: 220, background: "#C5CCC5", position: "relative" }}>
                        <div role="img" aria-label={product.name} style={{ display: "block", width: "100%", height: 220, backgroundImage: `url(${imageOptions[index % imageOptions.length]})`, backgroundSize: "cover", backgroundPosition: "center" }} />
                        <div style={{ position: "absolute", top: 12, left: 12 }}>
                          <StatusPill status={product.status} />
                        </div>
                        <div className="icon-button" aria-hidden="true" style={{ position: "absolute", right: 12, bottom: 12, width: 40, height: 40, background: "var(--yellow)", border: "none" }}>
                          <Icon name="arrow-right" size={18} />
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ fontSize: 20, fontWeight: 600, color: "var(--green)", lineHeight: 1.3 }}>{product.name}</div>
                        {subcategory && <div style={{ fontSize: 14, color: "#75766E" }}>{subcategory}</div>}
                        {tagline && <p className="product-card-tagline">{tagline}</p>}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {chips.map((chip, chipIndex) => (
                          <span key={chipIndex} className="fact-chip">{chip}</span>
                        ))}
                      </div>
                    </Link>
                  );
                })}
              </div>
              <div id="category-products-table" className="comparison-table-wrapper" hidden>
                <table className="comparison-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Sub-category</th>
                      <th>Stock</th>
                      <th>Min Rainfall</th>
                      <th>Soil Range</th>
                      <th>pH</th>
                      <th>Sowing Rate</th>
                      <th>Tolerances</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleProducts.map((product) => {
                      const subcategory = childCategories.find((category) => category.id === product.subcategoryId)?.name;
                      const details = product.details;
                      const rate = details.sowingRates?.[0];
                      return (
                        <tr key={product.id} data-category-product data-subcategory-id={product.subcategoryId ?? ""}>
                          <td style={{ fontWeight: 600 }}><Link href={productPath(product)} style={{ color: "inherit", textDecoration: "none" }}>{product.name}</Link></td>
                          <td>{subcategory || "—"}</td>
                          <td><StatusPill status={product.status} /></td>
                          <td>{details.rainfallMinMm ? `${details.rainfallMinMm} mm+` : "—"}</td>
                          <td>{details.soilRangeLightest && details.soilRangeHeaviest ? `${details.soilRangeLightest}–${details.soilRangeHeaviest}` : "—"}</td>
                          <td>{details.soilPhMin ? `${details.soilPhMin} ${details.soilPhScale}` : "—"}</td>
                          <td>{rate?.min && rate.max ? `${rate.min}–${rate.max} ${rate.unit}` : "—"}</td>
                          <td>{details.tolerance?.map((tolerance) => {
                            const name = tolerance.name === "Low pH" ? "P" : tolerance.name === "Waterlogging" ? "W" : tolerance.name === "Salinity" ? "S" : tolerance.name;
                            return tolerance.mild ? `Mild ${name}` : name;
                          }).join(" / ") || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <strong>No products match this filter.</strong>
              <span>Try another group or contact IH Seeds for current options.</span>
              <Link href="/contact" className="button button-primary">Ask about this category</Link>
            </div>
          )}
        </div>
      </section>
    );
}