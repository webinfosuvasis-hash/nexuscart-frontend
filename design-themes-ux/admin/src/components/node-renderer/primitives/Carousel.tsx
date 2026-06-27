/**
 * Carousel — P5, production-ready
 *
 * Architecture:
 *   - Wraps embla-carousel-react v8 directly (not the shadcn shell).
 *     The shadcn shell is too opinionated about arrow/dot positioning;
 *     this implementation needs full layout control for ecommerce.
 *   - Autoplay implemented with setInterval (no embla-carousel-autoplay
 *     plugin needed — avoids an extra dependency).
 *   - Children = slides. Each child Node from ContentNode becomes one slide.
 *   - Responsive: reads slidesToShow/gap from node.settings + responsive
 *     overlay keyed by ctx.breakpoint. No CSS media queries needed.
 *   - Drag-and-drop reorder: handled by the Layers panel DnD (editor
 *     concern). The carousel renders whatever child order it receives.
 *   - Touch swipe: embla handles pointer/touch events natively.
 *   - Keyboard navigation: ArrowLeft/ArrowRight on the container.
 *
 * Future use cases (zero changes needed to this component):
 *   Product Carousel    — children = ProductCard nodes
 *   Collection Carousel — children = CollectionCard nodes
 *   Testimonial Carousel— children = Card nodes with text/avatar
 *   Logo Carousel       — children = Image nodes
 *   Instagram Carousel  — children = Image nodes from binding
 *
 * Settings keys:
 *   slidesToShow     number   1–6   (responsive-aware via overlay)
 *   gap              number   px    (responsive-aware)
 *   loop             boolean        default false
 *   autoplay         boolean        default false
 *   autoplaySpeed    number   ms    default 3000
 *   pauseOnHover     boolean        default true
 *   showArrows       boolean        default true
 *   showDots         boolean        default false
 *   arrowStyle       'circle'|'square'|'edge'   default 'circle'
 *   dotStyle         'circle'|'line'            default 'circle'
 *   bg               string   hex   background color
 *   pt,pr,pb,pl      number   px    padding
 *   responsive.*     overlay for tablet/mobile
 */

import React, {
  useEffect, useState, useCallback, useRef,
} from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { NodeProps, Breakpoint } from '../types';

// ─── Settings resolution ──────────────────────────────────────────────────────

interface CarouselSettings {
  slidesToShow:  number;
  gap:           number;
  loop:          boolean;
  autoplay:      boolean;
  autoplaySpeed: number;
  pauseOnHover:  boolean;
  showArrows:    boolean;
  showDots:      boolean;
  arrowStyle:    'circle' | 'square' | 'edge';
  dotStyle:      'circle' | 'line';
}

function resolveCarouselSettings(
  settings: Record<string, unknown>,
  bp:       Breakpoint,
): CarouselSettings {
  // Merge responsive overlay for the current breakpoint
  const overlay = (settings.responsive as Record<string, Record<string, unknown>> | undefined)?.[bp] ?? {};
  const merged  = { ...settings, ...overlay };

  return {
    slidesToShow:  Math.max(1, Math.min(6, Number(merged.slidesToShow  ?? 1))),
    gap:           Math.max(0, Number(merged.gap           ?? 16)),
    loop:          Boolean(merged.loop           ?? false),
    autoplay:      Boolean(merged.autoplay       ?? false),
    autoplaySpeed: Math.max(500, Number(merged.autoplaySpeed ?? 3000)),
    pauseOnHover:  merged.pauseOnHover !== false,
    showArrows:    merged.showArrows   !== false,
    showDots:      Boolean(merged.showDots       ?? false),
    arrowStyle:    (merged.arrowStyle as CarouselSettings['arrowStyle']) ?? 'circle',
    dotStyle:      (merged.dotStyle   as CarouselSettings['dotStyle'])   ?? 'circle',
  };
}

// ─── Arrow button ─────────────────────────────────────────────────────────────

const ArrowButton: React.FC<{
  direction:  'prev' | 'next';
  arrowStyle: CarouselSettings['arrowStyle'];
  onClick:    () => void;
  disabled:   boolean;
}> = ({ direction, arrowStyle, onClick, disabled }) => {
  const isNext = direction === 'next';
  const Icon   = isNext ? ChevronRight : ChevronLeft;

  const STYLES: Record<CarouselSettings['arrowStyle'], React.CSSProperties> = {
    circle: {
      width: 36, height: 36, borderRadius: '50%',
      background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(0,0,0,0.1)',
      boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
    },
    square: {
      width: 36, height: 36, borderRadius: 6,
      background: 'rgba(0,0,0,0.6)', border: 'none',
      color: '#ffffff',
    },
    edge: {
      width: 40, height: 56, borderRadius: isNext ? '6px 0 0 6px' : '0 6px 6px 0',
      background: 'rgba(0,0,0,0.35)', border: 'none',
      color: '#ffffff',
    },
  };

  return (
    <button
      aria-label={isNext ? 'Next slide' : 'Previous slide'}
      onClick={onClick}
      disabled={disabled}
      style={{
        position:   'absolute',
        top:        '50%',
        transform:  'translateY(-50%)',
        [isNext ? 'right' : 'left']: arrowStyle === 'edge' ? 0 : 8,
        zIndex:     10,
        display:    'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor:     disabled ? 'not-allowed' : 'pointer',
        opacity:    disabled ? 0.35 : 1,
        transition: 'opacity 150ms, transform 150ms',
        ...STYLES[arrowStyle],
      }}
      onMouseEnter={(e) => {
        if (!disabled) (e.currentTarget as HTMLElement).style.transform = 'translateY(-50%) scale(1.06)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-50%) scale(1)';
      }}
    >
      <Icon size={18} />
    </button>
  );
};

// ─── Dot indicators ───────────────────────────────────────────────────────────

const Dots: React.FC<{
  count:         number;
  selected:      number;
  dotStyle:      CarouselSettings['dotStyle'];
  onSelect:      (i: number) => void;
}> = ({ count, selected, dotStyle, onSelect }) => {
  if (count <= 1) return null;

  const BASE: React.CSSProperties = {
    display:    'flex',
    justifyContent: 'center',
    gap:        8,
    padding:    '12px 0 4px',
  };

  return (
    <div style={BASE} role="tablist" aria-label="Slide navigation">
      {Array.from({ length: count }).map((_, i) => {
        const active = i === selected;
        const dotBase: React.CSSProperties = {
          cursor:     'pointer',
          border:     'none',
          background: active ? '#1a1a1a' : 'rgba(0,0,0,0.2)',
          transition: 'all 200ms',
          padding:    0,
        };
        const dotShape: React.CSSProperties =
          dotStyle === 'circle'
            ? { width: active ? 10 : 8, height: active ? 10 : 8, borderRadius: '50%' }
            : { width: active ? 24 : 8, height: 3, borderRadius: 2 };     // line style

        return (
          <button
            key={i}
            role="tab"
            aria-selected={active}
            aria-label={`Slide ${i + 1}`}
            onClick={() => onSelect(i)}
            style={{ ...dotBase, ...dotShape }}
          />
        );
      })}
    </div>
  );
};

// ─── Main carousel primitive ──────────────────────────────────────────────────

const Carousel: React.FC<NodeProps> = ({ node, ctx, style, children }) => {
  const cfg = resolveCarouselSettings(node.settings, ctx.breakpoint);

  // ── Embla setup ──────────────────────────────────────────────────────────────
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop:           cfg.loop,
    slidesToScroll: 1,
    align:          'start',
    dragFree:       false,   // snap scrolling — expected for ecommerce
  });

  // ── Scroll state ─────────────────────────────────────────────────────────────
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollSnaps,   setScrollSnaps]   = useState<number[]>([]);

  const updateState = useCallback(() => {
    if (!emblaApi) return;
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
    setSelectedIndex(emblaApi.selectedScrollSnap());
    setScrollSnaps(emblaApi.scrollSnapList());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    updateState();
    emblaApi.on('select', updateState);
    emblaApi.on('reInit', updateState);
    return () => {
      emblaApi.off('select', updateState);
      emblaApi.off('reInit', updateState);
    };
  }, [emblaApi, updateState]);

  // ── Autoplay (setInterval — no embla-autoplay plugin needed) ─────────────────
  const isPaused = useRef(false);

  useEffect(() => {
    if (!cfg.autoplay || !emblaApi) return;
    const timer = setInterval(() => {
      if (isPaused.current) return;
      if (emblaApi.canScrollNext()) {
        emblaApi.scrollNext();
      } else if (cfg.loop) {
        emblaApi.scrollTo(0);
      }
    }, cfg.autoplaySpeed);
    return () => clearInterval(timer);
  }, [emblaApi, cfg.autoplay, cfg.autoplaySpeed, cfg.loop]);

  // ── Keyboard navigation ───────────────────────────────────────────────────────
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft')  { e.preventDefault(); emblaApi?.scrollPrev(); }
    if (e.key === 'ArrowRight') { e.preventDefault(); emblaApi?.scrollNext(); }
  }, [emblaApi]);

  // ── Slide layout ──────────────────────────────────────────────────────────────
  // Standard Embla gap pattern: negative left margin on container, left padding
  // on each slide. Embla measures the slide width including the padding.
  const slides = React.Children.toArray(children);

  // Slide flex-basis: each slide occupies 1/N of the viewport, adjusted for gap.
  // Using CSS calc to be precise regardless of container width.
  const slideFlexBasis =
    cfg.slidesToShow === 1
      ? '100%'
      : `calc(${100 / cfg.slidesToShow}% - ${(cfg.gap * (cfg.slidesToShow - 1)) / cfg.slidesToShow}px)`;

  // ── Container padding from settings ──────────────────────────────────────────
  const outerStyle: React.CSSProperties = {
    position: 'relative',
    outline:  'none',
    // Spread padding/background/etc. from resolveStyle (the `style` prop)
    ...style,
  };

  // Add horizontal padding when using 'edge' arrows so content doesn't hide behind them
  if (cfg.showArrows && cfg.arrowStyle === 'edge' && slides.length > 1) {
    outerStyle.paddingLeft  = 40;
    outerStyle.paddingRight = 40;
  }

  return (
    <div
      data-node-id={node.id}
      data-node-type="carousel"
      role="region"
      aria-roledescription="carousel"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => { if (cfg.pauseOnHover) isPaused.current = true; }}
      onMouseLeave={() => { isPaused.current = false; }}
      style={outerStyle}
    >
      {/* Embla viewport */}
      <div ref={emblaRef} style={{ overflow: 'hidden' }}>
        <div
          style={{
            display:    'flex',
            marginLeft: `-${cfg.gap}px`,  // Embla gap pattern
          }}
        >
          {slides.length > 0
            ? slides.map((slide, i) => (
                <div
                  key={i}
                  role="group"
                  aria-roledescription="slide"
                  aria-label={`Slide ${i + 1} of ${slides.length}`}
                  style={{
                    flex:       `0 0 ${slideFlexBasis}`,
                    minWidth:   0,
                    paddingLeft:`${cfg.gap}px`,  // Embla gap pattern
                  }}
                >
                  {slide}
                </div>
              ))
            : (
              // Editor placeholder when no children yet
              ctx.isPreview
                ? (
                  <div style={{
                    flex: '0 0 100%', paddingLeft: `${cfg.gap}px`,
                    minHeight: 160, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', background: 'rgba(139,92,246,0.05)',
                    border: '1.5px dashed rgba(139,92,246,0.25)', borderRadius: 8,
                    fontSize: 13, color: 'rgba(139,92,246,0.6)', fontFamily: 'monospace',
                  }}>
                    Add slides — drop child nodes here
                  </div>
                )
                : null
            )
          }
        </div>
      </div>

      {/* Navigation arrows */}
      {cfg.showArrows && slides.length > 1 && (
        <>
          <ArrowButton
            direction="prev"
            arrowStyle={cfg.arrowStyle}
            onClick={() => emblaApi?.scrollPrev()}
            disabled={!cfg.loop && !canScrollPrev}
          />
          <ArrowButton
            direction="next"
            arrowStyle={cfg.arrowStyle}
            onClick={() => emblaApi?.scrollNext()}
            disabled={!cfg.loop && !canScrollNext}
          />
        </>
      )}

      {/* Pagination dots */}
      {cfg.showDots && (
        <Dots
          count={scrollSnaps.length || slides.length}
          selected={selectedIndex}
          dotStyle={cfg.dotStyle}
          onSelect={(i) => emblaApi?.scrollTo(i)}
        />
      )}
    </div>
  );
};

export default Carousel;
export { resolveCarouselSettings };
export type { CarouselSettings };
