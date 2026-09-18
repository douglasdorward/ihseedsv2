"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { CATALOGUE_INDEX_PATH, categoryPublicPath, type NavCategory } from "../lib/catalogue-paths";
import { Icon } from "./Icon";
import { Logo } from "./Logo";

export function Header({ productCategories = [], seedGuideTitle = "Seed Guide 2026" }: { productCategories?: NavCategory[]; seedGuideTitle?: string }) {
  const location = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === "/products") {
      return location === "/products" || location.startsWith("/products/");
    }
    return location === path || location.startsWith(`${path}/`);
  };
  const navItemClass = (path: string) => `nav-link ${isActive(path) ? "active" : ""}`;
  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="site-header" style={{ position: "relative", zIndex: 100 }}>
      <Logo />
      <nav className={`desktop-nav ${menuOpen ? "mobile-nav-open" : ""}`} aria-label="Main navigation">
        <div className="nav-dropdown">
          <Link href={CATALOGUE_INDEX_PATH} className={navItemClass("/products")} aria-current={isActive("/products") ? "page" : undefined} aria-haspopup="true" aria-controls="products-nav-menu" onClick={closeMenu} data-testid="link-products">Products</Link>
          <div id="products-nav-menu" className="nav-dropdown-panel">
            <ul className="nav-dropdown-list" aria-label="Product categories">
              {productCategories.map((category) => {
                const href = categoryPublicPath(category);
                const current = location === href || location.startsWith(`${href}/`);
                return (
                  <li key={category.slug}>
                    <Link href={href} className={current ? "is-current" : undefined} aria-current={current ? "page" : undefined} onClick={closeMenu} data-testid={`link-products-nav-${category.slug}`}>{category.name}</Link>
                  </li>
                );
              })}
            </ul>
            <Link href={CATALOGUE_INDEX_PATH} className="button button-accent nav-dropdown-all" onClick={closeMenu} data-testid="link-products-nav-all">All categories <Icon name="chevron-right" size={16} /></Link>
          </div>
        </div>
        <Link href="/guide" className={navItemClass("/guide")} aria-current={isActive("/guide") ? "page" : undefined} onClick={closeMenu} data-testid="link-guide">{seedGuideTitle}</Link>
        <Link href="/availability" className={navItemClass("/availability")} aria-current={isActive("/availability") ? "page" : undefined} onClick={closeMenu} data-testid="link-availability">Seed Availability</Link>
        <Link href="/resources" className={navItemClass("/resources")} aria-current={isActive("/resources") ? "page" : undefined} onClick={closeMenu} data-testid="link-resources">Resources</Link>
        <Link href="/about" className={navItemClass("/about")} aria-current={isActive("/about") ? "page" : undefined} onClick={closeMenu} data-testid="link-about">About</Link>
        <Link href="/contact" className="button button-accent nav-cta" onClick={closeMenu} data-testid="button-get-in-touch">Get in Touch</Link>
        <Link href={CATALOGUE_INDEX_PATH} className="utility-button" onClick={closeMenu} data-testid="button-search" aria-label="Search catalogue"><Icon name="search" size={18} /></Link>
      </nav>
      <button className="mobile-menu-button" onClick={() => setMenuOpen((open) => !open)} data-testid="button-mobile-menu" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen}><Icon name={menuOpen ? "close" : "menu"} size={26} /></button>
    </header>
  );
}
