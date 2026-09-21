import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getListAdminProductsQueryKey, useListAdminProducts } from "@workspace/api-client-react";
import { Icon } from "../components/ui";
import { ConfirmDialog, PageHeader } from "./Admin";
import { downloadImageListCsv, productListingState } from "../image-list-csv";
import { matchUploadToProduct } from "../match-upload-product";
import { imageUsageLine, type ImageUsageSummary } from "../image-usage-line";
import { photoDisplaySrc, uploadMediaAsset, type UploadedMediaPhoto, type UploadMediaProgress } from "../upload-image";
import { runUploadBatch, successfulUploadValues } from "../upload-batch";
import { uploadCancelCopy } from "../upload-cancel-copy";
import "../admin-images.css";

type MediaAsset = {
  id: string;
  originalFilename: string;
  bytes: number | null;
  width: number | null;
  height: number | null;
  defaultAlt: string;
  defaultCaption: string;
  previewURL: string | null;
  usageSummary: ImageUsageSummary;
  createdAt: string;
};

type MatchRow = {
  assetId: string;
  filename: string;
  productId: string;
  unsure: boolean;
  error: string;
};

type MediaPage = {
  items: MediaAsset[];
  nextCursor: string | null;
};

type PendingUploadCancel = {
  assetIds: string[];
  filenames: string[];
};

type UploadQueueItem = {
  id: string;
  file: File;
  filename: string;
  status: "queued" | "requesting" | "uploading" | "processing" | "complete" | "failed";
  percent: number;
  error: string;
  photo?: UploadedMediaPhoto;
};

function assignedProductNames(products: { name?: string; details?: { photos?: Array<{ assetId?: string | null }> } }[], assetId: string) {
  const names: string[] = [];
  for (const product of products) {
    const name = product.name?.trim();
    if (!name) continue;
    const usesAsset = (product.details?.photos ?? []).some((photo) => photo.assetId?.trim() === assetId);
    if (usesAsset && !names.includes(name)) names.push(name);
  }
  return names;
}

async function deleteUnusedAsset(assetId: string) {
  const response = await fetch(`/api/admin/media/${assetId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirm: true }),
  });
  if (response.status === 404) return;
  if (response.status === 409) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? "This image is still in use.");
  }
  if (!response.ok && response.status !== 204) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? "Could not delete that image.");
  }
}

export default function AdminImages() {
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { data: products = [], isLoading: loadingProducts } = useListAdminProducts();
  const [items, setItems] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [alt, setAlt] = useState("");
  const [caption, setCaption] = useState("");
  const [matchRows, setMatchRows] = useState<MatchRow[] | null>(null);
  const [pendingCancel, setPendingCancel] = useState<PendingUploadCancel | null>(null);
  const [preview, setPreview] = useState<{ assetId: string; filename: string } | null>(null);
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[] | null>(null);
  const [uploadFinished, setUploadFinished] = useState(false);

  const exportRows = useMemo(
    () => [...products].sort((first, second) => (first.name ?? "").localeCompare(second.name ?? "", undefined, { numeric: true, sensitivity: "base" }) || second.id - first.id),
    [products],
  );

  const matchProducts = useMemo(
    () => exportRows.filter((product) => product.lifecycleStatus !== "Archived"),
    [exportRows],
  );

  const refresh = async () => {
    const response = await fetch("/api/admin/media?limit=100");
    const body = await response.json().catch(() => null) as MediaPage | { error?: string } | null;
    if (!response.ok) throw new Error((body as { error?: string })?.error ?? "Could not load images.");
    setItems((body as MediaPage).items ?? []);
  };

  useEffect(() => {
    refresh().catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load images.")).finally(() => setLoading(false));
  }, []);

  const uploadFiles = async (files: FileList | File[]) => {
    const selected = [...files];
    const queue = selected.map((file, index): UploadQueueItem => {
      const supported = /image\/(jpeg|png|webp)/.test(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name);
      return {
        id: `${Date.now()}-${index}-${file.name}`,
        file,
        filename: file.name,
        status: supported ? "queued" : "failed",
        percent: 0,
        error: supported ? "" : "Use a JPEG, PNG, or WebP image.",
      };
    });
    const valid = queue.filter((item) => item.status === "queued");
    setUploadQueue(queue);
    setUploadFinished(valid.length === 0);
    setBusy(true);
    setError("");
    if (!valid.length) {
      setBusy(false);
      return;
    }
    const updateItem = (id: string, changes: Partial<UploadQueueItem>) => {
      setUploadQueue((current) => current?.map((item) => item.id === id ? { ...item, ...changes } : item) ?? null);
    };
    await runUploadBatch(
      valid,
      async (item) => {
        const photo = await uploadMediaAsset(item.file, {
          onProgress: (progress: UploadMediaProgress) => updateItem(item.id, {
            status: progress.stage,
            percent: progress.percent,
          }),
        });
        return photo;
      },
      {
        concurrency: 3,
        onSettled: (result) => {
          if (result.status === "fulfilled") {
            updateItem(result.item.id, { status: "complete", percent: 100, photo: result.value });
          } else {
            updateItem(result.item.id, {
              status: "failed",
              error: result.reason instanceof Error ? result.reason.message : "Could not upload this image.",
            });
          }
        },
      },
    );
    try {
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Uploads finished, but the image library could not refresh.");
    } finally {
      setBusy(false);
      setUploadFinished(true);
    }
  };

  const closeUploadQueue = () => {
    if (!uploadFinished || !uploadQueue) return;
    const uploaded = successfulUploadValues(uploadQueue.map((item) => ({
      status: item.status,
      value: item.photo ? { photo: item.photo, filename: item.filename } : undefined,
    }))).map(({ photo, filename: selectedFilename }): MatchRow => {
      const filename = photo.file || selectedFilename;
      const guess = matchUploadToProduct(filename, matchProducts);
      return {
        assetId: photo.assetId,
        filename,
        productId: guess.productId,
        unsure: guess.unsure,
        error: "",
      };
    });
    setUploadQueue(null);
    setUploadFinished(false);
    if (uploaded.length) setMatchRows(uploaded);
  };

  const attachSelected = async () => {
    if (!matchRows?.some((row) => row.productId)) return;
    setBusy(true);
    setError("");
    const next = matchRows.map((row) => ({ ...row, error: "" }));
    let attached = 0;
    try {
      for (let index = 0; index < next.length; index += 1) {
        const row = next[index];
        if (!row.productId) continue;
        const response = await fetch(`/api/admin/media/${row.assetId}/attach`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId: Number(row.productId) }),
        });
        const body = await response.json().catch(() => null);
        if (!response.ok) {
          next[index] = { ...row, error: body?.error ?? "Could not attach that image." };
          continue;
        }
        attached += 1;
      }
      setMatchRows(next);
      await refresh();
      await queryClient.invalidateQueries({ queryKey: getListAdminProductsQueryKey() });
      if (next.every((row) => !row.productId || !row.error)) {
        if (attached) setMatchRows(null);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not attach those images.");
    } finally {
      setBusy(false);
    }
  };

  const saveMeta = async (asset: MediaAsset) => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/media/${asset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultAlt: alt, defaultCaption: caption }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error ?? "Could not save image details.");
      setEditingId(null);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save image details.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (asset: MediaAsset) => {
    if (asset.usageSummary.total > 0) return;
    if (!window.confirm(`Delete ${asset.originalFilename}? This cannot be undone.`)) return;
    setBusy(true);
    setError("");
    try {
      await deleteUnusedAsset(asset.id);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete that image.");
    } finally {
      setBusy(false);
    }
  };

  const confirmCancelUploads = async () => {
    if (!pendingCancel) return;
    setBusy(true);
    setError("");
    try {
      for (const assetId of pendingCancel.assetIds) {
        await deleteUnusedAsset(assetId);
      }
      const cancelled = new Set(pendingCancel.assetIds);
      setMatchRows((current) => {
        const remaining = current?.filter((row) => !cancelled.has(row.assetId)) ?? [];
        return remaining.length ? remaining : null;
      });
      setPendingCancel(null);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not cancel those uploads.");
    } finally {
      setBusy(false);
    }
  };

  const cancelCopy = pendingCancel ? uploadCancelCopy(pendingCancel.filenames) : null;

  return (
    <>
      <PageHeader
        eyebrow="Content"
        title={<>Images <strong>library</strong></>}
        action={
          <button
            className="admin-button outline"
            type="button"
            data-testid="export-image-list-btn"
            onClick={() => downloadImageListCsv(exportRows)}
            disabled={loadingProducts || exportRows.length === 0}
          >
            Export image list (CSV)
          </button>
        }
      />
      <div className="admin-content">
        <section className="admin-panel admin-form-card">
          <div className="admin-section-heading">
            <div>
              <h2>Shared photos</h2>
              <p className="admin-field-hint">Uploads are converted to WebP and stored with tech sheets. After upload, match files to a product to set the hero photo. External URL pastes stay outside this library.</p>
            </div>
          </div>
          <label className="admin-techsheet-drop">
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              disabled={busy}
              onChange={(event) => {
                if (event.target.files?.length) void uploadFiles(event.target.files);
                event.target.value = "";
              }}
            />
            <span>{busy ? "Uploads in progress…" : "Drop images or click to upload"}</span>
          </label>
          {error && <p className="admin-inline-field-error">{error}</p>}
        </section>
        {loading ? <p className="admin-empty">Loading images…</p> : (
          <div className="admin-image-grid">
            {items.length === 0 && <p className="admin-empty">No library images yet.</p>}
            {items.map((asset) => (
              <article className="admin-image-card" key={asset.id}>
                <div className="admin-image-thumb">
                  <img src={photoDisplaySrc({ assetId: asset.id })} alt={asset.defaultAlt || asset.originalFilename} />
                </div>
                <strong>{asset.originalFilename}</strong>
                <small>
                  {imageUsageLine(asset, assignedProductNames(products, asset.id))}
                </small>
                <p className={asset.defaultAlt.trim() ? "admin-image-alt" : "admin-image-alt is-missing"}>
                  {asset.defaultAlt.trim() ? `Alt: ${asset.defaultAlt}` : "No alt text"}
                </p>
                {asset.defaultCaption.trim() ? <p className="admin-image-caption">Caption: {asset.defaultCaption}</p> : null}
                {editingId === asset.id ? (
                  <div className="admin-image-meta">
                    <label>
                      Alt text
                      <input value={alt} onChange={(event) => setAlt(event.target.value)} placeholder="Default alt text" />
                    </label>
                    <label>
                      Caption
                      <input value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="Caption" />
                    </label>
                    <div className="admin-image-actions">
                      <button className="admin-button small" type="button" onClick={() => void saveMeta(asset)} disabled={busy}>Save</button>
                      <button className="admin-text-button" type="button" onClick={() => setEditingId(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="admin-image-actions">
                    <button
                      className="admin-text-button"
                      type="button"
                      onClick={() => {
                        setEditingId(asset.id);
                        setAlt(asset.defaultAlt);
                        setCaption(asset.defaultCaption);
                      }}
                    >
                      Edit alt
                    </button>
                    <button
                      className="admin-text-button"
                      type="button"
                      disabled={asset.usageSummary.total > 0 || busy}
                      onClick={() => void remove(asset)}
                    >
                      {asset.usageSummary.total > 0 ? "In use" : "Delete"}
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
      {uploadQueue && (
        <div className="admin-dialog-backdrop" role="presentation">
          <section
            className="admin-dialog admin-upload-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="upload-progress-title"
            aria-describedby="upload-progress-summary"
          >
            <div className="admin-image-match-header">
              <h2 id="upload-progress-title">{uploadFinished ? "Uploads finished" : "Uploading images"}</h2>
            </div>
            <p id="upload-progress-summary" aria-live="polite">
              {uploadQueue.filter((item) => item.status === "complete" || item.status === "failed").length} of {uploadQueue.length} complete
            </p>
            <div className="admin-upload-list">
              {uploadQueue.map((item) => (
                <div className={`admin-upload-row is-${item.status}`} key={item.id}>
                  <div className="admin-upload-copy">
                    <strong title={item.filename}>{item.filename}</strong>
                    <span>
                      {item.status === "queued" && "Waiting…"}
                      {item.status === "requesting" && "Preparing upload…"}
                      {item.status === "uploading" && `Uploading ${item.percent}%`}
                      {item.status === "processing" && "Converting to WebP…"}
                      {item.status === "complete" && "Uploaded"}
                      {item.status === "failed" && item.error}
                    </span>
                  </div>
                  <progress
                    aria-label={`Upload progress for ${item.filename}`}
                    max={100}
                    value={item.status === "processing" || item.status === "complete" ? 100 : item.percent}
                  />
                </div>
              ))}
            </div>
            <div className="admin-dialog-actions">
              <button className="admin-button primary" type="button" disabled={!uploadFinished} onClick={closeUploadQueue}>
                {uploadFinished ? "Continue" : "Uploading…"}
              </button>
            </div>
          </section>
        </div>
      )}
      {matchRows && (
        <div className="admin-dialog-backdrop" role="presentation">
          <section
            className="admin-dialog admin-image-match-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="match-images-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="admin-image-match-header">
              <h2 id="match-images-title">Match uploads to products</h2>
              <button
                type="button"
                className="admin-image-match-close"
                aria-label="Cancel uploads"
                data-testid="cancel-uploads-btn"
                disabled={busy}
                onClick={() => setPendingCancel({
                  assetIds: matchRows.map((row) => row.assetId),
                  filenames: matchRows.map((row) => row.filename),
                })}
              >
                <Icon name="close" size={20} />
              </button>
            </div>
            <p>The new photo becomes the hero. Existing photos move down. Click a thumbnail to inspect it. Skip keeps these files in the library without attaching them.</p>
            {error && <p className="admin-inline-field-error">{error}</p>}
            <div className="admin-image-match-list">
              {matchRows.map((row, index) => (
                <div className="admin-image-match-row" key={`${row.assetId}-${index}`}>
                  <div className="admin-image-match-file">
                    <button
                      type="button"
                      className="admin-image-thumb admin-image-match-preview-btn"
                      aria-label={`Preview ${row.filename}`}
                      onClick={() => setPreview({ assetId: row.assetId, filename: row.filename })}
                    >
                      <img src={photoDisplaySrc({ assetId: row.assetId })} alt="" />
                    </button>
                    <strong>{row.filename}</strong>
                  </div>
                  <label>
                    Product
                    <select
                      value={row.productId}
                      disabled={busy}
                      onChange={(event) => {
                        const productId = event.target.value;
                        setMatchRows((current) => current?.map((item, itemIndex) => itemIndex === index ? { ...item, productId, unsure: false, error: "" } : item) ?? null);
                      }}
                    >
                      <option value="">No product</option>
                      {matchProducts.map((product) => (
                        <option key={product.id} value={product.id}>{product.name} ({productListingState(product).toLowerCase()})</option>
                      ))}
                    </select>
                    {row.unsure && <p className="admin-image-match-unsure">Unsure</p>}
                  </label>
                  <button
                    type="button"
                    className="admin-image-match-cancel"
                    aria-label={`Cancel upload of ${row.filename}`}
                    data-testid="cancel-upload-row-btn"
                    disabled={busy}
                    onClick={() => setPendingCancel({ assetIds: [row.assetId], filenames: [row.filename] })}
                  >
                    <Icon name="close" size={16} />
                  </button>
                  {row.error && <p className="admin-inline-field-error">{row.error}</p>}
                </div>
              ))}
            </div>
            <div className="admin-dialog-actions">
              <button className="admin-button ghost" type="button" disabled={busy} onClick={() => setMatchRows(null)}>Skip matching</button>
              <button
                className="admin-button primary"
                type="button"
                disabled={busy || !matchRows.some((row) => row.productId)}
                onClick={() => void attachSelected()}
              >
                Attach selected
              </button>
            </div>
          </section>
        </div>
      )}
      {preview && (
        <div className="admin-dialog-backdrop admin-image-preview-backdrop" role="presentation" onMouseDown={() => setPreview(null)}>
          <section
            className="admin-dialog admin-image-preview-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="image-preview-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="admin-image-match-header">
              <h2 id="image-preview-title">{preview.filename}</h2>
              <button
                type="button"
                className="admin-image-match-close"
                aria-label="Close preview"
                onClick={() => setPreview(null)}
              >
                <Icon name="close" size={20} />
              </button>
            </div>
            <img src={photoDisplaySrc({ assetId: preview.assetId })} alt={preview.filename} />
          </section>
        </div>
      )}
      {cancelCopy && pendingCancel && (
        <ConfirmDialog
          title={cancelCopy.title}
          body={cancelCopy.body}
          confirmLabel={cancelCopy.confirmLabel}
          busyLabel="Deleting…"
          busy={busy}
          onCancel={() => !busy && setPendingCancel(null)}
          onConfirm={() => void confirmCancelUploads()}
        />
      )}
    </>
  );
}
