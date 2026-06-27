/**
 * CollectionsEditor — Collections Section (Section 7)
 *
 * 5 portrait editorial collection cards on a lavender background.
 * Collections: Dashta, Leher, Adaa, Aneka, Eternity.
 * Each slot can reference an existing collection or use custom name/image.
 */

import React from 'react';
import { SectionEditor } from '../framework/SectionEditor';
import {
  Label, Hint, FieldGroup, SectionDivider, TextInput, ColorInput, ImageField, UrlField,
} from '../framework/FormFields';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CollectionSlot {
  id: string;
  customName: string;
  customSubLabel: string;
  customImage: string;
  linkUrl: string;
}

export interface CollectionsConfig {
  backgroundColor: string;
  heading: string;
  ctaText: string;
  ctaUrl: string;
  ctaButtonColor: string;
  slots: CollectionSlot[];
}

const DEFAULT_SLOTS: CollectionSlot[] = [
  { id: '1', customName: 'दश्ता',   customSubLabel: 'Heritage Edit',             customImage: '', linkUrl: '/collections/dashta'   },
  { id: '2', customName: 'Leher',   customSubLabel: 'The dance of waves',        customImage: '', linkUrl: '/collections/leher'    },
  { id: '3', customName: 'Adaa',    customSubLabel: 'BY AURUS',                  customImage: '', linkUrl: '/collections/adaa'     },
  { id: '4', customName: 'aneka',   customSubLabel: 'Many Forms, One Essence',   customImage: '', linkUrl: '/collections/aneka'    },
  { id: '5', customName: 'Eternity',customSubLabel: 'Luxury, woven in brilliance',customImage: '', linkUrl: '/collections/eternity' },
];

const DEFAULT: CollectionsConfig = {
  backgroundColor: '#EDE9FE',
  heading:         'Aurus Collections',
  ctaText:         'VIEW ALL COLLECTIONS',
  ctaUrl:          '/collections',
  ctaButtonColor:  '#7C3AED',
  slots:           DEFAULT_SLOTS,
};

function parse(raw: unknown): CollectionsConfig {
  if (!raw || typeof raw !== 'object') return DEFAULT;
  const r = raw as Partial<CollectionsConfig>;
  return { ...DEFAULT, ...r, slots: Array.isArray(r.slots) && r.slots.length ? r.slots : DEFAULT.slots };
}

// ─── Preview ──────────────────────────────────────────────────────────────────

const Preview: React.FC<{ config: CollectionsConfig }> = ({ config }) => (
  <div className="rounded-2xl py-6 px-2" style={{ background: config.backgroundColor }}>
    <p className="text-center text-sm font-bold text-gray-800 mb-3">{config.heading}</p>
    <div className="flex gap-1">
      {config.slots.map(slot => (
        <div key={slot.id} className="flex-1 relative overflow-hidden rounded-lg" style={{ aspectRatio: '3/5' }}>
          {slot.customImage
            ? <img src={slot.customImage} alt={slot.customName} className="absolute inset-0 w-full h-full object-cover" />
            : <div className="absolute inset-0 bg-purple-200" />
          }
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          <div className="absolute bottom-1 left-1">
            <p className="text-white text-[8px] italic font-light">{slot.customName}</p>
            <p className="text-white/60 text-[6px] uppercase tracking-wider">{slot.customSubLabel}</p>
          </div>
        </div>
      ))}
    </div>
    <div className="text-center mt-3">
      <span className="inline-block px-4 py-1.5 text-white text-[9px] font-bold rounded-sm" style={{ background: config.ctaButtonColor }}>
        {config.ctaText}
      </span>
    </div>
  </div>
);

// ─── Slot editor ──────────────────────────────────────────────────────────────

const SlotEditor: React.FC<{
  slot: CollectionSlot;
  index: number;
  onChange: (s: CollectionSlot) => void;
}> = ({ slot, index, onChange }) => (
  <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 space-y-2 bg-white dark:bg-slate-900">
    <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Slot {index + 1}</p>
    <div className="grid grid-cols-2 gap-2">
      <div>
        <Label>Cover image</Label>
        <ImageField value={slot.customImage} onChange={customImage => onChange({ ...slot, customImage })} aspectClass="aspect-[3/5]" label="Upload portrait" hint="3:5 crop" />
      </div>
      <div className="space-y-2">
        <FieldGroup><Label>Collection name</Label><TextInput value={slot.customName} onChange={customName => onChange({ ...slot, customName })} /></FieldGroup>
        <FieldGroup><Label>Sub-label</Label><TextInput value={slot.customSubLabel} onChange={customSubLabel => onChange({ ...slot, customSubLabel })} /></FieldGroup>
        <FieldGroup><Label>Link URL</Label><TextInput value={slot.linkUrl} onChange={linkUrl => onChange({ ...slot, linkUrl })} /></FieldGroup>
      </div>
    </div>
  </div>
);

// ─── Content form ─────────────────────────────────────────────────────────────

const ContentTab: React.FC<{ config: CollectionsConfig; onChange: (c: CollectionsConfig) => void }> = ({ config, onChange }) => (
  <div className="space-y-4">
    <SectionDivider label="Section Settings" />
    <FieldGroup><Label>Background colour</Label><ColorInput value={config.backgroundColor} onChange={v => onChange({ ...config, backgroundColor: v })} /></FieldGroup>
    <FieldGroup><Label>Section heading</Label><TextInput value={config.heading} onChange={heading => onChange({ ...config, heading })} /></FieldGroup>

    <SectionDivider label="CTA Button" />
    <FieldGroup><Label>Button text</Label><TextInput value={config.ctaText} onChange={ctaText => onChange({ ...config, ctaText })} /></FieldGroup>
    <UrlField label="Button URL" value={config.ctaUrl} onChange={ctaUrl => onChange({ ...config, ctaUrl })} />
    <FieldGroup><Label>Button colour</Label><ColorInput value={config.ctaButtonColor} onChange={v => onChange({ ...config, ctaButtonColor: v })} /></FieldGroup>

    <SectionDivider label="Collection Slots (5 fixed)" />
    <Hint>The Aurus theme always shows exactly 5 collection cards. Each slot has its own image, name, sub-label, and link.</Hint>
    <div className="space-y-3">
      {config.slots.map((slot, i) => (
        <SlotEditor key={slot.id} slot={slot} index={i} onChange={updated => onChange({ ...config, slots: config.slots.map((s, idx) => idx === i ? updated : s) })} />
      ))}
    </div>
  </div>
);

// ─── Editor ───────────────────────────────────────────────────────────────────

const CollectionsEditor: React.FC<{ sectionId: string; onBack: () => void }> = ({ sectionId, onBack }) => (
  <SectionEditor<CollectionsConfig>
    sectionId={sectionId}
    sectionLabel="Collections"
    onBack={onBack}
    defaultConfig={DEFAULT}
    parseConfig={parse}
    renderPreview={(config) => <Preview config={config} />}
    renderContent={(config, onChange) => <ContentTab config={config} onChange={onChange} />}
  />
);

export default CollectionsEditor;
