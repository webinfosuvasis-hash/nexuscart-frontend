/**
 * CampaignGridEditor — Campaign Grid Section (Section 3)
 *
 * 3-panel layout in a 2×2 CSS grid:
 *   Left (row-span-2):  SHAYA pink — 2×2 product image grid + sale text
 *   Top-right:          SHAYA Diamonds teal — model photo + offer text
 *   Bottom-right:       Latest Designs cream — mixed typography + CTA
 */

import React from 'react';
import { SectionEditor } from '../framework/SectionEditor';
import {
  Label, Hint, FieldGroup, SectionDivider, TextInput,
  ColorInput, ImageField, UrlField,
} from '../framework/FormFields';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CampaignGridConfig {
  leftPanel: {
    backgroundColor: string;
    brandLabel1: string;
    brandLabel2: string;
    craftNote: string;
    saleHeadline: string;
    offerText: string;
    offerSubtitle: string;
    disclaimer: string;
  };
  topRight: {
    gradientFrom: string;
    gradientTo: string;
    modelImage: string;
    brandLabel: string;
    headline: string;
    headlineSuperscript: string;
    subtitle: string;
    bodyNote: string;
    disclaimer: string;
  };
  bottomRight: {
    backgroundColor: string;
    subLabel: string;
    headlinePart1: string;
    headlinePart2: string;
    ctaText: string;
    ctaUrl: string;
  };
}

const DEFAULT: CampaignGridConfig = {
  leftPanel: {
    backgroundColor: '#F2899D',
    brandLabel1: 'SHAYA',
    brandLabel2: 'by AURUS',
    craftNote: 'Crafted in 925 Silver',
    saleHeadline: 'Big Sale Alert',
    offerText: 'Upto 50% Off',
    offerSubtitle: 'on Silver Jewellery',
    disclaimer: 'TCA',
  },
  topRight: {
    gradientFrom: '#6DC5B0',
    gradientTo: '#2D8B7A',
    modelImage: '',
    brandLabel: 'SHAYA DIAMONDS',
    headline: 'FLAT 10% OFF',
    headlineSuperscript: '*',
    subtitle: 'on MRP of all Designs',
    bodyNote: 'Natural Diamonds in 925 Silver from ₹5000',
    disclaimer: '*TCA',
  },
  bottomRight: {
    backgroundColor: '#F0E6D4',
    subLabel: 'More Earrings, More Fun!',
    headlinePart1: 'LATEST',
    headlinePart2: 'Designs',
    ctaText: 'SHOP NOW ▶',
    ctaUrl: '/jewellery/new-arrivals',
  },
};

function parse(raw: unknown): CampaignGridConfig {
  if (!raw || typeof raw !== 'object') return DEFAULT;
  const r = raw as Partial<CampaignGridConfig>;
  return {
    leftPanel:   { ...DEFAULT.leftPanel,   ...(r.leftPanel   ?? {}) },
    topRight:    { ...DEFAULT.topRight,    ...(r.topRight    ?? {}) },
    bottomRight: { ...DEFAULT.bottomRight, ...(r.bottomRight ?? {}) },
  };
}

// ─── Preview ──────────────────────────────────────────────────────────────────

const Preview: React.FC<{ config: CampaignGridConfig }> = ({ config }) => {
  const { leftPanel: l, topRight: t, bottomRight: b } = config;
  return (
    <div className="grid grid-cols-2 grid-rows-2 gap-1.5 p-1.5 bg-white rounded-2xl" style={{ height: '180px' }}>
      <div className="row-span-2 rounded-xl flex flex-col justify-end p-2" style={{ background: l.backgroundColor }}>
        <div className="space-y-0.5">
          <div className="text-white text-[8px] font-black">{l.brandLabel1}</div>
          <div className="text-white/80 text-[6px]">{l.brandLabel2}</div>
          <div className="text-gray-900 text-[9px] font-semibold mt-2">{l.saleHeadline}</div>
          <div className="text-gray-900 text-[14px] font-black">{l.offerText}</div>
          <div className="text-gray-800 text-[7px]">{l.offerSubtitle}</div>
        </div>
      </div>
      <div className="rounded-xl flex items-end p-2" style={{ background: `linear-gradient(135deg, ${t.gradientFrom}, ${t.gradientTo})` }}>
        <div className="space-y-0.5">
          <div className="text-white text-[7px] font-black">{t.brandLabel}</div>
          <div className="text-white text-[10px] font-black">{t.headline}</div>
          <div className="text-white/80 text-[6px]">{t.subtitle}</div>
        </div>
      </div>
      <div className="rounded-xl flex items-end p-2" style={{ background: b.backgroundColor }}>
        <div>
          <div className="text-gray-600 text-[6px]">{b.subLabel}</div>
          <div className="text-gray-900 text-[11px] font-black">{b.headlinePart1}</div>
          <div className="text-gray-800 text-[9px] italic">{b.headlinePart2}</div>
        </div>
      </div>
    </div>
  );
};

// ─── Content form ─────────────────────────────────────────────────────────────

const ContentTab: React.FC<{ config: CampaignGridConfig; onChange: (c: CampaignGridConfig) => void }> = ({ config, onChange }) => {
  const pL  = (p: Partial<CampaignGridConfig['leftPanel']>)   => onChange({ ...config, leftPanel:   { ...config.leftPanel,   ...p } });
  const pTR = (p: Partial<CampaignGridConfig['topRight']>)    => onChange({ ...config, topRight:    { ...config.topRight,    ...p } });
  const pBR = (p: Partial<CampaignGridConfig['bottomRight']>) => onChange({ ...config, bottomRight: { ...config.bottomRight, ...p } });
  const l = config.leftPanel, t = config.topRight, b = config.bottomRight;

  return (
    <div className="space-y-4">
      <SectionDivider label="Left Panel (Full-Height Sale)" />
      <FieldGroup><Label>Background colour</Label><ColorInput value={l.backgroundColor} onChange={c => pL({ backgroundColor: c })} /></FieldGroup>
      <div className="grid grid-cols-2 gap-3">
        <FieldGroup><Label>Brand label 1</Label><TextInput value={l.brandLabel1} onChange={v => pL({ brandLabel1: v })} placeholder="SHAYA" /></FieldGroup>
        <FieldGroup><Label>Brand label 2</Label><TextInput value={l.brandLabel2} onChange={v => pL({ brandLabel2: v })} placeholder="by AURUS" /></FieldGroup>
      </div>
      <FieldGroup><Label>Sale headline</Label><TextInput value={l.saleHeadline} onChange={v => pL({ saleHeadline: v })} /></FieldGroup>
      <FieldGroup><Label>Offer text (large)</Label><TextInput value={l.offerText} onChange={v => pL({ offerText: v })} placeholder="Upto 50% Off" /></FieldGroup>
      <FieldGroup><Label>Offer subtitle</Label><TextInput value={l.offerSubtitle} onChange={v => pL({ offerSubtitle: v })} /></FieldGroup>

      <SectionDivider label="Top-Right Panel (Brand Offer)" />
      <div className="grid grid-cols-2 gap-3">
        <FieldGroup><Label>Gradient from</Label><ColorInput value={t.gradientFrom} onChange={v => pTR({ gradientFrom: v })} /></FieldGroup>
        <FieldGroup><Label>Gradient to</Label><ColorInput value={t.gradientTo} onChange={v => pTR({ gradientTo: v })} /></FieldGroup>
      </div>
      <FieldGroup>
        <Label>Model image</Label>
        <ImageField value={t.modelImage} onChange={v => pTR({ modelImage: v })} />
        <Hint>Left side of the panel. Portrait crop recommended.</Hint>
      </FieldGroup>
      <FieldGroup><Label>Brand label</Label><TextInput value={t.brandLabel} onChange={v => pTR({ brandLabel: v })} /></FieldGroup>
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2"><FieldGroup><Label>Headline</Label><TextInput value={t.headline} onChange={v => pTR({ headline: v })} /></FieldGroup></div>
        <FieldGroup><Label>Superscript</Label><TextInput value={t.headlineSuperscript} onChange={v => pTR({ headlineSuperscript: v })} placeholder="*" /></FieldGroup>
      </div>
      <FieldGroup><Label>Subtitle</Label><TextInput value={t.subtitle} onChange={v => pTR({ subtitle: v })} /></FieldGroup>
      <FieldGroup><Label>Body note</Label><TextInput value={t.bodyNote} onChange={v => pTR({ bodyNote: v })} /></FieldGroup>

      <SectionDivider label="Bottom-Right Panel (Latest Designs)" />
      <FieldGroup><Label>Background colour</Label><ColorInput value={b.backgroundColor} onChange={c => pBR({ backgroundColor: c })} /></FieldGroup>
      <FieldGroup><Label>Sub-label</Label><TextInput value={b.subLabel} onChange={v => pBR({ subLabel: v })} /></FieldGroup>
      <div className="grid grid-cols-2 gap-3">
        <FieldGroup><Label>Headline part 1 (bold sans)</Label><TextInput value={b.headlinePart1} onChange={v => pBR({ headlinePart1: v })} placeholder="LATEST" /></FieldGroup>
        <FieldGroup><Label>Headline part 2 (italic serif)</Label><TextInput value={b.headlinePart2} onChange={v => pBR({ headlinePart2: v })} placeholder="Designs" /></FieldGroup>
      </div>
      <FieldGroup><Label>CTA text</Label><TextInput value={b.ctaText} onChange={v => pBR({ ctaText: v })} /></FieldGroup>
      <UrlField label="CTA URL" value={b.ctaUrl} onChange={v => pBR({ ctaUrl: v })} />
    </div>
  );
};

// ─── Editor ───────────────────────────────────────────────────────────────────

const CampaignGridEditor: React.FC<{ sectionId: string; onBack: () => void }> = ({ sectionId, onBack }) => (
  <SectionEditor<CampaignGridConfig>
    sectionId={sectionId}
    sectionLabel="Campaign Grid"
    onBack={onBack}
    defaultConfig={DEFAULT}
    parseConfig={parse}
    renderPreview={(config) => <Preview config={config} />}
    renderContent={(config, onChange) => <ContentTab config={config} onChange={onChange} />}
  />
);

export default CampaignGridEditor;
