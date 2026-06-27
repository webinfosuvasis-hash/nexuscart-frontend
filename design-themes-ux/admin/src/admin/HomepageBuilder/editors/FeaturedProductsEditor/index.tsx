/**
 * FeaturedProductsEditor — Polki Brand Section (Section 2)
 *
 * Split panel: dark editorial image on the left (~42% width),
 * lavender product carousel on the right (~58% width).
 * Products are selected by source type (manual IDs, tag, or category).
 */

import React from 'react';
import { SectionEditor } from '../framework/SectionEditor';
import {
  Label, Hint, FieldGroup, SectionDivider, TextInput, NumberInput,
  ImageField, ColorInput, ToggleGroup, UrlField,
} from '../framework/FormFields';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FeaturedProductsConfig {
  leftPanel: {
    image: string;
    overlayOpacity: number;
    linkUrl: string;
  };
  rightPanel: {
    backgroundColor: string;
    heading: string;
    productSource: 'manual' | 'tag' | 'category';
    productIds: string;   // comma-separated IDs for manual mode
    tag: string;          // product tag for auto mode
    categorySlug: string; // category slug for auto mode
    maxProducts: number;
    visibleCount: number;
    arrowColor: string;
    ctaText: string;
    ctaUrl: string;
  };
}

const DEFAULT: FeaturedProductsConfig = {
  leftPanel: { image: '', overlayOpacity: 15, linkUrl: '' },
  rightPanel: {
    backgroundColor: '#EDE9FE',
    heading: '',
    productSource: 'tag',
    productIds: '',
    tag: 'Bestseller',
    categorySlug: '',
    maxProducts: 12,
    visibleCount: 4,
    arrowColor: '#3D0F6E',
    ctaText: 'Shop Now',
    ctaUrl: '/jewellery',
  },
};

function parse(raw: unknown): FeaturedProductsConfig {
  if (!raw || typeof raw !== 'object') return DEFAULT;
  const r = raw as Partial<FeaturedProductsConfig>;
  return {
    leftPanel:  { ...DEFAULT.leftPanel,  ...(r.leftPanel  ?? {}) },
    rightPanel: { ...DEFAULT.rightPanel, ...(r.rightPanel ?? {}) },
  };
}

// ─── Preview ──────────────────────────────────────────────────────────────────

const Preview: React.FC<{ config: FeaturedProductsConfig }> = ({ config }) => {
  const { leftPanel: l, rightPanel: r } = config;
  return (
    <div className="w-full rounded-2xl overflow-hidden flex" style={{ minHeight: '160px' }}>
      <div className="w-[42%] flex-shrink-0 relative" style={{ background: '#0A0714' }}>
        {l.image
          ? <img src={l.image} alt="" className="absolute inset-0 w-full h-full object-cover" style={{ opacity: 1 - l.overlayOpacity / 100 }} />
          : <div className="absolute inset-0 flex items-center justify-center text-slate-600 text-[10px]">Left image</div>
        }
        <div className="absolute inset-0 bg-black" style={{ opacity: l.overlayOpacity / 100 }} />
      </div>
      <div className="flex-1 p-3 flex flex-col justify-between" style={{ background: r.backgroundColor }}>
        <div className="flex gap-2 mb-2">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="flex-1 aspect-square bg-white rounded-lg shadow-sm border border-purple-100" />
          ))}
        </div>
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            <div className="w-6 h-6 rounded-full" style={{ background: r.arrowColor }} />
            <div className="w-6 h-6 rounded-full" style={{ background: r.arrowColor }} />
          </div>
          <div className="px-4 py-1.5 rounded-full text-white text-[10px] font-bold" style={{ background: r.arrowColor }}>
            {r.ctaText}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Content form ─────────────────────────────────────────────────────────────

const ContentTab: React.FC<{ config: FeaturedProductsConfig; onChange: (c: FeaturedProductsConfig) => void }> = ({ config, onChange }) => {
  const patchLeft  = (p: Partial<FeaturedProductsConfig['leftPanel']>)  => onChange({ ...config, leftPanel:  { ...config.leftPanel,  ...p } });
  const patchRight = (p: Partial<FeaturedProductsConfig['rightPanel']>) => onChange({ ...config, rightPanel: { ...config.rightPanel, ...p } });

  return (
    <div className="space-y-4">
      <SectionDivider label="Left Panel (Editorial Image)" />
      <FieldGroup>
        <Label>Editorial image</Label>
        <ImageField value={config.leftPanel.image} onChange={image => patchLeft({ image })} />
      </FieldGroup>
      <FieldGroup>
        <Label>Image overlay opacity</Label>
        <input type="range" min={0} max={60} step={5} value={config.leftPanel.overlayOpacity}
          onChange={e => patchLeft({ overlayOpacity: Number(e.target.value) })}
          className="w-full accent-indigo-600" />
        <Hint>Darkens the image slightly. Default: 15%.</Hint>
      </FieldGroup>
      <UrlField label="Link URL (optional)" value={config.leftPanel.linkUrl} onChange={linkUrl => patchLeft({ linkUrl })} />

      <SectionDivider label="Right Panel (Product Carousel)" />
      <FieldGroup>
        <Label>Background colour</Label>
        <ColorInput value={config.rightPanel.backgroundColor} onChange={backgroundColor => patchRight({ backgroundColor })} />
      </FieldGroup>

      <FieldGroup>
        <Label>Product source</Label>
        <ToggleGroup
          value={config.rightPanel.productSource}
          onChange={productSource => patchRight({ productSource: productSource as any })}
          options={[{ label: 'By tag', value: 'tag' }, { label: 'By category', value: 'category' }, { label: 'Manual IDs', value: 'manual' }]}
        />
      </FieldGroup>

      {config.rightPanel.productSource === 'tag' && (
        <FieldGroup>
          <Label>Product tag</Label>
          <TextInput value={config.rightPanel.tag} onChange={tag => patchRight({ tag })} placeholder="Bestseller" />
          <Hint>Products with this tag are shown in the carousel.</Hint>
        </FieldGroup>
      )}
      {config.rightPanel.productSource === 'category' && (
        <FieldGroup>
          <Label>Category slug</Label>
          <TextInput value={config.rightPanel.categorySlug} onChange={categorySlug => patchRight({ categorySlug })} placeholder="rings" />
        </FieldGroup>
      )}
      {config.rightPanel.productSource === 'manual' && (
        <FieldGroup>
          <Label>Product IDs (comma-separated)</Label>
          <TextInput value={config.rightPanel.productIds} onChange={productIds => patchRight({ productIds })} placeholder="clxxx,clyyy,clzzz" />
          <Hint>Paste product IDs from the Products module.</Hint>
        </FieldGroup>
      )}

      <FieldGroup>
        <Label>Max products to load</Label>
        <NumberInput value={config.rightPanel.maxProducts} onChange={maxProducts => patchRight({ maxProducts })} min={4} max={20} suffix="items" />
      </FieldGroup>

      <SectionDivider label="Call to Action" />
      <FieldGroup>
        <Label>CTA button text</Label>
        <TextInput value={config.rightPanel.ctaText} onChange={ctaText => patchRight({ ctaText })} placeholder="Shop Now" />
      </FieldGroup>
      <UrlField label="CTA URL" value={config.rightPanel.ctaUrl} onChange={ctaUrl => patchRight({ ctaUrl })} />

      <FieldGroup>
        <Label>Arrow & button colour</Label>
        <ColorInput value={config.rightPanel.arrowColor} onChange={arrowColor => patchRight({ arrowColor })} />
      </FieldGroup>
    </div>
  );
};

// ─── Editor ───────────────────────────────────────────────────────────────────

const FeaturedProductsEditor: React.FC<{ sectionId: string; onBack: () => void }> = ({ sectionId, onBack }) => (
  <SectionEditor<FeaturedProductsConfig>
    sectionId={sectionId}
    sectionLabel="Featured Products"
    onBack={onBack}
    defaultConfig={DEFAULT}
    parseConfig={parse}
    renderPreview={(config) => <Preview config={config} />}
    renderContent={(config, onChange) => <ContentTab config={config} onChange={onChange} />}
  />
);

export default FeaturedProductsEditor;
