/**
 * HeroPreview — scaled-down CSS representation of the Aurus hero carousel.
 *
 * Renders a static snapshot of the currently selected/first enabled slide.
 * Phase 4 will replace this with a live iframe preview.
 */

import React from 'react';
import type { HeroConfig, HeroSlide } from './types';
import { isEditorialSlide, isBannerSlide } from './types';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface HeroPreviewProps {
  config: HeroConfig;
  /** Index of the slide to preview. Defaults to the first enabled slide. */
  activeSlideIndex?: number;
}

// ─── Individual slide renderers ───────────────────────────────────────────────

const BannerSlidePreview: React.FC<{ slide: Extract<HeroSlide, { type: 'banner' }> }> = ({ slide }) => (
  slide.src
    ? <img src={slide.src} alt={slide.alt} className="absolute inset-0 w-full h-full object-cover object-top" draggable={false} />
    : <div className="absolute inset-0 flex items-center justify-center bg-slate-200 dark:bg-slate-700">
        <div className="text-center text-slate-400 dark:text-slate-500">
          <p className="text-[10px] font-medium">Banner Image</p>
          <p className="text-[9px] mt-0.5">Upload an image to preview</p>
        </div>
      </div>
);

const EditorialSlidePreview: React.FC<{ slide: Extract<HeroSlide, { type: 'editorial' }> }> = ({ slide }) => {
  const { overlayGradient: g } = slide;

  const gradientStyle: React.CSSProperties = {
    background: `linear-gradient(to right, ${g.from}${Math.round(g.fromAlpha * 2.55).toString(16).padStart(2, '0')} 0%, ${g.to}${Math.round(g.toAlpha * 2.55).toString(16).padStart(2, '0')} 100%)`,
  };

  return (
    <>
      {/* Background image or placeholder */}
      {slide.backgroundImage
        ? <img src={slide.backgroundImage} alt="Hero background" className="absolute inset-0 w-full h-full object-cover object-center" draggable={false} />
        : <div className="absolute inset-0 bg-gradient-to-br from-slate-700 to-slate-900" />
      }
      {/* Gradient overlay */}
      <div className="absolute inset-0" style={gradientStyle} />
      {/* Bottom vignette */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.25), transparent 60%)' }} />

      {/* Text content */}
      <div className="absolute inset-0 flex flex-col justify-center px-4 sm:px-7">
        <div className="max-w-[65%]">
          {slide.brandName && (
            <p className="text-white/90 text-[10px] sm:text-[13px] font-light italic mb-0.5 leading-tight" style={{ fontFamily: 'Georgia, serif' }}>
              {slide.brandName}
            </p>
          )}
          {slide.eyebrowText && (
            <p className="text-white/70 text-[7px] sm:text-[9px] tracking-[0.3em] uppercase font-semibold mb-1">
              {slide.eyebrowText}
            </p>
          )}
          <h2 className="text-white text-[12px] sm:text-[18px] font-light leading-tight" style={{ fontFamily: 'Georgia, serif' }}>
            {slide.headlineL1}
            {slide.headlineL2 && (
              <>
                <br />
                <span className="font-semibold" style={{ color: slide.headlineL2Color ?? '#FEF08A' }}>
                  {slide.headlineL2}
                </span>
              </>
            )}
          </h2>
          {slide.disclaimer && (
            <p className="text-[7px] sm:text-[9px] text-white/60 mt-1 leading-snug">
              {slide.disclaimer}
            </p>
          )}
          {slide.ctaText && (
            <div className="mt-2 inline-flex items-center gap-1 border border-white/60 text-white text-[7px] sm:text-[9px] font-bold px-2 py-1 tracking-wider">
              {slide.ctaText} <span className="text-[6px]">▶</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

const HeroPreview: React.FC<HeroPreviewProps> = ({ config, activeSlideIndex }) => {
  const enabledSlides = config.slides.filter(s => s.isEnabled);

  const previewSlide: HeroSlide | undefined = (() => {
    if (activeSlideIndex !== undefined && config.slides[activeSlideIndex]?.isEnabled) {
      return config.slides[activeSlideIndex];
    }
    return enabledSlides[0];
  })();

  const cornerStyle = { borderRadius: `${config.cornerRadius}px` };
  const marginStyle = { marginLeft: `${Math.min(config.sideMargin, 16)}px`, marginRight: `${Math.min(config.sideMargin, 16)}px` };

  // Slide indicator dots/pill
  const slideIndex = previewSlide ? config.slides.indexOf(previewSlide) : 0;

  return (
    <div className="w-full bg-white dark:bg-slate-900 rounded-xl overflow-hidden">
      {/* Preview label */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-100 dark:border-slate-800">
        <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Preview</span>
        {enabledSlides.length === 0 && (
          <span className="text-[10px] text-amber-600 dark:text-amber-400">No slides enabled</span>
        )}
        {enabledSlides.length > 0 && (
          <span className="text-[10px] text-slate-400">
            {enabledSlides.length} slide{enabledSlides.length !== 1 ? 's' : ''} enabled
          </span>
        )}
      </div>

      {/* Hero area */}
      <div className="px-2 pt-2 pb-1" style={marginStyle}>
        <div
          className="relative bg-slate-800 overflow-hidden"
          style={{ ...cornerStyle, height: `${Math.round(config.height * 0.28)}px` }}
        >
          {previewSlide ? (
            <>
              {isBannerSlide(previewSlide)    && <BannerSlidePreview   slide={previewSlide} />}
              {isEditorialSlide(previewSlide) && <EditorialSlidePreview slide={previewSlide} />}
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-slate-500 dark:text-slate-600">
              <p className="text-xs">No slides to preview</p>
            </div>
          )}

          {/* Nav arrows */}
          {enabledSlides.length > 1 && (
            <>
              <div className="absolute left-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white/20 border border-white/30 flex items-center justify-center">
                <ChevronLeft size={10} className="text-white" />
              </div>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white/20 border border-white/30 flex items-center justify-center">
                <ChevronRight size={10} className="text-white" />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Slide indicator */}
      {enabledSlides.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 py-1.5">
          {config.indicatorStyle === 'pill-counter' ? (
            <>
              <div className="bg-gray-800 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                {slideIndex + 1}/{config.slides.length}
              </div>
              {config.slides.slice(1).map((_, i) => (
                <div key={i} className="w-[6px] h-[6px] rounded-full border border-gray-400 bg-transparent" />
              ))}
            </>
          ) : (
            config.slides.map((_, i) => (
              <div key={i} className={`rounded-full transition-all ${i === slideIndex ? 'w-4 h-[5px] bg-gray-700' : 'w-[5px] h-[5px] border border-gray-400'}`} />
            ))
          )}
        </div>
      )}

      {/* Config summary */}
      <div className="flex items-center gap-3 px-3 py-1.5 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 dark:text-slate-500">
        <span>{config.autoRotate ? `Auto-rotate ${config.autoRotateSpeed}s` : 'Manual'}</span>
        <span>·</span>
        <span>{config.height}px desktop</span>
        <span>·</span>
        <span>{config.cornerRadius}px radius</span>
      </div>
    </div>
  );
};

export default HeroPreview;
