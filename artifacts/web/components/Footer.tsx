import Link from "next/link";
import { Logo } from "./Logo";

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
            <Link href="/products/mixes" className="footer-link" data-testid="footer-products">Mixes</Link>
            <Link href="/products/ryegrass" className="footer-link" data-testid="footer-ryegrass">Ryegrasses</Link>
            <Link href="/products/clovers" className="footer-link" data-testid="footer-clovers">Clovers</Link>
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