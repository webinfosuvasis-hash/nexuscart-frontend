/**
 * TrustBadgesSection registry entry.
 *
 * A 4-column trust badge bar on a purple-50 background.
 * Each badge shows an icon, title, and subtitle.
 */

import React from 'react';
import { Shield, RotateCcw, Star, Phone } from 'lucide-react';
import { mergeWithDefaults, safeParseJson } from '../shared/pipeline';
import { validResult } from '../shared/pipeline';
import type { SectionRegistryEntry, SectionComponentProps, DataResolver, ValidationResult } from '@/themes/registry/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TrustBadge {
  icon: 'shield' | 'rotate-ccw' | 'star' | 'phone';
  title: string;
  subtitle: string;
}

export interface TrustBadgesConfig {
  backgroundColor: string;
  borderColor: string;
  badges: TrustBadge[];
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT: TrustBadgesConfig = {
  backgroundColor: 'bg-purple-50',
  borderColor: 'border-purple-100',
  badges: [
    { icon: 'shield',     title: 'Authentic Fabrics', subtitle: 'Certified handloom & pure weaves' },
    { icon: 'rotate-ccw', title: '15-Day Returns',    subtitle: 'Easy & hassle-free'               },
    { icon: 'star',       title: 'Free Shipping',     subtitle: 'On all orders above ₹999'         },
    { icon: 'phone',      title: '24/7 Support',      subtitle: 'Always here for you'              },
  ],
};

// ─── Config pipeline ──────────────────────────────────────────────────────────

function parseConfig(raw: unknown): TrustBadgesConfig {
  const parsed = safeParseJson(raw) as Partial<TrustBadgesConfig>;
  const merged = mergeWithDefaults(parsed, DEFAULT);
  if (parsed.badges && Array.isArray(parsed.badges) && parsed.badges.length > 0) {
    merged.badges = parsed.badges;
  }
  return merged;
}

function validateConfig(config: TrustBadgesConfig): ValidationResult<TrustBadgesConfig> {
  return validResult(config);
}

// ─── Data Resolver ────────────────────────────────────────────────────────────

const resolveData: DataResolver<TrustBadgesConfig, Record<string, never>> = async (_config, _context) => ({} as Record<string, never>);

// ─── Icon map ─────────────────────────────────────────────────────────────────

const ICON_MAP = {
  'shield':     Shield,
  'rotate-ccw': RotateCcw,
  'star':       Star,
  'phone':      Phone,
} as const;

// ─── Component ────────────────────────────────────────────────────────────────

const TrustBadgesSection: React.FC<SectionComponentProps<TrustBadgesConfig, Record<string, never>>> = ({ config }) => {
  const { badges } = config;

  return (
    <section className="bg-purple-50 border-b border-purple-100 mt-4 mb-10">
      <div className="max-w-[1280px] mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-purple-100">
          {badges.map((badge, i) => {
            const IconComponent = ICON_MAP[badge.icon] ?? Shield;
            return (
              <div key={i} className="flex items-center gap-3 px-4 sm:px-7 py-4">
                <IconComponent className="w-5 h-5 text-purple-600 flex-shrink-0" strokeWidth={1.5} />
                <div>
                  <p className="text-[12.5px] font-semibold text-gray-800">{badge.title}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">{badge.subtitle}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

// ─── Registry Entry ───────────────────────────────────────────────────────────

export const TrustBadgesEntry: SectionRegistryEntry<TrustBadgesConfig, Record<string, never>> = {
  sectionType:   'trust_badges',
  component:     TrustBadgesSection,
  parseConfig,
  defaultConfig: DEFAULT,
  validateConfig,
  resolveData,
  defaultData:   {} as Record<string, never>,
  meta: {
    label:            'Trust Badges',
    supportsPreview:  true,
    dataRequirements: [],
  },
};
