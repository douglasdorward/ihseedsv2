import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  getGetAdminSiteSettingsQueryKey,
  useGetAdminSiteSettings,
  useListAdminProducts,
  useUpdateSiteSettings,
  type SiteAboutSettings,
  type SiteSettings,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Icon } from "./ui";
import { uploadMediaAsset } from "../upload-image";
import { navigate } from "../router";
import {
  ABOUT_VALUE_ICONS,
  aboutHeroDisplaySrc,
  aboutStorySlots,
  expandProductCount,
  guideCardDisplaySrc,
} from "../site-settings";
import "../homepage-editor.css";

const GUIDE_OVERLAY = "linear-gradient(90deg, rgba(29,40,28,.92), rgba(29,40,28,.44))";

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

export function AboutPageEditor({
  about,
  seedGuide,
  productCount,
  onChange,
}: {
  about: SiteAboutSettings;
  seedGuide: SiteSettings["seedGuide"];
  productCount: number;
  onChange: (about: SiteAboutSettings) => void;
}) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const heroSrc = aboutHeroDisplaySrc({ src: about.heroImageSrc, assetId: about.heroImageAssetId }, true);
  const guideSrc = guideCardDisplaySrc({ src: seedGuide.cardImageSrc, assetId: seedGuide.cardImageAssetId }, true);
  const storySlots = aboutStorySlots(about.storyParagraphs);

  const setField = <K extends keyof SiteAboutSettings>(key: K, value: SiteAboutSettings[K]) => {
    onChange({ ...about, [key]: value });
  };

  const setStory = (index: number, value: string) => {
    const next = aboutStorySlots(about.storyParagraphs);
    next[index] = value;
    setField("storyParagraphs", next);
  };

  const setValue = (index: number, key: "title" | "body", value: string) => {
    const values = about.values.map((item, itemIndex) => (
      itemIndex === index ? { ...item, [key]: value } : item
    ));
    setField("values", values);
  };

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const uploaded = await uploadMediaAsset(file, { ownerName: about.heroHeading || "About IH Seeds" });
      onChange({ ...about, heroImageSrc: uploaded.src, heroImageAssetId: uploaded.assetId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="hpe-page ape-page">
      <section className="ape-hero">
        <div className="ape-hero-grid">
          <div className="ape-hero-copy">
            <textarea
              className={`ppe-ghost ape-eyebrow ${about.heroEyebrow.trim() ? "" : "is-empty"}`}
              rows={1}
              value={about.heroEyebrow}
              placeholder="About IH Seeds"
              aria-label="Hero eyebrow"
              onChange={(event) => setField("heroEyebrow", event.target.value)}
            />
            <h1>
              <textarea
                className={`ppe-ghost ape-heading ${about.heroHeading.trim() ? "" : "is-empty"}`}
                rows={1}
                value={about.heroHeading}
                placeholder="Proudly Western Australian,"
                aria-label="Hero heading"
                onChange={(event) => setField("heroHeading", event.target.value)}
              />
              <textarea
                className={`ppe-ghost ape-heading-emphasis ${about.heroHeadingEmphasis.trim() ? "" : "is-empty"}`}
                rows={1}
                value={about.heroHeadingEmphasis}
                placeholder="since 1966"
                aria-label="Hero heading emphasis"
                onChange={(event) => setField("heroHeadingEmphasis", event.target.value)}
              />
            </h1>
            <textarea
              className={`ppe-ghost ape-intro ${about.heroIntro.trim() ? "" : "is-empty"}`}
              rows={3}
              value={about.heroIntro}
              placeholder="Hero introduction"
              aria-label="Hero introduction"
              onChange={(event) => setField("heroIntro", event.target.value)}
            />
          </div>
          <div className="ape-hero-image" style={{ backgroundImage: `url(${heroSrc})` }}>
            <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => void handleUpload(event)} />
            <button type="button" className="ppe-hero-upload-button" onClick={() => imageInputRef.current?.click()} disabled={busy}>
              {busy ? "Uploading…" : "Change photo"}
            </button>
            {error && <span className="ppe-hero-upload-error">{error}</span>}
          </div>
        </div>
      </section>

      <section className="ape-story">
        <div className="ape-story-inner">
          <textarea
            className={`ppe-ghost ape-story-lead ${about.storyLead.trim() ? "" : "is-empty"}`}
            rows={4}
            value={about.storyLead}
            placeholder="Opening story paragraph"
            aria-label="Story lead"
            onChange={(event) => setField("storyLead", event.target.value)}
          />
          {storySlots.map((paragraph, index) => (
            <textarea
              key={`about-story-${index}`}
              className={`ppe-ghost ape-story-body ${paragraph.trim() ? "" : "is-empty"}`}
              rows={5}
              value={paragraph}
              placeholder="Story paragraph"
              aria-label={`Story paragraph ${index + 1}`}
              onChange={(event) => setStory(index, event.target.value)}
            />
          ))}
          <p className="hpe-readonly-note">
            Preview: {expandProductCount(storySlots.join(" "), productCount) || "Add story copy."} Use {"{productCount}"} to insert the live variety count.
          </p>
        </div>
      </section>

      <section className="ape-values">
        <div className="ape-values-inner">
          <h2>
            <textarea
              className={`ppe-ghost ape-values-heading ${about.valuesHeading.trim() ? "" : "is-empty"}`}
              rows={1}
              value={about.valuesHeading}
              placeholder="What we"
              aria-label="Values heading"
              onChange={(event) => setField("valuesHeading", event.target.value)}
            />
            <textarea
              className={`ppe-ghost ape-values-heading-emphasis ${about.valuesHeadingEmphasis.trim() ? "" : "is-empty"}`}
              rows={1}
              value={about.valuesHeadingEmphasis}
              placeholder="stand for"
              aria-label="Values heading emphasis"
              onChange={(event) => setField("valuesHeadingEmphasis", event.target.value)}
            />
          </h2>
          <div className="ape-value-grid">
            {about.values.map((value, index) => (
              <div className="ape-value-card" key={`about-value-${index}`}>
                <span className="ape-value-icon"><Icon name={ABOUT_VALUE_ICONS[index] ?? "sprout"} size={28} /></span>
                <textarea
                  className={`ppe-ghost ape-value-title ${value.title.trim() ? "" : "is-empty"}`}
                  rows={2}
                  value={value.title}
                  placeholder="Value title"
                  aria-label={`Value ${index + 1} title`}
                  onChange={(event) => setValue(index, "title", event.target.value)}
                />
                <textarea
                  className={`ppe-ghost ape-value-body ${value.body.trim() ? "" : "is-empty"}`}
                  rows={4}
                  value={value.body}
                  placeholder="Value description"
                  aria-label={`Value ${index + 1} description`}
                  onChange={(event) => setValue(index, "body", event.target.value)}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="ape-guide">
        <p className="hpe-readonly-note">Seed guide card copy, photo and PDF are edited in the Seed guide editor.</p>
        <div className="guide-banner" style={{ backgroundImage: `${GUIDE_OVERLAY}, url(${guideSrc})` }}>
          <div>
            <h2>{seedGuide.cardHeading}</h2>
            <span className="button button-light">{seedGuide.cardButtonLabel}</span>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function AdminAboutPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, error: loadError, refetch } = useGetAdminSiteSettings();
  const { data: products = [] } = useListAdminProducts();
  const updateSettings = useUpdateSiteSettings();
  const [about, setAbout] = useState<SiteAboutSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showUnsaved, setShowUnsaved] = useState(false);
  const savedJson = useMemo(() => data ? JSON.stringify(data.about) : "", [data]);
  const dirty = Boolean(about && JSON.stringify(about) !== savedJson);

  useEffect(() => {
    if (data && !about) setAbout(data.about);
  }, [data, about]);

  const handleBack = () => {
    if (dirty) {
      setShowUnsaved(true);
      return;
    }
    navigate("/admin/site-settings");
  };

  const save = async (leave = false) => {
    if (!about || !data) return;
    setSaving(true);
    setError("");
    try {
      await updateSettings.mutateAsync({
        data: {
          homepage: data.homepage,
          seedGuide: seedGuideInput(data.seedGuide),
          about,
        },
      });
      await queryClient.invalidateQueries({ queryKey: getGetAdminSiteSettingsQueryKey(), refetchType: "all" });
      const next = await refetch();
      if (next.data) setAbout(next.data.about);
      if (leave) navigate("/admin/site-settings");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not save About us settings.");
    } finally {
      setSaving(false);
      setShowUnsaved(false);
    }
  };

  if (isLoading || !about || !data) {
    return <div className="admin-content"><div className="admin-empty">Loading About us…</div></div>;
  }
  if (loadError) {
    return (
      <div className="admin-content">
        <div className="admin-empty">
          <strong>About us settings could not be loaded.</strong>
          <button type="button" className="admin-button primary" onClick={() => refetch()}>Try again</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <header className="admin-page-header admin-editor-header hpe-save-bar">
        <button className="admin-back-link" type="button" onClick={handleBack} disabled={saving}>
          <Icon name="arrow-left" size={16} /> Site settings
        </button>
        <div className="admin-header-actions">
          <button className="admin-button primary" type="button" onClick={() => void save()} disabled={saving || !dirty}>
            {saving ? "Saving…" : "Save About us"}
          </button>
        </div>
      </header>
      <div className="admin-editor-title">
        <h1>Edit About us</h1>
        <div className="admin-editor-version">Saved changes appear on the public About us page immediately. The hero photo also appears on the home page About Us panel.</div>
      </div>
      {error && <div className="admin-notice admin-notice-error" role="alert"><p>{error}</p></div>}
      <AboutPageEditor about={about} seedGuide={data.seedGuide} productCount={products.length} onChange={setAbout} />
      {showUnsaved && (
        <div className="admin-dialog-backdrop" role="presentation" onMouseDown={() => setShowUnsaved(false)}>
          <section className="admin-dialog" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <h2>Unsaved changes</h2>
            <p>You have changed the About us page. Save before returning to Site settings?</p>
            <div className="admin-dialog-actions">
              <button className="admin-button primary" type="button" onClick={() => void save(true)} disabled={saving}>Save &amp; leave</button>
              <button className="admin-button outline admin-button-danger" type="button" onClick={() => navigate("/admin/site-settings")} disabled={saving}>Leave without saving</button>
              <button className="admin-button ghost" type="button" onClick={() => setShowUnsaved(false)} disabled={saving}>Keep editing</button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
