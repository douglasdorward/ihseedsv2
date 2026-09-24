import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  getGetAdminSiteSettingsQueryKey,
  useGetAdminSiteSettings,
  useListAdminProducts,
  useUpdateSiteSettings,
  type AdminProduct,
  type SiteAboutSettings,
  type SiteHomepageSettings,
  type SiteSettings,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Icon, StatusPill } from "./ui";
import { ProductNewStamp } from "./NewStamp";
import { photoDisplaySrc, uploadMediaAsset } from "../upload-image";
import { isAlsoPopularEligible } from "../also-popular";
import { navigate } from "../router";
import {
  BEST_SELLER_LIMIT,
  HERO_IMAGE_LIMIT,
  aboutHeroDisplaySrc,
  expandProductCount,
  heroDisplaySrc,
  homepageHeroImages,
  guideCardDisplaySrc,
  resolveBestSellers,
  withHomepageHeroImages,
} from "../site-settings";
import "../homepage-editor.css";

const PRODUCT_FALLBACK = "/ih-seeds-logo.png";
const HERO_OVERLAY = "linear-gradient(90deg, rgba(29,40,28,.98) 0%, rgba(29,40,28,.84) 47%, rgba(29,40,28,.42) 100%)";
const GUIDE_OVERLAY = "linear-gradient(90deg, rgba(29,40,28,.92), rgba(29,40,28,.44))";
const ABOUT_OVERLAY = "linear-gradient(90deg, rgba(12,88,60,.12), rgba(12,88,60,.02))";

function productCardImage(product: AdminProduct | undefined) {
  if (!product) return PRODUCT_FALLBACK;
  const photo = product.details?.photos?.find((item) => item.src?.trim() || item.assetId);
  return photoDisplaySrc(photo) || PRODUCT_FALLBACK;
}

function groupedOptions(products: AdminProduct[]) {
  const groups = new Map<string, AdminProduct[]>();
  for (const product of products) {
    const key = product.category || "Other";
    const list = groups.get(key) ?? [];
    list.push(product);
    groups.set(key, list);
  }
  return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right));
}

export function HomePageEditor({
  homepage,
  about,
  seedGuide,
  products,
  onChange,
}: {
  homepage: SiteHomepageSettings;
  about: SiteAboutSettings;
  seedGuide: SiteSettings["seedGuide"];
  products: AdminProduct[];
  onChange: (homepage: SiteHomepageSettings) => void;
}) {
  const eligible = products.filter(isAlsoPopularEligible);
  const chosen = homepage.bestSellerSlugs;
  const previewCards = resolveBestSellers(chosen, eligible);
  const productCount = eligible.length;
  const heroImages = homepageHeroImages(homepage);
  const [selectedHero, setSelectedHero] = useState(0);
  const selectedIndex = Math.min(selectedHero, Math.max(heroImages.length - 1, 0));
  const selectedImage = heroImages[selectedIndex] ?? heroImages[0];
  const heroSrc = heroDisplaySrc(selectedImage ?? { src: homepage.heroImageSrc, assetId: homepage.heroImageAssetId }, true);
  const aboutSrc = aboutHeroDisplaySrc({ src: about.heroImageSrc, assetId: about.heroImageAssetId }, true);
  const guideSrc = guideCardDisplaySrc({ src: seedGuide.cardImageSrc, assetId: seedGuide.cardImageAssetId }, true);
  const addInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setSelectedHero((current) => Math.min(current, Math.max(heroImages.length - 1, 0)));
  }, [heroImages.length]);

  const setSlot = (index: number, slug: string) => {
    const next = [...chosen];
    while (next.length < BEST_SELLER_LIMIT) next.push("");
    next[index] = slug;
    onChange({
      ...homepage,
      bestSellerSlugs: next.map((item) => item.trim()).filter(Boolean).slice(0, BEST_SELLER_LIMIT),
    });
  };

  const uploadHeroFiles = async (files: File[], mode: "add" | "replace") => {
    if (!files.length) return;
    setBusy(true);
    setError("");
    try {
      const uploaded = [];
      for (const file of files) {
        uploaded.push(await uploadMediaAsset(file, { ownerName: homepage.heroHeading || "IH Seeds" }));
      }
      const nextImages = [...heroImages];
      if (mode === "replace" && uploaded[0]) {
        nextImages[selectedIndex] = { src: uploaded[0].src, assetId: uploaded[0].assetId };
        const extras = uploaded.slice(1).map((item) => ({ src: item.src, assetId: item.assetId }));
        nextImages.splice(selectedIndex + 1, 0, ...extras);
      } else {
        nextImages.push(...uploaded.map((item) => ({ src: item.src, assetId: item.assetId })));
      }
      const limited = nextImages.slice(0, HERO_IMAGE_LIMIT);
      onChange(withHomepageHeroImages(homepage, limited));
      if (mode === "add") setSelectedHero(Math.min(heroImages.length, HERO_IMAGE_LIMIT - 1));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const handleUpload = (mode: "add" | "replace") => async (event: ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files ?? [])];
    event.target.value = "";
    await uploadHeroFiles(files, mode);
  };

  const moveHero = (from: number, to: number) => {
    if (to < 0 || to >= heroImages.length) return;
    const next = [...heroImages];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(withHomepageHeroImages(homepage, next));
    setSelectedHero(to);
  };

  const removeHero = (index: number) => {
    if (heroImages.length < 2) return;
    onChange(withHomepageHeroImages(homepage, heroImages.filter((_, itemIndex) => itemIndex !== index)));
    setSelectedHero(Math.max(0, index - 1));
  };

  return (
    <div className="hpe-page">
      <section className="hero-wrap">
        <div className="hero" style={{ backgroundImage: `${HERO_OVERLAY}, url(${heroSrc})` }}>
          <div className="hero-copy">
            <h1>
              <textarea
                className={`ppe-ghost hpe-eyebrow ${homepage.heroEyebrow.trim() ? "" : "is-empty"}`}
                rows={1}
                value={homepage.heroEyebrow}
                placeholder="Western Australia's"
                aria-label="Hero eyebrow"
                onChange={(event) => onChange({ ...homepage, heroEyebrow: event.target.value })}
              />
              <textarea
                className={`ppe-ghost hpe-heading ${homepage.heroHeading.trim() ? "" : "is-empty"}`}
                rows={1}
                value={homepage.heroHeading}
                placeholder="Pasture Seed Specialists"
                aria-label="Hero heading"
                onChange={(event) => onChange({ ...homepage, heroHeading: event.target.value })}
              />
            </h1>
            <textarea
              className={`ppe-ghost ${homepage.heroBody.trim() ? "" : "is-empty"}`}
              rows={3}
              value={homepage.heroBody}
              placeholder="Hero introduction"
              aria-label="Hero introduction"
              onChange={(event) => onChange({ ...homepage, heroBody: event.target.value })}
            />
            <p className="hpe-readonly-note" style={{ color: "rgba(255,255,255,.72)", fontSize: 12 }}>
              Preview: {expandProductCount(homepage.heroBody, productCount) || "Add introduction copy."} Use {"{productCount}"} to insert the live variety count.
            </p>
            <div className="hero-actions">
              <span className="button button-primary">Advice</span>
              <span className="button button-light">Browse the catalogue</span>
            </div>
          </div>
          <div className="ppe-hero-upload hpe-hero-photos">
            <input ref={addInputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden multiple onChange={handleUpload("add")} />
            <input ref={replaceInputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={handleUpload("replace")} />
            <div className="hpe-hero-thumbs" role="listbox" aria-label="Hero photos">
              {heroImages.map((image, index) => (
                <button
                  type="button"
                  key={`${image.assetId || image.src}-${index}`}
                  className={`hpe-hero-thumb ${index === selectedIndex ? "is-selected" : ""}`}
                  role="option"
                  aria-selected={index === selectedIndex}
                  aria-label={`Hero photo ${index + 1}`}
                  onClick={() => setSelectedHero(index)}
                  style={{ backgroundImage: `url(${heroDisplaySrc(image, true)})` }}
                />
              ))}
            </div>
            <div className="hpe-hero-photo-actions">
              <button
                type="button"
                className="ppe-hero-upload-button"
                onClick={() => addInputRef.current?.click()}
                disabled={busy || heroImages.length >= HERO_IMAGE_LIMIT}
              >
                {busy ? "Uploading…" : heroImages.length >= HERO_IMAGE_LIMIT ? "Photo limit reached" : "Add photo"}
              </button>
              <button type="button" className="ppe-hero-upload-button hpe-hero-secondary" onClick={() => replaceInputRef.current?.click()} disabled={busy}>
                Change photo
              </button>
            </div>
            <div className="hpe-hero-photo-tools">
              <div className="hpe-hero-move" role="group" aria-label="Reorder selected photo">
                <button type="button" aria-label="Move left" onClick={() => moveHero(selectedIndex, selectedIndex - 1)} disabled={busy || selectedIndex === 0}>
                  <Icon name="chevron-left" size={16} />
                </button>
                <button type="button" aria-label="Move right" onClick={() => moveHero(selectedIndex, selectedIndex + 1)} disabled={busy || selectedIndex >= heroImages.length - 1}>
                  <Icon name="chevron-right" size={16} />
                </button>
              </div>
              <button type="button" className="hpe-hero-text-button" onClick={() => removeHero(selectedIndex)} disabled={busy || heroImages.length < 2}>
                Remove
              </button>
              <label className={`hpe-hero-slideshow ${heroImages.length < 2 ? "is-disabled" : ""}`}>
                <input
                  type="checkbox"
                  checked={homepage.heroSlideshow && heroImages.length > 1}
                  disabled={heroImages.length < 2}
                  onChange={(event) => onChange(withHomepageHeroImages(homepage, heroImages, event.target.checked))}
                />
                Slideshow
              </label>
            </div>
            {error && <span className="ppe-hero-upload-error">{error}</span>}
          </div>
        </div>
      </section>

      <section className="pillars" aria-label="Why IH Seeds">
        <p className="hpe-readonly-note" style={{ maxWidth: 1180, margin: "16px auto 0", padding: "0 40px" }}>These three pillars are not editable here.</p>
        <div className="three-column">
          <div className="pillar"><Icon name="map-pin" size={27} /><h3>Regional expertise</h3><p>Local conditions, understood and applied. Our experience across Western Australia tells us which varieties and mixes deliver in your rainfall, your soil and your enterprise.</p></div>
          <div className="pillar"><Icon name="sprout" size={27} /><h3>Proven performance</h3><p>Pasture varieties and mixes proven over generations and across Australia. Seed from accredited growers, true to type and consistent with its description.</p></div>
          <div className="pillar"><Icon name="users" size={27} /><h3>Partnership</h3><p>Confidence before the order, support after it. We combine local experience with knowledge shared by farmers to give sound technical advice, through your local store or direct from our team.</p></div>
        </div>
      </section>

      <section id="products" className="section section-subtle">
        <div className="content-width">
          <div className="section-heading">
            <h2><span>Best</span> Sellers</h2>
            <span className="button button-outline">View all products</span>
          </div>
          <div className="product-grid">
            {Array.from({ length: BEST_SELLER_LIMIT }, (_, index) => {
              const slug = chosen[index] ?? "";
              const product = eligible.find((item) => item.slug === slug) ?? previewCards[index];
              const available = eligible.filter((item) => item.slug === slug || !chosen.includes(item.slug));
              return (
                <div className="hpe-best-seller" key={`best-seller-${index}`}>
                  <select
                    className="ppe-ghost hpe-best-seller-select"
                    value={slug}
                    aria-label={`Best seller ${index + 1}`}
                    onChange={(event) => setSlot(index, event.target.value)}
                  >
                    <option value="">Automatic (recent products)</option>
                    {groupedOptions(available).map(([category, items]) => (
                      <optgroup key={category} label={category}>
                        {items.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}
                      </optgroup>
                    ))}
                  </select>
                  {product ? (
                    <div className="product-card">
                      <div className="product-image" style={{ backgroundImage: `linear-gradient(180deg, transparent, rgba(29,40,28,.72)), url(${productCardImage(product)})` }}>
                        {!product.details?.photos?.some((photo) => photo.src?.trim() || photo.assetId) && <img className="product-fallback-logo" src="/ih-seeds-logo.png" alt="" />}
                        <StatusPill status={product.status} />
                        <ProductNewStamp listingState={product.listingState} />
                      </div>
                      <div className="product-details">
                        <h3>{product.name}</h3>
                        <p className="product-card-tagline">{product.details?.tagline}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="hpe-empty-card">
                      <strong>Empty slot</strong>
                      <span>The public site fills this from recently updated products until you choose one.</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="about" className="section about-section">
        <div className="feature-panel">
          <div className="feature-image" style={{ backgroundImage: `${ABOUT_OVERLAY}, url(${aboutSrc})` }} />
          <div className="feature-copy">
            <h2><span>About</span> Us</h2>
            <textarea
              className={`ppe-ghost ${(homepage.aboutBody ?? "").trim() ? "" : "is-empty"}`}
              rows={4}
              value={homepage.aboutBody ?? ""}
              placeholder="About Us introduction"
              aria-label="About Us introduction"
              onChange={(event) => onChange({ ...homepage, aboutBody: event.target.value })}
            />
            <span className="button button-outline" style={{ color: "#fff", borderColor: "#fff" }}>Learn more about IH Seeds</span>
          </div>
        </div>
        <p className="hpe-readonly-note">This photo is the About us hero. Change it in Site settings → About us.</p>
      </section>

      <section id="guide" className="section guide-section">
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

export default function AdminHomePage() {
  const queryClient = useQueryClient();
  const { data, isLoading, error: loadError, refetch } = useGetAdminSiteSettings();
  const { data: products = [] } = useListAdminProducts();
  const updateSettings = useUpdateSiteSettings();
  const [homepage, setHomepage] = useState<SiteHomepageSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showUnsaved, setShowUnsaved] = useState(false);
  const savedJson = useMemo(() => data ? JSON.stringify(data.homepage) : "", [data]);
  const dirty = Boolean(homepage && JSON.stringify(homepage) !== savedJson);

  useEffect(() => {
    if (data && !homepage) setHomepage(data.homepage);
  }, [data, homepage]);

  const handleBack = () => {
    if (dirty) {
      setShowUnsaved(true);
      return;
    }
    navigate("/admin/site-settings");
  };

  const save = async (leave = false) => {
    if (!homepage || !data) return;
    setSaving(true);
    setError("");
    try {
      await updateSettings.mutateAsync({
        data: {
          homepage,
          seedGuide: {
            navTitle: data.seedGuide.navTitle,
            cardHeading: data.seedGuide.cardHeading,
            cardButtonLabel: data.seedGuide.cardButtonLabel,
            cardImageSrc: data.seedGuide.cardImageSrc,
            cardImageAssetId: data.seedGuide.cardImageAssetId,
            pageTitle: data.seedGuide.pageTitle,
            pageIntro: data.seedGuide.pageIntro,
            pageButtonLabel: data.seedGuide.pageButtonLabel,
          },
        },
      });
      await queryClient.invalidateQueries({ queryKey: getGetAdminSiteSettingsQueryKey(), refetchType: "all" });
      const next = await refetch();
      if (next.data) setHomepage(next.data.homepage);
      if (leave) navigate("/admin/site-settings");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not save homepage settings.");
    } finally {
      setSaving(false);
      setShowUnsaved(false);
    }
  };

  if (isLoading || !homepage || !data) {
    return <div className="admin-content"><div className="admin-empty">Loading homepage…</div></div>;
  }
  if (loadError) {
    return (
      <div className="admin-content">
        <div className="admin-empty">
          <strong>Homepage settings could not be loaded.</strong>
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
            {saving ? "Saving…" : "Save homepage"}
          </button>
        </div>
      </header>
      <div className="admin-editor-title">
        <h1>Edit home page</h1>
        <div className="admin-editor-version">Saved changes appear on the public homepage immediately.</div>
      </div>
      {error && <div className="admin-notice admin-notice-error" role="alert"><p>{error}</p></div>}
      <HomePageEditor homepage={homepage} about={data.about} seedGuide={data.seedGuide} products={products} onChange={setHomepage} />
      {showUnsaved && (
        <div className="admin-dialog-backdrop" role="presentation" onMouseDown={() => setShowUnsaved(false)}>
          <section className="admin-dialog" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <h2>Unsaved changes</h2>
            <p>You have changed the homepage. Save before returning to Site settings?</p>
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
