import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Icon, StatusPill } from "../components/ui";
import { navigate, useLocation } from "../router";

type ProductStatus = "in-stock" | "low" | "very-low" | "unavailable";
type PublishStatus = "Published" | "Draft";
type RecordKind = "Mix" | "Variety";
type ProductComponent = { name: string; note: string };
type ProductPhoto = { slot: string; file: string; rating: string; src: string };
type ProductDetails = {
  stockCode: string;
  guideSection: string;
  treatment: string;
  kind: RecordKind;
  rate: string;
  rainfall: string;
  flowering: string;
  inoculant: string;
  soil: string[];
  tolerance: string[];
  summary: string;
  description: string;
  notes: string;
  components: ProductComponent[];
  photos: ProductPhoto[];
};

type AdminProduct = {
  id: number;
  name: string;
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
  price: "",
  packSize: "25 kg bag",
  status: "in-stock",
  note: "",
  category: "Specialty Mixes",
  techSheet: "",
  publishStatus: "Draft",
  details: {
    stockCode: "",
    guideSection: "Specialty mixes",
    treatment: "",
    kind: "Mix",
    rate: "",
    rainfall: "",
    flowering: "",
    inoculant: "",
    soil: [],
    tolerance: [],
    summary: "",
    description: "",
    notes: "",
    components: [{ name: "", note: "" }],
    photos: [
      { slot: "Photo 1 · Hero", file: "", rating: "", src: "" },
      { slot: "Photo 2", file: "", rating: "", src: "" },
      { slot: "Photo 3", file: "", rating: "", src: "" },
    ],
  },
};

const statusOptions: { value: ProductStatus; label: string }[] = [
  { value: "in-stock", label: "Good stock" },
  { value: "low", label: "Low stock" },
  { value: "very-low", label: "Very low" },
  { value: "unavailable", label: "Unavailable" },
];

const categories = [
  "Specialty Mixes",
  "Ryegrass",
  "Clovers",
  "Lucerne",
  "Other Grasses",
  "Alternative / Forage Crops",
  "Serradella & Medic",
  "Sub-Tropical Grasses & Legumes",
  "Bio Stimulants",
  "Other",
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
  isNew,
  reload,
}: {
  product?: AdminProduct;
  isNew: boolean;
  reload: () => Promise<void>;
}) {
  const toForm = (item?: AdminProduct): ProductInput => item ? {
    name: item.name,
    price: item.price,
    packSize: item.packSize,
    status: item.status,
    note: item.note,
    category: item.category,
    techSheet: item.techSheet,
    publishStatus: item.publishStatus,
    details: { ...blankProduct.details, ...item.details },
  } : { ...blankProduct, details: { ...blankProduct.details, components: [...blankProduct.details.components], photos: [...blankProduct.details.photos] } };
  const [form, setForm] = useState<ProductInput>(() => toForm(product));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setForm(toForm(product));
  }, [product]);

  const setField = <K extends keyof ProductInput,>(key: K, value: ProductInput[K]) => setForm((current) => ({ ...current, [key]: value }));
  const setDetail = <K extends keyof ProductDetails,>(key: K, value: ProductDetails[K]) => setForm((current) => ({ ...current, details: { ...current.details, [key]: value } }));
  const toggleList = (key: "soil" | "tolerance", value: string) => setDetail(key, form.details[key].includes(value) ? form.details[key].filter((item) => item !== value) : [...form.details[key], value]);
  const updateComponent = (index: number, patch: Partial<ProductComponent>) => setDetail("components", form.details.components.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  const removeComponent = (index: number) => setDetail("components", form.details.components.filter((_, itemIndex) => itemIndex !== index));
  const updatePhoto = (index: number, patch: Partial<ProductPhoto>) => setDetail("photos", form.details.photos.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const requestedStatus = submitter?.name === "publishStatus" ? submitter.value as PublishStatus : form.publishStatus;
    const payload = { ...form, publishStatus: requestedStatus };
    const response = await fetch(isNew ? "/api/products" : `/api/products/${product?.id}`, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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
        <div className="admin-editor-main">
          <section className="admin-panel admin-form-card">
            <h2>Identity</h2>
            <div className="admin-form-grid">
              <label>Product name<input required value={form.name} onChange={(event) => setField("name", event.target.value)} placeholder="e.g. SouWest™ Pasture Mix"/></label>
              <label>Stock code<input value={form.details.stockCode} onChange={(event) => setDetail("stockCode", event.target.value)} placeholder="e.g. EQUI or SOU / SOU500"/></label>
              <label>Category<select value={form.category} onChange={(event) => setField("category", event.target.value)}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
              <label>Guide section<select value={form.details.guideSection} onChange={(event) => setDetail("guideSection", event.target.value)}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
              <label>Pack size<input required value={form.packSize} onChange={(event) => setField("packSize", event.target.value)} placeholder="25 kg bag"/></label>
              <label>Seed treatment<input value={form.details.treatment} onChange={(event) => setDetail("treatment", event.target.value)} placeholder="Bare seed or pre-inoculated"/></label>
            </div>
            <div className="admin-choice-field"><span>Record type</span><div>{(["Mix", "Variety"] as RecordKind[]).map((kind) => <button key={kind} type="button" className={form.details.kind === kind ? "selected" : ""} onClick={() => setDetail("kind", kind)}>{kind}</button>)}</div><small>{form.details.kind === "Mix" ? "A blended product with multiple species." : "A single variety or biological product."}</small></div>
          </section>

          <section className="admin-panel admin-form-card">
            <div><h2>Agronomy — 2026 Pasture Growers Guide</h2><p>The guide fields are stored with the product record. Leave a field blank if the guide has no entry.</p></div>
            <div className="admin-form-grid">
              <label>Sowing rate (kg/ha)<input value={form.details.rate} onChange={(event) => setDetail("rate", event.target.value)} placeholder="25 to 35"/></label>
              <label>Rainfall (mm)<input value={form.details.rainfall} onChange={(event) => setDetail("rainfall", event.target.value)} placeholder="400+"/></label>
              <label>Flowering / heading<input value={form.details.flowering} onChange={(event) => setDetail("flowering", event.target.value)} placeholder="Aug-Nov, Mid, or All Year Round"/></label>
              <label>Inoculant group<input value={form.details.inoculant} onChange={(event) => setDetail("inoculant", event.target.value)} placeholder="Blank if not applicable"/></label>
            </div>
            <div className="admin-choice-field"><span>Ideal soil range</span><div>{[{ code: "LS", label: "LS — light sand" }, { code: "S", label: "S — sand" }, { code: "L", label: "L — loam" }, { code: "H", label: "H — heavy" }].map((soil) => <button key={soil.code} type="button" className={form.details.soil.includes(soil.code) ? "selected" : ""} onClick={() => toggleList("soil", soil.code)}>{soil.label}</button>)}</div><small>Pick the lightest and heaviest soil this suits — selected: {form.details.soil.join(" – ") || "no range set"}.</small></div>
            <div className="admin-choice-field"><span>Tolerance</span><div>{["Drought", "Frost", "Waterlogging"].map((tolerance) => <button key={tolerance} type="button" className={form.details.tolerance.includes(tolerance) ? "selected" : ""} onClick={() => toggleList("tolerance", tolerance)}>{tolerance}</button>)}</div><small>{form.details.tolerance.length ? `Shown on the page as ${form.details.tolerance.join(", ")}.` : "No tolerance indicators selected."}</small></div>
          </section>

          <section className="admin-panel admin-form-card">
            <div><h2>Summary &amp; description</h2><p>The summary sits under the product name; the description becomes the body of the public product page.</p></div>
            <label>Summary<input value={form.details.summary} onChange={(event) => { setDetail("summary", event.target.value); setField("note", event.target.value); }} placeholder="e.g. The Horse’s Choice. Suitable for all livestock."/></label>
            <label>Product description<small>Blank lines between paragraphs are preserved on the public page.</small><textarea rows={7} value={form.details.description} onChange={(event) => setDetail("description", event.target.value)} placeholder="Describe the product, where it performs, and how it is used."/></label>
            <label>Internal notes<small>Not published. Anything the office needs to know about this line.</small><textarea rows={2} value={form.details.notes} onChange={(event) => setDetail("notes", event.target.value)} placeholder="Internal note"/></label>
          </section>

          <section className="admin-panel admin-form-card">
            <div className="admin-section-heading"><div><h2>{form.details.kind === "Mix" ? "Mix components" : "Usage notes"}</h2><p>Add the species or usage notes that make up this product.</p></div><button className="admin-button outline small" type="button" onClick={() => setDetail("components", [...form.details.components, { name: "", note: "" }])}><Icon name="plus" size={16}/>Add species</button></div>
            <div className="admin-component-list">{form.details.components.map((component, index) => <div className="admin-component-row" key={`${index}-${component.name}`}><span className="admin-grip">⋮⋮</span><input value={component.name} onChange={(event) => updateComponent(index, { name: event.target.value })} placeholder="Species"/><input value={component.note} onChange={(event) => updateComponent(index, { note: event.target.value })} placeholder="One-line note"/><button type="button" aria-label="Remove component" onClick={() => removeComponent(index)}>×</button></div>)}</div>
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
            <p>{form.publishStatus === "Published" ? "Live on the public catalogue. Stock status changes go live immediately without republishing." : "Hidden from the public catalogue. Editors can still see and update the record."}</p>
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
  if (isNew) content = <ProductEditor isNew reload={reload}/>;
  else if (editorMatch) content = loading ? <div className="admin-empty-page">Loading product…</div> : product ? <ProductEditor product={product} isNew={false} reload={reload}/> : <div className="admin-empty-page"><h1>Product not found</h1><button className="admin-button primary" onClick={() => navigate("/admin/products")}>Back to products</button></div>;
  else if (location === "/admin/products") content = <ProductTable products={products} loading={loading} reload={reload}/>;
  else content = <Dashboard products={products} loading={loading}/>;

  return (
    <AdminLayout mobileOpen={mobileOpen} setMobileOpen={setMobileOpen}>
      {error && <div className="admin-api-error" role="alert">{error}<button onClick={() => void reload()}>Try again</button></div>}
      {content}
    </AdminLayout>
  );
}