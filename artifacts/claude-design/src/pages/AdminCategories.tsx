import React, { useState, useMemo } from "react";
import { Icon } from "../components/ui";
import {
  useListAdminCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  useReorderCategories,
  CatalogueCategory,
  CatalogueCategoryInput,
  CatalogueCategoryUpdate,
  getListAdminCategoriesQueryKey,
  getListCategoriesQueryKey,
  getListProductsQueryKey,
  getListAdminProductsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { navigate } from "../router";

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/™/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function PageHeader({ eyebrow, title, action, onBack }: { eyebrow: string; title: React.ReactNode; action?: React.ReactNode, onBack?: () => void }) {
  return (
    <header className="admin-page-header" style={{ flexDirection: "column", alignItems: "stretch", gap: 16 }}>
      {onBack && <button type="button" className="admin-back-link" onClick={onBack}><Icon name="chevron-left" size={14} /> Back to Products</button>}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
        <div><p>{eyebrow}</p><h1>{title}</h1></div>
        {action}
      </div>
    </header>
  );
}

const defaultImages = [
  "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1530507629858-e4977d30e9e0?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1499529112087-3cb3b73cec95?auto=format&fit=crop&w=900&q=80",
];

const CategoryForm = ({ 
  initialData, 
  parent,
  onSave, 
  onCancel 
}: { 
  initialData?: CatalogueCategory; 
  parent?: CatalogueCategory;
  onSave: (data: CatalogueCategoryInput | CatalogueCategoryUpdate) => Promise<void>; 
  onCancel: () => void;
}) => {
  const [form, setForm] = useState<Partial<CatalogueCategoryInput>>({
    name: initialData?.name || "",
    slug: initialData?.slug || "",
    groupLabel: initialData?.groupLabel || parent?.groupLabel || parent?.name || "",
    lead: initialData?.lead || "",
    pageHeading: initialData?.pageHeading || "",
    seoTitle: initialData?.seoTitle || "",
    seoDescription: initialData?.seoDescription || "",
    rainfall: initialData?.rainfall || "",
    image: initialData?.image || parent?.image || defaultImages[0],
    faqs: (initialData?.faqs ?? []).map((item) => ({ question: item.question, answer: item.answer })),
    active: initialData?.active ?? true,
    sortOrder: initialData?.sortOrder ?? 0,
    parentId: initialData ? initialData.parentId : parent?.id ?? null,
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isEditing = !!initialData;
  const isSubcategory = form.parentId !== null;
  const categorySlug = isSubcategory
    ? (isEditing ? initialData?.slug || "" : slugify(form.name || ""))
    : (form.slug || "");
  const slugChanged = isEditing && !isSubcategory && categorySlug !== initialData?.slug;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    if (!form.name?.trim()) {
      setError("Name is required");
      setSaving(false);
      return;
    }

    if (!categorySlug) {
      setError(isSubcategory
        ? "Name must include letters or numbers so an internal identifier can be created."
        : "Category URL is required");
      setSaving(false);
      return;
    }
    if (!isSubcategory && !form.groupLabel?.trim()) {
      setError("Group label is required");
      setSaving(false);
      return;
    }

    const groupLabel = form.groupLabel?.trim() || parent?.groupLabel || parent?.name || form.name;
    try {
      if (isEditing) {
        const update: CatalogueCategoryUpdate = isSubcategory
          ? {
              name: form.name,
              slug: categorySlug,
              groupLabel,
              lead: form.lead,
              active: form.active,
            }
          : {
              name: form.name,
              slug: categorySlug,
              groupLabel,
              lead: form.lead,
              rainfall: form.rainfall,
              image: form.image,
              active: form.active,
            };
        await onSave(update);
      } else {
        await onSave({
          name: form.name,
          slug: categorySlug,
          groupLabel,
          lead: form.lead || "",
          pageHeading: "",
          seoTitle: "",
          seoDescription: "",
          rainfall: isSubcategory ? "" : form.rainfall || "",
          image: isSubcategory ? parent?.image || "" : form.image || "",
          faqs: [],
          active: form.active ?? true,
          sortOrder: form.sortOrder ?? 0,
          parentId: form.parentId ?? null,
        });
      }
    } catch (err: any) {
      setError(err.message || "Failed to save category");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-form-card" style={{ background: "#f5f7f4", border: "1px solid #c8cec9", borderRadius: 12, marginTop: 16, marginBottom: 16 }}>
      <h3 style={{ fontSize: 18, color: "var(--green)", marginBottom: 16 }}>{isEditing ? isSubcategory ? "Edit Subcategory" : "Edit Category" : isSubcategory ? "New Subcategory" : "New Root Category"}</h3>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="admin-form-grid">
          <label>
            <span className="admin-label-title">Name<span className="admin-required-star" aria-hidden="true">*</span></span>
            <input 
              value={form.name} 
              onChange={e => {
                const name = e.target.value;
                setForm(prev => ({ 
                  ...prev, 
                  name, 
                  slug: !isEditing && !isSubcategory ? slugify(name) : prev.slug 
                }));
              }} 
              placeholder={isSubcategory ? "e.g. Annual" : "e.g. Ryegrass"} 
            />
          </label>
          {!isSubcategory && (
            <label>
              <span className="admin-label-title">Category URL<span className="admin-required-star" aria-hidden="true">*</span></span>
              <input 
                value={form.slug} 
                onChange={e => setForm(prev => ({ ...prev, slug: slugify(e.target.value) }))} 
                placeholder="e.g. ryegrass" 
              />
              <small>
                {form.active
                  ? `Public page: /products/${form.slug || "category-slug"}`
                  : "No category page while inactive"}
                {slugChanged ? ` The previous address /products/${initialData?.slug} will redirect here.` : ""}
              </small>
            </label>
          )}
          {!isSubcategory && (
            <>
              <label>
                <span className="admin-label-title">Group Label<span className="admin-required-star" aria-hidden="true">*</span></span>
                <input 
                  value={form.groupLabel} 
                  onChange={e => setForm(prev => ({ ...prev, groupLabel: e.target.value }))} 
                  placeholder="e.g. Grasses" 
                />
                <small>Used for filtering on the public site (e.g. Mixes, Grasses, Legumes, Other)</small>
              </label>
              <label>
                Rainfall
                <input 
                  value={form.rainfall} 
                  onChange={e => setForm(prev => ({ ...prev, rainfall: e.target.value }))} 
                  placeholder="e.g. 500–900+ mm" 
                />
              </label>
              <label className="wide">
                Lead description
                <textarea 
                  value={form.lead} 
                  onChange={e => setForm(prev => ({ ...prev, lead: e.target.value }))} 
                  placeholder="Short description displayed on the category card..." 
                  rows={3}
                />
              </label>
              <label className="wide">
                Image URL
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <input 
                    value={form.image} 
                    onChange={e => setForm(prev => ({ ...prev, image: e.target.value }))} 
                    placeholder="https://..." 
                    style={{ flex: 1 }}
                  />
                  {form.image && (
                    <div className="admin-photo-thumb" style={{ width: 40, height: 40, flexShrink: 0 }}>
                      <img src={form.image} alt="Preview" />
                    </div>
                  )}
                </div>
              </label>
            </>
          )}
          {isSubcategory && (
            <label className="wide">
              Description
              <textarea
                value={form.lead}
                onChange={e => setForm(prev => ({ ...prev, lead: e.target.value }))}
                placeholder="Optional notes about this subcategory..."
                rows={3}
              />
              <small>Internal notes only. Not shown on the public site yet.</small>
            </label>
          )}
          {!isSubcategory && isEditing && initialData && (
            <div className="wide admin-notice" style={{ margin: 0 }}>
              <Icon name="info" size={18} />
              <p>
                Page heading, search metadata and FAQs are edited in Site settings.
                {" "}
                <button type="button" className="admin-text-button" onClick={() => navigate(`/admin/site-settings/categories/${initialData.id}`)}>
                  Edit SEO and FAQs in Site settings
                </button>
              </p>
            </div>
          )}
          <label className="wide admin-check-row">
            <input 
              type="checkbox" 
              checked={form.active} 
              onChange={e => setForm(prev => ({ ...prev, active: e.target.checked }))} 
            />
            <span>
              <strong>Active</strong>
              <small>If unchecked, this category is hidden from the public site and cannot be assigned to new products.</small>
            </span>
          </label>
        </div>
        {error && <div className="admin-form-error" style={{ color: "#b42318", fontSize: 14 }}>{error}</div>}
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 16 }}>
          <button type="button" className="admin-button ghost" onClick={onCancel} disabled={saving}>Cancel</button>
          <button type="submit" className="admin-button primary" disabled={saving}>
            {saving ? "Saving..." : "Save category"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default function AdminCategories() {
  const queryClient = useQueryClient();
  const { data: categories = [], isLoading, error: loadError, refetch } = useListAdminCategories();
  
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  const reorderCategories = useReorderCategories();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [addingChildTo, setAddingChildTo] = useState<number | null>(null);
  const [isAddingRoot, setIsAddingRoot] = useState(false);
  const [error, setError] = useState("");

  const refreshQueries = async () => {
    await queryClient.invalidateQueries({ queryKey: getListAdminCategoriesQueryKey() });
    await queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
    await queryClient.invalidateQueries({ queryKey: getListAdminProductsQueryKey() });
    await queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
  };

  const handleCreate = async (data: CatalogueCategoryInput) => {
    await createCategory.mutateAsync({ data });
    await refreshQueries();
    setIsAddingRoot(false);
    setAddingChildTo(null);
  };

  const handleUpdate = async (id: number, data: CatalogueCategoryUpdate) => {
    await updateCategory.mutateAsync({ id, data });
    await refreshQueries();
    setEditingId(null);
  };

  const handleDelete = async (category: CatalogueCategory) => {
    if (!window.confirm(`Are you sure you want to delete "${category.name}"? If it is used by any products, this may fail.`)) {
      return;
    }
    setError("");
    try {
      await deleteCategory.mutateAsync({ id: category.id });
      await refreshQueries();
    } catch (err: any) {
      setError(err.message || "Cannot delete category in use.");
    }
  };

  const handleReorder = async (items: CatalogueCategory[], id: number, direction: 'up' | 'down') => {
    const currentIndex = items.findIndex(c => c.id === id);
    if (
      (direction === 'up' && currentIndex === 0) || 
      (direction === 'down' && currentIndex === items.length - 1)
    ) {
      return;
    }

    const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const newItems = [...items];
    const temp = newItems[currentIndex];
    newItems[currentIndex] = newItems[swapIndex];
    newItems[swapIndex] = temp;

    const payload = newItems.map((c, index) => ({ id: c.id, sortOrder: index + 1 }));
    try {
      await reorderCategories.mutateAsync({ data: { items: payload } });
      await refreshQueries();
    } catch (err: any) {
      setError("Failed to reorder: " + err.message);
    }
  };

  const rootCategories = useMemo(() => 
    categories.filter(c => c.parentId === null).sort((a, b) => a.sortOrder - b.sortOrder)
  , [categories]);

  const getChildren = (parentId: number) => 
    categories.filter(c => c.parentId === parentId).sort((a, b) => a.sortOrder - b.sortOrder);

  if (isLoading) {
    return <div className="admin-content"><div className="admin-empty">Loading taxonomy...</div></div>;
  }
  if (loadError) {
    return (
      <div className="admin-content">
        <div className="admin-empty">
          <strong>Category settings could not be loaded.</strong>
          <button type="button" className="admin-button primary" onClick={() => refetch()}>Try again</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeader 
        eyebrow="Settings" 
        title={<>Taxonomy &amp; <strong>categories</strong></>} 
        action={<button className="admin-button primary" onClick={() => setIsAddingRoot(true)}><Icon name="plus" size={18}/>Add root category</button>}
        onBack={() => navigate("/admin/products")}
      />
      <div className="admin-content">
        <div className="admin-notice">
          <Icon name="info" size={20}/>
          <p>Root categories use /products/category-slug as their public page, edited here. Subcategories group products on that landing page and are not their own URLs. Individual products use /products/category-slug/product-slug, managed on each product record.</p>
        </div>
        
        {error && <div className="admin-notice" style={{ background: "#fef3f2", color: "#b42318" }}>
          <p>{error}</p>
        </div>}

        {isAddingRoot && (
          <CategoryForm 
            onSave={handleCreate as any} 
            onCancel={() => setIsAddingRoot(false)} 
          />
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {rootCategories.map(root => {
            const children = getChildren(root.id);
            return (
              <div key={root.id} style={{ border: "1px solid #e0e4df", borderRadius: 12, background: "#fff", overflow: "hidden" }}>
                 <div className="admin-taxonomy-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", background: root.active ? "#fff" : "#fafafa", borderBottom: children.length > 0 || addingChildTo === root.id ? "1px solid #edf0ed" : "none" }}>
                   <div className="admin-taxonomy-identity" style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                       <button aria-label={`Move ${root.name} up`} disabled={root === rootCategories[0]} className="icon-button" style={{ width: 24, height: 24, border: "none", background: "transparent", color: "#aebdb5" }} onClick={() => handleReorder(rootCategories, root.id, 'up')}><Icon name="chevron-up" size={16}/></button>
                       <button aria-label={`Move ${root.name} down`} disabled={root === rootCategories.at(-1)} className="icon-button" style={{ width: 24, height: 24, border: "none", background: "transparent", color: "#aebdb5" }} onClick={() => handleReorder(rootCategories, root.id, 'down')}><Icon name="chevron-down" size={16}/></button>
                    </div>
                    <div>
                       <div className="admin-taxonomy-meta" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 16, fontWeight: 700, color: root.active ? "var(--green)" : "#7b827d" }}>{root.name}</span>
                        {!root.active && <span className="status-pill" style={{ background: "#edf0ed", color: "#7b827d" }}>Inactive</span>}
                          <span style={{ fontSize: 12, color: "#7b827d", background: "#f5f7f4", padding: "2px 8px", borderRadius: 999 }}>{root.active ? `Category page: /products/${root.slug}` : "No category page while inactive"}</span>
                        {root.groupLabel && <span style={{ fontSize: 12, color: "#7b827d", border: "1px solid #edf0ed", padding: "2px 8px", borderRadius: 999 }}>{root.groupLabel}</span>}
                      </div>
                    </div>
                  </div>
                   <div className="admin-taxonomy-actions" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button className="admin-button ghost small" onClick={() => setAddingChildTo(root.id)}><Icon name="plus" size={14}/> Add subcategory</button>
                    <button className="admin-button ghost small" onClick={() => navigate(`/admin/site-settings/categories/${root.id}`)}>SEO &amp; FAQs</button>
                    <button className="admin-button outline small" onClick={() => setEditingId(root.id)}>Edit</button>
                    <button className="admin-text-button danger" onClick={() => handleDelete(root)}><Icon name="trash-2" size={16}/></button>
                  </div>
                </div>

                {editingId === root.id && (
                  <div style={{ padding: "0 20px 20px" }}>
                    <CategoryForm 
                      initialData={root}
                      onSave={(data) => handleUpdate(root.id, data as CatalogueCategoryUpdate)}
                      onCancel={() => setEditingId(null)}
                    />
                  </div>
                )}

                {(children.length > 0 || addingChildTo === root.id) && (
                  <div style={{ padding: "16px 20px", background: "#f7f9f6", display: "flex", flexDirection: "column", gap: 12 }}>
                    {children.map(child => (
                      <div key={child.id} style={{ display: "flex", flexDirection: "column" }}>
                         <div className="admin-taxonomy-row child" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "#fff", border: "1px solid #edf0ed", borderRadius: 8 }}>
                           <div className="admin-taxonomy-identity" style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                               <button aria-label={`Move ${child.name} up`} disabled={child === children[0]} className="icon-button" style={{ width: 20, height: 20, border: "none", background: "transparent", color: "#aebdb5" }} onClick={() => handleReorder(children, child.id, 'up')}><Icon name="chevron-up" size={14}/></button>
                               <button aria-label={`Move ${child.name} down`} disabled={child === children.at(-1)} className="icon-button" style={{ width: 20, height: 20, border: "none", background: "transparent", color: "#aebdb5" }} onClick={() => handleReorder(children, child.id, 'down')}><Icon name="chevron-down" size={14}/></button>
                            </div>
                             <div className="admin-taxonomy-meta" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontSize: 14, fontWeight: 600, color: child.active ? "var(--green)" : "#7b827d" }}>{child.name}</span>
                              {!child.active && <span className="status-pill" style={{ background: "#edf0ed", color: "#7b827d" }}>Inactive</span>}
                              <span style={{ fontSize: 12, color: "#7b827d" }}>Filter only — uses parent category page</span>
                            </div>
                          </div>
                           <div className="admin-taxonomy-actions" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <button className="admin-button outline small" style={{ minHeight: 32 }} onClick={() => setEditingId(child.id)}>Edit</button>
                            <button className="admin-text-button danger" onClick={() => handleDelete(child)}><Icon name="trash-2" size={14}/></button>
                          </div>
                        </div>
                        {editingId === child.id && (
                          <div style={{ marginTop: 12 }}>
                            <CategoryForm 
                              initialData={child}
                               parent={root}
                              onSave={(data) => handleUpdate(child.id, data as CatalogueCategoryUpdate)}
                              onCancel={() => setEditingId(null)}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                    
                    {addingChildTo === root.id && (
                      <CategoryForm 
                       parent={root}
                        onSave={handleCreate as any}
                        onCancel={() => setAddingChildTo(null)}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
          
          {rootCategories.length === 0 && !isAddingRoot && (
            <div className="admin-empty">No categories found. Create a root category to start building your taxonomy.</div>
          )}
        </div>
      </div>
    </>
  );
}
