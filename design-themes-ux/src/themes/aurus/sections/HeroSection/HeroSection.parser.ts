/**
 * HeroSection parser — Parse → Merge → Default config for the hero carousel.
 *
 * DEFAULT_HERO_CONFIG is the canonical "first run" state.
 * It exactly matches the current hardcoded SLIDES in AurusHome.tsx so that
 * a store with an unseeded homepage builder renders identically in V2 as in V1.
 */

import { safeParseJson, mergeWithDefaults } from '../shared/pipeline';
import type { HeroConfig, HeroSlide } from './HeroSection.types';
import { AURUS_HERO_FALLBACK_BG } from './HeroSection.types';

// ─── Default config (matches current AurusHome.tsx SLIDES exactly) ────────────

export const DEFAULT_HERO_CONFIG: HeroConfig = {
  slides: [
    {
      id:        'default-slide-1',
      type:      'banner',
      isEnabled: true,
      src:       'https://cdn.caratlane.com/media/static/images/V4/2026/06_JUNE/Banner/100_offer/01/Desktop.gif',
      alt:       'Flat 100% Off on Making Charges – All Diamond Designs',
      linkUrl:   '',
    },
    {
      id:              'default-slide-2',
      type:            'editorial',
      isEnabled:       true,
      backgroundImage: AURUS_HERO_FALLBACK_BG,
      overlayGradient: { from: '#3B0764', fromAlpha: 88, to: '#6D28D9', toAlpha: 10 },
      eyebrowText:     'New Arrival',
      brandName:       'Ashlesha Thakur',
      headlineL1:      'Our newest sparkle for',
      headlineL2:      '18KT Gold & Silver Diamonds',
      headlineL2Color: '#FEF08A',
      disclaimer:      'Shop stunning diamond designs with Extra ₹500/GM on Digital Gold',
      ctaText:         'READ MORE',
      ctaUrl:          '/jewellery/diamonds',
    },
    {
      id:              'default-slide-3',
      type:            'editorial',
      isEnabled:       true,
      backgroundImage: AURUS_HERO_FALLBACK_BG,
      overlayGradient: { from: '#0B2118', fromAlpha: 90, to: '#1B4D3E', toAlpha: 10 },
      eyebrowText:     'Festival Special',
      brandName:       '',
      headlineL1:      'Silver Jewellery',
      headlineL2:      'Upto 50% Off',
      headlineL2Color: '#FEF08A',
      disclaimer:      'Crafted in 925 silver – starting ₹5,000',
      ctaText:         'Shop Silver',
      ctaUrl:          '/jewellery/silver',
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

// ─── Default slide shapes (used by mergeWithDefaults for nested slides) ───────

const DEFAULT_BANNER_SLIDE = {
  id: '', type: 'banner' as const, isEnabled: true, src: '', alt: '', linkUrl: '',
};

const DEFAULT_EDITORIAL_SLIDE = {
  id:              '',
  type:            'editorial' as const,
  isEnabled:       true,
  backgroundImage: AURUS_HERO_FALLBACK_BG,
  overlayGradient: { from: '#3B0764', fromAlpha: 80, to: '#6D28D9', toAlpha: 10 },
  eyebrowText:     '',
  brandName:       '',
  headlineL1:      '',
  headlineL2:      '',
  headlineL2Color: '#FEF08A',
  disclaimer:      '',
  ctaText:         'Shop Now',
  ctaUrl:          '/',
};

// ─── Parser ───────────────────────────────────────────────────────────────────

/**
 * Parse raw JSON from BuilderSection.config into typed HeroConfig.
 * Applies mergeWithDefaults at every level — the component is guaranteed
 * to receive a complete, typed config with no undefined fields.
 */
export function parseHeroConfig(raw: unknown): HeroConfig {
  const parsed = safeParseJson(raw) as Partial<HeroConfig>;

  // Merge top-level fields with defaults
  const merged = mergeWithDefaults(parsed, DEFAULT_HERO_CONFIG);

  // Deep-merge each slide with its type-specific defaults
  const slides: HeroSlide[] = Array.isArray(merged.slides) && merged.slides.length > 0
    ? merged.slides.map((slide: Partial<HeroSlide>) => {
        if (slide.type === 'editorial') {
          return mergeWithDefaults(slide as Partial<typeof DEFAULT_EDITORIAL_SLIDE>, DEFAULT_EDITORIAL_SLIDE);
        }
        return mergeWithDefaults(slide as Partial<typeof DEFAULT_BANNER_SLIDE>, DEFAULT_BANNER_SLIDE);
      })
    : DEFAULT_HERO_CONFIG.slides;

  return { ...merged, slides };
}
