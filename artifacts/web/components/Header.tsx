"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Icon } from "./Icon";
import { Logo } from "./Logo";

export function Header() {
  const location = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === "/products") {
      return location === "/products" || location.startsWith("/products/");
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