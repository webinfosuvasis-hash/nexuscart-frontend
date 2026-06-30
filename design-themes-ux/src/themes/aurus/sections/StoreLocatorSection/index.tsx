/**
 * StoreLocatorSection registry entry.
 *
 * A split-panel section: left side shows a background image with a play button overlay,
 * right side shows a headline, pincode/city input, and CTA button.
 */

import React from 'react';
import { MapPin } from 'lucide-react';
import { mergeWithDefaults, safeParseJson } from '../shared/pipeline';
import { validResult } from '../shared/pipeline';
import { UI } from '@/themes/aurus/constants';
import type { SectionRegistryEntry, SectionComponentProps, DataResolver, ValidationResult } from '@/themes/registry/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StoreLocatorConfig {
  backgroundImage: string;
  headline: string;
  headlineColor: string;
  panelBackgroundColor: string;
  inputPlaceholder: string;
  ctaText: string;
  ctaColor: string;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT: StoreLocatorConfig = {
  backgroundImage:      'https://images.unsplash.com/photo-1692992193981-d3d92fabd9cb?auto=format&fit=crop&w=1920&q=80',
  headline:             'Find your favorite designs\nat a Store Nearby',
  headlineColor:        '#2D1B6E',
  panelBackgroundColor: '#FDEAE0',
  inputPlaceholder:     'Enter Pincode or City',
  ctaText:              'CHANGE',
  ctaColor:             '#E8630A',
};

// ─── Config pipeline ──────────────────────────────────────────────────────────

function parseConfig(raw: unknown): StoreLocatorConfig {
  const parsed = safeParseJson(raw) as Partial<StoreLocatorConfig>;
  return mergeWithDefaults(parsed, DEFAULT);
}

function validateConfig(config: StoreLocatorConfig): ValidationResult<StoreLocatorConfig> {
  return validResult(config);
}

// ─── Data Resolver ────────────────────────────────────────────────────────────

const resolveData: DataResolver<StoreLocatorConfig, Record<string, never>> = async (_config, _context) => ({} as Record<string, never>);

// ─── Component ────────────────────────────────────────────────────────────────

const StoreLocatorSection: React.FC<SectionComponentProps<StoreLocatorConfig, Record<string, never>>> = ({ config }) => {
  return (
    <section
      className="mx-6 sm:mx-8 mt-4 rounded-2xl overflow-hidden flex flex-col md:flex-row"
      style={{ minHeight: '340px' }}
    >
      {/* Left: image panel with play button overlay */}
      <div className="md:w-1/2 relative overflow-hidden min-h-[240px] md:min-h-0 bg-gray-900">
        <img
          src={config.backgroundImage}
          alt="Find a store near you"
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-black/15" />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-14 h-14 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center border border-white/50">
            <div
              className="w-0 h-0 ml-1"
              style={{
                borderTop:    '10px solid transparent',
                borderBottom: '10px solid transparent',
                borderLeft:   '16px solid white',
              }}
            />
          </div>
        </div>
      </div>

      {/* Right: search panel */}
      <div
        className="md:w-1/2 flex flex-col items-center justify-center px-10 py-12"
        style={{ background: config.panelBackgroundColor }}
      >
        <h2
          className="text-[28px] sm:text-[30px] font-bold text-center leading-snug"
          style={{ ...UI, color: config.headlineColor }}
        >
          {config.headline.split('\n').map((line, i) => (
            <React.Fragment key={i}>
              {i > 0 && <br />}
              {line}
            </React.Fragment>
          ))}
        </h2>
        <div className="mt-8 w-full max-w-[420px]">
          <div className="flex items-center bg-white rounded-full border border-gray-200 px-4 py-3.5 shadow-sm">
            <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0 mr-2.5" />
            <input
              type="text"
              placeholder={config.inputPlaceholder}
              className="flex-1 text-[14px] outline-none text-gray-600 placeholder-gray-400 bg-transparent"
              style={UI}
            />
            <button
              className="text-[13px] font-bold ml-3 flex-shrink-0 hover:opacity-70 transition-opacity"
              style={{ ...UI, color: config.ctaColor }}
            >
              {config.ctaText}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

// ─── Registry Entry ───────────────────────────────────────────────────────────

export const StoreLocatorEntry: SectionRegistryEntry<StoreLocatorConfig, Record<string, never>> = {
  sectionType:   'store_locator',
  component:     StoreLocatorSection,
  parseConfig,
  defaultConfig: DEFAULT,
  validateConfig,
  resolveData,
  defaultData:   {} as Record<string, never>,
  meta: {
    label:            'Store Locator',
    supportsPreview:  true,
    dataRequirements: [],
  },
};
