"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../Icon";
import type { CatalogueProduct } from "../../lib/catalogue";
import { DEFAULT_COMPANY } from "../../lib/company";

type MixComponent = NonNullable<CatalogueProduct["details"]["components"]>[number];
type SaleLine = NonNullable<CatalogueProduct["saleLines"]>[number];
type QuickFact = { label: string; value: string | number; icon: string };
type Note = { title: string; body: string };
type MixRow = MixComponent & { index: number };

export type TechSheetView = {
  heading: string;
  category: string;
  year: number;
  productUrl: string;
  tagline: string;
  botanicalName: string;
  blurb: string;
  about: string[];
  photoSrc: string;
  quickFacts: QuickFact[];
  keyAttributes: string[];
  formulationYear: string;
  components: MixComponent[];
  hasComponentRates: boolean;
  notes: Note[];
  saleLines: SaleLine[];
  packSize: string;
  certification: string[];
  pbrProtected: boolean;
  pbrDetails: string;
};

type PageContent = {
  about: string[];
  aboutContinued: boolean;
  keyAttributes: boolean;
  mixHeading: "start" | "continued" | null;
  mixRows: MixRow[];
  notes: Note[];
  sold: boolean;
  meta: boolean;
};

function formatPack(line: SaleLine, fallback: string) {
  if (line.packKg) return `${line.packKg} ${line.packUnit || "kg"}`;
  return fallback || "—";
}

function formatRate(component: MixComponent) {
  if (component.inclusionRate == null) return "—";
  const unit = component.unit ? `${component.unit === "%" ? "" : " "}${component.unit}` : "";
  return `${component.inclusionRate}${unit}`;
}

function emptyPage(): PageContent {
  return {
    about: [],
    aboutContinued: false,
    keyAttributes: false,
    mixHeading: null,
    mixRows: [],
    notes: [],
    sold: false,
    meta: false,
  };
}

function pageHasContent(page: PageContent) {
  return page.about.length > 0
    || page.keyAttributes
    || page.mixRows.length > 0
    || page.notes.length > 0
    || page.sold
    || page.meta;
}

const FACTS_FIT_MIN = 0.7;

function fitQuickFactsToPage() {
  const page = document.querySelector<HTMLElement>(".pdf-page.is-first");
  const facts = page?.querySelector<HTMLElement>(".pdf-facts");
  const body = page?.querySelector<HTMLElement>(".pdf-page-1");
  if (!facts || !body) return;

  facts.style.removeProperty("--pdf-facts-fit");
  facts.style.removeProperty("max-height");
  facts.style.overflow = "visible";

  const available = Math.floor(body.getBoundingClientRect().bottom - facts.getBoundingClientRect().top);
  if (available <= 0) {
    facts.style.removeProperty("overflow");
    return;
  }
  if (facts.scrollHeight <= available + 0.5) {
    facts.style.removeProperty("overflow");
    return;
  }

  facts.style.maxHeight = `${available}px`;
  facts.style.overflow = "hidden";

  let lo = FACTS_FIT_MIN;
  let hi = 1;
  let best = FACTS_FIT_MIN;
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    facts.style.setProperty("--pdf-facts-fit", mid.toFixed(3));
    if (facts.scrollHeight <= facts.clientHeight + 0.5) {
      best = mid;
      lo = mid;
    } else {
      hi = mid;
    }
  }
  facts.style.setProperty("--pdf-facts-fit", best.toFixed(3));
}

export function TechSheetPages({ view }: { view: TechSheetView }) {
  const measureRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [aboutOnFirst, setAboutOnFirst] = useState(view.about);
  const [pages, setPages] = useState<PageContent[]>([]);

  const mixRows = useMemo(
    () => view.components.map((component, index) => ({ ...component, index })),
    [view.components],
  );
  const soldLines = view.saleLines.length > 0
    ? view.saleLines
    : [{ seedForm: "Bare", packKg: null, packUnit: "", stockCode: "fallback" }];
  const showSold = view.saleLines.length > 0 || Boolean(view.packSize);

  useLayoutEffect(() => {
    let cancelled = false;

    const pack = () => {
      if (cancelled) return;
      const measure = measureRef.current;
      const body = bodyRef.current;
      if (!measure || !body) return;

      const maxHeight = body.clientHeight;
      const gap = parseFloat(getComputedStyle(measure).rowGap || "0") || 0;
      const heightOf = (name: string) => measure.querySelector(`[data-pack="${name}"]`)?.getBoundingClientRect().height ?? 0;

      const firstCol = document.querySelector(".pdf-page.is-first .pdf-col-main");
      const aboutNodes = firstCol ? [...firstCol.querySelectorAll(".pdf-about p")] : [];
      const colBottom = firstCol?.getBoundingClientRect().bottom ?? 0;
      const overflowAt = aboutNodes.findIndex((node) => node.getBoundingClientRect().bottom > colBottom + 1);
      const firstAbout = overflowAt < 0 ? view.about : view.about.slice(0, overflowAt);
      const leftoverAbout = overflowAt < 0 ? [] : view.about.slice(overflowAt);

      const packed: PageContent[] = [];
      let current = emptyPage();
      let used = 0;

      const flush = () => {
        if (!pageHasContent(current)) return;
        packed.push(current);
        current = emptyPage();
        used = 0;
      };

      const addBlock = (height: number, apply: () => void) => {
        const extra = used === 0 ? 0 : gap;
        if (used > 0 && extra + height > maxHeight - used) flush();
        used += (used === 0 ? 0 : gap) + height;
        apply();
      };

      leftoverAbout.forEach((paragraph, index) => {
        const heading = index === 0 ? heightOf("about-cont-h") : 0;
        addBlock(heading + heightOf(`about-p-${overflowAt + index}`), () => {
          if (current.about.length === 0) current.aboutContinued = true;
          current.about.push(paragraph);
        });
      });

      if (view.keyAttributes.length > 0) {
        addBlock(heightOf("attributes"), () => {
          current.keyAttributes = true;
        });
      }

      const startChrome = heightOf("mix-head") + heightOf("mix-thead");
      const continuedChrome = heightOf("mix-cont") + heightOf("mix-thead");
      for (const row of mixRows) {
        const rowHeight = heightOf(`mix-row-${row.index}`);
        const mixAlreadyOnSheet = packed.some((page) => page.mixRows.length > 0) || current.mixRows.length > 0;
        const chrome = current.mixRows.length === 0 ? (mixAlreadyOnSheet ? continuedChrome : startChrome) : 0;
        const extra = current.mixRows.length === 0 && used > 0 ? gap : 0;
        if (used > 0 && extra + chrome + rowHeight > maxHeight - used) flush();

        const continued = packed.some((page) => page.mixRows.length > 0);
        if (current.mixRows.length === 0) {
          current.mixHeading = continued ? "continued" : "start";
          used += (used > 0 ? gap : 0) + (continued ? continuedChrome : startChrome);
        }
        used += rowHeight;
        current.mixRows.push(row);
      }

      view.notes.forEach((note, index) => {
        addBlock(heightOf(`note-${index}`), () => {
          current.notes.push(note);
        });
      });

      if (showSold) {
        addBlock(heightOf("sold"), () => {
          current.sold = true;
        });
      }

      if (view.certification.length > 0 || view.pbrProtected) {
        addBlock(heightOf("meta"), () => {
          current.meta = true;
        });
      }

      flush();
      setAboutOnFirst(firstAbout);
      setPages(packed);
    };

    const run = () => {
      requestAnimationFrame(() => {
        pack();
        fitQuickFactsToPage();
      });
    };
    const fonts = document.fonts?.ready;
    if (fonts) void fonts.then(run);
    else run();
    window.addEventListener("resize", run);
    return () => {
      cancelled = true;
      window.removeEventListener("resize", run);
    };
  }, [mixRows, showSold, view]);

  const pageCount = 1 + pages.length;

  return (
    <>
      <article className="pdf-page is-first" aria-label={`${view.heading} technical sheet, page 1`}>
        <SheetHeader year={view.year} />
        <div className="pdf-page-body pdf-page-1">
          <div className="pdf-col-main">
            {view.category && <p className="pdf-eyebrow">{view.category}</p>}
            <h1 className="pdf-title">{view.heading}</h1>
            {view.tagline && <p className="pdf-tagline">{view.tagline}</p>}
            {view.botanicalName && <p className="pdf-botanical">{view.botanicalName}</p>}
            {view.blurb && <p className="pdf-blurb">{view.blurb}</p>}
            {aboutOnFirst.length > 0 && (
              <section className="pdf-about">
                <h2>About this variety</h2>
                {aboutOnFirst.map((paragraph) => (
                  <p key={paragraph.slice(0, 48)}>{paragraph}</p>
                ))}
              </section>
            )}
          </div>
          <aside className="pdf-col-side">
            <div className="pdf-portrait">
              {view.photoSrc ? (
                <img src={view.photoSrc} alt="" />
              ) : (
                <div className="pdf-portrait-fallback">
                  <img src="/ih-seeds-logo.png" alt="" />
                </div>
              )}
            </div>
            {view.quickFacts.length > 0 && (
              <section className="pdf-facts">
                <h2>Quick facts</h2>
                <div className="pdf-facts-list">
                  {view.quickFacts.map((fact) => (
                    <div className="pdf-fact" key={fact.label}>
                      <span className="pdf-fact-icon">
                        <Icon name={fact.icon} size={14} />
                      </span>
                      <div>
                        <span className="pdf-fact-label">{fact.label}</span>
                        <span className="pdf-fact-value">{fact.value}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </aside>
        </div>
        <SheetFooter productUrl={view.productUrl} page={1} pageCount={pageCount} />
      </article>

      {pages.map((page, index) => (
        <article className="pdf-page" key={`follow-${index}`} aria-label={`${view.heading} technical sheet, page ${index + 2}`}>
          <SheetHeader continued heading={view.heading} />
          <div className="pdf-page-body pdf-follow-on">
            <FollowOnBlocks page={page} view={view} soldLines={soldLines} showSold={showSold} />
          </div>
          <SheetFooter productUrl={view.productUrl} page={index + 2} pageCount={pageCount} />
        </article>
      ))}

      <div className="pdf-page pdf-measure-page" aria-hidden="true">
        <SheetHeader year={view.year} />
        <div className="pdf-page-body pdf-follow-on" ref={bodyRef} />
        <SheetFooter productUrl={view.productUrl} page={1} pageCount={1} />
      </div>

      <div className="pdf-measure pdf-follow-on" ref={measureRef} aria-hidden="true">
        <h2 data-pack="about-cont-h">About this variety (continued)</h2>
        {view.about.map((paragraph, index) => (
          <p data-pack={`about-p-${index}`} key={`about-${index}`}>{paragraph}</p>
        ))}
        {view.keyAttributes.length > 0 && (
          <section className="pdf-key-attributes" data-pack="attributes">
            <h2>Key attributes</h2>
            <ul>{view.keyAttributes.map((attribute) => <li key={attribute}>{attribute}</li>)}</ul>
          </section>
        )}
        <div data-pack="mix-head">
          <h2>Mix components</h2>
          {view.formulationYear && <p className="pdf-formulation">Formulation {view.formulationYear}</p>}
        </div>
        <div data-pack="mix-cont">
          <h2>Mix components (continued)</h2>
        </div>
        <div className="pdf-table-wrap">
          <table>
            <thead data-pack="mix-thead">
              <tr>
                <th>Component</th>
                {view.hasComponentRates && <th>Rate</th>}
              </tr>
            </thead>
            <tbody>
              {mixRows.map((component) => (
                <tr data-pack={`mix-row-${component.index}`} key={component.index}>
                  <td>
                    <div className="pdf-mix-component-name">{component.speciesName}</div>
                    {component.description?.trim() && (
                      <div className="pdf-mix-component-description">{component.description.trim()}</div>
                    )}
                  </td>
                  {view.hasComponentRates && <td>{formatRate(component)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {view.notes.map((note, index) => (
          <div className="pdf-note" data-pack={`note-${index}`} key={note.title}>
            <h2>{note.title}</h2>
            <p>{note.body}</p>
          </div>
        ))}
        <section data-pack="sold">
          <h2>How it&apos;s sold</h2>
          <div className="pdf-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Form</th>
                  <th>Pack</th>
                </tr>
              </thead>
              <tbody>
                {soldLines.map((line) => (
                  <tr key={line.stockCode || `${line.seedForm}-${line.packKg}`}>
                    <td>{line.seedForm || "Bare"}</td>
                    <td>{formatPack(line, view.packSize)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <div className="pdf-meta" data-pack="meta">
          {view.certification.length > 0 && <div>Certification: {view.certification.join(", ")}</div>}
          {view.pbrProtected && <div>PBR: {view.pbrDetails || "Protected"}</div>}
        </div>
      </div>
    </>
  );
}

function FollowOnBlocks({
  page,
  view,
  soldLines,
  showSold,
}: {
  page: PageContent;
  view: TechSheetView;
  soldLines: SaleLine[];
  showSold: boolean;
}) {
  return (
    <>
      {page.about.length > 0 && (
        <section className="pdf-about">
          <h2>{page.aboutContinued ? "About this variety (continued)" : "About this variety"}</h2>
          {page.about.map((paragraph) => (
            <p key={paragraph.slice(0, 48)}>{paragraph}</p>
          ))}
        </section>
      )}
      {page.keyAttributes && (
        <section className="pdf-key-attributes">
          <h2>Key attributes</h2>
          <ul>{view.keyAttributes.map((attribute) => <li key={attribute}>{attribute}</li>)}</ul>
        </section>
      )}
      {page.mixRows.length > 0 && (
        <section>
          <h2>{page.mixHeading === "continued" ? "Mix components (continued)" : "Mix components"}</h2>
          {page.mixHeading === "start" && view.formulationYear && (
            <p className="pdf-formulation">Formulation {view.formulationYear}</p>
          )}
          <div className="pdf-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Component</th>
                  {view.hasComponentRates && <th>Rate</th>}
                </tr>
              </thead>
              <tbody>
                {page.mixRows.map((component) => (
                  <tr key={`${component.speciesName}-${component.index}`}>
                    <td>
                      <div className="pdf-mix-component-name">{component.speciesName}</div>
                      {component.description?.trim() && (
                        <div className="pdf-mix-component-description">{component.description.trim()}</div>
                      )}
                    </td>
                    {view.hasComponentRates && <td>{formatRate(component)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {page.notes.map((note) => (
        <div className="pdf-note" key={note.title}>
          <h2>{note.title}</h2>
          <p>{note.body}</p>
        </div>
      ))}
      {page.sold && showSold && (
        <section>
          <h2>How it&apos;s sold</h2>
          <div className="pdf-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Form</th>
                  <th>Pack</th>
                </tr>
              </thead>
              <tbody>
                {soldLines.map((line) => (
                  <tr key={line.stockCode || `${line.seedForm}-${line.packKg}`}>
                    <td>{line.seedForm || "Bare"}</td>
                    <td>{formatPack(line, view.packSize)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {page.meta && (
        <div className="pdf-meta">
          {view.certification.length > 0 && <div>Certification: {view.certification.join(", ")}</div>}
          {view.pbrProtected && <div>PBR: {view.pbrDetails || "Protected"}</div>}
        </div>
      )}
    </>
  );
}

function SheetHeader({
  year,
  heading,
  continued = false,
}: {
  year?: number;
  heading?: string;
  continued?: boolean;
}) {
  return (
    <header className="pdf-header">
      <img src="/ih-seeds-logo.png" alt="IH Seeds — Irwin Hunter & Co" />
      <div className="pdf-header-meta">
        <p className="pdf-header-kicker">{continued ? heading : "Technical sheet"}</p>
        <p className="pdf-header-year">{continued ? "Technical sheet · continued" : `${year} range`}</p>
      </div>
    </header>
  );
}

function SheetFooter({
  productUrl,
  page,
  pageCount,
}: {
  productUrl: string;
  page: number;
  pageCount: number;
}) {
  return (
    <footer className="pdf-footer">
      <div>
        <strong>Irwin Hunter &amp; Co · IH Seeds</strong>
        {DEFAULT_COMPANY.address} · {DEFAULT_COMPANY.email}
        <br />
        {productUrl.replace(/^https?:\/\//, "")}
      </div>
      <div className="pdf-footer-page">
        {page} / {pageCount}
      </div>
    </footer>
  );
}
