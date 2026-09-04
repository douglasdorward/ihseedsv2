import React from "react";
import { Link } from "../router";

export function Icon({ name, size = 22 }: { name: string; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (name === "menu") return <svg {...common}><path d="M4 6h16M4 12h16M4 18h16" /></svg>;
  if (name === "close") return <svg {...common}><path d="m6 6 12 12M18 6 6 18" /></svg>;
  if (name === "search") return <svg {...common}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>;
  if (name === "user") return <svg {...common}><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.9-3.2 3.2-4.8 7-4.8s6.1 1.6 7 4.8" /></svg>;
  if (name === "phone") return <svg {...common}><path d="M5 4.8c0-1 1.1-1.7 2-1.3l2.4 1.1c.6.3.9 1 .7 1.6l-.8 2.3a2 2 0 0 0 .4 2l1.8 1.8a2 2 0 0 0 2 .4l2.3-.8c.6-.2 1.3.1 1.6.7l1.1 2.4c.4.9-.3 2-1.3 2C10 17 7 14 5 4.8Z" /></svg>;
  if (name === "mail") return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></svg>;
  if (name === "clock") return <svg {...common}><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3 2" /></svg>;
  if (name === "arrow-left") return <svg {...common}><path d="M19 12H5m6-6-6 6 6 6" /></svg>;
  if (name === "arrow-right") return <svg {...common}><path d="M5 12h14m-6-6 6 6-6 6" /></svg>;
  if (name === "chevron-left") return <svg {...common}><path d="m15 18-6-6 6-6" /></svg>;
  if (name === "chevron-up") return <svg {...common}><path d="m18 15-6-6-6 6" /></svg>;
  if (name === "chevron-down") return <svg {...common}><path d="m6 9 6 6 6-6" /></svg>;
  if (name === "info") return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>;
  if (name === "trash-2") return <svg {...common}><path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v6M14 11v6" /></svg>;
  if (name === "settings") return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" /></svg>;
  if (name === "map-pin") return <svg {...common}><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></svg>;
  if (name === "sprout") return <svg {...common}><path d="M12 21V10M12 14c-4.5 0-6.5-2.5-6.5-6.5C9.5 7.5 12 9.5 12 14Zm0-4c0-4.1 2.2-6.2 6.5-6.2 0 3.8-2.1 6.2-6.5 6.2Z" /></svg>;
  if (name === "leaf") return <svg {...common}><path d="M20.5 3.5C13 3.5 6 7 4 13.5c-1 3.2 1.5 6 4.8 5.2C15.3 17.2 19 10.7 20.5 3.5Z"/><path d="M5.5 18.5c2.4-4.1 6-7.3 10.7-9.5"/></svg>;
  if (name === "cloud-rain") return <svg {...common}><path d="M7 17h10a4 4 0 0 0 .4-8A6 6 0 0 0 6 10.5 3.3 3.3 0 0 0 7 17Z"/><path d="m8 20-1 2m5-2-1 2m5-2-1 2"/></svg>;
  if (name === "layers") return <svg {...common}><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/></svg>;
  if (name === "scale") return <svg {...common}><path d="M12 3v18M5 6h14M7 6l-4 7h8L7 6Zm10 0-4 7h8l-4-7ZM8 21h8"/></svg>;
  if (name === "shield") return <svg {...common}><path d="M12 3 20 6v5c0 5.2-3.2 8.5-8 10-4.8-1.5-8-4.8-8-10V6l8-3Z"/><path d="m8.5 12 2.2 2.2 4.8-5"/></svg>;
  if (name === "target") return <svg {...common}><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/><path d="M18.5 5.5 21 3m-2.5.5H21V6"/></svg>;
  if (name === "paw-print") return <svg {...common}><ellipse cx="12" cy="16" rx="5" ry="4"/><circle cx="6.5" cy="9" r="2"/><circle cx="10.5" cy="6" r="2"/><circle cx="15.5" cy="6.5" r="2"/><circle cx="18" cy="10" r="2"/></svg>;
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
