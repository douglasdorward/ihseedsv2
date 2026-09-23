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

function snapshot(category: CatalogueCategory, pageHeading: string, seoTitle: string, seoDescription: string, faqs: CatalogueCategoryFaq[]) {
  return JSON.stringify({
    pageHeading: pageHeading.trim(),
    seoTitle: forSearchMetadata(seoTitle),
    seoDescription: forSearchMetadata(seoDescription),
    faqs: completeFaqs(faqs),
  });
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
      setError(errorMessage(caught, "Could not import those FAQs."));
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;
  return (
    <div className="admin-dialog-backdrop" role="presentation" onMouseDown={close}>
      <section className="admin-dialog admin-import-dialog" role="dialog" aria-modal="true" aria-labelledby="category-faq-import-title" onMouseDown={(event) => event.stopPropagation()}>
        <h2 id="category-faq-import-title">Import root category FAQs</h2>
        <p>Upload an Excel workbook with one FAQ per row on the FAQs sheet. The template lists every root category. A category is updated only when the file includes at least one complete question and answer for its slug, and those rows replace its FAQs. Blank starter rows are ignored.</p>
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
              <strong>{filename || "Workbook"}:</strong> {report.updated} categor{report.updated === 1 ? "y" : "ies"} updated, {report.skipped} blank rows skipped.
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

function RootCategoryEditor({ category }: { category: CatalogueCategory }) {
  const queryClient = useQueryClient();
  const updateCategory = useUpdateCategory();
  const [pageHeading, setPageHeading] = useState(category.pageHeading ?? "");
  const [seoTitle, setSeoTitle] = useState(category.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = useState(category.seoDescription ?? "");
  const [faqs, setFaqs] = useState<CatalogueCategoryFaq[]>(() => editorFaqSlots(category.faqs));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [savedJson, setSavedJson] = useState(() => snapshot(category, category.pageHeading ?? "", category.seoTitle ?? "", category.seoDescription ?? "", editorFaqSlots(category.faqs)));

  const headingFallback = `${category.name} Seed`;
  const titleFallback = `${category.name} Seed | IH Seeds`;
  const descriptionFallback = category.lead?.trim() || "Category lead copy is used when this is blank.";
  const previewTitle = seoTitle.trim() || titleFallback;
  const previewDescription = seoDescription.trim() || descriptionFallback;
  const filledFaqCount = completeFaqs(faqs).length;
  const dirty = snapshot(category, pageHeading, seoTitle, seoDescription, faqs) !== savedJson;

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
      await updateCategory.mutateAsync({
        id: category.id,
        data: {
          pageHeading: pageHeading.trim(),
          seoTitle: forSearchMetadata(seoTitle),
          seoDescription: forSearchMetadata(seoDescription),
          faqs: nextFaqs,
        },
      });
      await queryClient.invalidateQueries({ queryKey: getListAdminCategoriesQueryKey(), refetchType: "all" });
      await queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey(), refetchType: "all" });
      setFaqs(editorFaqSlots(nextFaqs));
      setSavedJson(snapshot(category, pageHeading, seoTitle, seoDescription, nextFaqs));
      setMessage("SEO and FAQs saved. They appear on the public category page immediately.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not save category SEO.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Root categories"
        title={<>{category.name} <strong>SEO</strong></>}
        onBack={() => navigate("/admin/site-settings/categories")}
        action={
          <button className="admin-button primary" type="button" onClick={() => void save()} disabled={saving || !dirty}>
            {saving ? "Saving…" : "Save SEO and FAQs"}
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
            <span className="admin-root-seo-path">/products/{category.slug}</span>
          </div>
          <div className="admin-form-grid">
            <label>
              Page heading
              <input value={pageHeading} onChange={(event) => setPageHeading(event.target.value)} placeholder={headingFallback} maxLength={180} />
              <small>Shown as the H1. Blank uses “{headingFallback}”.</small>
            </label>
            <label>
              SEO title
              <input
                value={seoTitle}
                onChange={(event) => setSeoTitle(forSearchMetadataInput(event.target.value))}
                onBlur={(event) => setSeoTitle(forSearchMetadata(event.target.value))}
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
                onChange={(event) => setSeoDescription(forSearchMetadataInput(event.target.value))}
                onBlur={(event) => setSeoDescription(forSearchMetadata(event.target.value))}
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
            <span>ihseeds.com.au/products/{category.slug}</span>
            <em>{previewDescription}</em>
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
            <p className="admin-field-hint">Ten FAQs is the limit for a root category.</p>
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
  const editing = Number.isInteger(routeId) && routeId > 0
    ? roots.find((category) => category.id === routeId)
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
            <strong>That root category was not found.</strong>
            <button type="button" className="admin-button primary" onClick={() => navigate("/admin/site-settings/categories")}>Back to root categories</button>
          </div>
        </div>
      );
    }
    return <RootCategoryEditor key={editing.id} category={editing} />;
  }

  return (
    <>
      <PageHeader
        eyebrow="Site settings"
        title={<>Root <strong>categories</strong></>}
        onBack={() => navigate("/admin/site-settings")}
        action={(
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button className="admin-button outline" type="button" onClick={() => { window.location.href = "/api/admin/categories/faqs/import/template"; }}>Download FAQ template</button>
            <button className="admin-button outline" type="button" onClick={() => setImportOpen(true)} data-testid="category-faq-import-btn">Import FAQs</button>
          </div>
        )}
      />
      <div className="admin-content">
        <div className="admin-notice">
          <Icon name="info" size={20} />
          <p>Edit search titles, page headings and FAQs here. Download the FAQ template to see every root category, then import completed questions and answers. Names, URLs and subcategories stay in Products &amp; mixes.</p>
        </div>
        <div className="admin-root-category-list">
          {roots.map((root) => {
            const faqCount = (root.faqs ?? []).filter((item) => item.question.trim() && item.answer.trim()).length;
            const listing = seoStatus(root);
            return (
              <div className="admin-root-category-row" key={root.id}>
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
            );
          })}
          {roots.length === 0 && <div className="admin-empty">No root categories yet.</div>}
        </div>
      </div>
      <FaqImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </>
  );
}
