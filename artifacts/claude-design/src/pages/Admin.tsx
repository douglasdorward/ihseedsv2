import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Icon, StatusPill } from "../components/ui";
import { navigate, useLocation } from "../router";

type ProductStatus = "in-stock" | "low" | "very-low" | "unavailable";
type PublishStatus = "Published" | "Draft";

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
  const [form, setForm] = useState<ProductInput>(product ? {
    name: product.name,
    price: product.price,
    packSize: product.packSize,
    status: product.status,
    note: product.note,
    category: product.category,
    techSheet: product.techSheet,
    publishStatus: product.publishStatus,
  } : blankProduct);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (product) setForm({
      name: product.name,
      price: product.price,
      packSize: product.packSize,
      status: product.status,
      note: product.note,
      category: product.category,
      techSheet: product.techSheet,
      publishStatus: product.publishStatus,
    });
  }, [product]);

  const setField = <K extends keyof ProductInput,>(key: K, value: ProductInput[K]) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    const response = await fetch(isNew ? "/api/products" : `/api/products/${product?.id}`, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
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
      <PageHeader
        eyebrow="Products & mixes"
        title={isNew ? "Add a product" : product?.name ?? "Product"}
        action={<div className="admin-header-actions"><button className="admin-button ghost" onClick={() => navigate("/admin/products")}>Cancel</button><button className="admin-button primary" type="submit" form="admin-product-form" disabled={saving}>{saving ? "Saving…" : "Save product"}</button></div>}
      />
      <form id="admin-product-form" className="admin-editor" onSubmit={submit}>
        <div className="admin-editor-main">
          <section className="admin-panel admin-form-card">
            <div><h2>Product details</h2><p>Core catalogue information shown on the public product and availability pages.</p></div>
            <div className="admin-form-grid">
              <label className="wide">Product name<input required value={form.name} onChange={(event) => setField("name", event.target.value)} placeholder="e.g. SouWest Pasture Mix"/></label>
              <label>Category<select value={form.category} onChange={(event) => setField("category", event.target.value)}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
              <label>Pack size<input required value={form.packSize} onChange={(event) => setField("packSize", event.target.value)} placeholder="25 kg bag"/></label>
              <label>Price<input required value={form.price} onChange={(event) => setField("price", event.target.value)} placeholder="$25.00 per kg"/></label>
              <label>Stock status<select value={form.status} onChange={(event) => setField("status", event.target.value as ProductStatus)}>{statusOptions.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></label>
              <label className="wide">Short description<textarea rows={4} value={form.note} onChange={(event) => setField("note", event.target.value)} placeholder="A concise note for the product catalogue and availability table."/></label>
            </div>
          </section>
          <section className="admin-panel admin-form-card">
            <div><h2>Tech sheet</h2><p>Enter the public PDF path or file name attached to this product.</p></div>
            <label>PDF path<input value={form.techSheet} onChange={(event) => setField("techSheet", event.target.value)} placeholder="/tech-sheets/product-name.pdf"/></label>
            <div className={`admin-file-state ${form.techSheet ? "attached" : ""}`}><Icon name={form.techSheet ? "file-text" : "plus"} size={22}/><span><strong>{form.techSheet || "No tech sheet attached"}</strong><small>{form.techSheet ? "Shown as a download on the product page" : "Add a PDF path when the file is ready"}</small></span>{form.techSheet && <button type="button" onClick={() => setField("techSheet", "")}>Remove</button>}</div>
          </section>
        </div>
        <aside className="admin-editor-aside">
          <section className="admin-panel admin-form-card">
            <div><h2>Publishing</h2><p>Draft products remain visible to editors but can be excluded from future public catalogue publishing.</p></div>
            <label>Status<select value={form.publishStatus} onChange={(event) => setField("publishStatus", event.target.value as PublishStatus)}><option>Published</option><option>Draft</option></select></label>
            <div className="admin-publish-preview"><span className={form.publishStatus === "Published" ? "live" : ""}></span><strong>{form.publishStatus}</strong><p>{form.publishStatus === "Published" ? "Catalogue changes are live after saving." : "This item is being prepared for publication."}</p></div>
          </section>
          <section className="admin-panel admin-product-preview">
            <small>Public catalogue preview</small><h3>{form.name || "Product name"}</h3><StatusPill status={form.status}/><p>{form.note || "Your product summary will appear here."}</p><strong>{form.price || "Price"} · {form.packSize || "Pack size"}</strong>
          </section>
          {!isNew && <button type="button" className="admin-delete-button" onClick={remove} disabled={saving}>Delete this product</button>}
          {error && <p className="admin-form-error" role="alert">{error}</p>}
        </aside>
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