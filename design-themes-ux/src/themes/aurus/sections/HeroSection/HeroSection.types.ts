/**
 * HeroSection types — config schema for the Aurus Hero Banner Carousel.
 *
 * These types are the storefront-side equivalent of the admin editor types
 * defined in admin/src/admin/HomepageBuilder/editors/HeroBannerEditor/types.ts.
 *
 * Both sides must remain in sync: if a field is added to the admin config
 * schema, it must also be added here (and a default provided).
 *
 * The storefront types intentionally duplicate the admin types (not imported)
 * because the storefront and admin are separate apps with separate bundles.
 */

// ─── Slide types ──────────────────────────────────────────────────────────────

/** Pre-designed full-width image — text/design baked into the image */
export interface BannerSlide {
  id:        string;
  type:      'banner';
  isEnabled: boolean;
  src:       string;
  alt:       string;
  linkUrl?:  string;
}

/** Full-bleed lifestyle photo with gradient overlay and HTML text/CTA */
export interface EditorialSlide {
  id:              string;
  type:            'editorial';
  isEnabled:       boolean;
  /** URL of the background photo. Falls back to AURUS_HERO_FALLBACK_BG if empty. */
  backgroundImage: string;
  overlayGradient: {
    from:      string;   // hex color e.g. '#3B0764'
    fromAlpha: number;   // 0–100
    to:        string;   // hex color
    toAlpha:   number;   // 0–100
  };
  eyebrowText?:    string;
  brandName?:      string;
  headlineL1:      string;
  headlineL2?:     string;
  /** Hex color for headlineL2 accent, e.g. '#FEF08A' */
  headlineL2Color?: string;
  disclaimer?:     string;
  ctaText:         string;
  ctaUrl:          string;
}

export type HeroSlide = BannerSlide | EditorialSlide;

// ─── Carousel config ──────────────────────────────────────────────────────────

export interface HeroConfig {
  slides:          HeroSlide[];
  autoRotate:      boolean;
  autoRotateSpeed: number;    // seconds, default 4.5
  indicatorStyle:  'pill-counter' | 'dots';
  cornerRadius:    number;    // px, default 16
  sideMargin:      number;    // px, default 24
  height:          number;    // px desktop, default 500
  mobileHeight:    number;    // px mobile, default 300
}

/** HeroSection needs no external data — fully self-contained */
export type HeroData = Record<string, never>;

// ─── Type guards ──────────────────────────────────────────────────────────────

export function isBannerSlide(slide: HeroSlide): slide is BannerSlide {
  return slide.type === 'banner';
}

export function isEditorialSlide(slide: HeroSlide): slide is EditorialSlide {
  return slide.type === 'editorial';
}

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Fallback background image for editorial slides when no custom image is set.
 * Matches HERO_IMAGES.aurus from src/data/products.ts to ensure V2 renders
 * identically to V1 when using the default (unseeded) config.
 */
export const AURUS_HERO_FALLBACK_BG =
  'https://images.unsplash.com/photo-1692992193981-d3d92fabd9cb?auto=format&fit=crop&w=1920&q=80';
