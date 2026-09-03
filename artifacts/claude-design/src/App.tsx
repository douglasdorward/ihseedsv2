import { useEffect } from "react";
import { SiteShell } from "./components/layout";
import { useLocation } from "./router";

import Home from "./pages/Home";
import Products from "./pages/Products";
import Category from "./pages/Category";
import ProductDetail from "./pages/ProductDetail";
import Resources from "./pages/Resources";
import Guide from "./pages/Guide";
import Availability from "./pages/Availability";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Admin from "./pages/Admin";

export default function App() {
  const [location] = useLocation();

  const route = (() => {
    if (location.startsWith("/admin")) return <Admin />;
    if (location === "/") return <Home />;
    if (location === "/products") return <Products />;
    if (/^\/category\/[^/]+$/.test(location)) return <Category />;
    if (/^\/products\/[^/]+$/.test(location)) return <ProductDetail />;
    if (location === "/resources") return <Resources />;
    if (location === "/guide") return <Guide />;
    if (location === "/availability") return <Availability />;
    if (location === "/about") return <About />;
    if (location === "/contact") return <Contact />;
    return (
      <div style={{ padding: "120px 40px", textAlign: "center", minHeight: "50vh" }}>
        <h1 style={{ fontSize: 48, color: "var(--green)", marginBottom: 16 }}>Page not found</h1>
        <p style={{ color: "var(--muted)", marginBottom: 32 }}>The page you are looking for doesn't exist.</p>
      </div>
    );
  })();

  useEffect(() => {
    const labels: Record<string, string> = {
      "/": "Pasture Seed Specialists",
      "/products": "Products",
      "/resources": "Resources & Tech Sheets",
      "/guide": "2026 Pasture Seed Guide",
      "/availability": "Seed Availability",
      "/about": "About Us",
      "/contact": "Get in Touch",
    };
    const label = location.startsWith("/admin")
      ? "Admin"
      : location.startsWith("/category/")
      ? "Seed Category"
      : location.startsWith("/products/")
        ? "Product Details"
        : labels[location] ?? "Page not found";
    document.title = `${label} — IH Seeds`;
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute("content", `${label} from IH Seeds, Western Australia's pasture seed specialists.`);
  }, [location]);

  if (location.startsWith("/admin")) return route;

  return (
    <SiteShell>
      {route}
    </SiteShell>
  );
}
