/**
 * SlideForm — configuration panel for a single hero slide.
 *
 * Renders different fields based on slide.type:
 *   'banner'   → image upload, alt text, optional link URL
 *   'editorial' → background image, gradient overlay, text fields, CTA
 *
 * Uses the existing ImageUpload component from @/components/ImageUpload.
 * All changes are local — the parent calls onApply to commit them to the config.
 */

import React, { useState } from 'react';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import ImageUpload from '@/components/ImageUpload';
import type { HeroSlide, BannerSlide, EditorialSlide } from './types';
import { isBannerSlide, isEditorialSlide } from './types';

// ─── Shared field primitives ──────────────────────────────────────────────────

const Label: React.FC<{ children: React.ReactNode; required?: boolean }> = ({ children, required }) => (
  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
    {children}
    {required && <span className="text-red-500 ml-0.5">*</span>}
  </label>
);

const TextInput: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}> = ({ value, onChange, placeholder, type = 'text' }) => (
  <input
    type={type}
    value={value}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 outline-none focus:border-indigo-400 dark:focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/30 transition-all"
  />
);

const Hint: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{children}</p>
);

// ─── Gradient editor ──────────────────────────────────────────────────────────

const GradientEditor: React.FC<{
  value: EditorialSlide['overlayGradient'];
  onChange: (v: EditorialSlide['overlayGradient']) => void;
}> = ({ value, onChange }) => (
  <div className="space-y-2">
    <div className="grid grid-cols-2 gap-3">
      {/* From colour */}
      <div>
        <Label>Start colour</Label>
        <div className="flex gap-2">
          <input
            type="color"
            value={value.from}
            onChange={e => onChange({ ...value, from: e.target.value })}
            className="w-9 h-8 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer bg-transparent"
          />
          <TextInput
            value={value.from}
            onChange={from => onChange({ ...value, from })}
            placeholder="#6B21A8"
          />
        </div>
      </div>
      {/* To colour */}
      <div>
        <Label>End colour</Label>
        <div className="flex gap-2">
          <input
            type="color"
            value={value.to}
            onChange={e => onChange({ ...value, to: e.target.value })}
            className="w-9 h-8 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer bg-transparent"
          />
          <TextInput
            value={value.to}
            onChange={to => onChange({ ...value, to })}
            placeholder="#1B4D3E"
          />
        </div>
      </div>
    </div>
    {/* Opacity sliders */}
    <div className="grid grid-cols-2 gap-3">
      <div>
        <Label>Start opacity</Label>
        <div className="flex items-center gap-2">
          <input
            type="range" min={0} max={100} step={5}
            value={value.fromAlpha}
            onChange={e => onChange({ ...value, fromAlpha: Number(e.target.value) })}
            className="flex-1 accent-indigo-600"
          />
          <span className="text-xs text-slate-500 w-8 text-right">{value.fromAlpha}%</span>
        </div>
      </div>
      <div>
        <Label>End opacity</Label>
        <div className="flex items-center gap-2">
          <input
            type="range" min={0} max={100} step={5}
            value={value.toAlpha}
            onChange={e => onChange({ ...value, toAlpha: Number(e.target.value) })}
            className="flex-1 accent-indigo-600"
          />
          <span className="text-xs text-slate-500 w-8 text-right">{value.toAlpha}%</span>
        </div>
      </div>
    </div>
    {/* Preview swatch */}
    <div
      className="h-6 rounded-lg border border-slate-200 dark:border-slate-700"
      style={{
        background: `linear-gradient(to right, ${value.from}${Math.round(value.fromAlpha * 2.55).toString(16).padStart(2, '0')}, ${value.to}${Math.round(value.toAlpha * 2.55).toString(16).padStart(2, '0')})`,
      }}
    />
  </div>
);

// ─── Type toggle ──────────────────────────────────────────────────────────────

const TypeToggle: React.FC<{
  value: 'banner' | 'editorial';
  onChange: (v: 'banner' | 'editorial') => void;
}> = ({ value, onChange }) => (
  <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
    {(['banner', 'editorial'] as const).map(type => (
      <button
        key={type}
        onClick={() => onChange(type)}
        className={[
          'flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all capitalize',
          value === type
            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300',
        ].join(' ')}
      >
        {type}
      </button>
    ))}
  </div>
);

// ─── Main form component ──────────────────────────────────────────────────────

interface SlideFormProps {
  slide:     HeroSlide;
  /** Called immediately on every field change — no "Apply" step required. */
  onUpdate:  (updated: HeroSlide) => void;
  /** Called to close the form without further action (changes already committed). */
  onClose:   () => void;
  /** Called to revert the slide to the snapshot taken when editing began. */
  onRevert:  () => void;
}

const SlideForm: React.FC<SlideFormProps> = ({ slide, onUpdate, onClose, onRevert }) => {
  // local mirrors parent but allows fast UI feedback before the parent re-renders
  const [local, setLocal] = useState<HeroSlide>(() => ({ ...slide }));
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ── Auto-apply: propagate every change to the parent config immediately ──
  const apply = (updated: HeroSlide) => {
    setLocal(updated);
    onUpdate(updated);
  };

  // ── Type switch — converts between banner and editorial ──────────────────
  const handleTypeChange = (newType: 'banner' | 'editorial') => {
    if (newType === local.type) return;
    const updated: HeroSlide = newType === 'banner'
      ? { id: local.id, type: 'banner', isEnabled: local.isEnabled, src: '', alt: '', linkUrl: '' }
      : {
          id: local.id, type: 'editorial', isEnabled: local.isEnabled,
          backgroundImage: '',
          overlayGradient: { from: '#3B0764', fromAlpha: 88, to: '#6D28D9', toAlpha: 10 },
          eyebrowText: '', brandName: '', headlineL1: '', headlineL2: '',
          headlineL2Color: '#FEF08A', disclaimer: '', ctaText: 'Shop Now', ctaUrl: '/',
        };
    setErrors({});
    apply(updated);
  };

  // ── Patch helpers — every change immediately propagates to parent ────────
  const patchBanner = (patch: Partial<BannerSlide>) => {
    if (!isBannerSlide(local)) return;
    apply({ ...local, ...patch });
  };

  const patchEditorial = (patch: Partial<EditorialSlide>) => {
    if (!isEditorialSlide(local)) return;
    apply({ ...local, ...patch });
  };

  // ── Inline validation (shown as hints, does not block changes) ───────────
  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (isBannerSlide(local) && !local.src.trim()) {
      errs.src = 'Upload a banner image before publishing';
    }
    if (isEditorialSlide(local)) {
      if (!local.headlineL1.trim()) errs.headlineL1 = 'Headline is required';
      if (!local.ctaText.trim())   errs.ctaText    = 'CTA text is required';
      if (!local.ctaUrl.trim())    errs.ctaUrl     = 'CTA URL is required';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Run validation on every render to show live hints (errors never block save)
  React.useEffect(() => { validate(); }, [local]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-100 dark:border-slate-800">
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label="Back to slide list"
        >
          <ArrowLeft size={15} />
        </button>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          Edit Slide {slide.type === 'banner' ? '(Banner)' : '(Editorial)'}
        </h3>
        <span className="ml-auto text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
          ● Changes auto-saved to form
        </span>
      </div>

      {/* Fields */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">

        {/* Type selector */}
        <div>
          <Label>Slide type</Label>
          <TypeToggle value={local.type} onChange={handleTypeChange} />
          <Hint>
            {local.type === 'banner'
              ? 'Full-width pre-designed image. Text and design are baked into the image.'
              : 'Lifestyle photo with HTML text overlay, gradient, and CTA button.'
            }
          </Hint>
        </div>

        {/* ── BANNER FIELDS ─────────────────────────────────────────────── */}
        {isBannerSlide(local) && (
          <>
            <div>
              <Label required>Banner image</Label>
              <ImageUpload
                value={local.src}
                onChange={src => patchBanner({ src })}
                label="Click to upload banner image"
                hint="JPG, PNG, WebP, GIF — max 5 MB — 1920×500 recommended"
                aspectClass="aspect-video"
              />
              {errors.src && (
                <p className="flex items-center gap-1 text-[11px] text-red-600 dark:text-red-400 mt-1">
                  <AlertCircle size={11} /> {errors.src}
                </p>
              )}
            </div>

            <div>
              <Label>Alt text</Label>
              <TextInput
                value={local.alt}
                onChange={alt => patchBanner({ alt })}
                placeholder="Describe the banner for accessibility"
              />
              <Hint>Shown to screen readers and used by search engines.</Hint>
            </div>

            <div>
              <Label>Click link (optional)</Label>
              <TextInput
                value={local.linkUrl ?? ''}
                onChange={linkUrl => patchBanner({ linkUrl })}
                placeholder="/collections/sale"
              />
              <Hint>Leave blank if the banner should not be clickable.</Hint>
            </div>
          </>
        )}

        {/* ── EDITORIAL FIELDS ──────────────────────────────────────────── */}
        {isEditorialSlide(local) && (
          <>
            <div>
              <Label>Background photo</Label>
              <ImageUpload
                value={local.backgroundImage}
                onChange={backgroundImage => patchEditorial({ backgroundImage })}
                label="Click to upload background photo"
                hint="JPG, PNG, WebP — max 5 MB — 1920×500 recommended"
                aspectClass="aspect-video"
              />
              <Hint>Lifestyle photo shown behind the gradient overlay.</Hint>
            </div>

            <div>
              <Label>Gradient overlay</Label>
              <GradientEditor
                value={local.overlayGradient}
                onChange={overlayGradient => patchEditorial({ overlayGradient })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Eyebrow text</Label>
                <TextInput
                  value={local.eyebrowText ?? ''}
                  onChange={eyebrowText => patchEditorial({ eyebrowText })}
                  placeholder="New Arrival"
                />
              </div>
              <div>
                <Label>Brand name</Label>
                <TextInput
                  value={local.brandName ?? ''}
                  onChange={brandName => patchEditorial({ brandName })}
                  placeholder="Ashlesha Thakur"
                />
              </div>
            </div>

            <div>
              <Label required>Headline (line 1)</Label>
              <TextInput
                value={local.headlineL1}
                onChange={headlineL1 => patchEditorial({ headlineL1 })}
                placeholder="Our newest sparkle for"
              />
              {errors.headlineL1 && (
                <p className="flex items-center gap-1 text-[11px] text-red-600 dark:text-red-400 mt-1">
                  <AlertCircle size={11} /> {errors.headlineL1}
                </p>
              )}
            </div>

            <div>
              <Label>Headline (line 2 — accent)</Label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <TextInput
                    value={local.headlineL2 ?? ''}
                    onChange={headlineL2 => patchEditorial({ headlineL2 })}
                    placeholder="18KT Gold & Silver Diamonds"
                  />
                </div>
                <button
                  className="flex-shrink-0 w-10 h-9 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden relative"
                  style={{ background: local.headlineL2Color ?? '#FEF08A' }}
                  onClick={() => document.getElementById('l2color')?.click()}
                  title="Click to change accent colour"
                  type="button"
                >
                  <input
                    id="l2color"
                    type="color"
                    value={local.headlineL2Color ?? '#FEF08A'}
                    onChange={e => patchEditorial({ headlineL2Color: e.target.value })}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    onClick={e => e.stopPropagation()}
                  />
                </button>
              </div>
              <Hint>Rendered in accent colour on the second line of the headline.</Hint>
            </div>

            <div>
              <Label>Disclaimer / body text</Label>
              <TextInput
                value={local.disclaimer ?? ''}
                onChange={disclaimer => patchEditorial({ disclaimer })}
                placeholder="Shop stunning diamond designs…"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label required>CTA button text</Label>
                <TextInput
                  value={local.ctaText}
                  onChange={ctaText => patchEditorial({ ctaText })}
                  placeholder="Shop Now"
                />
                {errors.ctaText && (
                  <p className="flex items-center gap-1 text-[11px] text-red-600 dark:text-red-400 mt-1">
                    <AlertCircle size={11} /> {errors.ctaText}
                  </p>
                )}
              </div>
              <div>
                <Label required>CTA URL</Label>
                <TextInput
                  value={local.ctaUrl}
                  onChange={ctaUrl => patchEditorial({ ctaUrl })}
                  placeholder="/jewellery/diamonds"
                />
                {errors.ctaUrl && (
                  <p className="flex items-center gap-1 text-[11px] text-red-600 dark:text-red-400 mt-1">
                    <AlertCircle size={11} /> {errors.ctaUrl}
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
        <button
          onClick={onRevert}
          className="px-3 py-1.5 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          title="Undo all changes to this slide since you opened the editor"
        >
          Revert slide
        </button>
        <button
          onClick={onClose}
          className="px-4 py-1.5 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
        >
          ← Back to slides
        </button>
      </div>
    </div>
  );
};

export default SlideForm;
