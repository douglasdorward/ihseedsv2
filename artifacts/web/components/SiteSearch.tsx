"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { searchSite } from "../lib/site-search-action";
import type { SearchHit, SearchKind, SearchTextPart } from "../lib/site-search";
import { Icon } from "./Icon";

const DEBOUNCE_MS = 200;

function kindLabel(kind: SearchKind) {
  if (kind === "category") return "Category";
  if (kind === "article") return "Article";
  return "Product";
}

export function SiteSearch({
  open,
  onClose,
  onNavigate,
}: {
  open: boolean;
  onClose: () => void;
  onNavigate: () => void;
}) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestId = useRef(0);
  const headingId = useId();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setHits([]);
      setStatus("idle");
      requestId.current += 1;
      return;
    }
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (!trimmed) {
      setHits([]);
      setStatus("idle");
      requestId.current += 1;
      return;
    }
    setHits([]);
    setStatus("loading");
    const current = requestId.current + 1;
    requestId.current = current;
    const timer = window.setTimeout(() => {
      searchSite(trimmed).then((next) => {
        if (requestId.current !== current) return;
        setHits(next);
        setStatus("ready");
      }).catch(() => {
        if (requestId.current !== current) return;
        setHits([]);
        setStatus("error");
      });
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query, open]);

  if (!open || !mounted) return null;

  const productHits = hits.filter((hit) => hit.kind !== "article");
  const articleHits = hits.filter((hit) => hit.kind === "article");
  const showGroups = status === "ready" && hits.length > 0;
  let statusText = "Search products, FAQs, and articles.";
  if (status === "loading") statusText = "Searching…";
  else if (status === "error") statusText = "Search is unavailable right now.";
  else if (status === "ready") statusText = "No matching pages.";

  return createPortal(
    <div className="site-search-backdrop" onMouseDown={onClose}>
      <div
        className="site-search-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        id="site-search-dialog"
        data-testid="site-search-dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <form className="site-search-form" role="search" onSubmit={(event) => event.preventDefault()}>
          <h2 id={headingId} className="visually-hidden">Search</h2>
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search products and articles"
            aria-label="Search products and articles"
            data-testid="site-search-input"
            autoComplete="off"
          />
          <button type="button" className="site-search-close" aria-label="Close search" onClick={onClose} data-testid="button-search-close">
            <Icon name="close" size={18} />
          </button>
        </form>
        {!showGroups && (
          <p className="site-search-status" data-testid="site-search-status" aria-live="polite">{statusText}</p>
        )}
        {showGroups && productHits.length > 0 && (
          <ResultGroup title="Products" hits={productHits} onNavigate={onNavigate} />
        )}
        {showGroups && articleHits.length > 0 && (
          <ResultGroup title="Articles" hits={articleHits} onNavigate={onNavigate} />
        )}
      </div>
    </div>,
    document.body,
  );
}

function HighlightedText({ parts }: { parts: SearchTextPart[] }) {
  return parts.map((part, index) => part.match
    ? <mark key={index} className="site-search-mark">{part.text}</mark>
    : <span key={index}>{part.text}</span>);
}

function ResultGroup({
  title,
  hits,
  onNavigate,
}: {
  title: string;
  hits: SearchHit[];
  onNavigate: () => void;
}) {
  return (
    <section className="site-search-group" aria-label={title}>
      <h3>{title}</h3>
      <ul>
        {hits.map((hit) => (
          <li key={hit.id}>
            <Link href={hit.href} className="site-search-hit" onClick={onNavigate} data-testid={`site-search-hit-${hit.id}`}>
              <span className="site-search-kind">{kindLabel(hit.kind)}</span>
              <strong><HighlightedText parts={hit.title} /></strong>
              {hit.snippet.some((part) => part.text) ? <span className="site-search-snippet"><HighlightedText parts={hit.snippet} /></span> : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
