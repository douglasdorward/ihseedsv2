import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetAdminArticleQueryKey,
  getListAdminArticlesQueryKey,
  getListArticlesQueryKey,
  useCreateArticle,
  useDeleteArticle,
  useGetAdminArticle,
  useListAdminArticles,
  useListAdminProducts,
  usePublishArticle,
  useUnpublishArticle,
  useUpdateArticle,
  type Article,
  type ArticleInput,
} from "@workspace/api-client-react";
import { AlsoPopularPicker } from "../components/AlsoPopularPicker";
import { Icon } from "../components/ui";
import { isAlsoPopularEligible } from "../also-popular";
import { normalizeArticleBody } from "../article-body";
import { ArticleBodyEditor } from "../components/ArticleBodyEditor";
import { navigate, useLocation } from "../router";
import { photoDisplaySrc, uploadMediaAsset } from "../upload-image";
import { ConfirmDialog, PageHeader } from "./Admin";
import "../admin-blog.css";

const TAG_PRESETS = ["Editorial", "Sowing & Timing", "Feed Planning", "Regional Advice"];
const TITLE_RECOMMENDED = 60;
const DESCRIPTION_RECOMMENDED = 155;

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function forSearchMetadataInput(value: string) {
  return value.replace(/[™®]/g, "").replace(/\s{2,}/g, " ").replace(/\s+([,.;:!?])/g, "$1");
}

function forSearchMetadata(value: string) {
  return forSearchMetadataInput(value).trim();
}

function errorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "error" in error && typeof error.error === "string") return error.error;
  if (error instanceof Error) return error.message.replace(/^HTTP \d+ [^:]+:\s*/, "");
  return fallback;
}

function formatDate(value: string | null) {
  if (!value) return "Not published";
  return new Date(value).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
}

function CharacterCount({ value, recommend }: { value: string; recommend: number }) {
  const over = value.length > recommend;
  return (
    <small className={`admin-character-count${over ? " is-over" : ""}`}>
      {value.length} / {recommend} recommended
    </small>
  );
}

type ArticleForm = {
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  tags: string[];
  heroImageSrc: string;
  heroImageAssetId: string | null;
  relatedProductSlugs: string[];
  seoTitle: string;
  seoDescription: string;
  socialTitle: string;
  socialDescription: string;
  socialImage: string;
  robotsIndex: boolean;
};

const emptyForm: ArticleForm = {
  title: "",
  slug: "",
  excerpt: "",
  body: "",
  tags: [],
  heroImageSrc: "",
  heroImageAssetId: null,
  relatedProductSlugs: [],
  seoTitle: "",
  seoDescription: "",
  socialTitle: "",
  socialDescription: "",
  socialImage: "",
  robotsIndex: true,
};

function formFromArticle(article: Article): ArticleForm {
  return {
    title: article.title,
    slug: article.slug,
    excerpt: article.excerpt,
    body: normalizeArticleBody(article.body),
    tags: article.tags ?? [],
    heroImageSrc: article.heroImageSrc,
    heroImageAssetId: article.heroImageAssetId,
    relatedProductSlugs: article.relatedProductSlugs ?? [],
    seoTitle: article.seoTitle,
    seoDescription: article.seoDescription,
    socialTitle: article.socialTitle,
    socialDescription: article.socialDescription,
    socialImage: article.socialImage,
    robotsIndex: article.robotsIndex,
  };
}

function toInput(form: ArticleForm): ArticleInput {
  return {
    title: form.title.trim(),
    slug: form.slug.trim(),
    excerpt: form.excerpt.trim(),
    body: normalizeArticleBody(form.body),
    tags: form.tags,
    heroImageSrc: form.heroImageSrc.trim(),
    heroImageAssetId: form.heroImageAssetId,
    relatedProductSlugs: form.relatedProductSlugs,
    seoTitle: forSearchMetadata(form.seoTitle),
    seoDescription: forSearchMetadata(form.seoDescription),
    socialTitle: forSearchMetadata(form.socialTitle),
    socialDescription: forSearchMetadata(form.socialDescription),
    socialImage: form.socialImage.trim(),
    robotsIndex: form.robotsIndex,
  };
}

type LibraryAsset = {
  id: string;
  originalFilename: string;
  previewURL: string | null;
  defaultAlt: string;
};

function MediaPicker({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (asset: LibraryAsset) => void;
}) {
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

  if (!open) return null;
  return (
    <div className="admin-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="admin-dialog admin-blog-picker" role="dialog" aria-modal="true" aria-labelledby="blog-image-picker-title" onMouseDown={(event) => event.stopPropagation()}>
        <h2 id="blog-image-picker-title">Choose from Images library</h2>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search filenames" aria-label="Search images" />
        {error && <p className="admin-inline-field-error">{error}</p>}
        {loading ? <p className="admin-field-hint">Loading images…</p> : null}
        <div className="admin-blog-picker-grid">
          {items.map((item) => (
            <button type="button" key={item.id} className="admin-blog-picker-item" onClick={() => onSelect(item)}>
              <img src={photoDisplaySrc({ assetId: item.id })} alt={item.defaultAlt || item.originalFilename} />
              <span>{item.originalFilename}</span>
            </button>
          ))}
          {!loading && items.length === 0 && <p className="admin-empty">No library images match.</p>}
        </div>
        <div className="admin-dialog-actions">
          <button className="admin-button ghost" type="button" onClick={onClose}>Cancel</button>
        </div>
      </section>
    </div>
  );
}

function ArticleEditor({ articleId }: { articleId: number | "new" }) {
  const queryClient = useQueryClient();
  const isNew = articleId === "new";
  const { data: article, isLoading, error: loadError } = useGetAdminArticle(isNew ? 0 : articleId, {
    query: { enabled: !isNew, queryKey: getGetAdminArticleQueryKey(isNew ? 0 : articleId) },
  });
  const { data: products = [] } = useListAdminProducts();
  const createArticle = useCreateArticle();
  const updateArticle = useUpdateArticle();
  const publishArticle = usePublishArticle();
  const unpublishArticle = useUnpublishArticle();
  const deleteArticle = useDeleteArticle();
  const [form, setForm] = useState<ArticleForm>(emptyForm);
  const [slugLocked, setSlugLocked] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!article || isNew) return;
    setForm(formFromArticle(article));
    setSlugLocked(true);
  }, [article, isNew]);

  const eligible = useMemo(() => products.filter(isAlsoPopularEligible), [products]);
  const productsBySlug = useMemo(() => new Map(eligible.map((product) => [product.slug, product])), [eligible]);
  const heroSrc = photoDisplaySrc({ src: form.heroImageSrc, assetId: form.heroImageAssetId ?? undefined });

  const setField = <K extends keyof ArticleForm>(key: K, value: ArticleForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const refreshQueries = async (id?: number) => {
    await queryClient.invalidateQueries({ queryKey: getListAdminArticlesQueryKey() });
    await queryClient.invalidateQueries({ queryKey: getListArticlesQueryKey() });
    if (id) await queryClient.invalidateQueries({ queryKey: getGetAdminArticleQueryKey(id) });
  };

  const save = async () => {
    const payload = toInput(form);
    if (!payload.title || !payload.slug) throw new Error("Title and URL slug are required.");
    if (isNew) {
      const created = await createArticle.mutateAsync({ data: payload });
      await refreshQueries(created.id);
      navigate(`/admin/blog/${created.id}`, { replace: true });
      return created;
    }
    const updated = await updateArticle.mutateAsync({ id: articleId, data: payload });
    await refreshQueries(updated.id);
    return updated;
  };

  const handleSave = async (event?: FormEvent) => {
    event?.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await save();
      setMessage("Article saved. Drafts stay private until you publish.");
    } catch (caught) {
      setError(errorMessage(caught, "Could not save this article."));
    } finally {
      setBusy(false);
    }
  };

  const handlePublish = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const saved = await save();
      await publishArticle.mutateAsync({ id: saved.id });
      await refreshQueries(saved.id);
      setMessage("Article published. It appears on Resources immediately.");
    } catch (caught) {
      setError(errorMessage(caught, "Could not publish this article."));
    } finally {
      setBusy(false);
    }
  };

  const handleUnpublish = async () => {
    if (isNew) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await unpublishArticle.mutateAsync({ id: articleId });
      await refreshQueries(articleId);
      setMessage("Article unpublished. It is hidden from Resources.");
    } catch (caught) {
      setError(errorMessage(caught, "Could not unpublish this article."));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (isNew) {
      navigate("/admin/blog");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await deleteArticle.mutateAsync({ id: articleId });
      await refreshQueries();
      navigate("/admin/blog");
    } catch (caught) {
      setError(errorMessage(caught, "Could not delete this article."));
      setBusy(false);
    }
  };

  const uploadHero = async (file: File) => {
    setBusy(true);
    setError("");
    try {
      const uploaded = await uploadMediaAsset(file);
      setForm((current) => ({
        ...current,
        heroImageSrc: uploaded.src,
        heroImageAssetId: uploaded.assetId,
      }));
    } catch (caught) {
      setError(errorMessage(caught, "Could not upload that image."));
    } finally {
      setBusy(false);
    }
  };

  const toggleTag = (tag: string) => {
    setForm((current) => ({
      ...current,
      tags: current.tags.includes(tag) ? current.tags.filter((item) => item !== tag) : [...current.tags, tag].slice(0, 12),
    }));
  };

  if (!isNew && isLoading) return <p className="admin-empty">Loading article…</p>;
  if (!isNew && (loadError || !article)) return <p className="admin-empty">That article could not be loaded.</p>;

  const published = article?.publishStatus === "Published";
  const titleFallback = form.title.trim() ? `${form.title.trim()} | IH Seeds` : "Article title | IH Seeds";
  const descriptionFallback = form.excerpt.trim() || "Excerpt copy is used when this is blank.";
  const previewTitle = form.seoTitle.trim() || titleFallback;
  const previewDescription = form.seoDescription.trim() || descriptionFallback;
  const publicPath = `/resources/${form.slug || "article-slug"}`;

  return (
    <>
      <header className="admin-page-header" style={{ flexDirection: "column", alignItems: "stretch", gap: 16 }}>
        <button type="button" className="admin-back-link" onClick={() => navigate("/admin/blog")}>
          <Icon name="chevron-left" size={14} /> Articles
        </button>
        <div className="admin-blog-editor-head">
          <div>
            <p>Blog</p>
            <h1>{isNew ? <>New <strong>article</strong></> : <>{form.title || "Untitled article"}</>}</h1>
          </div>
          <div className="admin-header-actions">
            <span className={`status-pill${published ? " admin-blog-status-live" : ""}`}>{isNew ? "Draft" : published ? "Published" : "Draft"}</span>
            <button className="admin-button primary" type="button" onClick={() => void handleSave()} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
            <button className="admin-button outline" type="button" onClick={() => void handlePublish()} disabled={busy}>{published ? "Save & publish" : "Publish"}</button>
            {published && <button className="admin-button ghost" type="button" onClick={() => void handleUnpublish()} disabled={busy}>Unpublish</button>}
          </div>
        </div>
      </header>
      <form className="admin-content admin-blog-editor" onSubmit={handleSave}>
        {error && <div className="admin-notice admin-notice-error" role="alert"><p>{error}</p></div>}
        {message && <div className="admin-notice"><p>{message}</p></div>}

        <section className="admin-panel admin-form-card">
          <div className="admin-section-heading">
            <div>
              <h3>Article</h3>
              <p>The title is the public H1. Tags filter the Resources list. Excerpt appears on the card.</p>
            </div>
            <span className="admin-blog-path">{publicPath}</span>
          </div>
          <div className="admin-form-grid">
            <label>
              <span>Title<span className="required">*</span></span>
              <input
                value={form.title}
                onChange={(event) => {
                  const title = event.target.value;
                  setForm((current) => ({
                    ...current,
                    title,
                    slug: slugLocked ? current.slug : slugify(title),
                  }));
                }}
                placeholder="Autumn sowing window"
                maxLength={180}
              />
            </label>
            <label>
              <span>URL slug<span className="required">*</span></span>
              <input
                value={form.slug}
                onChange={(event) => {
                  setSlugLocked(true);
                  setField("slug", slugify(event.target.value));
                }}
                placeholder="autumn-sowing-window"
              />
              <small>Public page: ihseeds.com.au{publicPath}</small>
            </label>
            <label className="wide">
              <span>Excerpt<span className="required">*</span></span>
              <textarea rows={3} value={form.excerpt} onChange={(event) => setField("excerpt", event.target.value)} placeholder="One or two sentences for the Resources card." />
              <small>Shown on Resources cards and used as the search description if SEO description is blank.</small>
            </label>
          </div>
          <div className="admin-blog-tags">
            <p>Tags</p>
            <div className="admin-blog-tag-list">
              {[...new Set([...TAG_PRESETS, ...form.tags])].map((tag) => (
                <button type="button" key={tag} className={form.tags.includes(tag) ? "is-active" : ""} onClick={() => toggleTag(tag)}>{tag}</button>
              ))}
            </div>
            <div className="admin-blog-tag-add">
              <input name="custom-tag" maxLength={80} placeholder="Add a custom tag" onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                const tag = event.currentTarget.value.trim();
                if (!tag) return;
                toggleTag(tag);
                event.currentTarget.value = "";
              }} />
              <button className="admin-button outline small" type="button" onClick={(event) => {
                const input = event.currentTarget.previousElementSibling as HTMLInputElement | null;
                const tag = input?.value.trim();
                if (!tag) return;
                toggleTag(tag);
                if (input) input.value = "";
              }}>Add tag</button>
            </div>
          </div>
        </section>

        <section className="admin-panel admin-form-card">
          <div className="admin-section-heading">
            <div>
              <h3>Hero image</h3>
              <p>Shown at the top of the article and as the social image unless you set another URL in SEO.</p>
            </div>
          </div>
          <div className="admin-blog-hero" style={heroSrc ? { backgroundImage: `url(${heroSrc})` } : undefined}>
            {!heroSrc && (
              <div className="admin-blog-hero-empty">
                <Icon name="image" size={32} />
                <span>No image yet</span>
              </div>
            )}
          </div>
          <div className="admin-blog-hero-actions">
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void uploadHero(file);
            }} />
            <button className="admin-button outline small" type="button" onClick={() => fileRef.current?.click()} disabled={busy}>Upload image</button>
            <button className="admin-button ghost small" type="button" onClick={() => setPickerOpen(true)}>Choose from library</button>
            {(form.heroImageSrc || form.heroImageAssetId) && (
              <button className="admin-text-button danger" type="button" onClick={() => setForm((current) => ({ ...current, heroImageSrc: "", heroImageAssetId: null }))}>Remove</button>
            )}
          </div>
        </section>

        <section className="admin-panel admin-form-card">
          <div className="admin-section-heading">
            <div>
              <h3>Article body</h3>
              <p>Write as you would in a document. Highlight text to bold, italicise, add headings, lists or links. The title is already the page H1.</p>
            </div>
          </div>
          <ArticleBodyEditor value={form.body} onChange={(body) => setField("body", body)} />
        </section>

        <section className="admin-panel admin-form-card">
          <AlsoPopularPicker
            selectedSlugs={form.relatedProductSlugs}
            options={eligible}
            productsBySlug={productsBySlug}
            readOnly={false}
            onChange={(slugs) => setField("relatedProductSlugs", slugs)}
            heading="Linked products"
            hint="Choose up to three published Active or New products. They appear as cards at the end of the article."
            emptyLabel="No products linked. The article still publishes without them."
            addLabel="Add a linked product"
          />
        </section>

        <section className="admin-panel admin-form-card">
          <div className="admin-section-heading">
            <div>
              <h3>Search listing</h3>
              <p>Title and description appear in search results and the browser tab. Required before publishing. Do not use ™ or ®.</p>
            </div>
            <span className="admin-blog-path">{publicPath}</span>
          </div>
          <div className="admin-form-grid">
            <label className="wide">
              SEO title
              <input
                value={form.seoTitle}
                onChange={(event) => setField("seoTitle", forSearchMetadataInput(event.target.value))}
                onBlur={(event) => setField("seoTitle", forSearchMetadata(event.target.value))}
                placeholder={titleFallback}
                maxLength={180}
              />
              <small>Browser tab and Google title.</small>
              <CharacterCount value={form.seoTitle} recommend={TITLE_RECOMMENDED} />
            </label>
            <label className="wide">
              Meta description
              <textarea
                rows={3}
                value={form.seoDescription}
                onChange={(event) => setField("seoDescription", forSearchMetadataInput(event.target.value))}
                onBlur={(event) => setField("seoDescription", forSearchMetadata(event.target.value))}
                placeholder={descriptionFallback}
                maxLength={2000}
              />
              <small>Plain text only. Blank uses the excerpt.</small>
              <CharacterCount value={form.seoDescription} recommend={DESCRIPTION_RECOMMENDED} />
            </label>
          </div>
          <div className="admin-blog-seo-preview" aria-live="polite">
            <p>Search preview</p>
            <strong>{previewTitle}</strong>
            <span>ihseeds.com.au{publicPath}</span>
            <em>{previewDescription}</em>
          </div>
          <label className="admin-check-row admin-blog-robots">
            <input type="checkbox" checked={form.robotsIndex} onChange={(event) => setField("robotsIndex", event.target.checked)} />
            <span>
              <strong>Allow search engines to index this article</strong>
              <small>Turn this off to publish with a noindex directive.</small>
            </span>
          </label>
          <details className="admin-blog-social">
            <summary>Social sharing (optional)</summary>
            <p className="admin-field-hint">Used when the article is shared. Blank fields fall back to the search title, description, and hero image.</p>
            <label>Social sharing title
              <input value={form.socialTitle} onChange={(event) => setField("socialTitle", forSearchMetadataInput(event.target.value))} onBlur={(event) => setField("socialTitle", forSearchMetadata(event.target.value))} placeholder={previewTitle} />
            </label>
            <label>Social sharing description
              <textarea rows={3} value={form.socialDescription} onChange={(event) => setField("socialDescription", forSearchMetadataInput(event.target.value))} onBlur={(event) => setField("socialDescription", forSearchMetadata(event.target.value))} placeholder={previewDescription} />
            </label>
            <label>Social image URL
              <input value={form.socialImage} onChange={(event) => setField("socialImage", event.target.value)} placeholder="Uses the hero image when left blank" />
            </label>
          </details>
        </section>

        <div className="admin-blog-actions">
          <button className="admin-button outline admin-button-danger" type="button" onClick={() => setConfirmDelete(true)} disabled={busy}>Delete article</button>
        </div>
      </form>
      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(asset) => {
          setForm((current) => ({
            ...current,
            heroImageSrc: `/api/media/${asset.id}`,
            heroImageAssetId: asset.id,
          }));
          setPickerOpen(false);
        }}
      />
      {confirmDelete && (
        <ConfirmDialog
          title="Delete this article?"
          body="This removes the article from admin and the public Resources pages. This cannot be undone."
          confirmLabel="Delete article"
          busy={busy}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => { setConfirmDelete(false); void handleDelete(); }}
        />
      )}
    </>
  );
}

function ArticleList() {
  const { data: articles = [], isLoading, error } = useListAdminArticles();
  return (
    <>
      <PageHeader
        eyebrow="Blog"
        title={<>Articles &amp; <strong>publications</strong></>}
        action={<button className="admin-button primary" type="button" onClick={() => navigate("/admin/blog/new")}><Icon name="plus" size={18} />New article</button>}
      />
      <div className="admin-content">
        <div className="admin-notice">
          <Icon name="info" size={20} />
          <p>Drafts stay private. Publishing makes the article appear on Resources immediately. Saving a published article updates the public page on the next visit.</p>
        </div>
        {error && <div className="admin-notice" style={{ background: "#fef3f2", color: "#b42318" }}><p>{errorMessage(error, "Could not load articles.")}</p></div>}
        {isLoading ? <p className="admin-empty">Loading articles…</p> : null}
        {!isLoading && articles.length === 0 && <p className="admin-empty">No articles yet. Publish the first one to replace the placeholder Resources cards.</p>}
        {articles.length > 0 && (
          <div className="admin-table-card admin-blog-table">
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Tags</th>
                  <th>Status</th>
                  <th>Published</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {articles.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.title}</strong>
                      <small>/resources/{item.slug}</small>
                    </td>
                    <td>
                      {item.tags.length > 0 ? (
                        <div className="admin-blog-tag-pills">
                          {item.tags.map((tag) => <span key={tag}>{tag}</span>)}
                        </div>
                      ) : "—"}
                    </td>
                    <td><span className="status-pill">{item.publishStatus}</span></td>
                    <td className="admin-blog-date">{formatDate(item.publishedAt)}</td>
                    <td><button className="admin-button outline small" type="button" onClick={() => navigate(`/admin/blog/${item.id}`)}>Edit</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

export default function AdminBlog() {
  const [location] = useLocation();
  const route = location.split("?")[0];
  if (route === "/admin/blog/new") return <ArticleEditor articleId="new" />;
  const match = route.match(/^\/admin\/blog\/(\d+)$/);
  if (match) return <ArticleEditor articleId={Number(match[1])} />;
  return <ArticleList />;
}
