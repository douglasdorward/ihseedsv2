import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  getGetAdminSiteSettingsQueryKey,
  useGetAdminSiteSettings,
  useUpdateSiteSettings,
  type SiteCompanySettings,
  type SiteSettings,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Icon } from "../components/ui";
import { navigate } from "../router";
import "../homepage-editor.css";

function PageHeader({ eyebrow, title, onBack, action }: { eyebrow: string; title: ReactNode; onBack?: () => void; action?: ReactNode }) {
  return (
    <header className="admin-page-header" style={{ flexDirection: "column", alignItems: "stretch", gap: 16 }}>
      {onBack && (
        <button type="button" className="admin-back-link" onClick={onBack}>
          <Icon name="chevron-left" size={14} /> Back
        </button>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
        <div><p>{eyebrow}</p><h1>{title}</h1></div>
        {action}
      </div>
    </header>
  );
}

function seedGuideInput(seedGuide: SiteSettings["seedGuide"]) {
  return {
    navTitle: seedGuide.navTitle,
    cardHeading: seedGuide.cardHeading,
    cardButtonLabel: seedGuide.cardButtonLabel,
    cardImageSrc: seedGuide.cardImageSrc,
    cardImageAssetId: seedGuide.cardImageAssetId,
    pageTitle: seedGuide.pageTitle,
    pageIntro: seedGuide.pageIntro,
    pageButtonLabel: seedGuide.pageButtonLabel,
  };
}

const SOCIAL_LINK_LIMIT = 10;

const SOCIAL_PLATFORMS: Array<[string, string]> = [
  ["facebook.com", "Facebook"],
  ["fb.com", "Facebook"],
  ["instagram.com", "Instagram"],
  ["linkedin.com", "LinkedIn"],
  ["youtube.com", "YouTube"],
  ["youtu.be", "YouTube"],
  ["x.com", "X"],
  ["twitter.com", "X"],
  ["tiktok.com", "TikTok"],
  ["pinterest.com", "Pinterest"],
  ["google.com", "Google"],
  ["goo.gl", "Google"],
];

/** Same rules as the server: a full or bare web address becomes a clean https URL, anything else is rejected. */
function normalizeSocialLink(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed.replace(/^http:\/\//i, "https://")
    : `https://${trimmed.replace(/^\/+/, "")}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "https:" || !url.hostname.includes(".") || url.username || url.password) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function platformName(link: string) {
  const normalized = normalizeSocialLink(link);
  if (!normalized) return "";
  const host = new URL(normalized).hostname.replace(/^www\./, "").toLowerCase();
  return SOCIAL_PLATFORMS.find(([domain]) => host === domain || host.endsWith(`.${domain}`))?.[1] ?? "Website";
}

function cleanLinks(links: string[]) {
  const seen = new Set<string>();
  const clean: string[] = [];
  for (const link of links) {
    const normalized = normalizeSocialLink(link);
    if (!normalized || seen.has(normalized.toLowerCase())) continue;
    seen.add(normalized.toLowerCase());
    clean.push(normalized);
  }
  return clean.slice(0, SOCIAL_LINK_LIMIT);
}

function formFromSettings(company: SiteCompanySettings): SiteCompanySettings {
  return {
    legalName: company.legalName,
    tradingName: company.tradingName,
    phone: company.phone,
    email: company.email,
    address: company.address,
    officeHours: company.officeHours,
    abn: company.abn,
    socialLinks: company.socialLinks ?? [],
  };
}

function snapshot(form: SiteCompanySettings) {
  return JSON.stringify({ ...form, socialLinks: cleanLinks(form.socialLinks ?? []) });
}

export default function AdminCompany() {
  const queryClient = useQueryClient();
  const { data, isLoading, error: loadError, refetch } = useGetAdminSiteSettings();
  const updateSettings = useUpdateSiteSettings();
  const [form, setForm] = useState<SiteCompanySettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const savedJson = useMemo(() => data ? snapshot(formFromSettings(data.company)) : "", [data]);
  const dirty = Boolean(form && snapshot(form) !== savedJson);

  useEffect(() => {
    if (data && !form) setForm(formFromSettings(data.company));
  }, [data, form]);

  const setField = <K extends keyof SiteCompanySettings>(key: K, value: SiteCompanySettings[K]) => {
    setForm((current) => current ? { ...current, [key]: value } : current);
  };

  const save = async () => {
    if (!form || !data) return;
    const links = form.socialLinks ?? [];
    const badLink = links.find((link) => link.trim() && !normalizeSocialLink(link));
    if (badLink) {
      setMessage("");
      setError(`“${badLink.trim()}” is not a valid web address. Use the full address of the profile, such as https://www.facebook.com/yourpage.`);
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await updateSettings.mutateAsync({
        data: {
          homepage: data.homepage,
          seedGuide: seedGuideInput(data.seedGuide),
          company: { ...form, socialLinks: cleanLinks(links) },
        },
      });
      await queryClient.invalidateQueries({ queryKey: getGetAdminSiteSettingsQueryKey(), refetchType: "all" });
      const next = await refetch();
      if (next.data) setForm(formFromSettings(next.data.company));
      setMessage("Company details saved. They appear on Contact, the footer and the site markup (Organization, LocalBusiness and social profile links) immediately.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not save company details.");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || !form || !data) {
    return <div className="admin-content"><div className="admin-empty">Loading company details…</div></div>;
  }
  if (loadError) {
    return (
      <div className="admin-content">
        <div className="admin-empty">
          <strong>Company details could not be loaded.</strong>
          <button type="button" className="admin-button primary" onClick={() => refetch()}>Try again</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Site settings"
        title={<>Company <strong>details</strong></>}
        onBack={() => navigate("/admin/site-settings")}
        action={
          <button className="admin-button primary" type="button" onClick={() => void save()} disabled={saving || !dirty}>
            {saving ? "Saving…" : "Save company details"}
          </button>
        }
      />
      <form className="admin-content admin-seed-guide" onSubmit={(event) => { event.preventDefault(); void save(); }}>
        {error && <div className="admin-notice admin-notice-error" role="alert"><p>{error}</p></div>}
        {message && <div className="admin-notice"><p>{message}</p></div>}

        <section className="admin-panel admin-form-card">
          <div className="admin-section-heading">
            <div>
              <h3>Names</h3>
              <p>Legal name appears in the footer. Trading name is used in titles and Organization markup.</p>
            </div>
          </div>
          <label>
            Legal name
            <input value={form.legalName} onChange={(event) => setField("legalName", event.target.value)} maxLength={160} />
          </label>
          <label>
            Trading name
            <input value={form.tradingName} onChange={(event) => setField("tradingName", event.target.value)} maxLength={160} />
          </label>
          <label>
            ABN
            <input value={form.abn} onChange={(event) => setField("abn", event.target.value)} maxLength={20} placeholder="Optional" />
            <small>Leave blank until the ABN is confirmed.</small>
          </label>
        </section>

        <section className="admin-panel admin-form-card">
          <div className="admin-section-heading">
            <div>
              <h3>Contact</h3>
              <p>Shown on the public Contact page. Leave the phone blank to hide the call card until you have the real number.</p>
            </div>
          </div>
          <label>
            Office phone
            <input value={form.phone} onChange={(event) => setField("phone", event.target.value)} maxLength={40} placeholder="Shown only when filled" />
          </label>
          <label>
            Email
            <input type="email" value={form.email} onChange={(event) => setField("email", event.target.value)} maxLength={180} />
          </label>
          <label>
            Address
            <textarea value={form.address} onChange={(event) => setField("address", event.target.value)} rows={2} maxLength={240} />
          </label>
          <label>
            Office hours
            <input value={form.officeHours} onChange={(event) => setField("officeHours", event.target.value)} maxLength={120} />
            <small>Written like “Monday to Friday, 8am–5pm AWST” so search engines can read the opening hours.</small>
          </label>
        </section>

        <section className="admin-panel admin-form-card">
          <div className="admin-section-heading">
            <div>
              <h3>Social media profiles</h3>
              <p>Add the official pages for Facebook, Instagram, LinkedIn, YouTube and so on. They are published in the site's search markup (sameAs) so Google can connect these profiles to IH Seeds. They are not shown as buttons on the site. Up to {SOCIAL_LINK_LIMIT}.</p>
            </div>
          </div>
          {(form.socialLinks ?? []).length === 0 && <p className="admin-field-hint">No profiles added yet.</p>}
          {(form.socialLinks ?? []).map((link, index) => {
            const invalid = Boolean(link.trim()) && !normalizeSocialLink(link);
            const platform = platformName(link);
            return (
              <label key={index}>
                Profile {index + 1}{platform ? ` · ${platform}` : ""}
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="url"
                    style={{ flex: 1 }}
                    value={link}
                    onChange={(event) => setField("socialLinks", (form.socialLinks ?? []).map((item, itemIndex) => itemIndex === index ? event.target.value : item))}
                    placeholder="https://www.facebook.com/yourpage"
                    maxLength={300}
                    aria-invalid={invalid}
                  />
                  <button type="button" className="admin-text-button" onClick={() => setField("socialLinks", (form.socialLinks ?? []).filter((_, itemIndex) => itemIndex !== index))}>
                    Remove
                  </button>
                </div>
                {invalid && <small className="admin-inline-field-error">Enter the full address of the profile, such as https://www.facebook.com/yourpage</small>}
              </label>
            );
          })}
          {(form.socialLinks ?? []).length < SOCIAL_LINK_LIMIT && (
            <div>
              <button type="button" className="admin-button outline" onClick={() => setField("socialLinks", [...(form.socialLinks ?? []), ""])}>
                Add a profile link
              </button>
            </div>
          )}
        </section>
      </form>
    </>
  );
}
