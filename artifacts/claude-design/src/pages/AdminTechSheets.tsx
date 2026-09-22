import { useEffect, useMemo, useState } from "react";
import { navigate } from "../router";
import { useListAdminProducts } from "@workspace/api-client-react";

type QueueItem = {
  id: number;
  filename: string;
  status: string;
  productId: number | null;
  fileUrl: string;
  warnings: string[];
  errorMessage: string;
  proposedPatch?: { suggestions?: unknown[]; scanned?: boolean } | null;
  createdAt: string;
};

const STATUS_LABEL: Record<string, string> = {
  uploaded: "Uploaded",
  extracting: "Extracting",
  ready: "Ready to review",
  "needs-match": "Needs a product",
  failed: "Failed",
};

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that PDF."));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

export default function AdminTechSheets() {
  const { data: products = [] } = useListAdminProducts();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [assigningId, setAssigningId] = useState<number | null>(null);
  const [assignProductId, setAssignProductId] = useState("");
  const [draftName, setDraftName] = useState("");
  const [draftSlug, setDraftSlug] = useState("");
  const [draftCategory, setDraftCategory] = useState("");
  const [draftRecordType, setDraftRecordType] = useState("Variety");

  const productsById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const categories = useMemo(
    () => [...new Set(products.map((product) => product.category).filter(Boolean))].sort(),
    [products],
  );

  const refresh = async () => {
    const response = await fetch("/api/admin/tech-sheets");
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.error ?? "Could not load uploads.");
    setItems(body as QueueItem[]);
  };

  useEffect(() => {
    refresh().catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load uploads.")).finally(() => setLoading(false));
  }, []);

  const uploadFiles = async (files: FileList | File[]) => {
    const list = [...files].filter((file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));
    if (!list.length) {
      setError("Upload PDF files only.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const payload = [];
      for (const file of list) {
        payload.push({ filename: file.name, data: await fileToBase64(file) });
      }
      const response = await fetch("/api/admin/tech-sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: payload }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error ?? "Upload failed.");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  };

  const assign = async (id: number) => {
    setBusy(true);
    setError("");
    try {
      const body = assignProductId
        ? { productId: Number(assignProductId) }
        : { createDraft: { name: draftName, slug: draftSlug, category: draftCategory, recordType: draftRecordType } };
      const response = await fetch(`/api/admin/tech-sheets/${id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error ?? "Could not assign that PDF.");
      setAssigningId(null);
      await refresh();
      if (payload?.productId) navigate(`/admin/products/${payload.productId}?aiItem=${id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not assign that PDF.");
    } finally {
      setBusy(false);
    }
  };

  const retry = async (id: number) => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/tech-sheets/${id}/extract`, { method: "POST" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error ?? "Retry failed.");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Retry failed.");
    } finally {
      setBusy(false);
    }
  };

  const discard = async (id: number) => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/tech-sheets/${id}`, { method: "DELETE" });
      if (!response.ok && response.status !== 204) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Could not discard that PDF.");
      }
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not discard that PDF.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <header className="admin-page-header">
        <div>
          <p>Content</p>
          <h1><strong>Uploads</strong></h1>
        </div>
      </header>
      <div className="admin-content">
        <section className="admin-panel admin-form-card">
          <div className="admin-section-heading">
            <div>
              <h2>PDF queue</h2>
              <p className="admin-field-hint">Drop documents here to inform product creation and our own tech sheets. Matched files open in the product editor for review. Unmatched files wait until you pick or create a Draft. AI never publishes.</p>
            </div>
          </div>
          <label className="admin-techsheet-drop">
            <input
              type="file"
              accept="application/pdf,.pdf"
              multiple
              disabled={busy}
              data-testid="tech-sheet-upload"
              onChange={(event) => {
                if (event.target.files?.length) void uploadFiles(event.target.files);
                event.target.value = "";
              }}
            />
            <span>{busy ? "Uploading and reading PDFs…" : "Drop PDFs or click to upload"}</span>
          </label>
          {error && <p className="admin-inline-field-error">{error}</p>}
        </section>
        <section className="admin-table-card">
          <table>
            <thead>
              <tr>
                <th>File</th>
                <th>Status</th>
                <th>Product</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={4} className="admin-empty">Loading queue…</td></tr>}
              {!loading && items.length === 0 && <tr><td colSpan={4} className="admin-empty">No uploads in the queue yet.</td></tr>}
              {items.map((item) => {
                const product = item.productId ? productsById.get(item.productId) : undefined;
                return (
                  <tr key={item.id}>
                    <td>
                      <a href={item.fileUrl} target="_blank" rel="noreferrer">{item.filename}</a>
                      {item.proposedPatch?.scanned && <small>Scanned or low-text PDF</small>}
                      {item.errorMessage && <small>{item.errorMessage}</small>}
                    </td>
                    <td><span className={`admin-listing-badge ${item.status === "ready" ? "active" : ""}`}>{STATUS_LABEL[item.status] ?? item.status}</span></td>
                    <td>{product ? product.name : "Unassigned"}</td>
                    <td>
                      <div className="admin-row-actions">
                        {item.status === "ready" && item.productId && (
                          <button type="button" className="admin-text-button" onClick={() => navigate(`/admin/products/${item.productId}?aiItem=${item.id}`)}>Open editor</button>
                        )}
                        {item.status === "needs-match" && (
                          <button type="button" className="admin-text-button" onClick={() => { setAssigningId(item.id); setAssignProductId(""); }}>Assign</button>
                        )}
                        {item.status === "failed" && (
                          <button type="button" className="admin-text-button" onClick={() => void retry(item.id)} disabled={busy}>Retry</button>
                        )}
                        <button type="button" className="admin-text-button" onClick={() => void discard(item.id)} disabled={busy}>Discard</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
        {assigningId !== null && (
          <div className="admin-dialog-backdrop" role="presentation" onMouseDown={() => !busy && setAssigningId(null)}>
            <section className="admin-dialog" role="dialog" aria-modal="true" aria-labelledby="assign-pdf-title" onMouseDown={(event) => event.stopPropagation()}>
              <h2 id="assign-pdf-title">Assign PDF</h2>
              <p>Match this file to an existing product, or create a Draft with only the identity fields.</p>
              <label>Existing product
                <select value={assignProductId} onChange={(event) => setAssignProductId(event.target.value)}>
                  <option value="">Create a new Draft</option>
                  {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
                </select>
              </label>
              {!assignProductId && (
                <div className="admin-form-grid">
                  <label>Product name<input value={draftName} onChange={(event) => setDraftName(event.target.value)} /></label>
                  <label>Slug<input value={draftSlug} onChange={(event) => setDraftSlug(event.target.value.toLowerCase())} /></label>
                  <label>Category
                    <input list="ai-draft-categories" value={draftCategory} onChange={(event) => setDraftCategory(event.target.value)} />
                    <datalist id="ai-draft-categories">{categories.map((category) => <option key={category} value={category} />)}</datalist>
                  </label>
                  <label>Record type
                    <select value={draftRecordType} onChange={(event) => setDraftRecordType(event.target.value)}>
                      <option>Mix</option>
                      <option>Variety</option>
                      <option>Commodity / generic</option>
                    </select>
                  </label>
                </div>
              )}
              <div className="admin-import-actions">
                <button className="admin-button ghost" type="button" onClick={() => setAssigningId(null)} disabled={busy}>Cancel</button>
                <button className="admin-button primary" type="button" onClick={() => void assign(assigningId)} disabled={busy}>Assign and extract</button>
              </div>
            </section>
          </div>
        )}
      </div>
    </>
  );
}
