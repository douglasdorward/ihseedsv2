import type { ReactNode } from "react";
import { Icon } from "../components/ui";
import { navigate } from "../router";

function PageHeader({ eyebrow, title }: { eyebrow: string; title: ReactNode }) {
  return (
    <header className="admin-page-header">
      <div><p>{eyebrow}</p><h1>{title}</h1></div>
    </header>
  );
}

import "../homepage-editor.css";

const sections = [
  {
    href: "/admin/site-settings/company",
    icon: "phone",
    title: "Company details",
    body: "Edit the public office phone, email, address, hours and legal names used on Contact, the footer and Organization markup.",
    action: "Edit company details",
  },
  {
    href: "/admin/site-settings/home",
    icon: "image",
    title: "Home page",
    body: "Edit the public homepage hero photos, optional slideshow and copy, the About Us blurb, then choose the four Best Sellers shown on the home page.",
    action: "Edit home page",
  },
  {
    href: "/admin/site-settings/about",
    icon: "users",
    title: "About us",
    body: "Preview the public About us page and edit the hero, story and values copy in place. The hero photo also appears on the home page About Us panel.",
    action: "Edit About us",
  },
  {
    href: "/admin/site-settings/categories",
    icon: "sprout",
    title: "Root categories",
    body: "Edit search titles, meta descriptions and ten general FAQs for every root category page, or import FAQs from a template that lists those categories.",
    action: "Open root editor",
  },
  {
    href: "/admin/site-settings/seed-guide",
    icon: "file-text",
    title: "Seed guide",
    body: "Upload the pasture seed guide PDF, change the card copy and background, and set the menu title.",
    action: "Open seed guide editor",
  },
] as const;

export default function AdminSiteSettings() {
  return (
    <>
      <PageHeader eyebrow="Site settings" title={<>Public <strong>pages</strong></>} />
      <div className="admin-content">
        <div className="admin-notice">
          <Icon name="info" size={20} />
          <p>Changes saved here appear on the public website immediately. Product taxonomy still lives under Products &amp; mixes.</p>
        </div>
        <div className="admin-site-settings-grid">
          {sections.map((section) => (
            <section className="admin-panel admin-site-settings-card" key={section.href}>
              <span className="admin-feature-icon"><Icon name={section.icon} size={24} /></span>
              <h2>{section.title}</h2>
              <p>{section.body}</p>
              <button className="admin-button outline" type="button" onClick={() => navigate(section.href)}>
                {section.action}
              </button>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
