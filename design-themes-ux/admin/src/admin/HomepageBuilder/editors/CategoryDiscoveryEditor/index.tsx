/**
 * CategoryDiscoveryEditor — Category Discovery Section (Section 4)
 *
 * Light lavender section with a gift icon block on the left and a horizontal
 * scrollable row of rounded category cards on the right.
 */

import React, { useId } from 'react';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { SectionEditor } from '../framework/SectionEditor';
import {
  Label, Hint, FieldGroup, SectionDivider, TextInput,
  ColorInput, ImageField, UrlField,
} from '../framework/FormFields';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CategoryCard {
  id: string;
  image: string;
  label: string;
  linkUrl: string;
}

export interface CategoryDiscoveryConfig {
  backgroundColor: string;
  borderColor: string;
  leftIcon: string;
  leftIconBgFrom: string;
  leftIconBgTo: string;
  leftLabel: string;
  cards: CategoryCard[];
}

const DEFAULT_CARDS: CategoryCard[] = [
  { id: '1', image: '', label: 'Wedding Bands',       linkUrl: '/jewellery/bands'     },
  { id: '2', image: '', label: 'Everyday Pendants',   linkUrl: '/jewellery/pendants'  },
  { id: '3', image: '', label: 'Bestselling Styles',  linkUrl: '/jewellery/bestsellers'},
  { id: '4', image: '', label: 'New Styles For Kids', linkUrl: '/jewellery/kids'      },
  { id: '5', image: '', label: 'Dailywear Hoops',     linkUrl: '/jewellery/hoops'     },
  { id: '6', image: '', label: 'Nose Pins',           linkUrl: '/jewellery/nose-pins' },
  { id: '7', image: '', label: 'Gold Rings',          linkUrl: '/jewellery/rings'     },
  { id: '8', image: '', label: 'Mangalsutra',         linkUrl: '/jewellery/mangalsutra'},
];

const DEFAULT: CategoryDiscoveryConfig = {
  backgroundColor: '#F5EEFF',
  borderColor:     '#DDD0F5',
  leftIcon:        '🎁',
  leftIconBgFrom:  '#C084FC',
  leftIconBgTo:    '#7C3AED',
  leftLabel:       'Gift Her Style',
  cards:           DEFAULT_CARDS,
};

function parse(raw: unknown): CategoryDiscoveryConfig {
  if (!raw || typeof raw !== 'object') return DEFAULT;
  const r = raw as Partial<CategoryDiscoveryConfig>;
  return { ...DEFAULT, ...r, cards: Array.isArray(r.cards) && r.cards.length ? r.cards : DEFAULT.cards };
}

function newCard(): CategoryCard {
  return { id: `card-${Date.now()}`, image: '', label: 'New Category', linkUrl: '/' };
}

// ─── Preview ──────────────────────────────────────────────────────────────────

const Preview: React.FC<{ config: CategoryDiscoveryConfig }> = ({ config }) => (
  <div className="rounded-2xl border p-3 flex items-center gap-3" style={{ background: config.backgroundColor, borderColor: config.borderColor }}>
    <div className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center text-xl"
      style={{ background: `linear-gradient(135deg, ${config.leftIconBgFrom}, ${config.leftIconBgTo})` }}>
      {config.leftIcon}
    </div>
    <div className="flex gap-2 overflow-hidden">
      {config.cards.slice(0, 5).map(c => (
        <div key={c.id} className="flex-shrink-0 w-16 text-center">
          <div className="aspect-square bg-white rounded-xl shadow-sm border border-purple-100 overflow-hidden">
            {c.image ? <img src={c.image} alt={c.label} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-purple-50" />}
          </div>
          <p className="text-[8px] font-bold uppercase text-slate-600 mt-1 leading-tight">{c.label}</p>
        </div>
      ))}
    </div>
  </div>
);

// ─── Card editor row ──────────────────────────────────────────────────────────

const CardRow: React.FC<{
  card: CategoryCard;
  onChange: (c: CategoryCard) => void;
  onDelete: () => void;
}> = ({ card, onChange, onDelete }) => (
  <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 space-y-2 bg-white dark:bg-slate-900">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5 text-slate-400">
        <GripVertical size={13} />
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{card.label || 'Unnamed card'}</span>
      </div>
      <button onClick={onDelete} className="p-1 text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={13} /></button>
    </div>
    <div className="grid grid-cols-2 gap-2">
      <div>
        <Label>Image</Label>
        <ImageField value={card.image} onChange={image => onChange({ ...card, image })} aspectClass="aspect-square" label="Upload" hint="Square crop" />
      </div>
      <div className="space-y-2">
        <FieldGroup><Label>Label</Label><TextInput value={card.label} onChange={label => onChange({ ...card, label })} /></FieldGroup>
        <FieldGroup><Label>URL</Label><TextInput value={card.linkUrl} onChange={linkUrl => onChange({ ...card, linkUrl })} placeholder="/jewellery" /></FieldGroup>
      </div>
    </div>
  </div>
);

// ─── Content form ─────────────────────────────────────────────────────────────

const ContentTab: React.FC<{ config: CategoryDiscoveryConfig; onChange: (c: CategoryDiscoveryConfig) => void }> = ({ config, onChange }) => (
  <div className="space-y-4">
    <SectionDivider label="Section Appearance" />
    <div className="grid grid-cols-2 gap-3">
      <FieldGroup><Label>Background</Label><ColorInput value={config.backgroundColor} onChange={v => onChange({ ...config, backgroundColor: v })} /></FieldGroup>
      <FieldGroup><Label>Border colour</Label><ColorInput value={config.borderColor} onChange={v => onChange({ ...config, borderColor: v })} /></FieldGroup>
    </div>

    <SectionDivider label="Left Icon Block" />
    <FieldGroup>
      <Label>Icon (emoji)</Label>
      <TextInput value={config.leftIcon} onChange={leftIcon => onChange({ ...config, leftIcon })} placeholder="🎁" />
      <Hint>Paste any emoji. Shown inside the coloured icon block.</Hint>
    </FieldGroup>
    <div className="grid grid-cols-2 gap-3">
      <FieldGroup><Label>Icon bg from</Label><ColorInput value={config.leftIconBgFrom} onChange={v => onChange({ ...config, leftIconBgFrom: v })} /></FieldGroup>
      <FieldGroup><Label>Icon bg to</Label><ColorInput value={config.leftIconBgTo} onChange={v => onChange({ ...config, leftIconBgTo: v })} /></FieldGroup>
    </div>
    <FieldGroup>
      <Label>Label</Label>
      <TextInput value={config.leftLabel} onChange={leftLabel => onChange({ ...config, leftLabel })} placeholder="Gift Her Style" />
    </FieldGroup>

    <SectionDivider label={`Category Cards (${config.cards.length}/12)`} />
    <div className="space-y-2">
      {config.cards.map((card, i) => (
        <CardRow
          key={card.id}
          card={card}
          onChange={updated => onChange({ ...config, cards: config.cards.map((c, idx) => idx === i ? updated : c) })}
          onDelete={() => onChange({ ...config, cards: config.cards.filter((_, idx) => idx !== i) })}
        />
      ))}
    </div>
    {config.cards.length < 12 && (
      <button
        onClick={() => onChange({ ...config, cards: [...config.cards, newCard()] })}
        className="w-full py-2 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-500 hover:border-indigo-300 hover:text-indigo-600 transition-colors flex items-center justify-center gap-2"
      >
        <Plus size={14} /> Add card
      </button>
    )}
  </div>
);

// ─── Editor ───────────────────────────────────────────────────────────────────

const CategoryDiscoveryEditor: React.FC<{ sectionId: string; onBack: () => void }> = ({ sectionId, onBack }) => (
  <SectionEditor<CategoryDiscoveryConfig>
    sectionId={sectionId}
    sectionLabel="Category Discovery"
    onBack={onBack}
    defaultConfig={DEFAULT}
    parseConfig={parse}
    renderPreview={(config) => <Preview config={config} />}
    renderContent={(config, onChange) => <ContentTab config={config} onChange={onChange} />}
  />
);

export default CategoryDiscoveryEditor;
