import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Icon, StatusPill } from "../components/ui";
import { navigate, useLocation } from "../router";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListAdminProducts,
  useGetAdminSummary,
  useGetAdminProduct,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  useSaveProductDraftRevision,
  usePublishProduct,
  useArchiveProduct,
  useRestoreProduct,
  useDiscardProductDraft,
  useListAdminCategories,
  getListAdminProductsQueryKey,
  getGetAdminProductQueryKey,
  getGetAdminSummaryQueryKey
} from "@workspace/api-client-react";
import type {
  AdminProduct,
  ProductDetails,
  ProductComponent,
  ProductPhoto,
  ProductPackSize,
  ProductSowingRate,
  ProductTolerance,
  AdminSummary,
  ProductInputStatus,
  ProductDetailsRecordType,
  ProductInput,
  ProductDraftInput,
  CatalogueCategory,
  ProductInputPublishStatus
} from "@workspace/api-client-react";

type ProductStatus = "in-stock" | "low" | "very-low" | "unavailable";
type RecordKind = "Mix" | "Variety" | "Commodity / generic";

const blankProduct: ProductInput = {
  name: "",
  slug: "",
  price: "Contact for pricing",
  packSize: "25 kg bag",
  status: "in-stock",
  note: "",
  category: "Mixes",
  subcategoryId: null,
  techSheet: "",
  publishStatus: "Draft",
  details: {
    stockCode: "",
    guideSection: "Specialist Seed Mixes",
    recordType: "Mix",
    botanicalName: "",
    alsoKnownAs: [],
    packSizes: [{ label: "Standard", size: 25, unit: "kg" }],
    treatment: "",
    persistencyType: "" as any,
    ploidy: "" as any,
    flowerColour: "" as any,
    bredByOrigin: "",
    australianBred: false,
    distributedBy: "IH Seeds",
    sowingRates: [{ context: "Pasture", min: null, max: null, unit: "kg/ha" }],
    rainfallMinMm: null,
    soilPhMin: null,
    soilPhScale: "CaCl₂",
    soilRangeLightest: "" as any,
    soilRangeHeaviest: "" as any,
    sowingDepthMinCm: null,
    sowingDepthMaxCm: null,
    tolerance: [],
    maturityMeasure: "" as any,
    maturityDays: null,
    headingDate: "" as any,
    floweringWindow: "",
    winterActivity: null,
    inoculantGroup: "None",
    seedTreatment: [],
    ecocertApproved: false,
    endUse: [],
    livestock: [],
    companionSpecies: [],
    diseasePestResistance: "",
    persistenceLongevity: "",
    grazingManagementNotes: "",
    pbrProtected: false,
    pbrDetails: "",
    licenceRestriction: "",
    certification: [],
    isThirdPartyProduct: false,
    supplierName: "",
    summary: "",
    description: "",
    notes: "",
    components: [{ productLink: "", speciesName: "", inclusionRate: null, unit: "%", note: "" }],
    formulationYear: "",
    photos: [
      { slot: "Photo 1 · Hero", file: "", rating: "", src: "" },
      { slot: "Photo 2", file: "", rating: "", src: "" },
      { slot: "Photo 3", file: "", rating: "", src: "" },
    ],
    inCurrentPrintedGuide: false,
    seoTitle: "",
    seoDescription: "",
    sortOrder: null,
    featured: false,
    relatedProducts: [],
  },
};

const statusOptions: { value: ProductStatus; label: string }[] = [
  { value: "in-stock", label: "Good stock" },
  { value: "low", label: "Low stock" },
  { value: "very-low", label: "Very low" },
  { value: "unavailable", label: "Unavailable" },
];


const guideSections = [
  "",
  "Subterranean Clovers", "Aerial Seeded Clovers & White Clovers", "Serradellas & Medic",
  "Specialist Seed Mixes", "Annual Tetraploid Ryegrasses", "Annual Diploid Ryegrasses",
  "Short Term – Biennials & Perennial Ryegrass Varieties", "Lucerne", "Other Grasses",
  "Sub Tropical Perennial Grasses & Mixes", "Alternative Crops", "Biologicals"
];

const formatDate = (value: string | null | undefined) =>
  value ? new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "Never";

function AdminNavIcon({ name }: { name: string }) {
  if (name === "dashboard") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
  }
  if (name === "settings") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></svg>;
  }
  return <Icon name={name} size={19} />;
}

function AdminLayout({ children, mobileOpen, setMobileOpen }: { children: ReactNode; mobileOpen: boolean; setMobileOpen: (open: boolean) => void; }) {
  const [location] = useLocation();
  const nav = [
    { label: "Dashboard", icon: "dashboard", href: "/admin", enabled: true },
    { label: "Products & mixes", icon: "sprout", href: "/admin/products", enabled: true },
    { label: "Tech sheets", icon: "file-text", href: "", enabled: false },
    { label: "Site settings", icon: "settings", href: "", enabled: false },
  ];

  return (
    <div className="admin-shell">
      <button className="admin-mobile-toggle" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle admin navigation">
        <Icon name={mobileOpen ? "close" : "menu"} size={24} />
      </button>
      <aside className={`admin-sidebar ${mobileOpen ? "is-open" : ""}`}>
        <button className="admin-logo" onClick={() => navigate("/admin")} aria-label="IH Seeds admin dashboard">
          <img src="/ih-seeds-logo.png" alt="IH Seeds" />
          <span>Admin</span>
        </button>
        <nav aria-label="Admin navigation">
          {nav.map((item) => {
            const active = item.href === "/admin" ? location === "/admin" : item.href && location.startsWith(item.href);
            return (
              <button
                key={item.label}
                className={active ? "active" : ""}
                disabled={!item.enabled}
                onClick={() => { if (item.href) navigate(item.href); setMobileOpen(false); }}
              >
                <AdminNavIcon name={item.icon} />
                <span>{item.label}</span>
                {!item.enabled && <small>Soon</small>}
              </button>
            );
          })}
        </nav>
        <div className="admin-user"><span className="admin-avatar">IH</span><span><strong>IH Seeds team</strong><small>Administrator</small></span></div>
      </aside>
      {mobileOpen && <button className="admin-overlay" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />}
      <main className="admin-main">{children}</main>
    </div>
  );
}

function PageHeader({ eyebrow, title, action }: { eyebrow: string; title: ReactNode; action?: ReactNode }) {
  return (
    <header className="admin-page-header">
      <div><p>{eyebrow}</p><h1>{title}</h1></div>
      {action}
    </header>
  );
}

function Dashboard() {
  const { data: summary, isLoading } = useGetAdminSummary();
  const attention = summary
    ? Array.from(new Map(
      [...summary.recentProducts.filter(p => p.status !== "in-stock"), ...summary.recentProducts.filter(p => !p.techSheet)]
        .map((product) => [product.id, product]),
    ).values()).slice(0, 5)
    : [];

  return (
    <>
      <PageHeader eyebrow="IH Seeds admin" title={<>Good morning, <strong>team</strong></>} action={<button className="admin-button primary" onClick={() => navigate("/admin/products/new")}><Icon name="plus" size={18}/>Add a product</button>} />
      <div className="admin-content">
        <div className="admin-notice"><Icon name="clock" size={20}/><p>Catalogue and stock statuses update the public website as soon as they are saved here.</p></div>
        <section className="admin-stats" aria-label="Catalogue summary">
          <article className="admin-stat-card"><small>Products & mixes</small><strong>{isLoading ? "—" : summary?.totalProducts}</strong><p>{summary?.publishedProducts} published</p></article>
          <article className="admin-stat-card"><small>Pending drafts</small><strong>{isLoading ? "—" : summary?.pendingDrafts}</strong><p>Waiting to be published</p></article>
          <article className="admin-stat-card"><small>Low stock</small><strong>{isLoading ? "—" : summary?.lowStockProducts}</strong><p>Includes unavailable lines</p></article>
          <article className="admin-stat-card"><small>Tech sheets missing</small><strong>{isLoading ? "—" : summary?.missingTechSheets}</strong><p>No download attached</p></article>
        </section>
        <div className="admin-dashboard-grid">
          <section className="admin-panel">
            <div className="admin-panel-heading"><h2>Needs your <strong>attention</strong></h2><button onClick={() => navigate("/admin/products")}>View all products</button></div>
            {isLoading ? <div className="admin-empty">Loading catalogue…</div> : attention.length ? (
              <div className="admin-attention-list">
                {attention.map((product) => (
                  <button key={product.id} onClick={() => navigate(`/admin/products/${product.id}`)}>
                    <span className="admin-attention-icon"><Icon name={product.techSheet ? "sprout" : "file-text"} size={19}/></span>
                    <span><strong>{product.name}</strong><small>{!product.techSheet ? "No tech sheet attached" : `${statusOptions.find((item) => item.value === product.status)?.label}`}</small></span>
                    <span>Fix</span>
                  </button>
                ))}
              </div>
            ) : <div className="admin-empty">Everything is up to date.</div>}
          </section>
          <section className="admin-panel admin-quick-panel">
            <div><span className="admin-feature-icon"><Icon name="sprout" size={24}/></span><h2>Bulk stock update</h2><p>Select multiple products and change their availability in one action.</p><button className="admin-button outline" onClick={() => navigate("/admin/products")}>Open the product table</button></div>
            <div><h2>Recently updated</h2>{summary?.recentProducts.slice(0, 4).map((product) => <button key={product.id} onClick={() => navigate(`/admin/products/${product.id}`)}><span><strong>{product.name}</strong><small>{product.category}</small></span><small>{formatDate(product.updatedAt)}</small></button>)}</div>
          </section>
        </div>
      </div>
    </>
  );
}

function ProductTable() {
  const { data: products = [], isLoading } = useListAdminProducts();
  const updateProduct = useUpdateProduct();
  const publishProduct = usePublishProduct();
  const archiveProduct = useArchiveProduct();
  const restoreProduct = useRestoreProduct();
  const discardDraft = useDiscardProductDraft();
  const deleteProduct = useDeleteProduct();
  const queryClient = useQueryClient();

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [view, setView] = useState<"Published" | "Draft" | "Archived">(() => {
    const requestedView = new URLSearchParams(window.location.search).get("view");
    return requestedView === "Draft" || requestedView === "Archived" ? requestedView : "Published";
  });
  const [selected, setSelected] = useState<number[]>([]);
  const [bulkStatus, setBulkStatus] = useState<ProductInputStatus>("in-stock");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const rows = useMemo(() => products
    .filter((product) => {
      if (view === "Published") return product.lifecycleStatus === "Published";
      if (view === "Draft") return product.lifecycleStatus === "Draft" || product.hasDraft;
      if (view === "Archived") return product.lifecycleStatus === "Archived";
      return true;
    })
    .map((product) => view === "Draft" && product.hasDraft && product.draft
      ? { ...product, ...product.draft, updatedAt: product.draft.savedAt }
      : product
    )
    .filter((product) =>
      (!query || `${product.name} ${product.note} ${product.category}`.toLowerCase().includes(query.toLowerCase())) &&
      (!statusFilter || product.status === statusFilter)
    )
    .sort((first, second) => {
      const firstActivity = first.draftSavedAt ?? first.updatedAt;
      const secondActivity = second.draftSavedAt ?? second.updatedAt;
      const dateDifference = Date.parse(secondActivity ?? "") - Date.parse(firstActivity ?? "");
      return Number.isNaN(dateDifference) || dateDifference === 0 ? second.id - first.id : dateDifference;
    }), [products, query, statusFilter, view]);

  const publishedCount = products.filter(p => p.lifecycleStatus === "Published").length;
  const draftCount = products.filter(p => p.lifecycleStatus === "Draft" || p.hasDraft).length;
  const archivedCount = products.filter(p => p.lifecycleStatus === "Archived").length;

  useEffect(() => {
    setSelected([]);
    setMessage("");
  }, [view]);

  const refreshCatalogue = async () => {
    await queryClient.invalidateQueries({ queryKey: getListAdminProductsQueryKey(), refetchType: "all" });
    await queryClient.invalidateQueries({ queryKey: getGetAdminSummaryQueryKey() });
  };

  const runLifecycleAction = async (
    product: AdminProduct,
    action: "publish" | "archive" | "restore" | "discard" | "delete",
  ) => {
    const prompts = {
      publish: `Publish ${product.name}? The current draft will replace what visitors see on the public site.`,
      archive: `Archive ${product.name}? It will be removed from the public site immediately, but its data will be kept.`,
      restore: `Restore ${product.name} to Draft? It will remain off the public site until explicitly published.`,
      discard: `Discard the pending draft for ${product.name}? The live public version will remain unchanged.`,
      delete: `Delete ${product.name} permanently? This cannot be undone.`,
    };
    if (!window.confirm(prompts[action])) return;
    setSaving(true);
    setMessage("");
    try {
      if (action === "publish") await publishProduct.mutateAsync({ id: product.id });
      if (action === "archive") await archiveProduct.mutateAsync({ id: product.id });
      if (action === "restore") await restoreProduct.mutateAsync({ id: product.id });
      if (action === "discard") await discardDraft.mutateAsync({ id: product.id });
      if (action === "delete") await deleteProduct.mutateAsync({ id: product.id });
      await refreshCatalogue();
      setMessage(action === "publish" ? "Product published." : action === "restore" ? "Product restored to Draft." : action === "discard" ? "Draft changes discarded." : action === "archive" ? "Product archived." : "Product deleted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update this product.");
    } finally {
      setSaving(false);
    }
  };

  const renderRowActions = (product: AdminProduct) => (
    <>
      {view !== "Archived" && <button className="admin-text-button" onClick={() => navigate(`/admin/products/${product.id}`)}>{view === "Draft" ? "Continue editing" : "Edit"}</button>}
      {view === "Published" && <button className="admin-text-button" disabled={saving} onClick={() => void runLifecycleAction(product, "archive")}>Archive</button>}
      {view === "Draft" && <button className="admin-text-button" disabled={saving} onClick={() => void runLifecycleAction(product, "publish")}>Publish</button>}
      {view === "Draft" && product.lifecycleStatus === "Published" && <button className="admin-text-button danger" disabled={saving} onClick={() => void runLifecycleAction(product, "discard")}>Discard draft</button>}
      {view === "Archived" && <button className="admin-text-button" disabled={saving} onClick={() => void runLifecycleAction(product, "restore")}>Restore to Draft</button>}
      {(view === "Archived" || (view === "Draft" && product.lifecycleStatus === "Draft")) && <button className="admin-text-button danger" disabled={saving} onClick={() => void runLifecycleAction(product, "delete")}>Delete</button>}
    </>
  );

  const applyBulk = async () => {
    setSaving(true);
    setMessage("");
    try {
      await Promise.all(selected.map((id) => updateProduct.mutateAsync({ id, data: { status: bulkStatus } })));
      await queryClient.invalidateQueries({ queryKey: getListAdminProductsQueryKey() });
      await queryClient.invalidateQueries({ queryKey: getGetAdminSummaryQueryKey() });
      setSelected([]);
      setMessage("Stock statuses updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update stock.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader eyebrow="Content" title={<>Products &amp; <strong>mixes</strong></>} action={<div style={{ display: 'flex', gap: 12 }}><button className="admin-button outline" style={{ width: 46, padding: 0 }} aria-label="Taxonomy settings" onClick={() => navigate("/admin/products/categories")}><Icon name="settings" size={18}/></button><button className="admin-button primary" onClick={() => navigate("/admin/products/new")}><Icon name="plus" size={18}/>Add a product</button></div>} />
      <div className="admin-content">
        <div className="admin-table-tabs">
          <button className={view === "Published" ? "active" : ""} onClick={() => setView("Published")}>Published <span>{publishedCount}</span></button>
          <button className={view === "Draft" ? "active" : ""} onClick={() => setView("Draft")}>Draft <span>{draftCount}</span></button>
          <button className={view === "Archived" ? "active" : ""} onClick={() => setView("Archived")}>Archive <span>{archivedCount}</span></button>
        </div>
        <div className="admin-table-tools">
          <label className="admin-search"><Icon name="search" size={18}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products" /></label>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by stock status"><option value="">All stock statuses</option>{statusOptions.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select>
          <span>{rows.length} product{rows.length === 1 ? "" : "s"}</span>
        </div>
        {view !== "Archived" && selected.length > 0 && (
          <div className="admin-bulk-bar">
            <strong>{selected.length} selected</strong><span>Set stock status to</span>
            <select value={bulkStatus} onChange={(event) => setBulkStatus(event.target.value as ProductInputStatus)}>{statusOptions.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select>
            <button className="admin-button primary small" onClick={applyBulk} disabled={saving}>{saving ? "Applying…" : "Apply to selected"}</button>
            <button className="admin-text-button" onClick={() => setSelected([])}>Clear</button>
          </div>
        )}
        {message && <p className="admin-inline-message">{message}</p>}
        <div className="admin-table-card">
          <table>
            <thead><tr><th aria-label="Select"></th><th>Product</th><th>Category</th><th>Stock status</th><th>Tech sheet</th><th>Updated</th><th></th></tr></thead>
            <tbody>
              {isLoading ? <tr><td colSpan={7} className="admin-empty">Loading catalogue…</td></tr> : rows.map((product) => (
                <tr key={product.id}>
                  <td>{view !== "Archived" && <input type="checkbox" checked={selected.includes(product.id)} onChange={() => setSelected((current) => current.includes(product.id) ? current.filter((id) => id !== product.id) : [...current, product.id])} aria-label={`Select ${product.name}`}/>}</td>
                  <td>
                    <button className="admin-product-name" onClick={() => navigate(`/admin/products/${product.id}`)}>{product.name}</button>
                    <small>{product.packSize} · {product.price}</small>
                    {view === "Published" && <span className="admin-version-copy">Live on public site</span>}
                    {view === "Published" && product.hasDraft && <span className="admin-badge pending">Changes pending</span>}
                    {view === "Draft" && <span className="admin-version-copy">Draft changes — not public</span>}
                    {product.lifecycleStatus === "Draft" && <span className="admin-badge draft">Draft only</span>}
                    <div className="admin-row-actions admin-mobile-row-actions">{renderRowActions(product)}</div>
                  </td>
                  <td>{product.category}</td>
                  <td><StatusPill status={product.status as any}/></td>
                  <td>{product.techSheet ? <span className="admin-sheet"><Icon name="file-text" size={16}/>Attached</span> : <button className="admin-text-button" onClick={() => navigate(`/admin/products/${product.id}`)}>Attach PDF</button>}</td>
                  <td>{formatDate(product.updatedAt)}</td>
                  <td>
                    <div className="admin-row-actions">
                      {renderRowActions(product)}
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && rows.length === 0 && <tr><td colSpan={7} className="admin-empty">No products match those filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function ProductEditor({ isNew, productId }: { isNew: boolean; productId?: number }) {
  const queryClient = useQueryClient();
  const { data: product, isLoading: loadingProduct } = useGetAdminProduct(productId!, { query: { enabled: !!productId, queryKey: getGetAdminProductQueryKey(productId!) } });
  const { data: products = [] } = useListAdminProducts();
  const {
    data: taxonomy = [],
    isLoading: loadingTaxonomy,
    error: taxonomyError,
  } = useListAdminCategories();
  const createMutation = useCreateProduct();
  const saveDraftMutation = useSaveProductDraftRevision();
  const publishMutation = usePublishProduct();
  const archiveMutation = useArchiveProduct();
  const restoreMutation = useRestoreProduct();
  const discardMutation = useDiscardProductDraft();
  const deleteMutation = useDeleteProduct();

  const toForm = (item?: AdminProduct | ProductDraftInput | null): ProductInput => {
    if (!item) return structuredClone(blankProduct);
    const raw = (item.details ?? {}) as Partial<ProductDetails> & {
      kind?: RecordKind;
      rate?: string;
      rainfall?: string;
      flowering?: string;
      inoculant?: string;
      soil?: string[];
      tolerance?: Array<string | Tolerance>;
      components?: Array<ProductComponent | { name?: string; note?: string }>;
    };
    const legacyRainfall = Number.parseFloat(raw.rainfall ?? "");
    const legacySoil = raw.soil ?? [];
    const tolerance = (raw.tolerance ?? []).map((value) => typeof value === "string" ? { name: value as any, mild: false } : value);
    const components = (raw.components ?? []).map((value) => "speciesName" in value ? value : {
      productLink: "",
      speciesName: value.name ?? "",
      inclusionRate: null,
      unit: "%",
      note: value.note ?? "",
    });
    return {
      name: item.name,
      slug: "slug" in item ? item.slug : "",
      price: item.price,
      packSize: item.packSize,
      status: item.status as ProductInputStatus,
      note: item.note,
      category: item.category,
      subcategoryId: item.subcategoryId ?? null,
      techSheet: item.techSheet,
      publishStatus: ("publishStatus" in item ? item.publishStatus : "Draft") as ProductInputPublishStatus,
      details: {
        ...blankProduct.details,
        ...raw,
        recordType: (raw.recordType ?? raw.kind ?? "Mix") as ProductDetailsRecordType,
        packSizes: raw.packSizes?.length ? raw.packSizes : [{ label: "Standard", size: null, unit: item.packSize }],
        sowingRates: raw.sowingRates?.length ? raw.sowingRates : [{ context: "Pasture" as any, min: null, max: null, unit: "kg/ha" }],
        rainfallMinMm: raw.rainfallMinMm ?? (Number.isFinite(legacyRainfall) ? legacyRainfall : null),
        soilRangeLightest: (raw.soilRangeLightest ?? legacySoil[0] ?? "") as any,
        soilRangeHeaviest: (raw.soilRangeHeaviest ?? legacySoil.at(-1) ?? "") as any,
        tolerance,
        floweringWindow: raw.floweringWindow ?? raw.flowering ?? "",
        inoculantGroup: (raw.inoculantGroup ?? raw.inoculant ?? "None") as any,
        livestock: raw.livestock ?? [],
        endUse: raw.endUse ?? [],
        seedTreatment: raw.seedTreatment ?? [],
        companionSpecies: raw.companionSpecies ?? [],
        certification: raw.certification ?? [],
        relatedProducts: raw.relatedProducts ?? [],
        alsoKnownAs: raw.alsoKnownAs ?? [],
        components,
        photos: raw.photos?.length ? raw.photos : blankProduct.details.photos,
      },
    };
  };

  const [form, setForm] = useState<ProductInput>(() => blankProduct);
  const [viewMode, setViewMode] = useState<"draft" | "live">("draft");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const sourceDataStr = JSON.stringify(product?.draft ?? product);
  useEffect(() => {
    if (product) {
      setForm(toForm(product.draft ?? product));
    } else if (isNew) {
      setForm(structuredClone(blankProduct));
    }
  }, [sourceDataStr, isNew]);

  const liveForm = useMemo(() => product ? toForm(product) : blankProduct, [product]);
  const currentForm = viewMode === "live" ? liveForm : form;

  const setField = <K extends keyof ProductInput,>(key: K, value: ProductInput[K]) => setForm((current) => ({ ...current, [key]: value }));
  const setDetail = <K extends keyof ProductDetails,>(key: K, value: ProductDetails[K]) => setForm((current) => ({ ...current, details: { ...current.details, [key]: value } }));
  const toggleList = (key: "seedTreatment" | "endUse" | "livestock" | "certification", value: string) => {
    const current = (form.details[key] as string[]) ?? [];
    setDetail(key, (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]) as any);
  };
  const setNumberDetail = (key: "rainfallMinMm" | "soilPhMin" | "sowingDepthMinCm" | "sowingDepthMaxCm" | "maturityDays" | "winterActivity" | "sortOrder", value: string) =>
    setDetail(key, value === "" ? null : Number(value));
  const updateStringItem = (key: "alsoKnownAs" | "companionSpecies" | "relatedProducts", index: number, value: string) =>
    setDetail(key, form.details[key].map((item, itemIndex) => itemIndex === index ? value : item));
  const removeStringItem = (key: "alsoKnownAs" | "companionSpecies" | "relatedProducts", index: number) =>
    setDetail(key, form.details[key].filter((_, itemIndex) => itemIndex !== index));
  const addStringItem = (key: "alsoKnownAs" | "companionSpecies" | "relatedProducts") => setDetail(key, [...form.details[key], ""]);
  const updatePackSize = (index: number, patch: Partial<ProductPackSize>) => setDetail("packSizes", form.details.packSizes.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  const updateSowingRate = (index: number, patch: Partial<ProductSowingRate>) => setDetail("sowingRates", form.details.sowingRates.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  const toggleTolerance = (name: string) => {
    const existing = form.details.tolerance.find((item) => item.name === name);
    setDetail("tolerance", existing ? form.details.tolerance.filter((item) => item.name !== name) : [...form.details.tolerance, { name: name as any, mild: false }]);
  };
  const toggleMildTolerance = (name: string) => setDetail("tolerance", form.details.tolerance.map((item) => item.name === name ? { ...item, mild: !item.mild } : item));
  const updateComponent = (index: number, patch: Partial<ProductComponent>) => setDetail("components", form.details.components.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  const removeComponent = (index: number) => setDetail("components", form.details.components.filter((_, itemIndex) => itemIndex !== index));
  const updatePhoto = (index: number, patch: Partial<ProductPhoto>) => setDetail("photos", form.details.photos.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const action = submitter?.value; // "back", "draft", or "publish"

    if (action === "back" && (viewMode === "live" || isArchived)) {
      navigate(`/admin/products?view=${isArchived ? "Archived" : "Published"}`);
      return;
    }

    if (action === "publish") {
      const missing = [
        !form.slug.trim() && "Slug",
        !form.category.trim() && "Category",
        !form.details.recordType && "Record type",
        !form.details.summary.trim() && "Summary",
        !form.details.description.trim() && "Product description",
      ].filter(Boolean) as string[];
      if (missing.length > 0) {
        setError(`Complete these fields before publishing: ${missing.join(", ")}.`);
        setSaving(false);
        return;
      }
    }

    if (action === "publish" && !window.confirm("Publish these changes? This will replace the currently live version.")) {
      setSaving(false);
      return;
    }

    const packSize = form.details.packSizes
      .map((pack) => `${pack.label ? `${pack.label}: ` : ""}${[pack.size, pack.unit].filter((value) => value !== null && value !== "").join(" ")}`.trim())
      .filter(Boolean)
      .join(" / ") || form.packSize;
    const payload = {
      ...form,
      packSize,
      details: { ...form.details, treatment: form.details.seedTreatment.join(" · ") },
    };

    try {
      if (isNew) {
        payload.publishStatus = "Draft";
        const newProd = await createMutation.mutateAsync({ data: payload });
        if (action === "publish") {
          await publishMutation.mutateAsync({ id: newProd.id });
        }
        await queryClient.invalidateQueries({ queryKey: getListAdminProductsQueryKey(), refetchType: "all" });
        await queryClient.invalidateQueries({ queryKey: getGetAdminSummaryQueryKey() });
        navigate(action === "back" ? "/admin/products?view=Draft" : `/admin/products/${newProd.id}`);
      } else {
        const { slug, publishStatus, ...draftPayload } = payload;
        await saveDraftMutation.mutateAsync({ id: productId!, data: draftPayload });
        if (action === "publish") {
          await publishMutation.mutateAsync({ id: productId! });
        }
        await queryClient.invalidateQueries({ queryKey: getGetAdminProductQueryKey(productId!) });
        await queryClient.invalidateQueries({ queryKey: getListAdminProductsQueryKey(), refetchType: "all" });
        await queryClient.invalidateQueries({ queryKey: getGetAdminSummaryQueryKey() });
        if (action === "back") navigate("/admin/products?view=Draft");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save product.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!product || !window.confirm(`Delete ${product.name}? This cannot be undone.`)) return;
    setSaving(true);
    setError("");
    try {
      await deleteMutation.mutateAsync({ id: product.id });
      await queryClient.invalidateQueries({ queryKey: getListAdminProductsQueryKey() });
      await queryClient.invalidateQueries({ queryKey: getGetAdminSummaryQueryKey() });
      navigate("/admin/products");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete product.");
      setSaving(false);
    }
  };

  const restore = async () => {
    if (!product || !window.confirm(`Restore ${product.name} to Draft?`)) return;
    setSaving(true);
    setError("");
    try {
      await restoreMutation.mutateAsync({ id: product.id });
      await queryClient.invalidateQueries({ queryKey: getGetAdminProductQueryKey(product.id) });
      await queryClient.invalidateQueries({ queryKey: getListAdminProductsQueryKey() });
      await queryClient.invalidateQueries({ queryKey: getGetAdminSummaryQueryKey() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to restore product.");
    } finally {
      setSaving(false);
    }
  };

  const discardDraft = async () => {
    if (!product || !window.confirm(`Discard draft for ${product.name}? All unpublished changes will be lost.`)) return;
    setSaving(true);
    setError("");
    try {
      await discardMutation.mutateAsync({ id: product.id });
      await queryClient.invalidateQueries({ queryKey: getGetAdminProductQueryKey(product.id) });
      await queryClient.invalidateQueries({ queryKey: getListAdminProductsQueryKey() });
      await queryClient.invalidateQueries({ queryKey: getGetAdminSummaryQueryKey() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to discard draft.");
    } finally {
      setSaving(false);
    }
  };

  if (loadingProduct && !isNew) return <div className="admin-empty-page">Loading product…</div>;
  if (!product && !isNew) return <div className="admin-empty-page"><h1>Product not found</h1><button className="admin-button primary" onClick={() => navigate("/admin/products")}>Back to products</button></div>;

  const isArchived = product?.lifecycleStatus === "Archived";
  const isLive = product?.lifecycleStatus === "Published";
  const hasDraft = product?.hasDraft;
  const selectedTaxonomy = currentForm.subcategoryId
    ? taxonomy.find((category) => category.id === currentForm.subcategoryId)
    : undefined;
  const selectedRoot = selectedTaxonomy?.parentId === null
    ? selectedTaxonomy
    : selectedTaxonomy?.parentId
      ? taxonomy.find((category) => category.id === selectedTaxonomy.parentId)
      : taxonomy.find((category) => category.parentId === null && category.name === currentForm.category);
  const rootOptions = taxonomy
    .filter((category) => category.parentId === null && (category.active || category.id === selectedRoot?.id))
    .sort((first, second) => first.sortOrder - second.sortOrder);
  const childOptions = selectedRoot
    ? taxonomy
      .filter((category) => category.parentId === selectedRoot.id && (category.active || category.id === selectedTaxonomy?.id))
      .sort((first, second) => first.sortOrder - second.sortOrder)
    : [];

  return (
    <>
      <header className="admin-page-header admin-editor-header">
        <button className="admin-back-link" type="submit" form="admin-product-form" name="action" value="back" disabled={saving} title="Save draft and return to Products & mixes"><Icon name="arrow-left" size={16}/>Products &amp; mixes</button>
        <div className="admin-header-actions">
          {isLive && (
            <div className="admin-view-toggle">
              <button type="button" className={viewMode === "draft" ? "active" : ""} onClick={() => setViewMode("draft")}>Edit Draft</button>
              <button type="button" className={viewMode === "live" ? "active" : ""} onClick={() => setViewMode("live")}>View Live</button>
            </div>
          )}
          {!isNew && hasDraft && !isArchived && <button className="admin-button ghost" type="button" onClick={discardDraft} disabled={saving}>Discard draft</button>}

          {isArchived ? (
            <button className="admin-button primary" type="button" onClick={restore} disabled={saving}>Restore to Draft</button>
          ) : viewMode === "draft" ? (
            <>
              <button className="admin-button outline" type="submit" form="admin-product-form" name="action" value="draft" disabled={saving}>{hasDraft ? "Update draft" : "Save draft"}</button>
              <button className="admin-button primary" type="submit" form="admin-product-form" name="action" value="publish" disabled={saving}>{saving ? "Saving…" : "Publish changes"}</button>
            </>
          ) : null}
        </div>
      </header>
      <div className="admin-editor-title">
        <h1>{isNew ? "Add a product" : product?.name ?? "Product"}</h1>
        <div className="admin-editor-version">
          {isNew || !isLive ? "Draft changes — not public" : viewMode === "live" ? "Live on public site · read-only" : "Draft changes — not public"}
        </div>
      </div>
      <form id="admin-product-form" className="admin-editor admin-claude-editor" onSubmit={submit}>
        <datalist id="admin-product-slugs">{products.filter((item) => item.id !== product?.id).map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}</datalist>
        <fieldset className="admin-editor-main" disabled={viewMode === "live" || isArchived}>
          <section className="admin-panel admin-form-card">
            <h2>Identity</h2>
            <div className="admin-form-grid">
               <label><span className="admin-label-title">Product name<span className="admin-required-star" aria-hidden="true">*</span></span><small>Required to save a draft or publish.</small><input required value={currentForm.name} onChange={(event) => setField("name", event.target.value)} placeholder="e.g. SouWest™ Pasture Mix"/></label>
               <label><span className="admin-label-title">Slug<span className="admin-required-star" aria-hidden="true">*</span></span><input disabled={!isNew} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={currentForm.slug} onChange={(event) => setField("slug", event.target.value.toLowerCase())} placeholder="souwest-pasture-mix"/><small>Stable URL key. It cannot be changed after the product is created. Required to publish.</small></label>
              <label>Stock code<input value={currentForm.details.stockCode} onChange={(event) => setDetail("stockCode", event.target.value)} placeholder="e.g. EQUI or SOU / SOU500"/></label>
              <label>Botanical name<input value={currentForm.details.botanicalName} onChange={(event) => setDetail("botanicalName", event.target.value)} placeholder="e.g. Lolium multiflorum"/></label>
               <label><span className="admin-label-title">Category<span className="admin-required-star" aria-hidden="true">*</span></span><small>{loadingTaxonomy ? "Loading categories…" : taxonomyError ? "Categories could not be loaded." : "Required to publish."}</small>
                 <select
                   value={selectedRoot?.id ?? ""}
                   disabled={loadingTaxonomy || Boolean(taxonomyError)}
                   onChange={(event) => {
                     const root = taxonomy.find((category) => category.id === Number(event.target.value));
                     setForm((current) => ({
                       ...current,
                       category: root?.name ?? "",
                       subcategoryId: root?.id ?? null,
                     }));
                   }}
                 >
                  <option value="">Select a category</option>
                   {rootOptions.map((category) => <option key={category.id} value={category.id}>{category.name}{!category.active ? " (Inactive)" : ""}</option>)}
                </select>
              </label>
              <label><span className="admin-label-title">Subcategory</span><small>Optional filter group.</small>
                 <select
                   value={selectedTaxonomy && selectedTaxonomy.parentId === selectedRoot?.id ? selectedTaxonomy.id : ""}
                   onChange={(event) => setField("subcategoryId", event.target.value ? Number(event.target.value) : selectedRoot?.id ?? null)}
                   disabled={!selectedRoot || loadingTaxonomy || Boolean(taxonomyError)}
                 >
                  <option value="">None</option>
                   {childOptions.map((category) => <option key={category.id} value={category.id}>{category.name}{!category.active ? " (Inactive)" : ""}</option>)}
                </select>
              </label>
               <label>Guide section<select value={currentForm.details.guideSection} onChange={(event) => setDetail("guideSection", event.target.value)}>{guideSections.map((section) => <option key={section || "not-set"} value={section}>{section || "Not set"}</option>)}</select></label>
            </div>
               <div className="admin-choice-field"><span className="admin-label-title">Record type<span className="admin-required-star" aria-hidden="true">*</span><small>Required to publish.</small></span><div>{(["Mix", "Variety", "Commodity / generic"] as RecordKind[]).map((kind) => <button key={kind} type="button" className={currentForm.details.recordType === kind ? "selected" : ""} onClick={() => setDetail("recordType", kind as any)}>{kind}</button>)}</div></div>
            <div className="admin-repeat-group">
              <div className="admin-section-heading"><div><h3>Also known as</h3><p>Alternative trade or catalogue names.</p></div>{viewMode !== "live" && !isArchived && <button className="admin-button outline small" type="button" onClick={() => addStringItem("alsoKnownAs")}><Icon name="plus" size={16}/>Add name</button>}</div>
              {currentForm.details.alsoKnownAs.map((alias, index) => <div className="admin-repeat-row" key={index}><input value={alias} onChange={(event) => updateStringItem("alsoKnownAs", index, event.target.value)} placeholder="Alternative name"/>{viewMode !== "live" && !isArchived && <button type="button" onClick={() => removeStringItem("alsoKnownAs", index)} aria-label="Remove alternative name">×</button>}</div>)}
            </div>
            <div className="admin-repeat-group">
              <div className="admin-section-heading"><div><h3>Pack sizes</h3><p>Add every pasture or turf pack sold for this product.</p></div>{viewMode !== "live" && !isArchived && <button className="admin-button outline small" type="button" onClick={() => setDetail("packSizes", [...form.details.packSizes, { label: "", size: null, unit: "kg" }])}><Icon name="plus" size={16}/>Add pack</button>}</div>
              {currentForm.details.packSizes.map((pack, index) => <div className="admin-repeat-row admin-repeat-row-pack" key={index}><input value={pack.label} onChange={(event) => updatePackSize(index, { label: event.target.value })} placeholder="Label"/><input type="number" min="0" step="0.01" value={pack.size ?? ""} onChange={(event) => updatePackSize(index, { size: event.target.value === "" ? null : Number(event.target.value) })} placeholder="Size"/><input value={pack.unit} onChange={(event) => updatePackSize(index, { unit: event.target.value })} placeholder="Unit"/>{viewMode !== "live" && !isArchived && <button type="button" onClick={() => setDetail("packSizes", form.details.packSizes.filter((_, itemIndex) => itemIndex !== index))} aria-label="Remove pack size">×</button>}</div>)}
            </div>
          </section>

          <section className="admin-panel admin-form-card">
            <div><h2>Classification</h2><p>Structured catalogue attributes used for filtering and comparison.</p></div>
            <div className="admin-form-grid">
              <label>Persistency type<select value={currentForm.details.persistencyType} onChange={(event) => setDetail("persistencyType", event.target.value as any)}><option value="">Not set</option>{["Annual", "Biennial", "Perennial", "Hybrid perennial", "Short-term (1–2 years)"].map((value) => <option key={value}>{value}</option>)}</select></label>
              {selectedRoot?.slug === "ryegrass" && <label>Ploidy<select value={currentForm.details.ploidy} onChange={(event) => setDetail("ploidy", event.target.value as any)}><option value="">Not set</option>{["Diploid", "Tetraploid", "Hexaploid", "Mixed (blend)"].map((value) => <option key={value}>{value}</option>)}</select></label>}
              <label>Flower colour<select value={currentForm.details.flowerColour} onChange={(event) => setDetail("flowerColour", event.target.value as any)}><option value="">Not set</option>{["Pink", "Yellow", "White", "Crimson", "Red", "Purple"].map((value) => <option key={value}>{value}</option>)}</select></label>
              <label>Bred by / origin<input value={currentForm.details.bredByOrigin} onChange={(event) => setDetail("bredByOrigin", event.target.value)} placeholder="e.g. Agricom (NZ)"/></label>
              <label>Distributed by<input value={currentForm.details.distributedBy} onChange={(event) => setDetail("distributedBy", event.target.value)} placeholder="IH Seeds"/></label>
            </div>
            <label className="admin-check-row"><input type="checkbox" checked={currentForm.details.australianBred} onChange={(event) => setDetail("australianBred", event.target.checked)}/><span><strong>Australian bred</strong><small>Australian bred for Australian farming conditions.</small></span></label>
          </section>

          <section className="admin-panel admin-form-card">
            <div><h2>Agronomy Specs</h2><p>The guide fields are stored with the product record. Leave a field blank if the guide has no entry.</p></div>
            <div className="admin-repeat-group">
              <div className="admin-section-heading"><div><h3>Sowing rates</h3><p>Use separate rows for monoculture, mixes, dryland, irrigation, pasture, or turf rates.</p></div>{viewMode !== "live" && !isArchived && <button className="admin-button outline small" type="button" onClick={() => setDetail("sowingRates", [...form.details.sowingRates, { context: "Pasture" as any, min: null, max: null, unit: "kg/ha" }])}><Icon name="plus" size={16}/>Add rate</button>}</div>
              {currentForm.details.sowingRates.map((rate, index) => <div className="admin-repeat-row admin-repeat-row-rate" key={index}><select value={rate.context} onChange={(event) => updateSowingRate(index, { context: event.target.value as any })}>{["Monoculture", "In a mix", "Dryland", "Irrigation", "Pasture", "Turf"].map((value) => <option key={value}>{value}</option>)}</select><input type="number" min="0" step="0.01" value={rate.min ?? ""} onChange={(event) => updateSowingRate(index, { min: event.target.value === "" ? null : Number(event.target.value) })} placeholder="Min"/><input type="number" min="0" step="0.01" value={rate.max ?? ""} onChange={(event) => updateSowingRate(index, { max: event.target.value === "" ? null : Number(event.target.value) })} placeholder="Max"/><input value={rate.unit} onChange={(event) => updateSowingRate(index, { unit: event.target.value })} placeholder="kg/ha"/>{viewMode !== "live" && !isArchived && <button type="button" onClick={() => setDetail("sowingRates", form.details.sowingRates.filter((_, itemIndex) => itemIndex !== index))} aria-label="Remove sowing rate">×</button>}</div>)}
            </div>
            <div className="admin-form-grid">
              <label>Minimum rainfall (mm)<input type="number" min="0" value={currentForm.details.rainfallMinMm ?? ""} onChange={(event) => setNumberDetail("rainfallMinMm", event.target.value)} placeholder="400"/></label>
              <label>Minimum soil pH<input type="number" min="0" step="0.1" value={currentForm.details.soilPhMin ?? ""} onChange={(event) => setNumberDetail("soilPhMin", event.target.value)} placeholder="5.5"/></label>
              <label>Soil pH scale<select value={currentForm.details.soilPhScale} onChange={(event) => setDetail("soilPhScale", event.target.value as any)}><option>CaCl₂</option><option>water</option></select></label>
              <label>Lightest soil<select value={currentForm.details.soilRangeLightest} onChange={(event) => setDetail("soilRangeLightest", event.target.value as any)}><option value="">Not set</option>{[{ code: "LS", label: "LS — light sand" }, { code: "S", label: "S — sand" }, { code: "L", label: "L — loam" }, { code: "H", label: "H — heavy" }].map((soil) => <option key={soil.code} value={soil.code}>{soil.label}</option>)}</select></label>
              <label>Heaviest soil<select value={currentForm.details.soilRangeHeaviest} onChange={(event) => setDetail("soilRangeHeaviest", event.target.value as any)}><option value="">Not set</option>{[{ code: "LS", label: "LS — light sand" }, { code: "S", label: "S — sand" }, { code: "L", label: "L — loam" }, { code: "H", label: "H — heavy" }].map((soil) => <option key={soil.code} value={soil.code}>{soil.label}</option>)}</select></label>
              <label>Minimum sowing depth (cm)<input type="number" min="0" step="0.1" value={currentForm.details.sowingDepthMinCm ?? ""} onChange={(event) => setNumberDetail("sowingDepthMinCm", event.target.value)}/></label>
              <label>Maximum sowing depth (cm)<input type="number" min="0" step="0.1" value={currentForm.details.sowingDepthMaxCm ?? ""} onChange={(event) => setNumberDetail("sowingDepthMaxCm", event.target.value)}/></label>
            </div>
            <div className="admin-choice-field"><span>Tolerance</span><div>{["Low pH", "Waterlogging", "Salinity", "Drought", "Frost"].map((name) => { const selected = currentForm.details.tolerance.find((item) => item.name === name); return <span className="admin-tolerance-choice" key={name}><button type="button" className={selected ? "selected" : ""} onClick={() => toggleTolerance(name)}>{name}</button>{selected && <label><input type="checkbox" checked={selected.mild} onChange={() => toggleMildTolerance(name)}/>Mild</label>}</span>; })}</div><small>Select Mild where the printed guide uses the “Mild” qualifier.</small></div>
            <div className="admin-form-grid">
              <label>Maturity measure<select value={currentForm.details.maturityMeasure} onChange={(event) => setDetail("maturityMeasure", event.target.value as any)}><option value="">Not set</option>{["Days to flowering (Perth)", "Heading date", "Time of flowering", "Winter activity rating"].map((value) => <option key={value}>{value}</option>)}</select></label>
              {currentForm.details.maturityMeasure === "Days to flowering (Perth)" && <label>Maturity days<input type="number" min="0" value={currentForm.details.maturityDays ?? ""} onChange={(event) => setNumberDetail("maturityDays", event.target.value)}/></label>}
              {currentForm.details.maturityMeasure === "Heading date" && <label>Heading date<select value={currentForm.details.headingDate} onChange={(event) => setDetail("headingDate", event.target.value as any)}><option value="">Not set</option>{["Very early", "Early", "Mid", "Mid-late", "Late"].map((value) => <option key={value}>{value}</option>)}</select></label>}
              {currentForm.details.maturityMeasure === "Time of flowering" && <label>Flowering window<input value={currentForm.details.floweringWindow} onChange={(event) => setDetail("floweringWindow", event.target.value)} placeholder="e.g. Aug-Nov"/></label>}
              {currentForm.details.maturityMeasure === "Winter activity rating" && <label>Winter activity (1–10)<input type="number" min="1" max="10" value={currentForm.details.winterActivity ?? ""} onChange={(event) => setNumberDetail("winterActivity", event.target.value)}/></label>}
              <label>Inoculant group<select value={currentForm.details.inoculantGroup} onChange={(event) => setDetail("inoculantGroup", event.target.value as any)}>{["None", "C", "G/S", "G", "S", "AL", "AM", "B", "BS", "E", "F/E", "I"].map((value) => <option key={value}>{value}</option>)}</select></label>
            </div>
            <div className="admin-choice-field"><span>Seed treatment</span><div>{["Bare / untreated", "Gaucho", "Thiram", "Goldstrike", "BioNPK Powder S", "Lime coated"].map((value) => <button key={value} type="button" className={currentForm.details.seedTreatment.includes(value as any) ? "selected" : ""} onClick={() => toggleList("seedTreatment", value)}>{value}</button>)}</div></div>
            <label className="admin-check-row"><input type="checkbox" checked={currentForm.details.ecocertApproved} onChange={(event) => setDetail("ecocertApproved", event.target.checked)}/><span><strong>ECOCERT approved</strong><small>Show the organic certification selling point on the product.</small></span></label>
            <div className="admin-choice-field"><span>End use</span><div>{["Grazing", "Hay", "Silage", "Cover crop", "Green manure", "Grain", "Stockfeed", "Permanent pasture", "Erosion control / stabilisation", "Break crop", "Biofumigant", "Turf"].map((value) => <button key={value} type="button" className={currentForm.details.endUse.includes(value as any) ? "selected" : ""} onClick={() => toggleList("endUse", value)}>{value}</button>)}</div></div>
            <div className="admin-choice-field"><span>Livestock</span><div>{["Beef", "Dairy", "Sheep", "Equine", "Goat", "Chicken", "Alpaca", "Weaners", "Lamb finishing"].map((animal) => <button key={animal} type="button" className={(currentForm.details.livestock ?? []).includes(animal as any) ? "selected" : ""} onClick={() => toggleList("livestock", animal)}>{animal}</button>)}</div><small>{(currentForm.details.livestock ?? []).length ? `Suitable for: ${(currentForm.details.livestock ?? []).join(", ")}.` : "Select the livestock this product is suited to."}</small></div>
            <div className="admin-repeat-group">
              <div className="admin-section-heading"><div><h3>Companion species</h3><p>Products customers can sow with this line.</p></div>{viewMode !== "live" && !isArchived && <button className="admin-button outline small" type="button" onClick={() => addStringItem("companionSpecies")}><Icon name="plus" size={16}/>Add product</button>}</div>
              {currentForm.details.companionSpecies.map((value, index) => <div className="admin-repeat-row" key={index}><input list="admin-product-slugs" value={value} onChange={(event) => updateStringItem("companionSpecies", index, event.target.value)} placeholder="Product slug"/>{viewMode !== "live" && !isArchived && <button type="button" onClick={() => removeStringItem("companionSpecies", index)}>×</button>}</div>)}
            </div>
            <div className="admin-form-grid">
              <label className="wide">Disease &amp; pest resistance<textarea rows={3} value={currentForm.details.diseasePestResistance} onChange={(event) => setDetail("diseasePestResistance", event.target.value)}/></label>
              <label>Persistence / longevity<input value={currentForm.details.persistenceLongevity} onChange={(event) => setDetail("persistenceLongevity", event.target.value)} placeholder="e.g. 3–5 years"/></label>
              <label className="wide">Grazing management notes<textarea rows={4} value={currentForm.details.grazingManagementNotes} onChange={(event) => setDetail("grazingManagementNotes", event.target.value)} placeholder="Planting tips and grazing management guidance."/></label>
            </div>
          </section>

          <section className="admin-panel admin-form-card">
            <div><h2>Summary &amp; description</h2><p>The summary sits under the product name; the description becomes the body of the public product page.</p></div>
             <label><span className="admin-label-title">Summary<span className="admin-required-star" aria-hidden="true">*</span></span><small>Required to publish.</small><input value={currentForm.details.summary} onChange={(event) => { setDetail("summary", event.target.value); setField("note", event.target.value); }} placeholder="e.g. The Horse’s Choice. Suitable for all livestock."/></label>
             <label><span className="admin-label-title">Product description<span className="admin-required-star" aria-hidden="true">*</span></span><small>Required to publish. Blank lines between paragraphs are preserved on the public page.</small><textarea rows={7} value={currentForm.details.description} onChange={(event) => setDetail("description", event.target.value)} placeholder="Describe the product, where it performs, and how it is used."/></label>
            <label>Internal notes<small>Not published. Anything the office needs to know about this line.</small><textarea rows={2} value={currentForm.details.notes} onChange={(event) => setDetail("notes", event.target.value)} placeholder="Internal note"/></label>
          </section>

          <section className="admin-panel admin-form-card">
            <div><h2>Commercial &amp; legal</h2><p>Record ownership, certification, supplier, and licence conditions.</p></div>
            <div className="admin-form-grid">
               <label>Price display<input value={currentForm.price} onChange={(event) => setField("price", event.target.value)} placeholder="Contact for pricing"/></label>
              <label>Supplier name<input value={currentForm.details.supplierName} onChange={(event) => setDetail("supplierName", event.target.value)} placeholder="Supplier or breeder"/></label>
              <label>PBR details<input value={currentForm.details.pbrDetails} onChange={(event) => setDetail("pbrDetails", event.target.value)} placeholder="Certificate or registration reference"/></label>
              <label className="wide">Licence restriction<textarea rows={3} value={currentForm.details.licenceRestriction} onChange={(event) => setDetail("licenceRestriction", event.target.value)} placeholder="Licence restrictions or propagation conditions."/></label>
            </div>
            <div className="admin-toggle-grid">
              <label className="admin-check-row"><input type="checkbox" checked={currentForm.details.pbrProtected} onChange={(event) => setDetail("pbrProtected", event.target.checked)}/><span><strong>PBR protected</strong><small>Protected under the Plant Breeders Rights Act.</small></span></label>
              <label className="admin-check-row"><input type="checkbox" checked={currentForm.details.isThirdPartyProduct} onChange={(event) => setDetail("isThirdPartyProduct", event.target.checked)}/><span><strong>Third-party product</strong><small>Bred or supplied outside IH Seeds.</small></span></label>
            </div>
            <div className="admin-choice-field"><span>Certification</span><div>{["ASF Code of Practice", "Certified Quality Assured Seed", "Certified seed", "Licensed production"].map((value) => <button key={value} type="button" className={currentForm.details.certification.includes(value as any) ? "selected" : ""} onClick={() => toggleList("certification", value)}>{value}</button>)}</div></div>
          </section>

          <section className="admin-panel admin-form-card">
            <div className="admin-section-heading"><div><h2>{currentForm.details.recordType === "Mix" ? "Mix components" : "Usage notes"}</h2><p>Link components to product records and store their inclusion rate.</p></div>{viewMode !== "live" && !isArchived && <button className="admin-button outline small" type="button" onClick={() => setDetail("components", [...form.details.components, { productLink: "", speciesName: "", inclusionRate: null, unit: "%", note: "" }])}><Icon name="plus" size={16}/>Add species</button>}</div>
            <label>Formulation year<input value={currentForm.details.formulationYear} onChange={(event) => setDetail("formulationYear", event.target.value)} placeholder="2026"/></label>
             <div className="admin-component-list">{currentForm.details.components.map((component, index) => <div className="admin-component-row admin-component-row-expanded" key={index}><span className="admin-grip">⋮⋮</span><input list="admin-product-slugs" value={component.productLink} onChange={(event) => updateComponent(index, { productLink: event.target.value })} placeholder="Product slug"/><input value={component.speciesName} onChange={(event) => updateComponent(index, { speciesName: event.target.value })} placeholder="Species name"/><input type="number" min="0" step="0.01" value={component.inclusionRate ?? ""} onChange={(event) => updateComponent(index, { inclusionRate: event.target.value === "" ? null : Number(event.target.value) })} placeholder="Rate"/><input value={component.unit} onChange={(event) => updateComponent(index, { unit: event.target.value })} placeholder="%"/><input value={component.note} onChange={(event) => updateComponent(index, { note: event.target.value })} placeholder="Component note"/>{viewMode !== "live" && !isArchived && <button type="button" aria-label="Remove component" onClick={() => removeComponent(index)}>×</button>}</div>)}</div>
          </section>
        </fieldset>

        <div className="admin-editor-aside">
          <section className="admin-panel admin-availability-card" style={viewMode === "live" || isArchived ? { pointerEvents: "none", opacity: 0.8 } : {}}>
            <h2>Availability</h2><p>Shows on catalogue cards and the product page. Wording matches the public availability table.</p>
            <div>{statusOptions.map((status) => <button key={status.value} type="button" className={currentForm.status === status.value ? "selected" : ""} onClick={() => setField("status", status.value as ProductInputStatus)}><i className={`status-dot ${status.value}`}/>{status.label}</button>)}</div>
          </section>

          <fieldset className="admin-panel admin-form-card" disabled={viewMode === "live" || isArchived}>
            <div><h2>Tech sheet</h2><p>Uploaded once here. Powers the product page download and Tech Sheets Hub listing.</p></div>
            <label>PDF path<input value={currentForm.techSheet} onChange={(event) => setField("techSheet", event.target.value)} placeholder="/tech-sheets/product-name.pdf"/></label>
            <div className={`admin-file-state ${currentForm.techSheet ? "attached" : ""}`}><Icon name={currentForm.techSheet ? "file-text" : "plus"} size={22}/><span><strong>{currentForm.techSheet || "Drop a PDF, or choose a file"}</strong><small>{currentForm.techSheet ? "PDF attached to this record" : "Or select one already in the Media Library"}</small></span>{currentForm.techSheet && viewMode !== "live" && !isArchived && <button type="button" onClick={() => setField("techSheet", "")}>Replace</button>}</div>
          </fieldset>

          <fieldset className="admin-panel admin-form-card" disabled={viewMode === "live" || isArchived}>
            <div><h2>Photos</h2><p>Three slots, matching the stocklist. Photo 1 is the hero and catalogue card image.</p></div>
            <div className="admin-photo-list">{currentForm.details.photos.map((photo, index) => <div className="admin-photo-row" key={photo.slot}><span className="admin-photo-thumb">{photo.src ? <img src={photo.src} alt="" /> : <Icon name="plus" size={20}/>}</span><span><small>{photo.slot}</small><strong>{photo.file || "No image attached"}</strong><em>{photo.rating || "Add a photo from the Media Library"}</em></span>{viewMode !== "live" && !isArchived && <button type="button" onClick={() => updatePhoto(index, photo.file ? { file: "", rating: "", src: "" } : { file: `paddock-0${index + 1}.jpeg`, rating: "80% · Good", src: index % 2 ? "/ih-seeds-logo.png" : "/ih-seeds-logo.png" })}>{photo.file ? "Remove" : "Add"}</button>}</div>)}</div>
          </fieldset>

          <section className="admin-panel admin-publishing-card">
            <h2>Publishing</h2>
            {isNew && <p>New products are always created as Draft records first. Publish only when the public catalogue is ready to change.</p>}
            {!isNew && (
              <div className="admin-publish-meta">
                <span><strong>Live:</strong> {formatDate(product?.publishedAt)}</span>
                <span><strong>Draft:</strong> {formatDate(product?.draftSavedAt)}</span>
              </div>
            )}

            <fieldset disabled={viewMode === "live" || isArchived} style={{ border: 0, margin: "12px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: "15px" }}>
              <label>Sort order<input type="number" min="0" value={currentForm.details.sortOrder ?? ""} onChange={(event) => setNumberDetail("sortOrder", event.target.value)} placeholder="0"/></label>
              <label className="admin-check-row"><input type="checkbox" checked={currentForm.details.inCurrentPrintedGuide} onChange={(event) => setDetail("inCurrentPrintedGuide", event.target.checked)}/><span><strong>In the current printed guide</strong><small>Distinguishes current guide products from legacy lines.</small></span></label>
              <label className="admin-check-row"><input type="checkbox" checked={currentForm.details.featured} onChange={(event) => setDetail("featured", event.target.checked)}/><span><strong>Featured product</strong><small>Eligible for promoted catalogue placements.</small></span></label>
            </fieldset>
            {isLive ? <p>Live on public site. Saving this form stores Draft changes — not public — until Publish changes is confirmed.</p> : <p>Draft changes — not public. This record stays hidden until it is explicitly published.</p>}

            {!isNew && !isArchived && <button type="button" className="admin-button ghost" style={{marginTop: "8px", border: "1px solid #c8cec9", color: "#69726c"}} onClick={async () => {
                if (!window.confirm("Archive this product? It will be removed from the public website immediately.")) return;
                try {
                  await archiveMutation.mutateAsync({ id: productId! });
                  await queryClient.invalidateQueries({ queryKey: getListAdminProductsQueryKey() });
      await queryClient.invalidateQueries({ queryKey: getGetAdminSummaryQueryKey() });
                  navigate("/admin/products");
                } catch (archiveError) {
                  setError(archiveError instanceof Error ? archiveError.message : "Unable to archive product.");
                }
              }}>Archive this product</button>}
          </section>

          <fieldset className="admin-panel admin-form-card" disabled={viewMode === "live" || isArchived}>
            <div><h2>SEO &amp; related products</h2><p>Control search snippets and product cross-links.</p></div>
            <label>SEO title<input value={currentForm.details.seoTitle} onChange={(event) => setDetail("seoTitle", event.target.value)} maxLength={180} placeholder={currentForm.name || "Product page title"}/></label>
            <label>SEO description<textarea rows={4} value={currentForm.details.seoDescription} onChange={(event) => setDetail("seoDescription", event.target.value)} maxLength={320} placeholder="Search result description."/></label>
            <div className="admin-repeat-group">
              <div className="admin-section-heading"><div><h3>Related products</h3><p>Use product slugs to create catalogue cross-links.</p></div>{viewMode !== "live" && !isArchived && <button className="admin-button outline small" type="button" onClick={() => addStringItem("relatedProducts")}><Icon name="plus" size={16}/>Add</button>}</div>
              {currentForm.details.relatedProducts.map((value, index) => <div className="admin-repeat-row" key={index}><input list="admin-product-slugs" value={value} onChange={(event) => updateStringItem("relatedProducts", index, event.target.value)} placeholder="related-product-slug"/>{viewMode !== "live" && !isArchived && <button type="button" onClick={() => removeStringItem("relatedProducts", index)}>×</button>}</div>)}
            </div>
          </fieldset>
          {!isNew && <button type="button" className="admin-delete-button" onClick={remove} disabled={saving}>Delete this product completely</button>}
          {error && <p className="admin-form-error" role="alert">{error}</p>}
        </div>
      </form>
    </>
  );
}

import AdminCategories from "./AdminCategories";

export default function Admin() {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const editorMatch = location.match(/^\/admin\/products\/(\d+)$/);
  const isNew = location === "/admin/products/new";
  const productId = editorMatch ? Number(editorMatch[1]) : undefined;

  let content: ReactNode;
  if (isNew) content = <ProductEditor isNew/>;
  else if (productId) content = <ProductEditor isNew={false} productId={productId}/>;
  else if (location === "/admin/products/categories") content = <AdminCategories />;
  else if (location === "/admin/products") content = <ProductTable />;
  else content = <Dashboard />;

  return (
    <AdminLayout mobileOpen={mobileOpen} setMobileOpen={setMobileOpen}>
      {content}
    </AdminLayout>
  );
}
