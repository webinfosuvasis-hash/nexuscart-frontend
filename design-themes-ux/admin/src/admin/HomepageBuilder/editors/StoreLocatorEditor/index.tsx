/**
 * StoreLocatorEditor — Store Locator Section (Section 10)
 *
 * Split panel: lifestyle image or video placeholder on the left,
 * blush background + pincode input form on the right.
 */

import React from 'react';
import { SectionEditor } from '../framework/SectionEditor';
import {
  Label, Hint, FieldGroup, SectionDivider, TextInput, ColorInput,
  ImageField, ToggleGroup,
} from '../framework/FormFields';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StoreLocatorConfig {
  leftPanel: {
    mediaType: 'image' | 'video';
    image: string;
    videoUrl: string;
    showPlayButton: boolean;
    overlayOpacity: number;
  };
  rightPanel: {
    backgroundColor: string;
    headlineL1: string;
    headlineL2: string;
    inputPlaceholder: string;
    ctaLabel: string;
    ctaColor: string;
  };
}

const DEFAULT: StoreLocatorConfig = {
  leftPanel: {
    mediaType: 'image',
    image: '',
    videoUrl: '',
    showPlayButton: true,
    overlayOpacity: 15,
  },
  rightPanel: {
    backgroundColor: '#FDEAE0',
    headlineL1: 'Find your favorite designs',
    headlineL2: 'at a Store Nearby',
    inputPlaceholder: 'Enter Pincode or City',
    ctaLabel: 'CHANGE',
    ctaColor: '#E8630A',
  },
};

function parse(raw: unknown): StoreLocatorConfig {
  if (!raw || typeof raw !== 'object') return DEFAULT;
  const r = raw as Partial<StoreLocatorConfig>;
  return {
    leftPanel:  { ...DEFAULT.leftPanel,  ...(r.leftPanel  ?? {}) },
    rightPanel: { ...DEFAULT.rightPanel, ...(r.rightPanel ?? {}) },
  };
}

// ─── Preview ──────────────────────────────────────────────────────────────────

const Preview: React.FC<{ config: StoreLocatorConfig }> = ({ config }) => {
  const { leftPanel: l, rightPanel: r } = config;
  return (
    <div className="flex rounded-2xl overflow-hidden" style={{ minHeight: '130px' }}>
      <div className="w-1/2 relative bg-gray-700">
        {l.image && <img src={l.image} alt="" className="absolute inset-0 w-full h-full object-cover" />}
        <div className="absolute inset-0 bg-black" style={{ opacity: l.overlayOpacity / 100 }} />
        {l.showPlayButton && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full bg-white/25 border border-white/40 flex items-center justify-center">
              <div className="w-0 h-0 ml-0.5" style={{ borderTop:'4px solid transparent', borderBottom:'4px solid transparent', borderLeft:'7px solid white' }} />
            </div>
          </div>
        )}
      </div>
      <div className="flex-1 flex flex-col justify-center px-4 py-3" style={{ background: r.backgroundColor }}>
        <p className="text-[9px] font-bold text-center leading-tight" style={{ color: '#2D1B6E' }}>{r.headlineL1}</p>
        <p className="text-[9px] font-bold text-center leading-tight mb-2" style={{ color: '#2D1B6E' }}>{r.headlineL2}</p>
        <div className="flex items-center bg-white rounded-full border border-gray-200 px-2 py-1.5">
          <div className="flex-1 text-[7px] text-gray-400">{r.inputPlaceholder}</div>
          <span className="text-[7px] font-bold" style={{ color: r.ctaColor }}>{r.ctaLabel}</span>
        </div>
      </div>
    </div>
  );
};

// ─── Content form ─────────────────────────────────────────────────────────────

const ContentTab: React.FC<{ config: StoreLocatorConfig; onChange: (c: StoreLocatorConfig) => void }> = ({ config, onChange }) => {
  const pL = (p: Partial<StoreLocatorConfig['leftPanel']>)  => onChange({ ...config, leftPanel:  { ...config.leftPanel,  ...p } });
  const pR = (p: Partial<StoreLocatorConfig['rightPanel']>) => onChange({ ...config, rightPanel: { ...config.rightPanel, ...p } });

  return (
    <div className="space-y-4">
      <SectionDivider label="Left Panel (Media)" />
      <FieldGroup>
        <Label>Media type</Label>
        <ToggleGroup value={config.leftPanel.mediaType} onChange={v => pL({ mediaType: v as any })}
          options={[{ label: 'Image', value: 'image' }, { label: 'Video URL', value: 'video' }]} />
      </FieldGroup>
      {config.leftPanel.mediaType === 'image' ? (
        <FieldGroup>
          <Label>Lifestyle image</Label>
          <ImageField value={config.leftPanel.image} onChange={v => pL({ image: v })} />
        </FieldGroup>
      ) : (
        <FieldGroup>
          <Label>Video URL</Label>
          <TextInput value={config.leftPanel.videoUrl} onChange={v => pL({ videoUrl: v })} placeholder="https://example.com/video.mp4" />
          <Hint>MP4 or YouTube embed URL. Plays muted autoplay on storefront.</Hint>
        </FieldGroup>
      )}
      <FieldGroup>
        <Label>Overlay opacity</Label>
        <input type="range" min={0} max={60} step={5} value={config.leftPanel.overlayOpacity}
          onChange={e => pL({ overlayOpacity: Number(e.target.value) })} className="w-full accent-indigo-600" />
      </FieldGroup>

      <SectionDivider label="Right Panel (Search Form)" />
      <FieldGroup><Label>Background colour</Label><ColorInput value={config.rightPanel.backgroundColor} onChange={v => pR({ backgroundColor: v })} /></FieldGroup>
      <FieldGroup><Label>Headline line 1</Label><TextInput value={config.rightPanel.headlineL1} onChange={v => pR({ headlineL1: v })} /></FieldGroup>
      <FieldGroup><Label>Headline line 2</Label><TextInput value={config.rightPanel.headlineL2} onChange={v => pR({ headlineL2: v })} /></FieldGroup>
      <FieldGroup><Label>Input placeholder</Label><TextInput value={config.rightPanel.inputPlaceholder} onChange={v => pR({ inputPlaceholder: v })} /></FieldGroup>
      <FieldGroup><Label>CTA label</Label><TextInput value={config.rightPanel.ctaLabel} onChange={v => pR({ ctaLabel: v })} placeholder="CHANGE" /></FieldGroup>
      <FieldGroup><Label>CTA colour</Label><ColorInput value={config.rightPanel.ctaColor} onChange={v => pR({ ctaColor: v })} /></FieldGroup>
    </div>
  );
};

// ─── Editor ───────────────────────────────────────────────────────────────────

const StoreLocatorEditor: React.FC<{ sectionId: string; onBack: () => void }> = ({ sectionId, onBack }) => (
  <SectionEditor<StoreLocatorConfig>
    sectionId={sectionId}
    sectionLabel="Store Locator"
    onBack={onBack}
    defaultConfig={DEFAULT}
    parseConfig={parse}
    renderPreview={(config) => <Preview config={config} />}
    renderContent={(config, onChange) => <ContentTab config={config} onChange={onChange} />}
  />
);

export default StoreLocatorEditor;
