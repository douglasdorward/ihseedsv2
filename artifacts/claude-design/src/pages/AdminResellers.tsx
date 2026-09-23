import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type RefObject } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetAdminResellerBrandQueryKey,
  getListAdminResellerBrandsQueryKey,
  useCommitResellerImport,
  useCreateResellerBrand,
  useCreateResellerOutlet,
  useDeleteResellerBrand,
  useDeleteResellerOutlet,
  useDryRunResellerImport,
  useGetAdminResellerBrand,
  useListAdminResellerBrands,
  useUpdateResellerBrand,
  useUpdateResellerOutlet,
  ResellerKind,
  type ResellerBrand,
  type ResellerBrandInput,
  type ResellerImportReport,
  type ResellerOutlet,
  type ResellerOutletInput,
} from "@workspace/api-client-react";
import { Icon } from "../components/ui";
import { navigate, useLocation } from "../router";
import { photoDisplaySrc, uploadMediaAsset } from "../upload-image";
import { ConfirmDialog, PageHeader } from "./Admin";
import "../admin-blog.css";
import "../admin-resellers.css";

const KIND_LABELS: Record<typeof ResellerKind[keyof typeof ResellerKind], string> = {
  elders: "Elders",
  nutrien: "Nutrien",
  independent: "Independent",
};

const CHAIN_DEFAULT_LOGOS: Partial<Record<BrandForm["kind"], string>> = {
  elders: "/elders-logo.webp",
  nutrien: "/nutrien-logo.webp",
};

function brandLogoDisplaySrc(src: string, kind: BrandForm["kind"]) {
  const resolved = src.trim() || CHAIN_DEFAULT_LOGOS[kind] || "";
  const filename = resolved.split("/").pop() ?? "";
  if (filename === "elders-logo.webp" || filename === "nutrien-logo.webp") {
    return `${import.meta.env.BASE_URL}${filename}`;
  }
  return resolved;
}

const REGION_PRESETS = [
  "Great Southern",
  "Esperance",
  "Wheatbelt",
  "South West",
  "Midwest",
  "Kimberley",
];

function errorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "error" in error && typeof error.error === "string") return error.error;
  if (error instanceof Error) return error.message.replace(/^HTTP \d+ [^:]+:\s*/, "");
  return fallback;
}

type BrandForm = {
  name: string;
  kind: typeof ResellerKind[keyof typeof ResellerKind];
  website: string;
  logoSrc: string;
  logoAssetId: string | null;
  active: boolean;
};

const emptyBrandForm: BrandForm = {
  name: "",
  kind: "independent",
  website: "",
  logoSrc: "",
  logoAssetId: null,
  active: true,
};

function formFromBrand(brand: ResellerBrand): BrandForm {
  return {
    name: brand.name,
    kind: brand.kind,
    website: brand.website,
    logoSrc: brand.logoSrc,
    logoAssetId: brand.logoAssetId,
    active: brand.active,
  };
}

function toBrandInput(form: BrandForm): ResellerBrandInput {
  return {
    name: form.name.trim(),
    kind: form.kind,
    website: form.website.trim(),
    logoSrc: form.logoSrc.trim(),
    logoAssetId: form.logoAssetId,
    active: form.active,
  };
}

type OutletForm = {
  name: string;
  address: string;
  suburb: string;
  postcode: string;
  region: string;
  phone: string;
  email: string;
  mapsUrl: string;
  coordinates: string;
  active: boolean;
};

const emptyOutletForm: OutletForm = {
  name: "",
  address: "",
  suburb: "",
  postcode: "",
  region: "",
  phone: "",
  email: "",
  mapsUrl: "",
  coordinates: "",
  active: true,
};

function formatCoordinates(latitude: number, longitude: number) {
  const format = (value: number) => String(Math.round(value * 1e6) / 1e6);
  return `${format(latitude)}, ${format(longitude)}`;
}

function coordinatesFromForm(raw: string) {
  const value = raw.trim();
  if (!value) return { latitude: null, longitude: null };
  const match = value.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

function formFromOutlet(outlet: ResellerOutlet): OutletForm {
  return {
    name: outlet.name,
    address: outlet.address,
    suburb: outlet.suburb,
    postcode: outlet.postcode,
    region: outlet.region,
    phone: outlet.phone,
    email: outlet.email,
    mapsUrl: outlet.mapsUrl,
    coordinates: outlet.latitude != null && outlet.longitude != null
      ? formatCoordinates(outlet.latitude, outlet.longitude)
      : "",
    active: outlet.active,
  };
}

function toOutletInput(form: OutletForm, coordinates: { latitude: number | null; longitude: number | null }): ResellerOutletInput {
  return {
    name: form.name.trim(),
    address: form.address.trim(),
    suburb: form.suburb.trim(),
    postcode: form.postcode.trim(),
    region: form.region.trim(),
    phone: form.phone.trim(),
    email: form.email.trim(),
    mapsUrl: form.mapsUrl.trim(),
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    active: form.active,
  };
}

type StoreRow = { brand: ResellerBrand; outlet: ResellerOutlet };

function flattenStores(brands: ResellerBrand[]): StoreRow[] {
  return brands
    .flatMap((brand) => brand.outlets.map((outlet) => ({ brand, outlet })))
    .sort((a, b) => {
      const branchCmp = a.outlet.name.localeCompare(b.outlet.name, "en-AU", { sensitivity: "base" });
      if (branchCmp !== 0) return branchCmp;
      return a.brand.name.localeCompare(b.brand.name, "en-AU", { sensitivity: "base" });
    });
}

function chainBrand(brands: ResellerBrand[], kind: "elders" | "nutrien") {
  return brands.find((brand) => brand.kind === kind);
}

function matchBrandName(brands: ResellerBrand[], name: string) {
  const needle = name.trim().toLowerCase();
  return brands.find((brand) => brand.name.trim().toLowerCase() === needle);
}

function brandFromChoice(choice: string, brands: ResellerBrand[]) {
  if (choice === "elders") return chainBrand(brands, "elders");
  if (choice === "nutrien") return chainBrand(brands, "nutrien");
  if (choice.startsWith("id:")) return brands.find((brand) => brand.id === Number(choice.slice(3)));
  return undefined;
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
      <section className="admin-dialog admin-blog-picker" role="dialog" aria-modal="true" aria-labelledby="reseller-image-picker-title" onMouseDown={(event) => event.stopPropagation()}>
        <h2 id="reseller-image-picker-title">Choose from Images library</h2>
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

function ImportDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const dryRun = useDryRunResellerImport();
  const commit = useCommitResellerImport();
  const [csvText, setCsvText] = useState("");
  const [filename, setFilename] = useState("");
  const [report, setReport] = useState<ResellerImportReport | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setCsvText("");
    setFilename("");
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
    setCsvText(await file.text());
    setReport(null);
    setError("");
  };

  const handleDryRun = async () => {
    setBusy(true);
    setError("");
    try {
      const next = await dryRun.mutateAsync({ data: { csvText } });
      setReport(next);
    } catch (caught) {
      setError(errorMessage(caught, "Could not validate that CSV."));
    } finally {
      setBusy(false);
    }
  };

  const handleCommit = async () => {
    if (!report) return;
    setBusy(true);
    setError("");
    try {
      await commit.mutateAsync({ data: { csvText, token: report.token } });
      await queryClient.invalidateQueries({ queryKey: getListAdminResellerBrandsQueryKey() });
      reset();
      onClose();
    } catch (caught) {
      setError(errorMessage(caught, "Could not import that CSV."));
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;
  return (
    <div className="admin-dialog-backdrop" role="presentation" onMouseDown={close}>
      <section className="admin-dialog" role="dialog" aria-modal="true" aria-labelledby="reseller-import-title" onMouseDown={(event) => event.stopPropagation()}>
        <h2 id="reseller-import-title">Import resellers</h2>
        <p>Upload a CSV with one row per store. Matching brand and store names update existing rows. Put latitude and longitude in <code>coordinates</code>, for example <code>-33.3512, 117.1234</code>. That is what Share location uses. <code>google_pin</code> stays the Maps link for directions. A blank coordinates cell clears stored coordinates. Logos are added in the store editor after import.</p>
        {!report ? (
          <div className="admin-import-file-row">
            <input type="file" accept=".csv,text/csv" data-testid="reseller-import-file" onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void handleFile(file);
            }} />
            <button className="admin-button outline small" type="button" onClick={() => { void handleDryRun(); }} disabled={!csvText || busy} data-testid="reseller-dry-run-btn">
              {busy ? "Checking…" : "Dry run import"}
            </button>
          </div>
        ) : (
          <div className="admin-import-report">
            <p>
              <strong>{filename || "CSV"}:</strong> {report.outletsCreated} new stores, {report.outletsUpdated} updates, {report.brandsCreated} new brands, {report.skipped} skipped.
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
          {report && report.issues.length === 0 && (
            <button className="admin-button primary" type="button" onClick={() => { void handleCommit(); }} disabled={busy} data-testid="reseller-commit-import-btn">
              {busy ? "Importing…" : "Confirm import"}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

function GooglePin({ url, name }: { url: string; name: string }) {
  const href = url.trim();
  if (!href) {
    return <span className="admin-reseller-pin is-empty" aria-label={`${name} has no Google pin yet`}><Icon name="map-pin" size={18} /></span>;
  }
  return (
    <a
      className="admin-reseller-pin"
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={`Open Google pin for ${name}`}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <Icon name="map-pin" size={18} />
    </a>
  );
}

function rowKey(row: StoreRow) {
  return `${row.brand.id}-${row.outlet.id}`;
}

function StoreList() {
  const queryClient = useQueryClient();
  const { data: brands = [], isLoading, error } = useListAdminResellerBrands();
  const deleteOutlet = useDeleteResellerOutlet();
  const deleteBrand = useDeleteResellerBrand();
  const [importOpen, setImportOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const selectAllRef = useRef<HTMLInputElement>(null);
  const stores = useMemo(() => flattenStores(brands), [brands]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const selectedRows = useMemo(() => stores.filter((row) => selectedSet.has(rowKey(row))), [stores, selectedSet]);
  const allSelected = stores.length > 0 && selectedRows.length === stores.length;

  useEffect(() => {
    const keys = new Set(stores.map(rowKey));
    setSelected((current) => {
      const next = current.filter((key) => keys.has(key));
      return next.length === current.length ? current : next;
    });
  }, [stores]);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = selectedRows.length > 0 && !allSelected;
    }
  }, [selectedRows.length, allSelected]);

  const openStore = (row: StoreRow) => navigate(`/admin/resellers/${row.brand.id}/${row.outlet.id}`);
  const onRowKey = (event: KeyboardEvent<HTMLTableRowElement>, row: StoreRow) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openStore(row);
    }
  };

  const toggleRow = (key: string) => {
    setSelected((current) => (current.includes(key) ? current.filter((id) => id !== key) : [...current, key]));
  };

  const handleBulkDelete = async () => {
    if (selectedRows.length === 0) return;
    setBusy(true);
    setDeleteError("");
    const deletedIds = new Map<number, Set<number>>();
    try {
      for (const row of selectedRows) {
        await deleteOutlet.mutateAsync({ brandId: row.brand.id, id: row.outlet.id });
        const ids = deletedIds.get(row.brand.id) ?? new Set<number>();
        ids.add(row.outlet.id);
        deletedIds.set(row.brand.id, ids);
      }
      for (const [brandId, outletIds] of deletedIds) {
        const brand = brands.find((item) => item.id === brandId);
        if (!brand || brand.kind !== "independent") continue;
        if (brand.outlets.every((outlet) => outletIds.has(outlet.id))) {
          await deleteBrand.mutateAsync({ id: brandId });
        }
      }
      await queryClient.invalidateQueries({ queryKey: getListAdminResellerBrandsQueryKey() });
      setSelected([]);
      setConfirmDelete(false);
    } catch (caught) {
      await queryClient.invalidateQueries({ queryKey: getListAdminResellerBrandsQueryKey() });
      const removed = new Set(
        [...deletedIds.entries()].flatMap(([brandId, ids]) => [...ids].map((id) => `${brandId}-${id}`)),
      );
      setSelected((current) => current.filter((key) => !removed.has(key)));
      setDeleteError(errorMessage(caught, "Could not delete the selected stores."));
      setConfirmDelete(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Resellers"
        title={<>Stores &amp; <strong>branches</strong></>}
        action={(
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button className="admin-button outline" type="button" onClick={() => { window.location.href = "/api/admin/resellers/import/template"; }}>Download template</button>
            <button className="admin-button outline" type="button" onClick={() => setImportOpen(true)} data-testid="reseller-import-btn">Import CSV</button>
            <button className="admin-button primary" type="button" onClick={() => navigate("/admin/resellers/new")} data-testid="reseller-new-store">
              <Icon name="plus" size={18} /> Add a store
            </button>
          </div>
        )}
      />
      <div className="admin-content">
        <div className="admin-notice">
          <Icon name="info" size={20} />
          <p>Listed stores appear in the Reseller near you section on the contact page. Select a row to edit it. Tick stores to delete them. Hidden stores stay in this list only.</p>
        </div>
        {error && <div className="admin-notice" style={{ background: "#fef3f2", color: "#b42318" }}><p>{errorMessage(error, "Could not load resellers.")}</p></div>}
        {deleteError && <div className="admin-notice" style={{ background: "#fef3f2", color: "#b42318" }}><p>{deleteError}</p></div>}
        {isLoading ? <p className="admin-empty">Loading stores…</p> : null}
        {!isLoading && stores.length === 0 && <p className="admin-empty">No stores yet. Add one, or import a CSV.</p>}
        {selectedRows.length > 0 && (
          <div className="admin-bulk-bar">
            <strong>{selectedRows.length} selected</strong>
            <button
              className="admin-button outline small admin-button-danger"
              type="button"
              disabled={busy}
              onClick={() => setConfirmDelete(true)}
              data-testid="reseller-delete-selected"
            >
              Delete selected
            </button>
            <button className="admin-text-button" type="button" disabled={busy} onClick={() => setSelected([])}>Clear</button>
          </div>
        )}
        {stores.length > 0 && (
          <div className="admin-table-card admin-reseller-table">
            <table>
              <thead>
                <tr>
                  <th aria-label="Select">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      checked={allSelected}
                      disabled={busy}
                      aria-label={allSelected ? "Clear store selection" : "Select all stores"}
                      onChange={() => setSelected(allSelected ? [] : stores.map(rowKey))}
                    />
                  </th>
                  <th>Brand</th>
                  <th>Name</th>
                  <th>Town</th>
                  <th>Region</th>
                  <th>Coordinates</th>
                  <th>Pin</th>
                </tr>
              </thead>
              <tbody>
                {stores.map((row) => {
                  const key = rowKey(row);
                  const brandLogo = brandLogoDisplaySrc(
                    photoDisplaySrc({ src: row.brand.logoSrc, assetId: row.brand.logoAssetId ?? undefined }),
                    row.brand.kind,
                  );
                  const hidden = !(row.brand.active && row.outlet.active);
                  return (
                  <tr
                    key={key}
                    className={[hidden ? "is-hidden" : "", selectedSet.has(key) ? "is-selected" : ""].filter(Boolean).join(" ") || undefined}
                    tabIndex={0}
                    role="link"
                    onClick={() => openStore(row)}
                    onKeyDown={(event) => onRowKey(event, row)}
                    data-testid={`reseller-store-row-${row.outlet.id}`}
                  >
                    <td
                      className="admin-reseller-select"
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selectedSet.has(key)}
                        disabled={busy}
                        aria-label={`Select ${row.brand.name} ${row.outlet.name}`}
                        onChange={() => toggleRow(key)}
                      />
                    </td>
                    <td>
                      <div className="admin-reseller-brand-cell">
                        <span
                          className="admin-reseller-brand-thumb"
                          style={brandLogo ? { backgroundImage: `url(${brandLogo})` } : undefined}
                          aria-hidden="true"
                        />
                        <span>
                          <strong>{row.brand.name}</strong>
                          <small>{KIND_LABELS[row.brand.kind]}</small>
                        </span>
                      </div>
                    </td>
                    <td>
                      <strong>{row.outlet.name}</strong>
                      {!(row.brand.active && row.outlet.active) && <small>Hidden</small>}
                    </td>
                    <td>{row.outlet.suburb || "—"}</td>
                    <td>{row.outlet.region || "—"}</td>
                    <td>{row.outlet.latitude != null && row.outlet.longitude != null ? formatCoordinates(row.outlet.latitude, row.outlet.longitude) : "—"}</td>
                    <td><GooglePin url={row.outlet.mapsUrl} name={`${row.brand.name} ${row.outlet.name}`} /></td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
      {confirmDelete && (
        <ConfirmDialog
          title={selectedRows.length === 1 ? "Delete this store?" : `Delete ${selectedRows.length} stores?`}
          body="This removes the selected stores from admin and the public contact page. This cannot be undone."
          confirmLabel={selectedRows.length === 1 ? "Delete store" : "Delete stores"}
          busyLabel="Deleting…"
          busy={busy}
          onCancel={() => { if (!busy) setConfirmDelete(false); }}
          onConfirm={() => { void handleBulkDelete(); }}
        />
      )}
    </>
  );
}

function BrandFields({
  form,
  setForm,
  showType,
  fileRef,
  busy,
  onPickLibrary,
  onLogoChange,
}: {
  form: BrandForm;
  setForm: (next: BrandForm | ((current: BrandForm) => BrandForm)) => void;
  showType?: boolean;
  fileRef: RefObject<HTMLInputElement | null>;
  busy: boolean;
  onPickLibrary: () => void;
  onLogoChange?: (next: Pick<BrandForm, "logoSrc" | "logoAssetId">) => void;
}) {
  const logoSrc = brandLogoDisplaySrc(
    photoDisplaySrc({ src: form.logoSrc, assetId: form.logoAssetId ?? undefined }),
    form.kind,
  );
  const applyLogo = (nextLogoSrc: string, nextLogoAssetId: string | null) => {
    setForm((current) => ({ ...current, logoSrc: nextLogoSrc, logoAssetId: nextLogoAssetId }));
    onLogoChange?.({ logoSrc: nextLogoSrc, logoAssetId: nextLogoAssetId });
  };
  const uploadLogo = async (file: File) => {
    const uploaded = await uploadMediaAsset(file);
    applyLogo(uploaded.src, uploaded.assetId);
  };

  return (
    <>
      <label>Website
        <input type="url" maxLength={500} placeholder="https://" value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} />
      </label>
      {showType && (
        <label>Type
          <select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value as BrandForm["kind"] })} data-testid="reseller-brand-kind">
            <option value="elders">Elders</option>
            <option value="nutrien">Nutrien</option>
            <option value="independent">Independent</option>
          </select>
        </label>
      )}
      <div className="admin-section-heading">
        <div>
          <h3>Logo</h3>
          <p>Upload once for this brand. Every store under it uses the same logo on the contact page.</p>
        </div>
      </div>
      <div className="admin-reseller-logo" style={logoSrc ? { backgroundImage: `url(${logoSrc})` } : undefined}>
        {!logoSrc && (
          <div className="admin-blog-hero-empty">
            <Icon name="image" size={32} />
            <span>No logo yet</span>
          </div>
        )}
      </div>
      <div className="admin-blog-hero-actions">
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void uploadLogo(file).catch(() => undefined);
        }} />
        <button className="admin-button outline small" type="button" onClick={() => fileRef.current?.click()} disabled={busy}>Upload image</button>
        <button className="admin-button ghost small" type="button" onClick={onPickLibrary}>Choose from library</button>
        {(form.logoSrc || form.logoAssetId) && (
          <button className="admin-text-button danger" type="button" onClick={() => applyLogo("", null)}>Remove</button>
        )}
      </div>
    </>
  );
}

function StoreFields({
  form,
  setForm,
}: {
  form: OutletForm;
  setForm: (next: OutletForm) => void;
}) {
  return (
    <>
      <label>Name
        <input required maxLength={120} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} data-testid="reseller-outlet-name" />
      </label>
      <label>Town
        <input maxLength={120} value={form.suburb} onChange={(event) => setForm({ ...form, suburb: event.target.value })} data-testid="reseller-outlet-town" />
      </label>
      <label>Region
        <input maxLength={80} list="reseller-region-presets" value={form.region} onChange={(event) => setForm({ ...form, region: event.target.value })} />
      </label>
      <datalist id="reseller-region-presets">
        {REGION_PRESETS.map((region) => <option key={region} value={region} />)}
      </datalist>
      <label>Google pin
        <input type="url" maxLength={1000} placeholder="https://maps.app.goo.gl/…" value={form.mapsUrl} onChange={(event) => setForm({ ...form, mapsUrl: event.target.value })} data-testid="reseller-outlet-pin" />
        <small>Paste a Google Maps share link. This opens directions. It does not sort the near-you list.</small>
      </label>
      <label>Coordinates
        <input placeholder="-33.3512, 117.1234" value={form.coordinates} onChange={(event) => setForm({ ...form, coordinates: event.target.value })} data-testid="reseller-outlet-coordinates" />
        <small>Latitude, longitude. Share location uses these to sort stores.</small>
      </label>
      <label>Address
        <input maxLength={300} value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
      </label>
      <div className="admin-form-row">
        <label>Postcode
          <input maxLength={12} value={form.postcode} onChange={(event) => setForm({ ...form, postcode: event.target.value })} />
        </label>
        <label>Phone
          <input maxLength={80} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
        </label>
      </div>
      <label>Email
        <input type="email" maxLength={180} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
      </label>
      <label className="admin-check-row">
        <input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} />
        <span>
          <strong>Listed on the public contact page</strong>
          <small>Turn this off to keep the store in admin only.</small>
        </span>
      </label>
    </>
  );
}

function StoreEditor({ brandId, outletId }: { brandId: number | "new"; outletId: number | "new" }) {
  const queryClient = useQueryClient();
  const isNew = brandId === "new" || outletId === "new";
  const { data: brands = [] } = useListAdminResellerBrands();
  const { data: brand, isLoading, error: loadError } = useGetAdminResellerBrand(isNew ? 0 : brandId, {
    query: { enabled: !isNew, queryKey: getGetAdminResellerBrandQueryKey(isNew ? 0 : brandId) },
  });
  const createBrand = useCreateResellerBrand();
  const updateBrand = useUpdateResellerBrand();
  const createOutlet = useCreateResellerOutlet();
  const updateOutlet = useUpdateResellerOutlet();
  const deleteOutlet = useDeleteResellerOutlet();
  const deleteBrand = useDeleteResellerBrand();
  const [brandChoice, setBrandChoice] = useState("elders");
  const [newBrandName, setNewBrandName] = useState("");
  const [newBrandKind, setNewBrandKind] = useState<BrandForm["kind"]>("independent");
  const [brandForm, setBrandForm] = useState<BrandForm>(emptyBrandForm);
  const [outletForm, setOutletForm] = useState<OutletForm>(emptyOutletForm);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const logoTouched = useRef(false);

  const outlet = brand?.outlets.find((item) => item.id === outletId);

  useEffect(() => {
    if (!brand || isNew) return;
    setBrandForm(formFromBrand(brand));
    if (outlet) setOutletForm(formFromOutlet(outlet));
  }, [brand, isNew, outlet]);

  useEffect(() => {
    if (!isNew) return;
    logoTouched.current = false;
    const selected = brandFromChoice(brandChoice, brands);
    if (selected) {
      setBrandForm(formFromBrand(selected));
      return;
    }
    setBrandForm({
      ...emptyBrandForm,
      kind: brandChoice === "new" ? newBrandKind : "independent",
      name: brandChoice === "new" ? newBrandName : "",
    });
  }, [isNew, brandChoice]);

  useEffect(() => {
    if (!isNew || logoTouched.current) return;
    const selected = brandFromChoice(brandChoice, brands);
    if (selected) setBrandForm(formFromBrand(selected));
  }, [isNew, brandChoice, brands]);

  const independents = brands.filter((item) => item.kind === "independent");
  const elders = chainBrand(brands, "elders");
  const nutrien = chainBrand(brands, "nutrien");

  const refresh = async (id?: number) => {
    await queryClient.invalidateQueries({ queryKey: getListAdminResellerBrandsQueryKey() });
    if (id) await queryClient.invalidateQueries({ queryKey: getGetAdminResellerBrandQueryKey(id) });
  };

  const persistBrand = async (id: number, next: BrandForm) => {
    await updateBrand.mutateAsync({ id, data: toBrandInput(next) });
    await queryClient.invalidateQueries({ queryKey: getListAdminResellerBrandsQueryKey() });
    await queryClient.invalidateQueries({ queryKey: getGetAdminResellerBrandQueryKey(id) });
  };

  const handleLogoChange = (next: Pick<BrandForm, "logoSrc" | "logoAssetId">) => {
    logoTouched.current = true;
    const payload = { ...brandForm, ...next };
    setBrandForm(payload);
    const existing = !isNew && brand
      ? brand
      : brandFromChoice(brandChoice, brands);
    if (!existing) return;
    void updateBrand.mutateAsync({
      id: existing.id,
      data: { logoSrc: payload.logoSrc.trim(), logoAssetId: payload.logoAssetId },
    }).then(() => refresh(existing.id)).catch((caught) => {
      setError(errorMessage(caught, "Could not save that logo to the brand."));
    });
  };

  const resolveBrandId = async () => {
    const chainKind = brandChoice === "elders" || brandChoice === "nutrien" ? brandChoice : brandForm.kind;
    const logoFields = {
      website: brandForm.website.trim(),
      logoSrc: brandForm.logoSrc.trim() || CHAIN_DEFAULT_LOGOS[chainKind] || "",
      logoAssetId: brandForm.logoAssetId,
    };
    const attachTo = async (existing: ResellerBrand) => {
      const next = { ...formFromBrand(existing), ...logoFields, name: existing.name, kind: existing.kind, active: existing.active };
      if (next.logoSrc !== existing.logoSrc || next.logoAssetId !== existing.logoAssetId || next.website !== existing.website) {
        await persistBrand(existing.id, next);
      }
      return existing.id;
    };
    if (brandChoice === "elders") {
      if (elders) return attachTo(elders);
      const created = await createBrand.mutateAsync({ data: { name: "Elders", kind: "elders", ...logoFields } });
      return created.id;
    }
    if (brandChoice === "nutrien") {
      if (nutrien) return attachTo(nutrien);
      const created = await createBrand.mutateAsync({ data: { name: "Nutrien", kind: "nutrien", ...logoFields } });
      return created.id;
    }
    if (brandChoice.startsWith("id:")) {
      const existing = brands.find((item) => item.id === Number(brandChoice.slice(3)));
      if (!existing) throw new Error("That brand could not be found.");
      return attachTo(existing);
    }
    if (brandChoice === "independent") {
      const name = outletForm.name.trim();
      if (!name) throw new Error("Give this store a name.");
      const existing = matchBrandName(brands, name);
      if (existing) return attachTo(existing);
      const created = await createBrand.mutateAsync({ data: { name, kind: "independent", ...logoFields } });
      return created.id;
    }
    const name = newBrandName.trim();
    if (!name) throw new Error("Give the new brand a name.");
    const existing = matchBrandName(brands, name);
    if (existing) return attachTo(existing);
    const created = await createBrand.mutateAsync({ data: { name, kind: newBrandKind, ...logoFields } });
    return created.id;
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const coordinates = coordinatesFromForm(outletForm.coordinates);
      if (!coordinates) {
        setError("Coordinates must be latitude, longitude, for example -33.3512, 117.1234.");
        setBusy(false);
        return;
      }
      const outletData = toOutletInput(outletForm, coordinates);
      if (isNew) {
        const resolvedBrandId = await resolveBrandId();
        const created = await createOutlet.mutateAsync({ id: resolvedBrandId, data: outletData });
        await refresh(resolvedBrandId);
        navigate(`/admin/resellers/${resolvedBrandId}/${created.id}`, { replace: true });
        return;
      }
      await updateBrand.mutateAsync({ id: brandId, data: toBrandInput(brandForm) });
      await updateOutlet.mutateAsync({ brandId, id: outletId, data: outletData });
      await refresh(brandId);
      setMessage("Store saved.");
    } catch (caught) {
      setError(errorMessage(caught, "Could not save this store."));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (isNew || typeof brandId !== "number" || typeof outletId !== "number") {
      navigate("/admin/resellers");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await deleteOutlet.mutateAsync({ brandId, id: outletId });
      const remaining = (brand?.outlets ?? []).filter((item) => item.id !== outletId);
      if (brand?.kind === "independent" && remaining.length === 0) {
        await deleteBrand.mutateAsync({ id: brandId });
      }
      await refresh();
      navigate("/admin/resellers");
    } catch (caught) {
      setError(errorMessage(caught, "Could not delete this store."));
      setBusy(false);
    }
  };

  if (!isNew && isLoading) return <p className="admin-empty">Loading store…</p>;
  if (!isNew && (loadError || !brand || !outlet)) return <p className="admin-empty">That store could not be loaded.</p>;

  return (
    <>
      <header className="admin-page-header" style={{ flexDirection: "column", alignItems: "stretch", gap: 16 }}>
        <button type="button" className="admin-back-link" onClick={() => navigate("/admin/resellers")}>
          <Icon name="arrow-left" size={16} /> All stores
        </button>
        <div className="admin-blog-editor-head">
          <div>
            <p>Resellers</p>
            <h1>{isNew ? "New store" : `${brandForm.name} ${outletForm.name}`.trim() || "Store"}</h1>
          </div>
          <div className="admin-header-actions">
            {!isNew && (
              <button className="admin-button outline" type="button" onClick={() => setConfirmDelete(true)} disabled={busy}>Delete store</button>
            )}
            <button className="admin-button primary" type="submit" form="reseller-store-form" disabled={busy} data-testid="reseller-outlet-save">
              {busy ? "Saving…" : "Save store"}
            </button>
          </div>
        </div>
      </header>
      <div className="admin-content admin-blog-editor">
        {error && <div className="admin-notice" style={{ background: "#fef3f2", color: "#b42318" }}><p>{error}</p></div>}
        {message && <div className="admin-notice"><p>{message}</p></div>}

        <form id="reseller-store-form" className="admin-panel admin-form-card" onSubmit={(event) => { void save(event); }}>
          {isNew ? (
            <>
              <div className="admin-section-heading">
                <div>
                  <h3>Brand</h3>
                  <p>Pick Elders or Nutrien, choose Independent for a one-off store, or create a new trading name.</p>
                </div>
              </div>
              <label>Brand
                <select value={brandChoice} onChange={(event) => setBrandChoice(event.target.value)} data-testid="reseller-store-brand">
                  <option value="elders">Elders</option>
                  <option value="nutrien">Nutrien</option>
                  <option value="independent">Independent</option>
                  {independents.length > 0 && (
                    <optgroup label="Existing independents">
                      {independents.map((item) => (
                        <option key={item.id} value={`id:${item.id}`}>{item.name}</option>
                      ))}
                    </optgroup>
                  )}
                  <option value="new">Create a new brand…</option>
                </select>
              </label>
              {brandChoice === "independent" && (
                <p className="admin-field-hint">The store name is used as the trading name on the contact page.</p>
              )}
              {brandChoice === "new" && (
                <div className="admin-form-row">
                  <label>New brand name
                    <input required maxLength={120} value={newBrandName} onChange={(event) => setNewBrandName(event.target.value)} data-testid="reseller-brand-name" />
                  </label>
                  <label>Type
                    <select value={newBrandKind} onChange={(event) => setNewBrandKind(event.target.value as BrandForm["kind"])} data-testid="reseller-brand-kind">
                      <option value="independent">Independent</option>
                      <option value="elders">Elders</option>
                      <option value="nutrien">Nutrien</option>
                    </select>
                  </label>
                </div>
              )}
              <BrandFields
                form={brandForm}
                setForm={setBrandForm}
                fileRef={fileRef}
                busy={busy}
                onPickLibrary={() => setPickerOpen(true)}
                onLogoChange={handleLogoChange}
              />
            </>
          ) : (
            <>
              <div className="admin-section-heading">
                <div>
                  <h3>Brand</h3>
                  <p>Elders and Nutrien are chains. Independents can have one store or several under the same trading name.</p>
                </div>
              </div>
              <label>Brand name
                <input required maxLength={120} value={brandForm.name} onChange={(event) => setBrandForm({ ...brandForm, name: event.target.value })} data-testid="reseller-brand-name" />
              </label>
              <BrandFields
                form={brandForm}
                setForm={setBrandForm}
                showType
                fileRef={fileRef}
                busy={busy}
                onPickLibrary={() => setPickerOpen(true)}
                onLogoChange={handleLogoChange}
              />
            </>
          )}

          <div className="admin-section-heading" style={{ marginTop: 12 }}>
            <div>
              <h3>Store</h3>
              <p>Name, town, region and a Google pin are the fields used on the public contact page.</p>
            </div>
          </div>
          <StoreFields form={outletForm} setForm={setOutletForm} />
        </form>
      </div>
      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(asset) => {
          const next = { logoSrc: `/api/media/${asset.id}`, logoAssetId: asset.id };
          setBrandForm((current) => ({ ...current, ...next }));
          handleLogoChange(next);
          setPickerOpen(false);
        }}
      />
      {confirmDelete && (
        <ConfirmDialog
          title="Delete this store?"
          body="This removes the store from admin and the public contact page. This cannot be undone."
          confirmLabel="Delete store"
          busy={busy}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => { setConfirmDelete(false); void handleDelete(); }}
        />
      )}
    </>
  );
}

export default function AdminResellers() {
  const [location] = useLocation();
  const route = location.split("?")[0];
  if (route === "/admin/resellers/new") return <StoreEditor brandId="new" outletId="new" />;
  const match = route.match(/^\/admin\/resellers\/(\d+)\/(\d+)$/);
  if (match) return <StoreEditor brandId={Number(match[1])} outletId={Number(match[2])} />;
  return <StoreList />;
}
