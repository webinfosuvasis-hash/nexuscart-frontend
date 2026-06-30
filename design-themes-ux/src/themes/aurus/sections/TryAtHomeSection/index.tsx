/**
 * TryAtHomeSection registry entry.
 *
 * Renders BOTH the "Try at Home" card AND the "Video Call" card in a 2-column
 * grid. The VideoCallSection (sortOrder 12) renders null so there is no
 * double-render; this section owns the full dual-card layout that matches V1.
 */

import React from 'react';
import { mergeWithDefaults, safeParseJson } from '../shared/pipeline';
import { validResult } from '../shared/pipeline';
import { UI } from '@/themes/aurus/constants';
import type {
  SectionRegistryEntry,
  SectionComponentProps,
  DataResolver,
  ValidationResult,
} from '@/themes/registry/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ServiceCard {
  backgroundImage: string;
  overlayStyle: 'dark' | 'purple';
  headline: string;
  subheadline?: string;
  ctaText: string;
  ctaUrl: string;
}

export interface TryAtHomeConfig {
  tryAtHome: ServiceCard;
  videoCall: ServiceCard;
}

const DEFAULT: TryAtHomeConfig = {
  tryAtHome: {
    backgroundImage:
      'https://images.unsplash.com/photo-1692992193981-d3d92fabd9cb?auto=format&fit=crop&w=1920&q=80',
    overlayStyle: 'dark',
    headline: 'Unsure About\nWhat Design to Pick?',
    ctaText: 'BOOK A TRIAL AT HOME',
    ctaUrl: '/try-at-home',
  },
  videoCall: {
    backgroundImage:
      'https://images.unsplash.com/photo-1692992193981-d3d92fabd9cb?auto=format&fit=crop&w=1920&q=80',
    overlayStyle: 'purple',
    headline: 'View Designs on\nLive Video Call',
    ctaText: 'SCHEDULE A VIDEO CALL',
    ctaUrl: '/video-call',
  },
};

function parseConfig(raw: unknown): TryAtHomeConfig {
  const parsed = safeParseJson(raw) as Partial<TryAtHomeConfig>;
  return mergeWithDefaults(parsed, DEFAULT);
}

function validateConfig(config: TryAtHomeConfig): ValidationResult<TryAtHomeConfig> {
  return validResult(config);
}

// ─── Data Resolver ────────────────────────────────────────────────────────────

// No external data needed for this section.
const resolveData: DataResolver<TryAtHomeConfig, Record<string, never>> = async () => ({});

// ─── Component ────────────────────────────────────────────────────────────────

const TryAtHomeSection: React.FC<
  SectionComponentProps<TryAtHomeConfig, Record<string, never>>
> = ({ config }) => {
  return (
    <div className="mx-6 sm:mx-8 mt-4 grid grid-cols-2 gap-4">
      {/* Try at Home */}
      <div
        className="relative rounded-2xl overflow-hidden group cursor-pointer"
        style={{ minHeight: '380px' }}
      >
        <img
          src={config.tryAtHome.backgroundImage}
          alt="Try at Home"
          className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />
        <div className="absolute bottom-8 left-7 right-7 z-10">
          <h3 className="text-white text-[26px] font-bold leading-snug" style={UI}>
            {config.tryAtHome.headline.split('\n').map((line, i) => (
              <React.Fragment key={i}>{i > 0 && <br />}{line}</React.Fragment>
            ))}
          </h3>
          <button
            className="mt-5 bg-[#3A3A3A]/80 hover:bg-[#1A1A1A] backdrop-blur-sm text-white text-[11px] font-bold px-6 py-3 tracking-[0.14em] uppercase transition-all duration-200 rounded-sm"
            style={UI}
          >
            {config.tryAtHome.ctaText}
          </button>
        </div>
      </div>

      {/* Video Call */}
      <div
        className="relative rounded-2xl overflow-hidden group cursor-pointer"
        style={{ minHeight: '380px' }}
      >
        <img
          src={config.videoCall.backgroundImage}
          alt="View Designs on Live Video Call"
          className="absolute inset-0 w-full h-full object-cover object-right group-hover:scale-105 transition-transform duration-700"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-purple-950/85 via-purple-900/40 to-purple-800/15" />
        <div className="absolute bottom-8 left-7 right-7 z-10">
          <h3 className="text-white text-[26px] font-bold leading-snug" style={UI}>
            {config.videoCall.headline.split('\n').map((line, i) => (
              <React.Fragment key={i}>{i > 0 && <br />}{line}</React.Fragment>
            ))}
          </h3>
          <button
            className="mt-5 bg-[#3A3A3A]/80 hover:bg-[#1A1A1A] backdrop-blur-sm text-white text-[11px] font-bold px-6 py-3 tracking-[0.14em] uppercase transition-all duration-200 rounded-sm"
            style={UI}
          >
            {config.videoCall.ctaText}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Registry Entry ───────────────────────────────────────────────────────────

export const TryAtHomeEntry: SectionRegistryEntry<TryAtHomeConfig, Record<string, never>> = {
  sectionType:   'try_at_home',
  component:     TryAtHomeSection,
  parseConfig,
  defaultConfig: DEFAULT,
  validateConfig,
  resolveData,
  defaultData:   {},
  meta: {
    label:            'Try at Home + Video Call',
    supportsPreview:  true,
    dataRequirements: [],
  },
};
