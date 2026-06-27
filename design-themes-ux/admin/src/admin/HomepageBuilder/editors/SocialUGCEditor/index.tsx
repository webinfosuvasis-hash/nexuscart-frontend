/**
 * SocialUGCEditor — Social / UGC Section (Section 16)
 *
 * Dark background mosaic grid with #MyAurusStory UGC campaign.
 * 7 image slots in an asymmetric grid (1 tall left + 6 standard).
 */

import React from 'react';
import { SectionEditor } from '../framework/SectionEditor';
import {
  Label, Hint, FieldGroup, SectionDivider, TextInput, ColorInput, ImageField,
} from '../framework/FormFields';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UGCImage {
  slot: number;
  image: string;
  alt: string;
  linkUrl: string;
}

export interface SocialUGCConfig {
  backgroundColor: string;
  label: string;
  headlineL1: string;
  prizeText: string;
  subText: string;
  mosaicImages: UGCImage[];
  hashtagText: string;
  handle: string;
  textColor: string;
}

const DEFAULT_IMAGES: UGCImage[] = [1,2,3,4,5,6,7].map(slot => ({ slot, image: '', alt: '', linkUrl: '' }));

const DEFAULT: SocialUGCConfig = {
  backgroundColor: '#0F0A14',
  label:           'Aurus Xpression',
  headlineL1:      'Share your #MyAurusStory and',
  prizeText:       'win jewellery worth up to ₹15,000',
  subText:         'Tag us on Instagram and get featured on our page',
  mosaicImages:    DEFAULT_IMAGES,
  hashtagText:     '#MyAurusStory',
  handle:          '@aurus',
  textColor:       '#A78BFA',
};

function parse(raw: unknown): SocialUGCConfig {
  if (!raw || typeof raw !== 'object') return DEFAULT;
  const r = raw as Partial<SocialUGCConfig>;
  return {
    ...DEFAULT,
    ...r,
    mosaicImages: Array.isArray(r.mosaicImages) && r.mosaicImages.length === 7
      ? r.mosaicImages
      : DEFAULT.mosaicImages,
  };
}

// ─── Preview ──────────────────────────────────────────────────────────────────

const Preview: React.FC<{ config: SocialUGCConfig }> = ({ config }) => (
  <div className="rounded-2xl p-3" style={{ background: config.backgroundColor }}>
    <div className="text-center mb-3">
      <p className="text-[7px] uppercase tracking-widest mb-1" style={{ color: config.textColor }}>{config.label}</p>
      <p className="text-white text-[9px] font-light">{config.headlineL1}</p>
      <p className="text-[8px] font-semibold" style={{ color: '#C4B5FD' }}>{config.prizeText}</p>
    </div>
    <div className="grid gap-1" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr', gridTemplateRows: '1fr 1fr', height: '100px' }}>
      <div className="row-span-2 rounded-lg overflow-hidden bg-gray-700/60">
        {config.mosaicImages[0]?.image && <img src={config.mosaicImages[0].image} alt="" className="w-full h-full object-cover opacity-70" />}
      </div>
      {config.mosaicImages.slice(1, 7).map(img => (
        <div key={img.slot} className="rounded-lg overflow-hidden bg-gray-600/55">
          {img.image && <img src={img.image} alt="" className="w-full h-full object-cover opacity-60" />}
        </div>
      ))}
    </div>
    <p className="text-center text-[7px] mt-2 font-medium" style={{ color: config.textColor }}>{config.hashtagText}</p>
  </div>
);

// ─── Content form ─────────────────────────────────────────────────────────────

const ContentTab: React.FC<{ config: SocialUGCConfig; onChange: (c: SocialUGCConfig) => void }> = ({ config, onChange }) => {
  const pImg = (slot: number, patch: Partial<UGCImage>) =>
    onChange({ ...config, mosaicImages: config.mosaicImages.map(img => img.slot === slot ? { ...img, ...patch } : img) });

  return (
    <div className="space-y-4">
      <SectionDivider label="Section Background" />
      <FieldGroup><Label>Background colour</Label><ColorInput value={config.backgroundColor} onChange={v => onChange({ ...config, backgroundColor: v })} /></FieldGroup>
      <FieldGroup><Label>Accent text colour</Label><ColorInput value={config.textColor} onChange={v => onChange({ ...config, textColor: v })} /></FieldGroup>

      <SectionDivider label="Header Content" />
      <FieldGroup><Label>Label</Label><TextInput value={config.label} onChange={label => onChange({ ...config, label })} placeholder="Aurus Xpression" /></FieldGroup>
      <FieldGroup><Label>Headline</Label><TextInput value={config.headlineL1} onChange={headlineL1 => onChange({ ...config, headlineL1 })} /></FieldGroup>
      <FieldGroup><Label>Prize / incentive text</Label><TextInput value={config.prizeText} onChange={prizeText => onChange({ ...config, prizeText })} /></FieldGroup>
      <FieldGroup><Label>Sub-text</Label><TextInput value={config.subText} onChange={subText => onChange({ ...config, subText })} /></FieldGroup>

      <SectionDivider label="Mosaic Images (7 slots)" />
      <Hint>Slot 1 is the tall left image (spans 2 rows). Slots 2–7 fill the right grid.</Hint>
      <div className="space-y-3">
        {config.mosaicImages.map((img, i) => (
          <div key={img.slot} className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-white dark:bg-slate-900">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
              Slot {img.slot}{img.slot === 1 ? ' (tall, 2-row span)' : ''}
            </p>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <ImageField value={img.image} onChange={v => pImg(img.slot, { image: v })} aspectClass="aspect-square" label="Upload" hint="UGC photo" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <FieldGroup><Label>Alt text</Label><TextInput value={img.alt} onChange={v => pImg(img.slot, { alt: v })} /></FieldGroup>
                <FieldGroup><Label>Link URL (optional)</Label><TextInput value={img.linkUrl} onChange={v => pImg(img.slot, { linkUrl: v })} placeholder="/jewellery" /></FieldGroup>
              </div>
            </div>
          </div>
        ))}
      </div>

      <SectionDivider label="Bottom Bar" />
      <FieldGroup><Label>Hashtag</Label><TextInput value={config.hashtagText} onChange={hashtagText => onChange({ ...config, hashtagText })} placeholder="#MyAurusStory" /></FieldGroup>
      <FieldGroup><Label>Instagram handle</Label><TextInput value={config.handle} onChange={handle => onChange({ ...config, handle })} placeholder="@aurus" /></FieldGroup>
    </div>
  );
};

// ─── Editor ───────────────────────────────────────────────────────────────────

const SocialUGCEditor: React.FC<{ sectionId: string; onBack: () => void }> = ({ sectionId, onBack }) => (
  <SectionEditor<SocialUGCConfig>
    sectionId={sectionId}
    sectionLabel="Social / UGC"
    onBack={onBack}
    defaultConfig={DEFAULT}
    parseConfig={parse}
    renderPreview={(config) => <Preview config={config} />}
    renderContent={(config, onChange) => <ContentTab config={config} onChange={onChange} />}
  />
);

export default SocialUGCEditor;
