import React, { useState, useMemo } from 'react';
import {
  X, Search, Image, LayoutGrid, Type, Mail, Megaphone,
  LayoutPanelTop, Rows3, Star, Quote, HelpCircle,
  ShoppingBag, Video, Clock, Check,
} from 'lucide-react';
import { useEditor } from './EditorContext';
import { SECTION_DEFINITIONS } from './editor-mock-data';
import type { SectionDoc, BlockDoc } from './types';

// ─── Icon map ─────────────────────────────────────────────────────────────────

const ICONS: Record<string, React.ElementType> = {
  Image, LayoutGrid, Type, Mail, Megaphone,
  LayoutPanelTop, LayoutPanelBottom: Rows3,
  Star, Quote, HelpCircle, ShoppingBag, Video,
  Timer: Clock,
};

// ─── Section card ─────────────────────────────────────────────────────────────

const SectionCard: React.FC<{
  type:        string;
  name:        string;
  description: string;
  icon:        string;
  tier:        string;
  onAdd:       () => void;
}> = ({ name, description, icon, tier, onAdd }) => {
  const [added, setAdded] = useState(false);
  const Icon = ICONS[icon] ?? Image;

  const handleClick = () => {
    setAdded(true);
    onAdd();
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <button
      onClick={handleClick}
      className="group w-full text-left flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all"
    >
      {/* Icon */}
      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0 group-hover:bg-blue-50 dark:group-hover:bg-blue-950/30 group-hover:text-blue-600 transition-all">
        {added ? <Check size={18} className="text-emerald-500" /> : <Icon size={18} className="text-slate-500 group-hover:text-blue-600 transition-colors" />}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-200 truncate">{name}</p>
          {tier === 'premium' && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-600 uppercase tracking-wide">Pro</span>
          )}
        </div>
        <p className="text-[12px] text-slate-400 dark:text-slate-500 truncate">{description}</p>
      </div>

      {/* Arrow */}
      <span className="text-slate-300 dark:text-slate-600 group-hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-all text-sm">→</span>
    </button>
  );
};

// ─── Category filter ──────────────────────────────────────────────────────────

const CATEGORIES = ['All', 'Header', 'Media', 'Products', 'Content', 'Social', 'Footer'] as const;

// ─── Main overlay ─────────────────────────────────────────────────────────────

const SectionLibraryOverlay: React.FC = () => {
  const { state, dispatch } = useEditor();
  const [query, setQuery]       = useState('');
  const [category, setCategory] = useState<string>('All');

  if (!state.showSectionLibrary) return null;

  const close = () => dispatch({ type: 'HIDE_SECTION_LIBRARY' });

  const filteredSections = useMemo(() => {
    return SECTION_DEFINITIONS.filter((def) => {
      const matchCat = category === 'All' || def.category === category;
      const matchQ   = !query || def.name.toLowerCase().includes(query.toLowerCase()) || def.description.toLowerCase().includes(query.toLowerCase());
      return matchCat && matchQ;
    });
  }, [query, category]);

  const handleAdd = (def: typeof SECTION_DEFINITIONS[0]) => {
    const cuid = () => `sec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const blockCuid = () => `blk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const newBlocks: BlockDoc[] = def.defaultBlocks.map((b, i) => ({
      ...b,
      id: blockCuid(),
      sortOrder: (i + 1) * 1.0,
    }));

    const newSection: SectionDoc = {
      id:        cuid(),
      type:      def.type,
      label:     def.name,
      settings:  Object.fromEntries(
        def.settingsSchema
          .filter((f) => f.default !== undefined)
          .map((f) => [f.key, f.default])
      ),
      blocks:    newBlocks,
      isVisible: true,
    };

    dispatch({ type: 'ADD_SECTION', section: newSection, insertAfter: state.insertAfterSectionId });
    setTimeout(close, 300);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20 dark:bg-black/40 backdrop-blur-sm"
        onClick={close}
      />

      {/* Panel — slides in from right over the Inspector */}
      <div className="fixed top-12 right-0 bottom-0 w-80 z-50 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-4 py-4 border-b border-slate-100 dark:border-slate-700/60 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-[14px] font-semibold text-slate-900 dark:text-white">Add section</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">Choose a section to add to your page</p>
          </div>
          <button
            onClick={close}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700/60 shrink-0">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search sections…"
              autoFocus
              className="w-full pl-8 pr-3 py-2 text-[13px] rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
            />
          </div>
        </div>

        {/* Category tabs */}
        <div className="px-4 py-2 flex gap-1 flex-wrap border-b border-slate-50 dark:border-slate-700/40 shrink-0">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                category === cat
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Section list */}
        <div className="flex-1 overflow-y-auto p-2">
          {filteredSections.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-[13px] text-slate-400 font-medium">No sections found</p>
              <p className="text-[12px] text-slate-300 dark:text-slate-600 mt-1">Try a different search term</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {filteredSections.map((def) => (
                <SectionCard
                  key={def.type}
                  type={def.type}
                  name={def.name}
                  description={def.description}
                  icon={def.icon}
                  tier={def.tier}
                  onAdd={() => handleAdd(def)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer note */}
        <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700/60 shrink-0">
          <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center">
            Sections are added to your page draft. Publish when ready.
          </p>
        </div>
      </div>
    </>
  );
};

export default SectionLibraryOverlay;
