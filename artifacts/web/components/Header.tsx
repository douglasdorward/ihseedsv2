"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { CATALOGUE_INDEX_PATH, categoryPublicPath, type NavCategory } from "../lib/catalogue-paths";
import { Icon } from "./Icon";
import { Logo } from "./Logo";
import { SiteSearch } from "./SiteSearch";

export function Header({ productCategories = [], seedGuideTitle = "Seed Guide 2026" }: { productCategories?: NavCategory[]; seedGuideTitle?: string }) {
  const location = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [productsMenuDismissed, setProductsMenuDismissed] = useState(false);
  const productsMenuRef = useRef<HTMLDivElement>(null);
  const pointerInsideProductsMenu = useRef(false);
  const skipProductsDismiss = useRef(true);
  const closeSearch = useCallback(() => setSearchOpen(false), []);
  const closeSearchAndMenu = useCallback(() => {
    setMenuOpen(false);
    setSearchOpen(false);
  }, []);
  const dismissProductsMenu = useCallback(() => {
    setProductsMenuDismissed(true);
    const active = document.activeElement;
    if (active instanceof HTMLElement && productsMenuRef.current?.contains(active)) {
      active.blur();
    }
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
    if (skipProductsDismiss.current) {
      skipProductsDismiss.current = false;
      return;
    }
    if (productsMenuRef.current?.contains(document.activeElement)) {
      dismissProductsMenu();
    }
  }, [location, dismissProductsMenu]);

  useEffect(() => {
    if (!productsMenuDismissed) return;
    const releaseIfPointerOutside = (event: PointerEvent) => {
      const menu = productsMenuRef.current;
      const target = event.target;
      const inside = Boolean(menu && target instanceof Node && menu.contains(target));
      pointerInsideProductsMenu.current = inside;
      if (!inside) setProductsMenuDismissed(false);
    };
    document.addEventListener("pointermove", releaseIfPointerOutside);
    document.addEventListener("pointerdown", releaseIfPointerOutside);
    return () => {
      document.removeEventListener("pointermove", releaseIfPointerOutside);
      document.removeEventListener("pointerdown", releaseIfPointerOutside);
    };
  }, [productsMenuDismissed]);

  const isActive = (path: string) => {
    if (path === "/products") {
      return location === "/products" || location.startsWith("/products/");
    }
    return location === path || location.startsWith(`${path}/`);
  };
  const navItemClass = (path: string) => `nav-link ${isActive(path) ? "active" : ""}`;
  const closeMenu = () => setMenuOpen(false);
  const selectProductsLink = () => {
    closeMenu();
    dismissProductsMenu();
  };

  return (
    <header className="site-header">
      <Logo />
      <nav className={`desktop-nav ${menuOpen ? "mobile-nav-open" : ""}`} aria-label="Main navigation">
        <Link href="/" className={navItemClass("/")} aria-current={isActive("/") ? "page" : undefined} onClick={closeMenu} data-testid="link-home">Home</Link>
        <div
          ref={productsMenuRef}
          className={`nav-dropdown${productsMenuDismissed ? " is-dismissed" : ""}`}
          onMouseEnter={() => {
            pointerInsideProductsMenu.current = true;
          }}
          onMouseLeave={() => {
            pointerInsideProductsMenu.current = false;
            setProductsMenuDismissed(false);
          }}
          onFocus={() => {
            if (pointerInsideProductsMenu.current) return;
            setProductsMenuDismissed(false);
          }}
          onBlur={(event) => {
            if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
            if (pointerInsideProductsMenu.current) return;
            setProductsMenuDismissed(false);
          }}
        >
          <Link href={CATALOGUE_INDEX_PATH} className={navItemClass("/products")} aria-current={isActive("/products") ? "page" : undefined} aria-haspopup="true" aria-controls="products-nav-menu" onClick={selectProductsLink} data-testid="link-products">Products</Link>
          <div id="products-nav-menu" className="nav-dropdown-panel">
            <ul className="nav-dropdown-list" aria-label="Product categories">
              {productCategories.map((category) => {
                const href = categoryPublicPath(category);
                const current = location === href || location.startsWith(`${href}/`);
                return (
                  <li key={category.slug}>
                    <Link href={href} className={current ? "is-current" : undefined} aria-current={current ? "page" : undefined} onClick={selectProductsLink} data-testid={`link-products-nav-${category.slug}`}>{category.name}</Link>
                  </li>
                );
              })}
            </ul>
            <Link href={CATALOGUE_INDEX_PATH} className="button button-accent nav-dropdown-all" onClick={selectProductsLink} data-testid="link-products-nav-all">All categories <Icon name="chevron-right" size={16} /></Link>
          </div>
        </div>
        <Link href="/guide" className={navItemClass("/guide")} aria-current={isActive("/guide") ? "page" : undefined} onClick={closeMenu} data-testid="link-guide">{seedGuideTitle}</Link>
        <Link href="/availability" className={navItemClass("/availability")} aria-current={isActive("/availability") ? "page" : undefined} onClick={closeMenu} data-testid="link-availability">Seed Availability</Link>
        <Link href="/resources" className={navItemClass("/resources")} aria-current={isActive("/resources") ? "page" : undefined} onClick={closeMenu} data-testid="link-resources">Resources</Link>
        <Link href="/about" className={navItemClass("/about")} aria-current={isActive("/about") ? "page" : undefined} onClick={closeMenu} data-testid="link-about">About</Link>
        <Link href="/contact" className="button button-accent nav-cta" onClick={closeMenu} data-testid="button-get-in-touch">Get in Touch</Link>
        <button type="button" className="utility-button" data-testid="button-search" aria-label="Search catalogue" aria-expanded={searchOpen} aria-controls="site-search-dialog" onClick={() => setSearchOpen(true)}><Icon name="search" size={18} /></button>
      </nav>
      <SiteSearch open={searchOpen} onClose={closeSearch} onNavigate={closeSearchAndMenu} />
      <button className="mobile-menu-button" onClick={() => setMenuOpen((open) => !open)} data-testid="button-mobile-menu" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen}><Icon name={menuOpen ? "close" : "menu"} size={26} /></button>
    </header>
  );
}
