"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "../../components/Icon";
import { StatusPill } from "../../components/StatusPill";
import type { CatalogueCategory, CatalogueProduct } from "../../lib/catalogue";
import { productPublicPath } from "../../lib/catalogue-paths";
import { listAvailability, type AvailabilityView } from "../../lib/availability-list";

function pillStyle(selected: boolean) {
  return {
    padding: "12px 24px",
    borderRadius: 999,
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
    border: `2px solid ${selected ? "var(--green)" : "transparent"}`,
    background: selected ? "var(--green)" : "transparent",
    color: selected ? "#fff" : "var(--green)",
  } as const;
}

export function AvailabilityContent({
  products,
  categories,
  initialView,
}: {
  products: CatalogueProduct[];
  categories: CatalogueCategory[];
  initialView: AvailabilityView;
}) {
  const router = useRouter();
  const [view, setView] = useState<AvailabilityView>(initialView);
  const [query, setQuery] = useState("");
  const sections = useMemo(
    () => listAvailability({ products, categories, view, query }),
    [products, categories, view, query],
  );

  useEffect(() => {
    setView(initialView);
  }, [initialView]);

  function selectView(next: AvailabilityView) {
    setView(next);
    router.replace(next === "alpha" ? "/availability?view=alpha" : "/availability", { scroll: false });
  }

  return (
    <section style={{ background: "var(--sage)" }}>
      <div className="content-width" style={{ paddingBottom: 64 }}>
        <div className="availability-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 32 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <h1 style={{ margin: 0, fontSize: 54, lineHeight: 1.15, fontWeight: 800, color: "var(--green)", letterSpacing: "-.035em" }}><span style={{ fontWeight: 300 }}>Seed</span> Availability</h1>
            <p style={{ margin: 0, fontSize: 18, color: "var(--black-green)", maxWidth: "40ch", lineHeight: 1.6 }}>Our warehouse stock levels, updated weekly. For specific large volume orders, please contact us.</p>
          </div>
          <Link href="/contact" className="button button-outline" data-testid="button-availability-help">Ask about an order</Link>
        </div>

        <div className="resource-tabs availability-tabs" style={{ display: "flex", gap: 12, marginBottom: 24 }}>
          <button type="button" onClick={() => selectView("category")} style={pillStyle(view === "category")} data-testid="button-availability-view-category">By category</button>
          <button type="button" onClick={() => selectView("alpha")} style={pillStyle(view === "alpha")} data-testid="button-availability-view-alpha">Alphabetical</button>
        </div>

        <form className="availability-search" role="search" onSubmit={(event) => event.preventDefault()}>
          <Icon name="search" size={18} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by product name"
            aria-label="Search availability"
            data-testid="input-availability-search"
          />
        </form>

        <div className="availability-table" style={{ minHeight: 300 }}>
          {products.length === 0 ? (
            <div className="empty-state" style={{ margin: "40px 0" }}>No availability data.</div>
          ) : sections.length === 0 ? (
            <div className="empty-state" style={{ margin: "40px 0" }} data-testid="status-availability-empty">No lines match that search.</div>
          ) : (
            sections.map((section) => (
              <div key={section.key}>
                {section.heading ? (
                  section.heading.href ? (
                    <Link href={section.heading.href} className="availability-row availability-group" data-testid={`link-availability-category-${section.key}`}>
                      <span className="availability-group-name">{section.heading.name}</span>
                      <span className="availability-chevron" aria-hidden="true"><Icon name="chevron-right" size={20} /></span>
                    </Link>
                  ) : (
                    <div className="availability-row availability-group" data-testid={`group-availability-${section.key}`}>
                      <span className="availability-group-name">{section.heading.name}</span>
                    </div>
                  )
                ) : null}
                {section.products.map((product) => (
                  <div className="availability-row" key={product.id} data-testid={`row-availability-${product.id}`}>
                    <Link href={productPublicPath(product, categories)} className="availability-product" data-testid={`link-availability-product-${product.id}`}>
                      <strong>{product.name}</strong>
                      {product.details.tagline?.trim() ? <span className="availability-tagline">{product.details.tagline}</span> : null}
                    </Link>
                    <Link href="/contact" className="availability-enquire" aria-label={`${product.status === "unavailable" ? "Inquire about" : "Order"} ${product.name}`} data-testid={`link-availability-enquire-${product.id}`}>
                      <span className="availability-status">
                        <StatusPill status={product.status} />
                        <span className="availability-action">{product.status === "unavailable" ? "Inquire" : "Order Now"}</span>
                      </span>
                      <span className="availability-chevron" aria-hidden="true"><Icon name="chevron-right" size={20} /></span>
                    </Link>
                  </div>
                ))}
              </div>
            ))
          )}
          <p className="table-note">Availability is updated weekly. Your reseller may hold additional stock.</p>
        </div>
      </div>
    </section>
  );
}
