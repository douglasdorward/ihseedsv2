import { TechSheetPages } from "./TechSheetPages";
import type { CatalogueProduct } from "../../lib/catalogue";
import { productPageHeading, saleLinePackLabels } from "../../lib/catalogue";
import { getProductQuickFacts } from "../../lib/product-quick-facts";

function productPhotoSrc(product: CatalogueProduct) {
  return product.details.photos?.find((photo) => photo.src?.trim())?.src?.trim() || "";
}

const SAMPLE_LINKS = [
  { href: "/internal/pdf/tech-sheet/amass-tetraploid-italian-ryegrass", label: "Amass (variety)" },
  { href: "/internal/pdf/tech-sheet/safeguard-annual-ryegrass", label: "Safeguard (variety)" },
  { href: "/internal/pdf/tech-sheet/maximix", label: "Maximix (mix)" },
  { href: "/internal/pdf/tech-sheet/amass-tetraploid-italian-ryegrass?facts=max", label: "Max facts" },
];

/** Densest ryegrass Quick facts set the product page can emit (12 rows). Preview-only. */
export function withMaxQuickFacts(product: CatalogueProduct): CatalogueProduct {
  return {
    ...product,
    category: "Ryegrasses",
    details: {
      ...product.details,
      persistencyType: "Short-term (1–2 years)",
      rainfallMinMm: 600,
      soilRangeLightest: "LS",
      soilRangeHeaviest: "H",
      soilPhMin: 5,
      soilPhScale: "CaCl₂",
      sowingRates: [
        { min: 25, max: 35, unit: "kg/ha", context: "Irrigation" },
        { min: 8, max: 25, unit: "kg/ha", context: "Dryland" },
      ],
      tolerance: [
        { name: "Waterlogging" },
        { name: "Drought" },
        { name: "Low pH", mild: true },
        { name: "Salinity", mild: true },
        { name: "Frost", mild: true },
      ],
      endUse: ["Grazing", "Hay", "Silage", "Cover crop", "Permanent pasture"],
      livestock: ["Beef", "Dairy", "Sheep", "Equine", "Goat"],
      ploidy: "Tetraploid",
      headingDate: "Mid-late",
      endophyte: "Novel endophyte",
      headingOffsetDays: 21,
      argtResistant: true,
    },
  };
}

function paragraphs(value: string | undefined) {
  return (value ?? "")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

export function TechSheetDocument({
  product,
  productUrl,
  year,
  maxFacts = false,
  downloadHref,
}: {
  product: CatalogueProduct;
  productUrl: string;
  year: number;
  maxFacts?: boolean;
  downloadHref?: string;
}) {
  const details = product.details;
  const packLabels = saleLinePackLabels(product);
  const currentHref = maxFacts
    ? `/internal/pdf/tech-sheet/${product.slug}?facts=max`
    : `/internal/pdf/tech-sheet/${product.slug}`;

  return (
    <div className="pdf-preview-root">
      <nav className="pdf-toolbar" aria-label={downloadHref ? "Technical sheet" : "PDF preview samples"}>
        {downloadHref ? (
          <>
            <strong>Technical sheet</strong>
            <a className="pdf-toolbar-download" href={downloadHref} download>Download PDF</a>
          </>
        ) : (
          <>
            <strong>Tech sheet preview</strong>
            <span>Not indexed. Screen layout at A4 size.</span>
            {SAMPLE_LINKS.map((sample) => (
              <a
                key={sample.href}
                href={sample.href}
                aria-current={sample.href === currentHref ? "page" : undefined}
              >
                {sample.label}
              </a>
            ))}
          </>
        )}
      </nav>
      <div className="pdf-desk">
        <TechSheetPages
          view={{
            heading: productPageHeading(product),
            category: product.category,
            year,
            productUrl,
            tagline: details.tagline?.trim() || "",
            botanicalName: details.botanicalName?.trim() || "",
            blurb: details.blurb?.trim() || "",
            about: paragraphs(details.description),
            photoSrc: productPhotoSrc(product),
            quickFacts: getProductQuickFacts(product),
            keyAttributes: (details.keyAttributes ?? []).map((item) => item.trim()).filter(Boolean),
            formulationYear: details.formulationYear?.trim() || "",
            components: details.recordType === "Mix" ? details.components ?? [] : [],
            hasComponentRates: (details.components ?? []).some((component) => component.inclusionRate != null),
            notes: [
              details.grazingManagementNotes && { title: "Planting & grazing notes", body: details.grazingManagementNotes },
              details.diseasePestResistance && { title: "Disease & pest resistance", body: details.diseasePestResistance },
              details.standLifeNotes && { title: "Stand life", body: details.standLifeNotes },
            ].filter((item): item is { title: string; body: string } => Boolean(item && item.body.trim())),
            saleLines: product.saleLines ?? [],
            packSize: packLabels[0] || product.packSize || "",
            certification: (details.certification ?? []).filter(Boolean),
            pbrProtected: Boolean(details.pbrProtected),
            pbrDetails: details.pbrDetails?.trim() || "",
          }}
        />
      </div>
    </div>
  );
}
