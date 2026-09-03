import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Icon, StatusPill } from "../components/ui";
import { navigate, useLocation } from "../router";

type ProductStatus = "in-stock" | "low" | "very-low" | "unavailable";
type PublishStatus = "Published" | "Draft";
type RecordKind = "Mix" | "Variety" | "Commodity / generic";
type ProductComponent = { productLink: string; speciesName: string; inclusionRate: number | null; unit: string; note: string };
type ProductPhoto = { slot: string; file: string; rating: string; src: string };
type PackSize = { label: string; size: number | null; unit: string };
type SowingRate = { context: string; min: number | null; max: number | null; unit: string };
type Tolerance = { name: string; mild: boolean };
type ProductDetails = {
  stockCode: string;
  guideSection: string;
  recordType: RecordKind;
  botanicalName: string;
  alsoKnownAs: string[];
  packSizes: PackSize[];
  treatment: string;
  persistencyType: string;
  ploidy: string;
  flowerColour: string;
  bredByOrigin: string;
  australianBred: boolean;
  distributedBy: string;
  sowingRates: SowingRate[];
  rainfallMinMm: number | null;
  soilPhMin: number | null;
  soilPhScale: string;
  soilRangeLightest: string;
  soilRangeHeaviest: string;
  sowingDepthMinCm: number | null;
  sowingDepthMaxCm: number | null;
  tolerance: Tolerance[];
  maturityMeasure: string;
  maturityDays: number | null;
  headingDate: string;
  floweringWindow: string;
  winterActivity: number | null;
  inoculantGroup: string;
  seedTreatment: string[];
  ecocertApproved: boolean;
  endUse: string[];
  livestock: string[];
  companionSpecies: string[];
  diseasePestResistance: string;
  persistenceLongevity: string;
  grazingManagementNotes: string;
  pbrProtected: boolean;
  pbrDetails: string;
  licenceRestriction: string;
  certification: string[];
  isThirdPartyProduct: boolean;
  supplierName: string;
  summary: string;
  description: string;
  notes: string;
  components: ProductComponent[];
  formulationYear: string;
  photos: ProductPhoto[];
  inCurrentPrintedGuide: boolean;
  seoTitle: string;
  seoDescription: string;
  sortOrder: number | null;
  featured: boolean;
  relatedProducts: string[];
};

type AdminProduct = {
  id: number;
  name: string;
  slug: string;
  price: string;
  packSize: string;
  status: ProductStatus;
  note: string;
  category: string;
  techSheet: string;
  publishStatus: PublishStatus;
  details: ProductDetails;
  createdAt: string;
  updatedAt: string;
};

type ProductInput = Omit<AdminProduct, "id" | "createdAt" | "updatedAt">;

const blankProduct: ProductInput = {
  name: "",
  slug: "",
  price: "Contact for pricing",
  packSize: "25 kg bag",
  status: "in-stock",
  note: "",
  category: "Mixes",
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
    persistencyType: "",
    ploidy: "",
    flowerColour: "",
    bredByOrigin: "",
    australianBred: false,
    distributedBy: "IH Seeds",
    sowingRates: [{ context: "Pasture", min: null, max: null, unit: "kg/ha" }],
    rainfallMinMm: null,
    soilPhMin: null,
    soilPhScale: "CaCl₂",
    soilRangeLightest: "",
    soilRangeHeaviest: "",
    sowingDepthMinCm: null,
    sowingDepthMaxCm: null,
    tolerance: [],
    maturityMeasure: "",
    maturityDays: null,
    headingDate: "",
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

const categories = [
  "Ryegrasses",
  "Clovers",
  "Fescues & Other Grasses",
  "Serradellas & Medics",
  "Lucerne",
  "Herbs",
  "Sub-Tropical Grasses",
  "Biologicals",
  "Forage & Grain Crops",
  "Mixes",
];

const guideSections = [
  "Subterranean Clovers",
  "Aerial Seeded Clovers & White Clovers",
  "Serradellas & Medic",
  "Specialist Seed Mixes",
  "Annual Tetraploid Ryegrasses",
  "Annual Diploid Ryegrasses",
  "Short Term – Biennials & Perennial Ryegrass Varieties",
  "Lucerne",
  "Other Grasses",
  "Sub Tropical Perennial Grasses & Mixes",
  "Alternative Crops",
  "Biologicals",
];

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));

async function readError(response: Response) {
  const body = await response.json().catch(() => null) as { error?: string } | null;
  return body?.error ?? "Something went wrong. Please try again.";
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

function AdminLayout({
  children,
  mobileOpen,
  setMobileOpen,
}: {
  children: ReactNode;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}) {
  const [location] = useLocation();
  const nav = [
    { label: "Dashboard", icon: "dashboard", href: "/admin", enabled: true },
    { label: "Products & mixes", icon: "sprout", href: "/admin/products", enabled: true },
    { label: "Tech sheets", icon: "file-text", href: "", enabled: false },
    { label: "Blog", icon: "file-text", href: "", enabled: false },
    { label: "Stockists", icon: "map-pin", href: "", enabled: false },
    { label: "Media library", icon: "file-text", href: "", enabled: false },
    { label: "Users & roles", icon: "user", href: "", enabled: false },
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
                title={!item.enabled ? "Coming soon" : undefined}
                onClick={() => {
                  if (item.href) navigate(item.href);
                  setMobileOpen(false);
                }}
              >
                <AdminNavIcon name={item.icon} />
                <span>{item.label}</span>
                {!item.enabled && <small>Soon</small>}
              </button>
            );
          })}
        </nav>
        <div className="admin-user">
          <span className="admin-avatar">IH</span>
          <span><strong>IH Seeds team</strong><small>Administrator</small></span>
        </div>
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

function Dashboard({ products, loading }: { products: AdminProduct[]; loading: boolean }) {
  const lowStock = products.filter((product) => product.status !== "in-stock");
  const missingSheets = products.filter((product) => !product.techSheet);
  const published = products.filter((product) => product.publishStatus === "Published");
  const recent = [...products].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).slice(0, 4);
  const allAttention = [...lowStock, ...missingSheets.filter((product) => !lowStock.some((item) => item.id === product.id))];
  const attention = allAttention.slice(0, 5);

  return (
    <>
      <PageHeader
        eyebrow="IH Seeds admin"
        title={<>Good morning, <strong>team</strong></>}
        action={<button className="admin-button primary" onClick={() => navigate("/admin/products/new")}><Icon name="plus" size={18}/>Add a product</button>}
      />
      <div className="admin-content">
        <div className="admin-notice"><Icon name="clock" size={20}/><p>Catalogue and stock statuses update the public website as soon as they are saved here.</p></div>
        <section className="admin-stats" aria-label="Catalogue summary">
          {[
            ["Products & mixes", loading ? "—" : products.length, `${published.length} published`],
            ["Needs attention", loading ? "—" : allAttention.length, "Low stock or missing a sheet"],
            ["Low stock", loading ? "—" : lowStock.length, "Includes unavailable lines"],
            ["Tech sheets missing", loading ? "—" : missingSheets.length, "No download attached"],
          ].map(([label, value, note]) => (
            <article className="admin-stat-card" key={label}><small>{label}</small><strong>{value}</strong><p>{note}</p></article>
          ))}
        </section>
        <div className="admin-dashboard-grid">
          <section className="admin-panel">
            <div className="admin-panel-heading"><h2>Needs your <strong>attention</strong></h2><button onClick={() => navigate("/admin/products")}>View all products</button></div>
            {loading ? <div className="admin-empty">Loading catalogue…</div> : attention.length ? (
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
            <div><h2>Recently updated</h2>{recent.map((product) => <button key={product.id} onClick={() => navigate(`/admin/products/${product.id}`)}><span><strong>{product.name}</strong><small>{product.category}</small></span><small>{formatDate(product.updatedAt)}</small></button>)}</div>
          </section>
        </div>
      </div>
    </>
  );
}

function ProductTable({
  products,
  loading,
  reload,
}: {
  products: AdminProduct[];
  loading: boolean;
  reload: () => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [bulkStatus, setBulkStatus] = useState<ProductStatus>("in-stock");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const rows = useMemo(() => products.filter((product) =>
    (!query || `${product.name} ${product.note} ${product.category}`.toLowerCase().includes(query.toLowerCase())) &&
    (!statusFilter || product.status === statusFilter)
  ), [products, query, statusFilter]);

  const applyBulk = async () => {
    setSaving(true);
    setMessage("");
    try {
      const responses = await Promise.all(selected.map((id) => fetch(`/api/products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: bulkStatus }),
      })));
      const failed = responses.find((response) => !response.ok);
      if (failed) throw new Error(await readError(failed));
      await reload();
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
      <PageHeader
        eyebrow="Content"
        title={<>Products &amp; <strong>mixes</strong></>}
        action={<button className="admin-button primary" onClick={() => navigate("/admin/products/new")}><Icon name="plus" size={18}/>Add a product</button>}
      />
      <div className="admin-content">
        <div className="admin-table-tools">
          <label className="admin-search"><Icon name="search" size={18}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products" /></label>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by stock status">
            <option value="">All stock statuses</option>
            {statusOptions.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
          </select>
          <span>{rows.length} product{rows.length === 1 ? "" : "s"}</span>
        </div>
        {selected.length > 0 && (
          <div className="admin-bulk-bar">
            <strong>{selected.length} selected</strong><span>Set stock status to</span>
            <select value={bulkStatus} onChange={(event) => setBulkStatus(event.target.value as ProductStatus)}>{statusOptions.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select>
            <button className="admin-button primary small" onClick={applyBulk} disabled={saving}>{saving ? "Applying…" : "Apply to selected"}</button>
            <button className="admin-text-button" onClick={() => setSelected([])}>Clear</button>
          </div>
        )}
        {message && <p className="admin-inline-message">{message}</p>}
        <div className="admin-table-card">
          <table>
            <thead><tr><th aria-label="Select"></th><th>Product</th><th>Category</th><th>Stock status</th><th>Tech sheet</th><th>Updated</th><th></th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={7} className="admin-empty">Loading catalogue…</td></tr> : rows.map((product) => (
                <tr key={product.id}>
                  <td><input type="checkbox" checked={selected.includes(product.id)} onChange={() => setSelected((current) => current.includes(product.id) ? current.filter((id) => id !== product.id) : [...current, product.id])} aria-label={`Select ${product.name}`}/></td>
                  <td><button className="admin-product-name" onClick={() => navigate(`/admin/products/${product.id}`)}>{product.name}</button><small>{product.packSize} · {product.price}</small></td>
                  <td>{product.category}</td>
                  <td><StatusPill status={product.status}/></td>
                  <td>{product.techSheet ? <span className="admin-sheet"><Icon name="file-text" size={16}/>Attached</span> : <button className="admin-text-button" onClick={() => navigate(`/admin/products/${product.id}`)}>Attach PDF</button>}</td>
                  <td>{formatDate(product.updatedAt)}</td>
                  <td><button className="admin-text-button" onClick={() => navigate(`/admin/products/${product.id}`)}>Edit</button></td>
                </tr>
              ))}
              {!loading && rows.length === 0 && <tr><td colSpan={7} className="admin-empty">No products match those filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function ProductEditor({
  product,
  products,
  isNew,
  reload,
}: {
  product?: AdminProduct;
  products: AdminProduct[];
  isNew: boolean;
  reload: () => Promise<void>;
}) {
  const toForm = (item?: AdminProduct): ProductInput => {
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
    const tolerance = (raw.tolerance ?? []).map((value) => typeof value === "string" ? { name: value, mild: false } : value);
    const components = (raw.components ?? []).map((value) => "speciesName" in value ? value : {
      productLink: "",
      speciesName: value.name ?? "",
      inclusionRate: null,
      unit: "%",
      note: value.note ?? "",
    });
    return {
      name: item.name,
      slug: item.slug ?? "",
      price: item.price,
      packSize: item.packSize,
      status: item.status,
      note: item.note,
      category: item.category,
      techSheet: item.techSheet,
      publishStatus: item.publishStatus,
      details: {
        ...blankProduct.details,
        ...raw,
        recordType: raw.recordType ?? raw.kind ?? "Mix",
        packSizes: raw.packSizes?.length ? raw.packSizes : [{ label: "Standard", size: null, unit: item.packSize }],
        sowingRates: raw.sowingRates?.length ? raw.sowingRates : [{ context: "Pasture", min: null, max: null, unit: "kg/ha" }],
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
  const [form, setForm] = useState<ProductInput>(() => toForm(product));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setForm(toForm(product));
  }, [product]);

  const setField = <K extends keyof ProductInput,>(key: K, value: ProductInput[K]) => setForm((current) => ({ ...current, [key]: value }));
  const setDetail = <K extends keyof ProductDetails,>(key: K, value: ProductDetails[K]) => setForm((current) => ({ ...current, details: { ...current.details, [key]: value } }));
  const toggleList = (key: "seedTreatment" | "endUse" | "livestock" | "certification", value: string) => {
    const current = form.details[key] ?? [];
    setDetail(key, current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  };
  const setNumberDetail = (key: "rainfallMinMm" | "soilPhMin" | "sowingDepthMinCm" | "sowingDepthMaxCm" | "maturityDays" | "winterActivity" | "sortOrder", value: string) =>
    setDetail(key, value === "" ? null : Number(value));
  const updateStringItem = (key: "alsoKnownAs" | "companionSpecies" | "relatedProducts", index: number, value: string) =>
    setDetail(key, form.details[key].map((item, itemIndex) => itemIndex === index ? value : item));
  const removeStringItem = (key: "alsoKnownAs" | "companionSpecies" | "relatedProducts", index: number) =>
    setDetail(key, form.details[key].filter((_, itemIndex) => itemIndex !== index));
  const addStringItem = (key: "alsoKnownAs" | "companionSpecies" | "relatedProducts") => setDetail(key, [...form.details[key], ""]);
  const updatePackSize = (index: number, patch: Partial<PackSize>) => setDetail("packSizes", form.details.packSizes.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  const updateSowingRate = (index: number, patch: Partial<SowingRate>) => setDetail("sowingRates", form.details.sowingRates.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  const toggleTolerance = (name: string) => {
    const existing = form.details.tolerance.find((item) => item.name === name);
    setDetail("tolerance", existing ? form.details.tolerance.filter((item) => item.name !== name) : [...form.details.tolerance, { name, mild: false }]);
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
    const requestedStatus = submitter?.name === "publishStatus" ? submitter.value as PublishStatus : form.publishStatus;
    const packSize = form.details.packSizes
      .map((pack) => `${pack.label ? `${pack.label}: ` : ""}${[pack.size, pack.unit].filter((value) => value !== null && value !== "").join(" ")}`.trim())
      .filter(Boolean)
      .join(" / ") || form.packSize;
    const payload = {
      ...form,
      packSize,
      publishStatus: requestedStatus,
      details: { ...form.details, treatment: form.details.seedTreatment.join(" · ") },
    };
    const { slug: _immutableSlug, ...updatePayload } = payload;
    const response = await fetch(isNew ? "/api/products" : `/api/products/${product?.id}`, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isNew ? payload : updatePayload),
    });
    if (!response.ok) {
      setError(await readError(response));
      setSaving(false);
      return;
    }
    await reload();
    navigate("/admin/products");
  };

  const remove = async () => {
    if (!product || !window.confirm(`Delete ${product.name}? This cannot be undone.`)) return;
    setSaving(true);
    setError("");
    const response = await fetch(`/api/products/${product.id}`, { method: "DELETE" });
    if (!response.ok) {
      setError(await readError(response));
      setSaving(false);
      return;
    }
    await reload();
    navigate("/admin/products");
  };

  return (
    <>
      <header className="admin-page-header admin-editor-header">
        <div>
          <button className="admin-back-link" type="button" onClick={() => navigate("/admin/products")}><Icon name="arrow-left" size={16}/>Products &amp; mixes</button>
          <h1>{isNew ? "Add a product" : product?.name ?? "Product"}</h1>
        </div>
        <div className="admin-header-actions">
          <button className="admin-button ghost" type="button" onClick={() => navigate("/admin/products")}>Cancel</button>
          <button className="admin-button outline" type="submit" form="admin-product-form" name="publishStatus" value="Draft" disabled={saving}>Save draft</button>
          <button className="admin-button primary" type="submit" form="admin-product-form" name="publishStatus" value="Published" disabled={saving}>{saving ? "Saving…" : "Publish changes"}</button>
        </div>
      </header>
      <form id="admin-product-form" className="admin-editor admin-claude-editor" onSubmit={submit}>
        <datalist id="admin-product-slugs">{products.filter((item) => item.id !== product?.id).map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}</datalist>
        <div className="admin-editor-main">
          <section className="admin-panel admin-form-card">
            <h2>Identity</h2>
            <div className="admin-form-grid">
              <label>Product name<input required value={form.name} onChange={(event) => setField("name", event.target.value)} placeholder="e.g. SouWest™ Pasture Mix"/></label>
              <label>Slug<input required disabled={!isNew} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={form.slug} onChange={(event) => setField("slug", event.target.value.toLowerCase())} placeholder="souwest-pasture-mix"/><small>Stable URL key. It cannot be changed after the product is created.</small></label>
              <label>Stock code<input value={form.details.stockCode} onChange={(event) => setDetail("stockCode", event.target.value)} placeholder="e.g. EQUI or SOU / SOU500"/></label>
              <label>Botanical name<input value={form.details.botanicalName} onChange={(event) => setDetail("botanicalName", event.target.value)} placeholder="e.g. Lolium multiflorum"/></label>
              <label>Category<select value={form.category} onChange={(event) => setField("category", event.target.value)}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
              <label>Guide section<select value={form.details.guideSection} onChange={(event) => setDetail("guideSection", event.target.value)}>{guideSections.map((section) => <option key={section}>{section}</option>)}</select></label>
            </div>
            <div className="admin-choice-field"><span>Record type</span><div>{(["Mix", "Variety", "Commodity / generic"] as RecordKind[]).map((kind) => <button key={kind} type="button" className={form.details.recordType === kind ? "selected" : ""} onClick={() => setDetail("recordType", kind)}>{kind}</button>)}</div></div>
            <div className="admin-repeat-group">
              <div className="admin-section-heading"><div><h3>Also known as</h3><p>Alternative trade or catalogue names.</p></div><button className="admin-button outline small" type="button" onClick={() => addStringItem("alsoKnownAs")}><Icon name="plus" size={16}/>Add name</button></div>
              {form.details.alsoKnownAs.map((alias, index) => <div className="admin-repeat-row" key={index}><input value={alias} onChange={(event) => updateStringItem("alsoKnownAs", index, event.target.value)} placeholder="Alternative name"/><button type="button" onClick={() => removeStringItem("alsoKnownAs", index)} aria-label="Remove alternative name">×</button></div>)}
            </div>
            <div className="admin-repeat-group">
              <div className="admin-section-heading"><div><h3>Pack sizes</h3><p>Add every pasture or turf pack sold for this product.</p></div><button className="admin-button outline small" type="button" onClick={() => setDetail("packSizes", [...form.details.packSizes, { label: "", size: null, unit: "kg" }])}><Icon name="plus" size={16}/>Add pack</button></div>
              {form.details.packSizes.map((pack, index) => <div className="admin-repeat-row admin-repeat-row-pack" key={index}><input value={pack.label} onChange={(event) => updatePackSize(index, { label: event.target.value })} placeholder="Label"/><input type="number" min="0" step="0.01" value={pack.size ?? ""} onChange={(event) => updatePackSize(index, { size: event.target.value === "" ? null : Number(event.target.value) })} placeholder="Size"/><input value={pack.unit} onChange={(event) => updatePackSize(index, { unit: event.target.value })} placeholder="Unit"/><button type="button" onClick={() => setDetail("packSizes", form.details.packSizes.filter((_, itemIndex) => itemIndex !== index))} aria-label="Remove pack size">×</button></div>)}
            </div>
          </section>

          <section className="admin-panel admin-form-card">
            <div><h2>Classification</h2><p>Structured catalogue attributes used for filtering and comparison.</p></div>
            <div className="admin-form-grid">
              <label>Persistency type<select value={form.details.persistencyType} onChange={(event) => setDetail("persistencyType", event.target.value)}><option value="">Not set</option>{["Annual", "Biennial", "Perennial", "Hybrid perennial", "Short-term (1–2 years)"].map((value) => <option key={value}>{value}</option>)}</select></label>
              {form.category === "Ryegrasses" && <label>Ploidy<select value={form.details.ploidy} onChange={(event) => setDetail("ploidy", event.target.value)}><option value="">Not set</option>{["Diploid", "Tetraploid", "Hexaploid", "Mixed (blend)"].map((value) => <option key={value}>{value}</option>)}</select></label>}
              <label>Flower colour<select value={form.details.flowerColour} onChange={(event) => setDetail("flowerColour", event.target.value)}><option value="">Not set</option>{["Pink", "Yellow", "White", "Crimson", "Red", "Purple"].map((value) => <option key={value}>{value}</option>)}</select></label>
              <label>Bred by / origin<input value={form.details.bredByOrigin} onChange={(event) => setDetail("bredByOrigin", event.target.value)} placeholder="e.g. Agricom (NZ)"/></label>
              <label>Distributed by<input value={form.details.distributedBy} onChange={(event) => setDetail("distributedBy", event.target.value)} placeholder="IH Seeds"/></label>
            </div>
            <label className="admin-check-row"><input type="checkbox" checked={form.details.australianBred} onChange={(event) => setDetail("australianBred", event.target.checked)}/><span><strong>Australian bred</strong><small>Australian bred for Australian farming conditions.</small></span></label>
          </section>

          <section className="admin-panel admin-form-card">
            <div><h2>Agronomy Specs</h2><p>The guide fields are stored with the product record. Leave a field blank if the guide has no entry.</p></div>
            <div className="admin-repeat-group">
              <div className="admin-section-heading"><div><h3>Sowing rates</h3><p>Use separate rows for monoculture, mixes, dryland, irrigation, pasture, or turf rates.</p></div><button className="admin-button outline small" type="button" onClick={() => setDetail("sowingRates", [...form.details.sowingRates, { context: "Pasture", min: null, max: null, unit: "kg/ha" }])}><Icon name="plus" size={16}/>Add rate</button></div>
              {form.details.sowingRates.map((rate, index) => <div className="admin-repeat-row admin-repeat-row-rate" key={index}><select value={rate.context} onChange={(event) => updateSowingRate(index, { context: event.target.value })}>{["Monoculture", "In a mix", "Dryland", "Irrigation", "Pasture", "Turf"].map((value) => <option key={value}>{value}</option>)}</select><input type="number" min="0" step="0.01" value={rate.min ?? ""} onChange={(event) => updateSowingRate(index, { min: event.target.value === "" ? null : Number(event.target.value) })} placeholder="Min"/><input type="number" min="0" step="0.01" value={rate.max ?? ""} onChange={(event) => updateSowingRate(index, { max: event.target.value === "" ? null : Number(event.target.value) })} placeholder="Max"/><input value={rate.unit} onChange={(event) => updateSowingRate(index, { unit: event.target.value })} placeholder="kg/ha"/><button type="button" onClick={() => setDetail("sowingRates", form.details.sowingRates.filter((_, itemIndex) => itemIndex !== index))} aria-label="Remove sowing rate">×</button></div>)}
            </div>
            <div className="admin-form-grid">
              <label>Minimum rainfall (mm)<input type="number" min="0" value={form.details.rainfallMinMm ?? ""} onChange={(event) => setNumberDetail("rainfallMinMm", event.target.value)} placeholder="400"/></label>
              <label>Minimum soil pH<input type="number" min="0" step="0.1" value={form.details.soilPhMin ?? ""} onChange={(event) => setNumberDetail("soilPhMin", event.target.value)} placeholder="5.5"/></label>
              <label>Soil pH scale<select value={form.details.soilPhScale} onChange={(event) => setDetail("soilPhScale", event.target.value)}><option>CaCl₂</option><option>water</option></select></label>
              <label>Lightest soil<select value={form.details.soilRangeLightest} onChange={(event) => setDetail("soilRangeLightest", event.target.value)}><option value="">Not set</option>{[{ code: "LS", label: "LS — light sand" }, { code: "S", label: "S — sand" }, { code: "L", label: "L — loam" }, { code: "H", label: "H — heavy" }].map((soil) => <option key={soil.code} value={soil.code}>{soil.label}</option>)}</select></label>
              <label>Heaviest soil<select value={form.details.soilRangeHeaviest} onChange={(event) => setDetail("soilRangeHeaviest", event.target.value)}><option value="">Not set</option>{[{ code: "LS", label: "LS — light sand" }, { code: "S", label: "S — sand" }, { code: "L", label: "L — loam" }, { code: "H", label: "H — heavy" }].map((soil) => <option key={soil.code} value={soil.code}>{soil.label}</option>)}</select></label>
              <label>Minimum sowing depth (cm)<input type="number" min="0" step="0.1" value={form.details.sowingDepthMinCm ?? ""} onChange={(event) => setNumberDetail("sowingDepthMinCm", event.target.value)}/></label>
              <label>Maximum sowing depth (cm)<input type="number" min="0" step="0.1" value={form.details.sowingDepthMaxCm ?? ""} onChange={(event) => setNumberDetail("sowingDepthMaxCm", event.target.value)}/></label>
            </div>
            <div className="admin-choice-field"><span>Tolerance</span><div>{["Low pH", "Waterlogging", "Salinity", "Drought", "Frost"].map((name) => { const selected = form.details.tolerance.find((item) => item.name === name); return <span className="admin-tolerance-choice" key={name}><button type="button" className={selected ? "selected" : ""} onClick={() => toggleTolerance(name)}>{name}</button>{selected && <label><input type="checkbox" checked={selected.mild} onChange={() => toggleMildTolerance(name)}/>Mild</label>}</span>; })}</div><small>Select Mild where the printed guide uses the “Mild” qualifier.</small></div>
            <div className="admin-form-grid">
              <label>Maturity measure<select value={form.details.maturityMeasure} onChange={(event) => setDetail("maturityMeasure", event.target.value)}><option value="">Not set</option>{["Days to flowering (Perth)", "Heading date", "Time of flowering", "Winter activity rating"].map((value) => <option key={value}>{value}</option>)}</select></label>
              {form.details.maturityMeasure === "Days to flowering (Perth)" && <label>Maturity days<input type="number" min="0" value={form.details.maturityDays ?? ""} onChange={(event) => setNumberDetail("maturityDays", event.target.value)}/></label>}
              {form.details.maturityMeasure === "Heading date" && <label>Heading date<select value={form.details.headingDate} onChange={(event) => setDetail("headingDate", event.target.value)}><option value="">Not set</option>{["Very early", "Early", "Mid", "Mid-late", "Late"].map((value) => <option key={value}>{value}</option>)}</select></label>}
              {form.details.maturityMeasure === "Time of flowering" && <label>Flowering window<input value={form.details.floweringWindow} onChange={(event) => setDetail("floweringWindow", event.target.value)} placeholder="e.g. Aug-Nov"/></label>}
              {form.details.maturityMeasure === "Winter activity rating" && <label>Winter activity (1–10)<input type="number" min="1" max="10" value={form.details.winterActivity ?? ""} onChange={(event) => setNumberDetail("winterActivity", event.target.value)}/></label>}
              <label>Inoculant group<select value={form.details.inoculantGroup} onChange={(event) => setDetail("inoculantGroup", event.target.value)}>{["None", "C", "G/S", "G", "S", "AL", "AM", "B", "BS", "E", "F/E", "I"].map((value) => <option key={value}>{value}</option>)}</select></label>
            </div>
            <div className="admin-choice-field"><span>Seed treatment</span><div>{["Bare / untreated", "Gaucho", "Thiram", "Goldstrike", "BioNPK Powder S", "Lime coated"].map((value) => <button key={value} type="button" className={form.details.seedTreatment.includes(value) ? "selected" : ""} onClick={() => toggleList("seedTreatment", value)}>{value}</button>)}</div></div>
            <label className="admin-check-row"><input type="checkbox" checked={form.details.ecocertApproved} onChange={(event) => setDetail("ecocertApproved", event.target.checked)}/><span><strong>ECOCERT approved</strong><small>Show the organic certification selling point on the product.</small></span></label>
            <div className="admin-choice-field"><span>End use</span><div>{["Grazing", "Hay", "Silage", "Cover crop", "Green manure", "Grain", "Stockfeed", "Permanent pasture", "Erosion control / stabilisation", "Break crop", "Biofumigant", "Turf"].map((value) => <button key={value} type="button" className={form.details.endUse.includes(value) ? "selected" : ""} onClick={() => toggleList("endUse", value)}>{value}</button>)}</div></div>
            <div className="admin-choice-field"><span>Livestock</span><div>{["Beef", "Dairy", "Sheep", "Equine", "Goat", "Chicken", "Alpaca", "Weaners", "Lamb finishing"].map((animal) => <button key={animal} type="button" className={(form.details.livestock ?? []).includes(animal) ? "selected" : ""} onClick={() => toggleList("livestock", animal)}>{animal}</button>)}</div><small>{(form.details.livestock ?? []).length ? `Suitable for: ${(form.details.livestock ?? []).join(", ")}.` : "Select the livestock this product is suited to."}</small></div>
            <div className="admin-repeat-group">
              <div className="admin-section-heading"><div><h3>Companion species</h3><p>Products customers can sow with this line.</p></div><button className="admin-button outline small" type="button" onClick={() => addStringItem("companionSpecies")}><Icon name="plus" size={16}/>Add product</button></div>
              {form.details.companionSpecies.map((value, index) => <div className="admin-repeat-row" key={index}><input list="admin-product-slugs" value={value} onChange={(event) => updateStringItem("companionSpecies", index, event.target.value)} placeholder="Product slug"/><button type="button" onClick={() => removeStringItem("companionSpecies", index)}>×</button></div>)}
            </div>
            <div className="admin-form-grid">
              <label className="wide">Disease &amp; pest resistance<textarea rows={3} value={form.details.diseasePestResistance} onChange={(event) => setDetail("diseasePestResistance", event.target.value)}/></label>
              <label>Persistence / longevity<input value={form.details.persistenceLongevity} onChange={(event) => setDetail("persistenceLongevity", event.target.value)} placeholder="e.g. 3–5 years"/></label>
              <label className="wide">Grazing management notes<textarea rows={4} value={form.details.grazingManagementNotes} onChange={(event) => setDetail("grazingManagementNotes", event.target.value)} placeholder="Planting tips and grazing management guidance."/></label>
            </div>
          </section>

          <section className="admin-panel admin-form-card">
            <div><h2>Summary &amp; description</h2><p>The summary sits under the product name; the description becomes the body of the public product page.</p></div>
            <label>Summary<input value={form.details.summary} onChange={(event) => { setDetail("summary", event.target.value); setField("note", event.target.value); }} placeholder="e.g. The Horse’s Choice. Suitable for all livestock."/></label>
            <label>Product description<small>Blank lines between paragraphs are preserved on the public page.</small><textarea rows={7} value={form.details.description} onChange={(event) => setDetail("description", event.target.value)} placeholder="Describe the product, where it performs, and how it is used."/></label>
            <label>Internal notes<small>Not published. Anything the office needs to know about this line.</small><textarea rows={2} value={form.details.notes} onChange={(event) => setDetail("notes", event.target.value)} placeholder="Internal note"/></label>
          </section>

          <section className="admin-panel admin-form-card">
            <div><h2>Commercial &amp; legal</h2><p>Record ownership, certification, supplier, and licence conditions.</p></div>
            <div className="admin-form-grid">
              <label>Price display<input required value={form.price} onChange={(event) => setField("price", event.target.value)} placeholder="Contact for pricing"/></label>
              <label>Supplier name<input value={form.details.supplierName} onChange={(event) => setDetail("supplierName", event.target.value)} placeholder="Supplier or breeder"/></label>
              <label>PBR details<input value={form.details.pbrDetails} onChange={(event) => setDetail("pbrDetails", event.target.value)} placeholder="Certificate or registration reference"/></label>
              <label className="wide">Licence restriction<textarea rows={3} value={form.details.licenceRestriction} onChange={(event) => setDetail("licenceRestriction", event.target.value)} placeholder="Licence restrictions or propagation conditions."/></label>
            </div>
            <div className="admin-toggle-grid">
              <label className="admin-check-row"><input type="checkbox" checked={form.details.pbrProtected} onChange={(event) => setDetail("pbrProtected", event.target.checked)}/><span><strong>PBR protected</strong><small>Protected under the Plant Breeders Rights Act.</small></span></label>
              <label className="admin-check-row"><input type="checkbox" checked={form.details.isThirdPartyProduct} onChange={(event) => setDetail("isThirdPartyProduct", event.target.checked)}/><span><strong>Third-party product</strong><small>Bred or supplied outside IH Seeds.</small></span></label>
            </div>
            <div className="admin-choice-field"><span>Certification</span><div>{["ASF Code of Practice", "Certified Quality Assured Seed", "Certified seed", "Licensed production"].map((value) => <button key={value} type="button" className={form.details.certification.includes(value) ? "selected" : ""} onClick={() => toggleList("certification", value)}>{value}</button>)}</div></div>
          </section>

          <section className="admin-panel admin-form-card">
            <div className="admin-section-heading"><div><h2>{form.details.recordType === "Mix" ? "Mix components" : "Usage notes"}</h2><p>Link components to product records and store their inclusion rate.</p></div><button className="admin-button outline small" type="button" onClick={() => setDetail("components", [...form.details.components, { productLink: "", speciesName: "", inclusionRate: null, unit: "%", note: "" }])}><Icon name="plus" size={16}/>Add species</button></div>
            <label>Formulation year<input value={form.details.formulationYear} onChange={(event) => setDetail("formulationYear", event.target.value)} placeholder="2026"/></label>
            <div className="admin-component-list">{form.details.components.map((component, index) => <div className="admin-component-row admin-component-row-expanded" key={index}><span className="admin-grip">⋮⋮</span><input list="admin-product-slugs" value={component.productLink} onChange={(event) => updateComponent(index, { productLink: event.target.value })} placeholder="Product slug"/><input value={component.speciesName} onChange={(event) => updateComponent(index, { speciesName: event.target.value })} placeholder="Species name"/><input type="number" min="0" step="0.01" value={component.inclusionRate ?? ""} onChange={(event) => updateComponent(index, { inclusionRate: event.target.value === "" ? null : Number(event.target.value) })} placeholder="Rate"/><input value={component.unit} onChange={(event) => updateComponent(index, { unit: event.target.value })} placeholder="%"/><input value={component.note} onChange={(event) => updateComponent(index, { note: event.target.value })} placeholder="Component note"/><button type="button" aria-label="Remove component" onClick={() => removeComponent(index)}>×</button></div>)}</div>
          </section>
        </div>

        <div className="admin-editor-aside">
          <section className="admin-panel admin-availability-card">
            <h2>Availability</h2><p>Shows on catalogue cards and the product page. Wording matches the public availability table.</p>
            <div>{statusOptions.map((status) => <button key={status.value} type="button" className={form.status === status.value ? "selected" : ""} onClick={() => setField("status", status.value)}><i className={`status-dot ${status.value}`}/>{status.label}</button>)}</div>
          </section>

          <section className="admin-panel admin-form-card">
            <div><h2>Tech sheet</h2><p>Uploaded once here. Powers the product page download and Tech Sheets Hub listing.</p></div>
            <label>PDF path<input value={form.techSheet} onChange={(event) => setField("techSheet", event.target.value)} placeholder="/tech-sheets/product-name.pdf"/></label>
            <div className={`admin-file-state ${form.techSheet ? "attached" : ""}`}><Icon name={form.techSheet ? "file-text" : "plus"} size={22}/><span><strong>{form.techSheet || "Drop a PDF, or choose a file"}</strong><small>{form.techSheet ? "PDF attached to this record" : "Or select one already in the Media Library"}</small></span>{form.techSheet && <button type="button" onClick={() => setField("techSheet", "")}>Replace</button>}</div>
          </section>

          <section className="admin-panel admin-form-card">
            <div><h2>Photos</h2><p>Three slots, matching the stocklist. Photo 1 is the hero and catalogue card image.</p></div>
            <div className="admin-photo-list">{form.details.photos.map((photo, index) => <div className="admin-photo-row" key={photo.slot}><span className="admin-photo-thumb">{photo.src ? <img src={photo.src} alt="" /> : <Icon name="plus" size={20}/>}</span><span><small>{photo.slot}</small><strong>{photo.file || "No image attached"}</strong><em>{photo.rating || "Add a photo from the Media Library"}</em></span><button type="button" onClick={() => updatePhoto(index, photo.file ? { file: "", rating: "", src: "" } : { file: `paddock-0${index + 1}.jpeg`, rating: "80% · Good", src: index % 2 ? "/ih-seeds-logo.png" : "/ih-seeds-logo.png" })}>{photo.file ? "Remove" : "Add"}</button></div>)}</div>
          </section>

          <section className="admin-panel admin-publishing-card">
            <h2>Publishing</h2>
            <label>Status<select value={form.publishStatus} onChange={(event) => setField("publishStatus", event.target.value as PublishStatus)}><option>Published</option><option>Draft</option></select></label>
            <label>Sort order<input type="number" min="0" value={form.details.sortOrder ?? ""} onChange={(event) => setNumberDetail("sortOrder", event.target.value)} placeholder="0"/></label>
            <label className="admin-check-row"><input type="checkbox" checked={form.details.inCurrentPrintedGuide} onChange={(event) => setDetail("inCurrentPrintedGuide", event.target.checked)}/><span><strong>In the current printed guide</strong><small>Distinguishes current guide products from legacy lines.</small></span></label>
            <label className="admin-check-row"><input type="checkbox" checked={form.details.featured} onChange={(event) => setDetail("featured", event.target.checked)}/><span><strong>Featured product</strong><small>Eligible for promoted catalogue placements.</small></span></label>
            <p>{form.publishStatus === "Published" ? "Live on the public catalogue. Stock status changes go live immediately without republishing." : "Hidden from the public catalogue. Editors can still see and update the record."}</p>
          </section>

          <section className="admin-panel admin-form-card">
            <div><h2>SEO &amp; related products</h2><p>Control search snippets and product cross-links.</p></div>
            <label>SEO title<input value={form.details.seoTitle} onChange={(event) => setDetail("seoTitle", event.target.value)} maxLength={180} placeholder={form.name || "Product page title"}/></label>
            <label>SEO description<textarea rows={4} value={form.details.seoDescription} onChange={(event) => setDetail("seoDescription", event.target.value)} maxLength={320} placeholder="Search result description."/></label>
            <div className="admin-repeat-group">
              <div className="admin-section-heading"><div><h3>Related products</h3><p>Use product slugs to create catalogue cross-links.</p></div><button className="admin-button outline small" type="button" onClick={() => addStringItem("relatedProducts")}><Icon name="plus" size={16}/>Add</button></div>
              {form.details.relatedProducts.map((value, index) => <div className="admin-repeat-row" key={index}><input list="admin-product-slugs" value={value} onChange={(event) => updateStringItem("relatedProducts", index, event.target.value)} placeholder="related-product-slug"/><button type="button" onClick={() => removeStringItem("relatedProducts", index)}>×</button></div>)}
            </div>
          </section>
          {!isNew && <button type="button" className="admin-delete-button" onClick={remove} disabled={saving}>Delete this product</button>}
          {error && <p className="admin-form-error" role="alert">{error}</p>}
        </div>
      </form>
    </>
  );
}

export default function Admin() {
  const [location] = useLocation();
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  const reload = async () => {
    setError("");
    try {
      const response = await fetch("/api/products");
      if (!response.ok) throw new Error(await readError(response));
      setProducts(await response.json() as AdminProduct[]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load products.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void reload(); }, []);

  const editorMatch = location.match(/^\/admin\/products\/(\d+)$/);
  const isNew = location === "/admin/products/new";
  const product = editorMatch ? products.find((item) => item.id === Number(editorMatch[1])) : undefined;

  let content: ReactNode;
  if (isNew) content = <ProductEditor products={products} isNew reload={reload}/>;
  else if (editorMatch) content = loading ? <div className="admin-empty-page">Loading product…</div> : product ? <ProductEditor products={products} product={product} isNew={false} reload={reload}/> : <div className="admin-empty-page"><h1>Product not found</h1><button className="admin-button primary" onClick={() => navigate("/admin/products")}>Back to products</button></div>;
  else if (location === "/admin/products") content = <ProductTable products={products} loading={loading} reload={reload}/>;
  else content = <Dashboard products={products} loading={loading}/>;

  return (
    <AdminLayout mobileOpen={mobileOpen} setMobileOpen={setMobileOpen}>
      {error && <div className="admin-api-error" role="alert">{error}<button onClick={() => void reload()}>Try again</button></div>}
      {content}
    </AdminLayout>
  );
}