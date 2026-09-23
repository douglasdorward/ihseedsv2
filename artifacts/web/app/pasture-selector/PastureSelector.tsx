"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { StatusPill } from "../../components/StatusPill";
import type { CatalogueCategory, CatalogueProduct } from "../../lib/catalogue";
import { productPublicPath } from "../../lib/catalogue-paths";
import {
  EMPTY_FILTERS,
  filtersFromSearchParams,
  searchParamsFromFilters,
  type ProductListingFilters,
} from "../../lib/product-filters";
import {
  SELECTOR_END_USE,
  SELECTOR_GROUND,
  SELECTOR_LIVESTOCK,
  SELECTOR_PERSISTENCE,
  SELECTOR_RAINFALL,
  SELECTOR_SOIL,
  endUseParts,
  endUseSelected,
  findNamedProduct,
  hasSelectorAnswers,
  selectPastureProducts,
  selectorContactHref,
  type PastureSelectorCard,
} from "../../lib/pasture-selector";

function toggle(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function Option({
  checked,
  label,
  name,
  note,
  onChange,
  type,
  value,
}: {
  checked: boolean;
  label: string;
  name: string;
  note?: string;
  onChange: () => void;
  type: "checkbox" | "radio";
  value: string;
}) {
  return (
    <label className={`pasture-option${checked ? " is-checked" : ""}`}>
      <input type={type} name={name} value={value} checked={checked} onChange={onChange} />
      <span>
        <strong>{label}</strong>
        {note ? <small>{note}</small> : null}
      </span>
    </label>
  );
}

export function PastureSelector({
  initialQuery,
  products,
  categories,
}: {
  initialQuery: string;
  products: CatalogueProduct[];
  categories: CatalogueCategory[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState(initialQuery);
  const [step, setStep] = useState(0);
  const [ready, setReady] = useState(false);
  const filters = useMemo(() => filtersFromSearchParams(new URLSearchParams(query)), [query]);

  useEffect(() => setReady(true), []);

  useEffect(() => {
    const link = document.getElementById("pasture-enquiry-link");
    if (!(link instanceof HTMLAnchorElement)) return;
    link.href = selectorContactHref(new URLSearchParams(query));
  }, [query]);

  useEffect(() => {
    const onPop = () => setQuery(window.location.search.replace(/^\?/, ""));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  function write(next: ProductListingFilters) {
    const serialized = searchParamsFromFilters(next).toString();
    setQuery(serialized);
    router.replace(serialized ? `${pathname}?${serialized}` : pathname, { scroll: false });
  }

  const groups = useMemo(
    () => selectPastureProducts(products, categories, filters),
    [products, categories, filters],
  );
  const answered = hasSelectorAnswers(filters);
  const total = groups.mixes.length + groups.varieties.length + groups.maybe.length;
  const selfRegen = findNamedProduct(products, /self regeneration/i);
  const equi = findNamedProduct(products, /equi\s*1st/i);

  return (
    <>
    <div className={`pasture-wizard${ready ? " is-ready" : ""}`} data-step={step}>
      <form className="pasture-form" action="/pasture-selector" method="get" onSubmit={(event) => event.preventDefault()}>
        <fieldset className="pasture-step" data-step="0">
          <legend className="visually-hidden">How much rain does the paddock get?</legend>
          <h2 id="pasture-step-rain">How much rain does the paddock get?</h2>
          <p className="pasture-help">Your long-term average annual rainfall. If you are not sure, use the nearest town&apos;s average. We only use this to rule out varieties that need more rain than you get.</p>
          <p className="pasture-limit">A minimum rules varieties out at the dry end. It cannot rank what remains, and it never means a variety is the best choice at that rainfall.</p>
          <div className="pasture-options">
            {SELECTOR_RAINFALL.map((option) => (
              <Option
                key={option.value}
                type="radio"
                name="rainfall"
                value={String(option.value)}
                label={option.label}
                note={option.note}
                checked={filters.rainfall === option.value}
                onChange={() => write({ ...filters, rainfall: option.value })}
              />
            ))}
          </div>
        </fieldset>

        <fieldset className="pasture-step" data-step="1">
          <legend className="visually-hidden">What is the ground like?</legend>
          <h2 id="pasture-step-ground">What is the ground like?</h2>
          <p className="pasture-help">Pick the soil across most of the paddock, then tick anything that applies. Many WA blocks hold more than one soil — run the selector again for each.</p>
          <fieldset className="pasture-substep">
            <legend>Soil type</legend>
            <div className="pasture-options">
              {SELECTOR_SOIL.map((option) => (
                <Option
                  key={option.value}
                  type="checkbox"
                  name="soil"
                  value={option.value}
                  label={option.label}
                  checked={filters.soil.includes(option.value)}
                  onChange={() => write({ ...filters, soil: toggle(filters.soil, option.value) })}
                />
              ))}
            </div>
          </fieldset>
          <fieldset className="pasture-substep">
            <legend>Anything else about this ground?</legend>
            <div className="pasture-options pasture-options-thirds">
              {SELECTOR_GROUND.map((option) => (
                <Option
                  key={option.value}
                  type="checkbox"
                  name="tolerance"
                  value={option.value}
                  label={option.label}
                  checked={filters.tolerance.includes(option.value)}
                  onChange={() => write({ ...filters, tolerance: toggle(filters.tolerance, option.value) })}
                />
              ))}
            </div>
          </fieldset>
        </fieldset>

        <fieldset className="pasture-step" data-step="2">
          <legend className="visually-hidden">What is the paddock for?</legend>
          <h2 id="pasture-step-use">What is the paddock for?</h2>
          <p className="pasture-help">What are you growing this for? Pick everything that applies.</p>
          <fieldset className="pasture-substep">
            <legend>Use</legend>
            <div className="pasture-options">
              {SELECTOR_END_USE.map((option) => (
                <Option
                  key={option.value}
                  type="checkbox"
                  name="endUse"
                  value={option.value}
                  label={option.label}
                  checked={endUseSelected(filters, option.value)}
                  onChange={() => {
                    const parts = endUseParts(option.value);
                    const selected = endUseSelected(filters, option.value);
                    const endUse = selected
                      ? filters.endUse.filter((item) => !parts.includes(item))
                      : [...filters.endUse, ...parts.filter((part) => !filters.endUse.includes(part))];
                    write({ ...filters, endUse });
                  }}
                />
              ))}
            </div>
          </fieldset>
          <fieldset className="pasture-substep">
            <legend>Stock <span>optional — used to sort, not to hide varieties</span></legend>
            <div className="pasture-options pasture-options-row">
              {SELECTOR_LIVESTOCK.map((option) => (
                <Option
                  key={option.value}
                  type="checkbox"
                  name="livestock"
                  value={option.value}
                  label={option.label}
                  checked={filters.livestock.includes(option.value)}
                  onChange={() => write({ ...filters, livestock: toggle(filters.livestock, option.value) })}
                />
              ))}
            </div>
          </fieldset>
        </fieldset>

        <fieldset className="pasture-step" data-step="3">
          <legend className="visually-hidden">How long do you want it to last?</legend>
          <h2 id="pasture-step-life">How long do you want it to last?</h2>
          <p className="pasture-help">Last question. This is about your plan for the paddock, not the seed — it decides whether you want something fast, something that comes back on its own, or something that stays.</p>
          <div className="pasture-options">
            {SELECTOR_PERSISTENCE.map((option) => (
              <Option
                key={option.value}
                type="radio"
                name="persistence"
                value={option.value}
                label={option.label}
                checked={filters.persistence === option.value}
                onChange={() => write({ ...filters, persistence: option.value })}
              />
            ))}
          </div>
        </fieldset>

        <div className="pasture-form-actions">
          <button className="button button-primary pasture-submit" type="submit">See matching seed</button>
          {hasSelectorAnswers(filters) && (
            <button className="button button-outline" type="button" onClick={() => write(EMPTY_FILTERS)}>Start again</button>
          )}
        </div>
      </form>
      <div className="pasture-wizard-nav">
        <button className="button button-outline" type="button" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0}>Back</button>
        <span>Step {step + 1} of 4</span>
        {step < 3 ? (
          <button className="button button-primary" type="button" onClick={() => setStep((current) => Math.min(3, current + 1))}>Next</button>
        ) : (
          <a className="button button-primary" href="#pasture-results">See results</a>
        )}
      </div>
    </div>
    <div className="pasture-after" id="pasture-results">
      <div className="pasture-results" aria-live="polite">
        {!answered && (
          <p className="pasture-results-prompt">Answer the questions above and the varieties and mixes that fit this paddock will show here.</p>
        )}
        {answered && total === 0 && (
          <p className="pasture-results-prompt">Nothing in the range is rated for that combination. Send us the paddock and we will work through it.</p>
        )}
        {answered && total > 0 && (
          <>
            <ResultGroup
              id="pasture-mixes"
              title="Ready-made mixes"
              intro="Blended to order, and the simplest answer if you arrived unsure."
              cards={groups.mixes}
              categories={categories}
            />
            <ResultGroup
              id="pasture-varieties"
              title="Single varieties"
              intro="Varieties that fit the answers you gave."
              cards={groups.varieties}
              categories={categories}
            />
            <ResultGroup
              id="pasture-maybe"
              title="May also suit"
              intro="These are missing a rainfall, soil, use or stand-life figure, so we have kept them in. Ask us before you rely on one."
              cards={groups.maybe}
              categories={categories}
            />
            {(filters.persistence || filters.livestock.includes("Equine")) && (
              <div className="pasture-followup">
                {filters.persistence === "annual" && (
                  <p>An annual gives feed this season. Plan to resow next year.</p>
                )}
                {filters.persistence === "self-regenerating" && (
                  <p>
                    Let the stand set seed in year one before you graze it hard. Hard seed is what brings it back after the break.
                    {selfRegen ? <> Our <Link href={productPublicPath(selfRegen, categories)}>{selfRegen.name}</Link> is built around these legumes.</> : null}
                  </p>
                )}
                {filters.persistence === "lasting" && (
                  <p>A lasting pasture needs establishment-year management. Spell the paddock while the plants root, then graze to the plan you sowed it for.</p>
                )}
                {filters.livestock.includes("Equine") && (
                  <p>
                    {equi ? <>Horse owners — see our <Link href={productPublicPath(equi, categories)}>{equi.name}</Link>. </> : null}
                    Stocking pressure is usually the limiting factor. Talk to us about paddock size before you order.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
    </>
  );
}

function ResultCard({ card, categories }: { card: PastureSelectorCard; categories: CatalogueCategory[] }) {
  const href = productPublicPath(card.product, categories);
  return (
    <Link href={href} className="pasture-result-card">
      <span className="pasture-result-top">
        <h3>{card.product.name}</h3>
        <StatusPill status={card.product.status} />
      </span>
      <p className="pasture-result-category">{card.product.category}</p>
      {card.sowingRate && <p className="pasture-result-rate">Sowing rate: {card.sowingRate}</p>}
      {card.why && <p className="pasture-result-why">{card.why}</p>}
      {card.badges.length > 0 && (
        <span className="pasture-badges">
          {card.badges.map((badge) => (
            <span key={badge.label} className={`pasture-badge is-${badge.tone}`}>{badge.label}</span>
          ))}
        </span>
      )}
    </Link>
  );
}

function ResultGroup({
  id,
  title,
  intro,
  cards,
  categories,
}: {
  id: string;
  title: string;
  intro: string;
  cards: PastureSelectorCard[];
  categories: CatalogueCategory[];
}) {
  if (!cards.length) return null;
  return (
    <section className="pasture-result-group" aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      <p>{intro}</p>
      <div className="pasture-result-list">
        {cards.map((card) => <ResultCard key={card.product.id} card={card} categories={categories} />)}
      </div>
    </section>
  );
}
