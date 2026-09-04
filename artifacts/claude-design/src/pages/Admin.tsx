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
  getGetAdminSummaryQueryKey,
  useDryRunProductImport,
  useCommitProductImport
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
  ProductInputPublishStatus,
  SaleLine,
  SaleLineAvailability,
  ProductAvailabilityOverride,
  ProductListingOverride
} from "@workspace/api-client-react";
import "../admin-v2.css";

type ProductStatus = "in-stock" | "low" | "very-low" | "unavailable";
type RecordKind = "Mix" | "Variety" | "Commodity / generic";

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
  productForm: ["", "Powder", "Liquid", "Peat", "Granule"],
  seedForm: ["", "Bare / de-hulled", "Podded", "Coated", "Coated + Gaucho", "BioNPK-S coated", "Goldstrike coated", "Scarified", "Lime coated"],
  seedGrade: ["", "Certified", "Tested", "Certified & Tested", "VNS"],
  availability: ["Good stock", "Low stock", "Very low", "Unavailable"],
  listingOverride: ["", "Force active", "Force legacy"],
  availabilityOverride: ["", "Good stock", "Low stock", "Very low", "Unavailable"]
};

const blankProduct: ProductInput = {
  name: "",
  slug: "",
  price: "Contact for pricing",
  packSize: "25 kg bag",
  status: "in-stock",
  note: "",
  category: "",
  subcategoryId: null,
  techSheet: "",
  guideYear: "",
  descriptionSource: "",
  websiteUrlLegacy: "",
  availabilityOverride: null,
  listingOverride: null,
  publishStatus: "Draft",
  saleLines: [],
  details: {
    stockCode: "",
    guideSection: "",
    recordType: "Variety",
    botanicalName: "",
    alsoKnownAs: [],
    packSizes: [],
    treatment: "",
    persistencyType: "" as any,
    ploidy: "" as any,
    flowerColour: "" as any,
    bredByOrigin: "",
    australianBred: false,
    distributedBy: "IH Seeds",
    sowingRates: [],
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
    standLifeNotes: "",
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
    components: [],
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
    headingOffsetDays: null,
    argtResistant: false,
    endophyte: "",
    growthSeason: "",
    hardSeedLevel: "",
    oestrogenLevel: "",
    bloatRisk: "",
    growingSeason: "",
    weeksToFirstGrazing: "",
    prussicAcidRisk: "",
    regrowth: "",
    productForm: "",
    applicationRate: ""
  }
};

const statusOptions: { value: ProductStatus; label: string }[] = [
  { value: "in-stock", label: "Good stock" },
  { value: "low", label: "Low stock" },
  { value: "very-low", label: "Very low" },
  { value: "unavailable", label: "Unavailable" },
];

const formatDate = (value: string | null | undefined) =>
  value ? new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "Never";

function getTabFields(tab: number, form: any) {
  const c = form.category;
  const isRyegrass = c === "Ryegrasses";
  const isClover = c === "Clovers";
  const isSerradella = c === "Serradellas & Medics";
  const isLucerne = c === "Lucerne";
  const isFescue = c === "Fescues & Other Grasses";
  const isSubTropical = c === "Sub-Tropical Grasses";
  const isHerb = c === "Herbs";
  const isForage = c === "Forage & Grain Crops";
  const isMix = c === "Mixes";
  const isBio = c === "Biologicals";
  
  if (tab === 1) {
    return ["name", "slug", "category", "details.recordType"];
  }
  if (tab === 2) {
    if (isBio) return ["details.applicationRate"]; 
    return ["details.sowingRates"];
  }
  if (tab === 3) {
    let f: string[] = [];
    if (isRyegrass || isFescue || isSubTropical) f.push("details.ploidy");
    if (isRyegrass || isFescue) f.push("details.headingDate", "details.endophyte");
    if (isRyegrass) f.push("details.headingOffsetDays", "details.argtResistant");
    if (isClover || isSerradella) f.push("details.maturityDays", "details.hardSeedLevel", "details.bloatRisk", "details.flowerColour");
    if (isClover) f.push("details.oestrogenLevel");
    if (isLucerne) f.push("details.winterActivity");
    if (isFescue || isSubTropical) f.push("details.growthSeason");
    if (isForage) f.push("details.growingSeason", "details.weeksToFirstGrazing", "details.prussicAcidRisk", "details.regrowth");
    if (isMix) f.push("details.floweringWindow", "details.formulationYear", "details.components");
    if (isBio) f.push("details.productForm", "details.applicationRate");
    return f;
  }
  if (tab === 4) {
    return ["saleLines"];
  }
  if (tab === 5) {
    return ["details.summary", "details.description"];
  }
  return [];
}

function getFieldHasValue(form: any, field: string) {
  let val;
  if (field.startsWith("details.")) val = form.details ? form.details[field.split(".")[1]] : undefined;
  else val = form[field];
  
  if (Array.isArray(val)) return val.length > 0;
  if (typeof val === "boolean") return true; 
  return val !== null && val !== "" && val !== undefined;
}

function getOverallCompleteness(form: any) {
  if (!form || !form.category) return 0;
  let fields: string[] = [];
  for (let i = 1; i <= 5; i++) fields = fields.concat(getTabFields(i, form));
  if (fields.length === 0) return 100;
  const filled = fields.filter(f => getFieldHasValue(form, f)).length;
  return Math.round((filled / fields.length) * 100);
}

function TabCompleteness({ form, tab }: { form: any, tab: number }) {
  if (!form.category) return null;
  const fields = getTabFields(tab, form);
  if (fields.length === 0) return null;
  const filled = fields.filter(f => getFieldHasValue(form, f)).length;
  return <span className={`admin-v2-tab-counts ${filled === fields.length ? 'complete' : ''}`}>{filled} / {fields.length}</span>;
}

function getDerivedAvailability(product: any) {
  if (product.availabilityOverride) return product.availabilityOverride;
  if (!product.saleLines || product.saleLines.length === 0) return "Unavailable";
  const levels = OPTS.availability;
  let best = 3;
  let hasKnownAvailability = false;
  product.saleLines.forEach((line: any) => {
    const idx = levels.indexOf(line.availability);
    if (idx !== -1) {
      hasKnownAvailability = true;
      if (idx < best) best = idx;
    }
  });
  return hasKnownAvailability ? levels[best] : "TBA";
}

function getListingState(product: any) {
  if (product.listingOverride === "Force active") return "Active";
  if (product.listingOverride === "Force legacy") return "Legacy";
  if (!product.saleLines || product.saleLines.length === 0) return "Legacy";
  const hasActiveLine = product.saleLines.some((l: any) => l.availability !== "Unavailable");
  return hasActiveLine ? "Active" : "Legacy";
}

function getStockCodesSummary(product: any) {
  if (!product.saleLines || product.saleLines.length === 0) return "—";
  return product.saleLines.map((l: any) => l.stockCode).join(", ");
}

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
  const { data: taxonomy = [] } = useListAdminCategories();
  const updateProduct = useUpdateProduct();
  const publishProduct = usePublishProduct();
  const archiveProduct = useArchiveProduct();
  const restoreProduct = useRestoreProduct();
  const discardDraft = useDiscardProductDraft();
  const deleteProduct = useDeleteProduct();
  const queryClient = useQueryClient();
  const dryRunImport = useDryRunProductImport();
  const commitImport = useCommitProductImport();

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [listingFilter, setListingFilter] = useState("");
  const [view, setView] = useState<"Published" | "Draft" | "Archived">(() => {
    const requestedView = new URLSearchParams(window.location.search).get("view");
    return requestedView === "Draft" || requestedView === "Archived" ? requestedView : "Published";
  });
  const [selected, setSelected] = useState<number[]>([]);
  const [bulkStatus, setBulkStatus] = useState<ProductInputStatus>("in-stock");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  
  const [importing, setImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importReport, setImportReport] = useState<any | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setImportFile(e.target.files[0]);
    }
  };

  const handleDryRun = () => {
    if (!importFile) return;
    setImporting(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = (reader.result as string).split(',')[1];
        const res = await dryRunImport.mutateAsync({ data: { workbookBase64: base64 } }) as any;
        setImportReport({ ...res, base64 });
      } catch (err) {
        setImportReport({ error: err instanceof Error ? err.message : "Upload failed" });
      } finally {
        setImporting(false);
      }
    };
    reader.readAsDataURL(importFile);
  };

  const handleCommitImport = async () => {
    if (!importReport?.token) return;
    setImporting(true);
    try {
      await commitImport.mutateAsync({ data: { workbookBase64: importReport.base64, token: importReport.token } });
      await queryClient.invalidateQueries({ queryKey: getListAdminProductsQueryKey(), refetchType: "all" });
      await queryClient.invalidateQueries({ queryKey: getGetAdminSummaryQueryKey() });
      setImportFile(null);
      setImportReport(null);
      setMessage("Catalogue imported successfully.");
    } catch (err) {
      setImportReport({ ...importReport, error: err instanceof Error ? err.message : "Commit failed" });
    } finally {
      setImporting(false);
    }
  };

  const exportCatalogue = () => {
    window.location.href = "/api/admin/import/export";
  };

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
      (!statusFilter || product.status === statusFilter) &&
      (!categoryFilter || product.category === categoryFilter) &&
      (!listingFilter || getListingState(product) === listingFilter)
    )
    .sort((first, second) => {
      const firstActivity = first.draftSavedAt ?? first.updatedAt;
      const secondActivity = second.draftSavedAt ?? second.updatedAt;
      const dateDifference = Date.parse(secondActivity ?? "") - Date.parse(firstActivity ?? "");
      return Number.isNaN(dateDifference) || dateDifference === 0 ? second.id - first.id : dateDifference;
    }), [products, query, statusFilter, view, categoryFilter, listingFilter]);

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
      <PageHeader eyebrow="Content" title={<>Products &amp; <strong>mixes</strong></>} action={<div style={{ display: 'flex', gap: 12 }}><button className="admin-button outline" data-testid="export-btn" onClick={exportCatalogue}>Export catalogue (XLSX)</button><button className="admin-button outline" style={{ width: 46, padding: 0 }} aria-label="Taxonomy settings" onClick={() => navigate("/admin/products/categories")}><Icon name="settings" size={18}/></button><button className="admin-button primary" onClick={() => navigate("/admin/products/new")}><Icon name="plus" size={18}/>Add a product</button></div>} />
      <div className="admin-content">
        <div className="admin-import-panel">
          <h2>Import catalogue</h2>
          {!importReport ? (
            <div style={{display:'flex', gap:12, alignItems:'center'}}>
              <input type="file" accept=".xlsx" data-testid="import-file" onChange={handleFileChange} />
              <button className="admin-button outline small" data-testid="dry-run-btn" onClick={handleDryRun} disabled={!importFile || importing}>{importing ? "Processing..." : "Dry run import"}</button>
            </div>
          ) : (
            <div>
              <div className="admin-import-report">
                {importReport.error ? (
                  <p style={{color:'red'}}>{importReport.error}</p>
                ) : (
                  <>
                    <p><strong>Dry run successful.</strong> Review planned changes before committing.</p>
                    {importReport.plannedChanges?.length > 0 && (
                      <ul>{importReport.plannedChanges.map((c: string, i: number) => <li key={i}>{c}</li>)}</ul>
                    )}
                    {importReport.warnings?.length > 0 && (
                      <ul>{importReport.warnings.map((c: string, i: number) => <li key={i} style={{color:'#af7909'}}>{c}</li>)}</ul>
                    )}
                    {importReport.issues?.length > 0 && (
                      <ul>{importReport.issues.map((issue: any, i: number) => <li key={i} style={{color:'red'}}>Sheet "{issue.sheet}" row {issue.row} col {issue.column}: {issue.problem}</li>)}</ul>
                    )}
                  </>
                )}
              </div>
              <div className="admin-import-actions">
                <button className="admin-button outline small" onClick={() => { setImportReport(null); setImportFile(null); }}>Cancel</button>
                {!importReport.error && importReport.issues?.length === 0 && (
                  <button className="admin-button primary small" data-testid="commit-import-btn" onClick={handleCommitImport} disabled={importing}>{importing ? "Committing..." : "Confirm import"}</button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="admin-table-tabs">
          <button className={view === "Published" ? "active" : ""} data-testid="tab-published" onClick={() => setView("Published")}>Published <span>{publishedCount}</span></button>
          <button className={view === "Draft" ? "active" : ""} onClick={() => setView("Draft")}>Draft <span>{draftCount}</span></button>
          <button className={view === "Archived" ? "active" : ""} onClick={() => setView("Archived")}>Archive <span>{archivedCount}</span></button>
        </div>
        <div className="admin-table-tools">
          <label className="admin-search"><Icon name="search" size={18}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products" /></label>
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} aria-label="Filter by category"><option value="">All categories</option>{Array.from(new Set(products.map(p => p.category).filter(Boolean))).map(c => <option key={c} value={c}>{c}</option>)}</select>
          <select value={listingFilter} onChange={(event) => setListingFilter(event.target.value)} aria-label="Filter by listing"><option value="">All listing states</option><option value="Active">Active</option><option value="Legacy">Legacy</option></select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by status"><option value="">All statuses</option>{statusOptions.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select>
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
            <thead><tr><th aria-label="Select"></th><th>Product</th><th>Category</th><th>Listing state</th><th>Status</th><th>Completeness</th><th>Availability</th><th>Stock codes</th><th>Updated</th><th></th></tr></thead>
            <tbody>
              {isLoading ? <tr><td colSpan={10} className="admin-empty">Loading catalogue…</td></tr> : rows.map((product) => {
                const completeness = getOverallCompleteness(product);
                const listingState = getListingState(product);
                return (
                <tr key={product.id}>
                  <td>{view !== "Archived" && <input type="checkbox" checked={selected.includes(product.id)} onChange={() => setSelected((current) => current.includes(product.id) ? current.filter((id) => id !== product.id) : [...current, product.id])} aria-label={`Select ${product.name}`}/>}</td>
                  <td>
                    <button className="admin-product-name" onClick={() => navigate(`/admin/products/${product.id}`)}>{product.name}</button>
                    {view === "Published" && <span className="admin-version-copy">Live on public site</span>}
                    {view === "Published" && product.hasDraft && <span className="admin-badge pending">Changes pending</span>}
                    {view === "Draft" && <span className="admin-version-copy">Draft changes — not public</span>}
                    {product.lifecycleStatus === "Draft" && <span className="admin-badge draft">Draft only</span>}
                    <div className="admin-row-actions admin-mobile-row-actions">{renderRowActions(product)}</div>
                  </td>
                  <td>{product.category}<small>{product.subcategoryId ? taxonomy.find((t: any) => t.id === product.subcategoryId)?.name : ""}</small></td>
                  <td><span className={`admin-listing-badge ${listingState.toLowerCase()}`}>{listingState}</span></td>
                  <td><StatusPill status={product.status as any}/></td>
                  <td>
                    <div className="admin-v2-completeness" title={`${completeness}% complete`}>
                      <div className="admin-v2-completeness-bar"><div className="admin-v2-completeness-fill" style={{width: `${completeness}%`}}></div></div>
                      {completeness}%
                    </div>
                  </td>
                  <td>{getDerivedAvailability(product)}</td>
                  <td><small>{getStockCodesSummary(product)}</small></td>
                  <td>{formatDate(product.updatedAt)}</td>
                  <td>
                    <div className="admin-row-actions">
                      {renderRowActions(product)}
                    </div>
                  </td>
                </tr>
              )})}
              {!isLoading && rows.length === 0 && <tr><td colSpan={10} className="admin-empty">No products match those filters.</td></tr>}
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

  const toForm = (item?: any): any => {
    if (!item) return structuredClone(blankProduct);
    const raw = (item.details ?? {}) as any;
    const legacyRainfall = Number.parseFloat(raw.rainfall ?? "");
    const legacySoil = raw.soil ?? [];
    const tolerance = (raw.tolerance ?? []).map((value: any) => typeof value === "string" ? { name: value, mild: false } : value);
    const components = (raw.components ?? []).map((value: any) => "speciesName" in value ? value : {
      productLink: "",
      speciesName: value.name ?? "",
      inclusionRate: null,
      unit: "%",
      note: value.note ?? "",
    });
    return {
      name: item.name,
      slug: item.slug,
      price: item.price,
      packSize: item.packSize,
      status: item.status,
      note: item.note,
      category: item.category,
      subcategoryId: item.subcategoryId ?? null,
      techSheet: item.techSheet,
      publishStatus: item.publishStatus || "Draft",
      guideYear: item.guideYear || "",
      descriptionSource: item.descriptionSource || "",
      websiteUrlLegacy: item.websiteUrlLegacy || "",
      availabilityOverride: item.availabilityOverride || "",
      listingOverride: item.listingOverride || "",
      saleLines: item.saleLines || [],
      details: {
        ...blankProduct.details,
        ...raw,
        recordType: raw.recordType ?? raw.kind ?? "Mix",
        packSizes: raw.packSizes?.length ? raw.packSizes : [{ label: "Standard", size: null, unit: item.packSize }],
        sowingRates: raw.sowingRates?.length ? raw.sowingRates : [{ context: "Pasture" as any, min: null, max: null, unit: "kg/ha" }],
        rainfallMinMm: raw.rainfallMinMm ?? (Number.isFinite(legacyRainfall) ? legacyRainfall : null),
        soilRangeLightest: raw.soilRangeLightest ?? legacySoil[0] ?? "",
        soilRangeHeaviest: raw.soilRangeHeaviest ?? legacySoil.at(-1) ?? "",
        tolerance,
        floweringWindow: raw.floweringWindow ?? raw.flowering ?? "",
        inoculantGroup: raw.inoculantGroup ?? raw.inoculant ?? "None",
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

  const [form, setForm] = useState<any>(() => blankProduct);
  const [viewMode, setViewMode] = useState<"draft" | "live">("draft");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState(1);

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

  const setField = (key: string, value: any) => setForm((current: any) => ({ ...current, [key]: value }));
  const setDetail = (key: string, value: any) => setForm((current: any) => ({ ...current, details: { ...current.details, [key]: value } }));
  const toggleList = (key: string, value: string) => {
    const current = (form.details[key] as string[]) ?? [];
    setDetail(key, (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]));
  };
  const setNumberDetail = (key: string, value: string) =>
    setDetail(key, value === "" ? null : Number(value));
  const updateStringItem = (key: string, index: number, value: string) =>
    setDetail(key, form.details[key].map((item: string, itemIndex: number) => itemIndex === index ? value : item));
  const removeStringItem = (key: string, index: number) =>
    setDetail(key, form.details[key].filter((_: any, itemIndex: number) => itemIndex !== index));
  const addStringItem = (key: string) => setDetail(key, [...form.details[key], ""]);
  
  const updateSaleLine = (index: number, patch: Partial<SaleLine>) => setField("saleLines", form.saleLines.map((item: any, itemIndex: number) => itemIndex === index ? { ...item, ...patch } : item));
  const removeSaleLine = (index: number) => setField("saleLines", form.saleLines.filter((_: any, itemIndex: number) => itemIndex !== index));
  const addSaleLine = () => setField("saleLines", [...form.saleLines, { stockCode: "", seedForm: "", seedGrade: "", packKg: null, packUnit: "kg", availability: "Good stock", priceDisplay: "Contact for pricing", isDefault: form.saleLines.length === 0, sortOrder: form.saleLines.length }]);

  const updatePackSize = (index: number, patch: Partial<ProductPackSize>) => setDetail("packSizes", form.details.packSizes.map((item: any, itemIndex: number) => itemIndex === index ? { ...item, ...patch } : item));
  const updateSowingRate = (index: number, patch: Partial<ProductSowingRate>) => setDetail("sowingRates", form.details.sowingRates.map((item: any, itemIndex: number) => itemIndex === index ? { ...item, ...patch } : item));
  const toggleTolerance = (name: string) => {
    const existing = form.details.tolerance.find((item: any) => item.name === name);
    setDetail("tolerance", existing ? form.details.tolerance.filter((item: any) => item.name !== name) : [...form.details.tolerance, { name, mild: false }]);
  };
  const toggleMildTolerance = (name: string) => setDetail("tolerance", form.details.tolerance.map((item: any) => item.name === name ? { ...item, mild: !item.mild } : item));
  const updateComponent = (index: number, patch: Partial<ProductComponent>) => setDetail("components", form.details.components.map((item: any, itemIndex: number) => itemIndex === index ? { ...item, ...patch } : item));
  const removeComponent = (index: number) => setDetail("components", form.details.components.filter((_: any, itemIndex: number) => itemIndex !== index));
  const updatePhoto = (index: number, patch: Partial<ProductPhoto>) => setDetail("photos", form.details.photos.map((item: any, itemIndex: number) => itemIndex === index ? { ...item, ...patch } : item));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const action = submitter?.value; 

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

    const payload = {
      ...form,
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
    ? taxonomy.find((category: any) => category.id === currentForm.subcategoryId)
    : undefined;
  const selectedRoot = selectedTaxonomy?.parentId === null
    ? selectedTaxonomy
    : selectedTaxonomy?.parentId
      ? taxonomy.find((category: any) => category.id === selectedTaxonomy.parentId)
      : taxonomy.find((category: any) => category.parentId === null && category.name === currentForm.category);
  const rootOptions = taxonomy
    .filter((category: any) => category.parentId === null && (category.active || category.id === selectedRoot?.id))
    .sort((first: any, second: any) => first.sortOrder - second.sortOrder);
  const childOptions = selectedRoot
    ? taxonomy
      .filter((category: any) => category.parentId === selectedRoot.id && (category.active || category.id === selectedTaxonomy?.id))
      .sort((first: any, second: any) => first.sortOrder - second.sortOrder)
    : [];

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = Number(e.target.value);
    const root = taxonomy.find((category: any) => category.id === newId);
    if (currentForm.category && window.confirm("Changing category will hide fields specific to the current category. Continue?")) {
      setField("category", root?.name ?? "");
      setField("subcategoryId", root?.id ?? null);
      if (root) {
        // Preset maturity measure based on category as requested
        if (root.name === "Ryegrasses" || root.name === "Fescues & Other Grasses") setDetail("maturityMeasure", "Heading date");
        else if (root.name === "Clovers" || root.name === "Serradellas & Medics") setDetail("maturityMeasure", "Days to flowering (Perth)");
        else if (root.name === "Lucerne") setDetail("maturityMeasure", "Winter activity rating");
        else if (root.name === "Mixes") setDetail("maturityMeasure", "Time of flowering");
        else setDetail("maturityMeasure", "");
      }
    } else if (!currentForm.category) {
      setField("category", root?.name ?? "");
      setField("subcategoryId", root?.id ?? null);
      if (root) {
        if (root.name === "Ryegrasses" || root.name === "Fescues & Other Grasses") setDetail("maturityMeasure", "Heading date");
        else if (root.name === "Clovers" || root.name === "Serradellas & Medics") setDetail("maturityMeasure", "Days to flowering (Perth)");
        else if (root.name === "Lucerne") setDetail("maturityMeasure", "Winter activity rating");
        else if (root.name === "Mixes") setDetail("maturityMeasure", "Time of flowering");
        else setDetail("maturityMeasure", "");
      }
    }
  };

  const category = currentForm.category;
  const isRyegrass = category === "Ryegrasses";
  const isClover = category === "Clovers";
  const isSerradella = category === "Serradellas & Medics";
  const isLucerne = category === "Lucerne";
  const isFescue = category === "Fescues & Other Grasses";
  const isSubTropical = category === "Sub-Tropical Grasses";
  const isHerb = category === "Herbs";
  const isForage = category === "Forage & Grain Crops";
  const isMix = category === "Mixes";
  const isBio = category === "Biologicals";
  const hideInoculant = isRyegrass || isFescue || isSubTropical || isHerb || isMix || isBio;

  const completeness = getOverallCompleteness(currentForm);

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
        <div className="admin-editor-version" style={{display: 'flex', gap: 16, alignItems: 'center'}}>
          {isNew || !isLive ? "Draft changes — not public" : viewMode === "live" ? "Live on public site · read-only" : "Draft changes — not public"}
          <div className="admin-v2-completeness" title={`${completeness}% complete`}>
            <div className="admin-v2-completeness-bar"><div className="admin-v2-completeness-fill" style={{width: `${completeness}%`}}></div></div>
            {completeness}%
          </div>
        </div>
      </div>

      <div className="admin-editor admin-claude-editor" style={{maxWidth: 1040, display: "block"}}>
        <div className="admin-v2-tabs">
          <button type="button" className={`admin-v2-tab ${activeTab === 1 ? 'active' : ''}`} onClick={() => setActiveTab(1)}>Basics <TabCompleteness form={currentForm} tab={1} /></button>
          <button type="button" disabled={!category} className={`admin-v2-tab ${activeTab === 2 ? 'active' : ''}`} onClick={() => setActiveTab(2)}>Agronomy &amp; fit <TabCompleteness form={currentForm} tab={2} /></button>
          <button type="button" disabled={!category} className={`admin-v2-tab ${activeTab === 3 ? 'active' : ''}`} onClick={() => setActiveTab(3)}>Category-specific <TabCompleteness form={currentForm} tab={3} /></button>
          <button type="button" disabled={!category} className={`admin-v2-tab ${activeTab === 4 ? 'active' : ''}`} onClick={() => setActiveTab(4)}>Selling <TabCompleteness form={currentForm} tab={4} /></button>
          <button type="button" disabled={!category} className={`admin-v2-tab ${activeTab === 5 ? 'active' : ''}`} onClick={() => setActiveTab(5)}>Content &amp; publishing <TabCompleteness form={currentForm} tab={5} /></button>
        </div>

        <form id="admin-product-form" onSubmit={submit}>
          <datalist id="admin-product-slugs">{products.filter((item) => item.id !== product?.id).map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}</datalist>
          <fieldset className="admin-editor-main" disabled={viewMode === "live" || isArchived}>
            {error && <div className="admin-notice" style={{color: "red"}}><p>{error}</p></div>}
            
            {activeTab === 1 && (
              <section className="admin-panel admin-form-card">
                <h2>Basics</h2>
                <div className="admin-form-grid">
                   <label><span className="admin-label-title">Product name<span className="admin-required-star" aria-hidden="true">*</span></span><input required value={currentForm.name} onChange={(event) => setField("name", event.target.value)} placeholder="e.g. SouWest™ Pasture Mix"/></label>
                   <label><span className="admin-label-title">Slug<span className="admin-required-star" aria-hidden="true">*</span></span><input disabled={!isNew} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={currentForm.slug} onChange={(event) => setField("slug", event.target.value.toLowerCase())} placeholder="souwest-pasture-mix"/></label>
                   <label><span className="admin-label-title">Category<span className="admin-required-star" aria-hidden="true">*</span></span>
                     <select value={selectedRoot?.id ?? ""} disabled={loadingTaxonomy || Boolean(taxonomyError)} onChange={handleCategoryChange}>
                      <option value="">Select a category</option>
                       {rootOptions.map((category: any) => <option key={category.id} value={category.id}>{category.name}{!category.active ? " (Inactive)" : ""}</option>)}
                    </select>
                  </label>
                  <label><span className="admin-label-title">Subcategory</span>
                     <select value={selectedTaxonomy && selectedTaxonomy.parentId === selectedRoot?.id ? selectedTaxonomy.id : ""} onChange={(event) => setField("subcategoryId", event.target.value ? Number(event.target.value) : selectedRoot?.id ?? null)} disabled={!selectedRoot || loadingTaxonomy || Boolean(taxonomyError)}>
                      <option value="">None</option>
                       {childOptions.map((category: any) => <option key={category.id} value={category.id}>{category.name}{!category.active ? " (Inactive)" : ""}</option>)}
                    </select>
                  </label>
                  <div className="admin-choice-field wide"><span className="admin-label-title">Record type<span className="admin-required-star" aria-hidden="true">*</span></span><div>{(["Mix", "Variety", "Commodity / generic"] as RecordKind[]).map((kind) => <button key={kind} type="button" className={currentForm.details.recordType === kind ? "selected" : ""} onClick={() => setDetail("recordType", kind as any)}>{kind}</button>)}</div></div>
                  {!isMix && <label>Botanical name<input value={currentForm.details.botanicalName} onChange={(event) => setDetail("botanicalName", event.target.value)} placeholder="e.g. Lolium multiflorum"/></label>}
                  <label>Persistency type<select value={currentForm.details.persistencyType} onChange={(event) => setDetail("persistencyType", event.target.value as any)}><option value="">Not set</option>{["Annual", "Biennial", "Perennial", "Hybrid perennial", "Short-term (1–2 years)"].map((value) => <option key={value}>{value}</option>)}</select></label>
                  {!isMix && <label>Bred by / origin<input value={currentForm.details.bredByOrigin} onChange={(event) => setDetail("bredByOrigin", event.target.value)} placeholder="e.g. Agricom (NZ)"/></label>}
                  <label className="admin-check-row"><input type="checkbox" checked={currentForm.details.australianBred} onChange={(event) => setDetail("australianBred", event.target.checked)}/><span><strong>Australian bred</strong></span></label>
                  <label>Distributed by<input value={currentForm.details.distributedBy} onChange={(event) => setDetail("distributedBy", event.target.value)} placeholder="IH Seeds"/></label>
                </div>
                <div className="admin-repeat-group">
                  <div className="admin-section-heading"><div><h3>Also known as</h3></div>{viewMode !== "live" && !isArchived && <button className="admin-button outline small" type="button" onClick={() => addStringItem("alsoKnownAs")}><Icon name="plus" size={16}/>Add name</button>}</div>
                  {currentForm.details.alsoKnownAs.map((alias: string, index: number) => <div className="admin-repeat-row" key={index}><input value={alias} onChange={(event) => updateStringItem("alsoKnownAs", index, event.target.value)} placeholder="Alternative name"/>{viewMode !== "live" && !isArchived && <button type="button" onClick={() => removeStringItem("alsoKnownAs", index)} aria-label="Remove alternative name">×</button>}</div>)}
                </div>
              </section>
            )}

            {activeTab === 2 && (
              <section className="admin-panel admin-form-card">
                <h2>Agronomy &amp; fit</h2>
                {isBio ? (
                  <label>Application notes <textarea value={currentForm.details.notes} onChange={(e) => setDetail("notes", e.target.value)} rows={4} /></label>
                ) : (
                  <>
                    <div className="admin-repeat-group">
                      <div className="admin-section-heading"><div><h3>Sowing rates</h3></div>{viewMode !== "live" && !isArchived && <button className="admin-button outline small" type="button" onClick={() => setDetail("sowingRates", [...form.details.sowingRates, { context: "Pasture", min: null, max: null, unit: "kg/ha" }])}><Icon name="plus" size={16}/>Add rate</button>}</div>
                      {currentForm.details.sowingRates.map((rate: any, index: number) => <div className="admin-repeat-row admin-repeat-row-rate" key={index}><select value={rate.context} onChange={(event) => updateSowingRate(index, { context: event.target.value as any })}>{["Monoculture", "In a mix", "Dryland", "Irrigation", "Pasture", "Turf", "General", "Podded", "De-hulled", "Coated"].map((value) => <option key={value}>{value}</option>)}</select><input type="number" min="0" step="0.01" value={rate.min ?? ""} onChange={(event) => updateSowingRate(index, { min: event.target.value === "" ? null : Number(event.target.value) })} placeholder="Min"/><input type="number" min="0" step="0.01" value={rate.max ?? ""} onChange={(event) => updateSowingRate(index, { max: event.target.value === "" ? null : Number(event.target.value) })} placeholder="Max"/><input value={rate.unit} onChange={(event) => updateSowingRate(index, { unit: event.target.value })} placeholder="kg/ha"/>{viewMode !== "live" && !isArchived && <button type="button" onClick={() => setDetail("sowingRates", form.details.sowingRates.filter((_: any, itemIndex: number) => itemIndex !== index))} aria-label="Remove sowing rate">×</button>}</div>)}
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
                    <div className="admin-choice-field"><span>Tolerance (Off / On / Mild)</span><div>{["Low pH", "Waterlogging", "Salinity", "Drought", "Frost"].map((name) => { const selected = currentForm.details.tolerance.find((item: any) => item.name === name); return <span className="admin-tolerance-choice" key={name}><button type="button" className={selected ? "selected" : ""} onClick={() => toggleTolerance(name)}>{name}</button>{selected && <label><input type="checkbox" checked={selected.mild} onChange={() => toggleMildTolerance(name)}/>Mild</label>}</span>; })}</div></div>
                    <div className="admin-choice-field"><span>End use</span><div>{["Grazing", "Hay", "Silage", "Cover crop", "Green manure", "Grain", "Stockfeed", "Permanent pasture", "Erosion control / stabilisation", "Break crop", "Biofumigant", "Turf"].map((value) => <button key={value} type="button" className={currentForm.details.endUse.includes(value as any) ? "selected" : ""} onClick={() => toggleList("endUse", value)}>{value}</button>)}</div></div>
                    <div className="admin-choice-field"><span>Livestock</span><div>{["Beef", "Dairy", "Sheep", "Equine", "Goat", "Chicken", "Alpaca", "Weaners", "Lamb finishing"].map((value) => <button key={value} type="button" className={currentForm.details.livestock.includes(value as any) ? "selected" : ""} onClick={() => toggleList("livestock", value)}>{value}</button>)}</div></div>
                    <div className="admin-repeat-group">
                      <div className="admin-section-heading"><div><h3>Companion species</h3></div>{viewMode !== "live" && !isArchived && <button className="admin-button outline small" type="button" onClick={() => addStringItem("companionSpecies")}><Icon name="plus" size={16}/>Add companion</button>}</div>
                      {currentForm.details.companionSpecies.map((alias: string, index: number) => <div className="admin-repeat-row" key={index}><input value={alias} onChange={(event) => updateStringItem("companionSpecies", index, event.target.value)} placeholder="e.g. Sub clover"/>{viewMode !== "live" && !isArchived && <button type="button" onClick={() => removeStringItem("companionSpecies", index)} aria-label="Remove item">×</button>}</div>)}
                    </div>
                    {!hideInoculant && <label>Inoculant group<select value={currentForm.details.inoculantGroup} onChange={(event) => setDetail("inoculantGroup", event.target.value as any)}>{["None", "C", "G/S", "G", "S", "AL", "AM", "B", "BS", "E", "F/E", "I"].map((value) => <option key={value}>{value}</option>)}</select></label>}
                    {isMix && <label className="admin-check-row"><input type="checkbox" checked={currentForm.details.ecocertApproved} onChange={(event) => setDetail("ecocertApproved", event.target.checked)}/><span><strong>ECOCERT approved</strong></span></label>}
                    <label>Disease &amp; pest resistance<textarea value={currentForm.details.diseasePestResistance} onChange={(e) => setDetail("diseasePestResistance", e.target.value)} rows={3}/></label>
                    <label>Stand life notes<textarea value={currentForm.details.standLifeNotes} onChange={(e) => setDetail("standLifeNotes", e.target.value)} rows={3}/></label>
                    <label>Grazing management notes<textarea value={currentForm.details.grazingManagementNotes} onChange={(e) => setDetail("grazingManagementNotes", e.target.value)} rows={3}/></label>
                  </>
                )}
              </section>
            )}

            {activeTab === 3 && (
              <section className="admin-panel admin-form-card">
                <h2>{category ? `${category} specifics` : "Category specifics"}</h2>
                {!category ? <p>Please select a category in the Basics tab first.</p> :
                 isHerb ? <p>No category-specific fields for herbs.</p> :
                 <div className="admin-form-grid">
                   {(isRyegrass || isFescue || isSubTropical || isMix) && (
                     <label>Ploidy <select value={currentForm.details.ploidy} onChange={(e) => setDetail("ploidy", e.target.value)}>{OPTS.ploidy.map(o => <option key={o} value={o}>{o || "Not set"}</option>)}</select></label>
                   )}
                   {(isRyegrass || isFescue) && (
                     <>
                       <label>Heading date <select value={currentForm.details.headingDate} onChange={(e) => setDetail("headingDate", e.target.value)}>{OPTS.headingDate.map(o => <option key={o} value={o}>{o || "Not set"}</option>)}</select></label>
                       <label>Endophyte <select value={currentForm.details.endophyte} onChange={(e) => setDetail("endophyte", e.target.value)}>{OPTS.endophyte.map(o => <option key={o} value={o}>{o || "Not set"}</option>)}</select></label>
                     </>
                   )}
                   {isRyegrass && (
                     <>
                       <label>Heading offset days <input type="number" value={currentForm.details.headingOffsetDays ?? ""} onChange={(e) => setNumberDetail("headingOffsetDays", e.target.value)} /></label>
                       <label className="admin-check-row"><input type="checkbox" checked={currentForm.details.argtResistant} onChange={(e) => setDetail("argtResistant", e.target.checked)}/><span><strong>ARGT resistant</strong></span></label>
                     </>
                   )}
                   {(isClover || isSerradella) && (
                     <>
                       <label>Maturity days (Perth) <input type="number" value={currentForm.details.maturityDays ?? ""} onChange={(e) => setNumberDetail("maturityDays", e.target.value)} /></label>
                       <label>Hard seed level <select value={currentForm.details.hardSeedLevel} onChange={(e) => setDetail("hardSeedLevel", e.target.value)}>{OPTS.hardSeedLevel.map(o => <option key={o} value={o}>{o || "Not set"}</option>)}</select></label>
                       <label>Bloat risk <select value={currentForm.details.bloatRisk} onChange={(e) => setDetail("bloatRisk", e.target.value)}>{OPTS.bloatRisk.map(o => <option key={o} value={o}>{o || "Not set"}</option>)}</select></label>
                       <label>Flower colour <select value={currentForm.details.flowerColour} onChange={(e) => setDetail("flowerColour", e.target.value)}>{["", "Pink", "Yellow", "White", "Crimson", "Red", "Purple"].map(o => <option key={o} value={o}>{o || "Not set"}</option>)}</select></label>
                     </>
                   )}
                   {isClover && <label>Oestrogen level <select value={currentForm.details.oestrogenLevel} onChange={(e) => setDetail("oestrogenLevel", e.target.value)}>{OPTS.oestrogenLevel.map(o => <option key={o} value={o}>{o || "Not set"}</option>)}</select></label>}
                   {isLucerne && <label>Winter activity (1–10) <input type="number" min="1" max="10" value={currentForm.details.winterActivity ?? ""} onChange={(e) => setNumberDetail("winterActivity", e.target.value)}/></label>}
                   {(isFescue || isSubTropical) && <label>Growth season <select value={currentForm.details.growthSeason} onChange={(e) => setDetail("growthSeason", e.target.value)}>{OPTS.growthSeason.map(o => <option key={o} value={o}>{o || "Not set"}</option>)}</select></label>}
                   {isForage && (
                     <>
                       <label>Growing season <select value={currentForm.details.growingSeason} onChange={(e) => setDetail("growingSeason", e.target.value)}>{OPTS.growingSeasonForage.map(o => <option key={o} value={o}>{o || "Not set"}</option>)}</select></label>
                       <label>Weeks to first grazing <input type="text" value={currentForm.details.weeksToFirstGrazing} onChange={(e) => setDetail("weeksToFirstGrazing", e.target.value)} placeholder="e.g. 6-8"/></label>
                       <label>Prussic acid risk <select value={currentForm.details.prussicAcidRisk} onChange={(e) => setDetail("prussicAcidRisk", e.target.value)}>{OPTS.prussicAcidRisk.map(o => <option key={o} value={o}>{o || "Not set"}</option>)}</select></label>
                       <label>Regrowth <select value={currentForm.details.regrowth} onChange={(e) => setDetail("regrowth", e.target.value)}>{OPTS.regrowth.map(o => <option key={o} value={o}>{o || "Not set"}</option>)}</select></label>
                     </>
                   )}
                   {isMix && (
                     <>
                       <label>Flowering window <input type="text" value={currentForm.details.floweringWindow} onChange={(e) => setDetail("floweringWindow", e.target.value)} placeholder="e.g. Aug-Nov"/></label>
                       <label>Formulation year <input type="text" value={currentForm.details.formulationYear} onChange={(e) => setDetail("formulationYear", e.target.value)}/></label>
                       <div className="admin-repeat-group wide">
                         <div className="admin-section-heading"><div><h3>Mix components</h3></div>{viewMode !== "live" && !isArchived && <button className="admin-button outline small" type="button" onClick={() => setDetail("components", [...form.details.components, { productLink: "", speciesName: "", inclusionRate: null, unit: "%", note: "" }])}><Icon name="plus" size={16}/>Add component</button>}</div>
                         <div className="admin-component-list">
                           {currentForm.details.components.map((component: any, index: number) => <div className="admin-component-row admin-component-row-expanded" key={index}><span className="admin-grip">⋮</span><input value={component.speciesName} onChange={(event) => updateComponent(index, { speciesName: event.target.value })} placeholder="Species name"/><input value={component.productLink} onChange={(event) => updateComponent(index, { productLink: event.target.value })} placeholder="Product slug (optional)"/><input type="number" min="0" step="0.01" value={component.inclusionRate ?? ""} onChange={(event) => updateComponent(index, { inclusionRate: event.target.value === "" ? null : Number(event.target.value) })} placeholder="Rate"/><input value={component.unit} onChange={(event) => updateComponent(index, { unit: event.target.value })} placeholder="%"/><input value={component.note} onChange={(event) => updateComponent(index, { note: event.target.value })} placeholder="Note"/>{viewMode !== "live" && !isArchived && <button type="button" onClick={() => removeComponent(index)} aria-label="Remove component">×</button>}</div>)}
                         </div>
                       </div>
                     </>
                   )}
                   {isBio && (
                     <>
                        <label>Product form <input value={currentForm.details.productForm} onChange={(e) => setDetail("productForm", e.target.value)} placeholder="e.g. Powder|Liquid|Peat"/></label>
                       <label>Application rate <input type="text" value={currentForm.details.applicationRate} onChange={(e) => setDetail("applicationRate", e.target.value)}/></label>
                     </>
                   )}
                 </div>
                }
              </section>
            )}

            {activeTab === 4 && (
              <section className="admin-panel admin-form-card">
                <h2>Selling</h2>
                <div className="admin-repeat-group wide">
                  <div className="admin-section-heading"><div><h3>Sale lines</h3><p>One row per warehouse stock code.</p></div>{viewMode !== "live" && !isArchived && <button className="admin-button outline small" type="button" onClick={addSaleLine}><Icon name="plus" size={16}/>Add line</button>}</div>
                  <div className="admin-sale-line-header">
                     <span>Stock code</span>
                     <span>Seed form</span>
                     <span>Seed grade</span>
                     <span>Pack kg</span>
                     <span>Unit</span>
                     <span>Availability</span>
                     <span>Price display</span>
                     <span style={{textAlign: "center"}}>Default</span>
                     <span></span>
                  </div>
                  {currentForm.saleLines?.map((line: any, i: number) => (
                    <div className="admin-sale-line-row" key={i}>
                       <input value={line.stockCode} onChange={(e) => updateSaleLine(i, { stockCode: e.target.value })} placeholder="Code" />
                       <select value={line.seedForm} onChange={(e) => updateSaleLine(i, { seedForm: e.target.value })}>{OPTS.seedForm.map(o => <option key={o} value={o}>{o || "Not set"}</option>)}</select>
                       <select value={line.seedGrade} onChange={(e) => updateSaleLine(i, { seedGrade: e.target.value })}>{OPTS.seedGrade.map(o => <option key={o} value={o}>{o || "Not set"}</option>)}</select>
                       <input type="number" min="0" step="0.01" value={line.packKg ?? ""} onChange={(e) => updateSaleLine(i, { packKg: e.target.value === "" ? null : Number(e.target.value) })} placeholder="kg" />
                       <input value={line.packUnit} onChange={(e) => updateSaleLine(i, { packUnit: e.target.value })} placeholder="kg" />
                        <select value={line.availability ?? ""} onChange={(e) => updateSaleLine(i, { availability: e.target.value || null })}><option value="">TBA</option>{OPTS.availability.map(o => <option key={o} value={o}>{o}</option>)}</select>
                       <input value={line.priceDisplay} onChange={(e) => updateSaleLine(i, { priceDisplay: e.target.value })} placeholder="Contact for pricing" />
                       <div className="radio-group"><input type="radio" name="saleLineDefault" checked={line.isDefault} onChange={() => {
                          const newLines = currentForm.saleLines.map((l: any, idx: number) => ({...l, isDefault: idx === i}));
                          setField("saleLines", newLines);
                       }} /></div>
                       {viewMode !== "live" && !isArchived && <button type="button" className="admin-button ghost" onClick={() => removeSaleLine(i)} aria-label="Remove sale line">×</button>}
                    </div>
                  ))}
                  {currentForm.saleLines?.length === 0 && <p style={{color:'#7b827d'}}>No sale lines added.</p>}
                </div>
                
                <div className="admin-form-grid">
                   <div style={{gridColumn: "1/-1"}}>
                     <div style={{display:'flex', gap: 24}}>
                       <label style={{flex: 1}}>Listing state override
                         <select value={currentForm.listingOverride} onChange={(e) => setField("listingOverride", e.target.value)}>
                            {OPTS.listingOverride.map(o => <option key={o} value={o}>{o || "Use derived"}</option>)}
                         </select>
                         <span className="admin-derived-info">Currently evaluates to: <strong>{getListingState(currentForm)}</strong></span>
                       </label>
                       <label style={{flex: 1}}>Availability override
                         <select value={currentForm.availabilityOverride} onChange={(e) => setField("availabilityOverride", e.target.value)}>
                            {OPTS.availabilityOverride.map(o => <option key={o} value={o}>{o || "Use derived"}</option>)}
                         </select>
                         <span className="admin-derived-info">Currently evaluates to: <strong>{getDerivedAvailability(currentForm)}</strong></span>
                       </label>
                     </div>
                   </div>
                   
                   <label className="admin-check-row wide"><input type="checkbox" checked={currentForm.details.pbrProtected} onChange={(event) => setDetail("pbrProtected", event.target.checked)}/><span><strong>PBR protected</strong></span></label>
                   <label>PBR details <input value={currentForm.details.pbrDetails} onChange={(e) => setDetail("pbrDetails", e.target.value)} /></label>
                   <label>Licence restriction <input value={currentForm.details.licenceRestriction} onChange={(e) => setDetail("licenceRestriction", e.target.value)} /></label>
                   
                   <div className="admin-choice-field wide"><span>Certification</span><div>{["ASF Code of Practice", "Certified Quality Assured Seed", "Certified seed", "Licensed production"].map((value) => <button key={value} type="button" className={currentForm.details.certification.includes(value as any) ? "selected" : ""} onClick={() => toggleList("certification", value)}>{value}</button>)}</div></div>
                   
                   <label className="admin-check-row wide"><input type="checkbox" checked={currentForm.details.isThirdPartyProduct} onChange={(event) => setDetail("isThirdPartyProduct", event.target.checked)}/><span><strong>Third-party product</strong></span></label>
                   <label>Supplier name <input value={currentForm.details.supplierName} onChange={(e) => setDetail("supplierName", e.target.value)} /></label>
                </div>
              </section>
            )}

            {activeTab === 5 && (
              <section className="admin-panel admin-form-card">
                <h2>Content &amp; publishing</h2>
                <div className="admin-form-grid">
                  <label className="wide">Summary<textarea value={currentForm.details.summary} onChange={(e) => setDetail("summary", e.target.value)} rows={2}/></label>
                  <label className="wide">Description<textarea value={currentForm.details.description} onChange={(e) => setDetail("description", e.target.value)} rows={6}/></label>
                  <label>Description source (Admin only)<input value={currentForm.descriptionSource} onChange={(e) => setField("descriptionSource", e.target.value)} /></label>
                  <label>Legacy website URL (Admin only)<input value={currentForm.websiteUrlLegacy} onChange={(e) => setField("websiteUrlLegacy", e.target.value)} /></label>
                  <label className="wide">Internal notes (Admin only)<textarea value={currentForm.details.notes} onChange={(e) => setDetail("notes", e.target.value)} rows={3}/></label>
                  
                  <div className="admin-repeat-group wide">
                    <div className="admin-section-heading"><div><h3>Photos</h3></div></div>
                    <div className="admin-photo-list">
                      {currentForm.details.photos.map((photo: any, index: number) => (
                        <div className="admin-photo-row" key={photo.slot}>
                          <div className="admin-photo-thumb">{photo.src ? <img src={photo.src} alt={photo.file}/> : <Icon name="image" size={24}/>}</div>
                          <span><small>{photo.slot}</small><strong>{photo.file || "No file selected"}</strong></span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <label className="wide">Tech sheet URL<input value={currentForm.techSheet} onChange={(e) => setField("techSheet", e.target.value)} /></label>
                  
                  <div className="admin-section-heading wide" style={{marginTop: 16}}><h3>SEO</h3></div>
                  <label>SEO Title<input value={currentForm.details.seoTitle} onChange={(e) => setDetail("seoTitle", e.target.value)} /></label>
                  <label>SEO Description<textarea value={currentForm.details.seoDescription} onChange={(e) => setDetail("seoDescription", e.target.value)} rows={2} /></label>
                  
                  <div className="admin-repeat-group wide" style={{marginTop: 16}}>
                    <div className="admin-section-heading"><div><h3>Related products</h3></div>{viewMode !== "live" && !isArchived && <button className="admin-button outline small" type="button" onClick={() => addStringItem("relatedProducts")}><Icon name="plus" size={16}/>Add related</button>}</div>
                    {currentForm.details.relatedProducts.map((alias: string, index: number) => <div className="admin-repeat-row" key={index}><input value={alias} onChange={(event) => updateStringItem("relatedProducts", index, event.target.value)} placeholder="Product slug"/>{viewMode !== "live" && !isArchived && <button type="button" onClick={() => removeStringItem("relatedProducts", index)} aria-label="Remove item">×</button>}</div>)}
                  </div>
                  
                  <div className="admin-section-heading wide" style={{marginTop: 16}}><h3>Display</h3></div>
                  <label>Sort order<input type="number" min="0" value={currentForm.details.sortOrder ?? ""} onChange={(e) => setNumberDetail("sortOrder", e.target.value)} /></label>
                  <label className="admin-check-row"><input type="checkbox" checked={currentForm.details.featured} onChange={(event) => setDetail("featured", event.target.checked)}/><span><strong>Featured product</strong></span></label>
                </div>
                
                {!isNew && (
                  <div className="admin-publishing-card" style={{marginTop: 24}}>
                    <div style={{display:'flex', gap:16}}>
                       <button className="admin-button outline" type="button" onClick={remove} disabled={saving} style={{color: '#9c372d', borderColor: '#9c372d'}}>Delete permanently</button>
                    </div>
                  </div>
                )}
              </section>
            )}

          </fieldset>
        </form>
      </div>
    </>
  );
}

export default function Admin() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [location] = useLocation();
  const route = location.split("?")[0];
  const isProducts = route === "/admin/products";
  const isEditor = route.startsWith("/admin/products/") && route !== "/admin/products/categories";

  return (
    <AdminLayout mobileOpen={mobileOpen} setMobileOpen={setMobileOpen}>
      {route === "/admin" && <Dashboard />}
      {isProducts && <ProductTable />}
      {isEditor && (
        <ProductEditor
          isNew={route === "/admin/products/new"}
          productId={route !== "/admin/products/new" ? parseInt(route.split("/").pop() || "0", 10) : undefined}
        />
      )}
    </AdminLayout>
  );
}
