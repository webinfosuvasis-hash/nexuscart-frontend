/**
 * GiftRegistryEditor — Gift Registry Section (Section 13)
 *
 * 3-column lavender section:
 *   Left:   Emotional copy, occasion tags, CTA button, social proof
 *   Centre: Gift box illustration with floating emoji icons
 *   Right:  "How it works" steps
 */

import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { SectionEditor } from '../framework/SectionEditor';
import {
  Label, Hint, FieldGroup, SectionDivider, TextInput, TextArea,
  TagListEditor, UrlField,
} from '../framework/FormFields';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RegistryStep {
  id: string;
  icon: string;
  title: string;
  description: string;
}

export interface GiftRegistryConfig {
  occasionLabel: string;
  headline: string;
  bodyCopy: string;
  occasionTags: string[];
  ctaText: string;
  ctaUrl: string;
  socialProofText: string;
  socialProofSub: string;
  centerIcon: string;
  howItWorksLabel: string;
  steps: RegistryStep[];
}

const DEFAULT: GiftRegistryConfig = {
  occasionLabel: 'Celebrate Together',
  headline: 'Create Your Gift Registry',
  bodyCopy: 'Curate your perfect wishlist for every special moment. Your loved ones will always know exactly what makes you happy.',
  occasionTags: ['🤝 Wedding', '🪔 Puja', '✨ Party', '💼 Office', '🎁 Gift'],
  ctaText: 'Start Your Registry →',
  ctaUrl: '/registry',
  socialProofText: '★★★★★ Trusted by 8,500+ families',
  socialProofSub: 'Perfect for Weddings, Anniversaries & Festivals',
  centerIcon: '🎁',
  howItWorksLabel: 'How it works',
  steps: [
    { id: '1', icon: '📝', title: 'Create Registry',    description: 'Pick your occasion & add your wishlist' },
    { id: '2', icon: '🔗', title: 'Share with Family',  description: 'Send a link or share via WhatsApp' },
    { id: '3', icon: '🛍', title: 'Friends Gift You',   description: 'They buy directly from your list' },
    { id: '4', icon: '✅', title: 'Track Gifts',        description: "See what's been gifted in real time" },
  ],
};

function parse(raw: unknown): GiftRegistryConfig {
  if (!raw || typeof raw !== 'object') return DEFAULT;
  const r = raw as Partial<GiftRegistryConfig>;
  return {
    ...DEFAULT,
    ...r,
    occasionTags: Array.isArray(r.occasionTags) ? r.occasionTags : DEFAULT.occasionTags,
    steps: Array.isArray(r.steps) && r.steps.length ? r.steps : DEFAULT.steps,
  };
}

// ─── Preview ──────────────────────────────────────────────────────────────────

const Preview: React.FC<{ config: GiftRegistryConfig }> = ({ config }) => (
  <div className="rounded-2xl p-4 grid grid-cols-[1fr_60px_1fr] gap-3" style={{ background: 'linear-gradient(135deg, #F5F0FF 0%, #EDE9FE 55%, #FAF0FF 100%)' }}>
    <div className="space-y-1">
      <p className="text-[7px] text-purple-400 font-bold uppercase tracking-widest">{config.occasionLabel}</p>
      <p className="text-[11px] font-light text-gray-900 leading-snug">{config.headline}</p>
      <div className="flex flex-wrap gap-0.5 mt-1">
        {config.occasionTags.slice(0, 4).map(t => (
          <span key={t} className="text-[6px] px-1.5 py-0.5 rounded-full border border-purple-200 bg-white/70 text-purple-700">{t}</span>
        ))}
      </div>
      <div className="mt-1 px-2 py-0.5 bg-purple-700 text-white text-[7px] font-bold rounded-full inline-block">{config.ctaText}</div>
    </div>
    <div className="flex items-center justify-center text-3xl">{config.centerIcon}</div>
    <div className="space-y-1.5">
      <p className="text-[7px] text-purple-400 font-bold uppercase">{config.howItWorksLabel}</p>
      {config.steps.slice(0, 4).map(s => (
        <div key={s.id} className="flex items-start gap-1">
          <span className="text-[8px]">{s.icon}</span>
          <div>
            <p className="text-[7px] font-bold text-gray-800">{s.title}</p>
            <p className="text-[6px] text-gray-500">{s.description}</p>
          </div>
        </div>
      ))}
    </div>
  </div>
);

// ─── Content form ─────────────────────────────────────────────────────────────

const ContentTab: React.FC<{ config: GiftRegistryConfig; onChange: (c: GiftRegistryConfig) => void }> = ({ config, onChange }) => {
  const patchStep = (i: number, p: Partial<RegistryStep>) =>
    onChange({ ...config, steps: config.steps.map((s, idx) => idx === i ? { ...s, ...p } : s) });

  return (
    <div className="space-y-4">
      <SectionDivider label="Left Column (Copy + CTA)" />
      <FieldGroup><Label>Occasion label</Label><TextInput value={config.occasionLabel} onChange={v => onChange({ ...config, occasionLabel: v })} /></FieldGroup>
      <FieldGroup><Label>Headline</Label><TextInput value={config.headline} onChange={v => onChange({ ...config, headline: v })} /></FieldGroup>
      <FieldGroup><Label>Body copy</Label><TextArea value={config.bodyCopy} onChange={v => onChange({ ...config, bodyCopy: v })} rows={3} /></FieldGroup>
      <FieldGroup><Label>Occasion tags</Label><TagListEditor tags={config.occasionTags} onChange={tags => onChange({ ...config, occasionTags: tags })} placeholder="🤝 Wedding" /></FieldGroup>
      <FieldGroup><Label>CTA text</Label><TextInput value={config.ctaText} onChange={v => onChange({ ...config, ctaText: v })} /></FieldGroup>
      <UrlField label="CTA URL" value={config.ctaUrl} onChange={v => onChange({ ...config, ctaUrl: v })} />
      <FieldGroup><Label>Social proof text</Label><TextInput value={config.socialProofText} onChange={v => onChange({ ...config, socialProofText: v })} /></FieldGroup>
      <FieldGroup><Label>Social proof sub-text</Label><TextInput value={config.socialProofSub} onChange={v => onChange({ ...config, socialProofSub: v })} /></FieldGroup>

      <SectionDivider label="Centre (Illustration)" />
      <FieldGroup>
        <Label>Centre icon (emoji)</Label>
        <TextInput value={config.centerIcon} onChange={v => onChange({ ...config, centerIcon: v })} placeholder="🎁" />
        <Hint>Displayed as a large icon in the centre column.</Hint>
      </FieldGroup>

      <SectionDivider label="Right Column (How It Works)" />
      <FieldGroup><Label>Column label</Label><TextInput value={config.howItWorksLabel} onChange={v => onChange({ ...config, howItWorksLabel: v })} /></FieldGroup>
      <div className="space-y-2">
        {config.steps.map((step, i) => (
          <div key={step.id} className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 space-y-2 bg-white dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Step {i + 1}</span>
              {config.steps.length > 1 && (
                <button onClick={() => onChange({ ...config, steps: config.steps.filter((_, idx) => idx !== i) })}
                  className="p-1 text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={12} /></button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1"><Label>Icon</Label><TextInput value={step.icon} onChange={v => patchStep(i, { icon: v })} placeholder="📝" /></div>
              <div className="col-span-2"><Label>Title</Label><TextInput value={step.title} onChange={v => patchStep(i, { title: v })} /></div>
            </div>
            <FieldGroup><Label>Description</Label><TextInput value={step.description} onChange={v => patchStep(i, { description: v })} /></FieldGroup>
          </div>
        ))}
      </div>
      {config.steps.length < 6 && (
        <button
          onClick={() => onChange({ ...config, steps: [...config.steps, { id: `step-${Date.now()}`, icon: '✅', title: 'New Step', description: 'Step description' }] })}
          className="w-full py-2 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-500 hover:border-indigo-300 hover:text-indigo-600 transition-colors flex items-center justify-center gap-2"
        >
          <Plus size={14} /> Add step
        </button>
      )}
    </div>
  );
};

// ─── Editor ───────────────────────────────────────────────────────────────────

const GiftRegistryEditor: React.FC<{ sectionId: string; onBack: () => void }> = ({ sectionId, onBack }) => (
  <SectionEditor<GiftRegistryConfig>
    sectionId={sectionId}
    sectionLabel="Gift Registry"
    onBack={onBack}
    defaultConfig={DEFAULT}
    parseConfig={parse}
    renderPreview={(config) => <Preview config={config} />}
    renderContent={(config, onChange) => <ContentTab config={config} onChange={onChange} />}
  />
);

export default GiftRegistryEditor;
