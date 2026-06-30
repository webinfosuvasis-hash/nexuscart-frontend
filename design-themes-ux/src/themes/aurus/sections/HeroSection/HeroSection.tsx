/**
 * HeroSection — Aurus Hero Banner Carousel
 *
 * PIXEL-IDENTICAL to the hero section in AurusHome.tsx (lines 467–588).
 *
 * What changed (data only, never visual):
 *   - `SLIDES` constant → `config.slides` (filtered to isEnabled)
 *   - Height `500px` → `config.height`
 *   - Auto-rotate 4500ms → `config.autoRotateSpeed * 1000`
 *   - Slide indicator style → `config.indicatorStyle`
 *   - Editorial gradient (Tailwind classes) → computed inline CSS from `overlayGradient`
 *   - Editorial text fields: eyebrow, brandName, headlineL1/L2, disclaimer, ctaText/ctaUrl
 *   - Editorial background image: `slide.backgroundImage || AURUS_HERO_FALLBACK_BG`
 *
 * What did NOT change:
 *   - All className strings
 *   - All spacing, typography, sizing
 *   - All animation durations and transitions
 *   - Arrow button styles
 *   - Slide indicator pill/dot styles
 *   - SERIF and UI style objects
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { SectionComponentProps } from '../shared/types';
import type { HeroConfig, HeroData } from './HeroSection.types';
import { isBannerSlide, isEditorialSlide, AURUS_HERO_FALLBACK_BG } from './HeroSection.types';
import { buildOverlayGradient } from '../shared/pipeline';

// ─── Theme style constants (matching AurusHome.tsx) ───────────────────────────

const UI   = { fontFamily: 'system-ui, -apple-system, sans-serif' };
const SERIF = { fontFamily: 'Georgia, "Times New Roman", serif' };

// ─── Component ────────────────────────────────────────────────────────────────

const HeroSection: React.FC<SectionComponentProps<HeroConfig, HeroData>> = ({
  config,
  isPreview = false,
}) => {
  // Filter to only enabled slides — mirrors the original SLIDES array behaviour
  const enabledSlides = config.slides.filter(s => s.isEnabled);

  const [slide, setSlide] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-rotate — disabled in admin preview to allow static inspection
  const startTimer = useCallback(() => {
    if (!config.autoRotate || isPreview || enabledSlides.length <= 1) return;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(
      () => setSlide(s => (s + 1) % enabledSlides.length),
      config.autoRotateSpeed * 1000,
    );
  }, [config.autoRotate, config.autoRotateSpeed, enabledSlides.length, isPreview]);

  useEffect(() => {
    startTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [startTimer]);

  const goSlide = (idx: number) => {
    setSlide((idx + enabledSlides.length) % enabledSlides.length);
    startTimer();
  };

  if (enabledSlides.length === 0) return null;

  // ── JSX — pixel-identical to AurusHome.tsx lines 471–563 ─────────────────

  return (
    <>
      {/* Hero carousel section */}
      <section
        className="relative select-none overflow-hidden bg-gray-900 mx-6 sm:mx-8 mt-4 rounded-2xl"
        style={{ height: `${config.height}px` }}
      >
        {enabledSlides.map((sl, i) => (
          <div
            key={sl.id}
            className={`absolute inset-0 transition-opacity duration-200 ease-in-out ${
              i === slide ? 'opacity-100 z-10 visible' : 'opacity-0 z-0 pointer-events-none invisible'
            }`}
          >
            {isBannerSlide(sl) ? (
              /* ── BANNER SLIDE ── Pre-designed full-width image */
              sl.linkUrl ? (
                <a href={isPreview ? '#' : sl.linkUrl} onClick={isPreview ? (e) => e.preventDefault() : undefined}>
                  <img
                    src={sl.src}
                    alt={sl.alt}
                    className="absolute inset-0 w-full h-full object-cover object-top"
                    draggable={false}
                  />
                </a>
              ) : (
                <img
                  src={sl.src}
                  alt={sl.alt}
                  className="absolute inset-0 w-full h-full object-cover object-top"
                  draggable={false}
                />
              )
            ) : isEditorialSlide(sl) ? (
              /* ── EDITORIAL SLIDE ── Full-bleed photo + gradient + HTML text */
              <>
                <img
                  src={sl.backgroundImage || AURUS_HERO_FALLBACK_BG}
                  alt="Aurus Fine Jewellery"
                  className="absolute inset-0 w-full h-full object-cover object-center"
                  draggable={false}
                />
                {/* Left-to-right gradient overlay */}
                <div
                  className="absolute inset-0"
                  style={{ background: buildOverlayGradient(sl.overlayGradient) }}
                />
                {/* Bottom vignette */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />

                {/* Text content — pixel-identical positioning and typography */}
                <div className="absolute inset-0 flex flex-col justify-center px-8 sm:px-14">
                  <div className="max-w-[520px]">
                    {sl.brandName && (
                      <p className="text-white/90 text-3xl sm:text-4xl font-light italic mb-2" style={SERIF}>
                        {sl.brandName}
                      </p>
                    )}
                    {sl.eyebrowText && (
                      <p className="text-white/70 text-[11px] tracking-[0.4em] uppercase font-semibold mb-3" style={UI}>
                        {sl.eyebrowText}
                      </p>
                    )}
                    <h2 className="text-4xl sm:text-[52px] font-light text-white leading-[1.12]" style={SERIF}>
                      {sl.headlineL1}
                      {sl.headlineL2 && (
                        <>
                          <br />
                          <span
                            className="font-semibold"
                            style={{ color: sl.headlineL2Color ?? '#FEF08A' }}
                          >
                            {sl.headlineL2}
                          </span>
                        </>
                      )}
                    </h2>
                    {sl.disclaimer && (
                      <p className="text-[13px] text-white/65 mt-3 font-light leading-relaxed" style={UI}>
                        {sl.disclaimer}
                      </p>
                    )}
                    <a
                      href={isPreview ? '#' : (sl.ctaUrl || '/')}
                      onClick={isPreview ? (e) => e.preventDefault() : undefined}
                      className="inline-flex items-center gap-2 mt-6 border border-white/70 text-white hover:bg-white hover:text-gray-900 px-6 py-2.5 text-[12px] font-bold tracking-[0.12em] uppercase transition-all duration-200"
                      style={UI}
                    >
                      {sl.ctaText} <span className="text-[10px]">▶</span>
                    </a>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        ))}

        {/* ← Prev arrow */}
        {enabledSlides.length > 1 && (
          <button
            onClick={() => goSlide(slide - 1)}
            className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 z-20 bg-white/20 hover:bg-white/40 backdrop-blur-sm text-white rounded-full w-10 h-10 flex items-center justify-center border border-white/30 transition-all"
            aria-label="Previous slide"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        {/* → Next arrow */}
        {enabledSlides.length > 1 && (
          <button
            onClick={() => goSlide(slide + 1)}
            className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 z-20 bg-white/20 hover:bg-white/40 backdrop-blur-sm text-white rounded-full w-10 h-10 flex items-center justify-center border border-white/30 transition-all"
            aria-label="Next slide"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </section>

      {/* Slide indicator — pixel-identical to AurusHome.tsx lines 565–588 */}
      {enabledSlides.length > 1 && (
        <div className="bg-white py-2 flex items-center justify-center gap-2.5">
          {config.indicatorStyle === 'pill-counter' ? (
            <>
              <button
                onClick={() => goSlide(0)}
                className="bg-gray-800 text-white text-[11px] font-bold px-2.5 py-[5px] rounded-full leading-none"
                style={UI}
                aria-label="Go to slide 1"
              >
                {slide + 1}/{enabledSlides.length}
              </button>
              {enabledSlides.slice(1).map((_, i) => (
                <button
                  key={i}
                  onClick={() => goSlide(i + 1)}
                  aria-label={`Go to slide ${i + 2}`}
                  className={`w-[9px] h-[9px] rounded-full border transition-all duration-300 ${
                    slide === i + 1
                      ? 'bg-gray-700 border-gray-700'
                      : 'bg-transparent border-gray-400 hover:border-gray-600'
                  }`}
                />
              ))}
            </>
          ) : (
            /* dots style */
            enabledSlides.map((_, i) => (
              <button
                key={i}
                onClick={() => goSlide(i)}
                aria-label={`Go to slide ${i + 1}`}
                className={`rounded-full transition-all duration-300 ${
                  i === slide ? 'w-4 h-[7px] bg-gray-800' : 'w-[7px] h-[7px] bg-gray-400 hover:bg-gray-600'
                }`}
              />
            ))
          )}
        </div>
      )}
    </>
  );
};

export default HeroSection;
