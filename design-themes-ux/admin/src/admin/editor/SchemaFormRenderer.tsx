import React, { useState, useRef, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, RotateCcw, Upload, Link2, AlignLeft, AlignCenter, AlignRight, Loader2 } from 'lucide-react';
import type { SettingField, FieldType } from './types';
import RichTextFieldEditor from './RichTextField';
import api from '@/lib/api';

// ─── Props ────────────────────────────────────────────────────────────────────

interface SchemaFormRendererProps {
  schema:     SettingField[];
  values:     Record<string, any>;
  onChange:   (key: string, value: any) => void;
  blockType?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getNestedValue(obj: Record<string, any>, dotPath: string): any {
  return dotPath.split('.').reduce((acc, key) => acc?.[key], obj);
}

function evaluateCondition(field: SettingField, values: Record<string, any>): boolean {
  if (!field.condition) return true;
  const { field: condField, operator, value } = field.condition;
  const actual = getNestedValue(values, condField);
  switch (operator) {
    case 'eq':     return actual === value;
    case 'neq':    return actual !== value;
    case 'truthy': return !!actual;
    case 'falsy':  return !actual;
    case 'gt':     return typeof actual === 'number' && actual > value;
    case 'lt':     return typeof actual === 'number' && actual < value;
    default:       return true;
  }
}

function groupFields(schema: SettingField[]) {
  const groups: Map<string, SettingField[]> = new Map();
  schema.forEach((field) => {
    const g = field.group ?? '';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(field);
  });
  return groups;
}

// ─── Individual Field Components ──────────────────────────────────────────────

const FieldLabel: React.FC<{ label: string; helpText?: string; onReset?: () => void }> = ({ label, helpText, onReset }) => (
  <div className="flex items-center justify-between mb-1.5">
    <label className="text-[13px] font-medium text-slate-700 dark:text-slate-300 leading-none">{label}</label>
    {onReset && (
      <button onClick={onReset} className="opacity-0 group-hover/field:opacity-100 p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 transition-all" title="Reset to default">
        <RotateCcw size={11} />
      </button>
    )}
  </div>
);

// ── Text field
const TextField: React.FC<{ field: SettingField; value: any; onChange: (v: any) => void }> = ({ field, value, onChange }) => (
  <input
    type="text"
    value={value ?? field.default ?? ''}
    onChange={(e) => onChange(e.target.value)}
    placeholder={field.placeholder}
    maxLength={field.maxLength}
    className="w-full px-3 py-2 text-[13px] rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition-all"
  />
);

// ── Textarea field
const TextareaField: React.FC<{ field: SettingField; value: any; onChange: (v: any) => void }> = ({ field, value, onChange }) => (
  <textarea
    value={value ?? field.default ?? ''}
    onChange={(e) => onChange(e.target.value)}
    placeholder={field.placeholder}
    rows={field.rows ?? 3}
    className="w-full px-3 py-2 text-[13px] rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition-all resize-none"
  />
);


// ── Number field
const NumberField: React.FC<{ field: SettingField; value: any; onChange: (v: any) => void }> = ({ field, value, onChange }) => (
  <div className="flex items-center gap-2">
    <input
      type="number"
      value={value ?? field.default ?? 0}
      onChange={(e) => onChange(Number(e.target.value))}
      min={field.min} max={field.max} step={field.step}
      className="flex-1 px-3 py-2 text-[13px] rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition-all"
    />
    {field.unit && <span className="text-[12px] text-slate-400 font-medium w-6 shrink-0">{field.unit}</span>}
  </div>
);

// ── Range slider
const RangeField: React.FC<{ field: SettingField; value: any; onChange: (v: any) => void }> = ({ field, value, onChange }) => {
  const val = value ?? field.default ?? field.min ?? 0;
  const min = field.min ?? 0;
  const max = field.max ?? 100;
  const pct = ((val - min) / (max - min)) * 100;

  return (
    <div className="flex items-center gap-3">
      <div className="relative flex-1 flex items-center">
        <div className="absolute h-1 rounded-full bg-slate-200 dark:bg-slate-600 w-full" />
        <div className="absolute h-1 rounded-full bg-violet-500" style={{ width: `${pct}%` }} />
        <input
          type="range" min={min} max={max} step={field.step ?? 1} value={val}
          onChange={(e) => onChange(Number(e.target.value))}
          className="relative w-full h-1 bg-transparent cursor-pointer appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-violet-500 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-grab"
        />
      </div>
      <div className="flex items-center gap-1 min-w-[48px] justify-end">
        <span className="text-[13px] font-medium text-slate-900 dark:text-white tabular-nums">{val}</span>
        {field.unit && <span className="text-[11px] text-slate-400">{field.unit}</span>}
      </div>
    </div>
  );
};

// ── Color picker
const ColorField: React.FC<{ field: SettingField; value: any; onChange: (v: any) => void }> = ({ field, value, onChange }) => {
  const val = value ?? field.default ?? '#000000';
  return (
    <div className="flex items-center gap-2.5 p-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-500 transition-colors">
      <div className="relative w-8 h-8 rounded-md overflow-hidden border border-slate-200 dark:border-slate-600 flex-shrink-0 shadow-sm">
        <input
          type="color"
          value={val}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 w-[140%] h-[140%] -top-[20%] -left-[20%] cursor-pointer opacity-100 border-0 p-0"
        />
      </div>
      <input
        type="text"
        value={val}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 text-[13px] font-mono text-slate-700 dark:text-slate-300 bg-transparent border-0 focus:outline-none uppercase"
        maxLength={7}
      />
      <span className="text-[11px] text-slate-400 capitalize">{field.default === val ? 'Default' : 'Custom'}</span>
    </div>
  );
};

// ── Color scheme picker
const ColorSchemeField: React.FC<{ value: any; onChange: (v: any) => void }> = ({ value, onChange }) => {
  const schemes = [
    { id: 'scheme-1', label: 'Scheme 1', colors: ['#ffffff', '#f8f9fa', '#1a1a2e', '#4f46e5'] },
    { id: 'scheme-2', label: 'Scheme 2', colors: ['#1a1a2e', '#2d2d44', '#ffffff', '#6366f1'] },
    { id: 'scheme-3', label: 'Scheme 3', colors: ['#f0fdf4', '#dcfce7', '#166534', '#16a34a'] },
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {schemes.map((s) => (
        <button
          key={s.id}
          onClick={() => onChange(s.id)}
          className={`relative p-2 rounded-lg border-2 transition-all ${value === s.id ? 'border-violet-500 shadow-md' : 'border-slate-200 dark:border-slate-600 hover:border-slate-300'}`}
        >
          <div className="flex gap-0.5 mb-1">
            {s.colors.map((c, i) => (
              <div key={i} className="flex-1 h-4 rounded-sm" style={{ background: c }} />
            ))}
          </div>
          <span className="text-[10px] text-slate-600 dark:text-slate-400">{s.label}</span>
          {value === s.id && (
            <div className="absolute top-1 right-1 w-3 h-3 bg-violet-500 rounded-full flex items-center justify-center">
              <span className="text-white text-[8px]">✓</span>
            </div>
          )}
        </button>
      ))}
    </div>
  );
};

// ── Toggle switch
const ToggleField: React.FC<{ field: SettingField; value: any; onChange: (v: any) => void }> = ({ field, value, onChange }) => {
  const checked = value ?? field.default ?? false;
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${checked ? 'bg-violet-600' : 'bg-slate-200 dark:bg-slate-600'}`}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-md transition-transform ${checked ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
    </button>
  );
};

// ── Select dropdown
const SelectField: React.FC<{ field: SettingField; value: any; onChange: (v: any) => void }> = ({ field, value, onChange }) => (
  <div className="relative">
    <select
      value={value ?? field.default ?? ''}
      onChange={(e) => onChange(e.target.value)}
      className="w-full appearance-none px-3 py-2 pr-8 text-[13px] rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition-all cursor-pointer"
    >
      {field.options?.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
    <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
  </div>
);

// ── Radio / button group
const RadioField: React.FC<{ field: SettingField; value: any; onChange: (v: any) => void }> = ({ field, value, onChange }) => {
  const val = value ?? field.default ?? field.options?.[0]?.value ?? '';
  return (
    <div className="flex rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden bg-slate-50 dark:bg-slate-800 p-0.5 gap-0.5">
      {field.options?.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex-1 py-1.5 px-2 rounded-md text-[12px] font-medium transition-all ${
            val === opt.value
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
};

// ── Alignment picker
const AlignmentField: React.FC<{ value: any; onChange: (v: any) => void }> = ({ value, onChange }) => {
  const options = [
    { value: 'left',   icon: AlignLeft },
    { value: 'center', icon: AlignCenter },
    { value: 'right',  icon: AlignRight },
  ];
  return (
    <div className="flex rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden bg-slate-50 dark:bg-slate-800 p-0.5 gap-0.5">
      {options.map(({ value: v, icon: Icon }) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`flex-1 py-2 flex items-center justify-center rounded-md transition-all ${
            value === v
              ? 'bg-white dark:bg-slate-700 text-violet-500 shadow-sm'
              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
          }`}
        >
          <Icon size={14} />
        </button>
      ))}
    </div>
  );
};

// ── URL / link field
const UrlField: React.FC<{ field: SettingField; value: any; onChange: (v: any) => void }> = ({ field, value, onChange }) => (
  <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 focus-within:ring-2 focus-within:ring-blue-500/30 focus-within:border-blue-400 transition-all">
    <Link2 size={13} className="text-slate-400 shrink-0" />
    <input
      type="text"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder ?? 'Paste a link or search'}
      className="flex-1 text-[13px] text-slate-900 dark:text-white bg-transparent border-0 focus:outline-none placeholder-slate-400"
    />
  </div>
);

// ── Image upload field
const ImageField: React.FC<{ field: SettingField; value: any; onChange: (v: any) => void }> = ({ field, value, onChange }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const hasImage = value?.url || typeof value === 'string';

  return (
    <div>
      {hasImage ? (
        <div className="relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-600 group">
          <img
            src={typeof value === 'string' ? value : value.url}
            alt={value?.altText ?? ''}
            className="w-full h-24 object-cover"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
            <button
              onClick={() => inputRef.current?.click()}
              className="px-3 py-1.5 bg-white text-slate-800 rounded-lg text-[11px] font-semibold shadow"
            >
              Change
            </button>
            <button
              onClick={() => onChange(null)}
              className="px-3 py-1.5 bg-white text-red-600 rounded-lg text-[11px] font-semibold shadow"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          className="w-full py-6 rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-600 hover:border-blue-300 dark:hover:border-blue-600 transition-colors flex flex-col items-center gap-2"
        >
          <Upload size={18} className="text-slate-400" />
          <span className="text-[12px] text-slate-500 dark:text-slate-400 font-medium">Click to upload image</span>
          <span className="text-[11px] text-slate-400">{field.formats?.join(', ').toUpperCase() ?? 'JPG, PNG, WEBP'}</span>
        </button>
      )}
      <input ref={inputRef} type="file" accept={field.formats?.map((f) => `.${f}`).join(',') ?? 'image/*'} className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            const url = URL.createObjectURL(file);
            onChange({ url, altText: '' });
          }
        }} />
    </div>
  );
};

// ── Padding compound field (4 inputs)
const PaddingField: React.FC<{ value: any; onChange: (key: string, v: any) => void }> = ({ value, onChange }) => {
  const sides = [
    { key: 'top',    label: 'T' },
    { key: 'right',  label: 'R' },
    { key: 'bottom', label: 'B' },
    { key: 'left',   label: 'L' },
  ];
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {sides.map(({ key, label }) => (
        <div key={key} className="flex flex-col items-center gap-1">
          <input
            type="number" min={0} max={120} step={4}
            value={value?.[key] ?? 0}
            onChange={(e) => onChange(key, Number(e.target.value))}
            className="w-full px-1 py-1.5 text-center text-[12px] rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <span className="text-[10px] text-slate-400">{label}</span>
        </div>
      ))}
    </div>
  );
};

// ── Shared API unwrapper for pickers
// NestJS TransformInterceptor: { success, data: T[], meta }
function unwrapList<T>(res: unknown): T[] {
  if (!res) return [];
  const r = res as Record<string, unknown>;
  if (Array.isArray(r.data))  return r.data  as T[];
  if (Array.isArray(r.items)) return r.items as T[];
  if (Array.isArray(res))     return res      as T[];
  return [];
}

// ── Shared select wrapper — handles disabled + spinner during load
const PickerSelect: React.FC<{
  value:      string;
  onChange:   (v: string) => void;
  disabled?:  boolean;
  loading?:   boolean;
  children:   React.ReactNode;
}> = ({ value, onChange, disabled, loading, children }) => (
  <div className="relative">
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled || loading}
      className="w-full appearance-none px-3 py-2 pr-8 text-[13px] rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {children}
    </select>
    {loading
      ? <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 animate-spin pointer-events-none" />
      : <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
    }
  </div>
);

// ── Menu picker — real API data
// Stores menu.handle (e.g. "main-menu") because the template/header renderer
// looks menus up by handle, not by id.
const MenuPickerField: React.FC<{
  field:    SettingField;
  value:    any;
  onChange: (v: any) => void;
  onMeta?:  (label: string) => void;
}> = ({ field, value, onChange, onMeta }) => {
  const { data, isLoading, isError } = useQuery({
    queryKey:  ['editor-menus'],
    queryFn:   () => api.get('/menus').then(unwrapList<{ id: string; name: string; handle: string }>),
    staleTime: 60_000,
    retry:     1,
  });

  const menus = data ?? [];

  const handleChange = (handle: string) => {
    onChange(handle);
    if (onMeta) {
      const menu = menus.find((m) => m.handle === handle);
      onMeta(menu?.name ?? '');
    }
  };

  return (
    <PickerSelect
      value={value ?? field.default ?? ''}
      onChange={handleChange}
      loading={isLoading}
    >
      {isLoading && <option value="">Loading menus…</option>}
      {isError   && <option value="">Could not load menus</option>}
      {!isLoading && !isError && menus.length === 0 && (
        <option value="">No menus found</option>
      )}
      {!isLoading && !isError && menus.map((m) => (
        <option key={m.id} value={m.handle}>{m.name}</option>
      ))}
    </PickerSelect>
  );
};

// ── Collection picker — real API data
// Stores collection.id (cuid) so useCanvasProducts can filter by collectionId
// and the canvas automatically refreshes when the selection changes.
// Also writes settings._collectionLabel = collection.name so the Layers panel
// can auto-name repeated sections: "Featured Collection — New Arrivals".
const CollectionPickerField: React.FC<{
  value:    any;
  onChange: (v: any) => void;
  onMeta?:  (label: string) => void;  // called with the collection name on select
}> = ({ value, onChange, onMeta }) => {
  const { data, isLoading, isError } = useQuery({
    queryKey:  ['editor-collections'],
    queryFn:   () => api.get('/collections').then(unwrapList<{ id: string; name: string; slug: string; isActive: boolean }>),
    staleTime: 60_000,
    retry:     1,
  });

  const collections = (data ?? []).filter((c) => c.isActive !== false);

  const handleChange = (id: string) => {
    onChange(id);
    // Emit the collection name so the Layers panel can derive a display label
    if (onMeta) {
      const col = collections.find((c) => c.id === id);
      onMeta(col?.name ?? '');
    }
  };

  return (
    <PickerSelect
      value={value ?? ''}
      onChange={handleChange}
      loading={isLoading}
    >
      {isLoading && <option value="">Loading collections…</option>}
      {!isLoading && <option value="">Select a collection…</option>}
      {isError && <option value="" disabled>Could not load collections</option>}
      {!isLoading && !isError && collections.length === 0 && (
        <option value="" disabled>No collections found</option>
      )}
      {!isLoading && !isError && collections.map((c) => (
        <option key={c.id} value={c.id}>{c.name}</option>
      ))}
    </PickerSelect>
  );
};

// ── Product picker — single product selector (limit 50, search supported)
// Stores product.id. Used for "Feature this product" bindings.
const ProductPickerField: React.FC<{ field: SettingField; value: any; onChange: (v: any) => void }> = ({ field, value, onChange }) => {
  const [search, setSearch] = React.useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey:  ['editor-products', search],
    queryFn:   () =>
      api.get('/products', { params: { limit: 50, status: 'ACTIVE', search: search || undefined } })
        .then((r: any): { id: string; name: string; sku: string }[] => {
          const items = r?.data ?? r ?? [];
          return Array.isArray(items) ? items : [];
        }),
    staleTime: 30_000,
    retry:     1,
  });

  const products = data ?? [];

  return (
    <div className="space-y-1.5">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search products…"
        className="w-full px-3 py-1.5 text-[12px] rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-violet-400"
      />
      <PickerSelect value={value ?? ''} onChange={onChange} loading={isLoading}>
        {isLoading && <option value="">Searching…</option>}
        {!isLoading && <option value="">Select a product…</option>}
        {isError   && <option value="" disabled>Could not load products</option>}
        {!isLoading && !isError && products.length === 0 && (
          <option value="" disabled>No products found</option>
        )}
        {!isLoading && !isError && products.map((p) => (
          <option key={p.id} value={p.id}>{p.name} — {p.sku}</option>
        ))}
      </PickerSelect>
    </div>
  );
};

// ── Category picker — flat category list with depth indentation
// Stores category.id. Used for "Show products from this category" bindings.
const CategoryPickerField: React.FC<{ value: any; onChange: (v: any) => void }> = ({ value, onChange }) => {
  const { data, isLoading, isError } = useQuery({
    queryKey:  ['editor-categories'],
    queryFn:   () =>
      api.get('/categories/flat')
        .then((r: any): { id: string; name: string; depth?: number }[] => {
          const items = r?.data ?? r ?? [];
          return Array.isArray(items) ? items : [];
        }),
    staleTime: 60_000,
    retry:     1,
  });

  const categories = data ?? [];

  return (
    <PickerSelect value={value ?? ''} onChange={onChange} loading={isLoading}>
      {isLoading && <option value="">Loading categories…</option>}
      {!isLoading && <option value="">Select a category…</option>}
      {isError   && <option value="" disabled>Could not load categories</option>}
      {!isLoading && !isError && categories.length === 0 && (
        <option value="" disabled>No categories found</option>
      )}
      {!isLoading && !isError && categories.map((c) => (
        <option key={c.id} value={c.id}>
          {'  '.repeat(c.depth ?? 0)}{c.name}
        </option>
      ))}
    </PickerSelect>
  );
};

// ─── Group Header ─────────────────────────────────────────────────────────────

const GroupHeader: React.FC<{ label: string; expanded: boolean; onToggle: () => void }> = ({ label, expanded, onToggle }) => (
  <button
    onClick={onToggle}
    className="w-full flex items-center justify-between py-2.5 group transition-colors"
  >
    <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500 transition-colors leading-none">
      {label}
    </span>
    <div className={`transition-transform duration-150 ${expanded ? '' : '-rotate-90'}`}>
      <ChevronDown size={12} className="text-slate-300 dark:text-slate-600 group-hover:text-slate-400 transition-colors" />
    </div>
  </button>
);

// ─── Field Router ─────────────────────────────────────────────────────────────

function renderField(
  field:      SettingField,
  values:     Record<string, any>,
  onChange:   (key: string, value: any) => void,
  blockType?: string,
): React.ReactNode {
  const val = getNestedValue(values, field.key);
  const handle = (v: any) => onChange(field.key, v);

  // Padding compound type
  if (field.type === 'padding') {
    return (
      <PaddingField
        value={val}
        onChange={(side, v) => onChange(`${field.key}.${side}`, v)}
      />
    );
  }

  switch (field.type as FieldType) {
    case 'text':             return <TextField          field={field} value={val} onChange={handle} />;
    case 'textarea':         return <TextareaField      field={field} value={val} onChange={handle} />;
    case 'rich_text':        return <RichTextFieldEditor field={field} value={val} onChange={handle} blockType={blockType} />;
    case 'liquid':           return <TextareaField  field={field} value={val} onChange={handle} />;
    case 'number':           return <NumberField    field={field} value={val} onChange={handle} />;
    case 'range':            return <RangeField     field={field} value={val} onChange={handle} />;
    case 'color':            return <ColorField     field={field} value={val} onChange={handle} />;
    case 'color_scheme':     return <ColorSchemeField value={val} onChange={handle} />;
    case 'image':            return <ImageField     field={field} value={val} onChange={handle} />;
    case 'select':           return <SelectField    field={field} value={val} onChange={handle} />;
    case 'radio':            return <RadioField     field={field} value={val} onChange={handle} />;
    case 'toggle':           return <ToggleField    field={field} value={val} onChange={handle} />;
    case 'url':              return <UrlField       field={field} value={val} onChange={handle} />;
    case 'menu_picker':       return (
      <MenuPickerField
        field={field}
        value={val}
        onChange={handle}
        onMeta={(label) => onChange('_menuLabel', label)}
      />
    );
    case 'collection_picker': return (
      <CollectionPickerField
        value={val}
        onChange={handle}
        onMeta={(label) => onChange('_collectionLabel', label)}
      />
    );
    case 'product_picker':    return <ProductPickerField     field={field} value={val} onChange={handle} />;
    case 'category_picker':   return <CategoryPickerField    value={val} onChange={handle} />;
    case 'alignment':         return <AlignmentField value={val} onChange={handle} />;
    case 'font_picker':      return (
      <SelectField
        field={{ ...field, options: ['Inter','Playfair Display','Space Grotesk','Nunito','Merriweather','DM Sans','Josefin Sans'].map((f) => ({ label: f, value: f })) }}
        value={val} onChange={handle}
      />
    );
    default:
      return <TextField field={field} value={val} onChange={handle} />;
  }
}

// ─── Main Component ────────────────────────────────────────────────────────────

const SchemaFormRenderer: React.FC<SchemaFormRendererProps> = ({ schema, values, onChange, blockType }) => {
  // All groups open by default — merchant sees all settings immediately
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = useCallback((group: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  }, []);

  const groups = useMemo(() => groupFields(schema), [schema]);

  return (
    <div className="divide-y divide-y divide-[var(--nx-border-1)]">
      {Array.from(groups.entries()).map(([groupName, fields], groupIdx) => {
        const visibleFields = fields.filter((f) => evaluateCondition(f, values));
        if (visibleFields.length === 0) return null;

        const isCollapsed  = collapsedGroups.has(groupName);
        const hasGroupName = groupName.trim() !== '';

        return (
          <div key={groupName || `ungrouped-${groupIdx}`}>
            {/* Group accordion header */}
            {hasGroupName && (
              <div className="px-4">
                <GroupHeader
                  label={groupName}
                  expanded={!isCollapsed}
                  onToggle={() => toggleGroup(groupName)}
                />
              </div>
            )}

            {/* Group fields */}
            {!isCollapsed && (
              <div className={`px-4 space-y-4 ${hasGroupName ? 'pb-4' : 'py-4'}`}>
                {visibleFields.map((field) => {
                  const val    = getNestedValue(values, field.key);
                  const handle = (v: any) => onChange(field.key, v);

                  // Toggle: inline label + control
                  if (field.type === 'toggle') {
                    return (
                      <div key={field.key} className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-slate-700 dark:text-slate-300 leading-none">{field.label}</p>
                          {field.helpText && (
                            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 leading-relaxed">{field.helpText}</p>
                          )}
                        </div>
                        <ToggleField field={field} value={val} onChange={handle} />
                      </div>
                    );
                  }

                  // Color scheme: no label (schemes are self-describing)
                  if (field.type === 'color_scheme') {
                    return (
                      <div key={field.key}>
                        <FieldLabel label={field.label} />
                        <ColorSchemeField value={val} onChange={handle} />
                      </div>
                    );
                  }

                  // Standard field: label above, input below
                  return (
                    <div key={field.key} className="group/field">
                      <FieldLabel
                        label={field.label}
                        onReset={field.default !== undefined && val !== field.default
                          ? () => onChange(field.key, field.default)
                          : undefined}
                      />
                      {renderField(field, values, onChange, blockType)}
                      {field.helpText && (
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5 leading-relaxed">{field.helpText}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default SchemaFormRenderer;
