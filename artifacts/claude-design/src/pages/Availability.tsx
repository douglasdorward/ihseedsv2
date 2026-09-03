import React from "react";
import { Link } from "../router";
import { useAvailability } from "../hooks/useApi";
import { StatusPill } from "../components/ui";

export default function Availability() {
  const { products, loading } = useAvailability();

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
            {loading ? (
              <div className="loading-state" style={{ margin: "40px 0" }}>Loading availability...</div>
            ) : products.length === 0 ? (
              <div className="empty-state" style={{ margin: "40px 0" }}>No availability data.</div>
            ) : (
              products.map((product) => (
                <div className="availability-row" key={product.id} data-testid={`row-availability-${product.id}`}>
                  <strong>{product.name}</strong>
                  <span>{product.note}</span>
                  <StatusPill status={product.status} />
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
