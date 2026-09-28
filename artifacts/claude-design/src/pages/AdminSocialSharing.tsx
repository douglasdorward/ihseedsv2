import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import {
  getGetAdminSiteSettingsQueryKey,
  getGetPublicSiteSettingsQueryKey,
  useGetAdminSiteSettings,
  useUpdateSiteSettings,
  type SiteSettings,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Icon } from "../components/ui";
import { navigate } from "../router";
import { photoDisplaySrc, uploadMediaAsset } from "../upload-image";
import { APPLE_TOUCH_ICON, siteSocialPreviewSrc, siteSocialState, socialDimensionWarning } from "../social-share";
import "../homepage-editor.css";
import "../admin-blog.css";

type SocialForm = { socialImageSrc: string; socialImageAssetId: string | null };
type LibraryAsset = { id: string; originalFilename: string; defaultAlt: string; width?: number | null; height?: number | null };

function formFrom(settings: SiteSettings): SocialForm {
  const homepage = settings.homepage as SiteSettings["homepage"] & Partial<SocialForm>;
  return { socialImageSrc: homepage.socialImageSrc ?? "", socialImageAssetId: homepage.socialImageAssetId ?? null };
}

function PageHeader({ title, action }: { title: ReactNode; action: ReactNode }) {
  return (
    <header className="admin-page-header" style={{ flexDirection: "column", alignItems: "stretch", gap: 16 }}>
      <button type="button" className="admin-back-link" onClick={() => navigate("/admin/site-settings")}>
        <Icon name="chevron-left" size={14} /> Back
      </button>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", gap: 12, flexWrap: "wrap" }}>
        <div><p>Site settings</p><h1>{title}</h1></div>
        {action}
      </div>
    </header>
  );
}

function LibraryPicker({ open, onClose, onSelect }: { open: boolean; onClose: () => void; onSelect: (asset: LibraryAsset) => void }) {
  const [items, setItems] = useState<LibraryAsset[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ limit: "40" });
    if (query.trim()) params.set("query", query.trim());
    fetch(`/api/admin/media?${params}`)
      .then(async (response) => {
        const body = await response.json().catch(() => null);
        if (!response.ok) throw new Error(body?.error ?? "Could not load the image library.");
        setItems((body?.items ?? []) as LibraryAsset[]);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load the image library."))
      .finally(() => setLoading(false));
  }, [open, query]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="admin-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="admin-dialog admin-blog-picker" role="dialog" aria-modal="true" aria-labelledby="social-picker-title" onMouseDown={(event) => event.stopPropagation()}>
        <h2 id="social-picker-title">Choose from Images library</h2>
        <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search filenames" aria-label="Search images" />
        {error && <p className="admin-inline-field-error" role="alert">{error}</p>}
        {loading ? <p className="admin-field-hint">Loading images…</p> : null}
        <div className="admin-blog-picker-grid">
          {items.map((item) => (
            <button type="button" key={item.id} className="admin-blog-picker-item" onClick={() => onSelect(item)}>
              <img src={photoDisplaySrc({ assetId: item.id })} alt={item.defaultAlt || item.originalFilename} />
              <span>{item.originalFilename}</span>
            </button>
          ))}
          {!loading && !error && items.length === 0 && <p className="admin-empty">No library images match.</p>}
        </div>
        <div className="admin-dialog-actions">
          <button className="admin-button ghost" type="button" onClick={onClose}>Cancel</button>
        </div>
      </section>
    </div>
  );
}

export default function AdminSocialSharing() {
  const queryClient = useQueryClient();
  const { data, isLoading, error: loadError, refetch } = useGetAdminSiteSettings();
  const updateSettings = useUpdateSiteSettings();
  const [form, setForm] = useState<SocialForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [warning, setWarning] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const savedJson = useMemo(() => (data ? JSON.stringify(formFrom(data)) : ""), [data]);
  const dirty = Boolean(form && JSON.stringify(form) !== savedJson);

  useEffect(() => {
    if (data && !form) setForm(formFrom(data));
  }, [data, form]);

  const choose = (next: SocialForm, dims?: { width?: number | null; height?: number | null }) => {
    setForm(next);
    setMessage("");
    setError("");
    setWarning(socialDimensionWarning(dims?.width ?? undefined, dims?.height ?? undefined));
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const uploaded = await uploadMediaAsset(file, { ownerName: "Social sharing image", role: "social" });
      choose({ socialImageSrc: uploaded.src, socialImageAssetId: uploaded.assetId }, uploaded);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not upload that image.");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!form || !data) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      // Re-read the latest settings so homepage/seed guide edits made elsewhere
      // since this page loaded are never overwritten by a stale cache.
      const latest = (await refetch({ throwOnError: true })).data;
      if (!latest) throw new Error("Could not reload the latest site settings. Nothing was saved.");
      await updateSettings.mutateAsync({
        data: {
          homepage: { ...latest.homepage, socialImageSrc: form.socialImageSrc.trim(), socialImageAssetId: form.socialImageAssetId } as SiteSettings["homepage"],
          seedGuide: latest.seedGuide,
        },
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetAdminSiteSettingsQueryKey(), refetchType: "all" }),
        queryClient.invalidateQueries({ queryKey: getGetPublicSiteSettingsQueryKey() }),
      ]);
      const next = await refetch();
      if (next.data) setForm(formFrom(next.data));
      setWarning("");
      setMessage("Social sharing image saved. New shares use it straight away; sites that cached an older preview may take a while to refresh.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not save the social sharing image.");
    } finally {
      setSaving(false);
    }
  };

  if (loadError) {
    return (
      <div className="admin-content">
        <div className="admin-empty">
          <strong>Social sharing settings could not be loaded.</strong>
          <button type="button" className="admin-button primary" onClick={() => refetch()}>Try again</button>
        </div>
      </div>
    );
  }
  if (isLoading || !form || !data) {
    return <div className="admin-content"><div className="admin-empty" aria-busy="true">Loading social sharing…</div></div>;
  }

  const state = siteSocialState(form.socialImageSrc, form.socialImageAssetId);
  const previewSrc = siteSocialPreviewSrc(form.socialImageSrc, form.socialImageAssetId);

  return (
    <>
      <PageHeader
        title={<>Social <strong>sharing</strong></>}
        action={
          <div className="admin-social-actions">
            {dirty && (
              <button className="admin-button ghost" type="button" disabled={saving} onClick={() => { setForm(formFrom(data)); setWarning(""); setError(""); }}>
                Discard changes
              </button>
            )}
            <button className="admin-button primary" type="button" onClick={() => void save()} disabled={saving || uploading || !dirty}>
              {saving ? "Saving…" : "Save social sharing"}
            </button>
          </div>
        }
      />
      <form className="admin-content" onSubmit={(event) => { event.preventDefault(); void save(); }}>
        {error && <div className="admin-notice admin-notice-error" role="alert"><p>{error}</p></div>}
        {message && <div className="admin-notice" role="status"><p>{message}</p></div>}

        <section className="admin-panel admin-form-card">
          <div className="admin-section-heading">
            <div>
              <h3>Site-wide sharing image</h3>
              <p>Shown when a page is shared on Facebook, LinkedIn, WhatsApp or in a text message and that page has no image of its own. Products use their first photo and articles their hero image before falling back to this.</p>
            </div>
          </div>
          <div className="admin-social-card" aria-label="Share preview">
            <div className="admin-social-card-image" role="img" aria-label="Current sharing image" style={{ backgroundImage: `url(${previewSrc})` }} />
            <div className="admin-social-card-body">
              <small>ihseeds.com.au</small>
              <strong>IH Seeds — pasture seed from Western Australia</strong>
            </div>
          </div>
          <p className="admin-field-hint" data-testid="social-site-state">
            {state === "asset" && "Using an image from the Images library."}
            {state === "url" && `Using image URL ${form.socialImageSrc}.`}
            {state === "default" && "Using the IH Seeds default sharing image."}
            {" "}Best size: 1200 × 630 px (landscape, about 1.91:1). Keep key detail away from the edges.
          </p>
          {warning && <p className="admin-social-warning" role="status">{warning}</p>}
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={handleFile} />
          <div className="admin-social-actions">
            <button type="button" className="admin-button outline" onClick={() => fileRef.current?.click()} disabled={uploading || saving}>
              {uploading ? "Uploading…" : state === "default" ? "Upload image" : "Replace with upload"}
            </button>
            <button type="button" className="admin-button outline" onClick={() => setPickerOpen(true)} disabled={uploading || saving}>
              Choose from library
            </button>
            {state !== "default" && (
              <button type="button" className="admin-button ghost" onClick={() => choose({ socialImageSrc: "", socialImageAssetId: null })} disabled={uploading || saving}>
                Reset to default
              </button>
            )}
          </div>
          {dirty && <p className="admin-field-hint">Unsaved change. Save to publish it.</p>}
        </section>

        <section className="admin-panel admin-form-card">
          <div className="admin-section-heading">
            <div>
              <h3>Home screen and browser icon</h3>
              <p>This icon is fixed and served from {APPLE_TOUCH_ICON}. It appears when someone saves the site to a phone home screen and in some share sheets. Ask your developer to change it.</p>
            </div>
          </div>
          <div className="admin-social-icon-row">
            <img src={APPLE_TOUCH_ICON} alt="IH Seeds app icon" width={72} height={72} />
            <span className="admin-field-hint">180 × 180 px PNG</span>
          </div>
        </section>
      </form>
      <LibraryPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(asset) => {
          setPickerOpen(false);
          choose({ socialImageSrc: `/api/media/${asset.id}`, socialImageAssetId: asset.id }, asset);
        }}
      />
    </>
  );
}
