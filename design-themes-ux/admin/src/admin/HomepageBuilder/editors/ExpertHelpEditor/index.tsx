/**
 * ExpertHelpEditor — Store Locator + Expert Help dark panel (Section 15)
 *
 * Light background section with 3 cards:
 *   Left:         Store locator card (dark overlay + image)
 *   Right-top:    Expert Help card (purple)
 *   Right-bottom: Video Call card (dark green)
 */

import React from 'react';
import { SectionEditor } from '../framework/SectionEditor';
import {
  Label, FieldGroup, SectionDivider, TextInput, ColorInput, ImageField, UrlField,
} from '../framework/FormFields';

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

const DEFAULT: ExpertHelpConfig = {
  backgroundColor: '#FAFAF8',
  storeLocator: {
    storeImage: '',
    overlayOpacity: 70,
    storeCountText: '300+ Stores Across India',
    headlineL1: 'Find your favourite designs',
    headlineL2: 'at a Store Nearby',
    ctaText: 'Find a Store',
    ctaUrl: '/store-locator',
  },
  expertCard: {
    backgroundColor: '#4A1D96',
    label: 'Expert Help',
    headline: 'Unsure About What Design to Pick?',
    ctaText: 'Get Help →',
    ctaUrl: '/services/try-at-home',
  },
  videoCard: {
    backgroundColor: '#1B4D3E',
    label: 'Live Video',
    headline: 'View Designs in Live Video Call',
    ctaText: 'Book Call →',
    ctaUrl: '/services/video-call',
  },
};

function parse(raw: unknown): ExpertHelpConfig {
  if (!raw || typeof raw !== 'object') return DEFAULT;
  const r = raw as Partial<ExpertHelpConfig>;
  return {
    backgroundColor: r.backgroundColor ?? DEFAULT.backgroundColor,
    storeLocator:    { ...DEFAULT.storeLocator, ...(r.storeLocator ?? {}) },
    expertCard:      { ...DEFAULT.expertCard,   ...(r.expertCard   ?? {}) },
    videoCard:       { ...DEFAULT.videoCard,    ...(r.videoCard    ?? {}) },
  };
}

// ─── Preview ──────────────────────────────────────────────────────────────────

const Preview: React.FC<{ config: ExpertHelpConfig }> = ({ config }) => {
  const { storeLocator: sl, expertCard: ec, videoCard: vc } = config;
  return (
    <div className="flex gap-1.5 rounded-xl p-1.5" style={{ background: config.backgroundColor, minHeight: '120px' }}>
      <div className="w-1/2 rounded-lg relative overflow-hidden" style={{ background: '#1a1230' }}>
        {sl.storeImage && <img src={sl.storeImage} alt="" className="absolute inset-0 w-full h-full object-cover" style={{ opacity: (100 - sl.overlayOpacity) / 100 }} />}
        <div className="absolute inset-0 bg-black" style={{ opacity: sl.overlayOpacity / 100 }} />
        <div className="relative z-10 p-2 flex flex-col h-full justify-between">
          <p className="text-purple-300 text-[7px] font-semibold">{sl.storeCountText}</p>
          <div>
            <p className="text-white text-[8px] font-light">{sl.headlineL1}</p>
            <p className="text-white text-[8px] font-light">{sl.headlineL2}</p>
            <div className="mt-1 px-2 py-0.5 bg-white text-purple-900 text-[6px] font-bold rounded-sm inline-block">{sl.ctaText}</div>
          </div>
        </div>
      </div>
      <div className="flex-1 flex flex-col gap-1.5">
        <div className="flex-1 rounded-lg p-2 flex flex-col justify-between" style={{ background: ec.backgroundColor }}>
          <p className="text-[7px] font-semibold text-emerald-300 uppercase">{ec.label}</p>
          <div>
            <p className="text-white text-[7px] font-semibold leading-snug">{ec.headline}</p>
            <p className="text-white/80 text-[6px] mt-0.5 border border-white/30 px-1 py-0.5 rounded-sm inline-block">{ec.ctaText}</p>
          </div>
        </div>
        <div className="flex-1 rounded-lg p-2 flex flex-col justify-between" style={{ background: vc.backgroundColor }}>
          <p className="text-[7px] font-semibold text-emerald-300 uppercase">{vc.label}</p>
          <div>
            <p className="text-white text-[7px] font-semibold leading-snug">{vc.headline}</p>
            <p className="text-white/80 text-[6px] mt-0.5 border border-white/30 px-1 py-0.5 rounded-sm inline-block">{vc.ctaText}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Content form ─────────────────────────────────────────────────────────────

const ContentTab: React.FC<{ config: ExpertHelpConfig; onChange: (c: ExpertHelpConfig) => void }> = ({ config, onChange }) => {
  const pSL = (p: Partial<ExpertHelpConfig['storeLocator']>) => onChange({ ...config, storeLocator: { ...config.storeLocator, ...p } });
  const pEC = (p: Partial<ExpertHelpConfig['expertCard']>)   => onChange({ ...config, expertCard:   { ...config.expertCard,   ...p } });
  const pVC = (p: Partial<ExpertHelpConfig['videoCard']>)    => onChange({ ...config, videoCard:    { ...config.videoCard,    ...p } });

  return (
    <div className="space-y-4">
      <FieldGroup><Label>Section background</Label><ColorInput value={config.backgroundColor} onChange={v => onChange({ ...config, backgroundColor: v })} /></FieldGroup>

      <SectionDivider label="Left — Store Locator Card" />
      <FieldGroup><Label>Store image</Label><ImageField value={config.storeLocator.storeImage} onChange={v => pSL({ storeImage: v })} /></FieldGroup>
      <FieldGroup>
        <Label>Image overlay</Label>
        <input type="range" min={0} max={90} step={5} value={config.storeLocator.overlayOpacity}
          onChange={e => pSL({ overlayOpacity: Number(e.target.value) })} className="w-full accent-indigo-600" />
      </FieldGroup>
      <FieldGroup><Label>Store count text</Label><TextInput value={config.storeLocator.storeCountText} onChange={v => pSL({ storeCountText: v })} /></FieldGroup>
      <FieldGroup><Label>Headline line 1</Label><TextInput value={config.storeLocator.headlineL1} onChange={v => pSL({ headlineL1: v })} /></FieldGroup>
      <FieldGroup><Label>Headline line 2</Label><TextInput value={config.storeLocator.headlineL2} onChange={v => pSL({ headlineL2: v })} /></FieldGroup>
      <FieldGroup><Label>CTA text</Label><TextInput value={config.storeLocator.ctaText} onChange={v => pSL({ ctaText: v })} /></FieldGroup>
      <UrlField label="CTA URL" value={config.storeLocator.ctaUrl} onChange={v => pSL({ ctaUrl: v })} />

      <SectionDivider label="Right-Top — Expert Help Card" />
      <FieldGroup><Label>Card colour</Label><ColorInput value={config.expertCard.backgroundColor} onChange={v => pEC({ backgroundColor: v })} /></FieldGroup>
      <FieldGroup><Label>Label</Label><TextInput value={config.expertCard.label} onChange={v => pEC({ label: v })} /></FieldGroup>
      <FieldGroup><Label>Headline</Label><TextInput value={config.expertCard.headline} onChange={v => pEC({ headline: v })} /></FieldGroup>
      <FieldGroup><Label>CTA text</Label><TextInput value={config.expertCard.ctaText} onChange={v => pEC({ ctaText: v })} /></FieldGroup>
      <UrlField label="CTA URL" value={config.expertCard.ctaUrl} onChange={v => pEC({ ctaUrl: v })} />

      <SectionDivider label="Right-Bottom — Video Call Card" />
      <FieldGroup><Label>Card colour</Label><ColorInput value={config.videoCard.backgroundColor} onChange={v => pVC({ backgroundColor: v })} /></FieldGroup>
      <FieldGroup><Label>Label</Label><TextInput value={config.videoCard.label} onChange={v => pVC({ label: v })} /></FieldGroup>
      <FieldGroup><Label>Headline</Label><TextInput value={config.videoCard.headline} onChange={v => pVC({ headline: v })} /></FieldGroup>
      <FieldGroup><Label>CTA text</Label><TextInput value={config.videoCard.ctaText} onChange={v => pVC({ ctaText: v })} /></FieldGroup>
      <UrlField label="CTA URL" value={config.videoCard.ctaUrl} onChange={v => pVC({ ctaUrl: v })} />
    </div>
  );
};

// ─── Editor ───────────────────────────────────────────────────────────────────

const ExpertHelpEditor: React.FC<{ sectionId: string; onBack: () => void }> = ({ sectionId, onBack }) => (
  <SectionEditor<ExpertHelpConfig>
    sectionId={sectionId}
    sectionLabel="Expert Help"
    onBack={onBack}
    defaultConfig={DEFAULT}
    parseConfig={parse}
    renderPreview={(config) => <Preview config={config} />}
    renderContent={(config, onChange) => <ContentTab config={config} onChange={onChange} />}
  />
);

export default ExpertHelpEditor;
