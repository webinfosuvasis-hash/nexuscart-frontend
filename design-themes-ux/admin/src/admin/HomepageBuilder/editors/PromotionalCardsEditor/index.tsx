/**
 * PromotionalCardsEditor — Promotional Cards Carousel (Section 14)
 *
 * 3-card paginated carousel: Treasure Chest (purple), Silver (teal), Gold Exchange (amber).
 * Same pattern as EditorialBannersEditor — card list with inline card editor.
 */

import React, { useState } from 'react';
import { Plus, Trash2, Pencil, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { SectionEditor } from '../framework/SectionEditor';
import {
  Label, FieldGroup, SectionDivider, TextInput, ColorInput, UrlField, Hint, ToggleGroup,
} from '../framework/FormFields';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PromoCard {
  id: string;
  isEnabled: boolean;
  backgroundType: 'solid' | 'gradient';
  backgroundColor: string;
  gradientTo: string;
  icon: string;
  categoryLabel: string;
  headline: string;
  ctaText: string;
  ctaUrl: string;
  disclaimer: string;
}

export interface PromotionalCardsConfig {
  cards: PromoCard[];
}

const mkCard = (id: string, from: string, to: string, icon: string, label: string, headline: string, cta: string): PromoCard => ({
  id, isEnabled: true, backgroundType: 'gradient', backgroundColor: from, gradientTo: to,
  icon, categoryLabel: label, headline, ctaText: cta, ctaUrl: '/', disclaimer: 'Terms & Condition Apply',
});

const DEFAULT: PromotionalCardsConfig = {
  cards: [
    mkCard('1', '#2D0A52', '#5B21B6', '💎', 'AURUS TREASURE CHEST', 'Get your 10th instalment FREE', 'Enrol Now'),
    mkCard('2', '#00BFA5', '#00897B', '🥈', 'ONE OF A KIND',        'Silver Jewellery',              'Shop Now'),
    mkCard('3', '#9A6B00', '#D4A017', '🪙', 'GOLD EXCHANGE PROGRAM','Enjoy 0% Deduction on exchange value','Calculate Your Gold Value'),
    mkCard('4', '#BE185D', '#9D174D', '🎁', 'GIFTING MADE EASY',    'Birthday Gifts Starting ₹999',  'Shop Gifts'),
    mkCard('5', '#F9A8D4', '#EC4899', '💍', 'WEDDING SEASON',       'Complete the Look',             'Shop Bridal'),
    mkCard('6', '#065F46', '#059669', '📦', 'DAILY WEAR DROPS',     'New Every Week',                'Shop Now'),
  ],
};

function parse(raw: unknown): PromotionalCardsConfig {
  if (!raw || typeof raw !== 'object') return DEFAULT;
  const r = raw as Partial<PromotionalCardsConfig>;
  return { cards: Array.isArray(r.cards) && r.cards.length ? r.cards : DEFAULT.cards };
}

// ─── Preview ──────────────────────────────────────────────────────────────────

const Preview: React.FC<{ config: PromotionalCardsConfig }> = ({ config }) => {
  const visible = config.cards.filter(c => c.isEnabled).slice(0, 3);
  return (
    <div className="flex gap-1.5 p-1.5 bg-white rounded-2xl" style={{ minHeight: '100px' }}>
      {visible.map(card => (
        <div key={card.id} className="flex-1 rounded-xl flex flex-col justify-between p-2 min-h-[100px]"
          style={{ background: card.backgroundType === 'gradient'
            ? `linear-gradient(135deg, ${card.backgroundColor} 0%, ${card.gradientTo} 100%)`
            : card.backgroundColor
          }}>
          <div>
            <p className="text-[8px] text-yellow-300 font-black uppercase">{card.categoryLabel}</p>
            <p className="text-[7px] leading-none mt-0.5 mb-0.5">{card.icon}</p>
            <p className="text-[9px] font-bold text-white leading-tight">{card.headline}</p>
          </div>
          <div>
            <div className="mt-1 px-2 py-0.5 bg-white text-gray-900 text-[6px] font-bold rounded inline-block">{card.ctaText}</div>
          </div>
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
  card: PromoCard;
  onApply: (c: PromoCard) => void;
  onCancel: () => void;
}> = ({ card, onApply, onCancel }) => {
  const [local, setLocal] = useState({ ...card });
  const p = (patch: Partial<PromoCard>) => setLocal(prev => ({ ...prev, ...patch }));

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
        <FieldGroup><Label>Colour {local.backgroundType==='gradient' ? '(from)' : ''}</Label><ColorInput value={local.backgroundColor} onChange={v => p({ backgroundColor: v })} /></FieldGroup>
        {local.backgroundType === 'gradient' && (
          <FieldGroup><Label>Colour (to)</Label><ColorInput value={local.gradientTo} onChange={v => p({ gradientTo: v })} /></FieldGroup>
        )}
      </div>
      <FieldGroup><Label>Icon (emoji)</Label><TextInput value={local.icon} onChange={v => p({ icon: v })} placeholder="💎" /></FieldGroup>
      <FieldGroup><Label>Category label</Label><TextInput value={local.categoryLabel} onChange={v => p({ categoryLabel: v })} placeholder="AURUS TREASURE CHEST" /></FieldGroup>
      <FieldGroup><Label>Headline</Label><TextInput value={local.headline} onChange={v => p({ headline: v })} /></FieldGroup>
      <FieldGroup><Label>CTA text</Label><TextInput value={local.ctaText} onChange={v => p({ ctaText: v })} /></FieldGroup>
      <UrlField label="CTA URL" value={local.ctaUrl} onChange={v => p({ ctaUrl: v })} />
      <FieldGroup><Label>Disclaimer</Label><TextInput value={local.disclaimer} onChange={v => p({ disclaimer: v })} placeholder="Terms & Condition Apply" /></FieldGroup>
      <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
        <button onClick={onCancel} className="flex-1 py-1.5 text-sm text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800">Cancel</button>
        <button onClick={() => onApply(local)} className="flex-1 py-1.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg">Apply</button>
      </div>
    </div>
  );
};

// ─── Content form ─────────────────────────────────────────────────────────────

const ContentTab: React.FC<{ config: PromotionalCardsConfig; onChange: (c: PromotionalCardsConfig) => void }> = ({ config, onChange }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingCard = editingId ? config.cards.find(c => c.id === editingId) : null;

  if (editingCard) {
    return (
      <CardForm
        card={editingCard}
        onApply={u => { onChange({ cards: config.cards.map(c => c.id === u.id ? u : c) }); setEditingId(null); }}
        onCancel={() => setEditingId(null)}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Promotional Cards</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">Displayed 3 per page · max 12 cards</p>
        </div>
        {config.cards.length < 12 && (
          <button
            onClick={() => {
              const c: PromoCard = { id: `c-${Date.now()}`, isEnabled: true, backgroundType: 'gradient', backgroundColor: '#2D0A52', gradientTo: '#5B21B6', icon: '🎁', categoryLabel: 'NEW OFFER', headline: 'New Promotional Card', ctaText: 'Shop Now', ctaUrl: '/', disclaimer: 'TCA' };
              onChange({ cards: [...config.cards, c] });
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
            <div className="w-10 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-base"
              style={{ background: card.backgroundType === 'gradient' ? `linear-gradient(135deg, ${card.backgroundColor}, ${card.gradientTo})` : card.backgroundColor }}>
              <span>{card.icon}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">{card.headline}</p>
              <p className="text-[10px] text-slate-400 truncate">{card.categoryLabel}</p>
            </div>
            <button onClick={() => onChange({ cards: config.cards.map(c => c.id === card.id ? { ...c, isEnabled: !c.isEnabled } : c) })}
              className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${card.isEnabled ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-slate-100 text-slate-500'}`}>
              {card.isEnabled ? 'On' : 'Off'}
            </button>
            <button onClick={() => setEditingId(card.id)} className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"><Pencil size={12} /></button>
            <button onClick={() => { if (config.cards.length <= 1) { toast.error('Need at least 1 card'); return; } onChange({ cards: config.cards.filter((_, idx) => idx !== i) }); }}
              className="p-1 text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={12} /></button>
          </div>
        ))}
      </div>
      <Hint>Pages are auto-calculated at 3 cards per page.</Hint>
    </div>
  );
};

// ─── Editor ───────────────────────────────────────────────────────────────────

const PromotionalCardsEditor: React.FC<{ sectionId: string; onBack: () => void }> = ({ sectionId, onBack }) => (
  <SectionEditor<PromotionalCardsConfig>
    sectionId={sectionId}
    sectionLabel="Promotional Cards"
    onBack={onBack}
    defaultConfig={DEFAULT}
    parseConfig={parse}
    renderPreview={(config) => <Preview config={config} />}
    renderContent={(config, onChange) => <ContentTab config={config} onChange={onChange} />}
  />
);

export default PromotionalCardsEditor;
