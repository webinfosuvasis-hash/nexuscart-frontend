/**
 * TryAtHomeEditor — Try at Home Service Card (Section 11)
 *
 * Full-height dark image card with gradient overlay and "Book a Trial" CTA.
 * Appears as the left card in the dual service card pair.
 */

import React from 'react';
import { SectionEditor } from '../framework/SectionEditor';
import { Label, FieldGroup, SectionDivider, TextInput, ImageField, UrlField, Hint } from '../framework/FormFields';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TryAtHomeConfig {
  backgroundImage: string;
  headlineL1: string;
  headlineL2: string;
  ctaText: string;
  ctaUrl: string;
}

const DEFAULT: TryAtHomeConfig = {
  backgroundImage: '',
  headlineL1: 'Unsure About',
  headlineL2: 'What Design to Pick?',
  ctaText: 'BOOK A TRIAL AT HOME',
  ctaUrl: '/services/try-at-home',
};

function parse(raw: unknown): TryAtHomeConfig {
  if (!raw || typeof raw !== 'object') return DEFAULT;
  return { ...DEFAULT, ...(raw as Partial<TryAtHomeConfig>) };
}

// ─── Preview ──────────────────────────────────────────────────────────────────

const Preview: React.FC<{ config: TryAtHomeConfig }> = ({ config }) => (
  <div className="relative rounded-2xl overflow-hidden" style={{ minHeight: '200px' }}>
    {config.backgroundImage
      ? <img src={config.backgroundImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
      : <div className="absolute inset-0 bg-gradient-to-br from-slate-600 to-slate-900" />
    }
    <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.25) 55%, rgba(0,0,0,0.08) 100%)' }} />
    <div className="absolute bottom-4 left-4 right-4 z-10">
      <p className="text-white text-sm font-bold leading-snug">{config.headlineL1}</p>
      <p className="text-white text-sm font-bold leading-snug">{config.headlineL2}</p>
      <div className="mt-2 inline-block px-3 py-1.5 bg-white/15 border border-white/30 text-white text-[10px] font-bold tracking-wider rounded-sm">
        {config.ctaText}
      </div>
    </div>
  </div>
);

// ─── Content form ─────────────────────────────────────────────────────────────

const ContentTab: React.FC<{ config: TryAtHomeConfig; onChange: (c: TryAtHomeConfig) => void }> = ({ config, onChange }) => (
  <div className="space-y-4">
    <SectionDivider label="Background" />
    <FieldGroup>
      <Label>Lifestyle image</Label>
      <ImageField value={config.backgroundImage} onChange={backgroundImage => onChange({ ...config, backgroundImage })} />
      <Hint>Dark gradient overlay is applied automatically. Lifestyle or model shots work best.</Hint>
    </FieldGroup>

    <SectionDivider label="Text" />
    <FieldGroup><Label>Headline line 1</Label><TextInput value={config.headlineL1} onChange={headlineL1 => onChange({ ...config, headlineL1 })} /></FieldGroup>
    <FieldGroup><Label>Headline line 2</Label><TextInput value={config.headlineL2} onChange={headlineL2 => onChange({ ...config, headlineL2 })} /></FieldGroup>

    <SectionDivider label="CTA Button" />
    <FieldGroup><Label>Button text</Label><TextInput value={config.ctaText} onChange={ctaText => onChange({ ...config, ctaText })} /></FieldGroup>
    <UrlField label="Button URL" value={config.ctaUrl} onChange={ctaUrl => onChange({ ...config, ctaUrl })} />
    <Hint>This service setting also controls the Try at Home badge on product pages and the Services dropdown in the header.</Hint>
  </div>
);

// ─── Editor ───────────────────────────────────────────────────────────────────

const TryAtHomeEditor: React.FC<{ sectionId: string; onBack: () => void }> = ({ sectionId, onBack }) => (
  <SectionEditor<TryAtHomeConfig>
    sectionId={sectionId}
    sectionLabel="Try at Home"
    onBack={onBack}
    defaultConfig={DEFAULT}
    parseConfig={parse}
    renderPreview={(config) => <Preview config={config} />}
    renderContent={(config, onChange) => <ContentTab config={config} onChange={onChange} />}
  />
);

export default TryAtHomeEditor;
