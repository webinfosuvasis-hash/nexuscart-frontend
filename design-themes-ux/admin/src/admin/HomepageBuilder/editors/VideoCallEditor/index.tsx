/**
 * VideoCallEditor — Video Call Service Card (Section 12)
 *
 * Full-height dark purple gradient card with "Schedule a Video Call" CTA.
 * Appears as the right card in the dual service card pair.
 */

import React from 'react';
import { SectionEditor } from '../framework/SectionEditor';
import { Label, FieldGroup, SectionDivider, TextInput, ColorInput, ImageField, UrlField, Hint } from '../framework/FormFields';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VideoCallConfig {
  backgroundImage: string;
  gradientColor: string;
  gradientOpacity: number;
  headlineL1: string;
  headlineL2: string;
  ctaText: string;
  ctaUrl: string;
}

const DEFAULT: VideoCallConfig = {
  backgroundImage: '',
  gradientColor: '#581C87',
  gradientOpacity: 85,
  headlineL1: 'View Designs on',
  headlineL2: 'Live Video Call',
  ctaText: 'SCHEDULE A VIDEO CALL',
  ctaUrl: '/services/video-call',
};

function parse(raw: unknown): VideoCallConfig {
  if (!raw || typeof raw !== 'object') return DEFAULT;
  return { ...DEFAULT, ...(raw as Partial<VideoCallConfig>) };
}

// ─── Preview ──────────────────────────────────────────────────────────────────

const Preview: React.FC<{ config: VideoCallConfig }> = ({ config }) => {
  const overlayHex = Math.round((config.gradientOpacity / 100) * 255).toString(16).padStart(2, '0');
  return (
    <div className="relative rounded-2xl overflow-hidden" style={{ minHeight: '200px' }}>
      {config.backgroundImage
        ? <img src={config.backgroundImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
        : <div className="absolute inset-0 bg-gradient-to-br from-purple-950 to-purple-700" />
      }
      <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${config.gradientColor}${overlayHex} 0%, ${config.gradientColor}60 50%, ${config.gradientColor}20 100%)` }} />
      <div className="absolute bottom-4 left-4 right-4 z-10">
        <p className="text-white text-sm font-bold leading-snug">{config.headlineL1}</p>
        <p className="text-white text-sm font-bold leading-snug">{config.headlineL2}</p>
        <div className="mt-2 inline-block px-3 py-1.5 bg-white/15 border border-white/30 text-white text-[10px] font-bold tracking-wider rounded-sm">
          {config.ctaText}
        </div>
      </div>
    </div>
  );
};

// ─── Content form ─────────────────────────────────────────────────────────────

const ContentTab: React.FC<{ config: VideoCallConfig; onChange: (c: VideoCallConfig) => void }> = ({ config, onChange }) => (
  <div className="space-y-4">
    <SectionDivider label="Background" />
    <FieldGroup>
      <Label>Background image</Label>
      <ImageField value={config.backgroundImage} onChange={backgroundImage => onChange({ ...config, backgroundImage })} />
      <Hint>Optional — if left empty, a solid purple gradient is shown.</Hint>
    </FieldGroup>
    <div className="grid grid-cols-2 gap-3">
      <FieldGroup><Label>Gradient colour</Label><ColorInput value={config.gradientColor} onChange={gradientColor => onChange({ ...config, gradientColor })} /></FieldGroup>
      <FieldGroup>
        <Label>Gradient opacity</Label>
        <input type="range" min={0} max={100} step={5} value={config.gradientOpacity}
          onChange={e => onChange({ ...config, gradientOpacity: Number(e.target.value) })} className="w-full accent-indigo-600 mt-2" />
      </FieldGroup>
    </div>

    <SectionDivider label="Text" />
    <FieldGroup><Label>Headline line 1</Label><TextInput value={config.headlineL1} onChange={headlineL1 => onChange({ ...config, headlineL1 })} /></FieldGroup>
    <FieldGroup><Label>Headline line 2</Label><TextInput value={config.headlineL2} onChange={headlineL2 => onChange({ ...config, headlineL2 })} /></FieldGroup>

    <SectionDivider label="CTA Button" />
    <FieldGroup><Label>Button text</Label><TextInput value={config.ctaText} onChange={ctaText => onChange({ ...config, ctaText })} /></FieldGroup>
    <UrlField label="Button URL" value={config.ctaUrl} onChange={ctaUrl => onChange({ ...config, ctaUrl })} />
    <Hint>This also controls the Video Call badge on product pages and the Services dropdown in the header.</Hint>
  </div>
);

// ─── Editor ───────────────────────────────────────────────────────────────────

const VideoCallEditor: React.FC<{ sectionId: string; onBack: () => void }> = ({ sectionId, onBack }) => (
  <SectionEditor<VideoCallConfig>
    sectionId={sectionId}
    sectionLabel="Video Call"
    onBack={onBack}
    defaultConfig={DEFAULT}
    parseConfig={parse}
    renderPreview={(config) => <Preview config={config} />}
    renderContent={(config, onChange) => <ContentTab config={config} onChange={onChange} />}
  />
);

export default VideoCallEditor;
