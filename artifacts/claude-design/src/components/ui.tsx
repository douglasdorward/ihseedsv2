import React from "react";
import { Link } from "../router";

export function Icon({ name, size = 22 }: { name: string; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (name === "menu") return <svg {...common}><path d="M4 6h16M4 12h16M4 18h16" /></svg>;
  if (name === "close") return <svg {...common}><path d="m6 6 12 12M18 6 6 18" /></svg>;
  if (name === "search") return <svg {...common}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>;
  if (name === "user") return <svg {...common}><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.9-3.2 3.2-4.8 7-4.8s6.1 1.6 7 4.8" /></svg>;
  if (name === "arrow-left") return <svg {...common}><path d="M19 12H5m6-6-6 6 6 6" /></svg>;
  if (name === "arrow-right") return <svg {...common}><path d="M5 12h14m-6-6 6 6-6 6" /></svg>;
  if (name === "map-pin") return <svg {...common}><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></svg>;
  if (name === "sprout") return <svg {...common}><path d="M12 21V10M12 14c-4.5 0-6.5-2.5-6.5-6.5C9.5 7.5 12 9.5 12 14Zm0-4c0-4.1 2.2-6.2 6.5-6.2 0 3.8-2.1 6.2-6.5 6.2Z" /></svg>;
  if (name === "handshake") return <svg {...common}><path d="m11 17 2 2a1 1 0 1 0 3-3"/><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06 0 6.04 6.04 0 0 1 0 8.27l-2.9 2.9a2.12 2.12 0 0 1-3.11 0l-2.61-2.61"/></svg>;
  if (name === "file-text") return <svg {...common}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>;
  if (name === "plus") return <svg {...common}><path d="M12 5v14M5 12h14"/></svg>;
  return <svg {...common}><path d="M12 20V11m0 0c-3.4 0-5.5-1.8-5.5-5.5C10.3 5.5 12 7.4 12 11Zm0 0c3.4 0 5.5-1.8 5.5-5.5C13.7 5.5 12 7.4 12 11Z" /></svg>;
}

export function Logo({ inverse = false }: { inverse?: boolean }) {
  return (
    <Link href="/" className={`logo ${inverse ? "logo-inverse" : ""}`} aria-label="Back to home">
      <img src="/ih-seeds-logo.png" alt="IH Seeds — Irwin Hunter & Co" />
    </Link>
  );
}

export function StatusPill({ status }: { status: string }) {
  const labels: Record<string, string> = { "in-stock": "In stock", low: "Low stock", "very-low": "Very low", unavailable: "Unavailable" };
  return (
    <span className={`status-pill status-${status}`} data-testid={`status-product-${status}`}>
      <i />{labels[status] ?? status}
    </span>
  );
}
