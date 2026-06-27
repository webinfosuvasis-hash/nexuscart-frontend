import React, { useState, useEffect, useCallback } from 'react';
import {
  GripVertical, Plus, X, Settings2, ChevronDown, ChevronRight,
  Monitor, Tablet, Smartphone, Eye, EyeOff, Save, ShoppingBag,
  Search, ShoppingCart, User, Megaphone, Navigation, Zap,
  LayoutDashboard, Globe, SplitSquareHorizontal, Code,
  AlertCircle, Loader2, Check,
} from 'lucide-react';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
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

interface HeaderComponent {
  id:       string;
  type:     string;
  settings: Record<string, any>;
}

interface HeaderZone {
  id:            'zone1' | 'zone2' | 'zone3';
  components:    HeaderComponent[];
  background?:   string;
  visibility?:   string;
  paddingTop?:   number;
  paddingBottom?: number;
  borderBottom?: string;
  borderColor?:  string;
}

interface HeaderBehavior {
  stickyMode:        string;
  transparentOnHero: boolean;
  mobileBreakpoint:  string;
  mobileDrawerStyle: string;
  zIndex:            number;
}

type PreviewMode = 'desktop' | 'tablet' | 'mobile';

// ─── Component metadata (static — mirrors backend /theme/header/components) ──

const COMPONENT_META: Record<string, { label: string; icon: typeof ShoppingBag; color: string }> = {
  logo:              { label: 'Logo',             icon: LayoutDashboard, color: 'bg-indigo-500' },
  navigation:        { label: 'Navigation',        icon: Navigation,      color: 'bg-violet-500' },
  search:            { label: 'Search',            icon: Search,          color: 'bg-blue-500'   },
  cart:              { label: 'Cart',              icon: ShoppingCart,    color: 'bg-emerald-500' },
  account:           { label: 'Account',           icon: User,            color: 'bg-amber-500'  },
  announcement:      { label: 'Announcement',      icon: Megaphone,       color: 'bg-rose-500'   },
  cta_button:        { label: 'CTA Button',        icon: Zap,             color: 'bg-orange-500' },
  language_switcher: { label: 'Language',          icon: Globe,           color: 'bg-teal-500'   },
  currency_switcher: { label: 'Currency',          icon: Globe,           color: 'bg-cyan-500'   },
  social_icons:      { label: 'Social Icons',      icon: Globe,           color: 'bg-pink-500'   },
  spacer:            { label: 'Spacer',            icon: SplitSquareHorizontal, color: 'bg-slate-400' },
  custom_html:       { label: 'Custom HTML',       icon: Code,            color: 'bg-slate-600'  },
};

const COMPONENT_TYPES = Object.keys(COMPONENT_META);

const ZONE_META = {
  zone1: { label: 'Zone 1 — Top Bar',    desc: 'Announcements, utilities, language' },
  zone2: { label: 'Zone 2 — Main Header', desc: 'Logo, navigation, search, cart, account' },
  zone3: { label: 'Zone 3 — Sub-Nav',    desc: 'Category bar, mega menu' },
};

const DEFAULT_ZONES: HeaderZone[] = [
  {
    id: 'zone1', background: 'transparent', visibility: 'all',
    paddingTop: 4, paddingBottom: 4, borderBottom: 'none',
    components: [{ id: 'ann-1', type: 'announcement', settings: { text: 'Free shipping on orders over $50' } }],
  },
  {
    id: 'zone2', background: '#ffffff', visibility: 'all',
    paddingTop: 12, paddingBottom: 12, borderBottom: '1px', borderColor: '#e5e7eb',
    components: [
      { id: 'logo-1',  type: 'logo',       settings: { maxWidth: 120 } },
      { id: 'nav-1',   type: 'navigation', settings: { menuHandle: 'main-menu' } },
      { id: 'spc-1',   type: 'spacer',     settings: { flexGrow: true } },
      { id: 'srch-1',  type: 'search',     settings: { style: 'icon_only' } },
      { id: 'cart-1',  type: 'cart',       settings: { openBehavior: 'sidebar' } },
      { id: 'acct-1',  type: 'account',    settings: {} },
    ],
  },
  {
    id: 'zone3', background: '#f9fafb', visibility: 'desktop_only',
    paddingTop: 8, paddingBottom: 8, borderBottom: '1px', borderColor: '#e5e7eb',
    components: [],
  },
];

const DEFAULT_BEHAVIOR: HeaderBehavior = {
  stickyMode: 'scroll_up', transparentOnHero: false,
  mobileBreakpoint: 'md', mobileDrawerStyle: 'slide_left', zIndex: 50,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

// ─── Sub-components ───────────────────────────────────────────────────────────

const SortableComponentChip: React.FC<{
  component:  HeaderComponent;
  isSelected: boolean;
  onSelect:   () => void;
  onRemove:   () => void;
}> = ({ component, isSelected, onSelect, onRemove }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: component.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const meta = COMPONENT_META[component.type] ?? { label: component.type, icon: Code, color: 'bg-slate-400' };
  const Icon = meta.icon;

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-all group ${
        isSelected
          ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
          : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-indigo-300'
      }`}
    >
      <span {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none text-slate-300 dark:text-slate-500">
        <GripVertical size={12} />
      </span>
      <div className={`w-4 h-4 rounded flex items-center justify-center ${meta.color} flex-shrink-0`}>
        <Icon size={10} className="text-white" />
      </div>
      <span className="flex-1 truncate">{meta.label}</span>
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all"
      >
        <X size={11} />
      </button>
    </div>
  );
};

const ComponentSettingsPanel: React.FC<{
  component: HeaderComponent;
  onChange:  (settings: Record<string, any>) => void;
}> = ({ component, onChange }) => {
  const update = (key: string, value: any) => onChange({ ...component.settings, [key]: value });

  const renderField = (key: string, label: string, type: string, options?: any) => (
    <div key={key} className="space-y-1">
      <label className="text-xs font-medium text-slate-600 dark:text-slate-400">{label}</label>
      {type === 'text' && (
        <input
          type="text"
          value={component.settings[key] ?? ''}
          onChange={(e) => update(key, e.target.value)}
          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
        />
      )}
      {type === 'number' && (
        <input
          type="number"
          value={component.settings[key] ?? 0}
          min={options?.min} max={options?.max}
          onChange={(e) => update(key, Number(e.target.value))}
          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
        />
      )}
      {type === 'select' && (
        <select
          value={component.settings[key] ?? options?.default ?? ''}
          onChange={(e) => update(key, e.target.value)}
          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
        >
          {options?.choices?.map((o: any) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )}
      {type === 'toggle' && (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={!!component.settings[key]}
            onChange={(e) => update(key, e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-indigo-600"
          />
          <span className="text-xs text-slate-500 dark:text-slate-400">Enabled</span>
        </label>
      )}
      {type === 'color' && (
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={component.settings[key] ?? '#000000'}
            onChange={(e) => update(key, e.target.value)}
            className="w-8 h-8 rounded cursor-pointer border border-slate-200 p-0.5"
          />
          <span className="text-xs font-mono text-slate-400">{component.settings[key] ?? '#000000'}</span>
        </div>
      )}
    </div>
  );

  // Type-specific settings panels
  const SETTINGS_BY_TYPE: Record<string, React.ReactNode> = {
    logo: (
      <div className="space-y-3">
        {renderField('maxWidth', 'Max Width (px)', 'number', { min: 60, max: 300 })}
        {renderField('altText', 'Alt Text', 'text')}
        {renderField('linkToHome', 'Link to Homepage', 'toggle')}
      </div>
    ),
    navigation: (
      <div className="space-y-3">
        {renderField('menuHandle', 'Menu Handle', 'text')}
        {renderField('submenuStyle', 'Submenu Style', 'select', {
          choices: [{ label: 'Dropdown', value: 'dropdown' }, { label: 'Mega Menu', value: 'mega' }],
        })}
      </div>
    ),
    search: (
      <div className="space-y-3">
        {renderField('style', 'Display Style', 'select', {
          choices: [
            { label: 'Icon Only',  value: 'icon_only' },
            { label: 'Expandable', value: 'expandable' },
            { label: 'Inline',     value: 'inline' },
          ],
        })}
        {renderField('placeholder', 'Placeholder Text', 'text')}
      </div>
    ),
    cart: (
      <div className="space-y-3">
        {renderField('openBehavior', 'Open Behavior', 'select', {
          choices: [
            { label: 'Sidebar', value: 'sidebar' },
            { label: 'Modal',   value: 'modal'   },
            { label: 'Page',    value: 'page'    },
          ],
        })}
        {renderField('badgeColor', 'Badge Color', 'color')}
      </div>
    ),
    account: (
      <div className="space-y-3">
        {renderField('guestLabel', 'Guest Label', 'text')}
        {renderField('showNameWhenLoggedIn', 'Show Name When Logged In', 'toggle')}
      </div>
    ),
    announcement: (
      <div className="space-y-3">
        {renderField('text', 'Announcement Text', 'text')}
        {renderField('link', 'Link URL', 'text')}
        {renderField('dismissible', 'Dismissible', 'toggle')}
      </div>
    ),
    cta_button: (
      <div className="space-y-3">
        {renderField('label', 'Button Label', 'text')}
        {renderField('link', 'URL', 'text')}
        {renderField('variant', 'Style', 'select', {
          choices: [{ label: 'Primary', value: 'primary' }, { label: 'Outline', value: 'outline' }],
        })}
        {renderField('hideOnMobile', 'Hide on Mobile', 'toggle')}
      </div>
    ),
    spacer: (
      <div className="space-y-3">
        {renderField('flexGrow', 'Fill Available Space', 'toggle')}
        {renderField('width', 'Fixed Width (px)', 'number', { min: 0, max: 200 })}
      </div>
    ),
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <div className={`w-6 h-6 rounded flex items-center justify-center ${COMPONENT_META[component.type]?.color ?? 'bg-slate-400'}`}>
          {React.createElement(COMPONENT_META[component.type]?.icon ?? Code, { size: 12, className: 'text-white' })}
        </div>
        <span className="text-sm font-semibold text-slate-900 dark:text-white">
          {COMPONENT_META[component.type]?.label ?? component.type}
        </span>
      </div>
      {SETTINGS_BY_TYPE[component.type] ?? (
        <p className="text-xs text-slate-400 italic">No settings available for this component.</p>
      )}
    </div>
  );
};

const ZoneSettingsPanel: React.FC<{
  zone:     HeaderZone;
  onChange: (zone: HeaderZone) => void;
}> = ({ zone, onChange }) => {
  const set = (key: keyof HeaderZone, val: any) => onChange({ ...zone, [key]: val });

  return (
    <div className="px-4 pb-4 space-y-3 border-t border-slate-100 dark:border-slate-700 mt-3 pt-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Zone Settings</p>
      <div>
        <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">Background</label>
        <div className="flex items-center gap-2">
          <input type="color" value={zone.background === 'transparent' ? '#ffffff' : (zone.background ?? '#ffffff')}
            onChange={(e) => set('background', e.target.value)}
            className="w-8 h-8 rounded cursor-pointer border border-slate-200 p-0.5" />
          <button onClick={() => set('background', 'transparent')}
            className={`text-xs px-2 py-1 rounded border ${zone.background === 'transparent' ? 'border-indigo-400 text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20' : 'border-slate-200 dark:border-slate-600 text-slate-500'}`}>
            Transparent
          </button>
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">Visibility</label>
        <select value={zone.visibility ?? 'all'} onChange={(e) => set('visibility', e.target.value)}
          className="w-full px-2 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white">
          <option value="all">All devices</option>
          <option value="desktop_only">Desktop only</option>
          <option value="mobile_only">Mobile only</option>
          <option value="hidden">Hidden</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">Padding Top (px)</label>
          <input type="number" min={0} max={80} value={zone.paddingTop ?? 0}
            onChange={(e) => set('paddingTop', Number(e.target.value))}
            className="w-full px-2 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">Padding Bottom</label>
          <input type="number" min={0} max={80} value={zone.paddingBottom ?? 0}
            onChange={(e) => set('paddingBottom', Number(e.target.value))}
            className="w-full px-2 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white" />
        </div>
      </div>
    </div>
  );
};

const BehaviorPanel: React.FC<{
  behavior: HeaderBehavior;
  onChange: (b: HeaderBehavior) => void;
}> = ({ behavior, onChange }) => {
  const set = (key: keyof HeaderBehavior, val: any) => onChange({ ...behavior, [key]: val });

  return (
    <div className="p-4 space-y-4">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Global Behaviour</p>
      <div>
        <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">Sticky Mode</label>
        <select value={behavior.stickyMode} onChange={(e) => set('stickyMode', e.target.value)}
          className="w-full px-2 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white">
          <option value="off">Not sticky</option>
          <option value="always">Always sticky</option>
          <option value="scroll_up">Sticky on scroll-up</option>
          <option value="scroll_after">Sticky after scroll</option>
        </select>
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={behavior.transparentOnHero}
          onChange={(e) => set('transparentOnHero', e.target.checked)}
          className="w-4 h-4 rounded border-slate-300 text-indigo-600" />
        <span className="text-xs text-slate-600 dark:text-slate-300">Transparent on hero sections</span>
      </label>
      <div>
        <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">Mobile Breakpoint</label>
        <select value={behavior.mobileBreakpoint} onChange={(e) => set('mobileBreakpoint', e.target.value)}
          className="w-full px-2 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white">
          <option value="sm">sm (640px)</option>
          <option value="md">md (768px)</option>
          <option value="lg">lg (1024px)</option>
        </select>
      </div>
      <div>
        <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">Mobile Drawer Style</label>
        <select value={behavior.mobileDrawerStyle} onChange={(e) => set('mobileDrawerStyle', e.target.value)}
          className="w-full px-2 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white">
          <option value="slide_left">Slide from left</option>
          <option value="slide_right">Slide from right</option>
          <option value="overlay">Full overlay</option>
        </select>
      </div>
    </div>
  );
};

// ─── Header Canvas Preview ─────────────────────────────────────────────────────

const HeaderCanvas: React.FC<{
  zones:       HeaderZone[];
  previewMode: PreviewMode;
  themeColors: Record<string, string>;
}> = ({ zones, previewMode, themeColors }) => {
  const containerClass =
    previewMode === 'desktop' ? 'w-full' :
    previewMode === 'tablet'  ? 'max-w-[768px] mx-auto' :
                                 'max-w-[390px] mx-auto';

  const renderComponent = (c: HeaderComponent) => {
    const meta = COMPONENT_META[c.type];
    if (!meta) return null;
    const Icon = meta.icon;

    switch (c.type) {
      case 'logo':
        return (
          <div key={c.id} className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded flex items-center justify-center"
              style={{ background: themeColors.primary }}>
              <ShoppingBag size={12} className="text-white" />
            </div>
            <span className="font-bold text-xs" style={{ color: themeColors.text }}>Store</span>
          </div>
        );
      case 'navigation':
        return previewMode === 'mobile' ? (
          <button key={c.id} className="p-1">
            <svg viewBox="0 0 24 24" className="w-5 h-5" style={{ stroke: themeColors.text }} fill="none" strokeWidth={2}>
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
        ) : (
          <nav key={c.id} className="flex items-center gap-3 text-[11px]" style={{ color: themeColors.text }}>
            {['Home', 'Shop', 'About'].map((label) => (
              <span key={label} className="hover:opacity-70 cursor-pointer">{label}</span>
            ))}
          </nav>
        );
      case 'spacer':
        return <div key={c.id} className={c.settings.flexGrow ? 'flex-1' : ''} style={{ width: c.settings.width ? `${c.settings.width}px` : undefined }} />;
      case 'search':
        return (
          <button key={c.id} className="p-1.5 rounded hover:bg-slate-100">
            <Search size={14} style={{ color: themeColors.text }} />
          </button>
        );
      case 'cart':
        return (
          <div key={c.id} className="relative p-1.5">
            <ShoppingCart size={14} style={{ color: themeColors.text }} />
            <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full text-[8px] font-bold flex items-center justify-center text-white"
              style={{ background: themeColors.accent }}>2</span>
          </div>
        );
      case 'account':
        return <User key={c.id} size={14} style={{ color: themeColors.text }} className="cursor-pointer" />;
      case 'announcement':
        return (
          <span key={c.id} className="text-[10px] font-medium" style={{ color: themeColors.text }}>
            {c.settings.text || 'Announcement'}
          </span>
        );
      case 'cta_button':
        return (
          <button key={c.id} className="px-2.5 py-1 rounded text-[10px] font-bold text-white"
            style={{ background: themeColors.primary }}>
            {c.settings.label || 'Shop Now'}
          </button>
        );
      default:
        return (
          <div key={c.id} className="w-6 h-6 rounded flex items-center justify-center bg-slate-100">
            <Icon size={10} className="text-slate-400" />
          </div>
        );
    }
  };

  return (
    <div className={`${containerClass} transition-all duration-300`}>
      <div className="rounded-xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700"
        style={{ background: themeColors.background }}>
        {zones.map((zone) => {
          if (zone.visibility === 'hidden') return null;
          if (zone.visibility === 'desktop_only' && previewMode === 'mobile') return null;
          if (zone.visibility === 'mobile_only'  && previewMode === 'desktop') return null;

          const bg = zone.background === 'transparent' ? 'transparent' : (zone.background ?? '#ffffff');
          return (
            <div key={zone.id}
              style={{
                background:    bg,
                paddingTop:    zone.paddingTop    ? `${zone.paddingTop}px`    : '8px',
                paddingBottom: zone.paddingBottom ? `${zone.paddingBottom}px` : '8px',
                borderBottom:  zone.borderBottom !== 'none' ? `${zone.borderBottom} solid ${zone.borderColor ?? '#e5e7eb'}` : 'none',
              }}
              className="px-4 flex items-center gap-2"
            >
              {zone.components.length === 0 ? (
                <span className="text-[10px] text-slate-300 dark:text-slate-600 italic">Empty zone</span>
              ) : (
                zone.components.map((c) => renderComponent(c))
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────

interface HeaderBuilderProps {
  themeColors: Record<string, string>;
  onDraftChange?: () => void;
}

const HeaderBuilder: React.FC<HeaderBuilderProps> = ({ themeColors, onDraftChange }) => {
  const [zones, setZones]         = useState<HeaderZone[]>(DEFAULT_ZONES);
  const [behavior, setBehavior]   = useState<HeaderBehavior>(DEFAULT_BEHAVIOR);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [dirty, setDirty]         = useState(false);
  const [previewMode, setPreviewMode] = useState<PreviewMode>('desktop');

  // Left panel state
  const [expandedZone,   setExpandedZone]   = useState<string | null>('zone2');
  const [expandedSettings, setExpandedSettings] = useState<string | null>(null);  // 'zone' | 'behavior'
  const [selectedComp,  setSelectedComp]   = useState<{ zoneId: string; compId: string } | null>(null);
  const [pickerZone,    setPickerZone]     = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Load from backend
  useEffect(() => {
    themeEngineService.getHeader()
      .then((res) => {
        const draft = res?.draft ?? res?.data?.draft;
        if (draft?.zones?.length) {
          setZones(draft.zones);
          if (draft.behavior) setBehavior(draft.behavior);
        }
      })
      .catch(() => { /* use defaults */ })
      .finally(() => setLoading(false));
  }, []);

  const markDirty = useCallback(() => {
    setDirty(true);
    onDraftChange?.();
  }, [onDraftChange]);

  const updateZone = useCallback((zoneId: string, updatedZone: HeaderZone) => {
    setZones((prev) => prev.map((z) => z.id === zoneId ? updatedZone : z));
    markDirty();
  }, [markDirty]);

  const addComponent = useCallback((zoneId: string, type: string) => {
    const newComp: HeaderComponent = { id: uid(), type, settings: {} };
    setZones((prev) => prev.map((z) =>
      z.id === zoneId ? { ...z, components: [...z.components, newComp] } : z,
    ));
    setPickerZone(null);
    setSelectedComp({ zoneId, compId: newComp.id });
    markDirty();
  }, [markDirty]);

  const removeComponent = useCallback((zoneId: string, compId: string) => {
    setZones((prev) => prev.map((z) =>
      z.id === zoneId ? { ...z, components: z.components.filter((c) => c.id !== compId) } : z,
    ));
    if (selectedComp?.compId === compId) setSelectedComp(null);
    markDirty();
  }, [selectedComp, markDirty]);

  const updateComponentSettings = useCallback((zoneId: string, compId: string, settings: Record<string, any>) => {
    setZones((prev) => prev.map((z) =>
      z.id === zoneId
        ? { ...z, components: z.components.map((c) => c.id === compId ? { ...c, settings } : c) }
        : z,
    ));
    markDirty();
  }, [markDirty]);

  const handleDragEnd = useCallback((event: DragEndEvent, zoneId: string) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setZones((prev) => prev.map((z) => {
      if (z.id !== zoneId) return z;
      const oldIdx = z.components.findIndex((c) => c.id === active.id);
      const newIdx = z.components.findIndex((c) => c.id === over.id);
      return { ...z, components: arrayMove(z.components, oldIdx, newIdx) };
    }));
    markDirty();
  }, [markDirty]);

  const save = async () => {
    // Validate Zone 2 has at least one component
    const zone2 = zones.find((z) => z.id === 'zone2');
    if (!zone2?.components.length) {
      toast.error('Header Zone 2 must have at least one component.');
      return;
    }
    setSaving(true);
    try {
      await themeEngineService.updateHeaderDraft({ zones, behavior });
      setDirty(false);
      toast.success('Header saved to draft.');
    } catch {
      toast.error('Failed to save header. Changes are preserved locally.');
    } finally {
      setSaving(false);
    }
  };

  // Find selected component object
  const selectedZone = selectedComp ? zones.find((z) => z.id === selectedComp.zoneId) : null;
  const selectedCompObj = selectedZone?.components.find((c) => c.id === selectedComp?.compId) ?? null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <Loader2 size={24} className="animate-spin mr-2" />
        <span className="text-sm">Loading header config…</span>
      </div>
    );
  }

  return (
    <div className="flex gap-4 min-h-[600px]">
      {/* ── LEFT PANEL ─────────────────────────────────────────────────────── */}
      <div className="w-72 flex-shrink-0 space-y-3 overflow-y-auto max-h-[700px] pr-1">

        {/* Zone accordions */}
        {zones.map((zone) => {
          const meta = ZONE_META[zone.id];
          const isExpanded = expandedZone === zone.id;
          const isZoneSettingsOpen = expandedSettings === zone.id;

          return (
            <Card key={zone.id} className="overflow-hidden">
              {/* Zone header */}
              <button
                onClick={() => setExpandedZone(isExpanded ? null : zone.id)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50"
              >
                <div>
                  <p className="text-xs font-bold text-slate-800 dark:text-white">{meta.label}</p>
                  <p className="text-[10px] text-slate-400">{zone.components.length} component{zone.components.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="flex items-center gap-2">
                  {zone.visibility === 'hidden' && <EyeOff size={12} className="text-slate-400" />}
                  {zone.id === 'zone2' && !zone.components.length && (
                    <AlertCircle size={12} className="text-amber-500" title="Zone 2 must have at least one component" />
                  )}
                  {isExpanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-slate-100 dark:border-slate-700">
                  {/* Component list */}
                  <div className="p-2 space-y-1.5">
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={(e) => handleDragEnd(e, zone.id)}
                    >
                      <SortableContext
                        items={zone.components.map((c) => c.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {zone.components.map((comp) => (
                          <SortableComponentChip
                            key={comp.id}
                            component={comp}
                            isSelected={selectedComp?.compId === comp.id}
                            onSelect={() => setSelectedComp(
                              selectedComp?.compId === comp.id ? null : { zoneId: zone.id, compId: comp.id }
                            )}
                            onRemove={() => removeComponent(zone.id, comp.id)}
                          />
                        ))}
                      </SortableContext>
                    </DndContext>

                    {zone.components.length === 0 && (
                      <p className="text-[10px] text-slate-400 italic text-center py-1">
                        {zone.id === 'zone2' ? '⚠ Zone 2 requires at least one component' : 'Empty — add a component below'}
                      </p>
                    )}

                    {/* Component picker trigger */}
                    {pickerZone === zone.id ? (
                      <div className="rounded-lg border border-indigo-200 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 p-2">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wide">Add Component</p>
                          <button onClick={() => setPickerZone(null)} className="text-slate-400 hover:text-slate-600">
                            <X size={12} />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-1">
                          {COMPONENT_TYPES.map((type) => {
                            const m = COMPONENT_META[type];
                            const Icon = m.icon;
                            return (
                              <button key={type} onClick={() => addComponent(zone.id, type)}
                                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-700 text-left transition-colors">
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
                      <button
                        onClick={() => { setPickerZone(zone.id); setExpandedZone(zone.id); }}
                        className="w-full flex items-center justify-center gap-1 py-1.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 text-xs text-slate-400 hover:text-indigo-500 hover:border-indigo-300 transition-colors"
                      >
                        <Plus size={12} /> Add Component
                      </button>
                    )}
                  </div>

                  {/* Inline component settings (when selected AND belongs to this zone) */}
                  {selectedCompObj && selectedComp?.zoneId === zone.id && (
                    <div className="border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                      <ComponentSettingsPanel
                        component={selectedCompObj}
                        onChange={(settings) => updateComponentSettings(zone.id, selectedComp.compId, settings)}
                      />
                    </div>
                  )}

                  {/* Zone settings toggle */}
                  <button
                    onClick={() => setExpandedSettings(isZoneSettingsOpen ? null : zone.id)}
                    className="w-full flex items-center gap-1.5 px-3 py-2 text-[10px] font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 border-t border-slate-100 dark:border-slate-700"
                  >
                    <Settings2 size={11} />
                    Zone Settings
                    {isZoneSettingsOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                  </button>
                  {isZoneSettingsOpen && (
                    <ZoneSettingsPanel zone={zone} onChange={(z) => updateZone(zone.id, z)} />
                  )}
                </div>
              )}
            </Card>
          );
        })}

        {/* Behavior settings */}
        <Card className="overflow-hidden">
          <button
            onClick={() => setExpandedSettings(expandedSettings === 'behavior' ? null : 'behavior')}
            className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50"
          >
            <p className="text-xs font-bold text-slate-800 dark:text-white">Global Behaviour</p>
            {expandedSettings === 'behavior' ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
          </button>
          {expandedSettings === 'behavior' && (
            <div className="border-t border-slate-100 dark:border-slate-700">
              <BehaviorPanel behavior={behavior} onChange={(b) => { setBehavior(b); markDirty(); }} />
            </div>
          )}
        </Card>

        {/* Save / Discard */}
        <div className="flex gap-2 pt-1 pb-4">
          <button
            onClick={save}
            disabled={saving || !dirty}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
              dirty
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
            }`}
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {saving ? 'Saving…' : dirty ? 'Save Header' : 'Saved'}
          </button>
        </div>
      </div>

      {/* ── RIGHT PANEL — Canvas ──────────────────────────────────────────── */}
      <div className="flex-1 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
            Header Preview
            {dirty && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                Unsaved changes
              </span>
            )}
          </h3>
          <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
            {([['desktop', Monitor], ['tablet', Tablet], ['mobile', Smartphone]] as const).map(([mode, Icon]) => (
              <button key={mode} onClick={() => setPreviewMode(mode)}
                className={`p-1.5 rounded transition-colors ${previewMode === mode ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                <Icon size={14} />
              </button>
            ))}
          </div>
        </div>

        <div className="bg-slate-100 dark:bg-slate-900 rounded-2xl p-4 min-h-[300px]">
          <HeaderCanvas zones={zones} previewMode={previewMode} themeColors={themeColors} />
        </div>

        {/* Quick tips */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3">
          <p className="text-[11px] text-blue-700 dark:text-blue-300 font-medium mb-1">Tips</p>
          <ul className="text-[10px] text-blue-600 dark:text-blue-400 space-y-0.5 list-disc list-inside">
            <li>Zone 2 is the main header row — must have at least one component</li>
            <li>Use the Spacer component to push items to the right edge</li>
            <li>Changes are saved as draft — publish from the Theme Engine header</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default HeaderBuilder;
