import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, X, GripVertical, ChevronDown, ChevronRight,
  Loader2, Save, Mail, Link, CreditCard, Smartphone,
  AlignLeft, Code, Globe, Star, FileText, AlertCircle,
  Trash2, Facebook, Twitter, Instagram, Youtube, Linkedin,
} from 'lucide-react';
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, useSortable,
  verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { toast } from 'sonner';
import { Card } from './ui';
import { themeEngineService } from '@/services/themeEngineService';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FooterWidget {
  id:       string;
  type:     string;
  settings: Record<string, any>;
}

interface FooterColumn {
  id:           string;
  title:        string;
  widthPercent: number;
  widgets:      FooterWidget[];
}

interface FooterBottomBar {
  backgroundColor: string;
  components:      FooterWidget[];
}

interface FooterSettings {
  topBackground: string;
  topBorder:     boolean;
  divider:       boolean;
  dividerColor:  string;
  paddingTop:    number;
  paddingBottom: number;
  showBottomBar: boolean;
  bottomBarBg:   string;
}

// ─── Widget metadata ──────────────────────────────────────────────────────────

const WIDGET_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  brand_block:    { label: 'Brand Block',     icon: Star,      color: 'bg-indigo-500' },
  nav_column:     { label: 'Nav Column',      icon: Link,      color: 'bg-violet-500' },
  newsletter:     { label: 'Newsletter',      icon: Mail,      color: 'bg-emerald-500' },
  contact_info:   { label: 'Contact Info',    icon: AlignLeft, color: 'bg-blue-500'   },
  payment_badges: { label: 'Payment Badges',  icon: CreditCard,color: 'bg-amber-500'  },
  app_badges:     { label: 'App Badges',      icon: Smartphone,color: 'bg-rose-500'   },
  copyright:      { label: 'Copyright',       icon: FileText,  color: 'bg-slate-500'  },
  legal_links:    { label: 'Legal Links',     icon: FileText,  color: 'bg-slate-400'  },
  social_icons:   { label: 'Social Icons',    icon: Globe,     color: 'bg-pink-500'   },
  custom_html:    { label: 'Custom HTML',     icon: Code,      color: 'bg-slate-600'  },
};

const WIDGET_TYPES = Object.keys(WIDGET_META);

const DEFAULT_COLUMNS: FooterColumn[] = [
  {
    id: 'col-brand', title: 'Brand', widthPercent: 40,
    widgets: [
      { id: 'bb-1', type: 'brand_block', settings: { showSocial: true } },
      { id: 'nl-1', type: 'newsletter',  settings: { heading: 'Stay in the Loop' } },
    ],
  },
  {
    id: 'col-shop', title: 'Shop', widthPercent: 20,
    widgets: [{ id: 'nav-shop', type: 'nav_column', settings: { title: 'Shop', menuHandle: 'footer-shop' } }],
  },
  {
    id: 'col-help', title: 'Help', widthPercent: 20,
    widgets: [{ id: 'nav-help', type: 'nav_column', settings: { title: 'Help', menuHandle: 'footer-help' } }],
  },
  {
    id: 'col-app', title: 'Get the App', widthPercent: 20,
    widgets: [{ id: 'app-1', type: 'app_badges', settings: {} }],
  },
];

const DEFAULT_BOTTOM_BAR: FooterBottomBar = {
  backgroundColor: '#1f2937',
  components: [
    { id: 'copy-1',  type: 'copyright',     settings: { text: '© {{year}} {{store_name}}. All rights reserved.' } },
    { id: 'pay-1',   type: 'payment_badges', settings: { set: 'stripe' } },
    { id: 'legal-1', type: 'legal_links',    settings: { links: [] } },
  ],
};

const DEFAULT_SETTINGS: FooterSettings = {
  topBackground: '#111827',
  topBorder:     true,
  divider:       true,
  dividerColor:  '#374151',
  paddingTop:    48,
  paddingBottom: 48,
  showBottomBar: true,
  bottomBarBg:   '#0f172a',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const clampWidths = (cols: FooterColumn[]): FooterColumn[] => {
  if (!cols.length) return cols;
  const total = cols.reduce((s, c) => s + c.widthPercent, 0);
  if (total === 100) return cols;
  const scale = 100 / total;
  return cols.map((c, i) => {
    const w = i === cols.length - 1
      ? 100 - cols.slice(0, -1).reduce((s, _cc, j) => s + Math.round(cols[j].widthPercent * scale), 0)
      : Math.round(c.widthPercent * scale);
    return { ...c, widthPercent: Math.max(15, w) };
  });
};

// ─── Link array editor — used by legal_links and social_icons settings ────────

interface LinkItem { label: string; url: string }

const LinkArrayEditor: React.FC<{
  items:    LinkItem[];
  onChange: (items: LinkItem[]) => void;
  urlLabel?: string;
}> = ({ items, onChange, urlLabel = 'URL' }) => {
  const add   = () => onChange([...items, { label: '', url: '' }]);
  const del   = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const patch = (i: number, key: keyof LinkItem, val: string) =>
    onChange(items.map((item, idx) => idx === i ? { ...item, [key]: val } : item));

  return (
    <div className="space-y-1.5">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-1">
          <div className="flex flex-col gap-1 flex-1 min-w-0">
            <input
              type="text" value={item.label} placeholder="Label"
              onChange={(e) => patch(i, 'label', e.target.value)}
              className="w-full px-2 py-1 text-[10px] rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            />
            <input
              type="text" value={item.url} placeholder={urlLabel}
              onChange={(e) => patch(i, 'url', e.target.value)}
              className="w-full px-2 py-1 text-[10px] rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white font-mono"
            />
          </div>
          <button onClick={() => del(i)} className="text-slate-400 hover:text-red-500 shrink-0">
            <X size={12} />
          </button>
        </div>
      ))}
      <button
        onClick={add}
        className="w-full flex items-center justify-center gap-1 py-1 rounded border border-dashed border-slate-300 dark:border-slate-600 text-[10px] text-slate-400 hover:text-indigo-500 hover:border-indigo-300 transition-colors"
      >
        <Plus size={10} /> Add link
      </button>
    </div>
  );
};

// ─── SortableWidgetChip ───────────────────────────────────────────────────────

const SortableWidgetChip: React.FC<{
  widget:     FooterWidget;
  isSelected: boolean;
  onSelect:   () => void;
  onRemove:   () => void;
}> = ({ widget, isSelected, onSelect, onRemove }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: widget.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const meta  = WIDGET_META[widget.type] ?? { label: widget.type, icon: Code, color: 'bg-slate-400' };
  const Icon  = meta.icon;

  return (
    <div ref={setNodeRef} style={style}
      onClick={onSelect}
      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-all group ${
        isSelected
          ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
          : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-indigo-300'
      }`}
    >
      <span {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-slate-300 dark:text-slate-500 touch-none">
        <GripVertical size={12} />
      </span>
      <div className={`w-4 h-4 rounded flex items-center justify-center ${meta.color} flex-shrink-0`}>
        <Icon size={9} className="text-white" />
      </div>
      <span className="flex-1 truncate">{meta.label}</span>
      <button onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all">
        <X size={11} />
      </button>
    </div>
  );
};

// ─── Widget settings panels ───────────────────────────────────────────────────

const WidgetSettingsPanel: React.FC<{
  widget:   FooterWidget;
  onChange: (settings: Record<string, any>) => void;
}> = ({ widget, onChange }) => {
  const set  = (key: string, val: any) => onChange({ ...widget.settings, [key]: val });
  const meta = WIDGET_META[widget.type];

  const field = (label: string, key: string, type: 'text' | 'toggle' | 'select', choices?: { label: string; value: string }[]) => (
    <div key={key} className="space-y-1">
      <label className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</label>
      {type === 'text' && (
        <input type="text" value={widget.settings[key] ?? ''} onChange={(e) => set(key, e.target.value)}
          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
      )}
      {type === 'toggle' && (
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={!!widget.settings[key]} onChange={(e) => set(key, e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-indigo-600" />
          <span className="text-xs text-slate-500 dark:text-slate-400">Enabled</span>
        </label>
      )}
      {type === 'select' && (
        <select value={widget.settings[key] ?? ''} onChange={(e) => set(key, e.target.value)}
          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white">
          {choices?.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      )}
    </div>
  );

  const PANELS: Record<string, React.ReactNode> = {
    brand_block: (
      <div className="space-y-3">
        {field('Tagline', 'tagline', 'text')}
        {field('Show Social Icons', 'showSocial', 'toggle')}
      </div>
    ),
    nav_column: (
      <div className="space-y-3">
        {field('Column Title', 'title', 'text')}
        {field('Menu Handle', 'menuHandle', 'text')}
        <p className="text-[10px] text-slate-400 leading-relaxed">
          Enter the handle of the menu to display (e.g. <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">footer-shop</code>).
          Menu items are resolved at preview time from the Menus module.
        </p>
      </div>
    ),
    newsletter: (
      <div className="space-y-3">
        {field('Heading', 'heading', 'text')}
        {field('Subtext', 'subtext', 'text')}
        {field('Placeholder', 'placeholder', 'text')}
        {field('Button Label', 'buttonLabel', 'text')}
      </div>
    ),
    contact_info: (
      <div className="space-y-3">
        {field('Address', 'address', 'text')}
        {field('Phone', 'phone', 'text')}
        {field('Email', 'email', 'text')}
      </div>
    ),
    payment_badges: (
      <div className="space-y-3">
        {field('Badge Set', 'set', 'select', [
          { label: 'Stripe Set', value: 'stripe' },
          { label: 'Generic',   value: 'generic' },
        ])}
      </div>
    ),
    app_badges: (
      <div className="space-y-3">
        {field('App Store URL', 'appStoreUrl', 'text')}
        {field('Google Play URL', 'googlePlayUrl', 'text')}
      </div>
    ),
    copyright: (
      <div className="space-y-3">
        {field('Text', 'text', 'text')}
        <p className="text-[10px] text-slate-400">
          Use <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">{'{{year}}'}</code> and{' '}
          <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">{'{{store_name}}'}</code> as dynamic variables.
        </p>
      </div>
    ),
    legal_links: (
      <div className="space-y-2">
        <label className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide block">Links</label>
        <LinkArrayEditor
          items={Array.isArray(widget.settings.links) ? widget.settings.links : []}
          onChange={(links) => onChange({ ...widget.settings, links })}
          urlLabel="https://... URL"
        />
      </div>
    ),
    social_icons: (
      <div className="space-y-2">
        <label className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide block">Social Links</label>
        <p className="text-[10px] text-slate-400 mb-1">Enter each platform name and its profile URL.</p>
        <LinkArrayEditor
          items={Array.isArray(widget.settings.links) ? widget.settings.links : []}
          onChange={(links) => onChange({ ...widget.settings, links })}
          urlLabel="Profile URL"
        />
      </div>
    ),
    custom_html: (
      <div className="space-y-3">
        <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">HTML</label>
        <textarea
          value={widget.settings.html ?? ''}
          onChange={(e) => set('html', e.target.value)}
          rows={4}
          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white font-mono"
        />
      </div>
    ),
  };

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-2">
        <div className={`w-5 h-5 rounded flex items-center justify-center ${meta?.color ?? 'bg-slate-400'}`}>
          {meta && React.createElement(meta.icon, { size: 10, className: 'text-white' })}
        </div>
        <span className="text-xs font-bold text-slate-800 dark:text-white">{meta?.label ?? widget.type}</span>
      </div>
      {PANELS[widget.type] ?? <p className="text-xs text-slate-400 italic">No settings for this widget.</p>}
    </div>
  );
};

// ─── Width Ruler ──────────────────────────────────────────────────────────────

const WidthRuler: React.FC<{
  columns:  FooterColumn[];
  onChange: (cols: FooterColumn[]) => void;
}> = ({ columns, onChange }) => {
  const colors = ['bg-indigo-500', 'bg-violet-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500'];
  const total  = columns.reduce((s, c) => s + c.widthPercent, 0);
  const isValid = total === 100;

  const adjustWidth = (idx: number, delta: number) => {
    const next   = [...columns];
    const newW   = Math.max(15, Math.min(70, next[idx].widthPercent + delta));
    const diff   = newW - next[idx].widthPercent;
    const adjIdx = idx + 1 < next.length ? idx + 1 : idx - 1;
    if (adjIdx < 0 || adjIdx >= next.length) return;
    const adjNew = Math.max(15, next[adjIdx].widthPercent - diff);
    next[idx]    = { ...next[idx], widthPercent: newW };
    next[adjIdx] = { ...next[adjIdx], widthPercent: adjNew };
    onChange(next);
  };

  return (
    <div className="space-y-1.5 mb-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Column Widths</p>
        {!isValid && (
          <span className="text-[10px] font-medium text-amber-600 flex items-center gap-1">
            <AlertCircle size={10} /> Sum = {total}% (must be 100%)
          </span>
        )}
      </div>
      <div className="flex rounded-lg overflow-hidden h-5">
        {columns.map((col, i) => (
          <div key={col.id} className={`${colors[i % colors.length]} flex items-center justify-center`}
            style={{ width: `${col.widthPercent}%` }}>
            <span className="text-[8px] font-bold text-white truncate px-1">{col.widthPercent}%</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {columns.map((col, i) => (
          <div key={col.id} className="flex items-center gap-1">
            <div className={`w-2.5 h-2.5 rounded-sm flex-shrink-0 ${colors[i % colors.length]}`} />
            <span className="text-[10px] text-slate-500 truncate flex-1">{col.title || `Col ${i + 1}`}</span>
            <div className="flex items-center gap-0.5">
              <button onClick={() => adjustWidth(i, -5)} className="w-4 h-4 flex items-center justify-center rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs">-</button>
              <span className="text-[10px] font-mono w-8 text-center text-slate-700 dark:text-slate-300">{col.widthPercent}%</span>
              <button onClick={() => adjustWidth(i, +5)} className="w-4 h-4 flex items-center justify-center rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs">+</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Footer Canvas — visual preview inside FooterBuilder ──────────────────────
// Renders widgets from their actual settings — NO hardcoded demo values.

const FooterCanvas: React.FC<{
  columns:     FooterColumn[];
  bottomBar:   FooterBottomBar;
  settings:    FooterSettings;
  themeColors: Record<string, string>;
}> = ({ columns, bottomBar, settings, themeColors }) => {
  const accent = themeColors.accent ?? '#f59e0b';

  const renderWidget = (w: FooterWidget) => {
    const meta = WIDGET_META[w.type];
    switch (w.type) {

      case 'brand_block':
        return (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: accent }}>
                <span className="text-white text-[8px] font-bold">N</span>
              </div>
              <span className="text-xs font-bold text-white">Store</span>
            </div>
            {w.settings.tagline
              ? <p className="text-[10px] text-slate-400">{w.settings.tagline}</p>
              : <p className="text-[10px] text-slate-600 italic">No tagline set</p>}
            {w.settings.showSocial && (
              <div className="flex gap-1.5 pt-1">
                {['f', 'in', 'tw'].map((s) => (
                  <div key={s} className="w-5 h-5 rounded-full bg-slate-600 flex items-center justify-center">
                    <span className="text-[8px] text-white font-bold">{s[0].toUpperCase()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'newsletter':
        return (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-white">
              {w.settings.heading || <span className="italic text-slate-500">No heading</span>}
            </p>
            {w.settings.subtext && <p className="text-[10px] text-slate-400">{w.settings.subtext}</p>}
            <div className="flex gap-1">
              <div className="flex-1 bg-slate-700 rounded px-2 py-1 text-[10px] text-slate-400">
                {w.settings.placeholder || 'Email address'}
              </div>
              <div className="px-2 py-1 rounded text-[10px] text-white font-bold" style={{ background: accent }}>
                {w.settings.buttonLabel || 'Subscribe'}
              </div>
            </div>
          </div>
        );

      case 'nav_column': {
        // Canvas shows the configured menu handle, not hardcoded links.
        const handle = w.settings.menuHandle;
        return (
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-white uppercase tracking-wide">
              {w.settings.title || 'Links'}
            </p>
            {handle
              ? <p className="text-[10px] text-indigo-400 italic">Menu: {handle}</p>
              : <p className="text-[10px] text-slate-500 italic">No menu handle set</p>}
          </div>
        );
      }

      case 'contact_info':
        return (
          <div className="space-y-1">
            {w.settings.address && <p className="text-[10px] text-slate-400">{w.settings.address}</p>}
            {w.settings.phone   && <p className="text-[10px] text-slate-400">{w.settings.phone}</p>}
            {w.settings.email   && <p className="text-[10px] text-slate-400">{w.settings.email}</p>}
            {!w.settings.address && !w.settings.phone && !w.settings.email && (
              <p className="text-[10px] text-slate-500 italic">No contact info set</p>
            )}
          </div>
        );

      case 'payment_badges':
        return (
          <div className="flex gap-1 flex-wrap">
            {['V', 'MC', 'PP', 'GP'].map((p) => (
              <div key={p} className="px-2 py-0.5 bg-slate-700 rounded text-[8px] font-bold text-slate-300">{p}</div>
            ))}
          </div>
        );

      case 'app_badges': {
        const hasAppStore  = !!w.settings.appStoreUrl;
        const hasPlayStore = !!w.settings.googlePlayUrl;
        return (
          <div className="space-y-1">
            <div className={`px-2 py-1 rounded text-[10px] font-medium ${hasAppStore ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-500 italic'}`}>
              {hasAppStore ? 'App Store' : 'App Store URL not set'}
            </div>
            <div className={`px-2 py-1 rounded text-[10px] font-medium ${hasPlayStore ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-500 italic'}`}>
              {hasPlayStore ? 'Google Play' : 'Google Play URL not set'}
            </div>
          </div>
        );
      }

      case 'copyright': {
        const text = w.settings.text || '© {{year}} {{store_name}}. All rights reserved.';
        return (
          <p className="text-[10px] text-slate-400">
            {text.replace('{{year}}', String(new Date().getFullYear()))}
          </p>
        );
      }

      case 'legal_links': {
        const links: Array<{ label: string; url: string }> = Array.isArray(w.settings.links) ? w.settings.links : [];
        return links.length > 0
          ? (
            <div className="flex gap-2 flex-wrap">
              {links.map((l) => (
                <span key={l.label} className="text-[10px] text-slate-400 hover:text-white cursor-pointer">{l.label}</span>
              ))}
            </div>
          )
          : <p className="text-[10px] text-slate-500 italic">No links configured</p>;
      }

      case 'social_icons': {
        const links: Array<{ label: string; url: string }> = Array.isArray(w.settings.links) ? w.settings.links : [];
        return links.length > 0
          ? (
            <div className="flex gap-1.5 flex-wrap">
              {links.map((l) => (
                <div key={l.label} className="w-5 h-5 rounded-full bg-slate-600 flex items-center justify-center" title={l.url}>
                  <span className="text-[8px] text-white font-bold">{(l.label[0] || '?').toUpperCase()}</span>
                </div>
              ))}
            </div>
          )
          : <p className="text-[10px] text-slate-500 italic">No social links configured</p>;
      }

      case 'custom_html':
        return (
          <div className="text-[10px] text-slate-400 font-mono bg-slate-800 rounded p-1.5 truncate">
            {w.settings.html ? String(w.settings.html).slice(0, 60) + (String(w.settings.html).length > 60 ? '…' : '') : <span className="italic text-slate-600">No HTML set</span>}
          </div>
        );

      default:
        return <div className="text-[10px] text-slate-500 italic">{meta?.label ?? w.type}</div>;
    }
  };

  return (
    <div className="rounded-xl overflow-hidden shadow-2xl border border-slate-700">
      {/* Top footer */}
      <div style={{ background: settings.topBackground }} className="px-5 py-5">
        <div className="flex gap-4">
          {columns.map((col) => (
            <div key={col.id} style={{ flexBasis: `${col.widthPercent}%`, flexShrink: 0 }} className="space-y-3">
              {col.widgets.map((w) => (
                <div key={w.id}>{renderWidget(w)}</div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {settings.divider && <div style={{ background: settings.dividerColor, height: 1 }} />}

      {/* Bottom bar */}
      {settings.showBottomBar && (
        <div style={{ background: bottomBar.backgroundColor }} className="px-5 py-2.5 flex items-center gap-4">
          {bottomBar.components.map((w) => (
            <div key={w.id}>{renderWidget(w)}</div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────

interface FooterBuilderProps {
  themeColors:    Record<string, string>;
  onDraftChange?: () => void;
}

const FooterBuilder: React.FC<FooterBuilderProps> = ({ themeColors, onDraftChange }) => {
  const [columns,   setColumns]   = useState<FooterColumn[]>(DEFAULT_COLUMNS);
  const [bottomBar, setBottomBar] = useState<FooterBottomBar>(DEFAULT_BOTTOM_BAR);
  const [settings,  setSettings]  = useState<FooterSettings>(DEFAULT_SETTINGS);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [dirty,     setDirty]     = useState(false);

  const [expandedCol,     setExpandedCol]     = useState<string | null>('col-brand');
  const [selectedWidget,  setSelectedWidget]  = useState<{ colId: string; widgetId: string } | null>(null);
  const [pickerColId,     setPickerColId]     = useState<string | null>(null);
  const [showSettings,    setShowSettings]    = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor,    { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor,   { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // ── Load draft on mount ────────────────────────────────────────────────────

  useEffect(() => {
    themeEngineService.getFooter()
      .then((res: any) => {
        // API returns TransformInterceptor wrapper: { success, data: { draft, published } }
        const draft = res?.draft ?? res?.data?.draft;
        if (draft?.columns?.length) {
          setColumns(draft.columns);
          if (draft.bottomBar) setBottomBar(draft.bottomBar);
          if (draft.settings) {
            // Migrate old paddingVertical (string) → paddingTop/paddingBottom (numbers)
            const s = draft.settings;
            const migrated: FooterSettings = {
              topBackground: s.topBackground ?? DEFAULT_SETTINGS.topBackground,
              topBorder:     s.topBorder     ?? DEFAULT_SETTINGS.topBorder,
              divider:       s.divider       ?? DEFAULT_SETTINGS.divider,
              dividerColor:  s.dividerColor  ?? DEFAULT_SETTINGS.dividerColor,
              paddingTop:    s.paddingTop    ?? paddingVerticalToNumber(s.paddingVertical ?? 'lg'),
              paddingBottom: s.paddingBottom ?? paddingVerticalToNumber(s.paddingVertical ?? 'lg'),
              showBottomBar: s.showBottomBar ?? DEFAULT_SETTINGS.showBottomBar,
              bottomBarBg:   s.bottomBarBg   ?? DEFAULT_SETTINGS.bottomBarBg,
            };
            setSettings(migrated);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const markDirty = useCallback(() => {
    setDirty(true);
    onDraftChange?.();
  }, [onDraftChange]);

  // ── Column management ──────────────────────────────────────────────────────

  const addColumn = () => {
    if (columns.length >= 5) { toast.error('Maximum 5 columns allowed.'); return; }
    const newCol: FooterColumn = { id: uid(), title: `Column ${columns.length + 1}`, widthPercent: 20, widgets: [] };
    setColumns(clampWidths([...columns, newCol]));
    setExpandedCol(newCol.id);
    markDirty();
  };

  const removeColumn = (colId: string) => {
    if (columns.length <= 2) { toast.error('Footer must have at least 2 columns.'); return; }
    setColumns(clampWidths(columns.filter((c) => c.id !== colId)));
    markDirty();
  };

  const updateColumn = (colId: string, patch: Partial<FooterColumn>) => {
    setColumns((prev) => prev.map((c) => c.id === colId ? { ...c, ...patch } : c));
    markDirty();
  };

  // ── Widget management ──────────────────────────────────────────────────────

  const addWidget = (colId: string, type: string) => {
    const newWidget: FooterWidget = { id: uid(), type, settings: {} };
    setColumns((prev) => prev.map((c) =>
      c.id === colId ? { ...c, widgets: [...c.widgets, newWidget] } : c,
    ));
    setPickerColId(null);
    setSelectedWidget({ colId, widgetId: newWidget.id });
    markDirty();
  };

  const removeWidget = (colId: string, widgetId: string) => {
    setColumns((prev) => prev.map((c) =>
      c.id === colId ? { ...c, widgets: c.widgets.filter((w) => w.id !== widgetId) } : c,
    ));
    if (selectedWidget?.widgetId === widgetId) setSelectedWidget(null);
    markDirty();
  };

  const updateWidgetSettings = (colId: string, widgetId: string, newSettings: Record<string, any>) => {
    setColumns((prev) => prev.map((c) =>
      c.id === colId
        ? { ...c, widgets: c.widgets.map((w) => w.id === widgetId ? { ...w, settings: newSettings } : w) }
        : c,
    ));
    markDirty();
  };

  const handleDragEnd = (event: DragEndEvent, colId: string) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setColumns((prev) => prev.map((c) => {
      if (c.id !== colId) return c;
      const oI = c.widgets.findIndex((w) => w.id === active.id);
      const nI = c.widgets.findIndex((w) => w.id === over.id);
      return { ...c, widgets: arrayMove(c.widgets, oI, nI) };
    }));
    markDirty();
  };

  // ── Save ───────────────────────────────────────────────────────────────────

  const save = async () => {
    const total = columns.reduce((s, c) => s + c.widthPercent, 0);
    if (total !== 100) {
      toast.error(`Column widths must sum to 100% (currently ${total}%).`);
      return;
    }
    setSaving(true);
    try {
      await themeEngineService.updateFooterDraft({ columns, bottomBar, settings });
      setDirty(false);
      toast.success('Footer saved to draft.');
    } catch {
      toast.error('Failed to save footer. Changes preserved locally.');
    } finally {
      setSaving(false);
    }
  };

  const selectedColObj    = selectedWidget ? columns.find((c) => c.id === selectedWidget.colId) : null;
  const selectedWidgetObj = selectedColObj?.widgets.find((w) => w.id === selectedWidget?.widgetId) ?? null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <Loader2 size={24} className="animate-spin mr-2" />
        <span className="text-sm">Loading footer config…</span>
      </div>
    );
  }

  return (
    <div className="flex gap-4 min-h-[600px]">
      {/* ── LEFT PANEL ─────────────────────────────────────────────────────── */}
      <div className="w-72 flex-shrink-0 space-y-3 overflow-y-auto max-h-[700px] pr-1">

        {/* Width ruler */}
        <Card className="p-3">
          <WidthRuler columns={columns} onChange={(c) => { setColumns(c); markDirty(); }} />
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-slate-400">{columns.length} / 5 columns</p>
            <button onClick={addColumn} disabled={columns.length >= 5}
              className="flex items-center gap-1 text-[10px] font-semibold text-indigo-600 hover:text-indigo-700 disabled:opacity-40">
              <Plus size={11} /> Add Column
            </button>
          </div>
        </Card>

        {/* Column accordions */}
        {columns.map((col) => {
          const isExpanded = expandedCol === col.id;
          return (
            <Card key={col.id} className="overflow-hidden">
              <div className="flex items-center">
                <button onClick={() => setExpandedCol(isExpanded ? null : col.id)}
                  className="flex-1 flex items-center justify-between px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50">
                  <div>
                    <input
                      type="text" value={col.title}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => updateColumn(col.id, { title: e.target.value })}
                      className="text-xs font-bold text-slate-800 dark:text-white bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-indigo-400 rounded px-0.5 w-28"
                    />
                    <p className="text-[10px] text-slate-400">
                      {col.widthPercent}% · {col.widgets.length} widget{col.widgets.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  {isExpanded
                    ? <ChevronDown size={14} className="text-slate-400" />
                    : <ChevronRight size={14} className="text-slate-400" />}
                </button>
                <button onClick={() => removeColumn(col.id)} title="Remove column"
                  className="px-2.5 text-slate-300 hover:text-red-500 transition-colors">
                  <Trash2 size={12} />
                </button>
              </div>

              {isExpanded && (
                <div className="border-t border-slate-100 dark:border-slate-700">
                  <div className="p-2 space-y-1.5">
                    <DndContext sensors={sensors} collisionDetection={closestCenter}
                      onDragEnd={(e) => handleDragEnd(e, col.id)}>
                      <SortableContext items={col.widgets.map((w) => w.id)} strategy={verticalListSortingStrategy}>
                        {col.widgets.map((widget) => (
                          <SortableWidgetChip key={widget.id} widget={widget}
                            isSelected={selectedWidget?.widgetId === widget.id}
                            onSelect={() => setSelectedWidget(
                              selectedWidget?.widgetId === widget.id ? null : { colId: col.id, widgetId: widget.id },
                            )}
                            onRemove={() => removeWidget(col.id, widget.id)}
                          />
                        ))}
                      </SortableContext>
                    </DndContext>

                    {/* Widget picker */}
                    {pickerColId === col.id ? (
                      <div className="rounded-lg border border-indigo-200 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 p-2">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wide">Add Widget</p>
                          <button onClick={() => setPickerColId(null)} className="text-slate-400 hover:text-slate-600"><X size={12} /></button>
                        </div>
                        <div className="grid grid-cols-2 gap-1">
                          {WIDGET_TYPES.map((type) => {
                            const m    = WIDGET_META[type];
                            const Icon = m.icon;
                            return (
                              <button key={type} onClick={() => addWidget(col.id, type)}
                                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-left">
                                <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${m.color}`}>
                                  <Icon size={9} className="text-white" />
                                </div>
                                <span className="text-[10px] text-slate-700 dark:text-slate-300">{m.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => { setPickerColId(col.id); setExpandedCol(col.id); }}
                        className="w-full flex items-center justify-center gap-1 py-1.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 text-xs text-slate-400 hover:text-indigo-500 hover:border-indigo-300 transition-colors">
                        <Plus size={12} /> Add Widget
                      </button>
                    )}
                  </div>

                  {/* Widget settings */}
                  {selectedWidgetObj && selectedWidget?.colId === col.id && (
                    <div className="border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                      <WidgetSettingsPanel
                        widget={selectedWidgetObj}
                        onChange={(s) => updateWidgetSettings(col.id, selectedWidget.widgetId, s)}
                      />
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}

        {/* Footer global settings */}
        <Card className="overflow-hidden">
          <button onClick={() => setShowSettings(!showSettings)}
            className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50">
            <p className="text-xs font-bold text-slate-800 dark:text-white">Footer Settings</p>
            {showSettings
              ? <ChevronDown size={14} className="text-slate-400" />
              : <ChevronRight size={14} className="text-slate-400" />}
          </button>

          {showSettings && (
            <div className="border-t border-slate-100 dark:border-slate-700 p-3 space-y-3">
              {/* Background */}
              <div>
                <label className="text-[10px] font-medium text-slate-500 block mb-1 uppercase tracking-wide">Top Footer Background</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={settings.topBackground}
                    onChange={(e) => { setSettings({ ...settings, topBackground: e.target.value }); markDirty(); }}
                    className="w-8 h-8 rounded cursor-pointer border border-slate-200 p-0.5" />
                  <span className="text-xs font-mono text-slate-400">{settings.topBackground}</span>
                </div>
              </div>

              {/* Bottom bar background */}
              <div>
                <label className="text-[10px] font-medium text-slate-500 block mb-1 uppercase tracking-wide">Bottom Bar Background</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={bottomBar.backgroundColor}
                    onChange={(e) => { setBottomBar({ ...bottomBar, backgroundColor: e.target.value }); markDirty(); }}
                    className="w-8 h-8 rounded cursor-pointer border border-slate-200 p-0.5" />
                  <span className="text-xs font-mono text-slate-400">{bottomBar.backgroundColor}</span>
                </div>
              </div>

              {/* Top border */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={settings.topBorder}
                  onChange={(e) => { setSettings({ ...settings, topBorder: e.target.checked }); markDirty(); }}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600" />
                <span className="text-xs text-slate-600 dark:text-slate-300">Top border line</span>
              </label>

              {/* Divider */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={settings.divider}
                  onChange={(e) => { setSettings({ ...settings, divider: e.target.checked }); markDirty(); }}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600" />
                <span className="text-xs text-slate-600 dark:text-slate-300">Divider between sections</span>
              </label>

              {/* Show bottom bar */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={settings.showBottomBar}
                  onChange={(e) => { setSettings({ ...settings, showBottomBar: e.target.checked }); markDirty(); }}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600" />
                <span className="text-xs text-slate-600 dark:text-slate-300">Show bottom bar</span>
              </label>

              {/* Padding */}
              <div>
                <label className="text-[10px] font-medium text-slate-500 block mb-1 uppercase tracking-wide">Padding (px)</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400">Top</label>
                    <input type="number" min={0} max={240} step={4} value={settings.paddingTop}
                      onChange={(e) => { setSettings({ ...settings, paddingTop: Number(e.target.value) }); markDirty(); }}
                      className="w-full px-2 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400">Bottom</label>
                    <input type="number" min={0} max={240} step={4} value={settings.paddingBottom}
                      onChange={(e) => { setSettings({ ...settings, paddingBottom: Number(e.target.value) }); markDirty(); }}
                      className="w-full px-2 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Save button */}
        <div className="pb-4">
          <button onClick={save} disabled={saving || !dirty}
            className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
              dirty
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
            }`}
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {saving ? 'Saving…' : dirty ? 'Save Footer' : 'Saved'}
          </button>
        </div>
      </div>

      {/* ── RIGHT PANEL — Canvas ──────────────────────────────────────────── */}
      <div className="flex-1 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
            Footer Preview
            {dirty && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                Unsaved changes
              </span>
            )}
          </h3>
        </div>

        <div className="bg-slate-800 dark:bg-slate-950 rounded-2xl p-4">
          <FooterCanvas columns={columns} bottomBar={bottomBar} settings={settings} themeColors={themeColors} />
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3">
          <p className="text-[11px] text-blue-700 dark:text-blue-300 font-medium mb-1">Tips</p>
          <ul className="text-[10px] text-blue-600 dark:text-blue-400 space-y-0.5 list-disc list-inside">
            <li>Column widths must sum to exactly 100% before saving</li>
            <li>Nav Column links come from the menu handle you set in the widget settings</li>
            <li>Use {`{{year}}`} and {`{{store_name}}`} in Copyright text for dynamic values</li>
            <li>Legal Links and Social Icons require links to be added via widget settings</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function paddingVerticalToNumber(v: string): number {
  const map: Record<string, number> = { sm: 24, md: 36, lg: 48, xl: 64 };
  return map[v] ?? 48;
}

export default FooterBuilder;
