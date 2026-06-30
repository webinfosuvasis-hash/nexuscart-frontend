/**
 * GiftRegistrySection registry entry.
 *
 * A three-column card with a purple gradient background.
 * Left column: headline, occasion chips, CTA.
 * Centre column: decorative emoji cluster (desktop only).
 * Right column: "How it works" steps.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { mergeWithDefaults, safeParseJson } from '../shared/pipeline';
import { validResult } from '../shared/pipeline';
import { UI, SERIF } from '@/themes/aurus/constants';
import type { SectionRegistryEntry, SectionComponentProps, DataResolver, ValidationResult } from '@/themes/registry/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GiftStep {
  icon: string;
  label: string;
  subtitle: string;
}

export interface GiftOccasion {
  label: string;
  emoji: string;
}

export interface GiftRegistryConfig {
  subLabel: string;
  headline: string;
  bodyCopy: string;
  occasions: GiftOccasion[];
  ctaText: string;
  ctaUrl: string;
  socialProof: string;
  steps: GiftStep[];
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT: GiftRegistryConfig = {
  subLabel: 'Celebrate Together',
  headline: 'Create Your\nGift Registry',
  bodyCopy: 'Curate your perfect wishlist for every special moment. Your loved ones will always know exactly what makes you happy.',
  occasions: [
    { label: 'Wedding', emoji: '🤝' },
    { label: 'Puja',    emoji: '🪔' },
    { label: 'Party',   emoji: '✨' },
    { label: 'Office',  emoji: '💼' },
    { label: 'Gift',    emoji: '🎁' },
  ],
  ctaText:     'Start Your Registry →',
  ctaUrl:      '/registry',
  socialProof: '★★★★★ Trusted by 8,500+ families',
  steps: [
    { icon: '📝', label: 'Create Registry',    subtitle: 'Pick your occasion & add your wishlist'  },
    { icon: '🔗', label: 'Share with Family',  subtitle: 'Send a link or share via WhatsApp'       },
    { icon: '🛍', label: 'Friends Gift You',   subtitle: 'They buy directly from your list'        },
    { icon: '✅', label: 'Track Gifts',        subtitle: "See what's been gifted in real time"     },
  ],
};

// ─── Config pipeline ──────────────────────────────────────────────────────────

function parseConfig(raw: unknown): GiftRegistryConfig {
  const parsed = safeParseJson(raw) as Partial<GiftRegistryConfig>;
  const merged = mergeWithDefaults(parsed, DEFAULT);
  if (parsed.occasions && Array.isArray(parsed.occasions) && parsed.occasions.length > 0) {
    merged.occasions = parsed.occasions;
  }
  if (parsed.steps && Array.isArray(parsed.steps) && parsed.steps.length > 0) {
    merged.steps = parsed.steps;
  }
  return merged;
}

function validateConfig(config: GiftRegistryConfig): ValidationResult<GiftRegistryConfig> {
  return validResult(config);
}

// ─── Data Resolver ────────────────────────────────────────────────────────────

const resolveData: DataResolver<GiftRegistryConfig, Record<string, never>> = async (_config, _context) => ({} as Record<string, never>);

// ─── Component ────────────────────────────────────────────────────────────────

const GiftRegistrySection: React.FC<SectionComponentProps<GiftRegistryConfig, Record<string, never>>> = ({ config }) => {
  const { subLabel, headline, bodyCopy, occasions, ctaText, ctaUrl, socialProof, steps } = config;

  return (
    <section className="max-w-[1280px] mx-auto px-4 sm:px-5 py-10">
      <div
        className="rounded-2xl overflow-hidden grid grid-cols-1 md:grid-cols-[1fr_220px_1fr]"
        style={{ background: 'linear-gradient(135deg, #F5F0FF 0%, #EDE9FE 55%, #FAF0FF 100%)' }}
      >
        {/* Left column */}
        <div className="px-8 py-12 md:py-14 flex flex-col justify-center">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.24em] text-purple-400" style={UI}>
            {subLabel}
          </p>
          <h2 className="text-[32px] font-light text-gray-900 mt-1.5 leading-tight" style={SERIF}>
            {headline.split('\n').map((line, i) => (
              <React.Fragment key={i}>
                {i > 0 && <br />}
                {line}
              </React.Fragment>
            ))}
          </h2>
          <p className="text-[13px] text-gray-500 mt-3 leading-loose max-w-[290px]" style={UI}>
            {bodyCopy}
          </p>
          <div className="flex flex-wrap gap-1.5 mt-7">
            {occasions.map(o => (
              <span
                key={o.label}
                className="text-[10.5px] font-semibold bg-white/70 hover:bg-white text-purple-700 border border-purple-200 hover:border-purple-400 px-2.5 py-0.5 rounded-full cursor-default select-none transition-all duration-200 hover:scale-105 hover:shadow-sm inline-block"
                style={UI}
              >
                {o.emoji} {o.label}
              </span>
            ))}
          </div>
          <Link
            to={ctaUrl}
            className="inline-block mt-6 bg-purple-700 hover:bg-purple-800 text-white px-7 py-2.5 rounded-full text-[13px] font-bold tracking-wide transition-colors self-start"
            style={UI}
          >
            {ctaText}
          </Link>
          <div className="mt-3" style={UI}>
            <p className="text-[10px] text-purple-400 font-normal">{socialProof}</p>
            <p className="text-[9.5px] text-gray-300 mt-0.5">Perfect for Weddings, Anniversaries &amp; Festivals</p>
          </div>
        </div>

        {/* Centre column — decorative (desktop only) */}
        <div className="hidden md:flex items-center justify-center relative border-x border-purple-200/10 py-10">
          <div
            className="absolute w-[180px] h-[180px] rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(167,139,250,0.15) 0%, transparent 70%)',
              transform: 'translateY(-16px)',
            }}
          />
          <span className="text-[64px] relative z-10 drop-shadow-sm select-none" style={{ transform: 'translateY(-16px)' }}>🎁</span>
          <span className="absolute top-[22%] left-[20%] text-[20px] opacity-75 drop-shadow-sm select-none">💍</span>
          <span className="absolute top-[20%] right-[20%] text-[18px] opacity-70 select-none">🎀</span>
          <span className="absolute bottom-[24%] left-[18%] text-[18px] opacity-65 select-none">❤️</span>
          <span className="absolute bottom-[22%] right-[18%] text-[16px] opacity-60 select-none">💎</span>
          <span className="absolute top-[47%] left-[10%] text-[11px] opacity-45 select-none">✨</span>
          <span className="absolute top-[47%] right-[10%] text-[11px] opacity-45 select-none">✨</span>
        </div>

        {/* Right column — How it works */}
        <div className="px-8 py-12 md:py-14 flex flex-col justify-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-purple-400 mb-6" style={UI}>
            How it works
          </p>
          <div className="space-y-0">
            {steps.map((step, i) => (
              <div key={step.label}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-white shadow-sm border border-purple-100 flex items-center justify-center text-[18px] flex-shrink-0">
                    {step.icon}
                  </div>
                  <div className="pt-0.5">
                    <p className="text-[12.5px] font-bold text-gray-800 leading-none" style={UI}>{step.label}</p>
                    <p className="text-[10.5px] text-gray-400 mt-0.5 leading-snug" style={UI}>{step.subtitle}</p>
                  </div>
                </div>
                {i < steps.length - 1 && (
                  <div className="ml-[19px] w-px h-6 bg-purple-200 my-1.5" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

// ─── Registry Entry ───────────────────────────────────────────────────────────

export const GiftRegistryEntry: SectionRegistryEntry<GiftRegistryConfig, Record<string, never>> = {
  sectionType:   'gift_registry',
  component:     GiftRegistrySection,
  parseConfig,
  defaultConfig: DEFAULT,
  validateConfig,
  resolveData,
  defaultData:   {} as Record<string, never>,
  meta: {
    label:            'Gift Registry',
    supportsPreview:  true,
    dataRequirements: [],
  },
};
