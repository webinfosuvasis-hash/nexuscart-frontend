import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import {
  Eye, Save, Globe, LayoutList, ChevronRight, Info,
  Monitor, Tablet, Smartphone, ChevronDown, Search,
  X, CheckCircle2, AlertCircle, FileEdit, RefreshCw, AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Btn } from '@/admin/ui';
import HeroBannerEditor        from './editors/HeroBannerEditor';
import FeaturedProductsEditor  from './editors/FeaturedProductsEditor';
import CampaignGridEditor      from './editors/CampaignGridEditor';
import CategoryDiscoveryEditor from './editors/CategoryDiscoveryEditor';
import CategoryIconsEditor     from './editors/CategoryIconsEditor';
import CollectionsEditor       from './editors/CollectionsEditor';
import BridalSectionEditor     from './editors/BridalSectionEditor';
import EditorialBannersEditor  from './editors/EditorialBannersEditor';
import StoreLocatorEditor      from './editors/StoreLocatorEditor';
import TryAtHomeEditor         from './editors/TryAtHomeEditor';
import VideoCallEditor         from './editors/VideoCallEditor';
import GiftRegistryEditor      from './editors/GiftRegistryEditor';
import PromotionalCardsEditor  from './editors/PromotionalCardsEditor';
import ExpertHelpEditor        from './editors/ExpertHelpEditor';
import SocialUGCEditor         from './editors/SocialUGCEditor';
import NewsletterEditor        from './editors/NewsletterEditor';
import { SECTION_TYPE } from './SectionRegistry';
import { pageBuilderService, type ApiBuilderSection } from '@/services/pageBuilderService';
import { AURUS_HOMEPAGE_SECTIONS, getSectionDefinition } from './SectionRegistry';
import SectionRow, { type SectionRowData } from './SectionRow';
import type { BuilderSectionStatus } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type FilterType = 'ALL' | 'LIVE' | 'DRAFT' | 'SCHEDULED' | 'DISABLED' | 'LOCKED';
type PageState  = 'published' | 'draft' | 'unsaved';

interface SectionStats {
  total: number;
  live: number;
  draft: number;
  scheduled: number;
  disabled: number;
  locked: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Map API section to local UI row data */
function mapApiSection(s: ApiBuilderSection): SectionRowData {
  return {
    id: s.id,
    sectionType: s.sectionType,
    label: s.label,
    sortOrder: s.sortOrder,
    isEnabled: s.isEnabled,
    isLocked: s.isLocked,
    status: s.status as BuilderSectionStatus,
    scheduledAt: s.goLiveAt
      ? new Date(s.goLiveAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : undefined,
  };
}

/**
 * Fallback sections used while the API is loading or unavailable.
 * Mirrors AURUS_HOMEPAGE_SECTIONS with temporary placeholder IDs.
 */
function buildFallbackSections(): SectionRowData[] {
  return AURUS_HOMEPAGE_SECTIONS.map((def, i) => ({
    id: `placeholder-${def.type}`,
    sectionType: def.type,
    label: def.label,
    sortOrder: i + 1,
    isEnabled: def.defaultEnabled,
    isLocked: def.isLocked,
    status: def.defaultStatus as BuilderSectionStatus,
  }));
}

function computeStats(sections: SectionRowData[]): SectionStats {
  return {
    total:     sections.length,
    live:      sections.filter(s => s.status === 'LIVE' && s.isEnabled).length,
    draft:     sections.filter(s => s.status === 'DRAFT').length,
    scheduled: sections.filter(s => s.status === 'SCHEDULED').length,
    disabled:  sections.filter(s => !s.isEnabled).length,
    locked:    sections.filter(s => s.isLocked).length,
  };
}

// ─── React Query keys ─────────────────────────────────────────────────────────

const QUERY_KEY = ['page-builder', 'homepage'];

// ─── Sub-components ───────────────────────────────────────────────────────────

const PageStateBadge: React.FC<{ state: PageState }> = ({ state }) => {
  const cfg = {
    published: { icon: <CheckCircle2 size={12} />, label: 'Published',       cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/40' },
    draft:     { icon: <FileEdit     size={12} />, label: 'Draft',            cls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/40' },
    unsaved:   { icon: <AlertCircle  size={12} />, label: 'Unsaved Changes',  cls: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800/40' },
  }[state];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.cls}`}>
      {cfg.icon}{cfg.label}
    </span>
  );
};

const StatCard: React.FC<{ label: string; value: number; dotColor: string; active?: boolean; onClick?: () => void }> = ({
  label, value, dotColor, active = false, onClick,
}) => (
  <button
    onClick={onClick}
    className={['flex items-center gap-2 px-3 py-2 rounded-xl border text-left transition-all',
      active
        ? 'bg-indigo-600 border-indigo-600 shadow-sm shadow-indigo-200 dark:shadow-indigo-900/40'
        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600',
    ].join(' ')}
  >
    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${active ? 'bg-white/80' : dotColor}`} />
    <div>
      <p className={`text-lg font-bold leading-none ${active ? 'text-white' : 'text-slate-900 dark:text-white'}`}>{value}</p>
      <p className={`text-[10px] mt-0.5 leading-none ${active ? 'text-white/70' : 'text-slate-500 dark:text-slate-400'}`}>{label}</p>
    </div>
  </button>
);

interface FilterOption { value: FilterType; label: string; count: (s: SectionStats) => number }

const FILTERS: FilterOption[] = [
  { value: 'ALL',       label: 'All',       count: s => s.total },
  { value: 'LIVE',      label: 'Live',      count: s => s.live },
  { value: 'DRAFT',     label: 'Draft',     count: s => s.draft },
  { value: 'SCHEDULED', label: 'Scheduled', count: s => s.scheduled },
  { value: 'DISABLED',  label: 'Disabled',  count: s => s.disabled },
  { value: 'LOCKED',    label: 'Locked',    count: s => s.locked },
];

// ─── Main component ───────────────────────────────────────────────────────────

// ─── Section editor placeholder (for sections without a Phase 2 editor yet) ──

const SectionEditorPlaceholder: React.FC<{ sectionType: string; onBack: () => void }> = ({ sectionType, onBack }) => (
  <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
    <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-3xl">🔧</div>
    <div>
      <p className="text-base font-semibold text-slate-800 dark:text-slate-200">Editor coming soon</p>
      <p className="text-sm text-slate-400 dark:text-slate-500 mt-1 max-w-sm">
        The <strong className="text-slate-600 dark:text-slate-300">{sectionType.replace(/_/g, ' ')}</strong> editor
        will be implemented in a future phase.
      </p>
    </div>
    <button
      onClick={onBack}
      className="px-4 py-2 text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
    >
      ← Back to Homepage Builder
    </button>
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

const HomepageBuilder: React.FC = () => {
  const queryClient = useQueryClient();

  // ── Editor routing ─────────────────────────────────────────────────────────
  const [editingSection, setEditingSection] = useState<{ id: string; type: string } | null>(null);

  // ── Server state ────────────────────────────────────────────────────────────
  const { data: response, isLoading, isError, error } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => pageBuilderService.getHomepage(),
    retry: 1,
    staleTime: 30_000, // 30 s — re-fetch if stale
  });

  const page = response?.data;

  // ── Local UI state ───────────────────────────────────────────────────────────
  const [sections,     setSections]     = useState<SectionRowData[]>(buildFallbackSections);
  const [searchQuery,  setSearchQuery]  = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');
  const [pageState,    setPageState]    = useState<PageState>('published');

  // Track original section order for optimistic-update rollback
  const prevSections = useRef<SectionRowData[]>([]);

  // Sync API data → local state when the query resolves
  useEffect(() => {
    if (page?.sections) {
      const mapped = page.sections.map(mapApiSection);
      setSections(mapped);
      prevSections.current = mapped;
      setPageState(page.status === 'DRAFT' ? 'draft' : 'published');
    }
  }, [page]);

  // ── Mutations ────────────────────────────────────────────────────────────────

  const toggleMutation = useMutation({
    mutationFn: (id: string) => pageBuilderService.toggleSection(id),
    onError: (_err, id) => {
      // Revert the optimistic update
      setSections(prev => prev.map(s => s.id === id ? { ...s, isEnabled: !s.isEnabled } : s));
      toast.error('Failed to update section visibility');
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (items: Array<{ id: string; sortOrder: number }>) =>
      pageBuilderService.reorderSections(items),
    onError: () => {
      // Revert to the order before drag
      setSections(prevSections.current);
      toast.error('Failed to save new order — reverted');
    },
  });

  // ── DnD ─────────────────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // ── Derived state ─────────────────────────────────────────────────────────
  const stats = useMemo(() => computeStats(sections), [sections]);

  const isFiltering = activeFilter !== 'ALL' || searchQuery.trim() !== '';

  const filteredSections = useMemo(() => sections.filter(s => {
    const matchesSearch = !searchQuery.trim() || s.label.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = (() => {
      switch (activeFilter) {
        case 'LIVE':      return s.status === 'LIVE' && s.isEnabled;
        case 'DRAFT':     return s.status === 'DRAFT';
        case 'SCHEDULED': return s.status === 'SCHEDULED';
        case 'DISABLED':  return !s.isEnabled;
        case 'LOCKED':    return s.isLocked;
        default:          return true;
      }
    })();
    return matchesSearch && matchesFilter;
  }), [sections, searchQuery, activeFilter]);

  const sortableIds = useMemo(
    () => isFiltering ? [] : sections.filter(s => !s.isLocked).map(s => s.id),
    [sections, isFiltering],
  );

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const markUnsaved = useCallback(() => {
    setPageState(prev => prev === 'published' ? 'unsaved' : prev);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setSections(prev => {
      prevSections.current = prev;
      const oldIdx = prev.findIndex(s => s.id === active.id);
      const newIdx = prev.findIndex(s => s.id === over.id);
      const reordered = arrayMove(prev, oldIdx, newIdx).map((s, i) => ({ ...s, sortOrder: i + 1 }));
      // Persist to backend — non-blocking, reverts on error
      reorderMutation.mutate(reordered.map(s => ({ id: s.id, sortOrder: s.sortOrder })));
      return reordered;
    });

    markUnsaved();
    toast.success('Section order updated', { description: 'Publish to make this live.' });
  }, [reorderMutation, markUnsaved]);

  const handleToggle = useCallback((id: string) => {
    const section = sections.find(s => s.id === id);
    if (!section) return;

    // Optimistic update
    setSections(prev => prev.map(s => s.id === id ? { ...s, isEnabled: !s.isEnabled } : s));
    markUnsaved();

    // Persist — placeholder IDs (pre-API load) call local-only
    if (!id.startsWith('placeholder-')) {
      toggleMutation.mutate(id);
    }

    toast.success(section.isEnabled ? `${section.label} hidden` : `${section.label} visible`, {
      description: 'Publish to apply this change.',
    });
  }, [sections, toggleMutation, markUnsaved]);

  const handleEdit = useCallback((id: string) => {
    const s = sections.find(sec => sec.id === id);
    if (!s) return;
    // Skip editing for locked (Theme Engine) sections and placeholder IDs
    if (s.isLocked) {
      toast.info('Managed in Theme Engine', { description: 'Open Theme Engine → Trust Badges to edit this section.' });
      return;
    }
    if (id.startsWith('placeholder-')) {
      toast.info('Loading…', { description: 'Connect to the server to edit sections.' });
      return;
    }
    setEditingSection({ id, type: s.sectionType });
  }, [sections]);

  const handleDuplicate = useCallback((id: string) => {
    const s = sections.find(sec => sec.id === id);
    toast.info(`Duplicate: ${s?.label ?? 'section'}`, { description: 'Coming in Phase 2.' });
  }, [sections]);

  const handleSchedule = useCallback((id: string) => {
    const s = sections.find(sec => sec.id === id);
    toast.info(`Schedule: ${s?.label ?? 'section'}`, { description: 'Scheduling UI arrives in Phase 4.' });
  }, [sections]);

  const handleViewHistory = useCallback((id: string) => {
    const s = sections.find(sec => sec.id === id);
    toast.info(`Version history: ${s?.label ?? 'section'}`, { description: 'Version history arrives in Phase 4.' });
  }, [sections]);

  const handleDelete = useCallback((id: string) => {
    const s = sections.find(sec => sec.id === id);
    toast.info(`Remove: ${s?.label ?? 'section'}`, { description: 'Section removal arrives in Phase 2.' });
  }, [sections]);

  const handleOpenThemeEngine = useCallback(() => {
    toast.info('Theme Engine', { description: 'Navigate to Theme Engine → Trust Badges to edit this section.' });
  }, []);

  const handlePreview = useCallback((mode: 'desktop' | 'tablet' | 'mobile') => {
    const labels = { desktop: 'Desktop (1280px)', tablet: 'Tablet (768px)', mobile: 'Mobile (390px)' };
    toast.info(`Preview — ${labels[mode]}`, { description: 'Live preview panel arrives in Phase 4.' });
  }, []);

  const handleSaveDraft = useCallback(() => {
    setPageState('draft');
    toast.success('Draft saved', { description: 'Your changes are saved. Publish when ready.' });
  }, []);

  const handlePublish = useCallback(() => {
    setPageState('published');
    toast.success('Homepage published ✓', { description: 'Full publish workflow (with versioning) arrives in Phase 4.' });
  }, []);

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    toast.info('Refreshing sections…');
  }, [queryClient]);

  const handleStatCardClick = useCallback((filter: FilterType) => {
    setActiveFilter(prev => prev === filter ? 'ALL' : filter);
  }, []);

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setActiveFilter('ALL');
  }, []);

  // ── Editor routing — MUST be after all hooks (Rules of Hooks) ────────────────
  // Returning a different component here is safe because all hooks above have
  // already been called unconditionally on every render.
  if (editingSection) {
    const onBack = () => setEditingSection(null);
    switch (editingSection.type) {
      case SECTION_TYPE.HERO_BANNER:        return <HeroBannerEditor        sectionId={editingSection.id} onBack={onBack} />;
      case SECTION_TYPE.FEATURED_PRODUCTS:  return <FeaturedProductsEditor  sectionId={editingSection.id} onBack={onBack} />;
      case SECTION_TYPE.CAMPAIGN_GRID:      return <CampaignGridEditor      sectionId={editingSection.id} onBack={onBack} />;
      case SECTION_TYPE.CATEGORY_DISCOVERY: return <CategoryDiscoveryEditor sectionId={editingSection.id} onBack={onBack} />;
      case SECTION_TYPE.CATEGORY_ICONS:     return <CategoryIconsEditor     sectionId={editingSection.id} onBack={onBack} />;
      case SECTION_TYPE.COLLECTIONS:        return <CollectionsEditor       sectionId={editingSection.id} onBack={onBack} />;
      case SECTION_TYPE.BRIDAL_SECTION:     return <BridalSectionEditor     sectionId={editingSection.id} onBack={onBack} />;
      case SECTION_TYPE.EDITORIAL_BANNERS:  return <EditorialBannersEditor  sectionId={editingSection.id} onBack={onBack} />;
      case SECTION_TYPE.STORE_LOCATOR:      return <StoreLocatorEditor      sectionId={editingSection.id} onBack={onBack} />;
      case SECTION_TYPE.TRY_AT_HOME:        return <TryAtHomeEditor         sectionId={editingSection.id} onBack={onBack} />;
      case SECTION_TYPE.VIDEO_CALL:         return <VideoCallEditor         sectionId={editingSection.id} onBack={onBack} />;
      case SECTION_TYPE.GIFT_REGISTRY:      return <GiftRegistryEditor      sectionId={editingSection.id} onBack={onBack} />;
      case SECTION_TYPE.PROMOTIONAL_CARDS:  return <PromotionalCardsEditor  sectionId={editingSection.id} onBack={onBack} />;
      case SECTION_TYPE.EXPERT_HELP:        return <ExpertHelpEditor        sectionId={editingSection.id} onBack={onBack} />;
      case SECTION_TYPE.SOCIAL_UGC:         return <SocialUGCEditor         sectionId={editingSection.id} onBack={onBack} />;
      case SECTION_TYPE.NEWSLETTER:         return <NewsletterEditor        sectionId={editingSection.id} onBack={onBack} />;
      default:
        return <SectionEditorPlaceholder sectionType={editingSection.type} onBack={onBack} />;
    }
  }

  // ── Last published display ────────────────────────────────────────────────
  const lastPublishedText = page?.publishedAt
    ? new Date(page.publishedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : 'Not yet published';

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-5">

      {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500 mb-1.5">
            <LayoutList size={12} />
            <span>Storefront</span>
            <ChevronRight size={10} />
            <span className="text-slate-600 dark:text-slate-300 font-medium">Homepage Builder</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white leading-tight">Homepage Builder</h1>
            <PageStateBadge state={pageState} />
            {isLoading && <span className="text-xs text-slate-400 animate-pulse">Loading…</span>}
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Aurus Theme &mdash; manage every section from one place
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-1.5">
            <span className="font-mono font-semibold text-slate-500 dark:text-slate-400">v1</span>
            <span>&middot;</span>
            <span>Last published <span className="font-medium text-slate-600 dark:text-slate-300">{lastPublishedText}</span></span>
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Refresh */}
          <button
            onClick={handleRefresh}
            title="Refresh sections from server"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <RefreshCw size={15} />
          </button>

          {/* Preview dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors">
                <Eye size={15} /> Preview <ChevronDown size={12} className="text-slate-400" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => handlePreview('desktop')} className="text-sm gap-2 cursor-pointer">
                <Monitor size={14} className="text-slate-400" /> Desktop (1280px)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handlePreview('tablet')} className="text-sm gap-2 cursor-pointer">
                <Tablet size={14} className="text-slate-400" /> Tablet (768px)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handlePreview('mobile')} className="text-sm gap-2 cursor-pointer">
                <Smartphone size={14} className="text-slate-400" /> Mobile (390px)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Btn variant="outline" onClick={handleSaveDraft} className="gap-1.5">
            <Save size={14} /> Save Draft
          </Btn>
          <Btn variant="primary" onClick={handlePublish} className="gap-1.5">
            <Globe size={14} /> Publish
          </Btn>
        </div>
      </div>

      {/* ══ API ERROR BANNER ═════════════════════════════════════════════════ */}
      {isError && (
        <div className="flex items-start gap-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-xl px-4 py-3 text-xs text-red-700 dark:text-red-300">
          <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
          <span>
            Could not load sections from the server
            {(error as any)?.message ? ` — ${(error as any).message}` : ''}.
            Showing the default layout. Changes will not persist until the server is reachable.
          </span>
          <button onClick={handleRefresh} className="ml-auto font-medium underline underline-offset-2">Retry</button>
        </div>
      )}

      {/* ══ STATS ROW ════════════════════════════════════════════════════════ */}
      <div className="flex items-center gap-2 flex-wrap">
        <StatCard label="Total"     value={stats.total}     dotColor="bg-slate-400"   active={activeFilter === 'ALL'}       onClick={() => handleStatCardClick('ALL')} />
        <StatCard label="Live"      value={stats.live}      dotColor="bg-emerald-500" active={activeFilter === 'LIVE'}      onClick={() => handleStatCardClick('LIVE')} />
        <StatCard label="Draft"     value={stats.draft}     dotColor="bg-amber-400"   active={activeFilter === 'DRAFT'}     onClick={() => handleStatCardClick('DRAFT')} />
        <StatCard label="Scheduled" value={stats.scheduled} dotColor="bg-blue-500"    active={activeFilter === 'SCHEDULED'} onClick={() => handleStatCardClick('SCHEDULED')} />
        <StatCard label="Disabled"  value={stats.disabled}  dotColor="bg-slate-300"   active={activeFilter === 'DISABLED'}  onClick={() => handleStatCardClick('DISABLED')} />
      </div>

      {/* ══ SEARCH + FILTER CHIPS ══════════════════════════════════════════ */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search sections…"
            className="w-full pl-9 pr-8 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 outline-none focus:border-indigo-400 dark:focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/30 transition-all"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors" aria-label="Clear search">
              <X size={13} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {FILTERS.map(f => {
            const count = f.count(stats);
            const isActive = activeFilter === f.value;
            return (
              <button key={f.value} onClick={() => setActiveFilter(f.value)}
                className={['inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all',
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600 hover:text-indigo-700 dark:hover:text-indigo-400',
                ].join(' ')}
              >
                {f.label}
                <span className={`px-1.5 py-[1px] rounded-md text-[10px] font-bold ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ══ INFO BANNER ══════════════════════════════════════════════════════ */}
      {!isFiltering && (
        <div className="flex items-start gap-2.5 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-800/40 rounded-xl px-4 py-3 text-xs text-indigo-700 dark:text-indigo-300">
          <Info size={14} className="mt-0.5 flex-shrink-0" />
          <span>
            Drag sections to reorder them on the homepage. Toggle the switch to show or hide a section.
            Section configuration editors arrive in <strong>Phase 2</strong>.
            Changes go live after you click <strong>Publish</strong>.
          </span>
        </div>
      )}

      {/* ══ SECTION TABLE ════════════════════════════════════════════════════ */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">

        {/* Column headers */}
        <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
          <div className="w-5" />
          <div className="w-5 text-center text-[10px] font-bold uppercase tracking-widest text-slate-400">#</div>
          <div className="w-[88px] text-[10px] font-bold uppercase tracking-widest text-slate-400">Preview</div>
          <div className="flex-1 text-[10px] font-bold uppercase tracking-widest text-slate-400 pl-1">Section</div>
          <div className="w-[120px] text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</div>
          <div className="w-12 text-[10px] font-bold uppercase tracking-widest text-slate-400">Visible</div>
          <div className="w-[140px] text-right text-[10px] font-bold uppercase tracking-widest text-slate-400">Actions</div>
        </div>

        {/* Filtering notice */}
        {isFiltering && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50/60 dark:bg-amber-900/10 border-b border-amber-100 dark:border-amber-800/30 text-xs text-amber-700 dark:text-amber-400">
            <Info size={12} />
            <span>
              Showing {filteredSections.length} of {sections.length} sections
              {searchQuery && ` matching "${searchQuery}"`}
              {activeFilter !== 'ALL' && ` · Filter: ${activeFilter}`}
              &nbsp;&mdash; drag-to-reorder is disabled while filtering.
            </span>
            <button onClick={clearFilters} className="ml-auto inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 font-medium transition-colors">
              <X size={11} /> Clear
            </button>
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading && sections[0]?.id.startsWith('placeholder-') && (
          <div className="px-4 py-3 space-y-2.5">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="w-5 h-4 bg-slate-100 dark:bg-slate-800 rounded" />
                <div className="w-5 h-4 bg-slate-100 dark:bg-slate-800 rounded" />
                <div className="w-[88px] h-[58px] bg-slate-100 dark:bg-slate-800 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 bg-slate-100 dark:bg-slate-800 rounded w-48" />
                  <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded w-72" />
                </div>
                <div className="w-[120px] h-6 bg-slate-100 dark:bg-slate-800 rounded-full" />
                <div className="w-10 h-5 bg-slate-100 dark:bg-slate-800 rounded-full" />
                <div className="w-[140px] h-5 bg-slate-100 dark:bg-slate-800 rounded" />
              </div>
            ))}
          </div>
        )}

        {/* Rows */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
            <div>
              {!isLoading && filteredSections.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 text-slate-400 dark:text-slate-500">
                  <Search size={28} className="mb-3 opacity-40" />
                  <p className="font-medium text-slate-600 dark:text-slate-300">No sections found</p>
                  <p className="text-sm mt-1">Try a different search term or filter</p>
                  <button onClick={clearFilters} className="mt-3 text-sm text-indigo-600 dark:text-indigo-400 hover:underline">Clear all filters</button>
                </div>
              ) : (
                filteredSections.map((section, index) => {
                  const definition = getSectionDefinition(section.sectionType as any);
                  if (!definition) return null;
                  return (
                    <SectionRow
                      key={section.id}
                      section={section}
                      definition={definition}
                      position={isFiltering ? sections.indexOf(section) + 1 : index + 1}
                      isDndEnabled={!isFiltering}
                      onToggle={handleToggle}
                      onEdit={handleEdit}
                      onDuplicate={handleDuplicate}
                      onSchedule={handleSchedule}
                      onViewHistory={handleViewHistory}
                      onDelete={handleDelete}
                      onOpenThemeEngine={handleOpenThemeEngine}
                    />
                  );
                })
              )}
            </div>
          </SortableContext>
        </DndContext>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50/80 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-700/50 text-xs text-slate-400 dark:text-slate-500">
          <span>
            {isFiltering
              ? `${filteredSections.length} of ${sections.length} sections shown`
              : `${sections.length} sections total`}
          </span>
          <span>
            Last published <span className="font-medium text-slate-600 dark:text-slate-300">{lastPublishedText}</span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default HomepageBuilder;
