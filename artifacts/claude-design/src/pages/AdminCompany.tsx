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

function formFromSettings(company: SiteCompanySettings): SiteCompanySettings {
  return {
    legalName: company.legalName,
    tradingName: company.tradingName,
    phone: company.phone,
    email: company.email,
    address: company.address,
    officeHours: company.officeHours,
    abn: company.abn,
  };
}

export default function AdminCompany() {
  const queryClient = useQueryClient();
  const { data, isLoading, error: loadError, refetch } = useGetAdminSiteSettings();
  const updateSettings = useUpdateSiteSettings();
  const [form, setForm] = useState<SiteCompanySettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const savedJson = useMemo(() => data ? JSON.stringify(formFromSettings(data.company)) : "", [data]);
  const dirty = Boolean(form && JSON.stringify(form) !== savedJson);

  useEffect(() => {
    if (data && !form) setForm(formFromSettings(data.company));
  }, [data, form]);

  const setField = <K extends keyof SiteCompanySettings>(key: K, value: SiteCompanySettings[K]) => {
    setForm((current) => current ? { ...current, [key]: value } : current);
  };

  const save = async () => {
    if (!form || !data) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await updateSettings.mutateAsync({
        data: {
          homepage: data.homepage,
          seedGuide: seedGuideInput(data.seedGuide),
          company: form,
        },
      });
      await queryClient.invalidateQueries({ queryKey: getGetAdminSiteSettingsQueryKey(), refetchType: "all" });
      const next = await refetch();
      if (next.data) setForm(formFromSettings(next.data.company));
      setMessage("Company details saved. They appear on Contact, the footer and Organization markup immediately.");
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
          </label>
        </section>
      </form>
    </>
  );
}
