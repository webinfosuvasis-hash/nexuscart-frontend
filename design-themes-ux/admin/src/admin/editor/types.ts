// Phase 1: Node type import for nodeTree / nodeMode state
import type { Node } from '@/components/node-renderer/types';

// ─── Core document types ────────────────────────────────────────────────────

export interface BlockDoc {
  id:         string;
  type:       string;
  settings:   Record<string, any>;
  isVisible:  boolean;
  isRequired?: boolean;
  sortOrder:  number;
}

export interface SectionDoc {
  id:         string;
  type:       string;
  label:      string;
  settings:   Record<string, any>;
  blocks:     BlockDoc[];
  isVisible:  boolean;
  isSystem?:  boolean;   // Header/Footer — cannot be deleted
  groupHandle?: string;  // 'header' | 'footer' when inside a group
}

export interface SectionGroupDoc {
  groupId:  string;
  handle:   'header' | 'footer' | string;
  sections: SectionDoc[];
}

export interface PageDoc {
  pageId:   string;
  pageTitle: string;
  themeId:  string;
  groups: {
    header?: SectionGroupDoc;
    footer?: SectionGroupDoc;
  };
  sections: SectionDoc[];   // page-specific (template)
}

// ─── Definition types (schema-driven) ───────────────────────────────────────

export type FieldType =
  | 'text' | 'textarea' | 'rich_text' | 'liquid'
  | 'number' | 'range'
  | 'color' | 'color_scheme'
  | 'image' | 'video_url'
  | 'select' | 'radio' | 'toggle' | 'checkbox_group'
  | 'url' | 'menu_picker' | 'collection_picker' | 'product_picker' | 'category_picker'
  | 'page_picker' | 'blog_picker' | 'font_picker'
  | 'padding' | 'alignment' | 'spacing'
  | 'dynamic_source';

export interface ConditionRule {
  field:    string;
  operator: 'eq' | 'neq' | 'truthy' | 'falsy' | 'gt' | 'lt';
  value?:   any;
}

export interface FieldOption {
  label: string;
  value: string;
  icon?: string;
}

export interface SettingField {
  key:          string;
  label:        string;
  type:         FieldType;
  group?:       string;
  groupIcon?:   string;
  default?:     any;
  required?:    boolean;
  condition?:   ConditionRule;
  helpText?:    string;
  placeholder?: string;
  options?:     FieldOption[];
  min?:         number;
  max?:         number;
  step?:        number;
  unit?:        string;
  maxLength?:   number;   // plain-text character limit (enforced server-side)
  maxSize?:     number;
  formats?:     string[];
  rows?:        number;
  allowedTags?: string[];
  /**
   * Tiptap editor mode for rich_text fields.
   * 'inline' — bold/italic/underline/link only (heading, announcement)
   * 'block'  — full formatting including headings, lists (paragraph)
   * Defaults to 'inline' when omitted.
   */
  richTextMode?: 'inline' | 'block';
}

export interface SectionDefinition {
  type:              string;
  name:              string;
  icon:              string;      // Lucide icon name
  description:       string;
  category:          string;
  tier:              'free' | 'premium' | 'custom';
  settingsSchema:    SettingField[];
  allowedBlockTypes: string[];   // ['*'] = all
  defaultBlocks:     Omit<BlockDoc, 'id'>[];
  previewImage?:     string;
}

export interface BlockDefinition {
  type:              string;
  name:              string;
  icon:              string;
  description:       string;
  settingsSchema:    SettingField[];
  allowedInSections: string[];   // ['*'] = all
  isRequired:        boolean;
  maxPerSection?:    number;
  tier:              'free' | 'premium' | 'custom';
}

// ─── Editor state ────────────────────────────────────────────────────────────

export type SelectionType = 'none' | 'section' | 'block';
export type PreviewMode   = 'desktop' | 'tablet' | 'mobile';

export interface Selection {
  type:        SelectionType;
  sectionId:   string | null;
  blockId:     string | null;
  groupHandle: string | null;
}

export interface EditorState {
  // ── Legacy SectionDoc path (always present, unchanged) ───────────────────
  pageDoc:              PageDoc | null;
  selection:            Selection;
  previewMode:          PreviewMode;
  /** Which breakpoint settings writes target. Same as previewMode
   *  but explicit — desktop = base settings, tablet/mobile = responsive.* overlay. */
  activeBreakpoint:     PreviewMode;
  isDirty:              boolean;
  isSaving:             boolean;
  expandedNodes:        Set<string>;
  showSectionLibrary:   boolean;
  insertAfterSectionId: string | null;
  hoverSectionId:       string | null;
  hoverBlockId:         string | null;
  activePage:           string;
  activeTheme:          string;
  themeColors:          Record<string, string>;

  // ── Phase 1: ContentNode path ─────────────────────────────────────────────
  // These fields are inactive (nodeMode: false) until CONTENT_NODE_ENABLED is
  // turned ON for the store. The legacy path above continues to work unchanged.

  /** True when the store's CONTENT_NODE_ENABLED flag is ON.
   *  Set by SET_NODE_TREE; reset to false by SET_ACTIVE_PAGE. */
  nodeMode:             boolean;

  /** Root 'page_root' Node tree (null in legacy mode). */
  nodeTree:             Node | null;

  /** The id of the currently selected Node in node mode.
   *  Equivalent of selection.sectionId / selection.blockId combined. */
  selectedNodeId:       string | null;

  /** The id of the currently hovered Node in node mode. */
  hoveredNodeId:        string | null;

  /**
   * Optimistic concurrency token for the DRAFT PageDocument.
   *
   * - Starts at 0 (no document loaded yet / document does not exist).
   * - Set to the server's version after loadPageDocument() or savePageDocument().
   * - Must be sent on every savePageDocument() call.
   * - If server version !== client version → 409 Conflict → reload required.
   */
  nodeDocumentVersion:  number;
}

export type EditorAction =
  | { type: 'SET_PAGE_DOC';     payload: PageDoc }
  | { type: 'SELECT_SECTION';   sectionId: string; groupHandle?: string }
  | { type: 'SELECT_BLOCK';     sectionId: string; blockId: string; groupHandle?: string }
  | { type: 'DESELECT' }
  | { type: 'HOVER_SECTION';    sectionId: string | null }
  | { type: 'HOVER_BLOCK';      blockId: string | null }
  | { type: 'SET_PREVIEW_MODE'; mode: PreviewMode }
  | { type: 'TOGGLE_NODE';      nodeId: string }
  | { type: 'EXPAND_NODE';      nodeId: string }
  | { type: 'SHOW_SECTION_LIBRARY'; insertAfter: string | null }
  | { type: 'HIDE_SECTION_LIBRARY' }
  | { type: 'SET_SAVING';       value: boolean }
  | { type: 'MARK_DIRTY' }
  | { type: 'MARK_SAVED' }
  | { type: 'UPDATE_SECTION_SETTINGS'; sectionId: string; key: string; value: any }
  | { type: 'UPDATE_BLOCK_SETTINGS';   sectionId: string; blockId: string; key: string; value: any }
  | { type: 'TOGGLE_SECTION_VISIBILITY'; sectionId: string }
  | { type: 'TOGGLE_BLOCK_VISIBILITY';   blockId: string; sectionId: string }
  | { type: 'ADD_SECTION';      section: SectionDoc; insertAfter: string | null }
  | { type: 'REMOVE_SECTION';   sectionId: string }
  | { type: 'ADD_BLOCK';        sectionId: string; block: BlockDoc }
  | { type: 'REMOVE_BLOCK';     sectionId: string; blockId: string }
  | { type: 'REORDER_SECTIONS'; orderedIds: string[] }
  | { type: 'REORDER_BLOCKS';   sectionId: string; orderedIds: string[] }
  | { type: 'SET_ACTIVE_PAGE';   pageId: string }
  | { type: 'SET_THEME_COLORS';  colors: Record<string, string> }
  | { type: 'CLEAR_RESPONSIVE_OVERRIDE'; sectionId: string; key: string }
  | { type: 'CLEAR_BLOCK_RESPONSIVE_OVERRIDE'; sectionId: string; blockId: string; key: string }

  // ── Phase 1: ContentNode actions ─────────────────────────────────────────
  // These are no-ops in the UI until nodeMode becomes true.
  // The reducer handles them without affecting the legacy SectionDoc path.

  /** Load or switch to a ContentNode tree. Sets nodeMode: true. */
  | { type: 'SET_NODE_TREE'; tree: Node }

  /** Select a node in node mode (equivalent of SELECT_SECTION / SELECT_BLOCK). */
  | { type: 'SELECT_NODE'; nodeId: string }

  /** Hover a node in node mode (equivalent of HOVER_SECTION / HOVER_BLOCK).
   *  Pass null to clear hover. */
  | { type: 'HOVER_NODE'; nodeId: string | null }

  /** Update a single settings key on a node at any depth.
   *  Respects activeBreakpoint: desktop writes to node.settings,
   *  tablet/mobile writes to node.responsive.{bp}. */
  | { type: 'UPDATE_NODE'; nodeId: string; key: string; value: unknown }

  /** Remove a node (and all its descendants) from the tree. */
  | { type: 'REMOVE_NODE'; nodeId: string }

  /** Insert a new Node as a direct child of parentId.
   *  insertAfter: the sibling id to insert after, or null to append. */
  | { type: 'INSERT_NODE'; parentId: string; node: Node; insertAfter: string | null }

  /** Reorder the direct children of the node with id parentId. */
  | { type: 'REORDER_NODE_CHILDREN'; parentId: string; orderedIds: string[] }

  /** Toggle a node's visibility across all breakpoints simultaneously. */
  | { type: 'TOGGLE_NODE_VISIBILITY'; nodeId: string }

  /** Clear a single responsive override key for the currently active breakpoint. */
  | { type: 'CLEAR_NODE_RESPONSIVE_OVERRIDE'; nodeId: string; key: string }

  /** Set visibility for a specific breakpoint independently. */
  | { type: 'UPDATE_NODE_VISIBILITY'; nodeId: string; bp: 'desktop' | 'tablet' | 'mobile'; visible: boolean }

  /**
   * Update the optimistic concurrency version after a successful
   * loadPageDocument() or savePageDocument() call.
   * Dispatched by EditorContext.loadPage() (on node tree load)
   * and EditorTopBar.performSave() (after each successful node-mode save).
   */
  | { type: 'SET_NODE_DOCUMENT_VERSION'; version: number };
