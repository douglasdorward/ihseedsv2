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
const PAGE_FIT_FUDGE_PX = 4;

function occupiedHeight(el: HTMLElement) {
  const style = getComputedStyle(el);
  return el.getBoundingClientRect().height
    + (parseFloat(style.marginTop) || 0)
    + (parseFloat(style.marginBottom) || 0);
}

function wordsOf(text: string) {
  return text.trim().split(/\s+/).filter(Boolean);
}

/** Keep the longest word prefix whose border box ends at or above limitBottom. */
function splitByBottom(node: HTMLElement, text: string, limitBottom: number) {
  const words = wordsOf(text);
  const original = node.textContent;
  if (words.length === 0) return { fit: "", rest: "" };
  try {
    if (node.getBoundingClientRect().top > limitBottom) return { fit: "", rest: text };
    const fits = (count: number) => {
      node.textContent = words.slice(0, count).join(" ");
      return node.getBoundingClientRect().bottom <= limitBottom;
    };
    if (fits(words.length)) return { fit: text.trim(), rest: "" };
    let lo = 0;
    let hi = words.length;
    let best = 0;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (mid > 0 && fits(mid)) {
        best = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    if (best <= 0) return { fit: "", rest: text };
    if (best >= words.length) return { fit: text.trim(), rest: "" };
    return {
      fit: words.slice(0, best).join(" "),
      rest: words.slice(best).join(" "),
    };
  } finally {
    node.textContent = original;
  }
}

function splitByHeight(probe: HTMLElement, text: string, maxHeight: number) {
  const words = wordsOf(text);
  if (words.length === 0 || maxHeight <= 0) return { fit: "", rest: text.trim() };
  const heightFor = (count: number) => {
    probe.textContent = words.slice(0, count).join(" ");
    return occupiedHeight(probe);
  };
  if (heightFor(words.length) <= maxHeight) return { fit: text.trim(), rest: "" };
  let lo = 1;
  let hi = words.length - 1;
  let best = 0;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (heightFor(mid) <= maxHeight) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (best <= 0) return { fit: "", rest: words.join(" ") };
  return {
    fit: words.slice(0, best).join(" "),
    rest: words.slice(best).join(" "),
  };
}

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
  const aboutSourceRef = useRef<HTMLDivElement>(null);
  const [aboutOnFirst, setAboutOnFirst] = useState(view.about);
  const [pages, setPages] = useState<PageContent[]>([]);
  const [measured, setMeasured] = useState(false);

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

      const bodyStyle = getComputedStyle(body);
      const maxHeight = Math.max(
        0,
        body.clientHeight
          - (parseFloat(bodyStyle.paddingTop) || 0)
          - (parseFloat(bodyStyle.paddingBottom) || 0)
          - PAGE_FIT_FUDGE_PX,
      );
      const gap = parseFloat(getComputedStyle(measure).rowGap || "0") || 0;
      const heightOf = (name: string) => measure.querySelector(`[data-pack="${name}"]`)?.getBoundingClientRect().height ?? 0;

      const firstPage = document.querySelector<HTMLElement>(".pdf-page.is-first");
      const firstCol = firstPage?.querySelector<HTMLElement>(".pdf-col-main");
      const aboutSource = aboutSourceRef.current;
      let firstAbout: string[] = [];
      let leftoverAbout: string[] = [];

      if (aboutSource && firstPage && firstCol && view.about.length > 0) {
        aboutSource.style.width = `${firstCol.clientWidth}px`;
        const aboutBox = aboutSource.querySelector<HTMLElement>(".pdf-about");
        const sourceParagraphs = aboutBox ? [...aboutBox.querySelectorAll<HTMLElement>("p")] : [];
        const beforeAbout = [...firstCol.children].filter((el) => !el.classList.contains("pdf-about"));
        const lastBefore = beforeAbout.at(-1) as HTMLElement | undefined;
        const colGap = parseFloat(getComputedStyle(firstCol).rowGap || "0") || 0;
        const aboutStart = lastBefore
          ? lastBefore.getBoundingClientRect().bottom + colGap
          : firstCol.getBoundingClientRect().top;
        const pageStyle = getComputedStyle(firstPage);
        const pageBottom = firstPage.getBoundingClientRect().bottom - (parseFloat(pageStyle.paddingBottom) || 0);
        const footerTop = firstPage.querySelector(".pdf-footer")?.getBoundingClientRect().top ?? pageBottom;
        const available = Math.min(pageBottom, footerTop) - aboutStart - PAGE_FIT_FUDGE_PX;
        const sourceTop = aboutBox?.getBoundingClientRect().top ?? 0;
        const fitLimit = sourceTop + Math.max(0, available);
        const heading = aboutBox?.querySelector("h2");
        const headingFits = !heading || heading.getBoundingClientRect().bottom <= fitLimit;

        if (!headingFits || sourceParagraphs.length === 0) {
          leftoverAbout = [...view.about];
        } else {
          for (let index = 0; index < sourceParagraphs.length; index += 1) {
            const node = sourceParagraphs[index];
            const paragraph = view.about[index] ?? "";
            if (node.getBoundingClientRect().bottom <= fitLimit) {
              firstAbout.push(paragraph);
              continue;
            }
            const split = splitByBottom(node, paragraph, fitLimit);
            if (split.fit) firstAbout.push(split.fit);
            if (split.rest) leftoverAbout.push(split.rest);
            leftoverAbout.push(...view.about.slice(index + 1));
            break;
          }
        }
      } else {
        firstAbout = [...view.about];
      }

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

      const aboutHeading = measure.querySelector<HTMLElement>("[data-pack='about-cont-h']");
      const aboutProbe = measure.querySelector<HTMLElement>("[data-pack='about-probe']");
      const aboutQueue = leftoverAbout.map((paragraph) => paragraph.trim()).filter(Boolean);
      let aboutStarted = firstAbout.length > 0;
      let aboutGuard = 0;
      while (aboutQueue.length > 0 && aboutGuard < 400) {
        aboutGuard += 1;
        const opening = current.about.length === 0;
        const sectionGap = opening && used > 0 ? gap : 0;
        const headingH = opening && aboutHeading ? occupiedHeight(aboutHeading) : 0;
        const room = maxHeight - used - sectionGap - headingH;
        if (room <= 1 && used > 0) {
          flush();
          continue;
        }
        const split = aboutProbe
          ? splitByHeight(aboutProbe, aboutQueue[0], Math.max(room, 0))
          : { fit: "", rest: aboutQueue[0] };
        if (!split.fit) {
          if (used > 0) {
            flush();
            continue;
          }
          const words = wordsOf(aboutQueue[0]);
          const forced = words[0] ?? aboutQueue[0];
          const rest = words.slice(1).join(" ");
          if (aboutProbe) aboutProbe.textContent = forced;
          if (opening) {
            current.aboutContinued = aboutStarted;
            used += headingH;
          }
          current.about.push(forced);
          used += aboutProbe ? occupiedHeight(aboutProbe) : maxHeight;
          aboutStarted = true;
          if (rest) aboutQueue[0] = rest;
          else aboutQueue.shift();
          flush();
          continue;
        }
        if (opening) {
          current.aboutContinued = aboutStarted;
          used += sectionGap + headingH;
        }
        if (aboutProbe) {
          aboutProbe.textContent = split.fit;
          used += occupiedHeight(aboutProbe);
        }
        current.about.push(split.fit);
        aboutStarted = true;
        if (split.rest) {
          aboutQueue[0] = split.rest;
          flush();
        } else {
          aboutQueue.shift();
        }
      }

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
      setMeasured(true);
    };

    const run = () => {
      requestAnimationFrame(() => {
        if (!cancelled) pack();
      });
    };
    const start = async () => {
      document.querySelector(".pdf-preview-root")?.removeAttribute("data-pdf-ready");
      setMeasured(false);
      await document.fonts?.ready;
      const images = [...document.querySelectorAll<HTMLImageElement>(".pdf-preview-root img")];
      await Promise.all(images.map((image) => (image.complete ? undefined : image.decode().catch(() => undefined))));
      if (!cancelled) run();
    };
    void start();
    window.addEventListener("resize", run);
    return () => {
      cancelled = true;
      window.removeEventListener("resize", run);
    };
  }, [mixRows, showSold, view]);

  useLayoutEffect(() => {
    if (!measured) return;
    fitQuickFactsToPage();
    document.querySelector(".pdf-preview-root")?.setAttribute("data-pdf-ready", "true");
  }, [measured, pages, aboutOnFirst]);

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
                {aboutOnFirst.map((paragraph, index) => (
                  <p key={`first-about-${index}`}>{paragraph}</p>
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
        {view.about.length > 0 && (
          <div className="pdf-about-source" ref={aboutSourceRef} aria-hidden="true">
            <section className="pdf-about">
              <h2>About this variety</h2>
              {view.about.map((paragraph, index) => (
                <p key={`source-about-${index}`}>{paragraph}</p>
              ))}
            </section>
          </div>
        )}
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
        <SheetHeader continued heading={view.heading} />
        <div className="pdf-page-body pdf-follow-on" ref={bodyRef} />
        <SheetFooter productUrl={view.productUrl} page={1} pageCount={1} />
      </div>

      <div className="pdf-measure pdf-follow-on" ref={measureRef} aria-hidden="true">
        <section className="pdf-about">
          <h2 data-pack="about-cont-h">About this variety (continued)</h2>
          <p data-pack="about-probe" />
          <span data-pack="about-probe-end" />
        </section>
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
          {page.about.map((paragraph, index) => (
            <p key={`about-${index}`}>{paragraph}</p>
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
