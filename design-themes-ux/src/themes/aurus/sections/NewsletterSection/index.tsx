/**
 * NewsletterSection registry entry.
 *
 * Email signup section with a purple gradient background.
 * Configurable headline, body copy, CTA button, and privacy policy link.
 */

import React from 'react';
import { mergeWithDefaults, safeParseJson } from '../shared/pipeline';
import { validResult } from '../shared/pipeline';
import { UI, SERIF } from '@/themes/aurus/constants';
import type { SectionRegistryEntry, SectionComponentProps, DataResolver, ValidationResult } from '@/themes/registry/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NewsletterConfig {
  gradientFrom: string;
  gradientTo: string;
  label: string;
  headline: string;
  bodyCopy: string;
  inputPlaceholder: string;
  ctaText: string;
  ctaButtonColor: string;
  ctaTextColor: string;
  privacyText: string;
  privacyUrl: string;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT: NewsletterConfig = {
  gradientFrom:     '#581C87',
  gradientTo:       '#6D28D9',
  label:            'Exclusive Access',
  headline:         'Join Aurus Insider',
  bodyCopy:         'Get exclusive offers, early access to new collections, and personalised jewellery recommendations.',
  inputPlaceholder: 'Enter your email address',
  ctaText:          'JOIN NOW',
  ctaButtonColor:   '#FFFFFF',
  ctaTextColor:     '#581C87',
  privacyText:      'By subscribing, you agree to our Privacy Policy',
  privacyUrl:       '/privacy-policy',
};

// ─── Config pipeline ──────────────────────────────────────────────────────────

function parseConfig(raw: unknown): NewsletterConfig {
  const parsed = safeParseJson(raw) as Partial<NewsletterConfig>;
  return mergeWithDefaults(parsed, DEFAULT);
}

function validateConfig(config: NewsletterConfig): ValidationResult<NewsletterConfig> {
  return validResult(config);
}

// ─── Data Resolver ────────────────────────────────────────────────────────────

const resolveData: DataResolver<NewsletterConfig, Record<string, never>> = async (_config, _context) => ({} as Record<string, never>);

// ─── Component ────────────────────────────────────────────────────────────────

const NewsletterSection: React.FC<SectionComponentProps<NewsletterConfig, Record<string, never>>> = ({ config }) => {
  return (
    <section
      style={{ background: `linear-gradient(to bottom right, ${config.gradientFrom}, ${config.gradientTo})` }}
      className="py-14"
    >
      <div className="max-w-[560px] mx-auto px-4 text-center">
        <p className="text-purple-300 text-[10px] tracking-[0.45em] uppercase font-semibold" style={UI}>
          {config.label}
        </p>
        <h3 className="text-white text-2xl sm:text-3xl font-light mt-3" style={SERIF}>
          {config.headline}
        </h3>
        <p className="text-purple-200 text-[13px] mt-3 leading-relaxed" style={UI}>
          {config.bodyCopy}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 mt-7">
          <input
            placeholder={config.inputPlaceholder}
            className="flex-1 px-4 py-3 rounded-sm text-[13px] outline-none text-gray-900 placeholder-gray-400 border-2 border-transparent focus:border-purple-300"
            style={UI}
          />
          <button
            className="px-7 py-3 text-[13px] font-bold tracking-wide transition-colors rounded-sm flex-shrink-0"
            style={{ ...UI, background: config.ctaButtonColor, color: config.ctaTextColor }}
          >
            {config.ctaText}
          </button>
        </div>
        <a href={config.privacyUrl} className="block text-purple-400 text-[11px] mt-4" style={UI}>
          {config.privacyText}
        </a>
      </div>
    </section>
  );
};

// ─── Registry Entry ───────────────────────────────────────────────────────────

export const NewsletterEntry: SectionRegistryEntry<NewsletterConfig, Record<string, never>> = {
  sectionType:   'newsletter',
  component:     NewsletterSection,
  parseConfig,
  defaultConfig: DEFAULT,
  validateConfig,
  resolveData,
  defaultData:   {} as Record<string, never>,
  meta: {
    label:            'Newsletter',
    supportsPreview:  true,
    dataRequirements: [],
  },
};
