/**
 * NodeCanvas — Phase 2
 *
 * Renders the editor canvas when nodeMode is active (CONTENT_NODE_ENABLED ON).
 *
 * Render flow:
 *   NodeCanvas
 *   └── RenderContextProvider      (breakpoint, themeTokens, isPreview)
 *       ├── SystemSectionShell     (header — non-editable placeholder)
 *       ├── SortableContext        (canvas-node: DnD prefix for body nodes)
 *       │   └── NodeSectionWrapper (per body node — selection / hover / toolbar)
 *       │       └── TreeRenderer   (delegates to NodeRenderer → registry dispatch)
 *       └── SystemSectionShell     (footer — non-editable placeholder)
 *
 * Section types registered in the NodeRenderer registry render correctly.
 * Unregistered types (hero, newsletter, etc.) show the Unknown fallback in preview
 * mode — intentional for Phase 2; registration happens in a future phase.
 *
 * System header and footer use a non-interactive shell because:
 *   1. Their React components are defined inline in SimulatedCanvas.tsx and are
 *      not exported (avoiding circular imports).
 *   2. Header and footer have dedicated editors (HeaderBuilder / FooterBuilder)
 *      and are not edited via the page canvas.
 *
 * Drag-and-drop:
 *   Body nodes register as 'canvas-node:{id}' in the shared DndContext provided
 *   by EditorLayout. In Phase 2, onDragEnd returns early when pageDoc is null
 *   (as it is in node mode) — DnD visual feedback works but order does not update.
 *   Phase 3 will wire REORDER_NODE_CHILDREN in ThemeEditor.onDragEnd.
 */

import React, { useCallback, useMemo } from 'react';
import {
  GripVertical, ChevronUp, ChevronDown, Copy, Trash2,
  Eye, EyeOff, Plus, Menu, Layout,
} from 'lucide-react';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS }                             from '@dnd-kit/utilities';
import { useEditor }                       from '../EditorContext';
import { TreeRenderer, RenderContextProvider } from '@/components/node-renderer';
import { getBodySections, getHeaderSections, getFooterSections } from '../adapters/pageDocNodeTree';
import type { Node }                       from '@/components/node-renderer/types';

// ─── DnD prefix ───────────────────────────────────────────────────────────────

/** Distinct from legacy 'canvas:' prefix so the two paths never collide. */
const NODE_CANVAS_PREFIX = 'canvas-node' as const;

// ─── System section shell ─────────────────────────────────────────────────────
// Renders a minimal branded placeholder for system sections (header / footer).
// These are not edited in the page canvas — they have dedicated builders.

const SystemSectionShell: React.FC<{
  label:    string;
  icon:     React.ElementType;
  children?: React.ReactNode;
}> = ({ label, icon: Icon, children }) => (
  <div
    className="relative"
    style={{
      background:   '#ffffff',
      borderBottom: '1px solid #e5e7eb',
    }}
  >
    {/* Visual indicator */}
    <div
      className="absolute top-0 left-0 z-10 flex items-center gap-1 px-2 py-0.5"
      style={{
        background:          'rgba(15,15,20,0.65)',
        borderBottomRightRadius: 4,
        pointerEvents:       'none',
        fontFamily:          "'Plus Jakarta Sans', sans-serif",
      }}
    >
      <Icon size={10} style={{ color: 'rgba(255,255,255,0.6)' }} />
      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>
        {label}
      </span>
    </div>
    {children}
  </div>
);

// ─── Node canvas toolbar ──────────────────────────────────────────────────────
// Floating toolbar above the selected body node — mirrors CanvasToolbar but
// dispatches node-mode actions.

interface NodeCanvasToolbarProps {
  nodeId:      string;
  bodyNodeIds: string[];
  bodyGroupId: string;
  isVisible:   boolean;
  listeners:   Record<string, unknown> | undefined;
  attributes:  Record<string, unknown>;
}

const NodeCanvasToolbar: React.FC<NodeCanvasToolbarProps> = ({
  nodeId, bodyNodeIds, bodyGroupId, isVisible, listeners, attributes,
}) => {
  const { dispatch } = useEditor();

  const idx       = bodyNodeIds.indexOf(nodeId);
  const canMoveUp = idx > 0;
  const canMoveDn = idx < bodyNodeIds.length - 1;

  const moveUp = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const next = [...bodyNodeIds];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    dispatch({ type: 'REORDER_NODE_CHILDREN', parentId: bodyGroupId, orderedIds: next });
  }, [dispatch, bodyNodeIds, bodyGroupId, idx]);

  const moveDn = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const next = [...bodyNodeIds];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    dispatch({ type: 'REORDER_NODE_CHILDREN', parentId: bodyGroupId, orderedIds: next });
  }, [dispatch, bodyNodeIds, bodyGroupId, idx]);

  const remove = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch({ type: 'REMOVE_NODE', nodeId });
  }, [dispatch, nodeId]);

  const ToolBtn: React.FC<{
    onClick:   (e: React.MouseEvent) => void;
    title:     string;
    danger?:   boolean;
    disabled?: boolean;
    children:  React.ReactNode;
  }> = ({ onClick, title, danger, disabled, children }) => (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className="w-7 h-7 flex items-center justify-center rounded-md transition-colors disabled:opacity-30 disabled:pointer-events-none"
      style={{ color: danger ? 'var(--nx-error)' : 'rgba(255,255,255,0.85)' }}
      onMouseEnter={(e) => (e.currentTarget.style.background = danger ? 'rgba(244,63,94,0.15)' : 'rgba(255,255,255,0.1)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {children}
    </button>
  );

  return (
    <div
      className="absolute z-30 flex items-center gap-0.5 px-1 py-1 rounded-lg shadow-xl"
      style={{
        top: -36, right: 8,
        background:      'rgba(15,15,20,0.9)',
        border:          '1px solid rgba(255,255,255,0.08)',
        backdropFilter:  'blur(8px)',
        fontFamily:      "'Plus Jakarta Sans', sans-serif",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Drag handle inside toolbar (always accessible when section is selected) */}
      <button
        {...(attributes as any)}
        {...(listeners as any)}
        className="w-7 h-7 flex items-center justify-center rounded-md cursor-grab active:cursor-grabbing"
        style={{ color: 'rgba(255,255,255,0.6)' }}
        title="Drag to reorder"
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.95)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}
      >
        <GripVertical size={13} />
      </button>

      {/* Section label */}
      <span className="px-2 text-[10px] font-semibold" style={{ color: 'var(--nx-violet-400)' }}>
        {/* nodeId visible in toolbar for dev mode */}
        node
      </span>
      <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.1)', margin: '0 2px' }} />

      <ToolBtn onClick={moveUp}   title="Move up"   disabled={!canMoveUp}><ChevronUp   size={13} /></ToolBtn>
      <ToolBtn onClick={moveDn}   title="Move down" disabled={!canMoveDn}><ChevronDown  size={13} /></ToolBtn>
      {/* Duplicate — Phase 3+ */}
      <ToolBtn onClick={(e) => e.stopPropagation()} title="Duplicate (coming soon)" disabled>
        <Copy size={12} />
      </ToolBtn>

      <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.1)', margin: '0 2px' }} />
      <ToolBtn onClick={remove} title="Delete" danger><Trash2 size={12} /></ToolBtn>
    </div>
  );
};

// ─── NodeSectionWrapper ───────────────────────────────────────────────────────
// Interaction shell per body node — equivalent of SectionWrapper for node mode.
// Handles click (SELECT_NODE), hover (HOVER_NODE), selection outline,
// canvas drag handle, label chip, "insert +" button, and DnD.

interface NodeSectionWrapperProps {
  node:        Node;
  bodyNodeIds: string[];
  bodyGroupId: string;
}

const NodeSectionWrapper: React.FC<NodeSectionWrapperProps> = ({
  node, bodyNodeIds, bodyGroupId,
}) => {
  const { state, selectNode, hoverNode, dispatch } = useEditor();

  const isSelected    = state.selectedNodeId === node.id;
  const isHovered     = state.hoveredNodeId  === node.id;
  const isAnySelected = state.selectedNodeId !== null;
  const isSystem      = !!(node.settings._nx_isSystem);
  const isVisible     = node.visibility?.desktop !== false;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: `${NODE_CANVAS_PREFIX}:${node.id}`, disabled: isSystem });

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    selectNode(node.id);
  }, [selectNode, node.id]);

  return (
    <div
      ref={setNodeRef}
      onClick={handleClick}
      onMouseEnter={() => hoverNode(node.id)}
      onMouseLeave={() => hoverNode(null)}
      className="relative"
      style={{
        transform:     CSS.Transform.toString(transform),
        transition:    transition ?? 'all 150ms ease',
        opacity:       isDragging ? 0.4 : (!isVisible ? 0.4 : 1),
        zIndex:        isDragging ? 20 : undefined,
        outline:       isSelected
                         ? '2px solid var(--nx-violet-500)'
                         : isHovered && !isAnySelected
                         ? '1px dashed rgba(139,92,246,0.5)'
                         : 'none',
        outlineOffset: '-1px',
      }}
    >
      {/* Floating toolbar — visible when this node is selected */}
      {isSelected && (
        <NodeCanvasToolbar
          nodeId={node.id}
          bodyNodeIds={bodyNodeIds}
          bodyGroupId={bodyGroupId}
          isVisible={isVisible}
          listeners={listeners as Record<string, unknown> | undefined}
          attributes={attributes as Record<string, unknown>}
        />
      )}

      {/* Drag handle — top-left grip, shown on hover (nothing selected) */}
      {isHovered && !isAnySelected && !isSystem && (
        <button
          {...(attributes as any)}
          {...(listeners as any)}
          className="absolute top-2 z-30 flex items-center justify-center rounded cursor-grab active:cursor-grabbing"
          style={{
            left:       8,
            width:      22,
            height:     22,
            background: 'rgba(15,15,20,0.78)',
            border:     '1px solid rgba(255,255,255,0.12)',
            color:      'rgba(255,255,255,0.85)',
          }}
          onClick={(e) => e.stopPropagation()}
          title="Drag to reorder"
        >
          <GripVertical size={12} />
        </button>
      )}

      {/* Label chip (offset to the right of drag handle) */}
      {isHovered && !isAnySelected && (
        <div
          className="absolute top-0 z-20 pointer-events-none"
          style={{ left: isSystem ? 0 : 34 }}
        >
          <div
            className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-white shadow-md"
            style={{
              background:          'rgba(80,80,100,0.9)',
              borderBottomRightRadius: 4,
              fontFamily:          "'Plus Jakarta Sans', sans-serif",
            }}
          >
            {node.label ?? node.type}
          </div>
        </div>
      )}

      {/* Insert "+" — appears above section on hover when nothing is selected */}
      {isHovered && !isAnySelected && !isSystem && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-30">
          <button
            onClick={(e) => {
              e.stopPropagation();
              dispatch({ type: 'SHOW_SECTION_LIBRARY', insertAfter: node.id });
            }}
            className="w-7 h-7 rounded-full flex items-center justify-center shadow-lg transition-colors"
            style={{ background: 'var(--nx-violet-600)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--nx-violet-500)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--nx-violet-600)')}
          >
            <Plus size={14} className="text-white" />
          </button>
        </div>
      )}

      {/* Node content — rendered via TreeRenderer → NodeRenderer → registry */}
      <TreeRenderer tree={node} />
    </div>
  );
};

// ─── NodeCanvas ───────────────────────────────────────────────────────────────
// Top-level node-mode canvas. Replaces SimulatedCanvas rendering when nodeMode=true.

const NodeCanvas: React.FC = () => {
  const { state, dispatch } = useEditor();
  const { nodeTree, previewMode } = state;

  // Do not render if nodeTree is absent (should not happen when nodeMode=true, but safe)
  if (!nodeTree) return null;

  // Extract group nodes
  const bodyNodes   = getBodySections(nodeTree);
  const headerNodes = getHeaderSections(nodeTree);
  const footerNodes = getFooterSections(nodeTree);

  // Body node IDs for toolbar move-up/down and DnD SortableContext
  const bodyNodeIds   = bodyNodes.map((n) => n.id);
  const bodyGroupId   = (nodeTree.children ?? []).find(
    (g) => g.settings.handle === 'body',
  )?.id ?? `grp_body_${nodeTree.settings.pageId ?? 'page'}`;

  // DnD items use the canvas-node: prefix
  const sortableItems = useMemo(
    () => bodyNodeIds.map((id) => `${NODE_CANVAS_PREFIX}:${id}`),
    [bodyNodeIds],
  );

  const handleDeselect = useCallback(() => {
    dispatch({ type: 'DESELECT' });
  }, [dispatch]);

  return (
    <RenderContextProvider
      breakpoint={previewMode}
      isPreview={true}
    >
      <div
        className="bg-white min-h-full"
        onClick={handleDeselect}
        style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
      >
        {/* ── System header shell ──────────────────────────────────────────── */}
        {headerNodes.length > 0 && (
          <SystemSectionShell label="Header (system — edit in Header Builder)" icon={Menu}>
            {/* Minimal header placeholder when actual components cannot be rendered here */}
            <div
              className="bg-white border-b border-slate-100 px-6 py-3 flex items-center justify-between"
              style={{ minHeight: 60 }}
            >
              <span
                className="text-sm font-bold text-slate-400"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                ⚙ Header — {headerNodes.length} section{headerNodes.length !== 1 ? 's' : ''}
              </span>
              <span
                className="text-xs text-slate-300"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Edit via Storefront → Header Builder
              </span>
            </div>
          </SystemSectionShell>
        )}

        {/* ── Body sections ────────────────────────────────────────────────── */}
        <SortableContext items={sortableItems} strategy={verticalListSortingStrategy}>
          {bodyNodes.map((node) => (
            <NodeSectionWrapper
              key={node.id}
              node={node}
              bodyNodeIds={bodyNodeIds}
              bodyGroupId={bodyGroupId}
            />
          ))}
        </SortableContext>

        {bodyNodes.length === 0 && (
          <div className="py-16 flex flex-col items-center justify-center gap-3 text-center">
            <Layout size={28} className="text-slate-300" />
            <p
              className="text-[13px] font-medium text-slate-400"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              No sections yet
            </p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                dispatch({ type: 'SHOW_SECTION_LIBRARY', insertAfter: null });
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-dashed border-slate-200 hover:border-violet-300 text-slate-400 hover:text-violet-500 text-[13px] font-medium transition-all"
            >
              <Plus size={15} />
              Add first section
            </button>
          </div>
        )}

        {/* ── "Add section" at bottom when sections exist ───────────────────── */}
        {bodyNodes.length > 0 && !state.selectedNodeId && (
          <div className="py-8 flex items-center justify-center border-t border-slate-100">
            <button
              onClick={(e) => {
                e.stopPropagation();
                dispatch({
                  type:        'SHOW_SECTION_LIBRARY',
                  insertAfter: bodyNodeIds.at(-1) ?? null,
                });
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-dashed border-slate-200 hover:border-violet-300 text-slate-400 hover:text-violet-500 text-[13px] font-medium transition-all"
            >
              <Plus size={15} />
              Add section
            </button>
          </div>
        )}

        {/* ── System footer shell ──────────────────────────────────────────── */}
        {footerNodes.length > 0 && (
          <SystemSectionShell label="Footer (system — edit in Footer Builder)" icon={Layout}>
            <div
              className="bg-slate-900 px-6 py-4 flex items-center justify-between"
              style={{ minHeight: 60 }}
            >
              <span
                className="text-sm font-bold text-slate-500"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                ⚙ Footer — {footerNodes.length} section{footerNodes.length !== 1 ? 's' : ''}
              </span>
              <span
                className="text-xs text-slate-600"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Edit via Storefront → Footer Builder
              </span>
            </div>
          </SystemSectionShell>
        )}
      </div>
    </RenderContextProvider>
  );
};

export default NodeCanvas;
