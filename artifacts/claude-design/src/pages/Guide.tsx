import React from "react";
import { Link } from "../router";
import { imageOptions } from "../hooks/useApi";

export default function Guide() {
  return (
    <>
      <section style={{ background: "#FFFFFF" }}>
        <div className="page-hero-grid" style={{ maxWidth: 1180, margin: "0 auto", padding: "96px 40px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--green)" }}>Publication</div>
            <h1 style={{ margin: 0, fontSize: 56, lineHeight: 1.1, fontWeight: 800, color: "var(--green)" }}>2026 Pasture Seed Guide</h1>
            <p style={{ fontSize: 20, lineHeight: 1.6, color: "var(--black-green)" }}>
              The definitive resource for Western Australian pasture planning. Sowing rates, rainfall zones and species notes for every mix and variety we stock, in one download.
            </p>
            <div style={{ marginTop: 16 }}>
              <a href="/IH-Seeds-2026-Pasture-Seed-Guide.pdf" className="button button-primary" style={{ display: "inline-block", textDecoration: "none" }} download>Download PDF Guide</a>
            </div>
          </div>
          <div style={{ borderRadius: 24, overflow: "hidden", boxShadow: "0 20px 40px rgba(29,40,28,0.15)", background: "var(--sage)" }}>
            <img src={imageOptions[1]} alt="Seed Guide Cover" style={{ display: "block", width: "100%", height: 500, objectFit: "cover" }} />
          </div>
        </div>
      </section>
      
      <section style={{ background: "var(--sage)" }}>
        <div className="page-content" style={{ maxWidth: 1180, margin: "0 auto", padding: "96px 40px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 32, alignItems: "center", textAlign: "center" }}>
            <h2 style={{ fontSize: 36, fontWeight: 700, color: "var(--green)" }}>Need hard copies for the store?</h2>
            <p style={{ fontSize: 18, maxWidth: "60ch", lineHeight: 1.6 }}>We supply printed guides to rural resellers across the state. If you need a stack for your counter, let us know and we'll send them out.</p>
            <Link href="/contact" className="button button-outline">Request printed copies</Link>
          </div>
        </div>
      </section>
    </>
  );
}
