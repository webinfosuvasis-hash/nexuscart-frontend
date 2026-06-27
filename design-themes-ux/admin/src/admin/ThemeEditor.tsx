import React, { useCallback, useEffect, useRef } from 'react';
import { EditorProvider } from './editor/EditorContext';
import EditorTopBar          from './editor/EditorTopBar';
import StructurePanel         from './editor/StructurePanel';
import CanvasPanel            from './editor/CanvasPanel';
import InspectorPanel         from './editor/InspectorPanel';
import InsertCommandPalette   from './editor/InsertCommandPalette';
import { useEditor }          from './editor/EditorContext';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { findNode } from './editor/adapters/nodeTreeHelpers';

// ─── Status bar ───────────────────────────────────────────────────────────────

const StatusBar: React.FC = () => {
  const { state } = useEditor();
  const { isDirty, isSaving, previewMode } = state;

  const breakpointLabel = {
    desktop: 'Desktop 1440px',
    tablet:  'Tablet 768px',
    mobile:  'Mobile 390px',
  }[previewMode] ?? 'Desktop';

  return (
    <div
      className="shrink-0 flex items-center justify-between px-4"
      style={{
        height: 24,
        background: 'var(--nx-base)',
        borderTop: '1px solid var(--nx-border-1)',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      {/* Left: save state */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          {isSaving ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span style={{ fontSize: 11, color: 'var(--nx-text-400)', fontWeight: 500 }}>Saving…</span>
            </>
          ) : isDirty ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span style={{ fontSize: 11, color: 'var(--nx-text-400)', fontWeight: 500 }}>Unsaved changes</span>
            </>
          ) : (
            <>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--nx-live)' }} />
              <span style={{ fontSize: 11, color: 'var(--nx-text-400)', fontWeight: 500 }}>Saved</span>
            </>
          )}
        </div>
        <span style={{ color: 'var(--nx-border-3)', fontSize: 11 }}>·</span>
        <span style={{ fontSize: 11, color: 'var(--nx-text-400)' }}>Draft</span>
      </div>

      {/* Center: breakpoint */}
      <span style={{ fontSize: 11, color: 'var(--nx-text-400)' }}>{breakpointLabel}</span>

      {/* Right: keyboard hints */}
      <div className="flex items-center gap-3">
        <span style={{ fontSize: 11, color: 'var(--nx-text-400)' }}>⌘Z undo</span>
        <span style={{ fontSize: 11, color: 'var(--nx-text-400)' }}>⌘S save</span>
      </div>
    </div>
  );
};

// ─── Inner layout (needs context) ────────────────────────────────────────────

const EditorLayout: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { state, dispatch } = useEditor();

  // ── Shared DndContext — covers both Layers panel and Canvas so cross-panel
  //    drag-and-drop works. Each child provides its own SortableContext but
  //    they all register drop zones in this single context.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  // Refs so handleDragEnd always reads the latest state without stale closures.
  const pageDocRef  = useRef(state.pageDoc);
  const nodeTreeRef = useRef(state.nodeTree);
  useEffect(() => { pageDocRef.current  = state.pageDoc;  }, [state.pageDoc]);
  useEffect(() => { nodeTreeRef.current = state.nodeTree; }, [state.nodeTree]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeRaw = String(active.id);
    const overRaw   = String(over.id);

    // ── Node mode: layer-node: or canvas-node: drag ─────────────────────────
    // Handles reordering in both the Layers panel (Phase 3) and the Canvas
    // (Phase 2 — currently a visual-only no-op since pageDoc is null, but
    // the branch is ready for when canvas-node: drags are fully wired).
    if (activeRaw.startsWith('layer-node:') || activeRaw.startsWith('canvas-node:')) {
      const nodeTree = nodeTreeRef.current;
      if (!nodeTree) return;

      // Strip node-mode prefixes
      const stripNode = (id: string) => id.replace(/^(layer-node:|canvas-node:)/, '');
      const activeId  = stripNode(activeRaw);
      const overId    = stripNode(overRaw);
      if (activeId === overId) return;

      // parentId is encoded as useSortable data by NodeRow and NodeSectionWrapper
      const parentId = active.data.current?.parentId as string | undefined;
      if (!parentId) return;

      // Validate the parent exists and reorder within its children list.
      // Cross-level drops (active and over in different parents) resolve to
      // newIdx === -1 and are silently ignored.
      const parentNode = findNode(nodeTree, parentId);
      if (!parentNode) return;

      const childIds = (parentNode.children ?? []).map((c) => c.id);
      const oldIdx   = childIds.indexOf(activeId);
      const newIdx   = childIds.indexOf(overId);
      if (oldIdx !== -1 && newIdx !== -1) {
        dispatch({
          type:       'REORDER_NODE_CHILDREN',
          parentId,
          orderedIds: arrayMove(childIds, oldIdx, newIdx),
        });
      }
      return;
    }

    // ── Legacy SectionDoc path (unchanged) ───────────────────────────────────
    const pageDoc = pageDocRef.current;
    if (!pageDoc) return;

    // Each panel prefixes its IDs to avoid duplicate-ID conflicts:
    //   layers panel sections  → "layer:sec-xxx"
    //   canvas sections        → "canvas:sec-xxx"
    //   layers panel blocks    → "layer-block:blk-xxx"
    const strip    = (id: string) => id.replace(/^(layer:|canvas:|layer-block:)/, '');
    const activeId = strip(activeRaw);
    const overId   = strip(overRaw);

    if (activeId === overId) return;

    // Section reorder
    const sectionIds = pageDoc.sections.map((s) => s.id);
    if (sectionIds.includes(activeId)) {
      const oldIdx = sectionIds.indexOf(activeId);
      const newIdx = sectionIds.indexOf(overId);
      if (oldIdx !== -1 && newIdx !== -1) {
        dispatch({ type: 'REORDER_SECTIONS', orderedIds: arrayMove(sectionIds, oldIdx, newIdx) });
      }
      return;
    }

    // Block reorder — find owner section
    for (const section of pageDoc.sections) {
      const blockIds = section.blocks.map((b) => b.id);
      if (blockIds.includes(activeId)) {
        const oldIdx = blockIds.indexOf(activeId);
        const newIdx = blockIds.indexOf(overId);
        if (oldIdx !== -1 && newIdx !== -1) {
          dispatch({ type: 'REORDER_BLOCKS', sectionId: section.id, orderedIds: arrayMove(blockIds, oldIdx, newIdx) });
        }
        return;
      }
    }
  }, [dispatch]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // ⌘K / Ctrl+K → open Insert palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        dispatch({ type: 'SHOW_SECTION_LIBRARY', insertAfter: null });
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [dispatch]);

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--nx-void)' }}>
      {/* Command bar */}
      <EditorTopBar onClose={onClose} />

      {/* Single DndContext spans both panels — enables cross-panel drag */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        {/* Body: rail + canvas + inspector */}
        <div className="flex flex-1 overflow-hidden relative">
          {/* LEFT — StructurePanel manages its own width (48px rail or 328px when fly-out open) */}
          <div className="shrink-0 flex flex-col" style={{ borderRight: '1px solid var(--nx-border-1)' }}>
            <StructurePanel />
          </div>

          {/* CENTER — Canvas (primary surface) */}
          <main className="flex-1 overflow-hidden flex flex-col" style={{ minWidth: 0, background: 'var(--nx-void)' }}>
            <CanvasPanel />
          </main>

          {/* RIGHT — Property dock (slides in on selection) */}
          <div
            className="shrink-0 flex flex-col overflow-hidden transition-all duration-200"
            style={{
              width: 280,
              background: 'var(--nx-base)',
              borderLeft: '1px solid var(--nx-border-1)',
            }}
          >
            <InspectorPanel />
          </div>
        </div>
      </DndContext>

      {/* Status bar */}
      <StatusBar />

      {/* ⌘K Insert command palette — replaces SectionLibraryOverlay */}
      <InsertCommandPalette />
    </div>
  );
};

// ─── Root ─────────────────────────────────────────────────────────────────────

interface ThemeEditorProps {
  onClose: () => void;
  themeId?: string;
  pageId?:  string;
}

const ThemeEditor: React.FC<ThemeEditorProps> = ({ onClose }) => {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col"
      style={{ fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
      <EditorProvider>
        <EditorLayout onClose={onClose} />
      </EditorProvider>
    </div>
  );
};

export default ThemeEditor;
