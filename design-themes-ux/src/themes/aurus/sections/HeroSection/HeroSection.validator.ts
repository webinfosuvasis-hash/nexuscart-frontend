/**
 * HeroSection validator — field-level config validation.
 *
 * Validation never blocks rendering. If errors are found:
 *   - They are logged in development
 *   - The section renders with the merged (possibly-invalid) config
 *   - Customers see the best available output rather than a crash
 */

import { validResult, invalidResult } from '../shared/pipeline';
import type { ValidationResult } from '@/themes/registry/types';
import type { HeroConfig } from './HeroSection.types';
import { isBannerSlide, isEditorialSlide } from './HeroSection.types';

export function validateHeroConfig(config: HeroConfig): ValidationResult<HeroConfig> {
  const errors:   Record<string, string> = {};
  const warnings: Record<string, string> = {};

  // Must have at least one enabled slide
  const enabledSlides = config.slides.filter(s => s.isEnabled);
  if (enabledSlides.length === 0) {
    warnings['slides'] = 'No slides are enabled. The hero section will not render.';
  }

  // Validate each slide
  config.slides.forEach((slide, idx) => {
    const prefix = `slides[${idx}]`;

    if (isBannerSlide(slide)) {
      if (!slide.src) {
        warnings[`${prefix}.src`] = 'Banner slide has no image URL — it will show a blank area.';
      }
    }

    if (isEditorialSlide(slide)) {
      if (!slide.headlineL1?.trim()) {
        errors[`${prefix}.headlineL1`] = 'Headline is required for editorial slides.';
      }
      if (!slide.ctaText?.trim()) {
        warnings[`${prefix}.ctaText`] = 'CTA text is empty — the button will have no label.';
      }
      if (slide.ctaUrl && !slide.ctaUrl.startsWith('/') && !slide.ctaUrl.startsWith('http')) {
        warnings[`${prefix}.ctaUrl`] = 'CTA URL should start with / (relative) or https:// (absolute).';
      }
    }
  });

  if (config.autoRotateSpeed < 1 || config.autoRotateSpeed > 30) {
    warnings['autoRotateSpeed'] = 'Auto-rotate speed should be between 1 and 30 seconds.';
  }

  const hasErrors = Object.keys(errors).length > 0;
  if (hasErrors || Object.keys(warnings).length > 0) {
    if (import.meta.env.DEV) {
      if (hasErrors) console.warn('[HeroSection] Config validation errors:', errors);
      if (Object.keys(warnings).length > 0) console.warn('[HeroSection] Config warnings:', warnings);
    }
    return invalidResult(config, errors, warnings);
  }

  return validResult(config);
}
