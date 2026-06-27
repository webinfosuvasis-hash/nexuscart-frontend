/**
 * InsertCommandPalette — Sprint 8
 *
 * Replaces SectionLibraryOverlay. Opened via ⌘K or the [+ Insert] button.
 * Reads from two sources:
 *   1. SECTION_DEFINITIONS (legacy template sections — existing model)
 *   2. ComponentDefinition endpoint (layout primitives — ContentNode-ready)
 *
 * Inserting any item creates a ThemePageSection in the current model.
 * In Sprint 11, it will create a ContentNode instead.
 */

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  X, Search, Box, Layers, Grid, Columns, Minus, MoveVertical,
  Image, LayoutGrid, Type, Mail, Megaphone, Star, ShoppingBag,
  Video, Clock, HelpCircle, AlignLeft, FileText, ChevronDown,
} from 'lucide-react';
import { useEditor } from './EditorContext';
import { SECTION_DEFINITIONS } from './editor-mock-data';
import { PAGE_TEMPLATES }  from './templates';
import { PDP_TEMPLATES }   from './templates/pdp-templates';
import { useSymbolStore } from './SymbolModal';
import type { SectionDoc, BlockDoc } from './types';
import { nanoid } from 'nanoid';
// Phase 4: node-mode insertion
import {
  makeNode,
  createNodeFromDefinition,
  createNodeFromSeed,
} from './adapters/nodeFactory';

// ─── Primitive catalogue (Sprint 8 additions) ─────────────────────────────────

interface PrimitiveEntry {
  id:          string;
  name:        string;
  description: string;
  category:    string;
  icon:        React.ElementType;
  accentColor: string;
  defaults:    Record<string, unknown>;
}

const LAYOUT_PRIMITIVES: PrimitiveEntry[] = [
  {
    id: 'container', name: 'Container', icon: Box,
    description: 'Flexible wrapper with full style control.',
    category: 'layout', accentColor: '#38BDF8',
    defaults: { display: 'flex', flexDir: 'column', gap: 16 },
  },
  {
    id: 'stack', name: 'Stack', icon: Layers,
    description: 'Flex column or row with uniform gap.',
    category: 'layout', accentColor: '#38BDF8',
    defaults: { flexDir: 'column', gap: 16 },
  },
  {
    id: 'grid', name: 'Grid', icon: Grid,
    description: 'CSS Grid with configurable columns and gap.',
    category: 'layout', accentColor: '#38BDF8',
    defaults: { display: 'grid', gridCols: 3, gap: 24 },
  },
  {
    id: 'columns', name: 'Columns', icon: Columns,
    description: 'Explicit column ratios (e.g. 2:1 split).',
    category: 'layout', accentColor: '#38BDF8',
    defaults: { ratios: '1,1', gap: 24, stackOn: 'mobile' },
  },
  {
    id: 'spacer', name: 'Spacer', icon: MoveVertical,
    description: 'Empty vertical space block.',
    category: 'layout', accentColor: '#38BDF8',
    defaults: { h: 48 },
  },
  {
    id: 'divider', name: 'Divider', icon: Minus,
    description: 'Horizontal rule with style controls.',
    category: 'layout', accentColor: '#38BDF8',
    defaults: { bw: 1, bs: 'solid', bc: '#e5e7eb', mt: 16, mb: 16 },
  },
];

// ─── Icon map for legacy sections ────────────────────────────────────────────

const LEGACY_ICONS: Record<string, React.ElementType> = {
  Image, LayoutGrid, Type, Mail, Megaphone, Star, ShoppingBag,
  Video, Timer: Clock, HelpCircle, AlignLeft,
};

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORIES: { id: string; label: string; color: string }[] = [
  { id: 'all',       label: 'All',       color: 'var(--nx-violet-400)' },
  { id: 'templates', label: 'Templates', color: '#10B981' },
  { id: 'layout',    label: 'Layout',    color: '#38BDF8' },
  { id: 'content',   label: 'Content',   color: 'var(--nx-text-600)' },
  { id: 'commerce',  label: 'Commerce',  color: '#F59E0B' },
  { id: 'marketing', label: 'Marketing', color: '#EC4899' },
];

// ─── Fuzzy match ──────────────────────────────────────────────────────────────

function fuzzyMatch(query: string, target: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (t.includes(q)) return true;
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

// ─── Primitive card ───────────────────────────────────────────────────────────

const PrimitiveCard: React.FC<{
  entry:    PrimitiveEntry;
  onInsert: (id: string, name: string, defaults: Record<string, unknown>) => void;
}> = ({ entry, onInsert }) => {
  const Icon = entry.icon;
  return (
    <button
      onClick={() => onInsert(entry.id, entry.name, entry.defaults)}
      className="flex flex-col items-center gap-2 p-3 rounded-xl transition-all text-left"
      style={{ border: '1px solid var(--nx-border-1)', background: 'var(--nx-raised)' }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = entry.accentColor + '60';
        (e.currentTarget as HTMLElement).style.background  = entry.accentColor + '10';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--nx-border-1)';
        (e.currentTarget as HTMLElement).style.background  = 'var(--nx-raised)';
      }}
    >
      <div className="w-10 h-10 rounded-lg flex items-center justify-center"
        style={{ background: entry.accentColor + '18' }}>
        <Icon size={18} style={{ color: entry.accentColor }} />
      </div>
      <div className="w-full">
        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--nx-text-900)', textAlign: 'center' }}>
          {entry.name}
        </p>
      </div>
    </button>
  );
};

// ─── Section card ─────────────────────────────────────────────────────────────

const SectionCard: React.FC<{
  def:      typeof SECTION_DEFINITIONS[0];
  onInsert: (type: string, name: string) => void;
}> = ({ def, onInsert }) => {
  const Icon = LEGACY_ICONS[def.icon] ?? Image;
  return (
    <button
      onClick={() => onInsert(def.type, def.name)}
      className="flex flex-col items-center gap-2 p-3 rounded-xl transition-all"
      style={{ border: '1px solid var(--nx-border-1)', background: 'var(--nx-raised)' }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--nx-violet-500)';
        (e.currentTarget as HTMLElement).style.background  = 'var(--nx-violet-bg)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--nx-border-1)';
        (e.currentTarget as HTMLElement).style.background  = 'var(--nx-raised)';
      }}
    >
      <div className="w-10 h-10 rounded-lg flex items-center justify-center"
        style={{ background: 'rgba(139,92,246,0.12)' }}>
        <Icon size={18} style={{ color: 'var(--nx-violet-400)' }} />
      </div>
      <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--nx-text-900)', textAlign: 'center' }}>
        {def.name}
      </p>
    </button>
  );
};

// ─── Template card ────────────────────────────────────────────────────────────

const TemplateCard: React.FC<{
  template: typeof PAGE_TEMPLATES[0];
  onInsert: (id: string) => void;
}> = ({ template, onInsert }) => (
  <button
    onClick={() => onInsert(template.id)}
    className="flex items-start gap-3 p-3 rounded-xl transition-all text-left w-full"
    style={{ border: '1px solid var(--nx-border-1)', background: 'var(--nx-raised)' }}
    onMouseEnter={(e) => {
      (e.currentTarget as HTMLElement).style.borderColor = '#10B98160';
      (e.currentTarget as HTMLElement).style.background  = '#10B98110';
    }}
    onMouseLeave={(e) => {
      (e.currentTarget as HTMLElement).style.borderColor = 'var(--nx-border-1)';
      (e.currentTarget as HTMLElement).style.background  = 'var(--nx-raised)';
    }}
  >
    <span style={{ fontSize: 28, lineHeight: 1 }}>{template.thumbnail}</span>
    <div className="flex-1 min-w-0">
      <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--nx-text-900)', marginBottom: 2 }}>
        {template.name}
      </p>
      <p style={{ fontSize: 11, color: 'var(--nx-text-400)', lineHeight: 1.4 }}>
        {template.sections.length} sections · {template.vertical}
      </p>
    </div>
    <span style={{ fontSize: 10, fontWeight: 600, color: '#10B981',
      background: '#10B98112', border: '1px solid #10B98130',
      borderRadius: 4, padding: '2px 6px', flexShrink: 0 }}>
      Apply
    </span>
  </button>
);

// ─── Main palette ─────────────────────────────────────────────────────────────

const InsertCommandPalette: React.FC = () => {
  const { state, dispatch } = useEditor();
  const { showSectionLibrary, insertAfterSectionId } = state;

  const savedSymbols = useSymbolStore();
  const [query,      setQuery]      = useState('');
  const [category,   setCategory]   = useState('all');
  const [focusedIdx, setFocusedIdx] = useState(-1);
  const [recent,     setRecent]     = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('nx-insert-recent') ?? '[]'); }
    catch { return []; }
  });

  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showSectionLibrary) {
      setQuery('');
      setCategory('all');
      setFocusedIdx(-1);
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [showSectionLibrary]);

  // Reset focused index when query/category changes
  useEffect(() => { setFocusedIdx(-1); }, [query, category]);

  // Keyboard navigation — ↑↓ cycle items, Escape close
  useEffect(() => {
    if (!showSectionLibrary) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { dispatch({ type: 'HIDE_SECTION_LIBRARY' }); return; }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIdx((i) => i + 1);   // clamped in render
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIdx((i) => Math.max(i - 1, 0));
      }
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [showSectionLibrary, dispatch]);

  // Track recently used
  const trackRecent = useCallback((id: string) => {
    setRecent((prev) => {
      const next = [id, ...prev.filter((x) => x !== id)].slice(0, 5);
      try { localStorage.setItem('nx-insert-recent', JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  // ── Phase 4: body group ID (node mode only) ──────────────────────────────────
  // In node mode, every inserted node targets the body page_group.
  // Header/footer system groups are never addressable from the palette.
  const bodyGroupId = useMemo(() => {
    if (!state.nodeTree) return null;
    return (state.nodeTree.children ?? [])
      .find((g) => g.settings.handle === 'body')?.id ?? null;
  }, [state.nodeTree]);

  // ── SectionDoc builder (legacy path — unchanged) ──────────────────────────
  const makeSection = useCallback((
    type:     string,
    label:    string,
    settings: Record<string, unknown> = {},
  ): SectionDoc => {
    const def     = SECTION_DEFINITIONS.find((d) => d.type === type);
    const blocks: BlockDoc[] = (def?.defaultBlocks ?? []).map((b, i) => ({
      id:        `block-${nanoid(8)}`,
      type:      b.type,
      settings:  b.settings as Record<string, any>,
      isVisible: true,
      sortOrder: (b.sortOrder ?? i + 1) as number,
    }));
    return {
      id:        `sec-${nanoid(8)}`,
      type,
      label,
      settings:  settings as Record<string, any>,
      isVisible: true,
      blocks,
    };
  }, []);

  // ── insertPrimitive ───────────────────────────────────────────────────────
  // Layout primitives (container, stack, grid, …) — same in both models.

  const insertPrimitive = useCallback((
    id:       string,
    name:     string,
    defaults: Record<string, unknown>,
  ) => {
    if (state.nodeMode && bodyGroupId) {
      // Node mode: create a bare Node with the primitive's default settings
      const node = makeNode(id, name, defaults);
      dispatch({ type: 'INSERT_NODE', parentId: bodyGroupId, node, insertAfter: insertAfterSectionId });
    } else {
      // Legacy: create SectionDoc
      const section = makeSection(id, name, defaults);
      dispatch({ type: 'ADD_SECTION', section, insertAfter: insertAfterSectionId });
    }
    trackRecent(id);
  }, [state.nodeMode, bodyGroupId, dispatch, insertAfterSectionId, makeSection, trackRecent]);

  // ── insertLegacySection ───────────────────────────────────────────────────
  // Named sections (hero, newsletter, …) — uses SectionDefinition schema for
  // defaults and defaultBlocks in node mode.

  const insertLegacySection = useCallback((type: string, name: string) => {
    if (state.nodeMode && bodyGroupId) {
      // Node mode: derive settings + children from the section definition
      const def  = SECTION_DEFINITIONS.find((d) => d.type === type);
      const node = def
        ? createNodeFromDefinition(def)
        : makeNode(type, name);
      dispatch({ type: 'INSERT_NODE', parentId: bodyGroupId, node, insertAfter: insertAfterSectionId });
    } else {
      // Legacy: SectionDoc
      const section = makeSection(type, name);
      dispatch({ type: 'ADD_SECTION', section, insertAfter: insertAfterSectionId });
    }
    trackRecent(type);
  }, [state.nodeMode, bodyGroupId, dispatch, insertAfterSectionId, makeSection, trackRecent]);

  // ── insertTemplate ────────────────────────────────────────────────────────
  // Full page template — inserts all sections sequentially.

  const insertTemplate = useCallback((templateId: string) => {
    const ALL = [...PAGE_TEMPLATES, ...PDP_TEMPLATES];
    const template = ALL.find((t) => t.id === templateId);
    if (!template) return;

    if (state.nodeMode && bodyGroupId) {
      // Node mode: convert every template seed to a Node and insert sequentially
      let afterId: string | null = insertAfterSectionId;
      for (const seed of template.sections) {
        const node = createNodeFromSeed(seed);
        dispatch({ type: 'INSERT_NODE', parentId: bodyGroupId, node, insertAfter: afterId });
        afterId = node.id;
      }
    } else {
      // Legacy: SectionDoc chain
      let afterId: string | null = insertAfterSectionId;
      for (const seed of template.sections) {
        const blocks: BlockDoc[] = seed.blocks.map((b, i) => ({
          id:        `block-${nanoid(8)}`,
          type:      b.type,
          settings:  b.settings as Record<string, any>,
          isVisible: true,
          sortOrder: i + 1,
        }));
        const section: SectionDoc = {
          id:        `sec-${nanoid(8)}`,
          type:      seed.type,
          label:     seed.label,
          settings:  seed.settings as Record<string, any>,
          isVisible: true,
          blocks,
        };
        dispatch({ type: 'ADD_SECTION', section, insertAfter: afterId });
        afterId = section.id;
      }
    }

    trackRecent(templateId);
    dispatch({ type: 'HIDE_SECTION_LIBRARY' });
  }, [state.nodeMode, bodyGroupId, dispatch, insertAfterSectionId, trackRecent]);

  // Filter primitives
  const visiblePrimitives = useMemo(() =>
    LAYOUT_PRIMITIVES.filter((p) =>
      (category === 'all' || category === 'layout') &&
      (fuzzyMatch(query, p.name) || fuzzyMatch(query, p.description)),
    ),
  [query, category]);

  // Filter legacy sections
  const visibleSections = useMemo(() =>
    SECTION_DEFINITIONS.filter((d) => {
      const catMatch = category === 'all' || category === d.category?.toLowerCase();
      const qMatch   = fuzzyMatch(query, d.name) || fuzzyMatch(query, d.description ?? '');
      return catMatch && qMatch;
    }),
  [query, category]);

  // Filter templates — homepage + PDP combined
  const ALL_TEMPLATES = useMemo(() => [...PAGE_TEMPLATES, ...PDP_TEMPLATES], []);
  const visibleTemplates = useMemo(() =>
    ALL_TEMPLATES.filter((t) =>
      (category === 'all' || category === 'templates') &&
      (fuzzyMatch(query, t.name) || fuzzyMatch(query, t.vertical) || t.tags.some((tag) => fuzzyMatch(query, tag))),
    ),
  [query, category, ALL_TEMPLATES]);

  const recentPrimitives = LAYOUT_PRIMITIVES.filter((p) => recent.includes(p.id));
  const recentSections   = SECTION_DEFINITIONS.filter((d) => recent.includes(d.type));

  if (!showSectionLibrary) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[10vh]"
      onClick={() => dispatch({ type: 'HIDE_SECTION_LIBRARY' })}
    >
      {/* Backdrop */}
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />

      {/* Panel */}
      <div
        className="relative w-full max-w-[640px] mx-4 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{
          background: 'var(--nx-raised)',
          border: '1px solid var(--nx-border-2)',
          maxHeight: '80vh',
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search bar */}
        <div className="flex items-center gap-3 px-4 py-3 shrink-0"
          style={{ borderBottom: '1px solid var(--nx-border-1)' }}>
          <Search size={16} style={{ color: 'var(--nx-text-400)', flexShrink: 0 }} />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sections and primitives…"
            className="flex-1 bg-transparent focus:outline-none"
            style={{ fontSize: 14, color: 'var(--nx-text-900)' }}
          />
          <kbd style={{ fontSize: 11, color: 'var(--nx-text-400)', background: 'var(--nx-float)',
            border: '1px solid var(--nx-border-2)', borderRadius: 4, padding: '2px 6px' }}>
            Esc
          </kbd>
          <button
            onClick={() => dispatch({ type: 'HIDE_SECTION_LIBRARY' })}
            style={{ color: 'var(--nx-text-400)' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Category tabs */}
        <div className="flex items-center gap-1 px-3 py-2 shrink-0"
          style={{ borderBottom: '1px solid var(--nx-border-1)' }}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className="px-3 py-1 rounded-lg text-[11px] font-semibold transition-colors"
              style={{
                background:  category === cat.id ? cat.color + '18' : 'transparent',
                color:       category === cat.id ? cat.color        : 'var(--nx-text-400)',
                border:      category === cat.id ? `1px solid ${cat.color}40` : '1px solid transparent',
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Results */}
        <div className="overflow-y-auto flex-1 p-4 space-y-6">

          {/* Recently used */}
          {!query && (recentPrimitives.length > 0 || recentSections.length > 0) && (
            <section>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: 'var(--nx-text-400)', marginBottom: 10 }}>
                Recently used
              </p>
              <div className="grid grid-cols-4 gap-2">
                {recentPrimitives.slice(0, 2).map((p) => (
                  <PrimitiveCard key={p.id} entry={p} onInsert={insertPrimitive} />
                ))}
                {recentSections.slice(0, 2).map((d) => (
                  <SectionCard key={d.type} def={d} onInsert={insertLegacySection} />
                ))}
              </div>
            </section>
          )}

          {/* Page templates */}
          {visibleTemplates.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                  textTransform: 'uppercase', color: '#10B981' }}>
                  Page Templates
                </p>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold"
                  style={{ background: 'rgba(16,185,129,0.12)', color: '#10B981' }}>
                  {visibleTemplates.length} vertical{visibleTemplates.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {visibleTemplates.map((t) => (
                  <TemplateCard key={t.id} template={t} onInsert={insertTemplate} />
                ))}
              </div>
            </section>
          )}

          {/* Layout primitives */}
          {visiblePrimitives.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                  textTransform: 'uppercase', color: '#38BDF8' }}>
                  Layout Primitives
                </p>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold"
                  style={{ background: 'rgba(56,189,248,0.12)', color: '#38BDF8' }}>
                  ContentNode-ready
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {visiblePrimitives.map((p) => (
                  <PrimitiveCard key={p.id} entry={p} onInsert={insertPrimitive} />
                ))}
              </div>
            </section>
          )}

          {/* Legacy sections */}
          {visibleSections.length > 0 && (
            <section>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: 'var(--nx-text-400)', marginBottom: 10 }}>
                Sections
              </p>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {visibleSections.map((def) => (
                  <SectionCard key={def.type} def={def} onInsert={insertLegacySection} />
                ))}
              </div>
            </section>
          )}

          {/* Saved symbols */}
          {savedSymbols.length > 0 && (category === 'all' || category === 'templates') && (
            <section>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: '#EC4899', marginBottom: 10 }}>
                Your Symbols ({savedSymbols.length})
              </p>
              <div className="grid grid-cols-4 gap-2">
                {savedSymbols
                  .filter((s) => !query || fuzzyMatch(query, s.name) || fuzzyMatch(query, s.handle))
                  .map((sym) => (
                    <button
                      key={sym.id}
                      onClick={() => insertLegacySection(sym.sectionType, sym.name)}
                      className="flex flex-col items-center gap-2 p-3 rounded-xl transition-all"
                      style={{ border: '1px solid rgba(236,72,153,0.25)', background: 'rgba(236,72,153,0.06)' }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor = '#EC4899';
                        (e.currentTarget as HTMLElement).style.background  = 'rgba(236,72,153,0.12)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(236,72,153,0.25)';
                        (e.currentTarget as HTMLElement).style.background  = 'rgba(236,72,153,0.06)';
                      }}
                    >
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ background: 'rgba(236,72,153,0.15)' }}>
                        <Star size={18} style={{ color: '#EC4899' }} />
                      </div>
                      <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--nx-text-900)', textAlign: 'center' }}>
                        {sym.name}
                      </p>
                    </button>
                  ))
                }
              </div>
            </section>
          )}

          {/* Empty state */}
          {visibleTemplates.length === 0 && visiblePrimitives.length === 0 && visibleSections.length === 0 && savedSymbols.length === 0 && (
            <div className="flex flex-col items-center py-12 gap-3">
              <Search size={24} style={{ color: 'var(--nx-text-400)' }} />
              <p style={{ fontSize: 13, color: 'var(--nx-text-400)' }}>
                No results for "{query}"
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 shrink-0 flex items-center justify-between"
          style={{ borderTop: '1px solid var(--nx-border-1)' }}>
          <span style={{ fontSize: 11, color: 'var(--nx-text-400)' }}>
            {visibleTemplates.length + visiblePrimitives.length + visibleSections.length} items
          </span>
          <span style={{ fontSize: 11, color: 'var(--nx-text-400)' }}>
            ↑↓ navigate · Enter insert · Esc close
          </span>
        </div>
      </div>
    </div>
  );
};

export default InsertCommandPalette;
