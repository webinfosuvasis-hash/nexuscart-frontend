import React, { useState, useEffect, useCallback } from 'react';
import {
  Palette, Star, Download, Eye, Check, Settings2, ChevronRight,
  Search, ShoppingBag, Zap, Globe, X,
  Monitor, Smartphone, Tablet, Upload, Plus, Save,
  Loader2, AlertCircle, LayoutPanelLeft, Rows3,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, PageHeader, Btn, Badge } from './ui';
import HeaderBuilder from './HeaderBuilder';
import FooterBuilder from './FooterBuilder';
import type { Theme, ThemeCategory } from '@/types';
import {
  themeEngineService,
  type ThemeColors,
  type ThemeTypography,
  type ThemeLayout,
} from '@/services/themeEngineService';

// ─── Mock Themes Data ─────────────────────────────────────────────────────────

const THEMES: Theme[] = [
  {
    id: 'dawn', name: 'Dawn', description: 'Clean and elegant theme perfect for fashion stores.',
    preview: 'https://picsum.photos/seed/dawn/600/400', thumbnail: 'https://picsum.photos/seed/dawn/600/400',
    category: 'minimal', price: 0, rating: 4.8, ratingCount: 2140, downloads: 18400, author: 'Shopify',
    tags: ['fashion', 'minimal', 'clean'], isInstalled: true, isActive: true, version: '14.1.0',
    compatibleWith: ['Fashion', 'Lifestyle'], features: ['Mobile First', 'Mega Menu', 'Product Zoom'],
    colors: { primary: '#1a1a1a', secondary: '#f5f5f5', accent: '#d4a574', background: '#ffffff', text: '#1a1a1a', surface: '#f9f9f9' },
    fonts: { heading: 'Playfair Display', body: 'Inter' },
  },
  {
    id: 'impulse', name: 'Impulse', description: 'Bold, high-energy theme for electronics and lifestyle brands.',
    preview: 'https://picsum.photos/seed/impulse/600/400', thumbnail: 'https://picsum.photos/seed/impulse/600/400',
    category: 'bold', price: 350, rating: 4.7, ratingCount: 890, downloads: 7200, author: 'Eight Themes',
    tags: ['electronics', 'bold', 'dark'], isInstalled: false, isActive: false, version: '3.2.1',
    compatibleWith: ['Electronics', 'Gifts'], features: ['Video Hero', 'Quick Buy', 'Countdown Timer'],
    colors: { primary: '#6366f1', secondary: '#0f172a', accent: '#f59e0b', background: '#0f172a', text: '#f8fafc', surface: '#1e293b' },
    fonts: { heading: 'Space Grotesk', body: 'DM Sans' },
  },
  {
    id: 'prestige', name: 'Prestige', description: 'Luxury and elegance for high-end fashion and cosmetics brands.',
    preview: 'https://picsum.photos/seed/prestige/600/400', thumbnail: 'https://picsum.photos/seed/prestige/600/400',
    category: 'elegant', price: 380, rating: 4.9, ratingCount: 612, downloads: 5100, author: 'Fluorescent',
    tags: ['luxury', 'fashion', 'cosmetics'], isInstalled: false, isActive: false, version: '2.0.4',
    compatibleWith: ['Fashion', 'Cosmetics'], features: ['Full-Screen Video', 'Story Mode', 'AR Try-On'],
    colors: { primary: '#1c1c1e', secondary: '#f5f5f7', accent: '#c9a96e', background: '#ffffff', text: '#1c1c1e', surface: '#fafafa' },
    fonts: { heading: 'Cormorant Garamond', body: 'Lato' },
  },
  {
    id: 'fresh', name: 'Fresh', description: 'Vibrant and modern design perfect for grocery and food stores.',
    preview: 'https://picsum.photos/seed/fresh/600/400', thumbnail: 'https://picsum.photos/seed/fresh/600/400',
    category: 'modern', price: 240, rating: 4.6, ratingCount: 340, downloads: 2900, author: 'Clean Canvas',
    tags: ['grocery', 'food', 'fresh'], isInstalled: true, isActive: false, version: '1.8.0',
    compatibleWith: ['Grocery', 'Gifts'], features: ['Category Mega Grid', 'Quick Filter', 'Wishlist'],
    colors: { primary: '#16a34a', secondary: '#f0fdf4', accent: '#fb923c', background: '#ffffff', text: '#111827', surface: '#f9fafb' },
    fonts: { heading: 'Nunito', body: 'Nunito' },
  },
  {
    id: 'woodcraft', name: 'Woodcraft', description: 'Warm, artisanal feel for furniture and home décor brands.',
    preview: 'https://picsum.photos/seed/woodcraft/600/400', thumbnail: 'https://picsum.photos/seed/woodcraft/600/400',
    category: 'vintage', price: 290, rating: 4.5, ratingCount: 218, downloads: 1800, author: 'Archetype',
    tags: ['furniture', 'home', 'vintage'], isInstalled: false, isActive: false, version: '1.3.2',
    compatibleWith: ['Furniture', 'Lifestyle'], features: ['360° View', 'Room Planner', 'Material Swatches'],
    colors: { primary: '#92400e', secondary: '#fef3c7', accent: '#065f46', background: '#fafaf9', text: '#1c1917', surface: '#f5f5f4' },
    fonts: { heading: 'Merriweather', body: 'Source Sans Pro' },
  },
  {
    id: 'glow', name: 'Glow', description: 'Beauty-forward theme for cosmetics and skincare brands.',
    preview: 'https://picsum.photos/seed/glow/600/400', thumbnail: 'https://picsum.photos/seed/glow/600/400',
    category: 'modern', price: 0, rating: 4.7, ratingCount: 1240, downloads: 9800, author: 'NexusCart',
    tags: ['cosmetics', 'beauty', 'skincare'], isInstalled: true, isActive: false, version: '4.2.1',
    compatibleWith: ['Cosmetics', 'Lifestyle'], features: ['Shade Selector', 'Before/After', 'Ingredients Popup'],
    colors: { primary: '#db2777', secondary: '#fdf2f8', accent: '#7c3aed', background: '#ffffff', text: '#1f2937', surface: '#fdf2f8' },
    fonts: { heading: 'Josefin Sans', body: 'Open Sans' },
  },
];

const CATEGORIES: Array<{ id: ThemeCategory | 'all'; label: string }> = [
  { id: 'all', label: 'All Themes' }, { id: 'minimal', label: 'Minimal' },
  { id: 'bold', label: 'Bold' }, { id: 'elegant', label: 'Elegant' },
  { id: 'modern', label: 'Modern' }, { id: 'vintage', label: 'Vintage' },
];

const PREVIEW_MODES = [
  { id: 'desktop', icon: Monitor },
  { id: 'tablet',  icon: Tablet  },
  { id: 'mobile',  icon: Smartphone },
];

// Default config used before backend responds
const DEFAULT_COLORS: ThemeColors = {
  primary: '#16a34a', secondary: '#f0fdf4', accent: '#fb923c',
  background: '#ffffff', text: '#111827', surface: '#f9fafb',
};
const DEFAULT_TYPOGRAPHY: ThemeTypography = { headingFont: 'Nunito', bodyFont: 'Nunito', baseSizeRem: 1.0, lineHeight: 1.6 };
const DEFAULT_LAYOUT: ThemeLayout = { stickyHeader: true, sidebarCart: false, megaMenu: true, backToTop: true, cookieConsent: false };

const FONT_OPTIONS = ['Inter', 'Playfair Display', 'Space Grotesk', 'Merriweather', 'Nunito', 'Cormorant Garamond', 'DM Sans', 'Josefin Sans'];

// Customize sub-tabs
type CustomizeTab = 'colors' | 'typography' | 'layout' | 'header' | 'footer';

const CUSTOMIZE_TABS: { id: CustomizeTab; label: string; icon: typeof Palette }[] = [
  { id: 'colors',     label: 'Colors',     icon: Palette      },
  { id: 'typography', label: 'Typography', icon: Settings2    },
  { id: 'layout',     label: 'Layout',     icon: Rows3        },
  { id: 'header',     label: 'Header',     icon: LayoutPanelLeft },
  { id: 'footer',     label: 'Footer',     icon: LayoutPanelLeft },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface ThemeEngineProps {
  onOpenEditor?: () => void;
}

const ThemeEngine: React.FC<ThemeEngineProps> = ({ onOpenEditor }) => {
  const [themes, setThemes]   = useState(THEMES);
  const [category, setCategory] = useState<ThemeCategory | 'all'>('all');
  const [query, setQuery]     = useState('');
  const [activeTab, setActiveTab] = useState<'marketplace' | 'installed' | 'customize'>('marketplace');
  const [customizeTab, setCustomizeTab] = useState<CustomizeTab>('colors');
  const [previewTheme, setPreviewTheme] = useState<Theme | null>(null);
  const [previewMode, setPreviewMode]   = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [customizing, setCustomizing]   = useState<Theme | null>(null);

  // Theme config state (wired to backend)
  const [colors, setColors]         = useState<ThemeColors>(DEFAULT_COLORS);
  const [typography, setTypography] = useState<ThemeTypography>(DEFAULT_TYPOGRAPHY);
  const [layout, setLayout]         = useState<ThemeLayout>(DEFAULT_LAYOUT);
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving, setConfigSaving]   = useState(false);
  const [hasDraft, setHasDraft]     = useState(false);   // unsaved draft badge
  const [publishing, setPublishing] = useState(false);

  const activeTheme = themes.find((t) => t.isActive);

  // Load draft config when Customize tab opens
  useEffect(() => {
    if (activeTab !== 'customize' || !customizing) return;
    setConfigLoading(true);
    themeEngineService.getConfig()
      .then((res) => {
        const draft = res?.draft ?? (res as any)?.data?.draft;
        if (draft?.config) {
          setColors(draft.config.colors ?? DEFAULT_COLORS);
          setTypography(draft.config.typography ?? DEFAULT_TYPOGRAPHY);
          setLayout(draft.config.layout ?? DEFAULT_LAYOUT);
        }
      })
      .catch(() => { /* use defaults */ })
      .finally(() => setConfigLoading(false));
  }, [activeTab, customizing]);

  const installTheme = (id: string) => {
    setThemes((ts) => ts.map((t) => t.id === id ? { ...t, isInstalled: true } : t));
    toast.success('Theme installed successfully!');
  };

  const activateTheme = (id: string) => {
    setThemes((ts) => ts.map((t) => ({ ...t, isActive: t.id === id })));
    toast.success('Theme activated! Your store design has been updated.');
  };

  const openCustomize = (t: Theme) => {
    // Open the full-screen Theme Editor if available; fall back to inline customizer
    if (onOpenEditor) {
      onOpenEditor();
      return;
    }
    setCustomizing(t);
    setColors(t.colors ?? DEFAULT_COLORS);
    setTypography({ headingFont: t.fonts?.heading ?? 'Inter', bodyFont: t.fonts?.body ?? 'Inter', baseSizeRem: 1.0, lineHeight: 1.6 });
    setLayout(DEFAULT_LAYOUT);
    setActiveTab('customize');
    setCustomizeTab('colors');
    setHasDraft(false);
  };

  // Save colors/typography/layout draft
  const saveStyleDraft = useCallback(async () => {
    setConfigSaving(true);
    try {
      await themeEngineService.updateDraft({ colors, typography, layout });
      setHasDraft(true);
      toast.success('Styles saved to draft.');
    } catch {
      toast.error('Failed to save styles. Changes preserved locally.');
    } finally {
      setConfigSaving(false);
    }
  }, [colors, typography, layout]);

  // Publish all drafts
  const publishDraft = async () => {
    setPublishing(true);
    try {
      const result = await themeEngineService.publish(customizing?.id);
      setHasDraft(false);
      toast.success(`Published! Version ${result.version}${result.snapshotId ? ' (snapshot saved)' : ''}`);
    } catch (err: any) {
      toast.error(err?.message ?? 'Publish failed. Check that all required config is set.');
    } finally {
      setPublishing(false);
    }
  };

  const discardDraft = async () => {
    try {
      await themeEngineService.discardDraft(customizing?.id);
      setHasDraft(false);
      toast.info('Draft discarded. Reset to last published state.');
      // Reload config
      const res = await themeEngineService.getConfig();
      const pub = res?.published ?? (res as any)?.data?.published;
      if (pub?.config) {
        setColors(pub.config.colors ?? DEFAULT_COLORS);
        setTypography(pub.config.typography ?? DEFAULT_TYPOGRAPHY);
        setLayout(pub.config.layout ?? DEFAULT_LAYOUT);
      }
    } catch {
      toast.error('Failed to discard draft.');
    }
  };

  const previewWidth = previewMode === 'desktop' ? 'w-full' : previewMode === 'tablet' ? 'max-w-[768px]' : 'max-w-[390px]';

  const filtered = themes.filter((t) => {
    const matchCat = category === 'all' || t.category === category;
    const matchQ   = !query || t.name.toLowerCase().includes(query.toLowerCase()) || t.tags?.some((tag) => tag.includes(query.toLowerCase()));
    if (activeTab === 'installed') return matchCat && matchQ && t.isInstalled;
    return matchCat && matchQ;
  });

  // ── Customize sub-panels ─────────────────────────────────────────────────────

  const ColorsPanel = () => (
    <Card className="p-4 space-y-3">
      <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
        <Palette size={16} className="text-indigo-600" /> Colors
      </h3>
      {(Object.entries(colors) as [keyof ThemeColors, string][]).map(([key, val]) => (
        <div key={key} className="flex items-center justify-between">
          <label className="text-sm capitalize text-slate-600 dark:text-slate-300">{key}</label>
          <div className="flex items-center gap-2">
            <input type="color" value={val}
              onChange={(e) => setColors((c) => ({ ...c, [key]: e.target.value }))}
              className="w-8 h-8 rounded-lg cursor-pointer border border-slate-300 p-0.5" />
            <span className="text-xs font-mono text-slate-400">{val}</span>
          </div>
        </div>
      ))}
    </Card>
  );

  const TypographyPanel = () => (
    <Card className="p-4 space-y-3">
      <h3 className="font-bold text-slate-900 dark:text-white">Typography</h3>
      {(['headingFont', 'bodyFont'] as const).map((key) => (
        <div key={key}>
          <label className="text-xs text-slate-500 capitalize block mb-1">
            {key === 'headingFont' ? 'Heading Font' : 'Body Font'}
          </label>
          <select value={typography[key]}
            onChange={(e) => setTypography((t) => ({ ...t, [key]: e.target.value }))}
            className="w-full px-2 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white">
            {FONT_OPTIONS.map((f) => <option key={f}>{f}</option>)}
          </select>
        </div>
      ))}
      <div>
        <label className="text-xs text-slate-500 block mb-1">Base Size ({typography.baseSizeRem}rem)</label>
        <input type="range" min={0.75} max={1.5} step={0.05} value={typography.baseSizeRem}
          onChange={(e) => setTypography((t) => ({ ...t, baseSizeRem: parseFloat(e.target.value) }))}
          className="w-full accent-indigo-600" />
      </div>
    </Card>
  );

  const LayoutPanel = () => (
    <Card className="p-4 space-y-2">
      <h3 className="font-bold text-slate-900 dark:text-white">Layout</h3>
      {(Object.entries(layout) as [keyof ThemeLayout, boolean][]).map(([key, val]) => (
        <label key={key} className="flex items-center justify-between cursor-pointer py-1">
          <span className="text-sm text-slate-600 dark:text-slate-300 capitalize">
            {key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}
          </span>
          <input type="checkbox" checked={val}
            onChange={(e) => setLayout((l) => ({ ...l, [key]: e.target.checked }))}
            className="w-4 h-4 rounded border-slate-300 text-indigo-600" />
        </label>
      ))}
    </Card>
  );

  // The Canvas (used only for Colors/Typography/Layout sub-tabs)
  const StyleCanvas = () => (
    <div className="lg:col-span-3">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-slate-900 dark:text-white">
          Live Preview: {customizing?.name}
        </h3>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
            {PREVIEW_MODES.map(({ id, icon: Icon }) => (
              <button key={id} onClick={() => setPreviewMode(id as any)}
                className={`p-1.5 rounded ${previewMode === id ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-400'}`}>
                <Icon size={15} />
              </button>
            ))}
          </div>
          <Btn variant="outline" onClick={async () => {
            try {
              const result = await themeEngineService.generatePreviewLink('home', customizing?.id);
              window.open(result.url, '_blank', 'noopener,noreferrer');
            } catch {
              toast.error('Failed to generate preview link.');
            }
          }}>
            <Globe size={14} /> Live Preview
          </Btn>
        </div>
      </div>
      <div className="bg-slate-200 dark:bg-slate-900 rounded-2xl p-4 flex justify-center min-h-[500px]">
        <div className={`${previewWidth} transition-all duration-300 bg-white rounded-xl shadow-2xl overflow-hidden`}
          style={{ background: colors.background, fontFamily: typography.bodyFont }}>
          {/* Simulated store header */}
          <div className="px-6 py-4 flex items-center justify-between border-b" style={{ borderColor: '#e5e7eb' }}>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: colors.primary }}>
                <ShoppingBag size={14} className="text-white" />
              </div>
              <span className="font-bold text-sm" style={{ color: colors.text, fontFamily: typography.headingFont }}>
                NexusCart Store
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs" style={{ color: colors.text }}>
              <span>Home</span><span>Shop</span><span>About</span>
            </div>
          </div>
          {/* Hero */}
          <div className="px-6 py-12 text-center" style={{ background: colors.secondary }}>
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: colors.accent }}>New Collection</p>
            <h1 className="text-2xl font-bold mb-3" style={{ color: colors.text, fontFamily: typography.headingFont, fontSize: `${typography.baseSizeRem * 1.5}rem` }}>
              Discover Your Style
            </h1>
            <p className="text-xs mb-4" style={{ color: colors.text, opacity: 0.7 }}>Premium quality products curated for you</p>
            <button className="px-4 py-2 rounded-lg text-xs font-bold text-white" style={{ background: colors.primary }}>
              Shop Now
            </button>
          </div>
          {/* Product grid */}
          <div className="p-6">
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-lg overflow-hidden" style={{ background: colors.surface }}>
                  <div className="h-16 bg-slate-200" />
                  <div className="p-2">
                    <div className="h-2 w-16 rounded mb-1" style={{ background: colors.text, opacity: 0.15 }} />
                    <div className="h-2 w-10 rounded" style={{ background: colors.accent, opacity: 0.7 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <PageHeader title="Theme Engine" subtitle="Choose, customize, and manage your store themes"
        action={
          <div className="flex gap-2">
            <Btn variant="outline" onClick={() => toast.info('Upload custom theme (ZIP)')}><Upload size={16} /> Upload Theme</Btn>
            <Btn onClick={() => setActiveTab('marketplace')}><ShoppingBag size={16} /> Theme Marketplace</Btn>
          </div>
        }
      />

      {/* Active Theme Banner */}
      {activeTheme && (
        <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Palette size={20} />
            </div>
            <div>
              <p className="text-xs text-indigo-200 font-medium">Currently Active</p>
              <p className="font-bold text-lg">
                {activeTheme.name}{' '}
                <span className="text-indigo-200 text-sm font-normal">v{activeTheme.version}</span>
              </p>
            </div>
            {hasDraft && (
              <span className="flex items-center gap-1 text-xs bg-amber-400/30 text-amber-200 font-semibold px-2 py-1 rounded-full">
                <AlertCircle size={11} /> Unpublished changes
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Btn onClick={() => openCustomize(activeTheme)} className="bg-white/20 hover:bg-white/30 border-0 text-white">
              <Settings2 size={15} /> Customize
            </Btn>
            {hasDraft && (
              <>
                <Btn onClick={publishDraft} disabled={publishing} className="bg-emerald-500/80 hover:bg-emerald-500 border-0 text-white">
                  {publishing ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  {publishing ? 'Publishing…' : 'Publish'}
                </Btn>
                <Btn onClick={discardDraft} className="bg-white/10 hover:bg-white/20 border-0 text-white/70 text-xs">
                  Discard
                </Btn>
              </>
            )}
            <Btn onClick={async () => {
              try {
                const result = await themeEngineService.generatePreviewLink('home', activeTheme?.id);
                window.open(result.url, '_blank', 'noopener,noreferrer');
              } catch {
                toast.error('Failed to generate preview link.');
              }
            }} className="bg-white/20 hover:bg-white/30 border-0 text-white">
              <Eye size={15} /> Preview
            </Btn>
          </div>
        </div>
      )}

      {/* Main Tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl mb-6 w-fit">
        {[
          { id: 'marketplace', label: 'Marketplace', icon: ShoppingBag },
          { id: 'installed',   label: 'Installed',   icon: Download    },
          { id: 'customize',   label: 'Customize',   icon: Settings2, disabled: !customizing },
        ].map(({ id, label, icon: Icon, disabled }) => (
          <button key={id} disabled={disabled}
            onClick={() => setActiveTab(id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${activeTab === id ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {/* ── Marketplace / Installed ─────────────────────────────────────────── */}
      {(activeTab === 'marketplace' || activeTab === 'installed') && (
        <>
          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="Search themes…"
                className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white text-sm" />
            </div>
            <div className="flex gap-2 flex-wrap">
              {CATEGORIES.map(({ id, label }) => (
                <button key={id} onClick={() => setCategory(id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${category === id ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((theme) => (
              <Card key={theme.id} className="overflow-hidden group hover:shadow-lg transition-shadow">
                <div className="relative">
                  <img src={theme.preview} alt={theme.name} className="w-full h-48 object-cover bg-slate-100" />
                  {theme.isActive && (
                    <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500 text-white text-xs font-bold">
                      <Check size={11} /> Active
                    </div>
                  )}
                  {theme.price === 0 && (
                    <div className="absolute top-2 right-2 px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">FREE</div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                    <button onClick={() => setPreviewTheme(theme)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-white text-slate-800 rounded-lg text-xs font-bold hover:bg-slate-100 shadow-lg">
                      <Eye size={13} /> Preview
                    </button>
                    {!theme.isInstalled ? (
                      <button onClick={() => installTheme(theme.id)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 shadow-lg">
                        <Download size={13} /> {theme.price > 0 ? `Buy $${theme.price}` : 'Install Free'}
                      </button>
                    ) : (
                      <button onClick={() => !theme.isActive && activateTheme(theme.id)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold shadow-lg ${theme.isActive ? 'bg-emerald-500 text-white cursor-default' : 'bg-white text-slate-800 hover:bg-slate-100'}`}>
                        {theme.isActive ? <><Check size={13} /> Active</> : <><Zap size={13} /> Activate</>}
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white">{theme.name}</h3>
                      <p className="text-xs text-slate-500">by {theme.author}</p>
                    </div>
                    <div className="flex items-center gap-1 text-amber-500 text-xs font-semibold">
                      <Star size={12} className="fill-amber-400" /> {theme.rating}
                      <span className="text-slate-400 font-normal">({theme.ratingCount.toLocaleString()})</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mb-3 line-clamp-2">{theme.description}</p>
                  {theme.colors && (
                    <div className="flex gap-1 mb-3">
                      {Object.values(theme.colors).slice(0, 5).map((color, i) => (
                        <div key={i} className="w-5 h-5 rounded-full border border-white/50 shadow-sm" style={{ background: color }} />
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1 mb-3">
                    {theme.features?.slice(0, 3).map((f) => (
                      <span key={f} className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">{f}</span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-700">
                    <div className="flex items-center gap-1 text-xs text-slate-400">
                      <Globe size={11} /> {theme.downloads.toLocaleString()} installs
                    </div>
                    {theme.isInstalled ? (
                      <div className="flex gap-1">
                        <button onClick={() => openCustomize(theme)}
                          className="text-xs font-semibold text-indigo-600 hover:underline flex items-center gap-1">
                          <Settings2 size={12} /> Customize
                        </button>
                        {!theme.isActive && (
                          <button onClick={() => activateTheme(theme.id)}
                            className="ml-2 text-xs font-semibold text-emerald-600 hover:underline flex items-center gap-1">
                            <Zap size={12} /> Activate
                          </button>
                        )}
                      </div>
                    ) : (
                      <button onClick={() => installTheme(theme.id)}
                        className="text-xs font-bold text-indigo-600 flex items-center gap-1 hover:underline">
                        <Download size={12} /> {theme.price > 0 ? `$${theme.price}` : 'Install Free'}
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* ── Customize ──────────────────────────────────────────────────────── */}
      {activeTab === 'customize' && customizing && (
        <div>
          {/* Customize sub-tabs */}
          <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl mb-5 w-fit flex-wrap">
            {CUSTOMIZE_TABS.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setCustomizeTab(id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  customizeTab === id
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}>
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>

          {/* Colors / Typography / Layout + canvas */}
          {(customizeTab === 'colors' || customizeTab === 'typography' || customizeTab === 'layout') && (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="space-y-4">
                {configLoading ? (
                  <Card className="p-8 flex items-center justify-center">
                    <Loader2 size={20} className="animate-spin text-indigo-500" />
                  </Card>
                ) : (
                  <>
                    {customizeTab === 'colors'     && <ColorsPanel />}
                    {customizeTab === 'typography' && <TypographyPanel />}
                    {customizeTab === 'layout'     && <LayoutPanel />}
                  </>
                )}

                <div className="flex flex-col gap-2">
                  <Btn onClick={saveStyleDraft} disabled={configSaving} className="w-full justify-center">
                    {configSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    {configSaving ? 'Saving…' : 'Save Changes'}
                  </Btn>
                  <Btn variant="outline" onClick={() => { setCustomizing(null); setActiveTab('installed'); }} className="w-full justify-center">
                    Cancel
                  </Btn>
                </div>
              </div>

              <StyleCanvas />
            </div>
          )}

          {/* Header Builder — full width */}
          {customizeTab === 'header' && (
            <HeaderBuilder
              themeColors={colors}
              onDraftChange={() => setHasDraft(true)}
            />
          )}

          {/* Footer Builder — full width */}
          {customizeTab === 'footer' && (
            <FooterBuilder
              themeColors={colors}
              onDraftChange={() => setHasDraft(true)}
            />
          )}
        </div>
      )}

      {/* ── Theme Preview Modal ─────────────────────────────────────────────── */}
      {previewTheme && (
        <div className="fixed inset-0 z-50 bg-black/80 flex flex-col" onClick={() => setPreviewTheme(null)}>
          <div className="flex items-center justify-between px-6 py-3 bg-slate-900" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <span className="text-white font-bold">{previewTheme.name}</span>
              <div className="flex gap-1 bg-slate-800 p-1 rounded-lg">
                {PREVIEW_MODES.map(({ id, icon: Icon }) => (
                  <button key={id} onClick={() => setPreviewMode(id as any)}
                    className={`p-1.5 rounded ${previewMode === id ? 'bg-slate-600 text-white' : 'text-slate-400'}`}>
                    <Icon size={14} />
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!previewTheme.isInstalled && (
                <button onClick={() => { installTheme(previewTheme.id); setPreviewTheme(null); }}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700">
                  {previewTheme.price > 0 ? `Buy — $${previewTheme.price}` : 'Install Free'}
                </button>
              )}
              {previewTheme.isInstalled && !previewTheme.isActive && (
                <button onClick={() => { activateTheme(previewTheme.id); setPreviewTheme(null); }}
                  className="px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700">
                  Activate Theme
                </button>
              )}
              <button onClick={() => setPreviewTheme(null)} className="p-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700">
                <X size={18} />
              </button>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center overflow-auto p-8" onClick={(e) => e.stopPropagation()}>
            <div className="w-full max-w-4xl bg-white rounded-xl overflow-hidden shadow-2xl">
              <img src={previewTheme.preview} alt={previewTheme.name} className="w-full" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ThemeEngine;
