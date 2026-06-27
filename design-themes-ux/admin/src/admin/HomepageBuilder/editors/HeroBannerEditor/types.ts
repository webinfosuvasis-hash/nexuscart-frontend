/**
 * Hero Banner Editor — type definitions.
 *
 * These types define the shape of the `config` JSON field for sections
 * with sectionType === 'hero_banner'.
 *
 * They are consumed by:
 *   - HeroBannerEditor (admin editor)
 *   - AurusHome.tsx (storefront renderer) — keep fields in sync
 *   - SectionRegistry.ts HeroConfig interface — canonical documentation source
 */

// ─── Slide types ──────────────────────────────────────────────────────────────

export interface BannerSlide {
  id: string;
  type: 'banner';
  isEnabled: boolean;
  /** Full-width pre-designed image — text/design baked into the image. */
  src: string;
  alt: string;
  /** Optional: entire slide becomes a link. */
  linkUrl?: string;
}

export interface EditorialSlide {
  id: string;
  type: 'editorial';
  isEnabled: boolean;
  /** Full-bleed lifestyle photo shown behind the gradient overlay. */
  backgroundImage: string;
  /** Left-to-right CSS gradient applied over the background image. */
  overlayGradient: {
    from:      string; // e.g. '#3B0764'
    fromAlpha: number; // 0–100 (percent opacity)
    to:        string; // e.g. '#6D28D9'
    toAlpha:   number; // 0–100
  };
  /** Small uppercase label above the headline (optional). */
  eyebrowText?: string;
  /** Large italic serif name shown above the headline (optional). */
  brandName?: string;
  /** Main headline — first line. */
  headlineL1: string;
  /** Main headline — second line, rendered in accent color (optional). */
  headlineL2?: string;
  /** Hex accent color for headlineL2. */
  headlineL2Color?: string;
  /** Smaller body text shown below the headline. */
  disclaimer?: string;
  /** CTA button label. */
  ctaText: string;
  /** CTA button URL (relative or absolute). */
  ctaUrl: string;
}

export type HeroSlide = BannerSlide | EditorialSlide;

// ─── Carousel config ──────────────────────────────────────────────────────────

export interface HeroConfig {
  slides: HeroSlide[];
  /** Auto-rotate between slides. */
  autoRotate: boolean;
  /** Seconds between automatic slide transitions. */
  autoRotateSpeed: number;
  /** Visual style of the slide position indicator. */
  indicatorStyle: 'dots' | 'pill-counter';
  /** Border radius of the carousel container (px). */
  cornerRadius: number;
  /** Left and right margin of the carousel (px). */
  sideMargin: number;
  /** Height of the carousel on desktop (px). */
  height: number;
  /** Height of the carousel on mobile (px). */
  mobileHeight: number;
}

// ─── Default config ───────────────────────────────────────────────────────────
// Matches the SLIDES constant in src/themes/AurusHome.tsx.
// Used as the starting config when a new store opens the editor for the first time.

export const DEFAULT_HERO_CONFIG: HeroConfig = {
  slides: [
    {
      id:        'slide-1',
      type:      'banner',
      isEnabled: true,
      src:       'https://cdn.caratlane.com/media/static/images/V4/2026/06_JUNE/Banner/100_offer/01/Desktop.gif',
      alt:       'Flat 100% Off on Making Charges – All Diamond Designs',
      linkUrl:   '',
    },
    {
      id:             'slide-2',
      type:           'editorial',
      isEnabled:      true,
      backgroundImage: '',
      overlayGradient: { from: '#3B0764', fromAlpha: 88, to: '#6D28D9', toAlpha: 10 },
      eyebrowText:    'New Arrival',
      brandName:      'Ashlesha Thakur',
      headlineL1:     'Our newest sparkle for',
      headlineL2:     '18KT Gold & Silver Diamonds',
      headlineL2Color: '#FEF08A',
      disclaimer:     'Shop stunning diamond designs with Extra ₹500/GM on Digital Gold',
      ctaText:        'READ MORE',
      ctaUrl:         '/jewellery/diamonds',
    },
    {
      id:             'slide-3',
      type:           'editorial',
      isEnabled:      true,
      backgroundImage: '',
      overlayGradient: { from: '#0B2118', fromAlpha: 90, to: '#1B4D3E', toAlpha: 10 },
      eyebrowText:    'Festival Special',
      brandName:      '',
      headlineL1:     'Silver Jewellery',
      headlineL2:     'Upto 50% Off',
      headlineL2Color: '#FEF08A',
      disclaimer:     'Crafted in 925 silver – starting ₹5,000',
      ctaText:        'Shop Silver',
      ctaUrl:         '/jewellery/silver',
    },
  ],
  autoRotate:      true,
  autoRotateSpeed: 4.5,
  indicatorStyle:  'pill-counter',
  cornerRadius:    16,
  sideMargin:      24,
  height:          500,
  mobileHeight:    300,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function generateSlideId(): string {
  return `slide-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function isEditorialSlide(slide: HeroSlide): slide is EditorialSlide {
  return slide.type === 'editorial';
}

export function isBannerSlide(slide: HeroSlide): slide is BannerSlide {
  return slide.type === 'banner';
}

/** Parse raw JSON from the API into HeroConfig, falling back to defaults. */
export function parseHeroConfig(raw: unknown): HeroConfig {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return DEFAULT_HERO_CONFIG;
  const r = raw as Partial<HeroConfig>;
  return {
    slides:          Array.isArray(r.slides) ? r.slides : DEFAULT_HERO_CONFIG.slides,
    autoRotate:      r.autoRotate      ?? DEFAULT_HERO_CONFIG.autoRotate,
    autoRotateSpeed: r.autoRotateSpeed ?? DEFAULT_HERO_CONFIG.autoRotateSpeed,
    indicatorStyle:  r.indicatorStyle  ?? DEFAULT_HERO_CONFIG.indicatorStyle,
    cornerRadius:    r.cornerRadius    ?? DEFAULT_HERO_CONFIG.cornerRadius,
    sideMargin:      r.sideMargin      ?? DEFAULT_HERO_CONFIG.sideMargin,
    height:          r.height          ?? DEFAULT_HERO_CONFIG.height,
    mobileHeight:    r.mobileHeight    ?? DEFAULT_HERO_CONFIG.mobileHeight,
  };
}
