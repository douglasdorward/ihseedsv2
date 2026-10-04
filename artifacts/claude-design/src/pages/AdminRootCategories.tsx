import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  getListAdminCategoriesQueryKey,
  getListCategoriesQueryKey,
  useCommitCategoryFaqImport,
  useDryRunCategoryFaqImport,
  useListAdminCategories,
  useUpdateCategory,
  type CatalogueCategory,
  type CatalogueCategoryFaq,
  type CategoryFaqImportReport,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Icon } from "../components/ui";
import { SocialImagePreview } from "../components/SocialImagePreview";
import { navigate, useParams } from "../router";
import { ROOT_FAQ_LIMIT } from "../site-settings";
import "../homepage-editor.css";

const TITLE_RECOMMENDED = 60;
const DESCRIPTION_RECOMMENDED = 155;

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

function forSearchMetadataInput(value: string) {
  return value.replace(/[™®]/g, "").replace(/\s{2,}/g, " ").replace(/\s+([,.;:!?])/g, "$1");
}

function forSearchMetadata(value: string) {
  return forSearchMetadataInput(value).trim();
}

function completeFaqs(faqs: CatalogueCategoryFaq[]) {
  return faqs
    .map((item) => ({ question: item.question.trim(), answer: item.answer.trim() }))
    .filter((item) => item.question && item.answer)
    .slice(0, ROOT_FAQ_LIMIT);
}

function editorFaqSlots(faqs: CatalogueCategoryFaq[] | undefined): CatalogueCategoryFaq[] {
  const existing = (faqs ?? [])
    .map((item) => ({ question: item.question, answer: item.answer }))
    .slice(0, ROOT_FAQ_LIMIT);
  return existing.length > 0 ? existing : [{ question: "", answer: "" }];
}

type RootCopy = {
  /** Public intro text. Only saved from this editor for sub-categories. */
  lead: string;
  pageHeading: string;
  seoTitle: string;
  seoDescription: string;
  socialTitle: string;
  socialDescription: string;
  socialImage: string;
  buyingGuide: string;
};

function copyFromCategory(category: CatalogueCategory): RootCopy {
  return {
    lead: category.lead ?? "",
    pageHeading: category.pageHeading ?? "",
    seoTitle: category.seoTitle ?? "",
    seoDescription: category.seoDescription ?? "",
    socialTitle: category.socialTitle ?? "",
    socialDescription: category.socialDescription ?? "",
    socialImage: category.socialImage ?? "",
    buyingGuide: category.buyingGuide ?? "",
  };
}

function cleanCopy(copy: RootCopy): RootCopy {
  return {
    lead: copy.lead.trim(),
    pageHeading: copy.pageHeading.trim(),
    seoTitle: forSearchMetadata(copy.seoTitle),
    seoDescription: forSearchMetadata(copy.seoDescription),
    socialTitle: forSearchMetadata(copy.socialTitle),
    socialDescription: forSearchMetadata(copy.socialDescription),
    socialImage: copy.socialImage.trim(),
    buyingGuide: copy.buyingGuide.replace(/\r\n/g, "\n").trim(),
  };
}

function snapshot(copy: RootCopy, faqs: CatalogueCategoryFaq[]) {
  return JSON.stringify({ ...cleanCopy(copy), faqs: completeFaqs(faqs) });
}

function errorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "error" in error && typeof error.error === "string") return error.error;
  if (error instanceof Error) return error.message.replace(/^HTTP \d+ [^:]+:\s*/, "");
  return fallback;
}

function FaqImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const dryRun = useDryRunCategoryFaqImport();
  const commit = useCommitCategoryFaqImport();
  const [filename, setFilename] = useState("");
  const [workbookBase64, setWorkbookBase64] = useState("");
  const [report, setReport] = useState<CategoryFaqImportReport | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setFilename("");
    setWorkbookBase64("");
    setReport(null);
    setError("");
  };

  const close = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const handleFile = async (file: File) => {
    setFilename(file.name);
    setReport(null);
    setError("");
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("Could not read that file."));
      reader.readAsDataURL(file);
    });
    setWorkbookBase64(dataUrl.split(",")[1] ?? "");
  };

  const handleDryRun = async () => {
    if (!workbookBase64) return;
    setBusy(true);
    setError("");
    try {
      setReport(await dryRun.mutateAsync({ data: { workbookBase64 } }));
    } catch (caught) {
      setError(errorMessage(caught, "Could not validate that workbook."));
    } finally {
      setBusy(false);
    }
  };

  const handleCommit = async () => {
    if (!report) return;
    setBusy(true);
    setError("");
    try {
      await commit.mutateAsync({ data: { workbookBase64, token: report.token } });
      await queryClient.invalidateQueries({ queryKey: getListAdminCategoriesQueryKey(), refetchType: "all" });
      await queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey(), refetchType: "all" });
      reset();
      onClose();
    } catch (caught) {
      setError(errorMessage(caught, "Could not import those categories."));
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;
  return (
    <div className="admin-dialog-backdrop" role="presentation" onMouseDown={close}>
      <section className="admin-dialog admin-import-dialog" role="dialog" aria-modal="true" aria-labelledby="category-faq-import-title" onMouseDown={(event) => event.stopPropagation()}>
        <h2 id="category-faq-import-title">Import Categories</h2>
        <p>Upload an Excel workbook that started as an Export Categories file. The Categories sheet holds each root category and sub-category's page heading, intro text (sub-categories only), SEO title, meta description and social sharing title, description and image, and every category listed there is set to what its cells say, so a blank cell clears that field. The FAQs sheet holds one FAQ per row. A category's FAQs are replaced only when the file includes at least one complete question and answer for its slug, so keep the ones you still want. Blank starter rows are ignored.</p>
        {!report ? (
          <div className="admin-import-file-row">
            <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" data-testid="category-faq-import-file" onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void handleFile(file);
            }} />
            <button className="admin-button outline small" type="button" onClick={() => { void handleDryRun(); }} disabled={!workbookBase64 || busy} data-testid="category-faq-dry-run-btn">
              {busy ? "Checking…" : "Dry run import"}
            </button>
          </div>
        ) : (
          <div className="admin-import-report">
            <p>
              <strong>{filename || "Workbook"}:</strong> {report.updated} categor{report.updated === 1 ? "y" : "ies"} updated, {report.skipped} blank FAQ rows skipped.
            </p>
            {report.plannedChanges.length > 0 && (
              <ul>{report.plannedChanges.map((change) => <li key={change}>{change}</li>)}</ul>
            )}
            {report.issues.length > 0 && (
              <ul>{report.issues.map((issue) => <li key={`${issue.row}-${issue.column}`} style={{ color: "red" }}>Row {issue.row} {issue.column}: {issue.problem}</li>)}</ul>
            )}
          </div>
        )}
        {error && <p className="admin-inline-field-error">{error}</p>}
        <div className="admin-import-actions">
          <button className="admin-button ghost" type="button" onClick={close} disabled={busy}>Cancel</button>
          {report && report.issues.length === 0 && report.updated > 0 && (
            <button className="admin-button primary" type="button" onClick={() => { void handleCommit(); }} disabled={busy} data-testid="category-faq-commit-import-btn">
              {busy ? "Importing…" : "Confirm import"}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

function seoStatus(category: CatalogueCategory) {
  const custom = [category.pageHeading, category.seoTitle, category.seoDescription].some((value) => Boolean(value?.trim()));
  return custom ? "Custom listing" : "Using defaults";
}

function CharacterCount({ value, recommend }: { value: string; recommend: number }) {
  const over = value.length > recommend;
  return (
    <small className={`admin-character-count${over ? " is-over" : ""}`}>
      {value.length} / {recommend} recommended
    </small>
  );
}

/** Mirrors the public site's default H1 for a sub-category page. */
function defaultSubcategoryHeading(rootName: string, subName: string) {
  const name = subName.trim();
  const root = rootName.trim();
  return !root || name.toLowerCase().includes(root.toLowerCase()) ? name : `${name} ${root}`;
}

function RootCategoryEditor({ category, root }: { category: CatalogueCategory; root?: CatalogueCategory }) {
  const queryClient = useQueryClient();
  const updateCategory = useUpdateCategory();
  const isSub = Boolean(root);
  const publicPath = root ? `/products/${root.slug}/${category.slug}` : `/products/${category.slug}`;
  const [copy, setCopy] = useState<RootCopy>(() => copyFromCategory(category));
  const { lead, pageHeading, seoTitle, seoDescription, socialTitle, socialDescription, socialImage, buyingGuide } = copy;
  const setField = (key: keyof RootCopy, value: string) => setCopy((current) => ({ ...current, [key]: value }));
  const [faqs, setFaqs] = useState<CatalogueCategoryFaq[]>(() => editorFaqSlots(category.faqs));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [savedJson, setSavedJson] = useState(() => snapshot(copyFromCategory(category), editorFaqSlots(category.faqs)));

  const headingFallback = root
    ? defaultSubcategoryHeading(root.name, category.name)
    : category.slug === "mixes" ? "Seed Mixes" : `${category.name} Seed`;
  const titleFallback = root ? `${pageHeading.trim() || headingFallback} Seed | IH Seeds` : `${headingFallback} | IH Seeds`;
  const descriptionFallback = (isSub ? lead.trim() : category.lead?.trim())
    || (isSub ? "A summary of this range, built from its products, is used when this is blank." : "Category lead copy is used when this is blank.");
  const previewTitle = seoTitle.trim() || titleFallback;
  const previewDescription = seoDescription.trim() || descriptionFallback;
  const filledFaqCount = completeFaqs(faqs).length;
  const socialTitlePlaceholder = previewTitle;
  const socialDescriptionPlaceholder = previewDescription;
  const dirty = snapshot(copy, faqs) !== savedJson;

  const updateFaq = (index: number, patch: Partial<CatalogueCategoryFaq>) => {
    setFaqs((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  };

  const addFaq = () => {
    setFaqs((current) => current.length >= ROOT_FAQ_LIMIT ? current : [...current, { question: "", answer: "" }]);
  };

  const removeFaq = (index: number) => {
    setFaqs((current) => {
      const next = current.filter((_, itemIndex) => itemIndex !== index);
      return next.length > 0 ? next : [{ question: "", answer: "" }];
    });
  };

  const save = async (event?: FormEvent) => {
    event?.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const nextFaqs = completeFaqs(faqs);
      // The lead of a root category is edited in Products & mixes, so only
      // sub-categories send it from here.
      const { lead: nextLead, ...cleaned } = cleanCopy(copy);
      await updateCategory.mutateAsync({
        id: category.id,
        data: { ...cleaned, ...(isSub ? { lead: nextLead } : {}), faqs: nextFaqs },
      });
      await queryClient.invalidateQueries({ queryKey: getListAdminCategoriesQueryKey(), refetchType: "all" });
      await queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey(), refetchType: "all" });
      setFaqs(editorFaqSlots(nextFaqs));
      setCopy(cleanCopy(copy));
      setSavedJson(snapshot(copy, nextFaqs));
      setMessage("SEO, social sharing, buying guide and FAQs saved. They appear on the public category page immediately.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not save category SEO.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow={root ? `${root.name} sub-category` : "Category pages"}
        title={<>{category.name} <strong>SEO</strong></>}
        onBack={() => navigate("/admin/site-settings/categories")}
        action={
          <button className="admin-button primary" type="button" onClick={() => void save()} disabled={saving || !dirty}>
            {saving ? "Saving…" : "Save SEO, social, guide and FAQs"}
          </button>
        }
      />
      <form className="admin-content admin-root-seo" onSubmit={(event) => void save(event)}>
        {error && <div className="admin-notice admin-notice-error" role="alert"><p>{error}</p></div>}
        {message && <div className="admin-notice"><p>{message}</p></div>}

        <section className="admin-panel admin-form-card">
          <div className="admin-section-heading">
            <div>
              <h3>Search and page copy</h3>
              <p>The heading is the public H1. Title and description appear in search results. Leave a field blank to use the default.</p>
            </div>
            <span className="admin-root-seo-path">{publicPath}</span>
          </div>
          <div className="admin-form-grid">
            {isSub && (
              <label className="wide">
                Intro text
                <textarea
                  value={lead}
                  onChange={(event) => setField("lead", event.target.value)}
                  placeholder="A short introduction shown under the page heading."
                  rows={3}
                  maxLength={1000}
                />
                <small>Shown under the H1 on this sub-category page and used as the meta description when that is blank. Blank uses an automatic summary of the range.</small>
              </label>
            )}
            <label>
              Page heading
              <input value={pageHeading} onChange={(event) => setField("pageHeading", event.target.value)} placeholder={headingFallback} maxLength={180} />
              <small>Shown as the H1. Blank uses “{headingFallback}”.</small>
            </label>
            <label>
              SEO title
              <input
                value={seoTitle}
                onChange={(event) => setField("seoTitle", forSearchMetadataInput(event.target.value))}
                onBlur={(event) => setField("seoTitle", forSearchMetadata(event.target.value))}
                placeholder={titleFallback}
                maxLength={180}
              />
              <small>Browser tab and Google title. Do not use ™ or ®.</small>
              <CharacterCount value={seoTitle} recommend={TITLE_RECOMMENDED} />
            </label>
            <label className="wide">
              Meta description
              <textarea
                value={seoDescription}
                onChange={(event) => setField("seoDescription", forSearchMetadataInput(event.target.value))}
                onBlur={(event) => setField("seoDescription", forSearchMetadata(event.target.value))}
                placeholder={descriptionFallback}
                rows={3}
                maxLength={2000}
              />
              <small>Plain text only — no ™ or ®. Blank uses the category lead copy.</small>
              <CharacterCount value={seoDescription} recommend={DESCRIPTION_RECOMMENDED} />
            </label>
          </div>
          <div className="admin-root-seo-preview" aria-live="polite">
            <p>Search preview</p>
            <strong>{previewTitle}</strong>
            <span>ihseeds.com.au{publicPath}</span>
            <em>{previewDescription}</em>
          </div>
        </section>

        <section className="admin-panel admin-form-card">
          <div className="admin-section-heading">
            <div>
              <h3>Social sharing</h3>
              <p>How this page looks as a link card on Facebook, LinkedIn, X and messaging apps. Leave a field blank to use the search copy above.</p>
            </div>
            <span className="admin-root-seo-path">{publicPath}</span>
          </div>
          <div className="admin-form-grid">
            <label className="wide">
              Social sharing title
              <input
                value={socialTitle}
                onChange={(event) => setField("socialTitle", forSearchMetadataInput(event.target.value))}
                onBlur={(event) => setField("socialTitle", forSearchMetadata(event.target.value))}
                placeholder={socialTitlePlaceholder}
                maxLength={180}
              />
              <small>Optional. Uses the SEO title when left blank. Do not use ™ or ®.</small>
            </label>
            <label className="wide">
              Social sharing description
              <textarea
                value={socialDescription}
                onChange={(event) => setField("socialDescription", forSearchMetadataInput(event.target.value))}
                onBlur={(event) => setField("socialDescription", forSearchMetadata(event.target.value))}
                placeholder={socialDescriptionPlaceholder}
                rows={3}
                maxLength={2000}
              />
              <small>Optional. Uses the meta description when left blank.</small>
            </label>
            <label className="wide">
              Social sharing image
              <input
                type="url"
                value={socialImage}
                onChange={(event) => setField("socialImage", event.target.value)}
                placeholder="https://example.com/social-image.jpg"
                maxLength={500}
              />
              <small>Optional. A full https:// address or a site path starting with /. About 1200 × 630 pixels works best.</small>
            </label>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <SocialImagePreview kind="category" override={socialImage} />
            {socialImage.trim() && (
              <div><button type="button" className="admin-button ghost" onClick={() => setField("socialImage", "")}>Clear custom image</button></div>
            )}
          </div>
        </section>

        <section className="admin-panel admin-form-card">
          <div className="admin-section-heading">
            <div>
              <h3>Buying guide</h3>
              <p>Optional advice shown on the public category page under “Choosing {(isSub ? headingFallback : category.name).toLowerCase()}”, above the FAQs. The facts table beside it (rainfall, soil, sowing rates and so on) is built automatically from the products in this {isSub ? "sub-category" : "category"}, so only write the expertise here: how to choose between lines, when to sow, what to avoid.</p>
            </div>
            <span className="admin-root-seo-path">{publicPath}</span>
          </div>
          <div className="admin-form-grid">
            <label className="wide">
              Buying guide text
              <textarea
                value={buyingGuide}
                onChange={(event) => setField("buyingGuide", event.target.value)}
                rows={10}
                maxLength={6000}
                placeholder={"Start a new paragraph by leaving a blank line.\n\nPlain text only."}
              />
              <small>Leave a blank line between paragraphs. Plain text only. Blank hides the guide and shows just the automatic facts.</small>
              <CharacterCount value={buyingGuide} recommend={1500} />
            </label>
          </div>
        </section>

        <section className="admin-panel admin-form-card">
          <div className="admin-section-heading">
            <div>
              <h3>General FAQs</h3>
              <p>Shown on the public category page when both question and answer are filled. Up to {ROOT_FAQ_LIMIT}.</p>
            </div>
            <span className="admin-root-seo-count">{filledFaqCount} of {ROOT_FAQ_LIMIT} ready</span>
          </div>
          <div className="admin-root-faq-list">
            {faqs.map((faq, index) => (
              <div className="admin-root-faq-card" key={index}>
                <div className="admin-root-faq-card-head">
                  <strong>FAQ {index + 1}</strong>
                  <button type="button" className="admin-text-button" onClick={() => removeFaq(index)} disabled={faqs.length === 1 && !faq.question && !faq.answer}>
                    Remove
                  </button>
                </div>
                <label>
                  Question
                  <input
                    value={faq.question}
                    onChange={(event) => updateFaq(index, { question: event.target.value })}
                    placeholder={`e.g. When should I sow ${category.name.toLowerCase()}?`}
                    maxLength={200}
                    aria-label={`FAQ ${index + 1} question`}
                  />
                </label>
                <label>
                  Answer
                  <textarea
                    value={faq.answer}
                    onChange={(event) => updateFaq(index, { answer: event.target.value })}
                    placeholder="Short answer shown on the public category page."
                    rows={3}
                    maxLength={2000}
                    aria-label={`FAQ ${index + 1} answer`}
                  />
                </label>
              </div>
            ))}
          </div>
          {faqs.length < ROOT_FAQ_LIMIT ? (
            <button type="button" className="admin-button outline" onClick={addFaq}>Add another FAQ</button>
          ) : (
            <p className="admin-field-hint">Ten FAQs is the limit for a category page.</p>
          )}
        </section>
      </form>
    </>
  );
}

export default function AdminRootCategories() {
  const { slug } = useParams();
  const routeId = Number(slug);
  const [importOpen, setImportOpen] = useState(false);
  const { data: categories = [], isLoading, error: loadError, refetch } = useListAdminCategories();
  const roots = useMemo(
    () => categories.filter((category) => category.parentId === null).sort((left, right) => left.sortOrder - right.sortOrder),
    [categories],
  );
  const subsByRoot = useMemo(() => {
    const map = new Map<number, CatalogueCategory[]>();
    for (const category of categories) {
      if (category.parentId === null) continue;
      map.set(category.parentId, [...(map.get(category.parentId) ?? []), category]);
    }
    for (const list of map.values()) list.sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name));
    return map;
  }, [categories]);
  const editing = Number.isInteger(routeId) && routeId > 0
    ? categories.find((category) => category.id === routeId)
    : undefined;
  const editingRoot = editing?.parentId != null
    ? categories.find((category) => category.id === editing.parentId)
    : undefined;

  if (isLoading) {
    return <div className="admin-content"><div className="admin-empty">Loading categories…</div></div>;
  }
  if (loadError) {
    return (
      <div className="admin-content">
        <div className="admin-empty">
          <strong>Categories could not be loaded.</strong>
          <button type="button" className="admin-button primary" onClick={() => refetch()}>Try again</button>
        </div>
      </div>
    );
  }
  if (Number.isInteger(routeId) && routeId > 0) {
    if (!editing) {
      return (
        <div className="admin-content">
          <div className="admin-empty">
            <strong>That category was not found.</strong>
            <button type="button" className="admin-button primary" onClick={() => navigate("/admin/site-settings/categories")}>Back to categories</button>
          </div>
        </div>
      );
    }
    return <RootCategoryEditor key={editing.id} category={editing} root={editingRoot} />;
  }

  return (
    <>
      <PageHeader
        eyebrow="Site settings"
        title={<>Category <strong>pages</strong></>}
        onBack={() => navigate("/admin/site-settings")}
        action={(
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button className="admin-button outline" type="button" onClick={() => { window.location.href = "/api/admin/categories/faqs/export"; }} data-testid="category-faq-export-btn">Export Categories</button>
            <button className="admin-button outline" type="button" onClick={() => setImportOpen(true)} data-testid="category-faq-import-btn">Import Categories</button>
          </div>
        )}
      />
      <div className="admin-content">
        <div className="admin-notice">
          <Icon name="info" size={20} />
          <p>Edit search titles, page headings, social sharing, the buying guide and FAQs here for each root category and for each sub-category, which has its own page at /products/category/sub-category (the buying guide is edited on each category's page only, not in the Export/Import file). Export Categories gives you every root category and sub-category with its current page heading, SEO title, meta description, social sharing fields, questions and answers, plus a Column guide that explains the file. Edit it, then use Import Categories. Names, URLs and the sub-category list stay in Products &amp; mixes.</p>
        </div>
        <div className="admin-root-category-list">
          {roots.map((root) => {
            const faqCount = (root.faqs ?? []).filter((item) => item.question.trim() && item.answer.trim()).length;
            const listing = seoStatus(root);
            return (
              <div key={root.id}>
                <div className="admin-root-category-row">
                  <div className="admin-root-category-copy">
                    <strong>{root.name}</strong>
                    <span>/products/{root.slug}</span>
                  </div>
                  <div className="admin-root-category-meta">
                    <span className={`status-pill${listing === "Custom listing" ? " admin-root-seo-ready" : ""}`}>{listing}</span>
                    <span className="admin-root-category-faq">{faqCount} FAQ{faqCount === 1 ? "" : "s"}</span>
                    {!root.active && <span className="status-pill">Inactive</span>}
                  </div>
                  <button className="admin-button outline small" type="button" onClick={() => navigate(`/admin/site-settings/categories/${root.id}`)}>
                    Edit
                  </button>
                </div>
                {(subsByRoot.get(root.id) ?? []).map((sub) => {
                  const subFaqCount = (sub.faqs ?? []).filter((item) => item.question.trim() && item.answer.trim()).length;
                  const subListing = [sub.lead, sub.pageHeading, sub.seoTitle, sub.seoDescription, sub.buyingGuide]
                    .some((value) => Boolean(value?.trim())) ? "Custom listing" : "Using defaults";
                  return (
                    <div className="admin-root-category-row" key={sub.id} style={{ marginLeft: 28 }}>
                      <div className="admin-root-category-copy">
                        <strong>{sub.name}</strong>
                        <span>/products/{root.slug}/{sub.slug}</span>
                      </div>
                      <div className="admin-root-category-meta">
                        <span className={`status-pill${subListing === "Custom listing" ? " admin-root-seo-ready" : ""}`}>{subListing}</span>
                        <span className="admin-root-category-faq">{subFaqCount} FAQ{subFaqCount === 1 ? "" : "s"}</span>
                        {!sub.active && <span className="status-pill">Inactive</span>}
                      </div>
                      <button className="admin-button outline small" type="button" onClick={() => navigate(`/admin/site-settings/categories/${sub.id}`)}>
                        Edit
                      </button>
                    </div>
                  );
                })}
              </div>
            );
          })}
          {roots.length === 0 && <div className="admin-empty">No root categories yet.</div>}
        </div>
      </div>
      <FaqImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </>
  );
}
