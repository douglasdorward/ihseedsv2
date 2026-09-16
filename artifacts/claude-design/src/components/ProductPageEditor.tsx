import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import type { CatalogueCategory, ProductComponent, ProductFaq, ProductListingState, ProductPhoto, ProductSowingRate, SaleLine } from "@workspace/api-client-react";
import { Icon } from "./ui";
import { AlsoPopularPicker } from "./AlsoPopularPicker";
import { ProductNewStamp } from "./NewStamp";
import { intendedAlsoPopularSlugs, isAlsoPopularEligible, resolveAlsoPopular } from "../also-popular";
import { getEditorQuickFactSlots, type QuickFactSlotId } from "../product-quick-facts";
import { photoDisplaySrc, uploadMediaAsset } from "../upload-image";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80";
const PRODUCT_FAQ_LIMIT = 10;
const PRODUCT_FAQ_QUESTION_MAX = 180;
const PRODUCT_FAQ_ANSWER_MAX = 4000;
const RAINFALL_MIN_MM_OPTIONS = Array.from({ length: Math.floor((800 - 150) / 50) + 1 }, (_, i) => 150 + i * 50);
const SOIL_OPTIONS = [
  { code: "LS", label: "LS — light sand" },
  { code: "S", label: "S — sand" },
  { code: "L", label: "L — loam" },
  { code: "H", label: "H — heavy" },
];
const PERSISTENCY = ["", "Annual", "Biennial", "Perennial", "Hybrid perennial", "Short-term (1–2 years)"];
const TOLERANCES = ["Low pH", "Waterlogging", "Salinity", "Drought", "Frost"];
const END_USES = ["Grazing", "Hay", "Silage", "Cover crop", "Green manure", "Grain", "Stockfeed", "Permanent pasture", "Erosion control / stabilisation", "Break crop", "Biofumigant", "Turf"];
const LIVESTOCK = ["Beef", "Dairy", "Sheep", "Equine", "Goat", "Chicken", "Alpaca", "Weaners", "Lamb finishing"];
const SOWING_CONTEXTS = ["Monoculture", "In a mix", "Dryland", "Irrigation", "Pasture", "Turf", "General", "Podded", "De-hulled", "Coated"];
const OPTS = {
  ploidy: ["", "Diploid", "Tetraploid", "Hexaploid", "Mixed (blend)"],
  headingDate: ["", "Very early", "Early", "Mid", "Mid-late", "Late"],
  endophyte: ["", "Nil", "Low", "MaxP", "Standard"],
  growthSeason: ["", "Summer-active", "Winter-active / Mediterranean", "Year-round", "Warm-season"],
  hardSeedLevel: ["", "Soft", "Low", "Moderate", "High", "Very high"],
  oestrogenLevel: ["", "None", "Trace", "Low", "High"],
  bloatRisk: ["", "Low", "Moderate", "High"],
  growingSeasonForage: ["", "Summer", "Winter", "Either"],
  prussicAcidRisk: ["", "None", "Low", "Standard – manage"],
  regrowth: ["", "Single cut", "Multi-cut / regrazes"],
  seedForm: ["", "Bare / de-hulled", "Podded", "Coated", "Coated + Gaucho", "BioNPK-S coated", "Goldstrike coated", "Scarified", "Lime coated"],
  availability: ["Good stock", "Low stock", "Very low", "Unavailable"] as const,
  availabilityOverride: ["", "Good stock", "Low stock", "Very low", "Unavailable"],
};
const AVAILABILITY_TO_STATUS: Record<string, string> = {
  "Good stock": "in-stock",
  "Low stock": "low",
  "Very low": "very-low",
  Unavailable: "unavailable",
};
const RECORD_TYPES = ["Mix", "Variety", "Commodity / generic"] as const;
const CERTIFICATIONS = ["ASF Code of Practice", "Certified Quality Assured Seed", "Certified seed", "Licensed production"];
const MIX_COMPONENT_UNITS = ["%", "kg/ha", "g/ha", "kg"];

function rainfallOptions(current: number | null | undefined) {
  if (current == null || RAINFALL_MIN_MM_OPTIONS.includes(current)) return RAINFALL_MIN_MM_OPTIONS;
  return [...RAINFALL_MIN_MM_OPTIONS, current].sort((a, b) => a - b);
}

function productImage(photos: Array<{ src?: string; assetId?: string }> | undefined) {
  const photo = photos?.find((item) => item.src?.trim() || item.assetId);
  return photoDisplaySrc(photo) || FALLBACK_IMAGE;
}

function techSheetHref(techSheet: string | undefined) {
  const value = techSheet?.trim();
  if (!value) return null;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return `/tech-sheets/${value.replace(/^\/+/, "")}`;
  }
}

function defaultSaleLine(saleLines: SaleLine[] | undefined) {
  return saleLines?.find((line) => line.isDefault) ?? saleLines?.[0];
}

function saleLinePackLabels(saleLines: SaleLine[] | undefined) {
  const labels: string[] = [];
  for (const line of saleLines ?? []) {
    if (line.packKg == null || Number(line.packKg) <= 0) continue;
    const label = `${line.packKg} ${line.packUnit?.trim() || "kg"}`;
    if (!labels.includes(label)) labels.push(label);
  }
  return labels;
}

function listingState(product: { listingState?: string; listingOverride?: string }): ProductListingState {
  if (product.listingState === "Legacy" || product.listingOverride === "Force legacy" || product.listingOverride === "Legacy") return "Legacy";
  if (product.listingState === "New") return "New";
  return "Active";
}

function derivedAvailability(product: any) {
  if (listingState(product) === "Legacy") return "Unavailable";
  if (product.availabilityOverride) return product.availabilityOverride;
  if (!product.saleLines?.length) return "Unavailable";
  const levels = OPTS.availability;
  let best = 3;
  let known = false;
  for (const line of product.saleLines) {
    const idx = levels.indexOf(line.availability);
    if (idx !== -1) {
      known = true;
      if (idx < best) best = idx;
    }
  }
  return known ? levels[best] : "TBA";
}

function publicStatus(availability: string, fallback = "unavailable") {
  return AVAILABILITY_TO_STATUS[availability] ?? fallback;
}

function PublicStatusPill({ status }: { status: string }) {
  const labels: Record<string, string> = { "in-stock": "In stock", low: "Low stock", "very-low": "Very low", unavailable: "Unavailable" };
  return (
    <span className={`status-pill status-${status}`} data-testid={`status-product-${status}`}>
      <i />{labels[status] ?? status}
    </span>
  );
}

function RequiredStar() {
  return <span className="admin-required-star" aria-hidden="true">*</span>;
}

function AdminOnlyMark() {
  return <span className="admin-only-mark">(Admin-only)</span>;
}

function FieldLabel({ children, required = false, hint }: { children: ReactNode; required?: boolean; hint?: ReactNode }) {
  return (
    <>
      <span className="admin-label-title">
        {children}
        {required ? <RequiredStar /> : null}
      </span>
      {hint ? <span className="admin-field-hint">{hint}</span> : null}
    </>
  );
}

export type ProductPageIssue = { key: string; message: string } | undefined;

export type ProductPageEditorProps = {
  form: any;
  products: Array<{ id: number; name: string; slug: string; category: string; status?: string; details?: any; listingState?: string; lifecycleStatus?: string }>;
  rootOptions: CatalogueCategory[];
  childOptions: CatalogueCategory[];
  selectedRoot?: CatalogueCategory | null;
  selectedTaxonomy?: CatalogueCategory | null;
  productOptions: Array<{ id: number; name: string; slug: string; category: string }>;
  productsBySlug: Map<string, { id: number; name: string; slug: string; details?: any }>;
  loadingTaxonomy: boolean;
  taxonomyError?: unknown;
  readOnly: boolean;
  showPublishRequired: boolean;
  isNew: boolean;
  productId?: number;
  issueFor: (key: string) => ProductPageIssue;
  setField: (key: string, value: any) => void;
  setDetail: (key: string, value: any) => void;
  setNumberDetail: (key: string, value: string) => void;
  setListingState: (state: ProductListingState) => void;
  toggleList: (key: string, value: string) => void;
  updateStringItem: (key: string, index: number, value: string) => void;
  removeStringItem: (key: string, index: number) => void;
  addStringItem: (key: string) => void;
  updateSowingRate: (index: number, patch: Partial<ProductSowingRate>) => void;
  toggleTolerance: (name: string) => void;
  toggleMildTolerance: (name: string) => void;
  updateSaleLine: (index: number, patch: Partial<SaleLine>) => void;
  removeSaleLine: (index: number) => void;
  addSaleLine: () => void;
  updateComponent: (index: number, patch: Partial<ProductComponent>) => void;
  removeComponent: (index: number) => void;
  linkComponentProduct: (index: number, slug: string) => void;
  updateFaq: (index: number, patch: Partial<ProductFaq>) => void;
  removeFaq: (index: number) => void;
  addFaq: () => void;
  updatePhoto: (index: number, patch: Partial<ProductPhoto>) => void;
  handleCategoryChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  forSearchMetadata: (value: string) => string;
  forSearchMetadataInput: (value: string) => string;
  h1EditorValue: (name: string, h1?: string) => string;
  h1StoredValue: (name: string, value: string) => string;
};

export function ProductPageEditor(props: ProductPageEditorProps) {
  const { form, readOnly } = props;
  const details = form.details;
  const image = productImage(details.photos);
  const techSheet = techSheetHref(form.techSheet);
  const status = publicStatus(derivedAvailability(form), form.status || "unavailable");
  const defaultLine = defaultSaleLine(form.saleLines);
  const listedPrice = defaultLine?.priceDisplay?.trim() || "";
  const packLabels = saleLinePackLabels(form.saleLines);
  const slots = getEditorQuickFactSlots(form.category, details);
  const isMix = form.category === "Mixes" || details.recordType === "Mix";
  const productRef = { id: props.productId, slug: form.slug, category: form.category };
  const alsoPopularCatalogue = props.products.filter(isAlsoPopularEligible);
  const alsoPopular = resolveAlsoPopular(productRef, details.relatedProducts, alsoPopularCatalogue);
  const alsoPopularIntended = intendedAlsoPopularSlugs(details.relatedProducts);
  const alsoPopularIsAutomatic = alsoPopularIntended.length === 0;
  const faqs = (details.faqs ?? []) as ProductFaq[];

  return (
    <div className="ppe">
      <div className="ppe-page">
        <section className="ppe-hero" style={{ minHeight: 520, backgroundImage: `linear-gradient(rgba(29,40,28,.55), rgba(29,40,28,.72)), url(${image})`, backgroundSize: "cover", backgroundPosition: "center" }}>
          <ProductNewStamp listingState={listingState(form)} size="hero" />
          <div className="product-hero-content" style={{ maxWidth: 1180, margin: "0 auto", padding: "150px 40px 64px", display: "flex", flexDirection: "column", gap: 20 }}>
            <nav aria-label="Breadcrumb" style={{ color: "var(--yellow)", fontSize: 14, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase" }}>
              <span>Products</span> ›{" "}
              <select
                className="ppe-breadcrumb-select"
                aria-label="Product category"
                required
                value={props.selectedRoot?.id ?? ""}
                disabled={readOnly || props.loadingTaxonomy || Boolean(props.taxonomyError)}
                onChange={props.handleCategoryChange}
              >
                <option value="">Select a category</option>
                {props.rootOptions.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}{category.active === false ? " (Inactive)" : ""}</option>
                ))}
              </select>
            </nav>
            <h1 style={{ color: "#fff", fontSize: "clamp(44px,6vw,64px)", lineHeight: 1.05, fontWeight: 700, maxWidth: "20ch" }}>
              <textarea
                className={`ppe-ghost ppe-h1 ${form.name.trim() ? "" : "is-empty"} ${props.issueFor("name") ? "is-invalid" : ""}`}
                rows={2}
                value={form.name}
                placeholder="Product name"
                aria-label="Product name"
                onChange={(event) => props.setField("name", event.target.value)}
              />
            </h1>
            <p className="product-hero-tagline">
              <input
                className={`ppe-ghost ${details.tagline.trim() ? "" : "is-empty"} ${props.issueFor("details.tagline") ? "is-invalid" : ""}`}
                maxLength={60}
                value={details.tagline}
                placeholder="Add a tagline"
                aria-label="Tagline"
                onChange={(event) => props.setDetail("tagline", event.target.value)}
              />
            </p>
            {form.category !== "Mixes" && (
              <p style={{ color: "#C5CCC5", fontSize: 20, fontStyle: "italic" }}>
                <input
                  className={`ppe-ghost ppe-botanical ${details.botanicalName.trim() ? "" : "is-empty"}`}
                  value={details.botanicalName}
                  placeholder="Botanical name"
                  aria-label="Botanical name"
                  onChange={(event) => props.setDetail("botanicalName", event.target.value)}
                />
              </p>
            )}
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <PublicStatusPill status={status} />
              {techSheet && <a className="button button-primary" href={techSheet} target="_blank" rel="noreferrer">Download tech sheet</a>}
            </div>
          </div>
          <HeroUpload photos={details.photos} updatePhoto={props.updatePhoto} readOnly={readOnly} />
        </section>

        <section>
          <div className="product-detail-grid">
            <article className="product-main-col">
              <p className="product-blurb mobile-order-1">
                <textarea
                  className={`ppe-ghost ${details.blurb.trim() ? "" : "is-empty"} ${props.issueFor("details.blurb") ? "is-invalid" : ""}`}
                  rows={3}
                  value={details.blurb}
                  placeholder="Add a blurb"
                  aria-label="Blurb"
                  onChange={(event) => props.setDetail("blurb", event.target.value)}
                />
              </p>
              <section className={`product-key-attributes mobile-order-3 ${props.issueFor("details.keyAttributes") ? "ppe-invalid-block" : ""}`}>
                <h2>Key attributes</h2>
                <ul>
                  {(details.keyAttributes.length ? details.keyAttributes : [""]).map((attribute: string, index: number) => (
                    <li key={index}>
                      <input
                        className={`ppe-ghost ${attribute.trim() ? "" : "is-empty"}`}
                        value={attribute}
                        placeholder="Add a key attribute"
                        aria-label={`Key attribute ${index + 1}`}
                        onChange={(event) => {
                          if (!details.keyAttributes.length) props.setDetail("keyAttributes", [event.target.value]);
                          else props.updateStringItem("keyAttributes", index, event.target.value);
                        }}
                      />
                      {!readOnly && details.keyAttributes.length > 1 && (
                        <button type="button" className="ppe-inline-remove" onClick={() => props.removeStringItem("keyAttributes", index)} aria-label="Remove key attribute">×</button>
                      )}
                    </li>
                  ))}
                </ul>
                {!readOnly && <button type="button" className="ppe-quiet-add" onClick={() => props.addStringItem("keyAttributes")}>Add attribute</button>}
              </section>
              <div className="product-main-rest mobile-order-4">
                <aside className="product-distribution-note">
                  <Icon name="info" size={22} />
                  <p>
                    <textarea
                      className={`ppe-ghost ${details.distributionNote.trim() ? "" : "is-empty"}`}
                      rows={2}
                      value={details.distributionNote}
                      placeholder="Optional distribution note"
                      aria-label="Distribution note"
                      onChange={(event) => props.setDetail("distributionNote", event.target.value)}
                    />
                  </p>
                </aside>
                {isMix && (
                  <section style={{ display: "grid", gap: 16 }}>
                    <h2 style={{ color: "var(--green)", fontSize: 28 }}>Mix components</h2>
                    <p style={{ color: "var(--muted)" }}>
                      Formulation{" "}
                      <input className={`ppe-ghost ppe-inline-field ${details.formulationYear.trim() ? "" : "is-empty"}`} value={details.formulationYear} placeholder="year" aria-label="Formulation year" onChange={(event) => props.setDetail("formulationYear", event.target.value)} />
                    </p>
                    <div className="product-table-wrap" style={{ border: "1px solid var(--line)", borderRadius: 16 }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                        <thead>
                          <tr style={{ background: "var(--sage)", color: "var(--green)", fontSize: 14 }}>
                            <th style={{ padding: "12px 16px", borderBottom: "2px solid #C5CCC5" }}>Component</th>
                            <th style={{ padding: "12px 16px", borderBottom: "2px solid #C5CCC5" }}>Rate</th>
                            {!readOnly && <th style={{ width: 48, borderBottom: "2px solid #C5CCC5" }} />}
                          </tr>
                        </thead>
                        <tbody>
                          {(details.components.length ? details.components : [{ productLink: "", speciesName: "", inclusionRate: null, unit: "%", description: "", note: "" }]).map((component: ProductComponent, index: number) => {
                            const linked = component.productLink ? props.productsBySlug.get(component.productLink) : undefined;
                            return (
                              <tr key={index} style={{ borderBottom: "1px solid var(--line)" }}>
                                <td className="mix-component-cell">
                                  <div className="mix-component-name">
                                    <input className={`ppe-ghost ${component.speciesName.trim() ? "" : "is-empty"}`} value={component.speciesName} placeholder="Component name" aria-label={`Component ${index + 1} name`} onChange={(event) => {
                                      if (!details.components.length) {
                                        props.setDetail("components", [{ productLink: "", speciesName: event.target.value, inclusionRate: null, unit: "%", description: "", note: "" }]);
                                      } else {
                                        props.updateComponent(index, { speciesName: event.target.value });
                                      }
                                    }} />
                                  </div>
                                  <div className="mix-component-description">
                                    <textarea className={`ppe-ghost ${component.description?.trim() ? "" : "is-empty"}`} rows={2} value={component.description ?? ""} placeholder="What this ingredient contributes" aria-label={`Component ${index + 1} description`} onChange={(event) => props.updateComponent(index, { description: event.target.value })} />
                                  </div>
                                  <select className="ppe-ghost ppe-mix-link" value={component.productLink} onChange={(event) => props.linkComponentProduct(index, event.target.value)} aria-label={`Component ${index + 1} linked product`}>
                                    <option value="">Not linked — name only</option>
                                    {props.productOptions.map((option) => <option key={option.id} value={option.slug}>{option.name}</option>)}
                                  </select>
                                  {linked ? <span className="admin-field-hint">Customers can open {linked.name} from this mix.</span> : null}
                                </td>
                                <td style={{ padding: "12px 16px" }}>
                                  <span className="ppe-rate-row">
                                    <input className={`ppe-ghost ppe-inline-field ${component.inclusionRate != null ? "" : "is-empty"}`} type="number" min="0" step="0.01" value={component.inclusionRate ?? ""} placeholder="Rate" aria-label={`Component ${index + 1} rate`} onChange={(event) => props.updateComponent(index, { inclusionRate: event.target.value === "" ? null : Number(event.target.value) })} />
                                    <input className={`ppe-ghost ppe-inline-field ${component.unit.trim() ? "" : "is-empty"}`} list="ppe-mix-units" value={component.unit} placeholder="%" aria-label={`Component ${index + 1} unit`} onChange={(event) => props.updateComponent(index, { unit: event.target.value })} />
                                  </span>
                                </td>
                                {!readOnly && details.components.length > 0 && (
                                  <td><button type="button" className="ppe-inline-remove" onClick={() => props.removeComponent(index)} aria-label="Remove component">×</button></td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <datalist id="ppe-mix-units">{MIX_COMPONENT_UNITS.map((unit) => <option key={unit} value={unit} />)}</datalist>
                    {!readOnly && <button type="button" className="ppe-quiet-add" onClick={() => props.setDetail("components", [...details.components, { productLink: "", speciesName: "", inclusionRate: null, unit: "%", description: "", note: "" }])}>Add component</button>}
                  </section>
                )}
                <section style={{ display: "grid", gap: 16 }}>
                  <h2 style={{ color: "var(--green)", fontSize: 30 }}>About this variety</h2>
                  <textarea
                    className={`ppe-ghost ppe-description ${details.description.trim() ? "" : "is-empty"} ${props.issueFor("details.description") ? "is-invalid" : ""}`}
                    rows={8}
                    value={details.description}
                    placeholder="Tell the public story of this variety"
                    aria-label="Description"
                    onChange={(event) => props.setDetail("description", event.target.value)}
                    style={{ fontSize: 17, lineHeight: 1.7, maxWidth: "64ch" }}
                  />
                </section>
                <section style={{ display: "grid", gap: 16 }} aria-label="Product growing notes">
                  <GrowingNote summary="Planting & grazing notes" value={details.grazingManagementNotes} onChange={(value) => props.setDetail("grazingManagementNotes", value)} />
                  <GrowingNote summary="Disease & pest resistance" value={details.diseasePestResistance} onChange={(value) => props.setDetail("diseasePestResistance", value)} />
                  <GrowingNote summary="Stand life" value={details.standLifeNotes} onChange={(value) => props.setDetail("standLifeNotes", value)} />
                </section>
                <section style={{ display: "grid", gap: 16 }}>
                  <h2 style={{ color: "var(--green)", fontSize: 28 }}>How it&apos;s sold</h2>
                  <div className="product-table-wrap sold-table">
                    <table>
                      <thead><tr><th>Form</th><th>Pack</th><th>Status</th></tr></thead>
                      <tbody>
                        {(form.saleLines ?? []).length ? (form.saleLines as SaleLine[]).map((line, index) => (
                          <tr key={line.stockCode || index}>
                            <td>{line.seedForm || "Bare"}</td>
                            <td>{line.packKg ? `${line.packKg} ${line.packUnit}` : form.packSize}</td>
                            <td className="sold-status"><PublicStatusPill status={publicStatus(line.availability ?? "Unavailable", status)} /></td>
                          </tr>
                        )) : (
                          <tr><td colSpan={3}>Sale lines are edited in the Selling card below.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            </article>
            <aside className="product-sidebar-col">
              <div className="product-sidebar-card mobile-order-2">
                <section className="quick-facts-section">
                  <h2 className="sidebar-card-heading">Quick facts</h2>
                  <div className="quick-facts-list">
                    {slots.map((slot) => (
                      <div className="quick-fact-item" key={slot.id}>
                        <span className="quick-fact-icon"><Icon name={slot.icon} size={22} /></span>
                        <div className="quick-fact-content">
                          <span className="quick-fact-label">{slot.label}</span>
                          <span className={`quick-fact-value ${slot.formatted ? "" : "is-empty"}`}>
                            <QuickFactValue slotId={slot.id} formatted={slot.formatted} form={form} {...props} />
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
                <div className="pricing-section">
                  <PublicStatusPill status={status} />
                  <div className="pricing-details">
                    <strong className="pricing-amount">{listedPrice || "Contact for pricing"}</strong>
                    {packLabels.length > 0 && <span className="pricing-unit">Available in {packLabels.join(", ")}</span>}
                  </div>
                  <span className="button button-primary" style={{ width: "100%", textAlign: "center" }}>Ask about an order</span>
                  <small className="pricing-disclaimer">We supply through rural resellers across Western Australia.</small>
                </div>
              </div>
              <div className="product-sidebar-bottom mobile-order-5">
                <div className="product-meta-section">
                  <div>Certification: {(details.certification ?? []).filter(Boolean).join(", ") || "—"}</div>
                  {details.pbrProtected ? <div>PBR: {details.pbrDetails || "Protected"}</div> : <div>PBR: —</div>}
                </div>
              </div>
            </aside>
          </div>
        </section>

        <section className="product-faq-section" aria-labelledby="product-faq-heading">
          <div className="product-faq-inner">
            <h2 id="product-faq-heading">FAQs</h2>
            <div className="product-faq-list">
              {faqs.map((faq, index) => (
                <div className="product-faq-item" key={index}>
                  <div className="product-faq-summary">
                    <input
                      className={`ppe-ghost product-faq-question ${faq.question.trim() ? "" : "is-empty"}`}
                      maxLength={PRODUCT_FAQ_QUESTION_MAX}
                      value={faq.question}
                      placeholder={`Question ${index + 1}`}
                      aria-label={`FAQ ${index + 1} question`}
                      onChange={(event) => props.updateFaq(index, { question: event.target.value })}
                    />
                    {!readOnly && (
                      <button type="button" className="ppe-inline-remove" onClick={() => props.removeFaq(index)} aria-label={`Remove FAQ ${index + 1}`}>×</button>
                    )}
                  </div>
                  <textarea
                    className={`ppe-ghost product-faq-answer ${faq.answer.trim() ? "" : "is-empty"}`}
                    rows={3}
                    maxLength={PRODUCT_FAQ_ANSWER_MAX}
                    value={faq.answer}
                    placeholder="Add an answer"
                    aria-label={`FAQ ${index + 1} answer`}
                    onChange={(event) => props.updateFaq(index, { answer: event.target.value })}
                  />
                </div>
              ))}
              {faqs.length === 0 && <p className="ppe-also-popular-empty">No FAQs yet. Add questions customers ask about this product.</p>}
            </div>
            {!readOnly && faqs.length < PRODUCT_FAQ_LIMIT && (
              <button type="button" className="ppe-quiet-add" onClick={props.addFaq}>Add FAQ</button>
            )}
          </div>
        </section>

        <section className="also-popular-section" aria-labelledby="also-popular-heading">
          <div className="also-popular-inner">
            <div className="also-popular-header">
              <h2 id="also-popular-heading">Also popular:</h2>
              <span className="also-popular-category-link">View all {form.category || "products"}<Icon name="arrow-right" size={18} /></span>
            </div>
            <AlsoPopularPicker
              selectedSlugs={details.relatedProducts ?? []}
              options={props.productOptions}
              productsBySlug={props.productsBySlug}
              readOnly={readOnly}
              compact
              onChange={(slugs) => props.setDetail("relatedProducts", slugs)}
            />
            {alsoPopular.length > 0 ? (
              <div className="also-popular-grid">
                {alsoPopular.map((item, index) => (
                  <div key={item.id ?? item.slug} className="also-popular-card">
                    <div className="also-popular-image" role="img" aria-label={item.name} style={{ backgroundImage: `url(${productImage(item.details?.photos)})` }}>
                      <PublicStatusPill status={item.status || "unavailable"} />
                      <ProductNewStamp listingState={item.listingState} />
                    </div>
                    <div className="also-popular-card-body">
                      <div>
                        {!readOnly && (
                          <select
                            className="ppe-ghost ppe-also-popular-card-select"
                            value={alsoPopularIsAutomatic ? "" : item.slug}
                            aria-label={`Also popular product ${index + 1}`}
                            onChange={(event) => {
                              const slug = event.target.value;
                              if (alsoPopularIsAutomatic) {
                                props.setDetail("relatedProducts", slug ? [slug] : []);
                                return;
                              }
                              if (!slug) {
                                props.setDetail("relatedProducts", alsoPopularIntended.filter((_, itemIndex) => itemIndex !== index));
                                return;
                              }
                              props.setDetail("relatedProducts", alsoPopularIntended.map((value, itemIndex) => itemIndex === index ? slug : value));
                            }}
                          >
                            <option value="">{alsoPopularIsAutomatic ? "Automatic from this category" : "Remove this product"}</option>
                            {props.productOptions
                              .filter((option) => option.slug === item.slug || !alsoPopularIntended.includes(option.slug))
                              .map((option) => <option key={option.id} value={option.slug}>{option.name}</option>)}
                          </select>
                        )}
                        <h3>{item.name}</h3>
                        {item.details?.tagline?.trim() && <p>{item.details.tagline}</p>}
                      </div>
                      <span className="also-popular-arrow" aria-hidden="true"><Icon name="arrow-right" size={18} /></span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="ppe-also-popular-empty">No other products in this category yet.</p>
            )}
          </div>
        </section>
      </div>

      <BelowCards {...props} />
    </div>
  );
}

function GrowingNote({ summary, value, onChange }: { summary: string; value: string; onChange: (value: string) => void }) {
  return (
    <details style={{ borderBottom: "1px solid var(--line)", paddingBottom: 16 }} open={!value.trim()}>
      <summary style={{ color: "var(--green)", cursor: "pointer", fontSize: 20, fontWeight: 700 }}>{summary}</summary>
      <textarea className={`ppe-ghost ppe-growing-note ${value.trim() ? "" : "is-empty"}`} rows={3} value={value} placeholder={`Add ${summary.toLowerCase()}`} aria-label={summary} onChange={(event) => onChange(event.target.value)} style={{ margin: "16px 0 0", lineHeight: 1.6, width: "100%" }} />
    </details>
  );
}

function HeroUpload({ photos, updatePhoto, readOnly }: { photos: ProductPhoto[]; updatePhoto: ProductPageEditorProps["updatePhoto"]; readOnly: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState(photos[0]?.src ?? "");
  useEffect(() => { setUrl(photos[0]?.src ?? ""); }, [photos[0]?.src]);
  if (readOnly) return null;
  const applyUrl = () => {
    const next = url.trim();
    updatePhoto(0, {
      src: next,
      file: next ? (photos[0]?.file || "Hero image") : "",
      assetId: undefined,
      format: undefined,
      objectPath: undefined,
      width: undefined,
      height: undefined,
    });
  };
  return (
    <div className="ppe-hero-upload">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          setBusy(true);
          setError("");
          try {
            const uploaded = await uploadMediaAsset(file);
            updatePhoto(0, { ...uploaded, role: "hero" });
            setUrl(uploaded.src);
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Upload failed.");
          } finally {
            setBusy(false);
          }
        }}
      />
      <button type="button" className="ppe-hero-upload-button" onClick={() => inputRef.current?.click()} disabled={busy}>
        {busy ? "Uploading…" : "Upload"}
      </button>
      <label className="ppe-hero-url">
        <span>or image URL</span>
        <input type="url" value={url} placeholder="https://" onChange={(event) => setUrl(event.target.value)} onBlur={applyUrl} />
      </label>
      {error && <span className="ppe-hero-upload-error">{error}</span>}
    </div>
  );
}

function QuickFactValue({
  slotId,
  formatted,
  form,
  setDetail,
  setNumberDetail,
  updateSowingRate,
  toggleTolerance,
  toggleMildTolerance,
  toggleList,
}: ProductPageEditorProps & { slotId: QuickFactSlotId; formatted: string }) {
  const details = form.details;
  if (slotId === "persistencyType") {
    return <select className={`ppe-ghost ${formatted ? "" : "is-empty"}`} value={details.persistencyType} onChange={(event) => setDetail("persistencyType", event.target.value)} aria-label="Type and persistency">{PERSISTENCY.map((value) => <option key={value} value={value}>{value || "Not set"}</option>)}</select>;
  }
  if (slotId === "rainfallMinMm") {
    return <select className={`ppe-ghost ${formatted ? "" : "is-empty"}`} value={details.rainfallMinMm ?? ""} onChange={(event) => setNumberDetail("rainfallMinMm", event.target.value)} aria-label="Minimum rainfall"><option value="">Not set</option>{rainfallOptions(details.rainfallMinMm).map((mm) => <option key={mm} value={mm}>{mm} mm+</option>)}</select>;
  }
  if (slotId === "soilPh") {
    return (
      <span className="ppe-fact-cluster">
        <select className={`ppe-ghost ${details.soilRangeLightest ? "" : "is-empty"}`} value={details.soilRangeLightest} onChange={(event) => setDetail("soilRangeLightest", event.target.value)} aria-label="Lightest soil"><option value="">Lightest</option>{SOIL_OPTIONS.map((soil) => <option key={soil.code} value={soil.code}>{soil.label}</option>)}</select>
        <span>–</span>
        <select className={`ppe-ghost ${details.soilRangeHeaviest ? "" : "is-empty"}`} value={details.soilRangeHeaviest} onChange={(event) => setDetail("soilRangeHeaviest", event.target.value)} aria-label="Heaviest soil"><option value="">Heaviest</option>{SOIL_OPTIONS.map((soil) => <option key={soil.code} value={soil.code}>{soil.label}</option>)}</select>
        <span>pH</span>
        <input className={`ppe-ghost ppe-inline-field ${details.soilPhMin != null ? "" : "is-empty"}`} type="number" min="0" step="0.1" value={details.soilPhMin ?? ""} placeholder="min" aria-label="Minimum soil pH" onChange={(event) => setNumberDetail("soilPhMin", event.target.value)} />
        <select className="ppe-ghost" value={details.soilPhScale} onChange={(event) => setDetail("soilPhScale", event.target.value)} aria-label="Soil pH scale"><option>CaCl₂</option><option>water</option></select>
      </span>
    );
  }
  if (slotId === "sowingRates") {
    return (
      <span className="ppe-sowing-stack">
        {(details.sowingRates.length ? details.sowingRates : [{ context: "Pasture", min: null, max: null, unit: "kg/ha" }]).map((rate: ProductSowingRate, index: number) => (
          <span className="ppe-fact-cluster" key={index}>
            <input className={`ppe-ghost ppe-inline-field ${rate.min != null ? "" : "is-empty"}`} type="number" min="0" step="0.01" value={rate.min ?? ""} placeholder="Min" aria-label={`Sowing rate ${index + 1} min`} onChange={(event) => {
              if (!details.sowingRates.length) setDetail("sowingRates", [{ context: "Pasture", min: event.target.value === "" ? null : Number(event.target.value), max: null, unit: "kg/ha" }]);
              else updateSowingRate(index, { min: event.target.value === "" ? null : Number(event.target.value) });
            }} />
            <span>–</span>
            <input className={`ppe-ghost ppe-inline-field ${rate.max != null ? "" : "is-empty"}`} type="number" min="0" step="0.01" value={rate.max ?? ""} placeholder="Max" aria-label={`Sowing rate ${index + 1} max`} onChange={(event) => updateSowingRate(index, { max: event.target.value === "" ? null : Number(event.target.value) })} />
            <input className="ppe-ghost ppe-inline-field" value={rate.unit} placeholder="kg/ha" aria-label={`Sowing rate ${index + 1} unit`} onChange={(event) => updateSowingRate(index, { unit: event.target.value })} />
            <select className="ppe-ghost" value={rate.context} onChange={(event) => updateSowingRate(index, { context: event.target.value as any })} aria-label={`Sowing rate ${index + 1} context`}>{SOWING_CONTEXTS.map((value) => <option key={value}>{value}</option>)}</select>
          </span>
        ))}
        <button type="button" className="ppe-quiet-add" onClick={() => setDetail("sowingRates", [...details.sowingRates, { context: "Pasture", min: null, max: null, unit: "kg/ha" }])}>Add rate</button>
      </span>
    );
  }
  if (slotId === "tolerance") {
    return (
      <span className="ppe-chip-row">
        {TOLERANCES.map((name) => {
          const selected = details.tolerance.find((item: any) => item.name === name);
          return (
            <span className="ppe-chip-wrap" key={name}>
              <button type="button" className={`ppe-chip ${selected ? "is-on" : ""}`} onClick={() => toggleTolerance(name)}>{name}</button>
              {selected && <label className="ppe-chip-mild"><input type="checkbox" checked={selected.mild} onChange={() => toggleMildTolerance(name)} />Mild</label>}
            </span>
          );
        })}
      </span>
    );
  }
  if (slotId === "endUse") {
    return <span className="ppe-chip-row">{END_USES.map((value) => <button type="button" key={value} className={`ppe-chip ${details.endUse.includes(value) ? "is-on" : ""}`} onClick={() => toggleList("endUse", value)}>{value}</button>)}</span>;
  }
  if (slotId === "livestock") {
    return <span className="ppe-chip-row">{LIVESTOCK.map((value) => <button type="button" key={value} className={`ppe-chip ${details.livestock.includes(value) ? "is-on" : ""}`} onClick={() => toggleList("livestock", value)}>{value}</button>)}</span>;
  }
  if (slotId === "ploidy") return <GhostSelect label="Ploidy" value={details.ploidy} options={OPTS.ploidy} onChange={(value) => setDetail("ploidy", value)} />;
  if (slotId === "headingDate") return <GhostSelect label="Heading date" value={details.headingDate} options={OPTS.headingDate} onChange={(value) => setDetail("headingDate", value)} />;
  if (slotId === "endophyte") return <GhostSelect label="Endophyte" value={details.endophyte} options={OPTS.endophyte} onChange={(value) => setDetail("endophyte", value)} />;
  if (slotId === "headingOffsetDays") {
    return <span className="ppe-fact-cluster"><input className={`ppe-ghost ppe-inline-field ${details.headingOffsetDays != null ? "" : "is-empty"}`} type="number" value={details.headingOffsetDays ?? ""} placeholder="0" aria-label="Heading offset days" onChange={(event) => setNumberDetail("headingOffsetDays", event.target.value)} /><span>days vs Nui</span></span>;
  }
  if (slotId === "argtResistant") {
    return <label className="ppe-chip-mild"><input type="checkbox" checked={details.argtResistant} onChange={(event) => setDetail("argtResistant", event.target.checked)} />Resistant</label>;
  }
  if (slotId === "maturityDays") return <input className={`ppe-ghost ${details.maturityDays != null ? "" : "is-empty"}`} type="number" value={details.maturityDays ?? ""} placeholder="Days" aria-label="Days to flowering" onChange={(event) => setNumberDetail("maturityDays", event.target.value)} />;
  if (slotId === "hardSeedLevel") return <GhostSelect label="Hard seed level" value={details.hardSeedLevel} options={OPTS.hardSeedLevel} onChange={(value) => setDetail("hardSeedLevel", value)} />;
  if (slotId === "flowerColour") return <GhostSelect label="Flower colour" value={details.flowerColour} options={["", "Pink", "Yellow", "White", "Crimson", "Red", "Purple"]} onChange={(value) => setDetail("flowerColour", value)} />;
  if (slotId === "oestrogenLevel") return <GhostSelect label="Oestrogen level" value={details.oestrogenLevel} options={OPTS.oestrogenLevel} onChange={(value) => setDetail("oestrogenLevel", value)} />;
  if (slotId === "bloatRisk") return <GhostSelect label="Bloat risk" value={details.bloatRisk} options={OPTS.bloatRisk} onChange={(value) => setDetail("bloatRisk", value)} />;
  if (slotId === "winterActivity") return <input className={`ppe-ghost ${details.winterActivity != null ? "" : "is-empty"}`} type="number" min="1" max="10" value={details.winterActivity ?? ""} placeholder="1–10" aria-label="Winter activity" onChange={(event) => setNumberDetail("winterActivity", event.target.value)} />;
  if (slotId === "growthSeason") return <GhostSelect label="Growth season" value={details.growthSeason} options={OPTS.growthSeason} onChange={(value) => setDetail("growthSeason", value)} />;
  if (slotId === "growingSeason") return <GhostSelect label="Growing season" value={details.growingSeason} options={OPTS.growingSeasonForage} onChange={(value) => setDetail("growingSeason", value)} />;
  if (slotId === "weeksToFirstGrazing") return <input className={`ppe-ghost ${details.weeksToFirstGrazing ? "" : "is-empty"}`} value={details.weeksToFirstGrazing} placeholder="e.g. 6-8" aria-label="Weeks to first grazing" onChange={(event) => setDetail("weeksToFirstGrazing", event.target.value)} />;
  if (slotId === "prussicAcidRisk") return <GhostSelect label="Prussic acid risk" value={details.prussicAcidRisk} options={OPTS.prussicAcidRisk} onChange={(value) => setDetail("prussicAcidRisk", value)} />;
  if (slotId === "regrowth") return <GhostSelect label="Regrowth" value={details.regrowth} options={OPTS.regrowth} onChange={(value) => setDetail("regrowth", value)} />;
  if (slotId === "productForm") return <input className={`ppe-ghost ${details.productForm ? "" : "is-empty"}`} value={details.productForm} placeholder="e.g. Powder" aria-label="Product form" onChange={(event) => setDetail("productForm", event.target.value)} />;
  if (slotId === "applicationRate") return <input className={`ppe-ghost ${details.applicationRate ? "" : "is-empty"}`} value={details.applicationRate} placeholder="Application rate" aria-label="Application rate" onChange={(event) => setDetail("applicationRate", event.target.value)} />;
  return formatted ? <>{formatted}</> : <span className="ppe-placeholder">Add</span>;
}

function GhostSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <select className={`ppe-ghost ${value ? "" : "is-empty"}`} value={value} onChange={(event) => onChange(event.target.value)} aria-label={label}>
      {options.map((option) => <option key={option} value={option}>{option || "Not set"}</option>)}
    </select>
  );
}

function BelowCards(props: ProductPageEditorProps) {
  const { form, showPublishRequired, readOnly } = props;
  const details = form.details;
  const isLegacyListing = listingState(form) === "Legacy";
  const isBio = form.category === "Biologicals";
  return (
    <div className="ppe-cards">
      <section className="admin-panel admin-form-card">
        <h2>SEO</h2>
        <p className="admin-field-hint">Not shown on the product page. Required before publishing.</p>
        <div className="admin-form-grid">
          <label className="wide">
            <FieldLabel hint="Copies the product name unless you overwrite it. Trademark symbols stay visible on the page H1.">H1</FieldLabel>
            <input maxLength={160} value={props.h1EditorValue(form.name, details.h1)} onChange={(event) => props.setDetail("h1", props.h1StoredValue(form.name, event.target.value))} />
          </label>
          <label className={`wide ${props.issueFor("details.seoTitle") ? "admin-field-invalid" : ""}`}>
            <FieldLabel required={showPublishRequired} hint="Required before publishing. Shown in search results and browser tabs.">SEO title</FieldLabel>
            <input aria-invalid={Boolean(props.issueFor("details.seoTitle"))} value={details.seoTitle} onChange={(event) => props.setDetail("seoTitle", props.forSearchMetadataInput(event.target.value))} onBlur={(event) => props.setDetail("seoTitle", props.forSearchMetadata(event.target.value))} />
            {props.issueFor("details.seoTitle") && <span className="admin-inline-field-error">{props.issueFor("details.seoTitle")!.message}</span>}
          </label>
          <label className={`wide ${props.issueFor("details.seoDescription") ? "admin-field-invalid" : ""}`}>
            <FieldLabel required={showPublishRequired} hint="Required before publishing. A concise summary for search results.">SEO description</FieldLabel>
            <textarea aria-invalid={Boolean(props.issueFor("details.seoDescription"))} value={details.seoDescription} onChange={(event) => props.setDetail("seoDescription", props.forSearchMetadataInput(event.target.value))} onBlur={(event) => props.setDetail("seoDescription", props.forSearchMetadata(event.target.value))} rows={4} />
            {props.issueFor("details.seoDescription") && <span className="admin-inline-field-error">{props.issueFor("details.seoDescription")!.message}</span>}
          </label>
          <label className="wide"><FieldLabel hint="Optional. Uses the SEO title when left blank.">Social sharing title</FieldLabel><input value={details.socialTitle} onChange={(event) => props.setDetail("socialTitle", props.forSearchMetadataInput(event.target.value))} onBlur={(event) => props.setDetail("socialTitle", props.forSearchMetadata(event.target.value))} /></label>
          <label className="wide"><FieldLabel hint="Optional. Uses the SEO description when left blank.">Social sharing description</FieldLabel><textarea value={details.socialDescription} onChange={(event) => props.setDetail("socialDescription", props.forSearchMetadataInput(event.target.value))} onBlur={(event) => props.setDetail("socialDescription", props.forSearchMetadata(event.target.value))} rows={4} /></label>
          <label className="wide"><FieldLabel hint="Choose a product photo or enter another image URL below.">Social sharing image</FieldLabel>
            <select value={details.photos.some((photo: ProductPhoto) => photo.src && photo.src === details.socialImage) ? details.socialImage : ""} onChange={(event) => props.setDetail("socialImage", event.target.value)}>
              <option value="">Use the product hero image</option>
              {details.photos.filter((photo: ProductPhoto) => photo.src).map((photo: ProductPhoto, index: number) => <option key={`${photo.slot}-${index}`} value={photo.src}>{photo.slot || `Photo ${index + 1}`}</option>)}
            </select>
            <input type="url" value={details.socialImage} onChange={(event) => props.setDetail("socialImage", event.target.value)} placeholder="https://example.com/social-image.jpg" />
          </label>
          <label className="wide"><FieldLabel hint="Optional. Leave blank to use the product's normal published URL.">Canonical URL override</FieldLabel><input type="url" value={details.canonicalUrl} onChange={(event) => props.setDetail("canonicalUrl", event.target.value)} /></label>
          <label className="admin-check-row wide"><input type="checkbox" checked={details.robotsIndex} onChange={(event) => props.setDetail("robotsIndex", event.target.checked)} /><span><strong>Allow search engines to index this product</strong></span></label>
        </div>
      </section>

      <section className="admin-panel admin-form-card">
        <h2>Identity</h2>
        <p className="admin-field-hint">Staff fields that are not shown in the page layout above.</p>
        <div className="admin-form-grid">
          <label className={props.issueFor("slug") ? "admin-field-invalid" : ""}>
            <FieldLabel required>Slug</FieldLabel>
            <input required disabled={!props.isNew} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={form.slug} onChange={(event) => props.setField("slug", event.target.value.toLowerCase())} placeholder="souwest-pasture-mix" />
            {props.issueFor("slug") && <span className="admin-inline-field-error">{props.issueFor("slug")!.message}</span>}
          </label>
          <label>
            <span className="admin-label-title">Subcategory</span>
            <select value={props.selectedTaxonomy && props.selectedTaxonomy.parentId === props.selectedRoot?.id ? props.selectedTaxonomy.id : ""} onChange={(event) => props.setField("subcategoryId", event.target.value ? Number(event.target.value) : props.selectedRoot?.id ?? null)} disabled={!props.selectedRoot || props.loadingTaxonomy || Boolean(props.taxonomyError)}>
              <option value="">None</option>
              {props.childOptions.map((category) => <option key={category.id} value={category.id}>{category.name}{category.active === false ? " (Inactive)" : ""}</option>)}
            </select>
          </label>
          <div className={`admin-choice-field wide ${props.issueFor("details.recordType") ? "admin-field-invalid" : ""}`} role="group" aria-label="Record type">
            <FieldLabel required>Record type</FieldLabel>
            <div>{RECORD_TYPES.map((kind) => <button key={kind} type="button" className={details.recordType === kind ? "selected" : ""} onClick={() => props.setDetail("recordType", kind)}>{kind}</button>)}</div>
            {props.issueFor("details.recordType") && <span className="admin-inline-field-error">{props.issueFor("details.recordType")!.message}</span>}
          </div>
          <div className="admin-choice-field wide" role="group" aria-label="Listing state">
            <FieldLabel hint="Active and New products can appear on the current selling catalogue. New shows a red NEW stamp on public cards and the product page. Legacy stays published as catalogue history only.">Listing state</FieldLabel>
            <div>{(["Active", "New", "Legacy"] as ProductListingState[]).map((state) => <button key={state} type="button" className={listingState(form) === state ? "selected" : ""} onClick={() => props.setListingState(state)}>{state}</button>)}</div>
          </div>
        </div>
      </section>

      <section className="admin-panel admin-form-card">
        <h2>Selling</h2>
        <p className="admin-field-hint">Stock codes, packs and price feed the How it&apos;s sold table and sidebar above.</p>
        <div className={`admin-repeat-group wide ${props.issueFor("saleLines.default") || props.issueFor("saleLines.stockCodes") ? "admin-field-invalid admin-group-invalid" : ""}`}>
          <div className="admin-section-heading"><div><h3>Sale lines</h3></div>{!readOnly && <button className="admin-button outline small" type="button" onClick={props.addSaleLine}><Icon name="plus" size={16} />Add line</button>}</div>
          <div className="admin-sale-line-list">
            {(form.saleLines ?? []).map((line: SaleLine, index: number) => (
              <div className="admin-sale-line-card" key={index}>
                <div className="admin-sale-line-card-head">
                  <h4>{line.stockCode?.trim() || `Sale line ${index + 1}`}</h4>
                  <div className="admin-sale-line-card-actions">
                    <label className={`admin-sale-line-default ${line.isDefault ? "is-selected" : ""}`}>
                      <input type="radio" name="ppeSaleLineDefault" checked={line.isDefault} onChange={() => props.setField("saleLines", form.saleLines.map((item: SaleLine, itemIndex: number) => ({ ...item, isDefault: itemIndex === index })))} />
                      Default
                    </label>
                    {!readOnly && <button type="button" className="admin-button ghost" onClick={() => props.removeSaleLine(index)}>Remove</button>}
                  </div>
                </div>
                <div className="admin-sale-line-fields">
                  <label>Stock code<input value={line.stockCode} onChange={(event) => props.updateSaleLine(index, { stockCode: event.target.value })} /></label>
                  <label>Seed form<select value={line.seedForm} onChange={(event) => props.updateSaleLine(index, { seedForm: event.target.value })}>{OPTS.seedForm.map((option) => <option key={option} value={option}>{option || "Not set"}</option>)}</select></label>
                  <div className="admin-sale-line-pack">
                    <span>Pack</span>
                    <div className="admin-sale-line-pack-inputs">
                      <input aria-label="Pack weight" type="number" min="0" step="0.01" value={line.packKg ?? ""} onChange={(event) => props.updateSaleLine(index, { packKg: event.target.value === "" ? null : Number(event.target.value) })} />
                      <input aria-label="Pack unit" value={line.packUnit} onChange={(event) => props.updateSaleLine(index, { packUnit: event.target.value })} />
                    </div>
                  </div>
                  <label>Availability
                    <select disabled={isLegacyListing} value={isLegacyListing ? "Unavailable" : (line.availability ?? "")} onChange={(event) => props.updateSaleLine(index, { availability: (event.target.value || null) as SaleLine["availability"] })}>
                      <option value="">TBA</option>
                      {OPTS.availability.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                  <label>Price display<input value={line.priceDisplay} onChange={(event) => props.updateSaleLine(index, { priceDisplay: event.target.value })} placeholder="Contact for pricing" /></label>
                </div>
              </div>
            ))}
          </div>
          {!(form.saleLines ?? []).length && <p className="admin-empty-inline">No sale lines added.</p>}
          {props.issueFor("saleLines.default") && <span className="admin-inline-field-error">{props.issueFor("saleLines.default")!.message}</span>}
          {props.issueFor("saleLines.stockCodes") && <span className="admin-inline-field-error">{props.issueFor("saleLines.stockCodes")!.message}</span>}
        </div>
        <div className="admin-form-grid">
          <label style={{ gridColumn: "1/-1" }}>Availability override
            <select disabled={isLegacyListing} value={isLegacyListing ? "" : (form.availabilityOverride ?? "")} onChange={(event) => props.setField("availabilityOverride", event.target.value || null)}>
              {OPTS.availabilityOverride.map((option) => <option key={option} value={option}>{option || "Use derived"}</option>)}
            </select>
            <span className="admin-derived-info">Currently evaluates to: <strong>{derivedAvailability(form)}</strong></span>
          </label>
          <label className="admin-check-row wide"><input type="checkbox" checked={details.pbrProtected} onChange={(event) => props.setDetail("pbrProtected", event.target.checked)} /><span><strong>PBR protected</strong></span></label>
          <label>PBR details <input value={details.pbrDetails} onChange={(event) => props.setDetail("pbrDetails", event.target.value)} /></label>
          <div className="admin-choice-field wide"><span>Certification</span><div>{CERTIFICATIONS.map((value) => <button key={value} type="button" className={details.certification.includes(value) ? "selected" : ""} onClick={() => props.toggleList("certification", value)}>{value}</button>)}</div></div>
        </div>
      </section>

      <section className="admin-panel admin-form-card">
        <h2>Publishing leftovers</h2>
        <div className="admin-form-grid">
          <label className="wide">Tech sheet URL<input value={form.techSheet} onChange={(event) => props.setField("techSheet", event.target.value)} /></label>
          <label>Legacy website URL <AdminOnlyMark /><input value={form.websiteUrlLegacy} onChange={(event) => props.setField("websiteUrlLegacy", event.target.value)} /></label>
          {!isBio && (
            <>
              <label>Minimum sowing depth (cm) <AdminOnlyMark /><input type="number" min="0" step="0.1" value={details.sowingDepthMinCm ?? ""} onChange={(event) => props.setNumberDetail("sowingDepthMinCm", event.target.value)} /></label>
              <label>Maximum sowing depth (cm) <AdminOnlyMark /><input type="number" min="0" step="0.1" value={details.sowingDepthMaxCm ?? ""} onChange={(event) => props.setNumberDetail("sowingDepthMaxCm", event.target.value)} /></label>
              <label className="admin-check-row"><input type="checkbox" checked={details.australianBred} onChange={(event) => props.setDetail("australianBred", event.target.checked)} /><span><strong>Australian bred <AdminOnlyMark /></strong></span></label>
            </>
          )}
        </div>
        <div className="admin-repeat-group wide">
          <div className="admin-section-heading"><div><h3>Photos</h3><p>Hero is slot 1, uploaded from the page. Extra slots are stored for later use.</p></div></div>
          <div className="admin-photo-list">
            {details.photos.map((photo: ProductPhoto, index: number) => (
              <div className="admin-photo-row" key={photo.slot || index}>
                <div className="admin-photo-thumb">{photoDisplaySrc(photo) ? <img src={photoDisplaySrc(photo)} alt={photo.file} /> : <Icon name="package" size={24} />}</div>
                <span><small>{photo.slot}</small><strong>{photo.file || "No file selected"}</strong></span>
                {index > 0 && (
                  <>
                    <input
                      className="ppe-extra-photo-url"
                      type="url"
                      value={photo.src?.startsWith("/api/media/") ? "" : photo.src}
                      placeholder="Image URL"
                      onChange={(event) => props.updatePhoto(index, {
                        src: event.target.value,
                        file: event.target.value ? photo.file || `Photo ${index + 1}` : "",
                        assetId: undefined,
                        format: undefined,
                        objectPath: undefined,
                      })}
                    />
                    <label className="admin-text-button">
                      Upload
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        hidden
                        onChange={async (event) => {
                          const file = event.target.files?.[0];
                          event.target.value = "";
                          if (!file) return;
                          props.updatePhoto(index, await uploadMediaAsset(file));
                        }}
                      />
                    </label>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
