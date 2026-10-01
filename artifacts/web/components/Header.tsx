"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FocusEvent } from "react";
import { CATALOGUE_INDEX_PATH, categoryPublicPath, type NavCategory } from "../lib/catalogue-paths";
import { Icon } from "./Icon";
import { Logo } from "./Logo";
import { SiteSearch } from "./SiteSearch";

type MobilePanel = "products" | "resources";

function useDismissableMenu(location: string) {
  const [dismissed, setDismissed] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pointerInside = useRef(false);
  const skipDismiss = useRef(true);

  const dismiss = useCallback(() => {
    setDismissed(true);
    const active = document.activeElement;
    if (active instanceof HTMLElement && ref.current?.contains(active)) {
      active.blur();
    }
  }, []);

  useEffect(() => {
    if (skipDismiss.current) {
      skipDismiss.current = false;
      return;
    }
    if (ref.current?.contains(document.activeElement)) {
      dismiss();
    }
  }, [location, dismiss]);

  useEffect(() => {
    if (!dismissed) return;
    const releaseIfPointerOutside = (event: PointerEvent) => {
      const menu = ref.current;
      const target = event.target;
      const inside = Boolean(menu && target instanceof Node && menu.contains(target));
      pointerInside.current = inside;
      if (!inside) setDismissed(false);
    };
    document.addEventListener("pointermove", releaseIfPointerOutside);
    document.addEventListener("pointerdown", releaseIfPointerOutside);
    return () => {
      document.removeEventListener("pointermove", releaseIfPointerOutside);
      document.removeEventListener("pointerdown", releaseIfPointerOutside);
    };
  }, [dismissed]);

  return {
    dismiss,
    menuProps: {
      ref,
      className: `nav-dropdown${dismissed ? " is-dismissed" : ""}`,
      onMouseEnter: () => {
        pointerInside.current = true;
      },
      onMouseLeave: () => {
        pointerInside.current = false;
        setDismissed(false);
      },
      onFocus: () => {
        if (pointerInside.current) return;
        setDismissed(false);
      },
      onBlur: (event: FocusEvent<HTMLDivElement>) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        if (pointerInside.current) return;
        setDismissed(false);
      },
    },
  };
}

export function Header({ productCategories = [], seedGuideTitle = "Seed Guide 2026" }: { productCategories?: NavCategory[]; seedGuideTitle?: string }) {
  const location = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel | null>(null);
  const backButtonRef = useRef<HTMLButtonElement>(null);
  const productsMenu = useDismissableMenu(location);
  const resourcesMenu = useDismissableMenu(location);
  const closeSearch = useCallback(() => setSearchOpen(false), []);
  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    setMobilePanel(null);
  }, []);
  const closeSearchAndMenu = useCallback(() => {
    closeMenu();
    setSearchOpen(false);
  }, [closeMenu]);

  useEffect(() => {
    closeSearchAndMenu();
  }, [location, closeSearchAndMenu]);

  useEffect(() => {
    if (!mobilePanel) return;
    backButtonRef.current?.focus();
  }, [mobilePanel]);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 901px)");
    const reset = () => {
      if (query.matches) setMobilePanel(null);
    };
    query.addEventListener("change", reset);
    return () => query.removeEventListener("change", reset);
  }, []);

  const isActive = (path: string) => {
    if (path === "/products") {
      return location === "/products" || location.startsWith("/products/");
    }
    return location === path || location.startsWith(`${path}/`);
  };
  const navItemClass = (path: string) => `nav-link ${isActive(path) ? "active" : ""}`;
  const selectProductsLink = () => {
    closeMenu();
    productsMenu.dismiss();
  };
  const selectResourcesLink = () => {
    closeMenu();
    resourcesMenu.dismiss();
  };
  const resourcesActive = isActive("/articles") || isActive("/tech-sheets");
  const productLinks = productCategories.map((category) => {
    const href = categoryPublicPath(category);
    const current = location === href || location.startsWith(`${href}/`);
    return (
      <li key={category.slug}>
        <Link href={href} className={current ? "is-current" : undefined} aria-current={current ? "page" : undefined} onClick={selectProductsLink} data-testid={`link-products-nav-${category.slug}`}>{category.name}</Link>
      </li>
    );
  });

  return (
    <header className="site-header">
      <Logo />
      <nav className={`desktop-nav ${menuOpen ? "mobile-nav-open" : ""}${mobilePanel ? " is-mobile-panel" : ""}`} aria-label="Main navigation">
        {mobilePanel ? (
          <div className="nav-mobile-screen">
            <button
              ref={backButtonRef}
              type="button"
              className="nav-mobile-back"
              onClick={() => setMobilePanel(null)}
              data-testid="button-mobile-nav-back"
            >
              <Icon name="chevron-left" size={20} />
              Back
            </button>
            {mobilePanel === "products" ? (
              <>
                <p className="nav-mobile-title" id="mobile-products-title">Products</p>
                <ul className="nav-dropdown-list" aria-labelledby="mobile-products-title">
                  {productLinks}
                </ul>
                <Link href={CATALOGUE_INDEX_PATH} className="button button-accent nav-dropdown-all" onClick={selectProductsLink} data-testid="link-products-nav-all">All categories <Icon name="chevron-right" size={16} /></Link>
              </>
            ) : (
              <>
                <p className="nav-mobile-title" id="mobile-resources-title">Resources</p>
                <ul className="nav-dropdown-list" aria-labelledby="mobile-resources-title">
                  <li>
                    <Link href="/articles" className={isActive("/articles") ? "is-current" : undefined} aria-current={isActive("/articles") ? "page" : undefined} onClick={selectResourcesLink} data-testid="link-resources-articles">Articles</Link>
                  </li>
                  <li>
                    <Link href="/tech-sheets" className={isActive("/tech-sheets") ? "is-current" : undefined} aria-current={isActive("/tech-sheets") ? "page" : undefined} onClick={selectResourcesLink} data-testid="link-resources-tech-sheets">Tech Sheets</Link>
                  </li>
                </ul>
              </>
            )}
          </div>
        ) : (
          <>
            <Link href="/" className={navItemClass("/")} aria-current={isActive("/") ? "page" : undefined} onClick={closeMenu} data-testid="link-home">Home</Link>
            <div {...productsMenu.menuProps}>
              <Link href={CATALOGUE_INDEX_PATH} className={`${navItemClass("/products")} nav-desktop-only`} aria-current={isActive("/products") ? "page" : undefined} aria-haspopup="true" aria-controls="products-nav-menu" onClick={selectProductsLink} data-testid="link-products">Products</Link>
              <button
                type="button"
                className={`${navItemClass("/products")} nav-mobile-parent`}
                aria-haspopup="true"
                aria-expanded={false}
                onClick={() => setMobilePanel("products")}
                data-testid="button-products-menu"
              >
                Products
                <Icon name="chevron-right" size={18} />
              </button>
              <div id="products-nav-menu" className="nav-dropdown-panel">
                <ul className="nav-dropdown-list" aria-label="Product categories">
                  {productLinks}
                </ul>
                <Link href={CATALOGUE_INDEX_PATH} className="button button-accent nav-dropdown-all" onClick={selectProductsLink} data-testid="link-products-nav-all">All categories <Icon name="chevron-right" size={16} /></Link>
              </div>
            </div>
            <Link href="/guide" className={navItemClass("/guide")} aria-current={isActive("/guide") ? "page" : undefined} onClick={closeMenu} data-testid="link-guide">{seedGuideTitle}</Link>
            <Link href="/availability" className={navItemClass("/availability")} aria-current={isActive("/availability") ? "page" : undefined} onClick={closeMenu} data-testid="link-availability">Seed Availability</Link>
            <div {...resourcesMenu.menuProps}>
              <button type="button" className={`nav-link nav-desktop-only${resourcesActive ? " active" : ""}`} aria-haspopup="true" aria-controls="resources-nav-menu" data-testid="link-resources">Resources</button>
              <button
                type="button"
                className={`nav-link nav-mobile-parent${resourcesActive ? " active" : ""}`}
                aria-haspopup="true"
                aria-expanded={false}
                onClick={() => setMobilePanel("resources")}
                data-testid="button-resources-menu"
              >
                Resources
                <Icon name="chevron-right" size={18} />
              </button>
              <div id="resources-nav-menu" className="nav-dropdown-panel">
                <ul className="nav-dropdown-list" aria-label="Resources">
                  <li>
                    <Link href="/articles" className={isActive("/articles") ? "is-current" : undefined} aria-current={isActive("/articles") ? "page" : undefined} onClick={selectResourcesLink} data-testid="link-resources-articles">Articles</Link>
                  </li>
                  <li>
                    <Link href="/tech-sheets" className={isActive("/tech-sheets") ? "is-current" : undefined} aria-current={isActive("/tech-sheets") ? "page" : undefined} onClick={selectResourcesLink} data-testid="link-resources-tech-sheets">Tech Sheets</Link>
                  </li>
                </ul>
              </div>
            </div>
            <Link href="/about" className={navItemClass("/about")} aria-current={isActive("/about") ? "page" : undefined} onClick={closeMenu} data-testid="link-about">About</Link>
            <Link href="/contact" className="button button-accent nav-cta" onClick={closeMenu} data-testid="button-get-in-touch">Get in Touch</Link>
            <button type="button" className="utility-button" data-testid="button-search" aria-label="Search catalogue" aria-expanded={searchOpen} aria-controls="site-search-dialog" onClick={() => setSearchOpen(true)}><Icon name="search" size={18} /></button>
          </>
        )}
      </nav>
      <SiteSearch open={searchOpen} onClose={closeSearch} onNavigate={closeSearchAndMenu} />
      <button
        className="mobile-menu-button"
        onClick={() => {
          setMenuOpen((open) => !open);
          setMobilePanel(null);
        }}
        data-testid="button-mobile-menu"
        aria-label={menuOpen ? "Close menu" : "Open menu"}
        aria-expanded={menuOpen}
      >
        <Icon name={menuOpen ? "close" : "menu"} size={26} />
      </button>
    </header>
  );
}
