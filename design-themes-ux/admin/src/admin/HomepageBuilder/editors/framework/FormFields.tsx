/**
 * FormFields — shared form primitives for all Aurus section editors.
 *
 * Consistent styling across every editor panel. All inputs follow the
 * admin design system (indigo focus ring, slate borders, dark mode support).
 */

import React from 'react';
import { AlertCircle } from 'lucide-react';
import ImageUpload from '@/components/ImageUpload';

// ─── Base primitives ─────────────────────────────────────────────────────────

export const Label: React.FC<{ children: React.ReactNode; required?: boolean }> = ({ children, required }) => (
  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
    {children}{required && <span className="text-red-500 ml-0.5">*</span>}
  </label>
);

export const Hint: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 leading-snug">{children}</p>
);

export const FieldError: React.FC<{ message?: string }> = ({ message }) =>
  message ? (
    <p className="flex items-center gap-1 text-[11px] text-red-600 dark:text-red-400 mt-1">
      <AlertCircle size={11} /> {message}
    </p>
  ) : null;

export const FieldGroup: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`space-y-1 ${className}`}>{children}</div>
);

export const SectionDivider: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex items-center gap-2 pt-4 pb-1">
    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 whitespace-nowrap">{label}</span>
    <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800" />
  </div>
);

// ─── Text inputs ─────────────────────────────────────────────────────────────

const inputBase = 'w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 outline-none focus:border-indigo-400 dark:focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/30 transition-all';

export const TextInput: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: 'text' | 'url' | 'email';
  disabled?: boolean;
}> = ({ value, onChange, placeholder, type = 'text', disabled }) => (
  <input
    type={type}
    value={value}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    disabled={disabled}
    className={inputBase}
  />
);

export const TextArea: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}> = ({ value, onChange, placeholder, rows = 3 }) => (
  <textarea
    value={value}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    rows={rows}
    className={`${inputBase} resize-none`}
  />
);

// ─── Number input ─────────────────────────────────────────────────────────────

export const NumberInput: React.FC<{
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  prefix?: string;
}> = ({ value, onChange, min = 0, max = 9999, step = 1, suffix, prefix }) => (
  <div className="flex items-center gap-1.5">
    {prefix && <span className="text-xs text-slate-400">{prefix}</span>}
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={e => onChange(Number(e.target.value))}
      className="w-20 px-2 py-1.5 text-sm text-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 transition-all"
    />
    {suffix && <span className="text-xs text-slate-400">{suffix}</span>}
  </div>
);

// ─── Toggle chips ─────────────────────────────────────────────────────────────

export const ToggleChip: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={[
      'px-3 py-1.5 text-xs font-semibold rounded-lg transition-all',
      active
        ? 'bg-indigo-600 text-white'
        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700',
    ].join(' ')}
  >
    {children}
  </button>
);

export const ToggleGroup: React.FC<{
  options: Array<{ label: string; value: string }>;
  value: string;
  onChange: (v: string) => void;
}> = ({ options, value, onChange }) => (
  <div className="flex gap-1.5 flex-wrap">
    {options.map(o => (
      <ToggleChip key={o.value} active={value === o.value} onClick={() => onChange(o.value)}>
        {o.label}
      </ToggleChip>
    ))}
  </div>
);

// ─── Colour input ─────────────────────────────────────────────────────────────

export const ColorInput: React.FC<{
  value: string;
  onChange: (v: string) => void;
  label?: string;
}> = ({ value, onChange, label }) => (
  <div className="flex items-center gap-2">
    <input
      type="color"
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-9 h-8 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer bg-transparent flex-shrink-0"
      title={label}
    />
    <TextInput value={value} onChange={onChange} placeholder="#000000" />
  </div>
);

// ─── Image field (wraps ImageUpload) ─────────────────────────────────────────

export const ImageField: React.FC<{
  value: string;
  onChange: (url: string) => void;
  label?: string;
  hint?: string;
  aspectClass?: string;
}> = ({ value, onChange, label = 'Click to upload', hint = 'JPG, PNG, WebP — max 5 MB', aspectClass = 'aspect-video' }) => (
  <ImageUpload value={value} onChange={onChange} label={label} hint={hint} aspectClass={aspectClass} />
);

// ─── Opacity slider ───────────────────────────────────────────────────────────

export const OpacitySlider: React.FC<{
  value: number;
  onChange: (v: number) => void;
  label?: string;
}> = ({ value, onChange, label = 'Opacity' }) => (
  <div className="flex items-center gap-3">
    <span className="text-xs text-slate-500 w-16">{label}</span>
    <input
      type="range" min={0} max={100} step={5}
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      className="flex-1 accent-indigo-600"
    />
    <span className="text-xs text-slate-500 w-8 text-right">{value}%</span>
  </div>
);

// ─── Tag list editor ──────────────────────────────────────────────────────────

export const TagListEditor: React.FC<{
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}> = ({ tags, onChange, placeholder = 'Add tag…' }) => {
  const [input, setInput] = React.useState('');

  const add = () => {
    const v = input.trim();
    if (v && !tags.includes(v)) {
      onChange([...tags, v]);
      setInput('');
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          className={`flex-1 ${inputBase}`}
        />
        <button
          type="button"
          onClick={add}
          className="px-3 py-1.5 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
        >
          Add
        </button>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag, i) => (
            <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/40">
              {tag}
              <button
                type="button"
                onClick={() => onChange(tags.filter((_, idx) => idx !== i))}
                className="text-indigo-400 hover:text-indigo-600 leading-none"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── URL field with validation hint ──────────────────────────────────────────

export const UrlField: React.FC<{
  value: string;
  onChange: (v: string) => void;
  label?: string;
}> = ({ value, onChange, label }) => (
  <FieldGroup>
    {label && <Label>{label}</Label>}
    <TextInput value={value} onChange={onChange} placeholder="/jewellery/new-arrivals or https://..." type="url" />
    <Hint>Use a relative path (e.g. /jewellery) or full URL.</Hint>
  </FieldGroup>
);
