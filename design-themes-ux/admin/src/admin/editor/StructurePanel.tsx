import React, { useState, useCallback, useRef, useEffect } from 'react';
import { toPlainText } from '@/utils/richText';
import {
  Layers, PlusCircle, Image as ImageIcon, Type, AlignLeft,
  MousePointer, Menu, ShoppingBag, Megaphone, Mail,
  FileText, ArrowRight, ChevronRight, ChevronDown,
  Eye, EyeOff, Trash2, Copy, Star, MoreHorizontal,
  Grid, Package, Palette, Settings, GripVertical,
  Box, Columns, Minus, MoveVertical,
} from 'lucide-react';
import {
  SortableContext, verticalListSortingStrategy, useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useEditor } from './EditorContext';
import {
  SaveAsSymbolModal, SymbolBadge,
  useSymbolHandle,
} from './SymbolModal';
import type { SectionDoc, BlockDoc } from './types';
// Phase 3: node-mode tree imports
import type { Node } from '@/components/node-renderer/types';
import {
  getBodySections,
  getHeaderSections,
  getFooterSections,
} from './adapters/pageDocNodeTree';

// ─── Node type classification ─────────────────────────────────────────────────

type NodeKind = 'section' | 'layout' | 'content' | 'data' | 'symbol';

function getNodeKind(type: string): NodeKind {
  if (['header', 'announcement_bar', 'footer', 'hero', 'featured_collection',
       'product_grid', 'newsletter', 'rich_text', 'blog', 'faq', 'testimonials'].includes(type)) {
    return 'section';
  }
  if (['product_card', 'heading', 'paragraph', 'text', 'button', 'image',
       'logo', 'menu', 'announcement', 'collection_title', 'view_all_button',
       'copyright', 'rich_text'].includes(type)) {
    return 'content';
  }
  if (['product_grid', 'collection_grid', 'collection_picker'].includes(type)) return 'data';
  return 'section';
}

const KIND_COLORS: Record<NodeKind, string> = {
  section: 'var(--nx-node-section)',
  layout:  'var(--nx-node-layout)',
  content: 'var(--nx-node-content)',
  data:    'var(--nx-node-data)',
  symbol:  'var(--nx-symbol)',
};

// ─── Node icon ────────────────────────────────────────────────────────────────

const SECTION_ICONS: Record<string, React.ElementType> = {
  announcement_bar:    Megaphone,
  header:              Menu,
  footer:              FileText,
  hero:                ImageIcon,
  featured_collection: Grid,
  product_grid:        Package,
  rich_text:           Type,
  newsletter:          Mail,
};

const BLOCK_ICONS: Record<string, React.ElementType> = {
  heading:          Type,
  paragraph:        AlignLeft,
  text:             AlignLeft,
  button:           MousePointer,
  image:            ImageIcon,
  logo:             ShoppingBag,
  menu:             Menu,
  announcement:     Megaphone,
  collection_title: Type,
  view_all_button:  ArrowRight,
  product_card:     ShoppingBag,
  copyright:        FileText,
};

// ─── Node type icons (Phase 3 — node mode) ───────────────────────────────────
// Maps ContentNode types to Lucide icons for the NodeRow component.
// Covers layout primitives, content primitives, legacy section types, and
// page-tree structure types introduced by the adapter layer.

const NODE_TYPE_ICONS: Record<string, React.ElementType> = {
  // Page structure (from pageDocNodeTree adapter)
  page_root:              Layers,
  page_group:             Layers,
  // Layout primitives
  container:              Box,
  stack:                  Layers,
  grid:                   Grid,
  columns:                Columns,
  carousel:               ArrowRight,
  spacer:                 MoveVertical,
  divider:                Minus,
  // Content primitives
  heading:                Type,
  text:                   AlignLeft,
  paragraph:              AlignLeft,
  richtext:               AlignLeft,
  rich_text:              AlignLeft,
  image:                  ImageIcon,
  button:                 MousePointer,
  // Commerce primitives
  product_grid:           Package,
  featured_collection:    Grid,
  collection_grid:        Grid,
  // Legacy section types
  hero:                   ImageIcon,
  announcement_bar:       Megaphone,
  header:                 Menu,
  footer:                 FileText,
  newsletter:             Mail,
  brand_story:            Type,
  editorial_banner:       Star,
  collection_circles:     Grid,
  product_mosaic:         ImageIcon,
  trust_badges_bar:       ShoppingBag,
};

// ─── Block label ──────────────────────────────────────────────────────────────

function blockLabel(block: BlockDoc): string {
  const text = toPlainText(block.settings.text).trim();
  switch (block.type) {
    case 'heading':      return text ? (text.length > 22 ? text.slice(0, 22) + '…' : text) : 'Heading';
    case 'button':       return block.settings.label || 'Button';
    case 'menu':         return block.settings.menuHandle ? `Menu — ${block.settings.menuHandle.replace('main-', '')}` : 'Navigation';
    case 'collection_title': return block.settings.text || 'Collection title';
    case 'view_all_button':  return block.settings.label || 'View all';
    case 'copyright':    return 'Copyright';
    default:             return block.type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

// ─── Node popover menu ────────────────────────────────────────────────────────

const NodeMenu: React.FC<{
  isSystem:    boolean;
  isVisible:   boolean;
  sectionId:   string;
  sectionType: string;
  onToggle:    () => void;
  onDelete?:   () => void;
  onDupe?:     () => void;
}> = ({ isSystem, isVisible, sectionId, sectionType, onToggle, onDelete, onDupe }) => {
  const [open,        setOpen]        = useState(false);
  const [showSymbol,  setShowSymbol]  = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  return (
    <>
      <div ref={ref} className="relative shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
          className="w-6 h-6 flex items-center justify-center rounded-md transition-colors opacity-0 group-hover:opacity-100"
          style={{ color: 'var(--nx-text-400)' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--nx-float)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <MoreHorizontal size={12} />
        </button>
        {open && (
          <div
            className="absolute right-0 top-[calc(100%+4px)] w-48 rounded-xl shadow-2xl z-50 py-1 overflow-hidden"
            style={{ background: 'var(--nx-float)', border: '1px solid var(--nx-border-2)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => { onToggle(); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors"
              style={{ fontSize: 12, color: 'var(--nx-text-600)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--nx-overlay)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {isVisible ? <EyeOff size={13} /> : <Eye size={13} />}
              {isVisible ? 'Hide layer' : 'Show layer'}
            </button>
            {onDupe && (
              <button
                onClick={() => { onDupe(); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors"
                style={{ fontSize: 12, color: 'var(--nx-text-600)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--nx-overlay)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <Copy size={13} /> Duplicate
              </button>
            )}
            <button
              onClick={() => { setShowSymbol(true); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors"
              style={{ fontSize: 12, color: '#EC4899' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(236,72,153,0.08)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <Star size={13} /> Save as symbol
            </button>
            {!isSystem && onDelete && (
              <>
                <div style={{ height: 1, background: 'var(--nx-border-1)', margin: '4px 12px' }} />
                <button
                  onClick={() => { onDelete(); setOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors"
                  style={{ fontSize: 12, color: 'var(--nx-error)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(244,63,94,0.08)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <Trash2 size={13} /> Delete
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Save as symbol modal */}
      <SaveAsSymbolModal
        open={showSymbol}
        sectionId={sectionId}
        sectionType={sectionType}
        onClose={() => setShowSymbol(false)}
      />
    </>
  );
};

// ─── Block row ────────────────────────────────────────────────────────────────

const BlockRow: React.FC<{ block: BlockDoc; section: SectionDoc; depth: number }> = ({ block, section, depth }) => {
  const { state, dispatch, selectBlock } = useEditor();
  const isSelected = state.selection.blockId === block.id;
  const kind  = getNodeKind(block.type);
  const Icon  = BLOCK_ICONS[block.type] ?? FileText;
  const color = KIND_COLORS[kind];

  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: `layer-block:${block.id}` });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? 10 : undefined,
        position: 'relative',
      }}
    >
      <div
        onClick={(e) => { e.stopPropagation(); selectBlock(section.id, block.id, section.groupHandle); }}
        onMouseEnter={() => dispatch({ type: 'HOVER_BLOCK', blockId: block.id })}
        onMouseLeave={() => dispatch({ type: 'HOVER_BLOCK', blockId: null })}
        className="group relative flex items-center gap-2 cursor-pointer select-none rounded-md mx-1"
        style={{
          padding: '4px 6px',
          paddingLeft: 8 + depth * 14,
          background: isSelected ? 'var(--nx-violet-bg)' : 'transparent',
          borderLeft: isSelected ? '2px solid var(--nx-violet-500)' : '2px solid transparent',
        }}
        onMouseEnterCapture={(e) => {
          if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--nx-raised)';
        }}
        onMouseLeaveCapture={(e) => {
          if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent';
        }}
      >
        {/* Visibility fade */}
        {!block.isVisible && <div className="absolute inset-0 rounded-md" style={{ background: 'rgba(0,0,0,0.4)', pointerEvents: 'none' }} />}

        <Icon size={11} className="shrink-0" style={{ color: isSelected ? 'var(--nx-violet-400)' : color }} />

        <span
          className="flex-1 truncate leading-none"
          style={{
            fontSize: 12,
            fontWeight: isSelected ? 500 : 400,
            color: isSelected ? 'var(--nx-violet-400)' : 'var(--nx-text-600)',
          }}
        >
          {blockLabel(block)}
        </span>

        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="shrink-0 w-5 h-5 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
          style={{ color: 'var(--nx-text-400)' }}
          tabIndex={-1}
          onClick={(e) => e.stopPropagation()}
          title="Drag to reorder"
        >
          <GripVertical size={11} />
        </button>

        <NodeMenu
          isSystem={false}
          isVisible={block.isVisible}
          sectionId={block.id}
          sectionType={block.type}
          onToggle={() => dispatch({ type: 'TOGGLE_BLOCK_VISIBILITY', blockId: block.id, sectionId: section.id })}
          onDelete={() => dispatch({ type: 'REMOVE_BLOCK', sectionId: section.id, blockId: block.id })}
        />
      </div>
    </div>
  );
};

// ─── Automatic label derivation ──────────────────────────────────────────────
// When a section has a collection/product/menu binding, the layers panel
// automatically appends the bound resource name so repeated sections of the
// same type are distinguishable without the merchant having to rename them.
//
// Before binding:  "Featured Collection"
// After binding:   "Featured Collection — New Arrivals"
//
// The _collectionLabel / _productLabel / _menuLabel values are written to
// section.settings by the respective picker fields when the merchant selects.
// They are display-only metadata; they have no effect on rendering.

function deriveSectionLabel(section: SectionDoc): string {
  const s    = section.settings;
  const base = section.label;

  // Collection binding
  const colLabel = s._collectionLabel as string | undefined;
  if (colLabel && colLabel.trim()) return `${base} — ${colLabel.trim()}`;

  // Product binding
  const prodLabel = s._productLabel as string | undefined;
  if (prodLabel && prodLabel.trim()) return `${base} — ${prodLabel.trim()}`;

  // Menu binding
  const menuLabel = s._menuLabel as string | undefined;
  if (menuLabel && menuLabel.trim()) return `${base} — ${menuLabel.trim()}`;

  return base;
}

// ─── Section row ──────────────────────────────────────────────────────────────

const SectionRow: React.FC<{ section: SectionDoc; depth?: number }> = ({ section, depth = 0 }) => {
  const { state, dispatch, selectSection } = useEditor();
  const isSelected   = state.selection.sectionId === section.id && state.selection.blockId === null;
  const isExpanded   = state.expandedNodes.has(section.id);
  const hasBlocks    = section.blocks.length > 0;
  const kind         = getNodeKind(section.type);
  const Icon         = SECTION_ICONS[section.type] ?? Layers;
  const color        = KIND_COLORS[kind];
  const symbolHandle = useSymbolHandle(section.id);
  const isSystem     = section.isSystem ?? false;

  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: `layer:${section.id}`, disabled: isSystem });

  const toggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch({ type: 'TOGGLE_NODE', nodeId: section.id });
  }, [dispatch, section.id]);

  const select = useCallback(() => {
    selectSection(section.id, section.groupHandle);
    if (!isExpanded) dispatch({ type: 'EXPAND_NODE', nodeId: section.id });
  }, [selectSection, dispatch, section.id, section.groupHandle, isExpanded]);

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? 10 : undefined,
        position: 'relative',
      }}
    >
      <div
        onClick={select}
        onMouseEnter={() => dispatch({ type: 'HOVER_SECTION', sectionId: section.id })}
        onMouseLeave={() => dispatch({ type: 'HOVER_SECTION', sectionId: null })}
        className="group relative flex items-center gap-2 cursor-pointer select-none rounded-md mx-1"
        style={{
          padding: '5px 6px',
          paddingLeft: 6 + depth * 14,
          background: isSelected ? 'var(--nx-violet-bg)' : 'transparent',
          borderLeft: isSelected ? '2px solid var(--nx-violet-500)' : '2px solid transparent',
          opacity: !section.isVisible ? 0.45 : 1,
        }}
        onMouseEnterCapture={(e) => {
          if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--nx-raised)';
        }}
        onMouseLeaveCapture={(e) => {
          if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent';
        }}
      >
        {/* Chevron toggle */}
        <button
          onClick={toggle}
          className="shrink-0 w-4 h-4 flex items-center justify-center rounded transition-colors"
          style={{
            opacity: hasBlocks ? 1 : 0,
            pointerEvents: hasBlocks ? 'auto' : 'none',
          }}
        >
          {isExpanded
            ? <ChevronDown size={11} style={{ color: 'var(--nx-text-400)' }} />
            : <ChevronRight size={11} style={{ color: 'var(--nx-text-400)' }} />}
        </button>

        {/* Type icon chip */}
        <div
          className="shrink-0 w-[18px] h-[18px] rounded-[4px] flex items-center justify-center"
          style={{ background: isSelected ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.05)' }}
        >
          <Icon size={11} style={{ color: isSelected ? 'var(--nx-violet-400)' : color }} />
        </div>

        {/* Label — auto-derived from binding when available */}
        <span
          className="flex-1 truncate leading-none"
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: isSelected ? 'var(--nx-violet-400)' : 'var(--nx-text-900)',
          }}
        >
          {deriveSectionLabel(section)}
        </span>

        {/* Symbol badge */}
        {symbolHandle && <SymbolBadge handle={symbolHandle} />}

        {/* Drag handle — hidden for system sections (header/footer) */}
        {!isSystem && (
          <button
            {...attributes}
            {...listeners}
            className="shrink-0 w-5 h-5 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
            style={{ color: 'var(--nx-text-400)' }}
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            title="Drag to reorder"
          >
            <GripVertical size={12} />
          </button>
        )}

        <NodeMenu
          isSystem={isSystem}
          isVisible={section.isVisible}
          sectionId={section.id}
          sectionType={section.type}
          onToggle={() => dispatch({ type: 'TOGGLE_SECTION_VISIBILITY', sectionId: section.id })}
          onDelete={!isSystem ? () => dispatch({ type: 'REMOVE_SECTION', sectionId: section.id }) : undefined}
        />
      </div>

      {/* Expanded children — each section's blocks get their own SortableContext */}
      {isExpanded && hasBlocks && (
        <SortableContext items={section.blocks.map((b) => `layer-block:${b.id}`)} strategy={verticalListSortingStrategy}>
          <div>
            {section.blocks.map((block) => (
              <BlockRow key={block.id} block={block} section={section} depth={depth + 1} />
            ))}
            <button
              className="flex items-center gap-1.5 rounded-md transition-colors mx-1"
              style={{
                fontSize: 11, color: 'var(--nx-text-400)',
                padding: '4px 6px', paddingLeft: 6 + (depth + 1) * 14 + 15,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--nx-violet-400)'; e.currentTarget.style.background = 'var(--nx-raised)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--nx-text-400)'; e.currentTarget.style.background = 'transparent'; }}
            >
              <PlusCircle size={11} /> Add element
            </button>
          </div>
        </SortableContext>
      )}
    </div>
  );
};

// ─── Phase 3: Node mode components ───────────────────────────────────────────
// These are only rendered when state.nodeMode === true.
// All legacy SectionRow / BlockRow code above is untouched.

// DnD prefix for layer-panel node items — distinct from all legacy prefixes.
const LAYER_NODE_PREFIX = 'layer-node' as const;

// ─── NodeActionMenu ───────────────────────────────────────────────────────────
// Simplified context menu for ContentNode rows — visibility + delete.
// Replaces the legacy NodeMenu (which is SectionDoc-specific) in node mode.

const NodeActionMenu: React.FC<{
  nodeId:    string;
  isSystem:  boolean;
  isVisible: boolean;
}> = ({ nodeId, isSystem, isVisible }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { dispatch } = useEditor();

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="w-6 h-6 flex items-center justify-center rounded-md transition-colors opacity-0 group-hover:opacity-100"
        style={{ color: 'var(--nx-text-400)' }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--nx-float)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <MoreHorizontal size={12} />
      </button>
      {open && (
        <div
          className="absolute right-0 top-[calc(100%+4px)] w-44 rounded-xl shadow-2xl z-50 py-1 overflow-hidden"
          style={{ background: 'var(--nx-float)', border: '1px solid var(--nx-border-2)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => { dispatch({ type: 'TOGGLE_NODE_VISIBILITY', nodeId }); setOpen(false); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors"
            style={{ fontSize: 12, color: 'var(--nx-text-600)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--nx-overlay)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            {isVisible ? <EyeOff size={13} /> : <Eye size={13} />}
            {isVisible ? 'Hide layer' : 'Show layer'}
          </button>
          {!isSystem && (
            <>
              <div style={{ height: 1, background: 'var(--nx-border-1)', margin: '4px 12px' }} />
              <button
                onClick={() => { dispatch({ type: 'REMOVE_NODE', nodeId }); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors"
                style={{ fontSize: 12, color: 'var(--nx-error)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(244,63,94,0.08)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <Trash2 size={13} /> Delete
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ─── NodeRow ──────────────────────────────────────────────────────────────────
// Recursive layer row for ContentNode trees.
// Each row renders the node header + its children (when expanded).
// Children are wrapped in their own SortableContext so nested reordering works.
//
// DnD data shape: useSortable data includes { parentId } so onDragEnd in
// ThemeEditor.tsx can dispatch REORDER_NODE_CHILDREN without a tree traversal.

interface NodeRowProps {
  node:     Node;
  parentId: string;    // id of the parent node — passed as dnd data
  depth?:   number;
}

const NodeRow: React.FC<NodeRowProps> = ({ node, parentId, depth = 0 }) => {
  const { state, selectNode, hoverNode } = useEditor();

  const isSelected  = state.selectedNodeId === node.id;
  const isExpanded  = state.expandedNodes.has(node.id);
  const hasChildren = (node.children?.length ?? 0) > 0;
  const isSystem    = !!(node.settings._nx_isSystem);
  const isVisible   = node.visibility?.desktop !== false;
  const Icon        = NODE_TYPE_ICONS[node.type] ?? Layers;

  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({
    id:       `${LAYER_NODE_PREFIX}:${node.id}`,
    disabled: isSystem,
    data:     { parentId },   // consumed by ThemeEditor.handleDragEnd
  });

  const { dispatch } = useEditor();

  const toggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch({ type: 'TOGGLE_NODE', nodeId: node.id });
  }, [dispatch, node.id]);

  const select = useCallback(() => {
    selectNode(node.id);
    if (!isExpanded && hasChildren) {
      dispatch({ type: 'EXPAND_NODE', nodeId: node.id });
    }
  }, [selectNode, dispatch, node.id, isExpanded, hasChildren]);

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity:   isDragging ? 0.4 : 1,
        zIndex:    isDragging ? 10 : undefined,
        position:  'relative',
      }}
    >
      {/* ── Row ─────────────────────────────────────────────────────────── */}
      <div
        onClick={select}
        onMouseEnter={() => hoverNode(node.id)}
        onMouseLeave={() => hoverNode(null)}
        className="group relative flex items-center gap-2 cursor-pointer select-none rounded-md mx-1"
        style={{
          padding:     '5px 6px',
          paddingLeft: 6 + depth * 14,
          background:  isSelected ? 'var(--nx-violet-bg)' : 'transparent',
          borderLeft:  isSelected ? '2px solid var(--nx-violet-500)' : '2px solid transparent',
          opacity:     !isVisible ? 0.45 : 1,
        }}
        onMouseEnterCapture={(e) => {
          if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--nx-raised)';
        }}
        onMouseLeaveCapture={(e) => {
          if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent';
        }}
      >
        {/* Chevron toggle */}
        <button
          onClick={toggle}
          className="shrink-0 w-4 h-4 flex items-center justify-center rounded transition-colors"
          style={{
            opacity:       hasChildren ? 1 : 0,
            pointerEvents: hasChildren ? 'auto' : 'none',
          }}
        >
          {isExpanded
            ? <ChevronDown  size={11} style={{ color: 'var(--nx-text-400)' }} />
            : <ChevronRight size={11} style={{ color: 'var(--nx-text-400)' }} />}
        </button>

        {/* Type icon chip */}
        <div
          className="shrink-0 w-[18px] h-[18px] rounded-[4px] flex items-center justify-center"
          style={{ background: isSelected ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.05)' }}
        >
          <Icon
            size={11}
            style={{ color: isSelected ? 'var(--nx-violet-400)' : 'var(--nx-text-400)' }}
          />
        </div>

        {/* Label */}
        <span
          className="flex-1 truncate leading-none"
          style={{
            fontSize:   13,
            fontWeight: 500,
            color: isSelected ? 'var(--nx-violet-400)' : 'var(--nx-text-900)',
          }}
        >
          {node.label ?? node.type}
        </span>

        {/* System badge */}
        {isSystem && (
          <span
            className="shrink-0 px-1 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--nx-text-400)' }}
          >
            sys
          </span>
        )}

        {/* Drag handle — hidden for system nodes */}
        {!isSystem && (
          <button
            {...attributes}
            {...listeners}
            className="shrink-0 w-5 h-5 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
            style={{ color: 'var(--nx-text-400)' }}
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            title="Drag to reorder"
          >
            <GripVertical size={12} />
          </button>
        )}

        {/* Context menu */}
        <NodeActionMenu nodeId={node.id} isSystem={isSystem} isVisible={isVisible} />
      </div>

      {/* ── Expanded children ──────────────────────────────────────────── */}
      {isExpanded && hasChildren && (
        <SortableContext
          items={(node.children ?? []).map((c) => `${LAYER_NODE_PREFIX}:${c.id}`)}
          strategy={verticalListSortingStrategy}
        >
          <div>
            {node.children!.map((child) => (
              <NodeRow
                key={child.id}
                node={child}
                parentId={node.id}    // this node is the parent of its children
                depth={depth + 1}
              />
            ))}
          </div>
        </SortableContext>
      )}
    </div>
  );
};

// ─── NodeTreeFlyout ───────────────────────────────────────────────────────────
// Renders the Layers fly-out content when nodeMode is active.
// Structure mirrors the legacy LayersFlyout:
//   Global (header) → Page (body sections) → Global (footer)

const NodeTreeFlyout: React.FC<{ nodeTree: Node }> = ({ nodeTree }) => {
  const { dispatch } = useEditor();

  const headerNodes  = getHeaderSections(nodeTree);
  const bodyNodes    = getBodySections(nodeTree);
  const footerNodes  = getFooterSections(nodeTree);
  const bodyGroupId  = (nodeTree.children ?? []).find(
    (g) => g.settings.handle === 'body',
  )?.id ?? `grp_body_${nodeTree.settings.pageId ?? 'page'}`;
  const lastBodyId   = bodyNodes.at(-1)?.id ?? null;
  const pageTitle    = nodeTree.settings.pageTitle as string | undefined ?? 'Page';

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2.5 shrink-0"
        style={{ borderBottom: '1px solid var(--nx-border-1)' }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--nx-text-900)' }}>Layers</span>
        <button
          onClick={() => dispatch({ type: 'SHOW_SECTION_LIBRARY', insertAfter: null })}
          className="flex items-center gap-1 px-2 py-1 rounded-lg transition-colors"
          style={{ fontSize: 11, fontWeight: 600, color: 'var(--nx-violet-400)', background: 'rgba(139,92,246,0.1)' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(139,92,246,0.18)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(139,92,246,0.1)')}
        >
          <PlusCircle size={11} /> Insert
        </button>
      </div>

      {/* Scrollable node tree */}
      <div className="flex-1 overflow-y-auto py-1">

        {/* Global: header system nodes (not sortable) */}
        {headerNodes.length > 0 && (
          <>
            <GroupLabel label="Global" />
            {headerNodes.map((n) => (
              <NodeRow key={n.id} node={n} parentId={bodyGroupId} depth={0} />
            ))}
          </>
        )}

        {/* Page body — sortable */}
        <GroupLabel label={pageTitle} />
        <SortableContext
          items={bodyNodes.map((n) => `${LAYER_NODE_PREFIX}:${n.id}`)}
          strategy={verticalListSortingStrategy}
        >
          {bodyNodes.map((n) => (
            <NodeRow key={n.id} node={n} parentId={bodyGroupId} depth={0} />
          ))}
        </SortableContext>

        <InsertStrip insertAfter={lastBodyId} />

        {/* Global: footer system nodes (not sortable) */}
        {footerNodes.length > 0 && (
          <>
            <GroupLabel label="Global" />
            {footerNodes.map((n) => (
              <NodeRow key={n.id} node={n} parentId={bodyGroupId} depth={0} />
            ))}
          </>
        )}

        <div style={{ height: 24 }} />
      </div>
    </div>
  );
};

// ─── Group divider ────────────────────────────────────────────────────────────

const GroupLabel: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex items-center gap-2 px-3 pt-4 pb-1.5">
    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--nx-text-400)' }}>
      {label}
    </span>
    <div className="flex-1" style={{ height: 1, background: 'var(--nx-border-1)' }} />
  </div>
);

// ─── Insert strip ─────────────────────────────────────────────────────────────

const InsertStrip: React.FC<{ insertAfter: string | null }> = ({ insertAfter }) => {
  const { dispatch } = useEditor();
  return (
    <div className="px-2 py-2">
      <button
        onClick={() => dispatch({ type: 'SHOW_SECTION_LIBRARY', insertAfter })}
        className="w-full flex items-center gap-2 rounded-lg transition-all"
        style={{
          padding: '8px 10px',
          border: '1px dashed var(--nx-border-2)',
          color: 'var(--nx-text-400)',
          fontSize: 12,
          fontWeight: 500,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--nx-violet-500)';
          e.currentTarget.style.color = 'var(--nx-violet-400)';
          e.currentTarget.style.background = 'var(--nx-violet-bg)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--nx-border-2)';
          e.currentTarget.style.color = 'var(--nx-text-400)';
          e.currentTarget.style.background = 'transparent';
        }}
      >
        <PlusCircle size={13} />
        Insert layer
      </button>
    </div>
  );
};

// ─── Layers fly-out content ───────────────────────────────────────────────────

const LayersFlyout: React.FC = () => {
  const { state, dispatch } = useEditor();
  const { pageDoc } = state;

  // ── Phase 3: node mode — render recursive Node tree ──────────────────────
  // When CONTENT_NODE_ENABLED is ON (nodeMode: true), bypass the SectionDoc
  // tree entirely and render NodeTreeFlyout instead.
  if (state.nodeMode && state.nodeTree) {
    return <NodeTreeFlyout nodeTree={state.nodeTree} />;
  }

  // ── Legacy SectionDoc path (unchanged below) ──────────────────────────────
  // DndContext lives in EditorLayout (ThemeEditor.tsx) — shared across both
  // the Layers panel and the Canvas so cross-panel drag works correctly.

  if (!pageDoc) {
    return (
      <div className="p-3 space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-8 rounded-lg animate-pulse" style={{ background: 'var(--nx-raised)', animationDelay: `${i * 80}ms` }} />
        ))}
      </div>
    );
  }

  const lastSection = pageDoc.sections[pageDoc.sections.length - 1];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 shrink-0"
        style={{ borderBottom: '1px solid var(--nx-border-1)' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--nx-text-900)' }}>Layers</span>
        <button
          onClick={() => dispatch({ type: 'SHOW_SECTION_LIBRARY', insertAfter: null })}
          className="flex items-center gap-1 px-2 py-1 rounded-lg transition-colors"
          style={{ fontSize: 11, fontWeight: 600, color: 'var(--nx-violet-400)', background: 'rgba(139,92,246,0.1)' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(139,92,246,0.18)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(139,92,246,0.1)')}
        >
          <PlusCircle size={11} /> Insert
        </button>
      </div>

      {/* Scrollable tree — SortableContext registers drop zones into the shared
          DndContext provided by EditorLayout, enabling cross-panel drag */}
      <div className="flex-1 overflow-y-auto py-1">
        {/* GLOBAL: header — not sortable */}
        {pageDoc.groups.header && (
          <>
            <GroupLabel label="Global" />
            {pageDoc.groups.header.sections.map((s) => <SectionRow key={s.id} section={s} />)}
          </>
        )}

        {/* PAGE TEMPLATE — sortable */}
        <GroupLabel label={`${pageDoc.pageTitle ?? 'Page'}`} />
        <SortableContext items={pageDoc.sections.map((s) => `layer:${s.id}`)} strategy={verticalListSortingStrategy}>
          {pageDoc.sections.map((section) => (
            <SectionRow key={section.id} section={section} />
          ))}
        </SortableContext>
        <InsertStrip insertAfter={lastSection?.id ?? null} />

        {/* GLOBAL: footer — not sortable */}
        {pageDoc.groups.footer && (
          <>
            <GroupLabel label="Global" />
            {pageDoc.groups.footer.sections.map((s) => <SectionRow key={s.id} section={s} />)}
          </>
        )}

        <div style={{ height: 24 }} />
      </div>
    </div>
  );
};

// ─── Rail icon button ─────────────────────────────────────────────────────────

const RailTab: React.FC<{
  icon:     React.ElementType;
  label:    string;
  active:   boolean;
  onClick:  () => void;
  pinBottom?:boolean;
}> = ({ icon: Icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    title={label}
    className="relative w-12 h-12 flex items-center justify-center transition-colors shrink-0"
    style={{
      color: active ? 'var(--nx-violet-400)' : 'var(--nx-text-400)',
      background: active ? 'var(--nx-violet-bg)' : 'transparent',
      borderRight: active ? '2px solid var(--nx-violet-500)' : '2px solid transparent',
    }}
    onMouseEnter={(e) => {
      if (!active) {
        (e.currentTarget as HTMLElement).style.color = 'var(--nx-text-900)';
        (e.currentTarget as HTMLElement).style.background = 'var(--nx-raised)';
      }
    }}
    onMouseLeave={(e) => {
      if (!active) {
        (e.currentTarget as HTMLElement).style.color = 'var(--nx-text-400)';
        (e.currentTarget as HTMLElement).style.background = 'transparent';
      }
    }}
  >
    <Icon size={16} />
  </button>
);

// ─── Main StructurePanel (rail + inline fly-out — no absolute positioning) ────

type RailTabId = 'layers' | 'tokens' | 'settings' | null;

const StructurePanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<RailTabId>('layers');

  const toggleTab = useCallback((tab: RailTabId) => {
    setActiveTab((prev) => (prev === tab ? null : tab));
  }, []);

  return (
    // Flex ROW: rail sits left, fly-out panel sits right as normal flow sibling.
    // Width is self-determined: 48px (rail only) or 328px (rail + fly-out).
    // No absolute positioning — the canvas naturally sits to the right of this.
    <div className="flex flex-row h-full" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* 48px icon rail */}
      <div
        data-rail
        className="flex flex-col h-full justify-between shrink-0"
        style={{
          width: 48,
          background: 'var(--nx-base)',
          borderRight: activeTab ? '1px solid var(--nx-border-1)' : 'none',
        }}
      >
        <div className="flex flex-col">
          <RailTab icon={Layers}    label="Layers"   active={activeTab === 'layers'}   onClick={() => toggleTab('layers')} />
          <RailTab icon={Grid}      label="Insert"   active={false}                     onClick={() => {}} />
          <RailTab icon={ImageIcon} label="Assets"   active={false}                     onClick={() => {}} />
          <RailTab icon={Palette}   label="Tokens"   active={activeTab === 'tokens'}   onClick={() => toggleTab('tokens')} />
        </div>
        <div className="flex flex-col">
          <RailTab icon={Settings}  label="Settings" active={activeTab === 'settings'} onClick={() => toggleTab('settings')} />
        </div>
      </div>

      {/* Fly-out panel — inline, normal flow, opens to the right of rail */}
      {activeTab && (
        <div
          className="flex flex-col overflow-hidden shrink-0"
          style={{
            width: 280,
            background: 'var(--nx-raised)',
          }}
        >
          {activeTab === 'layers'   && <LayersFlyout />}
          {activeTab === 'tokens'   && (
            <div className="p-4 pt-6">
              <p style={{ fontSize: 13, color: 'var(--nx-text-400)' }}>Tokens panel — coming soon</p>
            </div>
          )}
          {activeTab === 'settings' && (
            <div className="p-4 pt-6">
              <p style={{ fontSize: 13, color: 'var(--nx-text-400)' }}>Page settings — coming soon</p>
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default StructurePanel;
