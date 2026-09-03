import React, { useState } from "react";
import { Link, useLocation } from "../router";
import { Icon, Logo } from "./ui";

export function Header() {
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === "/products") {
      return location === "/products" || location.startsWith("/products/") || location.startsWith("/category/");
    }
    return location === path || location.startsWith(`${path}/`);
  };
  const navItemClass = (path: string) => `nav-link ${isActive(path) ? "active" : ""}`;
  
  return (
    <header className="site-header" style={{ position: "relative", zIndex: 100 }}>
      <Logo />
      <nav className={`desktop-nav ${menuOpen ? "mobile-nav-open" : ""}`} aria-label="Main navigation">
        <Link href="/products" className={navItemClass("/products")} aria-current={isActive("/products") ? "page" : undefined} onClick={() => setMenuOpen(false)} data-testid="link-products">Products</Link>
        <Link href="/guide" className={navItemClass("/guide")} aria-current={isActive("/guide") ? "page" : undefined} onClick={() => setMenuOpen(false)} data-testid="link-guide">Seed Guide 2026</Link>
        <Link href="/availability" className={navItemClass("/availability")} aria-current={isActive("/availability") ? "page" : undefined} onClick={() => setMenuOpen(false)} data-testid="link-availability">Seed Availability</Link>
        <Link href="/resources" className={navItemClass("/resources")} aria-current={isActive("/resources") ? "page" : undefined} onClick={() => setMenuOpen(false)} data-testid="link-resources">Resources</Link>
        <Link href="/about" className={navItemClass("/about")} aria-current={isActive("/about") ? "page" : undefined} onClick={() => setMenuOpen(false)} data-testid="link-about">About</Link>
        <Link href="/contact" className="button button-accent nav-cta" onClick={() => setMenuOpen(false)} data-testid="button-get-in-touch">Get in Touch</Link>
        <Link href="/products" className="utility-button" onClick={() => setMenuOpen(false)} data-testid="button-search" aria-label="Search catalogue"><Icon name="search" size={18} /></Link>
      </nav>
      <button className="mobile-menu-button" onClick={() => setMenuOpen((open) => !open)} data-testid="button-mobile-menu" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen}><Icon name={menuOpen ? "close" : "menu"} size={26} /></button>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-top">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Logo inverse />
          <p>The pasture seed and mixes specialists of Western Australia.</p>
        </div>
        <div className="footer-columns">
          <div>
            <h4>Products</h4>
            <Link href="/category/mixes" className="footer-link" data-testid="footer-products">Specialty Mixes</Link>
            <Link href="/category/ryegrass" className="footer-link" data-testid="footer-ryegrass">Ryegrass</Link>
            <Link href="/category/clovers" className="footer-link" data-testid="footer-clovers">Clovers</Link>
          </div>
          <div>
            <h4>Resources</h4>
            <Link href="/resources" className="footer-link" data-testid="footer-resources">Tips &amp; Advice</Link>
            <Link href="/guide" className="footer-link" data-testid="footer-guide">Pasture Seed Guide</Link>
            <Link href="/availability" className="footer-link" data-testid="footer-availability">Seed Availability</Link>
          </div>
          <div>
            <h4>Company</h4>
            <Link href="/about" className="footer-link" data-testid="footer-story">Our Story</Link>
            <Link href="/contact" className="footer-link" data-testid="footer-contact">Contact</Link>
          </div>
        </div>
      </div>
      <div className="footer-bottom">© 2026 Irwin Hunter &amp; Co · Australian Seed Federation member</div>
    </footer>
  );
}

export function SiteShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  // Automatically scroll to top on path change
  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);
  
  return (
    <div className="site-shell">
      <Header />
      <main>{children}</main>
      <Footer />
    </div>
  );
}
