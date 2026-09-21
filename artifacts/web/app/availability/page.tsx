import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "../../components/Icon";
import { StatusPill } from "../../components/StatusPill";
import { getCategories, getProducts } from "../../lib/catalogue";
import { productPublicPath } from "../../lib/catalogue-paths";

export const metadata: Metadata = {
  title: "Seed Availability | IH Seeds",
  description: "Check current IH Seeds warehouse availability for pasture seed varieties and mixes supplied through rural resellers across Western Australia.",
  alternates: { canonical: "/availability" },
};

export default async function Availability() {
  const [products, categories] = await Promise.all([getProducts(), getCategories()]);

  return (
    <>
      <section style={{ background: "var(--sage)" }}>
        <div className="content-width" style={{ paddingBottom: 64 }}>
          <div className="availability-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 48 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <h1 style={{ margin: 0, fontSize: 54, lineHeight: 1.15, fontWeight: 800, color: "var(--green)", letterSpacing: "-.035em" }}><span style={{ fontWeight: 300 }}>Seed</span> Availability</h1>
              <p style={{ margin: 0, fontSize: 18, color: "var(--black-green)", maxWidth: "40ch", lineHeight: 1.6 }}>Our warehouse stock levels, updated weekly. For specific large volume orders, please contact us.</p>
            </div>
            <Link href="/contact" className="button button-outline" data-testid="button-availability-help">Ask about an order</Link>
          </div>
          
          <div className="availability-table" style={{ minHeight: 300 }}>
            {products.length === 0 ? (
              <div className="empty-state" style={{ margin: "40px 0" }}>No availability data.</div>
            ) : (
              products.map((product) => (
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
              ))
            )}
            <p className="table-note">Availability is updated weekly. Your reseller may hold additional stock.</p>
          </div>
        </div>
      </section>
    </>
  );
}