/**
 * ExpertHelpSection registry entry.
 *
 * Split panel: store locator image card (left) + help/video service cards (right).
 * sectionType: 'expert_help'
 */

import React from 'react';
import { Store, Home, Video, type LucideIcon } from 'lucide-react';
import { mergeWithDefaults, safeParseJson, validResult } from '../shared/pipeline';
import { UI, SERIF } from '@/themes/aurus/constants';
import { prefersDarkText, readableTextOn } from '../shared/contrast';
import type {
  SectionRegistryEntry,
  SectionComponentProps,
  DataResolver,
  ValidationResult,
} from '@/themes/registry/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExpertHelpConfig {
  backgroundColor: string;
  storeLocator: {
    storeImage: string;
    overlayOpacity: number;
    storeCountText: string;
    headlineL1: string;
    headlineL2: string;
    ctaText: string;
    ctaUrl: string;
  };
  expertCard: {
    backgroundColor: string;
    label: string;
    headline: string;
    ctaText: string;
    ctaUrl: string;
  };
  videoCard: {
    backgroundColor: string;
    label: string;
    headline: string;
    ctaText: string;
    ctaUrl: string;
  };
}

export interface ExpertHelpData {
  storeImage: string;
}

// ─── Default config ───────────────────────────────────────────────────────────
// Mirrors admin/src/admin/HomepageBuilder/editors/ExpertHelpEditor — the config
// shape MUST stay identical to the editor's, or saved edits won't apply here.

const DEFAULT: ExpertHelpConfig = {
  backgroundColor: '#FAFAF8',
  storeLocator: {
    storeImage: '',
    overlayOpacity: 70,
    storeCountText: '300+ Stores Across India',
    headlineL1: 'Find your favourite designs',
    headlineL2: 'at a Store Nearby',
    ctaText: 'Find a Store',
    ctaUrl: '/pages/contact-us',
  },
  expertCard: {
    backgroundColor: '#4A1D96',
    label: 'Expert Help',
    headline: 'Unsure About What Design to Pick?',
    ctaText: 'Get Help →',
    ctaUrl: '/pages/contact-us',
  },
  videoCard: {
    backgroundColor: '#1B4D3E',
    label: 'Live Video',
    headline: 'View Designs in Live Video Call',
    ctaText: 'Book Call →',
    ctaUrl: '/pages/contact-us',
  },
};

function parseConfig(raw: unknown): ExpertHelpConfig {
  const parsed = safeParseJson(raw) as Partial<ExpertHelpConfig>;
  return mergeWithDefaults(parsed, DEFAULT);
}

function validateConfig(config: ExpertHelpConfig): ValidationResult<ExpertHelpConfig> {
  return validResult(config);
}

// ─── Data Resolver ────────────────────────────────────────────────────────────

const resolveData: DataResolver<ExpertHelpConfig, ExpertHelpData> = async (
  config,
  context,
) => {
  if (config.storeLocator.storeImage) {
    return { storeImage: config.storeLocator.storeImage };
  }
  const storeImage = context.demoAssets.getProductImages(1)[0]?.image ?? '';
  return { storeImage };
};

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Help / video service card. Its background is merchant-configured, so text
 * and accent colours follow it: designed for a dark card, a pale one (as on
 * the live store) gets dark text instead of invisible white.
 */
const ServiceCard: React.FC<{
  background: string;
  label: string;
  headline: string;
  ctaUrl: string;
  ctaText: string;
  Icon: LucideIcon;
  accent: { onDark: string; onLight: string };
}> = ({ background, label, headline, ctaUrl, ctaText, Icon, accent }) => {
  const dark = prefersDarkText(background);
  const accentColor = dark ? accent.onLight : accent.onDark;
  return (
    <div
      className="rounded-sm p-7 flex items-center gap-5 flex-1"
      style={{ background, color: readableTextOn(background) }}
    >
      <div className="flex-1">
        <p
          className="text-[10px] tracking-[0.3em] uppercase font-semibold"
          style={{ ...UI, color: accentColor }}
        >
          {label}
        </p>
        <h4 className="text-lg font-semibold mt-1 leading-snug" style={UI}>
          {headline}
        </h4>
        <a
          href={ctaUrl}
          className={`inline-block mt-3 border px-4 py-1.5 text-[11px] font-semibold rounded-sm transition-colors ${
            dark ? 'border-gray-800/40 hover:bg-black/5' : 'border-white/50 hover:bg-white/20'}`}
          style={UI}
        >
          {ctaText}
        </a>
      </div>
      <Icon
        className="w-10 h-10 flex-shrink-0"
        strokeWidth={1}
        style={{ color: accentColor }}
      />
    </div>
  );
};

const ExpertHelpSection: React.FC<
  SectionComponentProps<ExpertHelpConfig, ExpertHelpData>
> = ({ config, data }) => {
  const { storeLocator: sl, expertCard: ec, videoCard: vc } = config;

  return (
    <section className="border-t border-gray-200 py-12" style={{ background: config.backgroundColor }}>
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 grid md:grid-cols-2 gap-5">
        {/* Left: store locator card */}
        <div className="relative rounded-sm overflow-hidden min-h-[200px]">
          <img
            src={data.storeImage || sl.storeImage}
            alt="store"
            className="w-full h-full object-cover absolute inset-0"
            style={{ opacity: (100 - sl.overlayOpacity) / 100 }}
          />
          <div className="absolute inset-0 bg-[#1a1230]" style={{ opacity: sl.overlayOpacity / 100 }} />
          <div className="relative z-10 p-8 flex flex-col h-full justify-between min-h-[200px]">
            <div>
              <p
                className="text-purple-300 text-[10px] tracking-[0.35em] uppercase font-semibold"
                style={UI}
              >
                {sl.storeCountText}
              </p>
              <h3 className="text-white text-2xl font-light mt-2 leading-snug" style={SERIF}>
                {sl.headlineL1}
                {sl.headlineL2 && <><br />{sl.headlineL2}</>}
              </h3>
            </div>
            <a
              href={sl.ctaUrl}
              className="inline-flex items-center gap-2 mt-6 bg-white text-purple-900 hover:bg-purple-50 px-5 py-2.5 text-[12px] font-bold tracking-wide transition-colors rounded-sm self-start"
              style={UI}
            >
              <Store className="w-4 h-4" />
              {sl.ctaText}
            </a>
          </div>
        </div>

        {/* Right: help + video service cards */}
        <div className="flex flex-col gap-4">
          <ServiceCard
            background={ec.backgroundColor}
            label={ec.label}
            headline={ec.headline}
            ctaUrl={ec.ctaUrl}
            ctaText={ec.ctaText}
            Icon={Home}
            accent={{ onDark: 'rgba(216,180,254,1)', onLight: '#7e22ce' }}
          />
          <ServiceCard
            background={vc.backgroundColor}
            label={vc.label}
            headline={vc.headline}
            ctaUrl={vc.ctaUrl}
            ctaText={vc.ctaText}
            Icon={Video}
            accent={{ onDark: 'rgba(110,231,183,1)', onLight: '#047857' }}
          />
        </div>
      </div>
    </section>
  );
};

// ─── Registry Entry ───────────────────────────────────────────────────────────

export const ExpertHelpEntry: SectionRegistryEntry<ExpertHelpConfig, ExpertHelpData> = {
  sectionType: 'expert_help',
  component: ExpertHelpSection,
  parseConfig,
  defaultConfig: DEFAULT,
  validateConfig,
  resolveData,
  defaultData: { storeImage: '' },
  meta: {
    label: 'Expert Help',
    supportsPreview: true,
    dataRequirements: [],
  },
};
