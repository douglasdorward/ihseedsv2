import Link from "next/link";
import { companyMapsUrl, DEFAULT_COMPANY, type CompanyContact } from "../lib/company";
import { Logo } from "./Logo";

export function Footer({ company = DEFAULT_COMPANY }: { company?: CompanyContact }) {
  const mapsUrl = companyMapsUrl(company.address);
  return (
    <footer className="site-footer">
      <div className="footer-top">
        <div className="footer-brand">
          <Logo inverse />
          <p>The pasture seed and mixes specialists of Western Australia.</p>
          {mapsUrl ? (
            <a className="footer-address" href={mapsUrl} target="_blank" rel="noreferrer">
              {company.address}
            </a>
          ) : company.address ? (
            <p className="footer-address">{company.address}</p>
          ) : null}
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
            <Link href="/privacy" className="footer-link" data-testid="footer-privacy">Privacy</Link>
            <Link href="/terms-and-conditions" className="footer-link" data-testid="footer-terms">Terms</Link>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© 2026 {company.legalName} · Australian Seed Federation member</span>
        <span className="footer-legal">
          <Link href="/privacy" className="footer-link" data-testid="footer-privacy-bottom">Privacy</Link>
          <Link href="/terms-and-conditions" className="footer-link" data-testid="footer-terms-bottom">Terms</Link>
        </span>
      </div>
    </footer>
  );
}
