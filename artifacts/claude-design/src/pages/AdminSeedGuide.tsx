import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import {
  getGetAdminSiteSettingsQueryKey,
  useGetAdminSiteSettings,
  useUpdateSiteSettings,
  useUploadSeedGuidePdf,
  type SiteSettings,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Icon } from "../components/ui";
import { navigate } from "../router";
import { uploadMediaAsset } from "../upload-image";
import { guideCardDisplaySrc } from "../site-settings";
import "../homepage-editor.css";

const GUIDE_OVERLAY = "linear-gradient(90deg, rgba(29,40,28,.92), rgba(29,40,28,.44))";

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

type SeedGuideForm = {
  navTitle: string;
  cardHeading: string;
  cardButtonLabel: string;
  cardImageSrc: string;
  cardImageAssetId: string | null;
  pageTitle: string;
  pageIntro: string;
  pageButtonLabel: string;
};

function formFromSettings(settings: SiteSettings["seedGuide"]): SeedGuideForm {
  return {
    navTitle: settings.navTitle,
    cardHeading: settings.cardHeading,
    cardButtonLabel: settings.cardButtonLabel,
    cardImageSrc: settings.cardImageSrc,
    cardImageAssetId: settings.cardImageAssetId,
    pageTitle: settings.pageTitle,
    pageIntro: settings.pageIntro,
    pageButtonLabel: settings.pageButtonLabel,
  };
}

export default function AdminSeedGuide() {
  const queryClient = useQueryClient();
  const { data, isLoading, error: loadError, refetch } = useGetAdminSiteSettings();
  const updateSettings = useUpdateSiteSettings();
  const uploadPdf = useUploadSeedGuidePdf();
  const [form, setForm] = useState<SeedGuideForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const pdfInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const savedJson = useMemo(() => data ? JSON.stringify(formFromSettings(data.seedGuide)) : "", [data]);
  const dirty = Boolean(form && JSON.stringify(form) !== savedJson);

  useEffect(() => {
    if (data && !form) setForm(formFromSettings(data.seedGuide));
  }, [data, form]);

  const setField = <K extends keyof SeedGuideForm>(key: K, value: SeedGuideForm[K]) => {
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
          seedGuide: form,
        },
      });
      await queryClient.invalidateQueries({ queryKey: getGetAdminSiteSettingsQueryKey(), refetchType: "all" });
      const next = await refetch();
      if (next.data) setForm(formFromSettings(next.data.seedGuide));
      setMessage("Seed guide settings saved. They appear on the public website immediately.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not save seed guide settings.");
    } finally {
      setSaving(false);
    }
  };

  const handlePdf = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploadingPdf(true);
    setError("");
    setMessage("");
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Could not read that PDF."));
        reader.readAsDataURL(file);
      });
      const saved = await uploadPdf.mutateAsync({ data: { filename: file.name, data: dataUrl } });
      await queryClient.invalidateQueries({ queryKey: getGetAdminSiteSettingsQueryKey(), refetchType: "all" });
      await refetch();
      setMessage(`Uploaded ${saved.seedGuide.pdfFilename || file.name}.`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload a PDF up to 15 MB.");
    } finally {
      setUploadingPdf(false);
    }
  };

  const handleImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploadingImage(true);
    setError("");
    try {
      const uploaded = await uploadMediaAsset(file, { ownerName: form?.pageTitle || "Pasture Seed Guide" });
      setField("cardImageSrc", uploaded.src);
      setField("cardImageAssetId", uploaded.assetId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not upload that image.");
    } finally {
      setUploadingImage(false);
    }
  };

  if (isLoading || !form || !data) {
    return <div className="admin-content"><div className="admin-empty">Loading seed guide…</div></div>;
  }
  if (loadError) {
    return (
      <div className="admin-content">
        <div className="admin-empty">
          <strong>Seed guide settings could not be loaded.</strong>
          <button type="button" className="admin-button primary" onClick={() => refetch()}>Try again</button>
        </div>
      </div>
    );
  }

  const previewSrc = guideCardDisplaySrc({ src: form.cardImageSrc, assetId: form.cardImageAssetId }, true);

  return (
    <>
      <PageHeader
        eyebrow="Site settings"
        title={<>Seed <strong>guide</strong></>}
        onBack={() => navigate("/admin/site-settings")}
        action={
          <button className="admin-button primary" type="button" onClick={() => void save()} disabled={saving || !dirty}>
            {saving ? "Saving…" : "Save seed guide"}
          </button>
        }
      />
      <form className="admin-content admin-seed-guide" onSubmit={(event) => { event.preventDefault(); void save(); }}>
        {error && <div className="admin-notice admin-notice-error" role="alert"><p>{error}</p></div>}
        {message && <div className="admin-notice"><p>{message}</p></div>}

        <section className="admin-panel admin-form-card">
          <div className="admin-section-heading">
            <div>
              <h3>Menu title</h3>
              <p>Shown in the public website header as the Seed Guide link.</p>
            </div>
          </div>
          <label>
            Header link
            <input value={form.navTitle} onChange={(event) => setField("navTitle", event.target.value)} maxLength={80} />
          </label>
        </section>

        <section className="admin-panel admin-form-card">
          <div className="admin-section-heading">
            <div>
              <h3>Homepage card</h3>
              <p>This card appears on the home page, About and Resources. The preview below updates as you type.</p>
            </div>
          </div>
          <label>
            Card heading
            <textarea value={form.cardHeading} onChange={(event) => setField("cardHeading", event.target.value)} rows={3} maxLength={240} />
          </label>
          <label>
            Download button label
            <input value={form.cardButtonLabel} onChange={(event) => setField("cardButtonLabel", event.target.value)} maxLength={120} />
          </label>
          <div>
            <div className="admin-section-heading">
              <div>
                <h3>Background image</h3>
                <p>Used on the homepage card and the /guide cover.</p>
              </div>
            </div>
            <input ref={imageInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={handleImage} />
            <button type="button" className="admin-button outline" onClick={() => imageInput.current?.click()} disabled={uploadingImage}>
              {uploadingImage ? "Uploading…" : "Upload background image"}
            </button>
          </div>
          <div className="admin-seed-guide-preview">
            <p>Homepage card preview</p>
            <div className="guide-banner" style={{ backgroundImage: `${GUIDE_OVERLAY}, url(${previewSrc})` }}>
              <div>
                <h2>{form.cardHeading || "Card heading"}</h2>
                <span className="button button-light">{form.cardButtonLabel || "Download"}</span>
              </div>
            </div>
          </div>
        </section>

        <section className="admin-panel admin-form-card">
          <div className="admin-section-heading">
            <div>
              <h3>Guide page</h3>
              <p>Copy for /guide. The download button on that page uses the label below.</p>
            </div>
          </div>
          <label>
            Page title
            <input value={form.pageTitle} onChange={(event) => setField("pageTitle", event.target.value)} maxLength={180} />
          </label>
          <label>
            Introduction
            <textarea value={form.pageIntro} onChange={(event) => setField("pageIntro", event.target.value)} rows={4} maxLength={2000} />
          </label>
          <label>
            Page button label
            <input value={form.pageButtonLabel} onChange={(event) => setField("pageButtonLabel", event.target.value)} maxLength={120} />
          </label>
        </section>

        <section className="admin-panel admin-form-card">
          <div className="admin-section-heading">
            <div>
              <h3>Seed guide PDF</h3>
              <p>{data.seedGuide.pdfFilename ? `Current file: ${data.seedGuide.pdfFilename}` : "No PDF uploaded yet. The existing 2026 guide remains available until you upload a replacement."}</p>
            </div>
          </div>
          <input ref={pdfInput} type="file" accept="application/pdf" hidden onChange={handlePdf} />
          <div className="admin-seed-guide-actions">
            <button type="button" className="admin-button outline" onClick={() => pdfInput.current?.click()} disabled={uploadingPdf}>
              {uploadingPdf ? "Uploading…" : data.seedGuide.pdfFilename ? "Replace PDF" : "Upload PDF"}
            </button>
            {data.seedGuide.pdfPublicUrl && (
              <a className="admin-button ghost" href={data.seedGuide.pdfPublicUrl} target="_blank" rel="noreferrer">Download current PDF</a>
            )}
          </div>
        </section>
      </form>
    </>
  );
}
