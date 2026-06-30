/**
 * HeroSection registry entry — wires all pieces into a SectionRegistryEntry.
 *
 * Import and register this in src/themes/aurus/aurus-registry.ts.
 */

import type { SectionRegistryEntry } from '@/themes/registry/types';
import HeroSection              from './HeroSection';
import { parseHeroConfig, DEFAULT_HERO_CONFIG } from './HeroSection.parser';
import { validateHeroConfig }   from './HeroSection.validator';
import { heroResolver }         from './HeroSection.resolver';
import type { HeroConfig, HeroData } from './HeroSection.types';

export const HeroBannerEntry: SectionRegistryEntry<HeroConfig, HeroData> = {
  sectionType:    'hero_banner',
  component:      HeroSection,
  parseConfig:    parseHeroConfig,
  defaultConfig:  DEFAULT_HERO_CONFIG,
  validateConfig: validateHeroConfig,
  resolveData:    heroResolver,
  defaultData:    {},
  meta: {
    label:            'Hero Banner Carousel',
    supportsPreview:  true,
    dataRequirements: [],   // self-contained, no external data
  },
};

// Re-export for convenience
export { HeroSection, parseHeroConfig, DEFAULT_HERO_CONFIG, validateHeroConfig };
export type { HeroConfig, HeroData };
