"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CoverImage } from "./CoverImage";
import { CATALOGUE_INDEX_PATH } from "../lib/catalogue-paths";
import type { HeroSlide } from "../lib/site-settings";

const SLIDE_MS = 6000;
/** Safety net so a video that never fires `ended` (stalled network) still advances. */
const VIDEO_FALLBACK_MS = 45000;

function HeroVideo({
  slide,
  active,
  loop,
  onEnded,
}: {
  slide: HeroSlide;
  active: boolean;
  loop: boolean;
  onEnded: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (active) {
      video.currentTime = 0;
      const attempt = video.play();
      if (attempt) attempt.catch(() => { /* autoplay blocked; poster stays visible */ });
    } else {
      video.pause();
    }
  }, [active]);

  return (
    <video
      ref={ref}
      className="hero-video"
      src={slide.src}
      poster={slide.posterSrc || undefined}
      muted
      playsInline
      loop={loop}
      autoPlay={active}
      preload={active ? "auto" : "metadata"}
      onEnded={loop ? undefined : onEnded}
      aria-hidden="true"
      tabIndex={-1}
    />
  );
}

export function HomeHero({
  eyebrow,
  heading,
  body,
  slides,
  slideshow,
}: {
  eyebrow: string;
  heading: string;
  body: string;
  slides: HeroSlide[];
  slideshow: boolean;
}) {
  const items = slides.filter((slide) => slide.src);
  const canSlide = slideshow && items.length > 1;
  const [index, setIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  const active = canSlide && !reduceMotion;
  const safeIndex = items.length ? index % items.length : 0;
  const current = items[safeIndex] ?? items[0];
  const currentIsVideo = current?.kind === "video";

  useEffect(() => {
    if (!active) return;
    // Photos hold for a fixed time; videos advance from `onEnded`, with a long fallback.
    const timer = window.setTimeout(() => {
      setIndex((currentIndex) => (currentIndex + 1) % items.length);
    }, currentIsVideo ? VIDEO_FALLBACK_MS : SLIDE_MS);
    return () => window.clearTimeout(timer);
  }, [active, safeIndex, currentIsVideo, items.length]);

  const advance = () => setIndex((currentIndex) => (currentIndex + 1) % items.length);

  const copy = (
    <div className="hero-copy">
      <h1><span>{eyebrow}</span><strong>{heading}</strong></h1>
      <p>{body}</p>
      <div className="hero-actions">
        <Link href="/contact" className="button button-primary" data-testid="button-advice">Advice</Link>
        <Link href={CATALOGUE_INDEX_PATH} className="button button-light" data-testid="button-browse-catalogue">Browse the catalogue</Link>
      </div>
    </div>
  );

  if (!current) {
    return (
      <section className="hero-wrap">
        <div className="hero">
          <div className="hero-scrim" aria-hidden="true" />
          {copy}
        </div>
      </section>
    );
  }

  if (!active) {
    // Single slide, slideshow off, or reduced motion: show the first slide only.
    const still = current.kind === "video" ? current.posterSrc : current.src;
    const playVideo = current.kind === "video" && !reduceMotion;
    return (
      <section className="hero-wrap">
        <div className={`hero ${playVideo ? "hero-has-video" : ""}`}>
          {still ? <CoverImage src={still} alt="" sizes="100vw" priority className="hero-photo" /> : null}
          {playVideo && <HeroVideo slide={current} active loop onEnded={() => undefined} />}
          <div className="hero-scrim" aria-hidden="true" />
          {copy}
        </div>
      </section>
    );
  }

  return (
    <section className="hero-wrap">
      <div className="hero hero-slideshow" aria-live="off">
        {items.map((slide, slideIndex) => {
          const isActive = slideIndex === safeIndex;
          const still = slide.kind === "video" ? slide.posterSrc : slide.src;
          return (
            <div
              key={`${slide.src}-${slideIndex}`}
              className={`hero-slide ${slide.kind === "video" ? "hero-slide-video" : ""} ${isActive ? "is-active" : ""}`}
              aria-hidden={!isActive}
            >
              {still ? (
                <CoverImage
                  src={still}
                  alt=""
                  sizes="100vw"
                  priority={slideIndex === 0}
                  className="hero-photo"
                />
              ) : null}
              {slide.kind === "video" && (
                <HeroVideo slide={slide} active={isActive} loop={false} onEnded={advance} />
              )}
              <div className="hero-scrim" aria-hidden="true" />
            </div>
          );
        })}
        {copy}
      </div>
    </section>
  );
}
