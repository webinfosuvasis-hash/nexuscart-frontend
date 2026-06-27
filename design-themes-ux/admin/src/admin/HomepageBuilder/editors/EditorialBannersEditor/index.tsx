/**
 * EditorialBannersEditor — Editorial Banner Carousel (Section 9)
 *
 * 3-card carousel: 9KT Gold (lavender), Golden Hour (terracotta), Pretty in Purple (cream).
 * Paginated at 3 cards per page — same UX as Hero Banner slide management.
 */

import React, { useState } from 'react';
import { Plus, Trash2, Pencil, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { SectionEditor } from '../framework/SectionEditor';
import {
  Label, Hint, FieldGroup, SectionDivider, TextInput,
  ColorInput, ToggleGroup, UrlField,
} from '../framework/FormFields';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EditorialCard {
  id: string;
  isEnabled: boolean;
  backgroundType: 'solid' | 'gradient';
  backgroundColor: string;
  gradientTo: string;
  categoryLabel: string;
  headline: string;
  subHeadline: string;
  ctaText: string;
  ctaUrl: string;
  disclaimer: string;
}

export interface EditorialBannersConfig {
  cards: EditorialCard[];
}

const mkCard = (id: string, bg: string, gradTo: string, label: string, headline: string, cta: string): EditorialCard => ({
  id, isEnabled: true, backgroundType: 'gradient', backgroundColor: bg, gradientTo: gradTo,
  categoryLabel: label, headline, subHeadline: '', ctaText: cta, ctaUrl: '/', disclaimer: '',
});

const DEFAULT: EditorialBannersConfig = {
  cards: [
    mkCard('1', '#EEE6FF', '#EEE6FF', '9KT GOLD',      '9KT Gold',           'STARTING AT ₹5000'),
    mkCard('2', '#D4836A', '#B85A3F', 'GOLDEN HOUR',   'Golden Hour Styles', 'SHOP NOW'),
    mkCard('3', '#F5EAE0', '#F5EAE0', 'PRETTY PURPLE', 'Pretty in purple,',  'SHOP NOW ▶'),
    mkCard('4', '#E0F4EC', '#E0F4EC', 'DIAMOND',       'Diamond Studded',    'SHOP DIAMONDS'),
    mkCard('5', '#4A1D96', '#6D28D9', 'MIDNIGHT',      'Midnight Collection','EXPLORE'),
    mkCard('6', '#FFF0F5', '#FFF0F5', 'ROSE GOLD',     'Rose Gold Edit',     'SHOP NOW ▶'),
  ],
};

function parse(raw: unknown): EditorialBannersConfig {
  if (!raw || typeof raw !== 'object') return DEFAULT;
  const r = raw as Partial<EditorialBannersConfig>;
  return { cards: Array.isArray(r.cards) && r.cards.length ? r.cards : DEFAULT.cards };
}

// ─── Preview ──────────────────────────────────────────────────────────────────

const Preview: React.FC<{ config: EditorialBannersConfig }> = ({ config }) => {
  const visible = config.cards.filter(c => c.isEnabled).slice(0, 3);
  return (
    <div className="flex gap-1.5 p-1.5 bg-white rounded-2xl" style={{ minHeight: '120px' }}>
      {visible.map(card => (
        <div key={card.id} className="flex-1 rounded-xl flex flex-col justify-end p-2 min-h-[120px]"
          style={{ background: card.backgroundType === 'gradient'
            ? `linear-gradient(135deg, ${card.backgroundColor} 0%, ${card.gradientTo} 100%)`
            : card.backgroundColor
          }}>
          {card.categoryLabel && <p className="text-[6px] font-black uppercase text-white/60 mb-0.5">{card.categoryLabel}</p>}
          <p className="text-[9px] font-bold text-slate-800 leading-tight">{card.headline}</p>
          {card.subHeadline && <p className="text-[7px] text-slate-600">{card.subHeadline}</p>}
          <div className="mt-1 px-2 py-0.5 bg-gray-900/40 rounded text-white text-[6px] font-bold inline-block self-start">{card.ctaText}</div>
        </div>
      ))}
      {visible.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">No enabled cards</div>
      )}
    </div>
  );
};

// ─── Card form ────────────────────────────────────────────────────────────────

const CardForm: React.FC<{
  card: EditorialCard;
  onApply: (c: EditorialCard) => void;
  onCancel: () => void;
}> = ({ card, onApply, onCancel }) => {
  const [local, setLocal] = useState({ ...card });
  const p = (patch: Partial<EditorialCard>) => setLocal(prev => ({ ...prev, ...patch }));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
        <button onClick={onCancel} className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"><ArrowLeft size={14} /></button>
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Edit Card</h3>
      </div>
      <FieldGroup><Label>Background type</Label>
        <ToggleGroup value={local.backgroundType} onChange={v => p({ backgroundType: v as any })}
          options={[{label:'Solid',value:'solid'},{label:'Gradient',value:'gradient'}]} />
      </FieldGroup>
      <div className="grid grid-cols-2 gap-2">
        <FieldGroup><Label>BG colour {local.backgroundType==='gradient' ? '(from)' : ''}</Label><ColorInput value={local.backgroundColor} onChange={v => p({ backgroundColor: v })} /></FieldGroup>
        {local.backgroundType === 'gradient' && (
          <FieldGroup><Label>BG colour (to)</Label><ColorInput value={local.gradientTo} onChange={v => p({ gradientTo: v })} /></FieldGroup>
        )}
      </div>
      <FieldGroup><Label>Category label</Label><TextInput value={local.categoryLabel} onChange={v => p({ categoryLabel: v })} placeholder="9KT GOLD" /></FieldGroup>
      <FieldGroup><Label>Headline</Label><TextInput value={local.headline} onChange={v => p({ headline: v })} /></FieldGroup>
      <FieldGroup><Label>Sub-headline</Label><TextInput value={local.subHeadline} onChange={v => p({ subHeadline: v })} /></FieldGroup>
      <FieldGroup><Label>CTA text</Label><TextInput value={local.ctaText} onChange={v => p({ ctaText: v })} /></FieldGroup>
      <UrlField label="CTA URL" value={local.ctaUrl} onChange={v => p({ ctaUrl: v })} />
      <FieldGroup><Label>Disclaimer</Label><TextInput value={local.disclaimer} onChange={v => p({ disclaimer: v })} placeholder="TCA" /></FieldGroup>
      <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
        <button onClick={onCancel} className="flex-1 py-1.5 text-sm text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Cancel</button>
        <button onClick={() => onApply(local)} className="flex-1 py-1.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors">Apply</button>
      </div>
    </div>
  );
};

// ─── Content form ─────────────────────────────────────────────────────────────

const ContentTab: React.FC<{ config: EditorialBannersConfig; onChange: (c: EditorialBannersConfig) => void }> = ({ config, onChange }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingCard = editingId ? config.cards.find(c => c.id === editingId) : null;

  if (editingCard) {
    return (
      <CardForm
        card={editingCard}
        onApply={updated => { onChange({ ...config, cards: config.cards.map(c => c.id === updated.id ? updated : c) }); setEditingId(null); }}
        onCancel={() => setEditingId(null)}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Banner Cards</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">Displayed 3 per page · max 12 cards</p>
        </div>
        {config.cards.length < 12 && (
          <button
            onClick={() => {
              const c: EditorialCard = { id: `c-${Date.now()}`, isEnabled: true, backgroundType: 'solid', backgroundColor: '#EEE6FF', gradientTo: '#EEE6FF', categoryLabel: 'NEW', headline: 'New Banner', subHeadline: '', ctaText: 'Shop Now', ctaUrl: '/', disclaimer: '' };
              onChange({ ...config, cards: [...config.cards, c] });
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            <Plus size={11} /> Add
          </button>
        )}
      </div>
      <div className="space-y-2">
        {config.cards.map((card, i) => (
          <div key={card.id} className="flex items-center gap-2 p-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900">
            <div className="w-10 h-8 rounded-lg flex-shrink-0" style={{ background: card.backgroundType === 'gradient' ? `linear-gradient(135deg, ${card.backgroundColor}, ${card.gradientTo})` : card.backgroundColor }} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">{card.headline || 'Unnamed'}</p>
              <p className="text-[10px] text-slate-400 truncate">{card.categoryLabel}</p>
            </div>
            <button onClick={() => onChange({ ...config, cards: config.cards.map(c => c.id === card.id ? { ...c, isEnabled: !c.isEnabled } : c) })}
              className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${card.isEnabled ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-slate-100 text-slate-500'}`}>
              {card.isEnabled ? 'On' : 'Off'}
            </button>
            <button onClick={() => setEditingId(card.id)} className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"><Pencil size={12} /></button>
            <button onClick={() => { if (config.cards.length <= 1) { toast.error('Need at least 1 card'); return; } onChange({ ...config, cards: config.cards.filter((_, idx) => idx !== i) }); }}
              className="p-1 text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={12} /></button>
          </div>
        ))}
      </div>
      <Hint>Pages are auto-calculated at 3 cards per page. Disabled cards are hidden from the storefront.</Hint>
    </div>
  );
};

// ─── Editor ───────────────────────────────────────────────────────────────────

const EditorialBannersEditor: React.FC<{ sectionId: string; onBack: () => void }> = ({ sectionId, onBack }) => (
  <SectionEditor<EditorialBannersConfig>
    sectionId={sectionId}
    sectionLabel="Editorial Banners"
    onBack={onBack}
    defaultConfig={DEFAULT}
    parseConfig={parse}
    renderPreview={(config) => <Preview config={config} />}
    renderContent={(config, onChange) => <ContentTab config={config} onChange={onChange} />}
  />
);

export default EditorialBannersEditor;
