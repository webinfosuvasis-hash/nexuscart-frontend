/**
 * SectionEditor — reusable shell for every Aurus homepage section editor.
 *
 * Provides the full editor chrome:
 *  ┌──────────────────────────────────────────────────────────────┐
 *  │ ← Overview   [SECTION LABEL]        [enabled] [Save] [Pub]  │
 *  ├─────────┬────────────────────────────────────────────────────┤
 *  │ PREVIEW │  [Content] [Display] [Schedule] [History]          │
 *  │ (left)  │  Active tab content                                │
 *  └─────────┴────────────────────────────────────────────────────┘
 *
 * Each Aurus section editor implements only:
 *   - renderContent   → section-specific form fields
 *   - renderPreview   → CSS representation of the live section
 *   - renderDisplay?  → optional display/layout settings
 */

import React, { useState } from 'react';
import {
  ArrowLeft, Save, Globe, Monitor, Tablet, Smartphone,
  ChevronLeft, ChevronRight, Clock, History,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSectionEditor } from './useSectionEditor';
import type { SectionEditorProps, EditorTab, Viewport } from './types';

// ─── Schedule Tab ─────────────────────────────────────────────────────────────

const ScheduleTab: React.FC<{
  goLiveAt: string;
  expireAt: string;
  onGoLiveChange: (v: string) => void;
  onExpireChange:  (v: string) => void;
}> = ({ goLiveAt, expireAt, onGoLiveChange, onExpireChange }) => (
  <div className="space-y-4">
    <p className="text-xs text-slate-500 dark:text-slate-400">
      Leave both fields empty to keep the section always visible.
      Full timezone-aware scheduling arrives in Phase 4.
    </p>
    {[
      { label: 'Go live at',            value: goLiveAt, onChange: onGoLiveChange },
      { label: 'Expire at (optional)', value: expireAt, onChange: onExpireChange },
    ].map(f => (
      <div key={f.label}>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">{f.label}</label>
        <input
          type="datetime-local"
          value={f.value}
          onChange={e => f.onChange(e.target.value)}
          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
        />
      </div>
    ))}
    <p className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
      <Clock size={11} /> Full scheduling with timezone support arrives in Phase 4.
    </p>
  </div>
);

// ─── History Tab ──────────────────────────────────────────────────────────────

const HistoryTab: React.FC = () => (
  <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
    <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
      <History size={22} className="text-slate-400" />
    </div>
    <div>
      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Version history</p>
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
        Full version history with one-click rollback arrives in Phase 4.
      </p>
    </div>
  </div>
);

// ─── Preview Pane ─────────────────────────────────────────────────────────────

const PreviewPane: React.FC<{
  viewport: Viewport;
  onViewportChange: (v: Viewport) => void;
  previewSlide?: number;
  totalSlides?: number;
  onSlideChange?: (idx: number) => void;
  children: React.ReactNode;
}> = ({ viewport, onViewportChange, previewSlide, totalSlides = 1, onSlideChange, children }) => (
  <div className="flex flex-col h-full">
    {/* Viewport bar */}
    <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Live Preview</span>
      <div className="flex gap-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
        {(['desktop', 'tablet', 'mobile'] as Viewport[]).map(v => {
          const Icon = v === 'desktop' ? Monitor : v === 'tablet' ? Tablet : Smartphone;
          return (
            <button
              key={v}
              onClick={() => onViewportChange(v)}
              title={v.charAt(0).toUpperCase() + v.slice(1)}
              className={['p-1.5 rounded-md transition-colors', viewport === v ? 'bg-white dark:bg-slate-700 shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'].join(' ')}
            >
              <Icon size={13} />
            </button>
          );
        })}
      </div>
    </div>

    {/* Preview canvas */}
    <div className="flex-1 overflow-y-auto p-3">
      <div
        style={{ maxWidth: viewport === 'mobile' ? '390px' : viewport === 'tablet' ? '768px' : '100%', margin: '0 auto' }}
        className="transition-all duration-300"
      >
        {children}
      </div>

      {/* Slide navigation (used by carousel editors) */}
      {totalSlides > 1 && previewSlide !== undefined && onSlideChange && (
        <div className="flex items-center justify-center gap-2 mt-2">
          <button onClick={() => onSlideChange(Math.max(0, previewSlide - 1))} disabled={previewSlide === 0}
            className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30">
            <ChevronLeft size={14} />
          </button>
          <span className="text-xs text-slate-400">Slide {previewSlide + 1} of {totalSlides}</span>
          <button onClick={() => onSlideChange(Math.min(totalSlides - 1, previewSlide + 1))} disabled={previewSlide >= totalSlides - 1}
            className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30">
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  </div>
);

// ─── Tab bar ──────────────────────────────────────────────────────────────────

const TABS: { id: EditorTab; label: string }[] = [
  { id: 'content',  label: 'Content'  },
  { id: 'display',  label: 'Display'  },
  { id: 'schedule', label: 'Schedule' },
  { id: 'history',  label: 'History'  },
];

// ─── Main SectionEditor shell ─────────────────────────────────────────────────

export function SectionEditor<T extends object>({
  sectionId,
  sectionLabel,
  onBack,
  defaultConfig,
  parseConfig,
  validate,
  renderPreview,
  renderContent,
  renderDisplay,
}: SectionEditorProps<T>) {
  const editor = useSectionEditor({ sectionId, defaultConfig, parseConfig, validate });

  const [activeTab,    setActiveTab]    = useState<EditorTab>('content');
  const [viewport,     setViewport]     = useState<Viewport>('desktop');
  const [previewSlide, setPreviewSlide] = useState(0);

  const showDisplayTab = Boolean(renderDisplay);

  const visibleTabs = showDisplayTab
    ? TABS
    : TABS.filter(t => t.id !== 'display');

  return (
    <div className="flex flex-col h-full">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors flex-shrink-0"
          >
            <ArrowLeft size={15} />
            <span className="hidden sm:inline">Overview</span>
          </button>
          <span className="text-slate-300 dark:text-slate-600 hidden sm:inline">/</span>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white truncate">{sectionLabel}</h2>
          {editor.isDirty && (
            <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/40">
              Unsaved
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <Switch checked={editor.isEnabled} onCheckedChange={editor.updateEnabled} />
            <span className="hidden sm:inline">{editor.isEnabled ? 'Enabled' : 'Disabled'}</span>
          </div>
          <button
            onClick={editor.saveDraft}
            disabled={editor.isSaving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors disabled:opacity-50"
          >
            <Save size={14} /> Save Draft
          </button>
          <button
            onClick={editor.publish}
            disabled={editor.isSaving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-50"
          >
            <Globe size={14} /> Publish
          </button>
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────── */}
      <div className="flex items-center border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 sm:px-6 flex-shrink-0">
        {visibleTabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={[
              'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
              activeTab === t.id
                ? 'border-indigo-600 text-indigo-700 dark:text-indigo-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Body: Preview (left) + Config (right) ──────────────────────── */}
      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">

        {/* Left: live preview */}
        <div className="lg:w-[42%] xl:w-[45%] flex-shrink-0 border-r border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 overflow-hidden">
          <PreviewPane
            viewport={viewport}
            onViewportChange={setViewport}
            previewSlide={previewSlide}
            onSlideChange={setPreviewSlide}
          >
            {editor.isLoading
              ? <div className="h-40 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" />
              : renderPreview(editor.config, viewport)
            }
          </PreviewPane>
        </div>

        {/* Right: active tab content */}
        <div className="flex-1 overflow-y-auto min-w-0">
          <div className="p-4 space-y-4">
            {activeTab === 'content'  && renderContent(editor.config, editor.updateConfig, editor.errors)}
            {activeTab === 'display'  && renderDisplay?.(editor.config, editor.updateConfig)}
            {activeTab === 'schedule' && (
              <ScheduleTab
                goLiveAt={editor.goLiveAt}
                expireAt={editor.expireAt}
                onGoLiveChange={editor.setGoLiveAt}
                onExpireChange={editor.setExpireAt}
              />
            )}
            {activeTab === 'history'  && <HistoryTab />}
          </div>
        </div>
      </div>
    </div>
  );
}

// Re-export the preview pane for editors that need to control it
export { PreviewPane };
