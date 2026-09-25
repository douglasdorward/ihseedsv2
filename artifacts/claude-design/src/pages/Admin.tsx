import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Icon, StatusPill } from "../components/ui";
import { AlsoPopularPicker } from "../components/AlsoPopularPicker";
import { ProductPageEditor } from "../components/ProductPageEditor";
import { FillFromPdf } from "../components/FillFromPdf";
import AdminTechSheets from "./AdminTechSheets";
import AdminImages from "./AdminImages";
import { fetchTechSheetItem } from "../ai-fill";
import { isAlsoPopularEligible } from "../also-popular";
import { navigate, useLocation } from "../router";
import AdminCategories from "./AdminCategories";
import AdminAdministrators from "./AdminAdministrators";
import AdminSiteSettings from "./AdminSiteSettings";
import AdminHomePage from "./AdminHomePage";
import AdminAbout from "./AdminAbout";
import AdminRootCategories from "./AdminRootCategories";
import AdminSeedGuide from "./AdminSeedGuide";
import AdminCompany from "./AdminCompany";
import AdminBlog from "./AdminBlog";
import AdminResellers from "./AdminResellers";
import { persistLatestProductAndPublish } from "../persist-latest-product";
import { ProductPhotoOrderButtons } from "../product-photo-order";
import { photoDisplaySrc, uploadMediaAsset } from "../upload-image";
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
  ProductFaq,
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
  ProductListingState
} from "@workspace/api-client-react";
import { sanitizeSlugInput, slugify } from "../product-slug";
import "../admin-v2.css";

function forSearchMetadataInput(value: string) {
  return value.replace(/[™®]/g, "").replace(/\s{2,}/g, " ").replace(/\s+([,.;:!?])/g, "$1");
}

function forSearchMetadata(value: string) {
  return forSearchMetadataInput(value).trim();
}

function h1EditorValue(name: string, h1?: string) {
  return h1?.trim() ? h1 : name;
}

function h1StoredValue(name: string, value: string) {
  const trimmed = value.trim();
  return !trimmed || trimmed === name.trim() ? "" : value;
}

type ProductStatus = "in-stock" | "low" | "very-low" | "unavailable";
type RecordKind = "Mix" | "Variety" | "Commodity / generic";
type PublishIssueKey =
  | "name"
  | "slug"
  | "category"
  | "details.recordType"
  | "details.tagline"
  | "details.blurb"
  | "details.keyAttributes"
  | "details.description"
  | "details.seoTitle"
  | "details.seoDescription"
  | "saleLines.default"
  | "saleLines.stockCodes";

type PublishIssue = {
  key: PublishIssueKey;
  label: string;
  tab: number;
  message: string;
};

const RAINFALL_MIN_MM_OPTIONS = Array.from(
  { length: Math.floor((800 - 150) / 50) + 1 },
  (_, i) => 150 + i * 50,
);

function rainfallMinMmOptions(current: number | null | undefined) {
  if (current == null || RAINFALL_MIN_MM_OPTIONS.includes(current)) {
    return RAINFALL_MIN_MM_OPTIONS;
  }
  return [...RAINFALL_MIN_MM_OPTIONS, current].sort((a, b) => a - b);
}

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
  availability: ["Good stock", "Low stock", "Very low", "Unavailable"],
  availabilityOverride: ["", "Good stock", "Low stock", "Very low", "Unavailable"]
};

const blankProduct = {
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
  listingState: "Active",
  publishStatus: "Draft",
  saleLines: [],
  details: {
    stockCode: "",
    guideSection: "",
    recordType: "" as any,
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
    tagline: "",
    blurb: "",
    keyAttributes: [],
    description: "",
    distributionNote: "",
    notes: "",
    components: [],
    faqs: [],
    formulationYear: "",
    photos: [
      { slot: "Photo 1 · Hero", file: "", rating: "", src: "" },
      { slot: "Photo 2", file: "", rating: "", src: "" },
      { slot: "Photo 3", file: "", rating: "", src: "" },
    ],
    inCurrentPrintedGuide: false,
    h1: "",
    seoTitle: "",
    seoDescription: "",
    socialTitle: "",
    socialDescription: "",
    socialImage: "",
    canonicalUrl: "",
    robotsIndex: true,
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

const formatDate = (value: string | null | undefined) => {
  if (!value) return "Never";
  const date = new Date(value);
  const time = new Intl.DateTimeFormat("en-AU", { hour: "2-digit", minute: "2-digit" }).format(date);
  const day = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric" }).format(date);
  return `${time}, ${day}`;
};

function getPublishIssues(form: any): PublishIssue[] {
  const saleLines = form.saleLines ?? [];
  return [
    !form.name?.trim() && { key: "name", label: "Product name", tab: 1, message: "Enter a product name." },
    !form.slug?.trim() && { key: "slug", label: "Slug", tab: 1, message: "Enter a URL slug." },
    !form.category?.trim() && { key: "category", label: "Category", tab: 1, message: "Choose a category." },
    !form.details?.recordType && { key: "details.recordType", label: "Record type", tab: 1, message: "Choose a record type." },
    !form.details?.tagline?.trim() && { key: "details.tagline", label: "Tagline", tab: 5, message: "Enter a tagline before publishing." },
    !form.details?.blurb?.trim() && { key: "details.blurb", label: "Blurb", tab: 5, message: "Enter a blurb before publishing." },
    !(form.details?.keyAttributes ?? []).some((attribute: string) => attribute.trim()) && { key: "details.keyAttributes", label: "Key attributes", tab: 5, message: "Add at least one key attribute." },
    !form.details?.description?.trim() && { key: "details.description", label: "Product description", tab: 5, message: "Enter a product description." },
    !form.details?.seoTitle?.trim() && { key: "details.seoTitle", label: "SEO title", tab: 6, message: "Enter an SEO title before publishing." },
    !form.details?.seoDescription?.trim() && { key: "details.seoDescription", label: "SEO description", tab: 6, message: "Enter an SEO description before publishing." },
    saleLines.length > 0 && saleLines.filter((line: any) => line.isDefault).length !== 1 && { key: "saleLines.default", label: "Exactly one default sale line", tab: 4, message: "Choose exactly one default sale line." },
    new Set(saleLines.map((line: any) => line.stockCode)).size !== saleLines.length && { key: "saleLines.stockCodes", label: "Unique sale line stock codes", tab: 4, message: "Each sale line must use a unique stock code." },
  ].filter(Boolean) as PublishIssue[];
}

const stripHttpErrorPrefix = (message: string) =>
  message.replace(/^HTTP \d+(?: [^:]+)?:\s*/i, "");

function RequiredStar() {
  return <span className="admin-required-star" aria-hidden="true">*</span>;
}

function AdminOnlyMark() {
  return <span className="admin-only-mark">(Admin-only)</span>;
}

function FieldLabel({
  children,
  required = false,
  hint,
}: {
  children: ReactNode;
  required?: boolean;
  hint?: ReactNode;
}) {
  return (
    <>
      <span className="admin-label-title">
        {children}
        {required ? <RequiredStar /> : null}
      </span>
      {hint ? <span className="admin-field-hint">{hint}</span> : null}
    </>
  );
}

export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  busyLabel,
  busy = false,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  busyLabel?: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="admin-dialog-backdrop" role="presentation" onMouseDown={busy ? undefined : onCancel}>
      <section
        className="admin-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-confirm-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="admin-confirm-title">{title}</h2>
        <p>{body}</p>
        <div className="admin-dialog-actions">
          <button className="admin-button primary" type="button" onClick={onConfirm} disabled={busy}>
            {busy ? (busyLabel ?? confirmLabel) : confirmLabel}
          </button>
          <button className="admin-button ghost" type="button" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        </div>
      </section>
    </div>
  );
}

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
    return ["details.tagline", "details.blurb", "details.keyAttributes", "details.description"];
  }
  if (tab === 6) {
    return ["details.seoTitle", "details.seoDescription"];
  }
  return [];
}

function getFieldHasValue(form: any, field: string) {
  let val;
  if (field.startsWith("details.")) val = form.details ? form.details[field.split(".")[1]] : undefined;
  else val = form[field];

  if (field === "details.components") {
    return Array.isArray(val) && val.some((component: ProductComponent) => component.speciesName?.trim());
  }
  if (Array.isArray(val)) return val.length > 0;
  if (typeof val === "boolean") return true; 
  return val !== null && val !== "" && val !== undefined;
}

const MIX_COMPONENT_UNITS = ["%", "kg/ha", "g/ha", "kg"];
const PRODUCT_FAQ_LIMIT = 10;
const PRODUCT_FAQ_QUESTION_MAX = 180;
const PRODUCT_FAQ_ANSWER_MAX = 4000;
const emptyProductFaq: ProductFaq = { question: "", answer: "" };

function mixComponentFieldIssues(
  component: ProductComponent,
  context: { ownSlug: string; knownSlugs: Set<string>; duplicateLink: boolean },
) {
  const issues: Partial<Record<"speciesName" | "productLink" | "inclusionRate" | "unit" | "description", string>> = {};
  const name = component.speciesName.trim();
  const link = component.productLink.trim();
  const unit = component.unit.trim();
  const hasOtherContent = Boolean(link || component.description.trim() || component.inclusionRate != null);
  if (!name && hasOtherContent) issues.speciesName = "Add a display name for this component.";
  else if (name.length > 120) issues.speciesName = "Display name must be 120 characters or fewer.";
  if (link) {
    if (link === context.ownSlug) issues.productLink = "A mix cannot link to itself.";
    else if (!context.knownSlugs.has(link)) issues.productLink = "Choose a catalogue product, or leave this unlinked.";
    else if (context.duplicateLink) issues.productLink = "This product is already used on another component.";
  }
  if (component.inclusionRate != null) {
    if (Number.isNaN(component.inclusionRate) || component.inclusionRate < 0) issues.inclusionRate = "Enter a rate of 0 or more.";
    else if ((!unit || unit === "%") && component.inclusionRate > 100) issues.inclusionRate = "A percentage rate cannot be more than 100.";
  }
  if (unit.length > 20) issues.unit = "Unit must be 20 characters or fewer.";
  if (component.description.length > 10000) issues.description = "Description must be 10,000 characters or fewer.";
  return issues;
}

function faqFieldIssues(faq: ProductFaq) {
  const issues: Partial<Record<"question" | "answer", string>> = {};
  const question = faq.question.trim();
  const answer = faq.answer.trim();
  if (!question && answer) issues.question = "Add a question for this FAQ.";
  else if (faq.question.length > PRODUCT_FAQ_QUESTION_MAX) issues.question = "Question must be 180 characters or fewer.";
  if (!answer && question) issues.answer = "Add an answer for this FAQ.";
  else if (faq.answer.length > PRODUCT_FAQ_ANSWER_MAX) issues.answer = "Answer must be 4,000 characters or fewer.";
  return issues;
}

function getOverallCompleteness(form: any) {
  if (!form || !form.category) return 0;
  let fields: string[] = [];
  for (let i = 1; i <= 6; i++) fields = fields.concat(getTabFields(i, form));
  if (fields.length === 0) return 100;
  const filled = fields.filter(f => getFieldHasValue(form, f)).length;
  return Math.round((filled / fields.length) * 100);
}

function PersistencyAndAustralianBredFields({
  details,
  setDetail,
}: {
  details: { persistencyType: string; australianBred: boolean };
  setDetail: (key: string, value: any) => void;
}) {
  return (
    <div className="admin-form-grid">
      <label>Persistency type<select value={details.persistencyType} onChange={(event) => setDetail("persistencyType", event.target.value)}><option value="">Not set</option>{["Annual", "Biennial", "Perennial", "Hybrid perennial", "Short-term (1–2 years)"].map((value) => <option key={value}>{value}</option>)}</select></label>
      <label className="admin-check-field">
        Australian bred <AdminOnlyMark />
        <span className="admin-check-control">
          <input type="checkbox" checked={details.australianBred} onChange={(event) => setDetail("australianBred", event.target.checked)} />
        </span>
      </label>
    </div>
  );
}

function TabCompleteness({ form, tab }: { form: any, tab: number }) {
  if (!form.category) return null;
  const fields = getTabFields(tab, form);
  if (fields.length === 0) return null;
  const filled = fields.filter(f => getFieldHasValue(form, f)).length;
  return <span className={`admin-v2-section-count ${filled === fields.length ? 'complete' : ''}`}>{filled} / {fields.length}</span>;
}

function getListingState(product: any): ProductListingState {
  if (product.listingState === "Legacy" || product.listingOverride === "Force legacy" || product.listingOverride === "Legacy") return "Legacy";
  if (product.listingState === "New") return "New";
  return "Active";
}

function getDerivedAvailability(product: any) {
  if (getListingState(product) === "Legacy") return "Unavailable";
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

function getStockCodesSummary(product: any) {
  if (!product.saleLines || product.saleLines.length === 0) return "—";
  return product.saleLines.map((l: any) => l.stockCode).join(", ");
}

type ProductSortKey = "name" | "stockCodes" | "stock" | "updated" | "completeness" | "listing";

function compareProductColumn(first: any, second: any, key: ProductSortKey) {
  if (key === "updated") {
    const firstActivity = Date.parse(first.draftSavedAt ?? first.updatedAt ?? "") || 0;
    const secondActivity = Date.parse(second.draftSavedAt ?? second.updatedAt ?? "") || 0;
    return firstActivity - secondActivity;
  }
  if (key === "completeness") return getOverallCompleteness(first) - getOverallCompleteness(second);
  const value = {
    name: (product: any) => product.name ?? "",
    stockCodes: getStockCodesSummary,
    stock: getDerivedAvailability,
    listing: getListingState,
  }[key];
  return value(first).localeCompare(value(second), undefined, { numeric: true, sensitivity: "base" });
}

function ProductSortHeader({
  label,
  column,
  sortKey,
  sortDir,
  onSort,
}: {
  label: string;
  column: ProductSortKey;
  sortKey: ProductSortKey;
  sortDir: "asc" | "desc";
  onSort: (column: ProductSortKey) => void;
}) {
  const active = sortKey === column;
  const nextDir = active && sortDir === "asc" ? "Z to A" : "A to Z";
  return (
    <th aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        className={`admin-sort-button${active ? " active" : ""}`}
        onClick={() => onSort(column)}
        aria-label={`Sort by ${label}, ${nextDir}`}
      >
        {label}
        <span className="admin-sort-arrows" data-dir={active ? sortDir : ""} aria-hidden="true" />
      </button>
    </th>
  );
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

type AdminAccountProps = {
  role: "admin" | "superadmin";
  accountName: string;
  onSignOut: () => Promise<unknown>;
};

function AdminLayout({ children, mobileOpen, setMobileOpen, role, accountName, onSignOut }: AdminAccountProps & { children: ReactNode; mobileOpen: boolean; setMobileOpen: (open: boolean) => void; }) {
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    setSignOutError("");
    try {
      await onSignOut();
    } catch {
      setSignOutError("Could not sign out. Please try again.");
    } finally {
      setSigningOut(false);
    }
  };
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem("ih-admin-sidebar") === "collapsed";
    } catch {
      return false;
    }
  });
  const nav = [
    { label: "Dashboard", icon: "dashboard", href: "/admin", enabled: true },
    { label: "Products & mixes", icon: "sprout", href: "/admin/products", enabled: true },
    { label: "Images", icon: "image", href: "/admin/images", enabled: true },
    { label: "Uploads", icon: "file-text", href: "/admin/tech-sheets", enabled: true },
    { label: "Blog", icon: "newspaper", href: "/admin/blog", enabled: true },
    { label: "Resellers", icon: "map-pin", href: "/admin/resellers", enabled: true },
    ...(role === "superadmin"
      ? [{ label: "Administrators", icon: "users", href: "/admin/administrators", enabled: true }]
      : []),
    { label: "Site settings", icon: "settings", href: "/admin/site-settings", enabled: true },
  ];

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem("ih-admin-sidebar", next ? "collapsed" : "expanded");
      } catch {
        /* ignore quota / private-mode failures */
      }
      return next;
    });
  };

  return (
    <div className={`admin-shell${collapsed ? " is-sidebar-collapsed" : ""}`}>
      <button className="admin-mobile-toggle" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle admin navigation">
        <Icon name={mobileOpen ? "close" : "menu"} size={24} />
      </button>
      <aside className={`admin-sidebar ${mobileOpen ? "is-open" : ""} ${collapsed ? "is-collapsed" : ""}`}>
        <div className="admin-sidebar-top">
          <button className="admin-logo" onClick={() => navigate("/admin")} aria-label="IH Seeds admin dashboard">
            <img src="/ih-seeds-logo.png" alt="IH Seeds" />
            <span>Admin</span>
          </button>
          <button
            className="admin-sidebar-toggle"
            type="button"
            aria-expanded={!collapsed}
            aria-controls="admin-sidebar-nav"
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
            onClick={toggleCollapsed}
          >
            <Icon name={collapsed ? "chevron-right" : "chevron-left"} size={18} />
          </button>
        </div>
        <nav id="admin-sidebar-nav" aria-label="Admin navigation">
          {nav.map((item) => {
            const active = item.href === "/admin" ? location === "/admin" : item.href && location.startsWith(item.href);
            return (
              <button
                key={item.label}
                className={active ? "active" : ""}
                disabled={!item.enabled}
                title={item.enabled ? item.label : `${item.label} (soon)`}
                onClick={() => { if (item.href) navigate(item.href); setMobileOpen(false); }}
              >
                <AdminNavIcon name={item.icon} />
                <span>{item.label}</span>
                {!item.enabled && <small>Soon</small>}
              </button>
            );
          })}
        </nav>
        <div className="admin-account-footer">
          <div className="admin-user">
            <span className="admin-avatar" aria-hidden="true">{accountName.slice(0, 2).toUpperCase()}</span>
            <span className="admin-user-identity"><strong title={accountName}>{accountName}</strong><small>{role === "superadmin" ? "Superadmin" : "Administrator"}</small></span>
            <button className="admin-sidebar-signout" type="button" aria-label={signingOut ? "Signing out" : "Sign out"} title="Sign out" disabled={signingOut} onClick={handleSignOut}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>
            </button>
          </div>
          {signOutError && <p className="admin-signout-error" role="alert">{signOutError}</p>}
        </div>
      </aside>
      {mobileOpen && <button className="admin-overlay" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />}
      <main className="admin-main">{children}</main>
    </div>
  );
}

export function PageHeader({ eyebrow, title, action }: { eyebrow: string; title: ReactNode; action?: ReactNode }) {
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
            <div><span className="admin-feature-icon"><Icon name="file-text" size={24}/></span><h2>Fill from PDFs</h2><p>Upload documents that inform product creation and our own tech sheets, match them to products, then review suggested fields in the editor. Nothing publishes automatically.</p><button className="admin-button outline" onClick={() => navigate("/admin/tech-sheets")}>Open uploads</button></div>
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
  const [sortKey, setSortKey] = useState<ProductSortKey>("updated");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [view, setView] = useState<"Published" | "Draft" | "Archived">(() => {
    const requestedView = new URLSearchParams(window.location.search).get("view");
    return requestedView === "Draft" || requestedView === "Archived" ? requestedView : "Published";
  });
  const [selected, setSelected] = useState<number[]>([]);
  const [bulkStatus, setBulkStatus] = useState<ProductInputStatus>("in-stock");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error">("success");
  const messageRef = useRef<HTMLParagraphElement>(null);
  const [pendingPublish, setPendingPublish] = useState<AdminProduct | null>(null);
  
  const [importing, setImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importReport, setImportReport] = useState<any | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);

  const closeImportDialog = () => {
    if (importing) return;
    setShowImportDialog(false);
    setImportFile(null);
    setImportReport(null);
  };

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
      setShowImportDialog(false);
      setMessageTone("success");
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
      if (view === "Draft") return product.lifecycleStatus === "Draft";
      if (view === "Archived") return product.lifecycleStatus === "Archived";
      return true;
    })
    .filter((product) =>
      (!query || `${product.name} ${product.note} ${product.category}`.toLowerCase().includes(query.toLowerCase())) &&
      (!statusFilter || getDerivedAvailability(product) === statusFilter) &&
      (!categoryFilter || product.category === categoryFilter) &&
      (!listingFilter || getListingState(product) === listingFilter)
    )
    .sort((first, second) => {
      const difference = compareProductColumn(first, second, sortKey);
      if (difference !== 0) return sortDir === "asc" ? difference : -difference;
      return second.id - first.id;
    }), [products, query, statusFilter, view, categoryFilter, listingFilter, sortKey, sortDir]);

  const toggleSort = (column: ProductSortKey) => {
    if (sortKey === column) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(column);
    setSortDir(column === "updated" ? "desc" : "asc");
  };

  const publishedCount = products.filter(p => p.lifecycleStatus === "Published").length;
  const draftCount = products.filter(p => p.lifecycleStatus === "Draft").length;
  const archivedCount = products.filter(p => p.lifecycleStatus === "Archived").length;

  useEffect(() => {
    setSelected([]);
    setMessage("");
    setMessageTone("success");
  }, [view]);

  useEffect(() => {
    if (message) messageRef.current?.scrollIntoView({ block: "nearest" });
  }, [message]);

  const refreshCatalogue = async () => {
    await queryClient.invalidateQueries({ queryKey: getListAdminProductsQueryKey(), refetchType: "all" });
    await queryClient.invalidateQueries({ queryKey: getGetAdminSummaryQueryKey() });
  };

  const runLifecycleAction = async (
    product: AdminProduct,
    action: "publish" | "archive" | "restore" | "discard" | "delete",
  ) => {
    const prompts = {
      archive: `Archive ${product.name}? It will be removed from the public site immediately, but its data will be kept.`,
      restore: `Restore ${product.name} to Draft? It will remain off the public site until explicitly published.`,
      discard: `Discard leftover unpublished changes for ${product.name}? The live public version will remain unchanged.`,
      delete: `Delete ${product.name} permanently? This cannot be undone.`,
    };
    if (action === "publish") {
      const issues = getPublishIssues(product);
      if (issues.length > 0) {
        navigate(`/admin/products/${product.id}?publish=1`);
        return;
      }
      setPendingPublish(product);
      return;
    }
    if (!window.confirm(prompts[action])) return;
    setSaving(true);
    setMessage("");
    try {
      if (action === "archive") await archiveProduct.mutateAsync({ id: product.id });
      if (action === "restore") await restoreProduct.mutateAsync({ id: product.id });
      if (action === "discard") await discardDraft.mutateAsync({ id: product.id });
      if (action === "delete") await deleteProduct.mutateAsync({ id: product.id });
      await refreshCatalogue();
      setMessageTone("success");
      setMessage(action === "restore" ? "Product restored to Draft." : action === "discard" ? "Draft changes discarded." : action === "archive" ? "Product archived." : "Product deleted.");
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? stripHttpErrorPrefix(error.message) : "Unable to update this product.");
    } finally {
      setSaving(false);
    }
  };

  const confirmPendingPublish = async () => {
    if (!pendingPublish) return;
    const product = pendingPublish;
    setSaving(true);
    setMessage("");
    try {
      await publishProduct.mutateAsync({ id: product.id });
      await refreshCatalogue();
      setMessageTone("success");
      setMessage("Product published.");
      setPendingPublish(null);
    } catch (error) {
      const text = error instanceof Error ? stripHttpErrorPrefix(error.message) : "Unable to update this product.";
      setPendingPublish(null);
      if (text.includes("Complete these fields")) {
        navigate(`/admin/products/${product.id}?publish=1`);
        return;
      }
      setMessageTone("error");
      setMessage(text);
    } finally {
      setSaving(false);
    }
  };

  const renderRowActions = (product: AdminProduct) => (
    <>
      {view !== "Archived" && <button className="admin-text-button" onClick={() => navigate(`/admin/products/${product.id}`)}>{view === "Draft" ? "Continue editing" : "Edit"}</button>}
      {view === "Published" && <button className="admin-text-button" disabled={saving} onClick={() => void runLifecycleAction(product, "archive")}>Archive</button>}
      {view === "Published" && product.hasDraft && <button className="admin-text-button danger" disabled={saving} onClick={() => void runLifecycleAction(product, "discard")}>Discard leftover</button>}
      {view === "Draft" && <button className="admin-text-button" disabled={saving} onClick={() => void runLifecycleAction(product, "publish")}>Publish</button>}
      {view === "Archived" && <button className="admin-text-button" disabled={saving} onClick={() => void runLifecycleAction(product, "restore")}>Restore to Draft</button>}
      {(view === "Archived" || (view === "Draft" && product.lifecycleStatus === "Draft")) && <button className="admin-text-button danger" disabled={saving} onClick={() => void runLifecycleAction(product, "delete")}>Delete</button>}
    </>
  );

  const applyBulk = async () => {
    setSaving(true);
    setMessage("");
    try {
      const selectedProducts = selected
        .map((id) => products.find((product) => product.id === id))
        .filter((product): product is AdminProduct => Boolean(product));
      const updatable = selectedProducts.filter((product) => getListingState(product) !== "Legacy");
      const skippedLegacy = selectedProducts.length - updatable.length;
      if (updatable.length === 0) {
        setMessageTone("error");
        setMessage("Legacy products cannot have availability. Select current catalogue products to update stock.");
        return;
      }
      const patchResults = await Promise.all(updatable.map(async (product) => {
        try {
          await updateProduct.mutateAsync({ id: product.id, data: { status: bulkStatus } });
          return { id: product.id, ok: true as const };
        } catch (error) {
          return { id: product.id, ok: false as const, error: error instanceof Error ? error.message : String(error) };
        }
      }));
      const failed = patchResults.filter((item) => !item.ok);
      if (failed.length) throw new Error(failed[0]?.error || "Unable to update stock.");
      await queryClient.invalidateQueries({ queryKey: getListAdminProductsQueryKey() });
      await queryClient.invalidateQueries({ queryKey: getGetAdminSummaryQueryKey() });
      setSelected([]);
      setMessageTone("success");
      setMessage(skippedLegacy
        ? `Stock statuses updated. ${skippedLegacy} legacy product${skippedLegacy === 1 ? " was" : "s were"} skipped.`
        : "Stock statuses updated.");
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? stripHttpErrorPrefix(error.message) : "Unable to update stock.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader eyebrow="Content" title={<>Products &amp; <strong>mixes</strong></>} action={<div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}><button className="admin-button outline" data-testid="import-btn" onClick={() => setShowImportDialog(true)}>Import catalogue</button><button className="admin-button outline" data-testid="export-btn" onClick={exportCatalogue}>Export catalogue (XLSX)</button><button className="admin-button outline" style={{ width: 34, padding: 0 }} aria-label="Taxonomy settings" onClick={() => navigate("/admin/products/categories")}><Icon name="settings" size={16}/></button><button className="admin-button primary" onClick={() => navigate("/admin/products/new")}><Icon name="plus" size={18}/>Add a product</button></div>} />
      <div className="admin-content">
        {message && (
          <p
            ref={messageRef}
            className={`admin-inline-message${messageTone === "error" ? " error" : ""}`}
            role={messageTone === "error" ? "alert" : "status"}
          >
            {message}
          </p>
        )}

        <div className="admin-table-tabs">
          <button className={view === "Published" ? "active" : ""} data-testid="tab-published" onClick={() => setView("Published")}>Published <span>{publishedCount}</span></button>
          <button className={view === "Draft" ? "active" : ""} onClick={() => setView("Draft")}>Draft <span>{draftCount}</span></button>
          <button className={view === "Archived" ? "active" : ""} onClick={() => setView("Archived")}>Archive <span>{archivedCount}</span></button>
        </div>
        <div className="admin-table-tools">
          <label className="admin-search"><Icon name="search" size={18}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products" /></label>
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} aria-label="Filter by category"><option value="">Category</option>{Array.from(new Set(products.map(p => p.category).filter(Boolean))).map(c => <option key={c} value={c}>{c}</option>)}</select>
          <select value={listingFilter} onChange={(event) => setListingFilter(event.target.value)} aria-label="Filter by listing"><option value="">Listing</option><option value="Active">Active</option><option value="New">New</option><option value="Legacy">Legacy</option></select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by stock level"><option value="">Stock</option>{OPTS.availability.map((level) => <option key={level} value={level}>{level}</option>)}</select>
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
        <div className="admin-table-card">
          <table>
            <thead><tr>
              <th aria-label="Select"></th>
              <ProductSortHeader label="Product" column="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <ProductSortHeader label="Stock codes" column="stockCodes" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <ProductSortHeader label="Stock" column="stock" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <ProductSortHeader label="Updated" column="updated" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <ProductSortHeader label="Completeness" column="completeness" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <ProductSortHeader label="Listing state" column="listing" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <th></th>
            </tr></thead>
            <tbody>
              {isLoading ? <tr><td colSpan={8} className="admin-empty">Loading catalogue…</td></tr> : rows.map((product) => {
                const completeness = getOverallCompleteness(product);
                const listingState = getListingState(product);
                const subcategoryName = product.subcategoryId ? taxonomy.find((t: any) => t.id === product.subcategoryId)?.name : "";
                const categoryLabel = [product.category, subcategoryName && subcategoryName !== product.category ? subcategoryName : ""]
                  .filter(Boolean)
                  .join(" · ");
                return (
                <tr key={product.id}>
                  <td>{view !== "Archived" && <input type="checkbox" checked={selected.includes(product.id)} onChange={() => setSelected((current) => current.includes(product.id) ? current.filter((id) => id !== product.id) : [...current, product.id])} aria-label={`Select ${product.name}`}/>}</td>
                  <td>
                    <button className="admin-product-name" onClick={() => navigate(`/admin/products/${product.id}`)}>{product.name}</button>
                    {categoryLabel && <span className="admin-version-copy">{categoryLabel}</span>}
                    {view === "Published" && product.hasDraft && <span className="admin-badge pending">Leftover unpublished changes</span>}
                    {view === "Draft" && <span className="admin-version-copy">Draft changes — not public</span>}
                    {product.lifecycleStatus === "Draft" && <span className="admin-badge draft">Draft only</span>}
                    <div className="admin-row-actions admin-mobile-row-actions">{renderRowActions(product)}</div>
                  </td>
                  <td><small>{getStockCodesSummary(product)}</small></td>
                  <td><StatusPill status={getDerivedAvailability(product)} /></td>
                  <td>{formatDate(product.updatedAt)}</td>
                  <td>
                    <div className="admin-v2-completeness" title={`${completeness}% complete`}>
                      <div className="admin-v2-completeness-bar"><div className="admin-v2-completeness-fill" style={{width: `${completeness}%`}}></div></div>
                      {completeness}%
                    </div>
                  </td>
                  <td><span className={`admin-listing-badge ${listingState.toLowerCase()}`}>{listingState}</span></td>
                  <td>
                    <div className="admin-row-actions">
                      {renderRowActions(product)}
                    </div>
                  </td>
                </tr>
              )})}
              {!isLoading && rows.length === 0 && <tr><td colSpan={8} className="admin-empty">No products match those filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {pendingPublish && (
        <ConfirmDialog
          title="Are you sure?"
          body={`Publish ${pendingPublish.name}? It will become visible on the public site.`}
          confirmLabel="Publish"
          busyLabel="Publishing…"
          busy={saving}
          onCancel={() => !saving && setPendingPublish(null)}
          onConfirm={() => void confirmPendingPublish()}
        />
      )}
      {showImportDialog && (
        <div className="admin-dialog-backdrop" role="presentation" onMouseDown={importing ? undefined : closeImportDialog}>
          <section
            className="admin-dialog admin-import-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-import-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h2 id="admin-import-title">Import catalogue</h2>
            <div className="admin-notice" role="alert">
              <Icon name="alert-triangle" size={20}/>
              <p><strong>Back up before importing.</strong> This upload replaces the entire product catalogue. Products and product data omitted from the workbook will be deleted or cleared. Export the current catalogue and securely back up that file before continuing.</p>
            </div>
            <p>Upload an XLSX file, dry run to review planned changes, then confirm to apply them.</p>
            {!importReport ? (
              <div className="admin-import-file-row">
                <input type="file" accept=".xlsx" data-testid="import-file" onChange={handleFileChange} />
                <button className="admin-button outline small" data-testid="dry-run-btn" onClick={handleDryRun} disabled={!importFile || importing}>{importing ? "Processing..." : "Dry run import"}</button>
              </div>
            ) : (
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
            )}
            <div className="admin-import-actions">
              <button className="admin-button ghost" type="button" onClick={closeImportDialog} disabled={importing}>Cancel</button>
              {importReport && !importReport.error && importReport.issues?.length === 0 && (
                <button className="admin-button primary" data-testid="commit-import-btn" onClick={() => {
                  if (window.confirm("I have exported and securely backed up the current catalogue. I understand this upload replaces the entire product catalogue, and omitted products or data will be deleted or cleared.")) void handleCommitImport();
                }} disabled={importing}>{importing ? "Committing..." : "Confirm import"}</button>
              )}
            </div>
          </section>
        </div>
      )}
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
    const components = (raw.components ?? []).map((value: any) => "speciesName" in value ? {
      ...value,
      description: value.description ?? "",
    } : {
      productLink: "",
      speciesName: value.name ?? "",
      inclusionRate: null,
      unit: "%",
      description: "",
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
      availabilityOverride: item.availabilityOverride ?? null,
      listingState: getListingState(item),
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
        faqs: Array.isArray(raw.faqs)
          ? raw.faqs.slice(0, PRODUCT_FAQ_LIMIT).map((item: any) => ({
            question: typeof item?.question === "string" ? item.question : "",
            answer: typeof item?.answer === "string" ? item.answer : "",
          }))
          : [],
        photos: raw.photos?.length ? raw.photos : blankProduct.details.photos,
      },
    };
  };

  const [form, setForm] = useState<any>(() => blankProduct);
  const formRef = useRef<any>(blankProduct);
  /** True once the slug has been typed by hand on a new product, so it stops tracking the name. */
  const slugEdited = useRef(false);
  const [viewMode, setViewMode] = useState<"draft" | "live">("draft");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [publishAttempted, setPublishAttempted] = useState(false);
  const [activeTab, setActiveTab] = useState(1);
  const [editorMode, setEditorMode] = useState<"form" | "page">("form");
  const focusedPublishIssues = useRef(false);
  const errorBannerRef = useRef<HTMLDivElement>(null);
  const [showSectionCompletion, setShowSectionCompletion] = useState(false);
  const [showUnsavedPrompt, setShowUnsavedPrompt] = useState(false);
  const [showPublishPrompt, setShowPublishPrompt] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [aiHighlighted, setAiHighlighted] = useState<Set<string>>(new Set());
  const [aiSeed, setAiSeed] = useState<{ suggestions: any[]; warnings: string[] } | null>(null);
  const loadedAiItem = useRef<number | null>(null);

  const sourceDataStr = JSON.stringify(product);
  const persistedFormStr = useMemo(
    () => JSON.stringify(product ? toForm(product.hasDraft ? product : (product.draft ?? product)) : blankProduct),
    [sourceDataStr, isNew],
  );
  const isDirty = JSON.stringify(form) !== persistedFormStr;
  useEffect(() => {
    if (product) {
      const confirmedForm = toForm(product.draft ?? product);
      formRef.current = confirmedForm;
      setForm(confirmedForm);
    } else if (isNew) {
      const emptyForm = structuredClone(blankProduct);
      formRef.current = emptyForm;
      setForm(emptyForm);
    }
  }, [sourceDataStr, isNew]);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("publish") !== "1" || !product) return;
    setPublishAttempted(true);
  }, [product]);
  useEffect(() => {
    const itemId = Number(new URLSearchParams(window.location.search).get("aiItem"));
    if (!itemId || !product || loadedAiItem.current === itemId) return;
    loadedAiItem.current = itemId;
    let cancelled = false;
    fetchTechSheetItem(itemId).then((item) => {
      if (cancelled) return;
      setEditorMode("form");
      setActiveTab(1);
      setAiSeed({
        suggestions: item.proposedPatch?.suggestions ?? [],
        warnings: item.warnings ?? item.proposedPatch?.warnings ?? [],
      });
    }).catch(() => {
      if (!cancelled) {
        loadedAiItem.current = null;
        setError("Could not load the suggested fields from that tech sheet.");
      }
    });
    return () => { cancelled = true; };
  }, [product]);

  const liveForm = useMemo(() => product ? toForm(product) : blankProduct, [product]);
  const currentForm = viewMode === "live" ? liveForm : form;
  const productOptions = useMemo(
    () => products
      .filter((candidate) => candidate.id !== productId && candidate.slug !== form.slug && isAlsoPopularEligible(candidate))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [products, productId, form.slug],
  );
  const productsBySlug = useMemo(
    () => new Map(products.map((candidate) => [candidate.slug, candidate])),
    [products],
  );
  const publishIssues = publishAttempted ? getPublishIssues(form) : [];
  const issueFor = (key: PublishIssueKey) => publishIssues.find((issue) => issue.key === key);
  const tabsWithIssues = new Set(publishIssues.map((issue) => issue.tab));
  const issueSectionNames = [...tabsWithIssues].sort().map((tab) => (
    ({ 1: "Basics", 4: "Selling", 5: "Content & publishing", 6: "SEO" } as Record<number, string>)[tab]
  )).filter(Boolean);
  useEffect(() => {
    if (!publishAttempted) return;
    if (publishIssues.length === 0) {
      if (error.startsWith("Complete these fields before publishing:")) setError("");
      return;
    }
    const currentMessage = `Complete these fields before publishing: ${publishIssues.map((issue) => issue.label).join(", ")}.`;
    if (error !== currentMessage) setError(currentMessage);
  }, [publishAttempted, publishIssues, error]);
  useEffect(() => {
    if (!publishAttempted || focusedPublishIssues.current || !product) return;
    const issues = getPublishIssues(formRef.current);
    if (issues.length === 0) return;
    focusedPublishIssues.current = true;
    setEditorMode("form");
    setActiveTab(issues[0].tab);
  }, [publishAttempted, sourceDataStr, product]);
  useEffect(() => {
    if (!error) return;
    errorBannerRef.current?.scrollIntoView({ block: "nearest" });
  }, [error]);

  const updateForm = (updater: (current: any) => any) => {
    const nextForm = updater(formRef.current);
    formRef.current = nextForm;
    setForm(nextForm);
  };
  const applyAiForm = (nextForm: any, highlightedPaths: string[]) => {
    formRef.current = nextForm;
    setForm(nextForm);
    setAiHighlighted(new Set(highlightedPaths));
    setEditorMode("form");
    setActiveTab(1);
    setSuccess("Suggested fields are in the form only, across every tab the PDF supported. Review highlighted fields, then Save draft or Publish. The live page is unchanged until Publish succeeds.");
  };
  const aiClass = (path: string) => aiHighlighted.has(path) ? " admin-ai-suggested" : "";
  const reconcileForm = (confirmedProduct: AdminProduct) => {
    const confirmedForm = toForm(confirmedProduct.draft ?? confirmedProduct);
    formRef.current = confirmedForm;
    setForm(confirmedForm);
    queryClient.setQueryData(getGetAdminProductQueryKey(confirmedProduct.id), confirmedProduct);
  };
  const setField = (key: string, value: any) => {
    if (key === "slug") {
      // Slugs are lowercase kebab-case only: no spaces, no capitals. A hand-edited
      // slug stops following the name; clearing it resumes auto-generation.
      const next = sanitizeSlugInput(String(value ?? ""));
      slugEdited.current = next.length > 0;
      updateForm((current: any) => ({ ...current, slug: next }));
      return;
    }
    if (key === "name" && isNew && !slugEdited.current) {
      updateForm((current: any) => ({ ...current, name: value, slug: slugify(String(value ?? "")) }));
      return;
    }
    updateForm((current: any) => ({ ...current, [key]: value }));
  };
  const setListingState = (listingState: ProductListingState) => {
    updateForm((current: any) => listingState === "Legacy"
      ? {
          ...current,
          listingState,
          availabilityOverride: null,
          status: "unavailable",
          saleLines: (current.saleLines ?? []).map((line: any) => ({ ...line, availability: "Unavailable" })),
        }
      : { ...current, listingState });
  };
  const insertTrademark = () => {
    const input = nameInputRef.current;
    const current = form.name ?? "";
    const start = input?.selectionStart ?? current.length;
    const end = input?.selectionEnd ?? current.length;
    const next = `${current.slice(0, start)}™${current.slice(end)}`;
    setField("name", next);
    requestAnimationFrame(() => {
      input?.focus();
      const cursor = start + 1;
      input?.setSelectionRange(cursor, cursor);
    });
  };
  const setDetail = (key: string, value: any) => updateForm((current: any) => ({ ...current, details: { ...current.details, [key]: value } }));
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
  const addSaleLine = () => setField("saleLines", [...form.saleLines, { stockCode: "", seedForm: "", seedGrade: "", packKg: null, packUnit: "kg", availability: getListingState(form) === "Legacy" ? "Unavailable" : "Good stock", priceDisplay: "Contact for pricing", isDefault: form.saleLines.length === 0, sortOrder: 0 }]);

  const updatePackSize = (index: number, patch: Partial<ProductPackSize>) => setDetail("packSizes", form.details.packSizes.map((item: any, itemIndex: number) => itemIndex === index ? { ...item, ...patch } : item));
  const updateSowingRate = (index: number, patch: Partial<ProductSowingRate>) => setDetail("sowingRates", form.details.sowingRates.map((item: any, itemIndex: number) => itemIndex === index ? { ...item, ...patch } : item));
  const toggleTolerance = (name: string) => {
    const existing = form.details.tolerance.find((item: any) => item.name === name);
    setDetail("tolerance", existing ? form.details.tolerance.filter((item: any) => item.name !== name) : [...form.details.tolerance, { name, mild: false }]);
  };
  const toggleMildTolerance = (name: string) => setDetail("tolerance", form.details.tolerance.map((item: any) => item.name === name ? { ...item, mild: !item.mild } : item));
  const updateComponent = (index: number, patch: Partial<ProductComponent>) => setDetail("components", form.details.components.map((item: any, itemIndex: number) => itemIndex === index ? { ...item, ...patch } : item));
  const removeComponent = (index: number) => setDetail("components", form.details.components.filter((_: any, itemIndex: number) => itemIndex !== index));
  const updateFaq = (index: number, patch: Partial<ProductFaq>) => updateForm((current: any) => ({
    ...current,
    details: {
      ...current.details,
      faqs: (current.details.faqs ?? []).map((item: ProductFaq, itemIndex: number) =>
        itemIndex === index ? { ...item, ...patch } : item
      ),
    },
  }));
  const removeFaq = (index: number) => updateForm((current: any) => ({
    ...current,
    details: {
      ...current.details,
      faqs: (current.details.faqs ?? []).filter((_: ProductFaq, itemIndex: number) => itemIndex !== index),
    },
  }));
  const addFaq = () => updateForm((current: any) => {
    const faqs = (current.details.faqs ?? []) as ProductFaq[];
    if (faqs.length >= PRODUCT_FAQ_LIMIT) return current;
    return {
      ...current,
      details: { ...current.details, faqs: [...faqs, { ...emptyProductFaq }] },
    };
  });
  const linkComponentProduct = (index: number, slug: string) => {
    const component = form.details.components[index];
    const linked = productsBySlug.get(slug);
    updateComponent(index, {
      productLink: slug,
      speciesName: component.speciesName.trim() ? component.speciesName : (linked?.name ?? ""),
    });
  };
  const updatePhoto = (index: number, patch: Partial<ProductPhoto>) => setDetail("photos", form.details.photos.map((item: any, itemIndex: number) => itemIndex === index ? { ...item, ...patch } : item));

  const detailsForSave = (editorForm: typeof form) => ({
    ...editorForm.details,
    treatment: editorForm.details.seedTreatment.join(" · "),
  });

  const latestDraftPayload = () => {
    const editorForm = formRef.current;
    const payload = {
      ...editorForm,
      details: detailsForSave(editorForm),
    };
    const { slug, publishStatus, ...draftPayload } = payload;
    return { payload, draftPayload };
  };

  const requestPublish = () => {
    setError("");
    setSuccess("");
    setPublishAttempted(true);
    const editorForm = formRef.current;
    const issues = getPublishIssues(editorForm);
    if (issues.length > 0) {
      setError(`Complete these fields before publishing: ${issues.map((issue) => issue.label).join(", ")}.`);
      setEditorMode("form");
      setActiveTab(issues[0].tab);
      return;
    }
    const missingDraftFields = [
      !editorForm.name.trim() && "Product name",
      !editorForm.slug.trim() && "Slug",
      !editorForm.category.trim() && "Category",
      !editorForm.details.recordType && "Record type",
    ].filter(Boolean) as string[];
    if (missingDraftFields.length > 0) {
      setError(`Complete these fields before publishing: ${missingDraftFields.join(", ")}.`);
      return;
    }
    setShowPublishPrompt(true);
  };

  const confirmPublish = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    let createdId: number | undefined;
    try {
      if (isNew) {
        const { payload, draftPayload } = latestDraftPayload();
        payload.publishStatus = "Draft";
        const newProd = await createMutation.mutateAsync({ data: payload });
        createdId = newProd.id;
        await persistLatestProductAndPublish({
          getLatestDraft: () => draftPayload,
          publish: (latestDraft) => publishMutation.mutateAsync({ id: newProd.id, data: latestDraft }),
          reconcile: reconcileForm,
        });
        await queryClient.invalidateQueries({ queryKey: getListAdminProductsQueryKey(), refetchType: "all" });
        await queryClient.invalidateQueries({ queryKey: getGetAdminSummaryQueryKey() });
        setShowPublishPrompt(false);
        setSuccess("Published successfully. Your latest changes are now live.");
        navigate(`/admin/products/${newProd.id}`);
      } else {
        const shouldSaveDraftFirst = product?.lifecycleStatus !== "Published" && product?.lifecycleStatus !== "Archived";
        await persistLatestProductAndPublish({
          getLatestDraft: () => latestDraftPayload().draftPayload,
          saveDraft: shouldSaveDraftFirst
            ? (latestDraft) => saveDraftMutation.mutateAsync({ id: productId!, data: latestDraft })
            : undefined,
          publish: (latestDraft) => publishMutation.mutateAsync({ id: productId!, data: latestDraft }),
          reconcile: reconcileForm,
        });
        setShowPublishPrompt(false);
        setSuccess("Published successfully. Your latest changes are now live.");
        await queryClient.invalidateQueries({ queryKey: getGetAdminProductQueryKey(productId!), refetchType: "all" });
        await queryClient.invalidateQueries({ queryKey: getListAdminProductsQueryKey(), refetchType: "all" });
        await queryClient.invalidateQueries({ queryKey: getGetAdminSummaryQueryKey() });
      }
    } catch (err) {
      setShowPublishPrompt(false);
      setError(err instanceof Error ? stripHttpErrorPrefix(err.message) : "Unable to publish product.");
      if (createdId) {
        await queryClient.invalidateQueries({ queryKey: getListAdminProductsQueryKey(), refetchType: "all" });
        navigate(`/admin/products/${createdId}`);
      } else if (productId) {
        await queryClient.invalidateQueries({ queryKey: getGetAdminProductQueryKey(productId), refetchType: "all" });
      }
    } finally {
      setSaving(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const action = submitter?.value; 
    const editorForm = formRef.current;

    if (action === "back" && (viewMode === "live" || isArchived)) {
      navigate(`/admin/products?view=${isArchived ? "Archived" : "Published"}`);
      return;
    }

    if (action === "publish") {
      setSaving(false);
      requestPublish();
      return;
    }

    const missingDraftFields = [
      !editorForm.name.trim() && "Product name",
      !editorForm.slug.trim() && "Slug",
      !editorForm.category.trim() && "Category",
      !editorForm.details.recordType && "Record type",
    ].filter(Boolean) as string[];
    if (missingDraftFields.length > 0) {
      setError(`Complete these fields before saving a draft: ${missingDraftFields.join(", ")}.`);
      setSaving(false);
      return;
    }

    const payload = {
      ...editorForm,
      details: detailsForSave(editorForm),
    };

    try {
      if (isNew) {
        payload.publishStatus = "Draft";
        const newProd = await createMutation.mutateAsync({ data: payload });
        await queryClient.invalidateQueries({ queryKey: getListAdminProductsQueryKey(), refetchType: "all" });
        await queryClient.invalidateQueries({ queryKey: getGetAdminSummaryQueryKey() });
        navigate(action === "save-and-back" ? "/admin/products?view=Draft" : `/admin/products/${newProd.id}`);
      } else {
        const { slug, publishStatus, ...draftPayload } = payload;
        if (product?.lifecycleStatus === "Published") {
          setError("Published products cannot be saved as drafts. Publish the changes instead.");
          setSaving(false);
          return;
        }
        const savedProduct = await saveDraftMutation.mutateAsync({ id: productId!, data: draftPayload });
        reconcileForm(savedProduct);
        setSuccess("Draft saved successfully.");
        await queryClient.invalidateQueries({ queryKey: getGetAdminProductQueryKey(productId!), refetchType: "all" });
        await queryClient.invalidateQueries({ queryKey: getListAdminProductsQueryKey(), refetchType: "all" });
        await queryClient.invalidateQueries({ queryKey: getGetAdminSummaryQueryKey() });
        if (action === "save-and-back") {
          navigate("/admin/products?view=Draft");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? stripHttpErrorPrefix(err.message) : "Unable to save product.");
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
    if (!product || !window.confirm(`Discard leftover unpublished changes for ${product.name}? The live public version will remain unchanged.`)) return;
    setSaving(true);
    setError("");
    try {
      await discardMutation.mutateAsync({ id: product.id });
      setViewMode("draft");
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
  const listingPath = `/admin/products?view=${isArchived ? "Archived" : isLive ? "Published" : "Draft"}`;
  const canSaveDraft = !isLive && !isArchived;
  const showPublish = !isArchived && (isNew || !isLive || Boolean(hasDraft) || isDirty);
  const showPublishRequired = !canSaveDraft || publishAttempted;
  const handleBack = () => {
    if (isDirty) {
      setShowUnsavedPrompt(true);
      return;
    }
    navigate(listingPath);
  };
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
  const isLegacyListing = getListingState(currentForm) === "Legacy";

  const completeness = getOverallCompleteness(currentForm);

  return (
    <>
      <header className="admin-page-header admin-editor-header">
        <button className="admin-back-link" type="button" onClick={handleBack} disabled={saving} title="Return to Products & mixes"><Icon name="arrow-left" size={16}/>Products &amp; mixes</button>
        <div className="admin-header-actions">
          {isLive && hasDraft && (
            <div className="admin-view-toggle">
              <button type="button" className={viewMode === "draft" ? "active" : ""} onClick={() => setViewMode("draft")}>Edit leftover</button>
              <button type="button" className={viewMode === "live" ? "active" : ""} onClick={() => setViewMode("live")}>View Live</button>
            </div>
          )}
          {!isNew && hasDraft && isLive && !isArchived && <button className="admin-button ghost" type="button" onClick={discardDraft} disabled={saving}>Discard leftover</button>}

          {isArchived ? (
            <button className="admin-button primary" type="button" onClick={restore} disabled={saving}>Restore to Draft</button>
          ) : viewMode === "draft" && (canSaveDraft || showPublish) ? (
            <>
              {canSaveDraft && <button className="admin-button outline" type="submit" form="admin-product-form" name="action" value="draft" disabled={saving}>Save draft</button>}
              {showPublish && <button className="admin-button primary" type="button" onClick={requestPublish} disabled={saving}>{saving ? "Publishing…" : isLive ? "Publish changes" : "Publish"}</button>}
            </>
          ) : null}
        </div>
      </header>
      {error && (
        <div ref={errorBannerRef} className="admin-notice admin-notice-error admin-editor-error" role="alert">
          <p>{error}</p>
        </div>
      )}
      <div className="admin-editor-title">
        <h1>{isNew ? "Add a product" : product?.name ?? "Product"}</h1>
        <div className="admin-editor-version" style={{display: 'flex', gap: 16, alignItems: 'center'}}>
          {isNew || !isLive ? "Draft changes — not public" : viewMode === "live" ? "Live on public site · read-only" : hasDraft ? "Leftover unpublished changes — not live until published" : "Editing live product — publish to update the public site"}
           <button
             type="button"
             className="admin-v2-completeness admin-v2-completeness-trigger"
             title={`${completeness}% complete — show section details`}
             aria-expanded={showSectionCompletion}
             aria-controls="admin-section-completion"
             onClick={() => setShowSectionCompletion((open) => !open)}
           >
            <div className="admin-v2-completeness-bar"><div className="admin-v2-completeness-fill" style={{width: `${completeness}%`}}></div></div>
            {completeness}%
             <span className={`admin-v2-completeness-chevron ${showSectionCompletion ? "open" : ""}`} aria-hidden="true" />
           </button>
        </div>
      </div>

      <div className={`admin-editor admin-claude-editor${editorMode === "page" ? " is-page-mode" : ""}`} style={{maxWidth: editorMode === "page" ? "none" : 1040, display: "block"}}>
         {category && showSectionCompletion && (
           <div id="admin-section-completion" className="admin-v2-section-summary" aria-label="Section completion">
             <span className="admin-v2-section-summary-title">Section completion</span>
             <div className="admin-v2-section-summary-items">
               <span className="admin-v2-section-summary-item">Basics <TabCompleteness form={currentForm} tab={1} /></span>
               <span className="admin-v2-section-summary-item">Agronomy &amp; fit <TabCompleteness form={currentForm} tab={2} /></span>
               <span className="admin-v2-section-summary-item">Category-specific <TabCompleteness form={currentForm} tab={3} /></span>
               <span className="admin-v2-section-summary-item">Selling <TabCompleteness form={currentForm} tab={4} /></span>
               <span className="admin-v2-section-summary-item">Content &amp; publishing <TabCompleteness form={currentForm} tab={5} /></span>
               <span className="admin-v2-section-summary-item">SEO <TabCompleteness form={currentForm} tab={6} /></span>
             </div>
           </div>
         )}
         <label className="admin-v2-mobile-mode-picker">
           <span>Editor view</span>
           <select value={editorMode} onChange={(event) => setEditorMode(event.target.value as "form" | "page")}>
             <option value="form">Form</option>
             <option value="page">Product page</option>
           </select>
         </label>
         {editorMode === "form" && (
         <label className="admin-v2-mobile-tab-picker">
           <span>Editing section</span>
           <select value={activeTab} onChange={(event) => setActiveTab(Number(event.target.value))}>
             <option value={1}>Basics</option>
             <option value={2} disabled={!category}>Agronomy &amp; fit</option>
             <option value={3} disabled={!category}>Category-specific</option>
             <option value={4} disabled={!category}>Selling</option>
             <option value={5} disabled={!category}>Content &amp; publishing</option>
             <option value={6} disabled={!category}>SEO</option>
           </select>
         </label>
         )}
          {publishIssues.length > 0 && (
            <div className="admin-v2-mobile-errors" role="status">
              <strong>Needs attention:</strong> {issueSectionNames.join(", ")}
            </div>
          )}
        <div className="admin-v2-tabs admin-v2-mode-tabs" role="tablist" aria-label="Editor view">
          <button type="button" role="tab" aria-selected={editorMode === "form"} className={`admin-v2-tab ${editorMode === "form" ? "active" : ""}`} onClick={() => setEditorMode("form")}>Form</button>
          <button type="button" role="tab" aria-selected={editorMode === "page"} className={`admin-v2-tab ${editorMode === "page" ? "active" : ""}`} onClick={() => setEditorMode("page")}>Product page</button>
        </div>
        {editorMode === "form" && (
        <div className="admin-v2-tabs">
            <button type="button" className={`admin-v2-tab ${activeTab === 1 ? 'active' : ''}`} onClick={() => setActiveTab(1)} aria-label={`Basics${tabsWithIssues.has(1) ? ", needs attention" : ""}`}>Basics{tabsWithIssues.has(1) && <span className="admin-tab-error-dot" aria-hidden="true" />}</button>
           <button type="button" disabled={!category} className={`admin-v2-tab ${activeTab === 2 ? 'active' : ''}`} onClick={() => setActiveTab(2)}>Agronomy &amp; fit</button>
           <button type="button" disabled={!category} className={`admin-v2-tab ${activeTab === 3 ? 'active' : ''}`} onClick={() => setActiveTab(3)}>Category-specific</button>
            <button type="button" disabled={!category} className={`admin-v2-tab ${activeTab === 4 ? 'active' : ''}`} onClick={() => setActiveTab(4)} aria-label={`Selling${tabsWithIssues.has(4) ? ", needs attention" : ""}`}>Selling{tabsWithIssues.has(4) && <span className="admin-tab-error-dot" aria-hidden="true" />}</button>
            <button type="button" disabled={!category} className={`admin-v2-tab ${activeTab === 5 ? 'active' : ''}`} onClick={() => setActiveTab(5)} aria-label={`Content and publishing${tabsWithIssues.has(5) ? ", needs attention" : ""}`}>Content &amp; publishing{tabsWithIssues.has(5) && <span className="admin-tab-error-dot" aria-hidden="true" />}</button>
            <button type="button" disabled={!category} className={`admin-v2-tab ${activeTab === 6 ? 'active' : ''}`} onClick={() => setActiveTab(6)} aria-label={`SEO${tabsWithIssues.has(6) ? ", needs attention" : ""}`}>SEO{tabsWithIssues.has(6) && <span className="admin-tab-error-dot" aria-hidden="true" />}</button>
        </div>
        )}

         <form id="admin-product-form" onSubmit={submit} noValidate>
          <datalist id="admin-product-slugs">{products.filter((item) => item.id !== product?.id).map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}</datalist>
          <fieldset className="admin-editor-main" disabled={(Boolean(hasDraft) && viewMode === "live") || isArchived}>
            {error && <div className="admin-notice admin-notice-error"><p>{error}</p></div>}
            {success && <div className="admin-notice"><p>{success}</p></div>}
            {isLive && hasDraft && viewMode === "draft" && (
              <div className="admin-notice">
                <p>This product has leftover unpublished changes. Publish them to replace the live page, or discard them to keep the current public version.</p>
              </div>
            )}
            {editorMode === "page" && (
              <ProductPageEditor
                form={currentForm}
                products={products}
                rootOptions={rootOptions}
                childOptions={childOptions}
                selectedRoot={selectedRoot}
                selectedTaxonomy={selectedTaxonomy}
                productOptions={productOptions}
                productsBySlug={productsBySlug}
                loadingTaxonomy={loadingTaxonomy}
                taxonomyError={taxonomyError}
                readOnly={(Boolean(hasDraft) && viewMode === "live") || isArchived}
                showPublishRequired={showPublishRequired}
                isNew={isNew}
                productId={productId}
                issueFor={(key) => issueFor(key as PublishIssueKey)}
                setField={setField}
                setDetail={setDetail}
                setNumberDetail={setNumberDetail}
                setListingState={setListingState}
                toggleList={toggleList}
                updateStringItem={updateStringItem}
                removeStringItem={removeStringItem}
                addStringItem={addStringItem}
                updateSowingRate={updateSowingRate}
                toggleTolerance={toggleTolerance}
                toggleMildTolerance={toggleMildTolerance}
                updateSaleLine={updateSaleLine}
                removeSaleLine={removeSaleLine}
                addSaleLine={addSaleLine}
                updateComponent={updateComponent}
                removeComponent={removeComponent}
                linkComponentProduct={linkComponentProduct}
                updateFaq={updateFaq}
                removeFaq={removeFaq}
                addFaq={addFaq}
                updatePhoto={updatePhoto}
                handleCategoryChange={handleCategoryChange}
                forSearchMetadata={forSearchMetadata}
                forSearchMetadataInput={forSearchMetadataInput}
                h1EditorValue={h1EditorValue}
                h1StoredValue={h1StoredValue}
              />
            )}
            
            {editorMode === "form" && activeTab === 1 && (
              <section className="admin-panel admin-form-card">
                <h2>Basics</h2>
                <div className="admin-form-grid">
                  <FillFromPdf
                    form={currentForm}
                    productId={productId}
                    readOnly={viewMode === "live" || isArchived}
                    seed={aiSeed}
                    onSeedConsumed={() => setAiSeed(null)}
                    onApply={applyAiForm}
                  />
                   <label className={`${issueFor("name") ? "admin-field-invalid" : ""}${aiClass("name")}`}>
                     <FieldLabel required>Product name</FieldLabel>
                     <span className="admin-name-input-row">
                       <input ref={nameInputRef} required aria-invalid={Boolean(issueFor("name"))} value={currentForm.name} onChange={(event) => setField("name", event.target.value)} placeholder="e.g. SouWest™ Pasture Mix"/>
                       {viewMode !== "live" && !isArchived && <button type="button" className="admin-tm-button" onClick={insertTrademark} title="Insert trademark symbol" aria-label="Insert trademark symbol">TM</button>}
                     </span>
                     <span className="admin-field-hint">Use ™ on the product name when the brand is trademarked. Do not put ™ or ® in SEO or social fields.</span>
                     {issueFor("name") && <span className="admin-inline-field-error">{issueFor("name")!.message}</span>}
                   </label>
                   <label className={issueFor("slug") ? "admin-field-invalid" : ""}><FieldLabel required hint={isNew ? "Created from the product name. Lowercase letters, numbers and hyphens only; permanent after create." : undefined}>Slug</FieldLabel><input required aria-invalid={Boolean(issueFor("slug"))} disabled={!isNew} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={currentForm.slug} onChange={(event) => setField("slug", event.target.value)} onBlur={(event) => setField("slug", slugify(event.target.value))} placeholder="souwest-pasture-mix"/>{issueFor("slug") && <span className="admin-inline-field-error">{issueFor("slug")!.message}</span>}</label>
                   <label className={issueFor("category") ? "admin-field-invalid" : ""}><FieldLabel required>Category</FieldLabel>
                    <select required aria-invalid={Boolean(issueFor("category"))} value={selectedRoot?.id ?? ""} disabled={loadingTaxonomy || Boolean(taxonomyError)} onChange={handleCategoryChange}>
                      <option value="">Select a category</option>
                       {rootOptions.map((category: any) => <option key={category.id} value={category.id}>{category.name}{!category.active ? " (Inactive)" : ""}</option>)}
                    </select>
                    {issueFor("category") && <span className="admin-inline-field-error">{issueFor("category")!.message}</span>}
                  </label>
                  <label><span className="admin-label-title">Subcategory</span>
                     <select value={selectedTaxonomy && selectedTaxonomy.parentId === selectedRoot?.id ? selectedTaxonomy.id : ""} onChange={(event) => setField("subcategoryId", event.target.value ? Number(event.target.value) : selectedRoot?.id ?? null)} disabled={!selectedRoot || loadingTaxonomy || Boolean(taxonomyError)}>
                      <option value="">None</option>
                       {childOptions.map((category: any) => <option key={category.id} value={category.id}>{category.name}{!category.active ? " (Inactive)" : ""}</option>)}
                    </select>
                  </label>
                  <div className={`admin-choice-field wide ${issueFor("details.recordType") ? "admin-field-invalid" : ""}`} role="group" aria-required="true" aria-invalid={Boolean(issueFor("details.recordType"))} aria-label="Record type"><FieldLabel required>Record type</FieldLabel><div>{(["Mix", "Variety", "Commodity / generic"] as RecordKind[]).map((kind) => <button key={kind} type="button" className={currentForm.details.recordType === kind ? "selected" : ""} onClick={() => setDetail("recordType", kind as any)}>{kind}</button>)}</div>{issueFor("details.recordType") && <span className="admin-inline-field-error">{issueFor("details.recordType")!.message}</span>}</div>
                  <div className="admin-choice-field wide" role="group" aria-label="Listing state">
                    <FieldLabel hint="Active and New products can appear on the current selling catalogue and may have availability. New shows a red NEW stamp on public cards and the product page. Legacy products stay published as catalogue history only and cannot have availability. This is different from Archiving, which removes a product from the public website entirely.">Listing state</FieldLabel>
                    <div>{(["Active", "New", "Legacy"] as ProductListingState[]).map((state) => <button key={state} type="button" className={getListingState(currentForm) === state ? "selected" : ""} onClick={() => setListingState(state)}>{state}</button>)}</div>
                  </div>
                  {!isMix && <label className={aiClass("details.botanicalName")}>Botanical name<input value={currentForm.details.botanicalName} onChange={(event) => setDetail("botanicalName", event.target.value)} placeholder="e.g. Lolium multiflorum"/></label>}
                </div>
              </section>
            )}

            {editorMode === "form" && activeTab === 2 && (
              <section className="admin-panel admin-form-card">
                <h2>Agronomy &amp; fit</h2>
                {isBio ? (
                  <PersistencyAndAustralianBredFields details={currentForm.details} setDetail={setDetail} />
                ) : (
                  <>
                    <div className={`admin-repeat-group${aiClass("details.sowingRates")}`}>
                      <div className="admin-section-heading"><div><h3>Sowing rates</h3></div>{viewMode !== "live" && !isArchived && <button className="admin-button outline small" type="button" onClick={() => setDetail("sowingRates", [...form.details.sowingRates, { context: "Pasture", min: null, max: null, unit: "kg/ha" }])}><Icon name="plus" size={16}/>Add rate</button>}</div>
                      {currentForm.details.sowingRates.map((rate: any, index: number) => <div className="admin-repeat-row admin-repeat-row-rate" key={index}><select value={rate.context} onChange={(event) => updateSowingRate(index, { context: event.target.value as any })}>{["Monoculture", "In a mix", "Dryland", "Irrigation", "Pasture", "Turf", "General", "Podded", "De-hulled", "Coated"].map((value) => <option key={value}>{value}</option>)}</select><input type="number" min="0" step="0.01" value={rate.min ?? ""} onChange={(event) => updateSowingRate(index, { min: event.target.value === "" ? null : Number(event.target.value) })} placeholder="Min"/><input type="number" min="0" step="0.01" value={rate.max ?? ""} onChange={(event) => updateSowingRate(index, { max: event.target.value === "" ? null : Number(event.target.value) })} placeholder="Max"/><input value={rate.unit} onChange={(event) => updateSowingRate(index, { unit: event.target.value })} placeholder="kg/ha"/>{viewMode !== "live" && !isArchived && <button type="button" onClick={() => setDetail("sowingRates", form.details.sowingRates.filter((_: any, itemIndex: number) => itemIndex !== index))} aria-label="Remove sowing rate">×</button>}</div>)}
                    </div>
                    <div className="admin-form-grid admin-form-grid-agronomy">
                      <label className={`admin-grid-half${aiClass("details.rainfallMinMm")}`}>Minimum rainfall (mm)<select value={currentForm.details.rainfallMinMm ?? ""} onChange={(event) => setNumberDetail("rainfallMinMm", event.target.value)}><option value="">Not set</option>{rainfallMinMmOptions(currentForm.details.rainfallMinMm).map((mm) => <option key={mm} value={mm}>{mm} mm</option>)}</select></label>
                      <label className={`admin-grid-quarter${aiClass("details.soilPhMin")}`}>Minimum soil pH<input type="number" min="0" step="0.1" value={currentForm.details.soilPhMin ?? ""} onChange={(event) => setNumberDetail("soilPhMin", event.target.value)} placeholder="5.5"/></label>
                      <label className={`admin-grid-quarter${aiClass("details.soilPhScale")}`}>Soil pH scale<select value={currentForm.details.soilPhScale} onChange={(event) => setDetail("soilPhScale", event.target.value as any)}><option>CaCl₂</option><option>water</option></select></label>
                      <label className={`admin-grid-half${aiClass("details.soilRangeLightest")}`}>Lightest soil<select value={currentForm.details.soilRangeLightest} onChange={(event) => setDetail("soilRangeLightest", event.target.value as any)}><option value="">Not set</option>{[{ code: "LS", label: "LS — light sand" }, { code: "S", label: "S — sand" }, { code: "L", label: "L — loam" }, { code: "H", label: "H — heavy" }].map((soil) => <option key={soil.code} value={soil.code}>{soil.label}</option>)}</select></label>
                      <label className={`admin-grid-half${aiClass("details.soilRangeHeaviest")}`}>Heaviest soil<select value={currentForm.details.soilRangeHeaviest} onChange={(event) => setDetail("soilRangeHeaviest", event.target.value as any)}><option value="">Not set</option>{[{ code: "LS", label: "LS — light sand" }, { code: "S", label: "S — sand" }, { code: "L", label: "L — loam" }, { code: "H", label: "H — heavy" }].map((soil) => <option key={soil.code} value={soil.code}>{soil.label}</option>)}</select></label>
                      <label className={`admin-grid-half${aiClass("details.sowingDepthMinCm")}`}>Minimum sowing depth (cm) <AdminOnlyMark /><input type="number" min="0" step="0.1" value={currentForm.details.sowingDepthMinCm ?? ""} onChange={(event) => setNumberDetail("sowingDepthMinCm", event.target.value)}/></label>
                      <label className={`admin-grid-half${aiClass("details.sowingDepthMaxCm")}`}>Maximum sowing depth (cm) <AdminOnlyMark /><input type="number" min="0" step="0.1" value={currentForm.details.sowingDepthMaxCm ?? ""} onChange={(event) => setNumberDetail("sowingDepthMaxCm", event.target.value)}/></label>
                    </div>
                    <div className={`admin-choice-field${aiClass("details.tolerance")}`}><span>Tolerance (Off / On / Mild)</span><div>{["Low pH", "Waterlogging", "Salinity", "Drought", "Frost"].map((name) => { const selected = currentForm.details.tolerance.find((item: any) => item.name === name); return <span className="admin-tolerance-choice" key={name}><button type="button" className={selected ? "selected" : ""} onClick={() => toggleTolerance(name)}>{name}</button>{selected && <label><input type="checkbox" checked={selected.mild} onChange={() => toggleMildTolerance(name)}/>Mild</label>}</span>; })}</div></div>
                    <div className={`admin-choice-field${aiClass("details.endUse")}`}><span>End use</span><div>{["Grazing", "Hay", "Silage", "Cover crop", "Green manure", "Grain", "Stockfeed", "Permanent pasture", "Erosion control / stabilisation", "Break crop", "Biofumigant", "Turf"].map((value) => <button key={value} type="button" className={currentForm.details.endUse.includes(value as any) ? "selected" : ""} onClick={() => toggleList("endUse", value)}>{value}</button>)}</div></div>
                    <div className={`admin-choice-field${aiClass("details.livestock")}`}><span>Livestock</span><div>{["Beef", "Dairy", "Sheep", "Equine", "Goat", "Chicken", "Alpaca", "Weaners", "Lamb finishing"].map((value) => <button key={value} type="button" className={currentForm.details.livestock.includes(value as any) ? "selected" : ""} onClick={() => toggleList("livestock", value)}>{value}</button>)}</div></div>
                    <PersistencyAndAustralianBredFields details={currentForm.details} setDetail={setDetail} />
                    <label className={aiClass("details.diseasePestResistance")}>Disease &amp; pest resistance<textarea value={currentForm.details.diseasePestResistance} onChange={(e) => setDetail("diseasePestResistance", e.target.value)} rows={3}/></label>
                    <label className={aiClass("details.standLifeNotes")}>Stand life notes<textarea value={currentForm.details.standLifeNotes} onChange={(e) => setDetail("standLifeNotes", e.target.value)} rows={3}/></label>
                    <label className={aiClass("details.grazingManagementNotes")}>Grazing management notes<textarea value={currentForm.details.grazingManagementNotes} onChange={(e) => setDetail("grazingManagementNotes", e.target.value)} rows={3}/></label>
                  </>
                )}
              </section>
            )}

            {editorMode === "form" && activeTab === 3 && (
              <section className="admin-panel admin-form-card">
                <h2>{category ? `${category} specifics` : "Category specifics"}</h2>
                {!category ? <p>Please select a category in the Basics tab first.</p> :
                 isHerb ? <p>No category-specific fields for herbs.</p> :
                 <div className="admin-form-grid">
                   {(isRyegrass || isFescue || isSubTropical || isMix) && (
                     <label className={aiClass("details.ploidy")}>Ploidy <select value={currentForm.details.ploidy} onChange={(e) => setDetail("ploidy", e.target.value)}>{OPTS.ploidy.map(o => <option key={o} value={o}>{o || "Not set"}</option>)}</select></label>
                   )}
                   {(isRyegrass || isFescue) && (
                     <>
                       <label className={aiClass("details.headingDate")}>Heading date <select value={currentForm.details.headingDate} onChange={(e) => setDetail("headingDate", e.target.value)}>{OPTS.headingDate.map(o => <option key={o} value={o}>{o || "Not set"}</option>)}</select></label>
                       <label className={aiClass("details.endophyte")}>Endophyte <select value={currentForm.details.endophyte} onChange={(e) => setDetail("endophyte", e.target.value)}>{OPTS.endophyte.map(o => <option key={o} value={o}>{o || "Not set"}</option>)}</select></label>
                     </>
                   )}
                   {isRyegrass && (
                     <>
                       <label className={aiClass("details.headingOffsetDays")}>Heading offset days <input type="number" value={currentForm.details.headingOffsetDays ?? ""} onChange={(e) => setNumberDetail("headingOffsetDays", e.target.value)} /></label>
                       <label className={`admin-check-row${aiClass("details.argtResistant")}`}><input type="checkbox" checked={currentForm.details.argtResistant} onChange={(e) => setDetail("argtResistant", e.target.checked)}/><span><strong>ARGT resistant</strong></span></label>
                     </>
                   )}
                   {(isClover || isSerradella) && (
                     <>
                       <label className={aiClass("details.maturityDays")}>Maturity days (Perth) <input type="number" value={currentForm.details.maturityDays ?? ""} onChange={(e) => setNumberDetail("maturityDays", e.target.value)} /></label>
                       <label className={aiClass("details.hardSeedLevel")}>Hard seed level <select value={currentForm.details.hardSeedLevel} onChange={(e) => setDetail("hardSeedLevel", e.target.value)}>{OPTS.hardSeedLevel.map(o => <option key={o} value={o}>{o || "Not set"}</option>)}</select></label>
                       <label className={aiClass("details.bloatRisk")}>Bloat risk <select value={currentForm.details.bloatRisk} onChange={(e) => setDetail("bloatRisk", e.target.value)}>{OPTS.bloatRisk.map(o => <option key={o} value={o}>{o || "Not set"}</option>)}</select></label>
                       <label className={aiClass("details.flowerColour")}>Flower colour <select value={currentForm.details.flowerColour} onChange={(e) => setDetail("flowerColour", e.target.value)}>{["", "Pink", "Yellow", "White", "Crimson", "Red", "Purple"].map(o => <option key={o} value={o}>{o || "Not set"}</option>)}</select></label>
                     </>
                   )}
                   {isClover && <label className={aiClass("details.oestrogenLevel")}>Oestrogen level <select value={currentForm.details.oestrogenLevel} onChange={(e) => setDetail("oestrogenLevel", e.target.value)}>{OPTS.oestrogenLevel.map(o => <option key={o} value={o}>{o || "Not set"}</option>)}</select></label>}
                   {isLucerne && <label className={aiClass("details.winterActivity")}>Winter activity (1–10) <input type="number" min="1" max="10" value={currentForm.details.winterActivity ?? ""} onChange={(e) => setNumberDetail("winterActivity", e.target.value)}/></label>}
                   {(isFescue || isSubTropical) && <label className={aiClass("details.growthSeason")}>Growth season <select value={currentForm.details.growthSeason} onChange={(e) => setDetail("growthSeason", e.target.value)}>{OPTS.growthSeason.map(o => <option key={o} value={o}>{o || "Not set"}</option>)}</select></label>}
                   {isForage && (
                     <>
                       <label className={aiClass("details.growingSeason")}>Growing season <select value={currentForm.details.growingSeason} onChange={(e) => setDetail("growingSeason", e.target.value)}>{OPTS.growingSeasonForage.map(o => <option key={o} value={o}>{o || "Not set"}</option>)}</select></label>
                       <label className={aiClass("details.weeksToFirstGrazing")}>Weeks to first grazing <input type="text" value={currentForm.details.weeksToFirstGrazing} onChange={(e) => setDetail("weeksToFirstGrazing", e.target.value)} placeholder="e.g. 6-8"/></label>
                       <label className={aiClass("details.prussicAcidRisk")}>Prussic acid risk <select value={currentForm.details.prussicAcidRisk} onChange={(e) => setDetail("prussicAcidRisk", e.target.value)}>{OPTS.prussicAcidRisk.map(o => <option key={o} value={o}>{o || "Not set"}</option>)}</select></label>
                       <label className={aiClass("details.regrowth")}>Regrowth <select value={currentForm.details.regrowth} onChange={(e) => setDetail("regrowth", e.target.value)}>{OPTS.regrowth.map(o => <option key={o} value={o}>{o || "Not set"}</option>)}</select></label>
                     </>
                   )}
                   {isMix && (
                     <>
                       <label className={aiClass("details.floweringWindow")}>Flowering window <input type="text" value={currentForm.details.floweringWindow} onChange={(e) => setDetail("floweringWindow", e.target.value)} placeholder="e.g. Aug-Nov"/></label>
                       <label className={aiClass("details.formulationYear")}>Formulation year <input type="text" value={currentForm.details.formulationYear} onChange={(e) => setDetail("formulationYear", e.target.value)}/></label>
                       <div className={`admin-repeat-group wide${aiClass("details.components")}`}>
                          <div className="admin-section-heading"><div><h3>Mix components</h3><p className="admin-field-hint">Each card is one ingredient on the public mix page. Link a catalogue product if customers should open that product. Leave the link empty for species you do not sell on their own.</p></div>{viewMode !== "live" && !isArchived && <button className="admin-button outline small" type="button" onClick={() => setDetail("components", [...form.details.components, { productLink: "", speciesName: "", inclusionRate: null, unit: "%", description: "", note: "" }])}><Icon name="plus" size={16}/>Add component</button>}</div>
                         <div className="admin-component-list">
                            {currentForm.details.components.map((component: ProductComponent, index: number) => {
                              const linkedProduct = component.productLink ? productsBySlug.get(component.productLink) : undefined;
                              const duplicateLink = Boolean(component.productLink && currentForm.details.components.some((other: ProductComponent, otherIndex: number) => otherIndex !== index && other.productLink === component.productLink));
                              const fieldIssues = mixComponentFieldIssues(component, {
                                ownSlug: currentForm.slug,
                                knownSlugs: new Set(products.map((candidate) => candidate.slug)),
                                duplicateLink,
                              });
                              const missingFromSelect = Boolean(component.productLink && !productOptions.some((option) => option.slug === component.productLink) && component.productLink !== currentForm.slug);
                              return (
                              <div className={`admin-component-block ${Object.keys(fieldIssues).length ? "is-invalid" : ""}`} key={index}>
                                <div className="admin-component-block-head">
                                  <h4>Component {index + 1}</h4>
                                  {viewMode !== "live" && !isArchived && <button type="button" className="admin-button ghost" onClick={() => removeComponent(index)}>Remove</button>}
                                </div>
                                <div className="admin-component-fields">
                                  <label className={fieldIssues.speciesName ? "admin-field-invalid" : ""}>Display name
                                    <input maxLength={120} value={component.speciesName} onChange={(event) => updateComponent(index, { speciesName: event.target.value })} placeholder="e.g. Abundant tetraploid ryegrass" aria-invalid={Boolean(fieldIssues.speciesName)} />
                                    {fieldIssues.speciesName && <span className="admin-inline-field-error">{fieldIssues.speciesName}</span>}
                                  </label>
                                  <label className={fieldIssues.productLink ? "admin-field-invalid" : ""}>Linked product
                                    <select value={component.productLink} onChange={(event) => linkComponentProduct(index, event.target.value)} aria-invalid={Boolean(fieldIssues.productLink)}>
                                      <option value="">Not linked — name only</option>
                                      {missingFromSelect && <option value={component.productLink}>{component.productLink} (not in catalogue)</option>}
                                      {productOptions.map((option) => <option key={option.id} value={option.slug}>{option.name}</option>)}
                                    </select>
                                    {fieldIssues.productLink ? <span className="admin-inline-field-error">{fieldIssues.productLink}</span> : linkedProduct ? <span className="admin-field-hint">Customers can open {linkedProduct.name} from this mix.</span> : <span className="admin-field-hint">Optional. Use this when the ingredient is also a catalogue product.</span>}
                                  </label>
                                  <label className={fieldIssues.inclusionRate ? "admin-field-invalid" : ""}>Inclusion rate
                                    <input type="number" min="0" max={!component.unit.trim() || component.unit.trim() === "%" ? 100 : undefined} step="0.01" value={component.inclusionRate ?? ""} onChange={(event) => updateComponent(index, { inclusionRate: event.target.value === "" ? null : Number(event.target.value) })} placeholder="e.g. 25" aria-invalid={Boolean(fieldIssues.inclusionRate)} />
                                    {fieldIssues.inclusionRate && <span className="admin-inline-field-error">{fieldIssues.inclusionRate}</span>}
                                  </label>
                                  <label className={fieldIssues.unit ? "admin-field-invalid" : ""}>Unit
                                    <input list="mix-component-units" maxLength={20} value={component.unit} onChange={(event) => updateComponent(index, { unit: event.target.value })} placeholder="%" aria-invalid={Boolean(fieldIssues.unit)} />
                                    {fieldIssues.unit && <span className="admin-inline-field-error">{fieldIssues.unit}</span>}
                                  </label>
                                  <label className={`admin-component-description ${fieldIssues.description ? "admin-field-invalid" : ""}`}>Public description
                                    <span className="admin-field-hint">Shown under this component on the mix page.</span>
                                    <textarea rows={5} maxLength={10000} value={component.description ?? ""} onChange={(event) => updateComponent(index, { description: event.target.value })} placeholder="What this ingredient contributes to the mix" aria-invalid={Boolean(fieldIssues.description)} />
                                    {fieldIssues.description && <span className="admin-inline-field-error">{fieldIssues.description}</span>}
                                    <span className="admin-character-count">{(component.description ?? "").length}/10000</span>
                                  </label>
                                </div>
                              </div>
                              );
                            })}
                            {currentForm.details.components.length === 0 && <p className="admin-empty-inline">No mix components yet.</p>}
                            <datalist id="mix-component-units">{MIX_COMPONENT_UNITS.map((unit) => <option key={unit} value={unit} />)}</datalist>
                         </div>
                       </div>
                     </>
                   )}
                   {isBio && (
                     <>
                        <label className={aiClass("details.productForm")}>Product form <input value={currentForm.details.productForm} onChange={(e) => setDetail("productForm", e.target.value)} placeholder="e.g. Powder|Liquid|Peat"/></label>
                       <label className={aiClass("details.applicationRate")}>Application rate <input type="text" value={currentForm.details.applicationRate} onChange={(e) => setDetail("applicationRate", e.target.value)}/></label>
                     </>
                   )}
                 </div>
                }
              </section>
            )}

            {editorMode === "form" && activeTab === 4 && (
              <section className="admin-panel admin-form-card">
                <h2>Selling</h2>
                <div className={`admin-repeat-group wide ${issueFor("saleLines.default") || issueFor("saleLines.stockCodes") ? "admin-field-invalid admin-group-invalid" : ""}`}>
                  <div className="admin-section-heading"><div><h3>Sale lines</h3><p>{isLegacyListing ? "Legacy products cannot have availability. Change listing state on Basics first." : "One card per warehouse stock code."}</p></div>{viewMode !== "live" && !isArchived && <button className="admin-button outline small" type="button" onClick={addSaleLine}><Icon name="plus" size={16}/>Add line</button>}</div>
                  <div className="admin-sale-line-list">
                  {currentForm.saleLines?.map((line: any, i: number) => (
                    <div className="admin-sale-line-card" key={i}>
                      <div className="admin-sale-line-card-head">
                        <h4>{line.stockCode?.trim() || `Sale line ${i + 1}`}</h4>
                        <div className="admin-sale-line-card-actions">
                          <label className={`admin-sale-line-default ${line.isDefault ? "is-selected" : ""}`}>
                            <input type="radio" name="saleLineDefault" checked={line.isDefault} onChange={() => {
                              const newLines = currentForm.saleLines.map((l: any, idx: number) => ({...l, isDefault: idx === i}));
                              setField("saleLines", newLines);
                            }} />
                            Default
                          </label>
                          {viewMode !== "live" && !isArchived && <button type="button" className="admin-button ghost" onClick={() => removeSaleLine(i)}>Remove</button>}
                        </div>
                      </div>
                      <div className="admin-sale-line-fields">
                        <label>Stock code
                          <input value={line.stockCode} onChange={(e) => updateSaleLine(i, { stockCode: e.target.value })} placeholder="e.g. BIONPKS" />
                        </label>
                        <label>Seed form
                          <select value={line.seedForm} onChange={(e) => updateSaleLine(i, { seedForm: e.target.value })}>{OPTS.seedForm.map(o => <option key={o} value={o}>{o || "Not set"}</option>)}</select>
                        </label>
                        <div className="admin-sale-line-pack">
                          <span>Pack</span>
                          <div className="admin-sale-line-pack-inputs">
                            <input aria-label="Pack weight" type="number" min="0" step="0.01" value={line.packKg ?? ""} onChange={(e) => updateSaleLine(i, { packKg: e.target.value === "" ? null : Number(e.target.value) })} placeholder="25" />
                            <input aria-label="Pack unit" value={line.packUnit} onChange={(e) => updateSaleLine(i, { packUnit: e.target.value })} placeholder="kg" />
                          </div>
                        </div>
                        <label>Availability
                          <select disabled={isLegacyListing} value={isLegacyListing ? "Unavailable" : (line.availability ?? "")} onChange={(e) => updateSaleLine(i, { availability: (e.target.value || null) as SaleLine["availability"] })}><option value="">TBA</option>{OPTS.availability.map(o => <option key={o} value={o}>{o}</option>)}</select>
                        </label>
                        <label>Price display
                          <input value={line.priceDisplay} onChange={(e) => updateSaleLine(i, { priceDisplay: e.target.value })} placeholder="Contact for pricing" />
                        </label>
                      </div>
                    </div>
                  ))}
                  </div>
                  {currentForm.saleLines?.length === 0 && <p className="admin-empty-inline">No sale lines added.</p>}
                  {issueFor("saleLines.default") && <span className="admin-inline-field-error">{issueFor("saleLines.default")!.message}</span>}
                  {issueFor("saleLines.stockCodes") && <span className="admin-inline-field-error">{issueFor("saleLines.stockCodes")!.message}</span>}
                </div>
                
                <div className="admin-form-grid">
                   <div style={{gridColumn: "1/-1"}}>
                     <label style={{flex: 1}}>Availability override
                       <select disabled={isLegacyListing} value={isLegacyListing ? "" : (currentForm.availabilityOverride ?? "")} onChange={(e) => setField("availabilityOverride", e.target.value || null)}>
                          {OPTS.availabilityOverride.map(o => <option key={o} value={o}>{o || "Use derived"}</option>)}
                       </select>
                       <span className="admin-derived-info">Currently evaluates to: <strong>{getDerivedAvailability(currentForm)}</strong></span>
                     </label>
                   </div>
                   
                   <label className={`admin-check-row wide${aiClass("details.pbrProtected")}`}><input type="checkbox" checked={currentForm.details.pbrProtected} onChange={(event) => setDetail("pbrProtected", event.target.checked)}/><span><strong>PBR protected</strong></span></label>
                   <label className={aiClass("details.pbrDetails")}>PBR details <input value={currentForm.details.pbrDetails} onChange={(e) => setDetail("pbrDetails", e.target.value)} /></label>
                   
                   <div className={`admin-choice-field wide${aiClass("details.certification")}`}><span>Certification</span><div>{["ASF Code of Practice", "Certified Quality Assured Seed", "Certified seed", "Licensed production"].map((value) => <button key={value} type="button" className={currentForm.details.certification.includes(value as any) ? "selected" : ""} onClick={() => toggleList("certification", value)}>{value}</button>)}</div></div>
                </div>
              </section>
            )}

            {editorMode === "form" && activeTab === 5 && (
              <section className="admin-panel admin-form-card">
                <h2>Content &amp; publishing</h2>
                <div className="admin-form-grid">
                  <label className={`wide ${issueFor("details.tagline") ? "admin-field-invalid" : ""}${aiClass("details.tagline")}`}>
                    <FieldLabel required={showPublishRequired} hint="Short product promise shown on product cards and below the product name (60 characters max).">Tagline</FieldLabel>
                    <input aria-invalid={Boolean(issueFor("details.tagline"))} maxLength={60} value={currentForm.details.tagline} onChange={(e) => setDetail("tagline", e.target.value)} />
                    {issueFor("details.tagline") && <span className="admin-inline-field-error">{issueFor("details.tagline")!.message}</span>}
                    <span className="admin-character-count">{currentForm.details.tagline.length}/60</span>
                  </label>
                  <label className={`wide ${issueFor("details.blurb") ? "admin-field-invalid" : ""}${aiClass("details.blurb")}`}>
                    <FieldLabel required={showPublishRequired} hint="A concise introduction shown at the top of the product page.">Blurb</FieldLabel>
                    <textarea aria-invalid={Boolean(issueFor("details.blurb"))} value={currentForm.details.blurb} onChange={(e) => setDetail("blurb", e.target.value)} rows={3}/>
                    {issueFor("details.blurb") && <span className="admin-inline-field-error">{issueFor("details.blurb")!.message}</span>}
                  </label>
                  <div className={`admin-repeat-group wide ${issueFor("details.keyAttributes") ? "admin-field-invalid admin-group-invalid" : ""}`}>
                    <div className="admin-section-heading"><div><h3>Key attributes{showPublishRequired ? <RequiredStar /> : null}</h3><p>Add the concise product strengths displayed as bullets on the public page.</p></div>{viewMode !== "live" && !isArchived && <button className="admin-button outline small" type="button" onClick={() => addStringItem("keyAttributes")}><Icon name="plus" size={16}/>Add attribute</button>}</div>
                    {currentForm.details.keyAttributes.map((attribute: string, index: number) => <div className="admin-repeat-row" key={index}><input value={attribute} onChange={(event) => updateStringItem("keyAttributes", index, event.target.value)} placeholder="e.g. Strong winter growth"/>{viewMode !== "live" && !isArchived && <button type="button" onClick={() => removeStringItem("keyAttributes", index)} aria-label="Remove key attribute">×</button>}</div>)}
                    {currentForm.details.keyAttributes.length === 0 && <p className="admin-empty-inline">No key attributes added yet.</p>}
                    {issueFor("details.keyAttributes") && <span className="admin-inline-field-error">{issueFor("details.keyAttributes")!.message}</span>}
                  </div>
                  <label className={`wide ${issueFor("details.description") ? "admin-field-invalid" : ""}${aiClass("details.description")}`}>
                    <FieldLabel required={showPublishRequired}>Description</FieldLabel>
                    <textarea aria-invalid={Boolean(issueFor("details.description"))} value={currentForm.details.description} onChange={(e) => setDetail("description", e.target.value)} rows={6}/>
                    {issueFor("details.description") && <span className="admin-inline-field-error">{issueFor("details.description")!.message}</span>}
                  </label>
                  <label className={`wide${aiClass("details.distributionNote")}`}>Distribution note <span className="admin-field-hint">Optional highlighted information about availability or distribution.</span><textarea value={currentForm.details.distributionNote} onChange={(e) => setDetail("distributionNote", e.target.value)} rows={2}/></label>
                  <label>Legacy website URL <AdminOnlyMark /><input value={currentForm.websiteUrlLegacy} onChange={(e) => setField("websiteUrlLegacy", e.target.value)} /></label>
                  
                  <div className="admin-repeat-group wide">
                    <div className="admin-section-heading"><div><h3>Photos</h3><p>Uploads go to the Images library as WebP. You can still paste an external URL.</p></div></div>
                    <div className="admin-photo-list">
                      {currentForm.details.photos.map((photo: any, index: number) => (
                        <div className="admin-photo-row" key={photo.slot || index}>
                          <div className="admin-photo-thumb">{photoDisplaySrc(photo) ? <img src={photoDisplaySrc(photo)} alt={photo.alt || photo.file}/> : <Icon name="image" size={24}/>}</div>
                          <span>
                            <small>{photo.slot}</small>
                            <strong>{photo.file || "No file selected"}</strong>
                            <input
                              className="admin-photo-alt"
                              value={photo.alt || ""}
                              placeholder="Alt text"
                              aria-label={`${photo.slot || "Photo"} alt text`}
                              onChange={(event) => updatePhoto(index, { alt: event.target.value })}
                              disabled={viewMode === "live" || isArchived}
                            />
                          </span>
                          {viewMode !== "live" && !isArchived && (
                            <div className="admin-photo-actions">
                              <ProductPhotoOrderButtons
                                photos={currentForm.details.photos}
                                index={index}
                                onChange={(photos) => setDetail("photos", photos)}
                              />
                              <label className="admin-text-button">
                                Upload
                                <input
                                  type="file"
                                  accept="image/jpeg,image/png,image/webp"
                                  hidden
                                  onChange={async (event) => {
                                    const file = event.target.files?.[0];
                                    event.target.value = "";
                                    if (!file) return;
                                    try {
                                      updatePhoto(index, {
                                        ...await uploadMediaAsset(file, {
                                          ownerName: form.name,
                                          role: index === 0 ? "hero" : photo.role,
                                        }),
                                        role: index === 0 ? "hero" : photo.role,
                                      });
                                    } catch (caught) {
                                      setError(caught instanceof Error ? caught.message : "Upload failed.");
                                    }
                                  }}
                                />
                              </label>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <label className={`wide${aiClass("techSheet")}`}>Tech sheet URL<input value={currentForm.techSheet} onChange={(e) => setField("techSheet", e.target.value)} /></label>

                  <div className="admin-repeat-group wide">
                    <div className="admin-section-heading">
                      <div>
                        <h3>FAQs</h3>
                        <p className="admin-field-hint">Optional questions shown above Also popular on the product page. Add up to {PRODUCT_FAQ_LIMIT}. Incomplete cards are hidden from customers.</p>
                      </div>
                      {viewMode !== "live" && !isArchived && (
                        <button
                          className="admin-button outline small"
                          type="button"
                          disabled={(currentForm.details.faqs ?? []).length >= PRODUCT_FAQ_LIMIT}
                          onClick={addFaq}
                        >
                          <Icon name="plus" size={16}/>Add FAQ
                        </button>
                      )}
                    </div>
                    <div className="admin-component-list">
                      {(currentForm.details.faqs ?? []).map((faq: ProductFaq, index: number) => {
                        const fieldIssues = faqFieldIssues(faq);
                        return (
                          <div className={`admin-component-block ${Object.keys(fieldIssues).length ? "is-invalid" : ""}`} key={index}>
                            <div className="admin-component-block-head">
                              <h4>FAQ {index + 1}</h4>
                              {viewMode !== "live" && !isArchived && <button type="button" className="admin-button ghost" onClick={() => removeFaq(index)}>Remove</button>}
                            </div>
                            <div className="admin-component-fields">
                              <label className={`admin-component-description ${fieldIssues.question ? "admin-field-invalid" : ""}`}>Question
                                <input
                                  maxLength={PRODUCT_FAQ_QUESTION_MAX}
                                  value={faq.question}
                                  onChange={(event) => updateFaq(index, { question: event.target.value })}
                                  placeholder="e.g. When should I sow this?"
                                  aria-invalid={Boolean(fieldIssues.question)}
                                />
                                {fieldIssues.question && <span className="admin-inline-field-error">{fieldIssues.question}</span>}
                                <span className="admin-character-count">{faq.question.length}/{PRODUCT_FAQ_QUESTION_MAX}</span>
                              </label>
                              <label className={`admin-component-description ${fieldIssues.answer ? "admin-field-invalid" : ""}`}>Answer
                                <span className="admin-field-hint">Shown when a customer opens this question.</span>
                                <textarea
                                  rows={4}
                                  maxLength={PRODUCT_FAQ_ANSWER_MAX}
                                  value={faq.answer}
                                  onChange={(event) => updateFaq(index, { answer: event.target.value })}
                                  placeholder="Give a clear, practical answer"
                                  aria-invalid={Boolean(fieldIssues.answer)}
                                />
                                {fieldIssues.answer && <span className="admin-inline-field-error">{fieldIssues.answer}</span>}
                                <span className="admin-character-count">{faq.answer.length}/{PRODUCT_FAQ_ANSWER_MAX}</span>
                              </label>
                            </div>
                          </div>
                        );
                      })}
                      {(currentForm.details.faqs ?? []).length === 0 && <p className="admin-empty-inline">No FAQs yet.</p>}
                    </div>
                  </div>
                  
                  <AlsoPopularPicker
                    selectedSlugs={currentForm.details.relatedProducts}
                    options={productOptions}
                    productsBySlug={productsBySlug}
                    readOnly={viewMode === "live" || isArchived}
                    onChange={(slugs) => setDetail("relatedProducts", slugs)}
                  />
                  
                  <div className="admin-section-heading wide" style={{marginTop: 16}}><h3>Display</h3></div>
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

            {editorMode === "form" && activeTab === 6 && (
              <section className="admin-panel admin-form-card">
                <h2>SEO</h2>
                <div className="admin-form-grid">
                  <label className="wide">
                    <FieldLabel hint="Copies the product name unless you overwrite it. Trademark symbols stay visible on the page H1.">H1</FieldLabel>
                    <input
                      maxLength={160}
                      value={h1EditorValue(currentForm.name, currentForm.details.h1)}
                      onChange={(e) => setDetail("h1", h1StoredValue(currentForm.name, e.target.value))}
                    />
                  </label>
                  <label className={`wide ${issueFor("details.seoTitle") ? "admin-field-invalid" : ""}${aiClass("details.seoTitle")}`}>
                    <FieldLabel required={showPublishRequired} hint="Required before publishing. Shown in search results and browser tabs. Do not use ™ or ® — those belong on the product name.">SEO title</FieldLabel>
                    <input aria-invalid={Boolean(issueFor("details.seoTitle"))} value={currentForm.details.seoTitle} onChange={(e) => setDetail("seoTitle", forSearchMetadataInput(e.target.value))} onBlur={(e) => setDetail("seoTitle", forSearchMetadata(e.target.value))} />
                    {issueFor("details.seoTitle") && <span className="admin-inline-field-error">{issueFor("details.seoTitle")!.message}</span>}
                  </label>
                  <label className={`wide ${issueFor("details.seoDescription") ? "admin-field-invalid" : ""}${aiClass("details.seoDescription")}`}>
                    <FieldLabel required={showPublishRequired} hint="Required before publishing. A concise summary that may appear beneath the page title in search results. Plain text only — no ™ or ®.">SEO description</FieldLabel>
                    <textarea aria-invalid={Boolean(issueFor("details.seoDescription"))} value={currentForm.details.seoDescription} onChange={(e) => setDetail("seoDescription", forSearchMetadataInput(e.target.value))} onBlur={(e) => setDetail("seoDescription", forSearchMetadata(e.target.value))} rows={4} />
                    {issueFor("details.seoDescription") && <span className="admin-inline-field-error">{issueFor("details.seoDescription")!.message}</span>}
                  </label>
                  <label className="wide"><FieldLabel hint="Optional. Uses the SEO title when left blank. Do not use ™ or ®.">Social sharing title</FieldLabel><input value={currentForm.details.socialTitle} onChange={(e) => setDetail("socialTitle", forSearchMetadataInput(e.target.value))} onBlur={(e) => setDetail("socialTitle", forSearchMetadata(e.target.value))} /></label>
                  <label className="wide"><FieldLabel hint="Optional. Uses the SEO description when left blank. Do not use ™ or ®.">Social sharing description</FieldLabel><textarea value={currentForm.details.socialDescription} onChange={(e) => setDetail("socialDescription", forSearchMetadataInput(e.target.value))} onBlur={(e) => setDetail("socialDescription", forSearchMetadata(e.target.value))} rows={4} /></label>
                  <label className="wide"><FieldLabel hint="Choose a product photo or enter another image URL below.">Social sharing image</FieldLabel>
                    <select value={currentForm.details.photos.some((photo: any) => photo.src && photo.src === currentForm.details.socialImage) ? currentForm.details.socialImage : ""} onChange={(e) => setDetail("socialImage", e.target.value)}>
                      <option value="">Use the product hero image</option>
                      {currentForm.details.photos.filter((photo: any) => photo.src).map((photo: any, index: number) => <option key={`${photo.slot}-${index}`} value={photo.src}>{photo.slot || `Photo ${index + 1}`}</option>)}
                    </select>
                    <input type="url" value={currentForm.details.socialImage} onChange={(e) => setDetail("socialImage", e.target.value)} placeholder="https://example.com/social-image.jpg" />
                  </label>
                  <label className="wide"><FieldLabel hint="Optional. Leave blank to use the product's normal published URL.">Canonical URL override</FieldLabel><input type="url" value={currentForm.details.canonicalUrl} onChange={(e) => setDetail("canonicalUrl", e.target.value)} placeholder="https://example.com/product/canonical-slug" /></label>
                  <label className="admin-check-row wide"><input type="checkbox" checked={currentForm.details.robotsIndex} onChange={(e) => setDetail("robotsIndex", e.target.checked)}/><span><strong>Allow search engines to index this product</strong><small>Turn this off to publish the page with a noindex directive.</small></span></label>
                </div>
              </section>
            )}

          </fieldset>
        </form>
      </div>
      {showPublishPrompt && (
        <ConfirmDialog
          title="Are you sure?"
          body={product?.lifecycleStatus === "Published"
            ? "This will publish your latest changes and replace what visitors currently see on the public site."
            : "This will save your latest changes and publish this product. It will become visible on the public site."}
          confirmLabel={product?.lifecycleStatus === "Published" ? "Publish changes" : "Save and publish"}
          busyLabel="Publishing…"
          busy={saving}
          onCancel={() => !saving && setShowPublishPrompt(false)}
          onConfirm={() => void confirmPublish()}
        />
      )}
      {showUnsavedPrompt && (
        <div className="admin-dialog-backdrop" role="presentation" onMouseDown={() => setShowUnsavedPrompt(false)}>
          <section
            className="admin-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="unsaved-product-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h2 id="unsaved-product-title">Unsaved changes</h2>
            <p>{isLive && hasDraft
              ? "This product has leftover unpublished changes. Publish or discard them, or leave and come back later."
              : isLive
                ? "You have unpublished edits. Leaving now will lose them unless you publish first."
                : "You have changed this product. Save a draft before returning to the product listing?"}</p>
            <div className="admin-dialog-actions">
              {canSaveDraft && (
                <button
                  className="admin-button primary"
                  type="submit"
                  form="admin-product-form"
                  name="action"
                  value="save-and-back"
                  onClick={() => setShowUnsavedPrompt(false)}
                  disabled={saving}
                >
                  Save draft &amp; leave
                </button>
              )}
              <button className="admin-button outline admin-button-danger" type="button" onClick={() => navigate(listingPath)} disabled={saving}>
                Leave without saving
              </button>
              <button className="admin-button ghost" type="button" onClick={() => setShowUnsavedPrompt(false)} disabled={saving}>
                Keep editing
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

export default function Admin({ role, accountName, onSignOut }: AdminAccountProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [location] = useLocation();
  const route = location.split("?")[0];
  const isProducts = route === "/admin/products";
  const isCategories = route === "/admin/products/categories";
  const isTechSheets = route === "/admin/tech-sheets";
  const isBlog = route === "/admin/blog" || route.startsWith("/admin/blog/");
  const isResellers = route === "/admin/resellers" || route.startsWith("/admin/resellers/");
  const isImages = route === "/admin/images" || route.startsWith("/admin/images/");
  const isAdministrators = route === "/admin/administrators";
  const isSiteSettingsHub = route === "/admin/site-settings";
  const isSiteHome = route === "/admin/site-settings/home";
  const isSiteAbout = route === "/admin/site-settings/about";
  const isSiteGuide = route === "/admin/site-settings/seed-guide";
  const isSiteCompany = route === "/admin/site-settings/company";
  const isSiteCategories = route === "/admin/site-settings/categories" || route.startsWith("/admin/site-settings/categories/");
  const isEditor = route.startsWith("/admin/products/") && route !== "/admin/products/categories";

  useEffect(() => {
    if (isAdministrators && role !== "superadmin") navigate("/admin", { replace: true });
  }, [isAdministrators, role]);

  return (
    <AdminLayout mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} role={role} accountName={accountName} onSignOut={onSignOut}>
      {route === "/admin" && <Dashboard />}
      {isProducts && <ProductTable />}
      {isCategories && <AdminCategories />}
      {isAdministrators && role === "superadmin" && <AdminAdministrators />}
      {isImages && <AdminImages />}
      {isTechSheets && <AdminTechSheets />}
      {isBlog && <AdminBlog />}
      {isResellers && <AdminResellers />}
      {isSiteSettingsHub && <AdminSiteSettings />}
      {isSiteHome && <AdminHomePage />}
      {isSiteAbout && <AdminAbout />}
      {isSiteCategories && <AdminRootCategories />}
      {isSiteGuide && <AdminSeedGuide />}
      {isSiteCompany && <AdminCompany />}
      {isEditor && (
        <ProductEditor
          isNew={route === "/admin/products/new"}
          productId={route !== "/admin/products/new" ? parseInt(route.split("/").pop() || "0", 10) : undefined}
        />
      )}
    </AdminLayout>
  );
}
