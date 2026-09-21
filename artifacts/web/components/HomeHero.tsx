"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CATALOGUE_INDEX_PATH } from "../lib/catalogue-paths";
import { Icon } from "./Icon";

const HERO_OVERLAY = "linear-gradient(90deg, rgba(29,40,28,.98) 0%, rgba(29,40,28,.84) 47%, rgba(29,40,28,.42) 100%)";
const SLIDE_MS = 6000;

export function HomeHero({
  eyebrow,
  heading,
  body,
  images,
  slideshow,
}: {
  eyebrow: string;
  heading: string;
  body: string;
  images: string[];
  slideshow: boolean;
}) {
  const slides = images.filter(Boolean);
  const canSlide = slideshow && slides.length > 1;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  const active = canSlide && !reduceMotion;
  const current = slides[index] ?? slides[0] ?? "";

  useEffect(() => {
    if (!active || paused) return;
    const timer = window.setInterval(() => {
      setIndex((currentIndex) => (currentIndex + 1) % slides.length);
    }, SLIDE_MS);
    return () => window.clearInterval(timer);
  }, [active, paused, slides.length]);

  const go = (next: number) => {
    setIndex((next + slides.length) % slides.length);
  };

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

  if (!active) {
    return (
      <section className="hero-wrap">
        <div className="hero" style={{ backgroundImage: `${HERO_OVERLAY}, url(${current})` }}>
          {copy}
        </div>
      </section>
    );
  }

  return (
    <section className="hero-wrap">
      <div
        className="hero hero-slideshow"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {slides.map((src, slideIndex) => (
          <div
            key={`${src}-${slideIndex}`}
            className={`hero-slide ${slideIndex === index ? "is-active" : ""}`}
            style={{ backgroundImage: `${HERO_OVERLAY}, url(${src})` }}
            aria-hidden={slideIndex !== index}
          />
        ))}
        {copy}
        <div className="hero-slideshow-controls">
          <div className="hero-slideshow-dots" role="tablist" aria-label="Hero photos">
            {slides.map((_, slideIndex) => (
              <button
                key={slideIndex}
                type="button"
                className={`hero-slideshow-dot ${slideIndex === index ? "is-active" : ""}`}
                aria-label={`Show photo ${slideIndex + 1}`}
                aria-current={slideIndex === index ? "true" : undefined}
                onClick={() => setIndex(slideIndex)}
              />
            ))}
          </div>
          <div className="hero-slideshow-arrows">
            <button type="button" className="hero-slideshow-arrow" aria-label="Previous photo" onClick={() => go(index - 1)}>
              <Icon name="chevron-left" size={20} />
            </button>
            <button type="button" className="hero-slideshow-arrow" aria-label="Next photo" onClick={() => go(index + 1)}>
              <Icon name="chevron-right" size={20} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
