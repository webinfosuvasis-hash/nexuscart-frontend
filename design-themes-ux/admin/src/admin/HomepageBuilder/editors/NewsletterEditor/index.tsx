/**
 * NewsletterEditor — Newsletter / Aurus Insider (Section 17)
 *
 * Purple gradient section with email subscription form.
 * Connects to the Marketing → Email → Subscriber List.
 */

import React from 'react';
import { SectionEditor } from '../framework/SectionEditor';
import {
  Label, Hint, FieldGroup, SectionDivider, TextInput, ColorInput, UrlField,
} from '../framework/FormFields';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NewsletterConfig {
  gradientFrom: string;
  gradientTo: string;
  label: string;
  headline: string;
  bodyCopy: string;
  inputPlaceholder: string;
  ctaText: string;
  ctaButtonColor: string;
  ctaTextColor: string;
  privacyText: string;
  privacyUrl: string;
}

const DEFAULT: NewsletterConfig = {
  gradientFrom: '#581C87',
  gradientTo: '#6D28D9',
  label: 'Exclusive Access',
  headline: 'Join Aurus Insider',
  bodyCopy: 'Get exclusive offers, early access to new collections, and personalised jewellery recommendations.',
  inputPlaceholder: 'Enter your email address',
  ctaText: 'JOIN NOW',
  ctaButtonColor: '#FFFFFF',
  ctaTextColor: '#581C87',
  privacyText: 'By subscribing, you agree to our Privacy Policy',
  privacyUrl: '/privacy-policy',
};

function parse(raw: unknown): NewsletterConfig {
  if (!raw || typeof raw !== 'object') return DEFAULT;
  return { ...DEFAULT, ...(raw as Partial<NewsletterConfig>) };
}

// ─── Preview ──────────────────────────────────────────────────────────────────

const Preview: React.FC<{ config: NewsletterConfig }> = ({ config }) => (
  <div className="rounded-2xl py-8 px-4 flex flex-col items-center text-center"
    style={{ background: `linear-gradient(135deg, ${config.gradientFrom} 0%, ${config.gradientTo} 100%)` }}>
    <p className="text-purple-300 text-[7px] uppercase tracking-[0.3em] font-semibold mb-1">{config.label}</p>
    <p className="text-white text-sm font-light mb-1">{config.headline}</p>
    <p className="text-purple-200 text-[9px] mb-3 leading-relaxed max-w-[260px]">{config.bodyCopy}</p>
    <div className="flex w-full max-w-xs gap-1.5">
      <div className="flex-1 h-7 rounded-sm border border-white/20 bg-white/10" />
      <div className="px-3 h-7 rounded-sm flex items-center text-[8px] font-bold" style={{ background: config.ctaButtonColor, color: config.ctaTextColor }}>
        {config.ctaText}
      </div>
    </div>
    <p className="text-purple-400 text-[7px] mt-2">{config.privacyText}</p>
  </div>
);

// ─── Content form ─────────────────────────────────────────────────────────────

const ContentTab: React.FC<{ config: NewsletterConfig; onChange: (c: NewsletterConfig) => void }> = ({ config, onChange }) => (
  <div className="space-y-4">
    <SectionDivider label="Background" />
    <div className="grid grid-cols-2 gap-3">
      <FieldGroup><Label>Gradient from</Label><ColorInput value={config.gradientFrom} onChange={v => onChange({ ...config, gradientFrom: v })} /></FieldGroup>
      <FieldGroup><Label>Gradient to</Label><ColorInput value={config.gradientTo} onChange={v => onChange({ ...config, gradientTo: v })} /></FieldGroup>
    </div>

    <SectionDivider label="Content" />
    <FieldGroup><Label>Label</Label><TextInput value={config.label} onChange={label => onChange({ ...config, label })} placeholder="Exclusive Access" /></FieldGroup>
    <FieldGroup><Label>Headline</Label><TextInput value={config.headline} onChange={headline => onChange({ ...config, headline })} /></FieldGroup>
    <FieldGroup><Label>Body copy</Label><TextInput value={config.bodyCopy} onChange={bodyCopy => onChange({ ...config, bodyCopy })} /></FieldGroup>
    <FieldGroup><Label>Input placeholder</Label><TextInput value={config.inputPlaceholder} onChange={inputPlaceholder => onChange({ ...config, inputPlaceholder })} /></FieldGroup>

    <SectionDivider label="CTA Button" />
    <FieldGroup><Label>Button text</Label><TextInput value={config.ctaText} onChange={ctaText => onChange({ ...config, ctaText })} /></FieldGroup>
    <div className="grid grid-cols-2 gap-3">
      <FieldGroup><Label>Button background</Label><ColorInput value={config.ctaButtonColor} onChange={v => onChange({ ...config, ctaButtonColor: v })} /></FieldGroup>
      <FieldGroup><Label>Button text colour</Label><ColorInput value={config.ctaTextColor} onChange={v => onChange({ ...config, ctaTextColor: v })} /></FieldGroup>
    </div>

    <SectionDivider label="Privacy" />
    <FieldGroup><Label>Privacy text</Label><TextInput value={config.privacyText} onChange={privacyText => onChange({ ...config, privacyText })} /></FieldGroup>
    <UrlField label="Privacy policy URL" value={config.privacyUrl} onChange={privacyUrl => onChange({ ...config, privacyUrl })} />
    <Hint>Email subscribers are added to Marketing → Email → Subscriber List automatically.</Hint>
  </div>
);

// ─── Editor ───────────────────────────────────────────────────────────────────

const NewsletterEditor: React.FC<{ sectionId: string; onBack: () => void }> = ({ sectionId, onBack }) => (
  <SectionEditor<NewsletterConfig>
    sectionId={sectionId}
    sectionLabel="Newsletter"
    onBack={onBack}
    defaultConfig={DEFAULT}
    parseConfig={parse}
    renderPreview={(config) => <Preview config={config} />}
    renderContent={(config, onChange) => <ContentTab config={config} onChange={onChange} />}
  />
);

export default NewsletterEditor;
