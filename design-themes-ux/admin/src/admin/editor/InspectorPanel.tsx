import React, { useMemo, useState, useCallback } from 'react';
import {
  Trash2, MousePointer, Type, Sliders, LayoutGrid, Database,
  ChevronRight, ChevronDown, AlignLeft, AlignCenter, AlignRight,
  Monitor, Tablet, Smartphone, RotateCcw, X,
} from 'lucide-react';
import { useEditor } from './EditorContext';
import SchemaFormRenderer from './SchemaFormRenderer';
import { SECTION_DEFINITIONS, BLOCK_DEFINITIONS } from './editor-mock-data';
import { hasResponsiveOverride, getEffectiveValue } from './resolveSettings';
import { STYLE_SCHEMA }  from './schemas/style.schema';
import { LAYOUT_SCHEMA } from './schemas/layout.schema';
import { isRealCollectionId } from '@/hooks/useCanvasProducts';
import type { SectionDoc, BlockDoc, PreviewMode } from './types';
// Phase 5: node-mode imports
import type { Node } from '@/components/node-renderer/types';
import { findNode, findParent } from './adapters/nodeTreeHelpers';

// ─── Tab types ────────────────────────────────────────────────────────────────

type InspectorTab = 'content' | 'style' | 'layout' | 'responsive' | 'binding';

const TABS: { id: InspectorTab; label: string }[] = [
  { id: 'content',    label: 'Content'    },
  { id: 'style',      label: 'Style'      },
  { id: 'layout',     label: 'Layout'     },
  { id: 'responsive', label: 'Responsive' },
  { id: 'binding',    label: 'Bind'       },
];

// ─── Empty state ──────────────────────────────────────────────────────────────

const EmptyState: React.FC = () => (
  <div className="flex flex-col items-center justify-center h-full px-6 text-center pb-20">
    <div
      className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
      style={{ background: 'var(--nx-raised)' }}
    >
      <MousePointer size={20} style={{ color: 'var(--nx-text-400)' }} />
    </div>
    <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--nx-text-600)', marginBottom: 6 }}>
      Click a layer to edit
    </p>
    <p style={{ fontSize: 12, color: 'var(--nx-text-400)', lineHeight: 1.6 }}>
      Select any layer or element in the canvas or tree panel
    </p>
    <div className="mt-5 px-3 py-2 rounded-lg" style={{ background: 'var(--nx-raised)', border: '1px solid var(--nx-border-1)' }}>
      <p style={{ fontSize: 11, color: 'var(--nx-text-400)', fontFamily: 'JetBrains Mono, monospace' }}>⌘K — insert layer</p>
    </div>
  </div>
);

// ─── Breadcrumb ───────────────────────────────────────────────────────────────

const Breadcrumb: React.FC<{
  parts:   { label: string; onClick?: () => void }[];
}> = ({ parts }) => (
  <div
    className="flex items-center gap-1 px-4 py-2 flex-wrap"
    style={{ borderBottom: '1px solid var(--nx-border-1)', background: 'var(--nx-raised)' }}
  >
    {parts.map((part, i) => (
      <React.Fragment key={i}>
        {i > 0 && <ChevronRight size={10} style={{ color: 'var(--nx-text-400)' }} />}
        {part.onClick ? (
          <button
            onClick={part.onClick}
            style={{ fontSize: 11, color: 'var(--nx-text-600)', fontWeight: 500 }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--nx-violet-400)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--nx-text-600)')}
          >
            {part.label}
          </button>
        ) : (
          <span style={{ fontSize: 11, color: 'var(--nx-text-900)', fontWeight: 600 }}>{part.label}</span>
        )}
      </React.Fragment>
    ))}
  </div>
);

// ─── Tab strip ────────────────────────────────────────────────────────────────

const TabStrip: React.FC<{
  active:      InspectorTab;
  onChange:    (t: InspectorTab) => void;
  breakpoint?: PreviewMode;
}> = ({ active, onChange, breakpoint = 'desktop' }) => (
  <div
    className="flex items-center shrink-0 overflow-x-auto"
    style={{ borderBottom: '1px solid var(--nx-border-1)' }}
  >
    {TABS.map(({ id, label }) => {
      const isResponsiveActive = id === 'responsive' && breakpoint !== 'desktop';
      const dotColor = breakpoint === 'mobile' ? '#FBBF24' : '#38BDF8';
      return (
        <button
          key={id}
          onClick={() => onChange(id)}
          className="flex-1 flex items-center justify-center gap-1 py-2.5 text-[10px] font-semibold transition-colors relative shrink-0"
          style={{
            color: active === id ? 'var(--nx-violet-400)' : 'var(--nx-text-400)',
            background: active === id ? 'var(--nx-violet-bg)' : 'transparent',
            minWidth: 48,
          }}
          onMouseEnter={(e) => {
            if (active !== id) (e.currentTarget as HTMLElement).style.color = 'var(--nx-text-900)';
          }}
          onMouseLeave={(e) => {
            if (active !== id) (e.currentTarget as HTMLElement).style.color = 'var(--nx-text-400)';
          }}
        >
          {label}
          {/* Dot on Responsive tab when non-desktop breakpoint is active */}
          {isResponsiveActive && (
            <span className="w-1 h-1 rounded-full shrink-0" style={{ background: dotColor }} />
          )}
          {active === id && (
            <span
              className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t-full"
              style={{ background: 'var(--nx-violet-500)' }}
            />
          )}
        </button>
      );
    })}
  </div>
);

// ─── Style tab — typography + spacing placeholders ────────────────────────────

const StyleSection: React.FC<{ title: string; children: React.ReactNode; defaultOpen?: boolean }> = ({ title, children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderBottom: '1px solid var(--nx-border-1)' }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5 transition-colors"
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--nx-raised)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--nx-text-400)' }}>
          {title}
        </span>
        <div style={{ transition: 'transform 150ms', transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
          <ChevronDown size={12} style={{ color: 'var(--nx-text-400)' }} />
        </div>
      </button>
      {open && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </div>
  );
};

const InlineField: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-center gap-2">
    <span className="shrink-0" style={{ fontSize: 11, color: 'var(--nx-text-400)', width: 52 }}>{label}</span>
    <div className="flex-1">{children}</div>
  </div>
);

const NxInput: React.FC<{ value?: string | number; placeholder?: string; unit?: string }> = ({ value, placeholder, unit }) => (
  <div className="flex items-center rounded-lg overflow-hidden" style={{ border: '1px solid var(--nx-border-2)', background: 'var(--nx-raised)' }}>
    <input
      defaultValue={value}
      placeholder={placeholder}
      className="flex-1 px-2.5 py-1.5 bg-transparent text-[12px] focus:outline-none"
      style={{ color: 'var(--nx-text-900)' }}
    />
    {unit && <span className="px-2 text-[11px]" style={{ color: 'var(--nx-text-400)', borderLeft: '1px solid var(--nx-border-2)' }}>{unit}</span>}
  </div>
);

const NxSelect: React.FC<{ options: string[]; value?: string }> = ({ options, value }) => (
  <div className="relative">
    <select
      defaultValue={value}
      className="w-full appearance-none px-2.5 py-1.5 pr-7 rounded-lg text-[12px] focus:outline-none cursor-pointer"
      style={{ background: 'var(--nx-raised)', border: '1px solid var(--nx-border-2)', color: 'var(--nx-text-900)' }}
    >
      {options.map((o) => <option key={o}>{o}</option>)}
    </select>
    <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--nx-text-400)' }} />
  </div>
);

const AlignPicker: React.FC = () => {
  const [val, setVal] = useState('left');
  return (
    <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--nx-border-2)', background: 'var(--nx-raised)' }}>
      {[
        { v: 'left',   I: AlignLeft   },
        { v: 'center', I: AlignCenter },
        { v: 'right',  I: AlignRight  },
      ].map(({ v, I }, i) => (
        <button
          key={v}
          onClick={() => setVal(v)}
          className="flex-1 flex items-center justify-center py-2 transition-colors"
          style={{
            borderLeft: i > 0 ? '1px solid var(--nx-border-2)' : 'none',
            background: val === v ? 'var(--nx-violet-bg)' : 'transparent',
            color: val === v ? 'var(--nx-violet-400)' : 'var(--nx-text-400)',
          }}
        >
          <I size={13} />
        </button>
      ))}
    </div>
  );
};

const SpacingGrid: React.FC<{ label: string }> = ({ label }) => (
  <div>
    <span style={{ fontSize: 11, color: 'var(--nx-text-400)', display: 'block', marginBottom: 6 }}>{label}</span>
    <div className="grid grid-cols-4 gap-1.5">
      {['T', 'R', 'B', 'L'].map((side) => (
        <div key={side} className="flex flex-col items-center gap-1">
          <input
            type="number" min={0} max={120} defaultValue={0}
            className="w-full px-1 py-1.5 text-center rounded-md text-[11px] focus:outline-none"
            style={{ background: 'var(--nx-raised)', border: '1px solid var(--nx-border-2)', color: 'var(--nx-text-900)' }}
          />
          <span style={{ fontSize: 9, color: 'var(--nx-text-400)' }}>{side}</span>
        </div>
      ))}
    </div>
  </div>
);

interface InspectorTabContentProps {
  values:   Record<string, any>;
  onChange: (key: string, value: any) => void;
}

const StyleTab: React.FC<InspectorTabContentProps> = ({ values, onChange }) => (
  <div className="overflow-y-auto h-full">
    <SchemaFormRenderer schema={STYLE_SCHEMA} values={values} onChange={onChange} />
  </div>
);

const LayoutTab: React.FC<InspectorTabContentProps> = ({ values, onChange }) => (
  <div className="overflow-y-auto h-full">
    <SchemaFormRenderer schema={LAYOUT_SCHEMA} values={values} onChange={onChange} />
  </div>
);

// ─── Responsive tab (real — reads from settings.responsive.*) ─────────────────

const BP_ICONS: Record<PreviewMode, React.ElementType> = {
  desktop: Monitor,
  tablet:  Tablet,
  mobile:  Smartphone,
};

const BP_COLORS: Record<PreviewMode, string> = {
  desktop: 'var(--nx-text-400)',
  tablet:  '#38BDF8',
  mobile:  '#FBBF24',
};

interface ResponsiveTabProps {
  settings:            Record<string, any>;
  breakpoint:          PreviewMode;
  onDispatch:          (bp: PreviewMode) => void;
  onClearKey:          (key: string) => void;
  // Phase 5: optional — when provided, visibility toggles become interactive.
  // Legacy mode leaves it undefined (toggles remain visual-only, existing behaviour).
  onVisibilityChange?: (bp: PreviewMode, visible: boolean) => void;
}

const ResponsiveTab: React.FC<ResponsiveTabProps> = ({
  settings, breakpoint, onDispatch, onClearKey, onVisibilityChange,
}) => {
  const responsive = (settings.responsive ?? {}) as Record<string, Record<string, unknown>>;
  const tabletOverrides = Object.keys(responsive.tablet  ?? {});
  const mobileOverrides = Object.keys(responsive.mobile  ?? {});
  const activeOverrides = breakpoint !== 'desktop'
    ? Object.keys(responsive[breakpoint] ?? {})
    : [];

  return (
    <div className="overflow-y-auto">
      {/* Breakpoint selector */}
      <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--nx-border-1)' }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--nx-text-400)', marginBottom: 8 }}>
          Editing breakpoint
        </p>
        <div className="flex gap-2">
          {(['desktop', 'tablet', 'mobile'] as PreviewMode[]).map((bp) => {
            const Icon    = BP_ICONS[bp];
            const active  = breakpoint === bp;
            const hasOvr  = bp === 'tablet' ? tabletOverrides.length > 0
                          : bp === 'mobile' ? mobileOverrides.length > 0
                          : false;
            return (
              <button
                key={bp}
                onClick={() => onDispatch(bp)}
                className="flex-1 flex flex-col items-center gap-1 py-2 rounded-lg transition-all"
                style={{
                  background: active ? 'var(--nx-violet-bg)' : 'var(--nx-raised)',
                  border: `1px solid ${active ? 'var(--nx-violet-500)' : 'var(--nx-border-2)'}`,
                }}
              >
                <Icon size={14} style={{ color: active ? 'var(--nx-violet-400)' : BP_COLORS[bp] }} />
                <span style={{ fontSize: 10, fontWeight: 600, color: active ? 'var(--nx-violet-400)' : 'var(--nx-text-400)' }}>
                  {bp === 'desktop' ? '1440' : bp === 'tablet' ? '768' : '390'}
                </span>
                {hasOvr && (
                  <span className="w-1 h-1 rounded-full" style={{ background: BP_COLORS[bp] }} />
                )}
              </button>
            );
          })}
        </div>
        {breakpoint !== 'desktop' && (
          <p className="mt-2" style={{ fontSize: 11, color: BP_COLORS[breakpoint] }}>
            ◉ Editing {breakpoint} — changes write to responsive.{breakpoint}.*
          </p>
        )}
      </div>

      {/* Active overrides list */}
      {breakpoint !== 'desktop' && (
        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--nx-border-1)' }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--nx-text-400)', marginBottom: 8 }}>
            {breakpoint} overrides ({activeOverrides.length})
          </p>
          {activeOverrides.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--nx-text-400)', fontStyle: 'italic' }}>
              No overrides yet. Edit any field on the Content or Style tab to create one.
            </p>
          ) : (
            <div className="space-y-1">
              {activeOverrides.map((key) => {
                const baseVal   = settings[key];
                const overrideVal = responsive[breakpoint]?.[key];
                return (
                  <div key={key} className="flex items-center gap-2 py-1 rounded-lg px-2"
                    style={{ background: 'var(--nx-raised)' }}>
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: BP_COLORS[breakpoint] }} />
                    <div className="flex-1 min-w-0">
                      <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--nx-text-900)' }}>{key}</p>
                      <p style={{ fontSize: 10, color: 'var(--nx-text-400)' }}>
                        {String(overrideVal)} <span style={{ color: 'var(--nx-text-200)' }}>(was {String(baseVal ?? '—')})</span>
                      </p>
                    </div>
                    <button
                      onClick={() => onClearKey(key)}
                      title="Remove override"
                      className="shrink-0 p-1 rounded transition-colors"
                      style={{ color: 'var(--nx-text-400)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--nx-error)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--nx-text-400)')}
                    >
                      <RotateCcw size={11} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Visibility per breakpoint */}
      <StyleSection title="Visibility">
        <div className="space-y-2">
          {(['desktop', 'tablet', 'mobile'] as PreviewMode[]).map((bp) => {
            const Icon        = BP_ICONS[bp];
            const visKey      = `visibility.${bp}`;
            const currentVal  = getEffectiveValue(settings, visKey, breakpoint);
            const isVisible   = currentVal !== false;
            return (
              <div key={bp} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon size={12} style={{ color: BP_COLORS[bp] }} />
                  <span style={{ fontSize: 12, color: 'var(--nx-text-600)' }}>
                    Show on {bp}
                  </span>
                </div>
                <button
                  onClick={onVisibilityChange ? () => onVisibilityChange(bp, !isVisible) : undefined}
                  className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
                  style={{
                    background: isVisible ? 'var(--nx-violet-600)' : 'var(--nx-raised)',
                    border: '1px solid var(--nx-border-2)',
                    cursor: onVisibilityChange ? 'pointer' : 'default',
                  }}
                >
                  <span
                    className="inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-md transition-transform"
                    style={{ transform: `translateX(${isVisible ? '1.1rem' : '0.1rem'})` }}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </StyleSection>

      {/* Desktop baseline note */}
      {breakpoint === 'desktop' && (
        <div className="px-4 py-4">
          <div className="rounded-lg p-3" style={{ background: 'var(--nx-raised)', border: '1px solid var(--nx-border-1)' }}>
            <p style={{ fontSize: 11, color: 'var(--nx-text-400)', lineHeight: 1.6 }}>
              Desktop is the base breakpoint. All values set here are inherited by tablet and mobile unless overridden.
              Switch to Tablet or Mobile above to add responsive overrides.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Binding tab ─────────────────────────────────────────────────────────────
//
// Stores bindings as plain settings keys, consistent with P2/P3:
//   collection  → settings.collection  (collection cuid id)
//   product     → settings.product     (product cuid id)
//   menu        → settings.menuHandle  (menu handle string)
//   category    → settings.category    (category cuid id)
//
// Changing any of these settings triggers an automatic canvas re-render
// because FeaturedCollectionSection reads them via useCanvasProducts.
// They are saved/published with the rest of section.settings.

type BindingSource = 'none' | 'collection' | 'product' | 'menu' | 'category';

// Fake inline picker schemas for SchemaFormRenderer
const COLLECTION_SCHEMA = [{ key: 'collection', label: 'Collection', type: 'collection_picker' as const }];
const PRODUCT_SCHEMA    = [{ key: 'product',    label: 'Product',    type: 'product_picker'    as const }];
const MENU_SCHEMA       = [{ key: 'menuHandle', label: 'Menu',       type: 'menu_picker'       as const, default: 'main-menu' }];
const CATEGORY_SCHEMA   = [{ key: 'category',   label: 'Category',   type: 'category_picker'   as const }];

/** Detect which source is currently active from the settings bag. */
function detectSource(settings: Record<string, any>): BindingSource {
  if (settings.collection && isRealCollectionId(settings.collection)) return 'collection';
  if (settings.product    && String(settings.product).length >= 20)   return 'product';
  if (settings.menuHandle && String(settings.menuHandle).length > 0)  return 'menu';
  if (settings.category   && String(settings.category).length >= 20)  return 'category';
  return 'none';
}

/** Keys to clear when switching away from a source (prevents ghost data). */
const SOURCE_KEYS: Record<BindingSource, string[]> = {
  none:       ['collection', 'product', 'menuHandle', 'category'],
  collection: ['product', 'menuHandle', 'category'],
  product:    ['collection', 'menuHandle', 'category'],
  menu:       ['collection', 'product', 'category'],
  category:   ['collection', 'product', 'menuHandle'],
};

const SOURCE_LABELS: Record<BindingSource, string> = {
  none:       'None',
  collection: 'Collection',
  product:    'Product',
  menu:       'Menu',
  category:   'Category',
};

const SOURCE_DESCRIPTIONS: Record<BindingSource, string> = {
  none:       'No data binding. Section displays static content.',
  collection: 'Show products from a specific collection.',
  product:    'Feature a specific product.',
  menu:       'Bind navigation to a menu.',
  category:   'Show products from a category.',
};

interface BindingTabProps {
  values:   Record<string, any>;
  onChange: (key: string, value: any) => void;
}

const BindingTab: React.FC<BindingTabProps> = ({ values, onChange }) => {
  const activeSource = detectSource(values);

  const handleSourceChange = useCallback((newSource: BindingSource) => {
    if (newSource === activeSource) return;
    // Clear all binding keys for the previous source before switching
    SOURCE_KEYS[newSource].forEach((key) => onChange(key, undefined));
  }, [activeSource, onChange]);

  const clearBinding = useCallback(() => {
    SOURCE_KEYS.none.forEach((key) => onChange(key, undefined));
  }, [onChange]);

  return (
    <div className="overflow-y-auto h-full">
      {/* Source selector */}
      <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--nx-border-1)' }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--nx-text-400)', marginBottom: 8 }}>
          Data source
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {(['none', 'collection', 'product', 'menu', 'category'] as BindingSource[]).map((src) => (
            <button
              key={src}
              onClick={() => handleSourceChange(src)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all"
              style={{
                fontSize:    12,
                fontWeight:  activeSource === src ? 600 : 400,
                background:  activeSource === src ? 'var(--nx-violet-bg)'  : 'var(--nx-raised)',
                color:       activeSource === src ? 'var(--nx-violet-400)' : 'var(--nx-text-600)',
                border:      activeSource === src ? '1px solid var(--nx-violet-500)' : '1px solid var(--nx-border-2)',
                gridColumn:  src === 'none' ? '1 / -1' : undefined,
              }}
            >
              <Database size={12} style={{ flexShrink: 0 }} />
              {SOURCE_LABELS[src]}
            </button>
          ))}
        </div>
      </div>

      {/* Active binding description */}
      <div className="px-4 py-2.5" style={{ borderBottom: '1px solid var(--nx-border-1)' }}>
        <p style={{ fontSize: 11, color: 'var(--nx-text-400)', lineHeight: 1.6 }}>
          {SOURCE_DESCRIPTIONS[activeSource]}
        </p>
      </div>

      {/* Source-specific picker rendered via SchemaFormRenderer */}
      {activeSource === 'none' && (
        <div className="flex flex-col items-center justify-center py-10 px-4 gap-3">
          <Database size={22} style={{ color: 'var(--nx-text-200)' }} />
          <p style={{ fontSize: 12, color: 'var(--nx-text-400)', textAlign: 'center', lineHeight: 1.6 }}>
            Select a data source above to bind dynamic content to this layer.
          </p>
        </div>
      )}

      {activeSource === 'collection' && (
        <div className="px-4 py-3">
          <SchemaFormRenderer
            schema={COLLECTION_SCHEMA}
            values={values}
            onChange={onChange}
          />
          <p style={{ fontSize: 11, color: 'var(--nx-text-400)', marginTop: 6, lineHeight: 1.5 }}>
            The canvas updates automatically when you select a collection.
          </p>
        </div>
      )}

      {activeSource === 'product' && (
        <div className="px-4 py-3">
          <SchemaFormRenderer
            schema={PRODUCT_SCHEMA}
            values={values}
            onChange={onChange}
          />
          <p style={{ fontSize: 11, color: 'var(--nx-text-400)', marginTop: 6, lineHeight: 1.5 }}>
            Feature a single product in this section.
          </p>
        </div>
      )}

      {activeSource === 'menu' && (
        <div className="px-4 py-3">
          <SchemaFormRenderer
            schema={MENU_SCHEMA}
            values={values}
            onChange={onChange}
          />
          <p style={{ fontSize: 11, color: 'var(--nx-text-400)', marginTop: 6, lineHeight: 1.5 }}>
            The selected menu will be used for navigation blocks in this section.
          </p>
        </div>
      )}

      {activeSource === 'category' && (
        <div className="px-4 py-3">
          <SchemaFormRenderer
            schema={CATEGORY_SCHEMA}
            values={values}
            onChange={onChange}
          />
          <p style={{ fontSize: 11, color: 'var(--nx-text-400)', marginTop: 6, lineHeight: 1.5 }}>
            Shows products belonging to this category.
          </p>
        </div>
      )}

      {/* Clear binding */}
      {activeSource !== 'none' && (
        <div className="px-4 py-3" style={{ borderTop: '1px solid var(--nx-border-1)' }}>
          <button
            onClick={clearBinding}
            className="flex items-center gap-2 px-3 py-2 rounded-lg w-full transition-all"
            style={{ fontSize: 12, color: 'var(--nx-error)', border: '1px solid transparent' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(244,63,94,0.07)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(244,63,94,0.2)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.borderColor = 'transparent'; }}
          >
            <X size={13} />
            Remove {SOURCE_LABELS[activeSource]} binding
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Node inspector header ────────────────────────────────────────────────────

const NodeHeader: React.FC<{ label: string; typeLabel: string; accentColor: string }> = ({ label, typeLabel, accentColor }) => (
  <div className="flex items-center gap-3 px-4 py-3 shrink-0" style={{ borderBottom: '1px solid var(--nx-border-1)' }}>
    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
      style={{ background: `${accentColor}20` }}>
      <div className="w-2 h-2 rounded-full" style={{ background: accentColor }} />
    </div>
    <div className="flex-1 min-w-0">
      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--nx-text-900)', lineHeight: 1.2 }} className="truncate">{label}</p>
      <p style={{ fontSize: 10, color: 'var(--nx-text-400)', marginTop: 1 }}>{typeLabel}</p>
    </div>
  </div>
);

// ─── Remove button ────────────────────────────────────────────────────────────

const RemoveButton: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
  <div className="shrink-0 px-4 py-3" style={{ borderTop: '1px solid var(--nx-border-1)' }}>
    <button
      onClick={onClick}
      className="flex items-center gap-2 rounded-lg px-2 py-1.5 w-full transition-colors"
      style={{ fontSize: 12, fontWeight: 500, color: 'var(--nx-error)' }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(244,63,94,0.08)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <Trash2 size={13} />
      Remove {label}
    </button>
  </div>
);

// ─── Section inspector ────────────────────────────────────────────────────────

const SectionInspector: React.FC<{ section: SectionDoc }> = ({ section }) => {
  const { state, dispatch, deselect, updateSectionSetting, removeSection } = useEditor();
  const [activeTab, setActiveTab] = useState<InspectorTab>('content');
  const definition   = useMemo(() => SECTION_DEFINITIONS.find((d) => d.type === section.type), [section.type]);
  const breakpoint   = state.activeBreakpoint;

  // When device changes, auto-switch to responsive tab
  const handleBreakpointChange = (bp: PreviewMode) => {
    dispatch({ type: 'SET_PREVIEW_MODE', mode: bp });
    if (bp !== 'desktop') setActiveTab('responsive');
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <NodeHeader
        label={section.label || definition?.name || section.type}
        typeLabel={`Section · ${section.type.replace(/_/g, ' ')}`}
        accentColor="var(--nx-node-section)"
      />
      <TabStrip active={activeTab} onChange={setActiveTab} breakpoint={breakpoint} />

      <div className="flex-1 overflow-hidden">
        {activeTab === 'content' && (
          <div className="h-full overflow-y-auto">
            {definition ? (
              definition.settingsSchema.length > 0 ? (
                <SchemaFormRenderer
                  schema={definition.settingsSchema}
                  values={section.settings}
                  onChange={(key, value) => updateSectionSetting(section.id, key, value)}
                />
              ) : (
                <div className="p-4" style={{ fontSize: 13, color: 'var(--nx-text-400)', fontStyle: 'italic' }}>
                  No configurable content settings.
                </div>
              )
            ) : (
              <div className="p-4" style={{ fontSize: 13, color: 'var(--nx-text-400)' }}>
                Unknown section type "{section.type}".
              </div>
            )}
          </div>
        )}
        {activeTab === 'style'   && (
          <StyleTab
            values={section.settings}
            onChange={(key, value) => updateSectionSetting(section.id, key, value)}
          />
        )}
        {activeTab === 'layout'  && (
          <LayoutTab
            values={section.settings}
            onChange={(key, value) => updateSectionSetting(section.id, key, value)}
          />
        )}
        {activeTab === 'responsive' && (
          <ResponsiveTab
            settings={section.settings}
            breakpoint={breakpoint}
            onDispatch={handleBreakpointChange}
            onClearKey={(key) => dispatch({
              type: 'CLEAR_RESPONSIVE_OVERRIDE',
              sectionId: section.id,
              key,
            })}
          />
        )}
        {activeTab === 'binding' && (
          <BindingTab
            values={section.settings}
            onChange={(key, value) => updateSectionSetting(section.id, key, value)}
          />
        )}
      </div>

      {!section.isSystem && (
        <RemoveButton label="section" onClick={() => { deselect(); removeSection(section.id); }} />
      )}
    </div>
  );
};

// ─── Block inspector ──────────────────────────────────────────────────────────

const BlockInspector: React.FC<{ block: BlockDoc; section: SectionDoc }> = ({ block, section }) => {
  const { state, dispatch, selectSection, updateBlockSetting, removeBlock } = useEditor();
  const [activeTab, setActiveTab] = useState<InspectorTab>('content');
  const definition   = useMemo(() => BLOCK_DEFINITIONS.find((d) => d.type === block.type), [block.type]);
  const breakpoint   = state.activeBreakpoint;

  const handleBreakpointChange = (bp: PreviewMode) => {
    dispatch({ type: 'SET_PREVIEW_MODE', mode: bp });
    if (bp !== 'desktop') setActiveTab('responsive');
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <NodeHeader
        label={definition?.name ?? block.type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
        typeLabel={`Element · ${block.type.replace(/_/g, ' ')}`}
        accentColor="var(--nx-node-content)"
      />
      <Breadcrumb
        parts={[
          { label: section.label, onClick: () => selectSection(section.id, section.groupHandle) },
          { label: definition?.name ?? block.type },
        ]}
      />
      <TabStrip active={activeTab} onChange={setActiveTab} breakpoint={breakpoint} />

      <div className="flex-1 overflow-hidden">
        {activeTab === 'content' && (
          <div className="h-full overflow-y-auto">
            {definition ? (
              definition.settingsSchema.length > 0 ? (
                <SchemaFormRenderer
                  schema={definition.settingsSchema}
                  values={block.settings}
                  onChange={(key, value) => updateBlockSetting(section.id, block.id, key, value)}
                  blockType={block.type}
                />
              ) : (
                <div className="p-4" style={{ fontSize: 13, color: 'var(--nx-text-400)', fontStyle: 'italic' }}>
                  No configurable content settings.
                </div>
              )
            ) : (
              <div className="p-4" style={{ fontSize: 13, color: 'var(--nx-text-400)' }}>
                Unknown block type "{block.type}".
              </div>
            )}
          </div>
        )}
        {activeTab === 'style'      && (
          <StyleTab
            values={block.settings}
            onChange={(key, value) => updateBlockSetting(section.id, block.id, key, value)}
          />
        )}
        {activeTab === 'layout'     && (
          <LayoutTab
            values={block.settings}
            onChange={(key, value) => updateBlockSetting(section.id, block.id, key, value)}
          />
        )}
        {activeTab === 'responsive' && (
          <ResponsiveTab
            settings={block.settings}
            breakpoint={breakpoint}
            onDispatch={handleBreakpointChange}
            onClearKey={(key) => dispatch({
              type: 'CLEAR_BLOCK_RESPONSIVE_OVERRIDE',
              sectionId: section.id,
              blockId:   block.id,
              key,
            })}
          />
        )}
        {activeTab === 'binding'    && (
          <BindingTab
            values={block.settings}
            onChange={(key, value) => updateBlockSetting(section.id, block.id, key, value)}
          />
        )}
      </div>

      {!block.isRequired && (
        <RemoveButton label="element" onClick={() => removeBlock(section.id, block.id)} />
      )}
    </div>
  );
};

// ─── Phase 5: Node inspector ─────────────────────────────────────────────────
//
// Renders when nodeMode is active and a node is selected.
// Reuses all existing tab components (StyleTab, LayoutTab, ResponsiveTab,
// BindingTab, NodeHeader, RemoveButton, TabStrip, Breadcrumb) without changes.
//
// Data flow:
//   READ:  selectedNode.settings / selectedNode.responsive / selectedNode.visibility
//   WRITE: dispatch UPDATE_NODE (settings + responsive via activeBreakpoint)
//          dispatch CLEAR_NODE_RESPONSIVE_OVERRIDE (responsive clear)
//          dispatch UPDATE_NODE_VISIBILITY (per-breakpoint visibility)
//          dispatch REMOVE_NODE (delete)

const NodeInspector: React.FC<{ node: Node }> = ({ node }) => {
  const { state, dispatch, selectNode } = useEditor();
  const [activeTab, setActiveTab] = useState<InspectorTab>('content');
  const breakpoint = state.activeBreakpoint;
  const isSystem   = !!(node.settings._nx_isSystem as boolean);

  // ── Schema lookup ────────────────────────────────────────────────────────────
  // Try SECTION_DEFINITIONS first (hero, newsletter, etc.),
  // then BLOCK_DEFINITIONS (heading, button, etc.),
  // then null (layout primitives, page structure types).
  const schema = useMemo(() => {
    const sec = SECTION_DEFINITIONS.find((d) => d.type === node.type);
    if (sec) return sec.settingsSchema;
    const blk = BLOCK_DEFINITIONS.find((d) => d.type === node.type);
    if (blk) return blk.settingsSchema;
    return null;
  }, [node.type]);

  // ── Merged settings for ResponsiveTab ────────────────────────────────────────
  // ResponsiveTab expects settings.responsive.{bp}.* for overrides,
  // and settings['visibility.{bp}'] for the visibility toggles.
  // We inject those from node.responsive and node.visibility respectively.
  const mergedSettings = useMemo<Record<string, any>>(() => ({
    ...node.settings,
    responsive:          node.responsive ?? {},
    'visibility.desktop': node.visibility?.desktop,
    'visibility.tablet':  node.visibility?.tablet,
    'visibility.mobile':  node.visibility?.mobile,
  }), [node.settings, node.responsive, node.visibility]);

  // ── Parent for breadcrumb ─────────────────────────────────────────────────────
  const parentNode = useMemo(() => {
    if (!state.nodeTree) return null;
    const parent = findParent(state.nodeTree, node.id);
    if (!parent) return null;
    // Don't show breadcrumb when parent is a page_group (header/body/footer)
    if (parent.type === 'page_group' || parent.type === 'page_root') return null;
    return parent;
  }, [state.nodeTree, node.id]);

  // ── Write handlers ────────────────────────────────────────────────────────────

  const handleSettingChange = useCallback((key: string, value: any) => {
    dispatch({ type: 'UPDATE_NODE', nodeId: node.id, key, value });
  }, [dispatch, node.id]);

  const handleBreakpointChange = useCallback((bp: PreviewMode) => {
    dispatch({ type: 'SET_PREVIEW_MODE', mode: bp });
    if (bp !== 'desktop') setActiveTab('responsive');
  }, [dispatch]);

  const handleClearResponsive = useCallback((key: string) => {
    dispatch({ type: 'CLEAR_NODE_RESPONSIVE_OVERRIDE', nodeId: node.id, key });
  }, [dispatch, node.id]);

  const handleVisibilityChange = useCallback((bp: PreviewMode, visible: boolean) => {
    dispatch({ type: 'UPDATE_NODE_VISIBILITY', nodeId: node.id, bp, visible });
  }, [dispatch, node.id]);

  // ── Labels ───────────────────────────────────────────────────────────────────
  const typeLabel  = node.type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const isSection  = SECTION_DEFINITIONS.some((d) => d.type === node.type);
  const removeLabel = isSection ? 'section' : 'element';

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <NodeHeader
        label={node.label ?? typeLabel}
        typeLabel={`${isSection ? 'Section' : 'Element'} · ${typeLabel}`}
        accentColor={isSection ? 'var(--nx-node-section)' : 'var(--nx-node-content)'}
      />

      {/* Breadcrumb — shown only when the selected node is a child of another section */}
      {parentNode && (
        <Breadcrumb
          parts={[
            { label: parentNode.label ?? parentNode.type, onClick: () => selectNode(parentNode.id) },
            { label: node.label ?? typeLabel },
          ]}
        />
      )}

      <TabStrip active={activeTab} onChange={setActiveTab} breakpoint={breakpoint} />

      <div className="flex-1 overflow-hidden">

        {/* Content — schema-driven form from SECTION_DEFINITIONS / BLOCK_DEFINITIONS */}
        {activeTab === 'content' && (
          <div className="h-full overflow-y-auto">
            {schema && schema.length > 0 ? (
              <SchemaFormRenderer
                schema={schema}
                values={node.settings}
                onChange={handleSettingChange}
              />
            ) : schema !== null ? (
              <div className="p-4" style={{ fontSize: 13, color: 'var(--nx-text-400)', fontStyle: 'italic' }}>
                No configurable content settings for this node type.
              </div>
            ) : (
              <div className="p-4" style={{ fontSize: 12, color: 'var(--nx-text-400)', lineHeight: 1.7 }}>
                <p style={{ fontWeight: 600, color: 'var(--nx-text-600)', marginBottom: 6 }}>
                  {typeLabel}
                </p>
                <p>
                  No settings schema is registered for "{node.type}".
                  Use the Style and Layout tabs to apply visual properties.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Style — CSS properties via STYLE_SCHEMA */}
        {activeTab === 'style' && (
          <StyleTab values={node.settings} onChange={handleSettingChange} />
        )}

        {/* Layout — flex/grid layout via LAYOUT_SCHEMA */}
        {activeTab === 'layout' && (
          <LayoutTab values={node.settings} onChange={handleSettingChange} />
        )}

        {/* Responsive — breakpoint switcher + overrides list + per-breakpoint visibility */}
        {activeTab === 'responsive' && (
          <ResponsiveTab
            settings={mergedSettings}
            breakpoint={breakpoint}
            onDispatch={handleBreakpointChange}
            onClearKey={handleClearResponsive}
            onVisibilityChange={handleVisibilityChange}
          />
        )}

        {/* Bind — data source binding (collection, product, menu, category) */}
        {activeTab === 'binding' && (
          <BindingTab
            values={node.settings}
            onChange={handleSettingChange}
          />
        )}
      </div>

      {/* Remove — only for non-system, non-page-structure nodes */}
      {!isSystem && node.type !== 'page_root' && node.type !== 'page_group' && (
        <RemoveButton
          label={removeLabel}
          onClick={() => dispatch({ type: 'REMOVE_NODE', nodeId: node.id })}
        />
      )}
    </div>
  );
};

// ─── Inspector Panel root ─────────────────────────────────────────────────────

const InspectorPanel: React.FC = () => {
  const { state, selectedSection, selectedBlock, selectedNode } = useEditor();
  const { selection } = state;

  const fontStyle: React.CSSProperties = { fontFamily: "'Plus Jakarta Sans', sans-serif" };

  // ── Phase 5: node mode — inspect the selected Node ──────────────────────────
  if (state.nodeMode) {
    if (!selectedNode) {
      return (
        <div className="h-full flex flex-col" style={fontStyle}>
          <EmptyState />
        </div>
      );
    }
    return (
      <div className="h-full flex flex-col overflow-hidden" style={fontStyle}>
        <NodeInspector node={selectedNode} />
      </div>
    );
  }

  // ── Legacy SectionDoc path (unchanged) ────────────────────────────────────
  if (selection.type === 'none' || !selectedSection) {
    return (
      <div className="h-full flex flex-col" style={fontStyle}>
        <EmptyState />
      </div>
    );
  }

  if (selection.type === 'block' && selectedBlock) {
    return (
      <div className="h-full flex flex-col overflow-hidden" style={fontStyle}>
        <BlockInspector block={selectedBlock} section={selectedSection} />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden" style={fontStyle}>
      <SectionInspector section={selectedSection} />
    </div>
  );
};

export default InspectorPanel;
