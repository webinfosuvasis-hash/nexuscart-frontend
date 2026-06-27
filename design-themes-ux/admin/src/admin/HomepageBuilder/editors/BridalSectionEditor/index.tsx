/**
 * BridalSectionEditor — Bridal Section (Section 8)
 *
 * Split panel: editorial bridal photo on the left with text overlay,
 * lavender product carousel on the right.
 * Same structural pattern as Featured Products.
 */

import React from 'react';
import { SectionEditor } from '../framework/SectionEditor';
import {
  Label, FieldGroup, SectionDivider, TextInput, ColorInput, ImageField, UrlField,
} from '../framework/FormFields';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BridalSectionConfig {
  leftPanel: {
    backgroundImage: string;
    overlayOpacity: number;
    headlineL1: string;
    headlineL2: string;
    ctaText: string;
    ctaUrl: string;
  };
  rightPanel: {
    backgroundColor: string;
    productSource: 'tag' | 'category' | 'manual';
    tag: string;
    categorySlug: string;
    productIds: string;
    maxProducts: number;
    ctaText: string;
    ctaUrl: string;
    arrowColor: string;
  };
}

const DEFAULT: BridalSectionConfig = {
  leftPanel: {
    backgroundImage: '',
    overlayOpacity: 40,
    headlineL1: 'For the bride squad',
    headlineL2: '& all the wedding glam',
    ctaText: 'SHOP NOW ▶',
    ctaUrl: '/jewellery/bridal',
  },
  rightPanel: {
    backgroundColor: '#EDE0FF',
    productSource: 'tag',
    tag: 'Bridal',
    categorySlug: '',
    productIds: '',
    maxProducts: 12,
    ctaText: 'Shop Now',
    ctaUrl: '/jewellery/bridal',
    arrowColor: '#6D28D9',
  },
};

function parse(raw: unknown): BridalSectionConfig {
  if (!raw || typeof raw !== 'object') return DEFAULT;
  const r = raw as Partial<BridalSectionConfig>;
  return {
    leftPanel:  { ...DEFAULT.leftPanel,  ...(r.leftPanel  ?? {}) },
    rightPanel: { ...DEFAULT.rightPanel, ...(r.rightPanel ?? {}) },
  };
}

// ─── Preview ──────────────────────────────────────────────────────────────────

const Preview: React.FC<{ config: BridalSectionConfig }> = ({ config }) => {
  const { leftPanel: l, rightPanel: r } = config;
  return (
    <div className="flex rounded-2xl overflow-hidden" style={{ minHeight: '160px' }}>
      <div className="w-1/2 relative" style={{ background: 'linear-gradient(145deg, #F9E4D4, #E8C5A0)' }}>
        {l.backgroundImage && (
          <img src={l.backgroundImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-black" style={{ opacity: l.overlayOpacity / 100 }} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        <div className="absolute bottom-2 left-2 z-10">
          <p className="text-white/90 text-[9px] italic">{l.headlineL1}</p>
          <p className="text-white/80 text-[8px] italic">{l.headlineL2}</p>
          <p className="text-white text-[7px] font-bold mt-0.5">{l.ctaText}</p>
        </div>
      </div>
      <div className="flex-1 p-2 flex flex-col justify-between" style={{ background: r.backgroundColor }}>
        <div className="flex gap-1">
          {[0,1,2,3].map(i => (
            <div key={i} className="flex-1 aspect-square bg-white rounded-lg shadow-sm border border-purple-100" />
          ))}
        </div>
        <div className="flex items-center justify-between mt-2">
          <div className="flex gap-1">
            <div className="w-5 h-5 rounded-full" style={{ background: r.arrowColor }} />
            <div className="w-5 h-5 rounded-full" style={{ background: r.arrowColor }} />
          </div>
          <div className="px-3 py-1 rounded-full text-white text-[8px] font-bold" style={{ background: r.arrowColor }}>
            {r.ctaText}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Content form ─────────────────────────────────────────────────────────────

const ContentTab: React.FC<{ config: BridalSectionConfig; onChange: (c: BridalSectionConfig) => void }> = ({ config, onChange }) => {
  const pL = (p: Partial<BridalSectionConfig['leftPanel']>)  => onChange({ ...config, leftPanel:  { ...config.leftPanel,  ...p } });
  const pR = (p: Partial<BridalSectionConfig['rightPanel']>) => onChange({ ...config, rightPanel: { ...config.rightPanel, ...p } });

  return (
    <div className="space-y-4">
      <SectionDivider label="Left Panel (Bridal Editorial)" />
      <FieldGroup>
        <Label>Background photo</Label>
        <ImageField value={config.leftPanel.backgroundImage} onChange={v => pL({ backgroundImage: v })} />
      </FieldGroup>
      <FieldGroup>
        <Label>Image overlay</Label>
        <input type="range" min={0} max={70} step={5} value={config.leftPanel.overlayOpacity}
          onChange={e => pL({ overlayOpacity: Number(e.target.value) })} className="w-full accent-indigo-600" />
      </FieldGroup>
      <FieldGroup><Label>Headline line 1</Label><TextInput value={config.leftPanel.headlineL1} onChange={v => pL({ headlineL1: v })} /></FieldGroup>
      <FieldGroup><Label>Headline line 2</Label><TextInput value={config.leftPanel.headlineL2} onChange={v => pL({ headlineL2: v })} /></FieldGroup>
      <FieldGroup><Label>CTA text</Label><TextInput value={config.leftPanel.ctaText} onChange={v => pL({ ctaText: v })} /></FieldGroup>
      <UrlField label="CTA URL" value={config.leftPanel.ctaUrl} onChange={v => pL({ ctaUrl: v })} />

      <SectionDivider label="Right Panel (Product Carousel)" />
      <FieldGroup><Label>Background colour</Label><ColorInput value={config.rightPanel.backgroundColor} onChange={v => pR({ backgroundColor: v })} /></FieldGroup>
      <FieldGroup>
        <Label>Product source</Label>
        <div className="flex gap-1.5">
          {(['tag', 'category', 'manual'] as const).map(s => (
            <button key={s} onClick={() => pR({ productSource: s })}
              className={['px-3 py-1.5 text-xs font-semibold rounded-lg transition-all capitalize',
                config.rightPanel.productSource === s ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'].join(' ')}>
              {s}
            </button>
          ))}
        </div>
      </FieldGroup>
      {config.rightPanel.productSource === 'tag' && (
        <FieldGroup><Label>Tag</Label><TextInput value={config.rightPanel.tag} onChange={v => pR({ tag: v })} placeholder="Bridal" /></FieldGroup>
      )}
      {config.rightPanel.productSource === 'category' && (
        <FieldGroup><Label>Category slug</Label><TextInput value={config.rightPanel.categorySlug} onChange={v => pR({ categorySlug: v })} placeholder="bridal" /></FieldGroup>
      )}
      {config.rightPanel.productSource === 'manual' && (
        <FieldGroup><Label>Product IDs (comma-separated)</Label><TextInput value={config.rightPanel.productIds} onChange={v => pR({ productIds: v })} /></FieldGroup>
      )}
      <FieldGroup><Label>Arrow & button colour</Label><ColorInput value={config.rightPanel.arrowColor} onChange={v => pR({ arrowColor: v })} /></FieldGroup>
      <FieldGroup><Label>CTA text</Label><TextInput value={config.rightPanel.ctaText} onChange={v => pR({ ctaText: v })} /></FieldGroup>
      <UrlField label="CTA URL" value={config.rightPanel.ctaUrl} onChange={v => pR({ ctaUrl: v })} />
    </div>
  );
};

// ─── Editor ───────────────────────────────────────────────────────────────────

const BridalSectionEditor: React.FC<{ sectionId: string; onBack: () => void }> = ({ sectionId, onBack }) => (
  <SectionEditor<BridalSectionConfig>
    sectionId={sectionId}
    sectionLabel="Bridal Section"
    onBack={onBack}
    defaultConfig={DEFAULT}
    parseConfig={parse}
    renderPreview={(config) => <Preview config={config} />}
    renderContent={(config, onChange) => <ContentTab config={config} onChange={onChange} />}
  />
);

export default BridalSectionEditor;
