import React, {
  createContext, useContext, useReducer, useCallback, useMemo, useEffect, useRef,
} from 'react';
import type { EditorState, EditorAction, PageDoc, SectionDoc, BlockDoc } from './types';
import type { Node } from '@/components/node-renderer/types';
import { MOCK_PAGE_DOC, PAGE_TITLES, buildEmptyPageDoc } from './editor-mock-data';
import { themeEngineService } from '@/services/themeEngineService';
import { useAuth } from '@/contexts/AuthContext';
import {
  updateNode,
  removeNodeById,
  insertChildNode,
  reorderChildren,
} from './adapters/nodeTreeHelpers';
import { resolveNodeLoadDecision } from './adapters/nodeLoadStrategy';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setNested(obj: Record<string, any>, dotPath: string, value: any): Record<string, any> {
  const keys   = dotPath.split('.');
  const result = { ...obj };
  let cur: any = result;
  for (let i = 0; i < keys.length - 1; i++) {
    cur[keys[i]] = { ...(cur[keys[i]] ?? {}) };
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
  return result;
}

function updateSectionInDoc(doc: PageDoc, sectionId: string, updater: (s: SectionDoc) => SectionDoc): PageDoc {
  const tryUpdate = (sections: SectionDoc[]) =>
    sections.map((s) => s.id === sectionId ? updater(s) : s);

  const updGroups = { ...doc.groups };
  if (updGroups.header) {
    updGroups.header = { ...updGroups.header, sections: tryUpdate(updGroups.header.sections) };
  }
  if (updGroups.footer) {
    updGroups.footer = { ...updGroups.footer, sections: tryUpdate(updGroups.footer.sections) };
  }
  return { ...doc, groups: updGroups, sections: tryUpdate(doc.sections) };
}

function updateBlockInDoc(doc: PageDoc, sectionId: string, blockId: string, updater: (b: BlockDoc) => BlockDoc): PageDoc {
  return updateSectionInDoc(doc, sectionId, (section) => ({
    ...section,
    blocks: section.blocks.map((b) => b.id === blockId ? updater(b) : b),
  }));
}

// ─── Initial state ─────────────────────────────────────────────────────────────

const INITIAL_COLORS = {
  primary:    '#4f46e5',
  secondary:  '#f5f5f5',
  accent:     '#f59e0b',
  background: '#ffffff',
  text:       '#1a1a1a',
  surface:    '#f9fafb',
};

const INITIAL_STATE: EditorState = {
  // ── Legacy path ────────────────────────────────────────────────────────────
  pageDoc:              null,
  selection:            { type: 'none', sectionId: null, blockId: null, groupHandle: null },
  previewMode:          'desktop',
  activeBreakpoint:     'desktop',
  isDirty:              false,
  isSaving:             false,
  expandedNodes:        new Set<string>(),   // all sections collapsed by default
  showSectionLibrary:   false,
  insertAfterSectionId: null,
  hoverSectionId:       null,
  hoverBlockId:         null,
  activePage:           'home',
  activeTheme:          'dawn',
  themeColors:          INITIAL_COLORS,
  // ── Phase 1: ContentNode path (inactive until nodeMode is set) ────────────
  nodeMode:             false,
  nodeTree:             null,
  selectedNodeId:       null,
  hoveredNodeId:        null,
  // ── Phase 6: optimistic concurrency for PageDocument saves ────────────────
  // Starts at 0 (document not yet loaded / does not exist).
  // Updated by SET_NODE_DOCUMENT_VERSION after loadPageDocument() + savePageDocument().
  nodeDocumentVersion:  0,
};

// ─── Reducer ──────────────────────────────────────────────────────────────────

function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {

    case 'SET_PAGE_DOC':
      return { ...state, pageDoc: action.payload, isDirty: false };

    case 'SELECT_SECTION': {
      const next = new Set(state.expandedNodes);
      next.add(action.sectionId);
      return {
        ...state,
        selection: { type: 'section', sectionId: action.sectionId, blockId: null, groupHandle: action.groupHandle ?? null },
        expandedNodes: next,
      };
    }

    case 'SELECT_BLOCK': {
      const next = new Set(state.expandedNodes);
      next.add(action.sectionId);
      return {
        ...state,
        selection: { type: 'block', sectionId: action.sectionId, blockId: action.blockId, groupHandle: action.groupHandle ?? null },
        expandedNodes: next,
      };
    }

    case 'DESELECT':
      return {
        ...state,
        selection:      { type: 'none', sectionId: null, blockId: null, groupHandle: null },
        selectedNodeId: null,   // also clear node selection so both modes deselect cleanly
      };

    case 'HOVER_SECTION':
      return { ...state, hoverSectionId: action.sectionId };

    case 'HOVER_BLOCK':
      return { ...state, hoverBlockId: action.blockId };

    case 'SET_PREVIEW_MODE':
      return { ...state, previewMode: action.mode, activeBreakpoint: action.mode };

    case 'TOGGLE_NODE': {
      const next = new Set(state.expandedNodes);
      if (next.has(action.nodeId)) next.delete(action.nodeId);
      else next.add(action.nodeId);
      return { ...state, expandedNodes: next };
    }

    case 'EXPAND_NODE': {
      const next = new Set(state.expandedNodes);
      next.add(action.nodeId);
      return { ...state, expandedNodes: next };
    }

    case 'SHOW_SECTION_LIBRARY':
      return { ...state, showSectionLibrary: true, insertAfterSectionId: action.insertAfter };

    case 'HIDE_SECTION_LIBRARY':
      return { ...state, showSectionLibrary: false, insertAfterSectionId: null };

    case 'SET_SAVING':
      return { ...state, isSaving: action.value };

    case 'MARK_DIRTY':
      return { ...state, isDirty: true };

    case 'MARK_SAVED':
      return { ...state, isDirty: false, isSaving: false };

    case 'UPDATE_SECTION_SETTINGS': {
      if (!state.pageDoc) return state;
      const bp      = state.activeBreakpoint;
      const dotPath = bp === 'desktop'
        ? action.key
        : `responsive.${bp}.${action.key}`;
      const updated = updateSectionInDoc(state.pageDoc, action.sectionId, (s) => ({
        ...s,
        settings: setNested(s.settings, dotPath, action.value),
      }));
      return { ...state, pageDoc: updated, isDirty: true };
    }

    case 'UPDATE_BLOCK_SETTINGS': {
      if (!state.pageDoc) return state;
      const bp      = state.activeBreakpoint;
      const dotPath = bp === 'desktop'
        ? action.key
        : `responsive.${bp}.${action.key}`;
      const updated = updateBlockInDoc(state.pageDoc, action.sectionId, action.blockId, (b) => ({
        ...b,
        settings: setNested(b.settings, dotPath, action.value),
      }));
      return { ...state, pageDoc: updated, isDirty: true };
    }

    case 'CLEAR_RESPONSIVE_OVERRIDE': {
      if (!state.pageDoc) return state;
      const clearBp = state.activeBreakpoint;
      if (clearBp === 'desktop') return state;
      const updated = updateSectionInDoc(state.pageDoc, action.sectionId, (s) => {
        const responsive = { ...(s.settings.responsive as any ?? {}) };
        if (responsive[clearBp]) {
          const bpOverrides = { ...responsive[clearBp] };
          delete bpOverrides[action.key];
          responsive[clearBp] = bpOverrides;
        }
        return { ...s, settings: { ...s.settings, responsive } };
      });
      return { ...state, pageDoc: updated, isDirty: true };
    }

    case 'CLEAR_BLOCK_RESPONSIVE_OVERRIDE': {
      if (!state.pageDoc) return state;
      const clearBp = state.activeBreakpoint;
      if (clearBp === 'desktop') return state;
      const updated = updateBlockInDoc(state.pageDoc, action.sectionId, action.blockId, (b) => {
        const responsive = { ...(b.settings.responsive as any ?? {}) };
        if (responsive[clearBp]) {
          const bpOverrides = { ...responsive[clearBp] };
          delete bpOverrides[action.key];
          responsive[clearBp] = bpOverrides;
        }
        return { ...b, settings: { ...b.settings, responsive } };
      });
      return { ...state, pageDoc: updated, isDirty: true };
    }

    case 'TOGGLE_SECTION_VISIBILITY': {
      if (!state.pageDoc) return state;
      const updated = updateSectionInDoc(state.pageDoc, action.sectionId, (s) => ({ ...s, isVisible: !s.isVisible }));
      return { ...state, pageDoc: updated, isDirty: true };
    }

    case 'TOGGLE_BLOCK_VISIBILITY': {
      if (!state.pageDoc) return state;
      const updated = updateBlockInDoc(state.pageDoc, action.sectionId, action.blockId, (b) => ({ ...b, isVisible: !b.isVisible }));
      return { ...state, pageDoc: updated, isDirty: true };
    }

    case 'ADD_SECTION': {
      if (!state.pageDoc) return state;
      const sections = [...state.pageDoc.sections];
      const idx = action.insertAfter
        ? sections.findIndex((s) => s.id === action.insertAfter) + 1
        : sections.length;
      sections.splice(idx, 0, action.section);
      const next = new Set(state.expandedNodes);
      next.add(action.section.id);
      return {
        ...state,
        pageDoc: { ...state.pageDoc, sections },
        expandedNodes: next,
        isDirty: true,
        showSectionLibrary: false,
        selection: { type: 'section', sectionId: action.section.id, blockId: null, groupHandle: null },
      };
    }

    case 'REMOVE_SECTION': {
      if (!state.pageDoc) return state;
      const sections = state.pageDoc.sections.filter((s) => s.id !== action.sectionId);
      const sel = state.selection.sectionId === action.sectionId
        ? { type: 'none' as const, sectionId: null, blockId: null, groupHandle: null }
        : state.selection;
      return { ...state, pageDoc: { ...state.pageDoc, sections }, selection: sel, isDirty: true };
    }

    case 'ADD_BLOCK': {
      if (!state.pageDoc) return state;
      const updated = updateSectionInDoc(state.pageDoc, action.sectionId, (s) => ({
        ...s,
        blocks: [...s.blocks, action.block],
      }));
      return {
        ...state,
        pageDoc: updated,
        selection: { type: 'block', sectionId: action.sectionId, blockId: action.block.id, groupHandle: null },
        isDirty: true,
      };
    }

    case 'REMOVE_BLOCK': {
      if (!state.pageDoc) return state;
      const updated = updateSectionInDoc(state.pageDoc, action.sectionId, (s) => ({
        ...s,
        blocks: s.blocks.filter((b) => b.id !== action.blockId),
      }));
      const sel = state.selection.blockId === action.blockId
        ? { type: 'section' as const, sectionId: action.sectionId, blockId: null, groupHandle: state.selection.groupHandle }
        : state.selection;
      return { ...state, pageDoc: updated, selection: sel, isDirty: true };
    }

    case 'REORDER_SECTIONS': {
      if (!state.pageDoc) return state;
      const map = Object.fromEntries(state.pageDoc.sections.map((s) => [s.id, s]));
      const sections = action.orderedIds.map((id) => map[id]).filter(Boolean);
      return { ...state, pageDoc: { ...state.pageDoc, sections }, isDirty: true };
    }

    case 'REORDER_BLOCKS': {
      if (!state.pageDoc) return state;
      const updated = updateSectionInDoc(state.pageDoc, action.sectionId, (s) => {
        const map = Object.fromEntries(s.blocks.map((b) => [b.id, b]));
        const blocks = action.orderedIds.map((id) => map[id]).filter(Boolean);
        return { ...s, blocks };
      });
      return { ...state, pageDoc: updated, isDirty: true };
    }

    case 'SET_ACTIVE_PAGE':
      // Reset all page-scoped state so the canvas never shows stale content.
      // isDirty is cleared here because the dirty-state guard fires BEFORE
      // this action is dispatched (see PageSelector in EditorTopBar).
      return {
        ...state,
        activePage:     action.pageId,
        pageDoc:        null,          // triggers skeleton loading in canvas
        // Phase 1+6: also reset ContentNode state on page switch
        nodeTree:             null,
        nodeMode:             false,   // re-determined by loadPage()
        selectedNodeId:       null,
        hoveredNodeId:        null,
        nodeDocumentVersion:  0,
        selection:      { type: 'none', sectionId: null, blockId: null, groupHandle: null },
        expandedNodes:  new Set<string>(),
        isDirty:        false,
        hoverSectionId: null,
        hoverBlockId:   null,
      };

    case 'SET_THEME_COLORS':
      return { ...state, themeColors: action.colors };

    // ── Phase 1: ContentNode reducer cases ─────────────────────────────────
    // These cases are inactive until nodeMode becomes true via SET_NODE_TREE.
    // The legacy SectionDoc cases above are completely unchanged.

    case 'SET_NODE_TREE':
      return {
        ...state,
        nodeTree:             action.tree,
        nodeMode:             true,
        // Reset both legacy and node selections on tree load
        selection:            { type: 'none', sectionId: null, blockId: null, groupHandle: null },
        selectedNodeId:       null,
        hoveredNodeId:        null,
        expandedNodes:        new Set<string>(),
        isDirty:              false,
        // Version is reset to 0 here; SET_NODE_DOCUMENT_VERSION is dispatched
        // separately after loadPageDocument() resolves with the real version.
        nodeDocumentVersion:  0,
      };

    case 'SELECT_NODE': {
      const next = new Set(state.expandedNodes);
      next.add(action.nodeId);
      return { ...state, selectedNodeId: action.nodeId, expandedNodes: next };
    }

    case 'HOVER_NODE':
      return { ...state, hoveredNodeId: action.nodeId };

    case 'UPDATE_NODE': {
      if (!state.nodeTree) return state;
      const bp = state.activeBreakpoint;
      const updated = updateNode(state.nodeTree, action.nodeId, (node) => {
        if (bp === 'desktop') {
          return { ...node, settings: setNested(node.settings, action.key, action.value) };
        }
        // Non-desktop: write to node.responsive.{bp}.{key}
        const responsive = { ...(node.responsive ?? {}) } as Record<string, Record<string, unknown>>;
        responsive[bp] = setNested(
          (responsive[bp] ?? {}) as Record<string, any>,
          action.key,
          action.value,
        ) as Record<string, unknown>;
        return { ...node, responsive };
      });
      return { ...state, nodeTree: updated, isDirty: true };
    }

    case 'REMOVE_NODE': {
      if (!state.nodeTree) return state;
      const updated = removeNodeById(state.nodeTree, action.nodeId);
      return {
        ...state,
        nodeTree:       updated,
        selectedNodeId: state.selectedNodeId === action.nodeId ? null : state.selectedNodeId,
        isDirty:        true,
      };
    }

    case 'INSERT_NODE': {
      if (!state.nodeTree) return state;
      const updated = insertChildNode(
        state.nodeTree,
        action.parentId,
        action.node,
        action.insertAfter,
      );
      const next = new Set(state.expandedNodes);
      next.add(action.node.id);
      return {
        ...state,
        nodeTree:           updated,
        expandedNodes:      next,
        selectedNodeId:     action.node.id,
        showSectionLibrary: false,
        isDirty:            true,
      };
    }

    case 'REORDER_NODE_CHILDREN': {
      if (!state.nodeTree) return state;
      const updated = reorderChildren(state.nodeTree, action.parentId, action.orderedIds);
      return { ...state, nodeTree: updated, isDirty: true };
    }

    case 'TOGGLE_NODE_VISIBILITY': {
      if (!state.nodeTree) return state;
      const toggled = updateNode(state.nodeTree, action.nodeId, (node) => {
        const isCurrentlyVisible = node.visibility?.desktop !== false;
        return {
          ...node,
          visibility: {
            desktop: !isCurrentlyVisible,
            tablet:  !isCurrentlyVisible,
            mobile:  !isCurrentlyVisible,
          },
        };
      });
      return { ...state, nodeTree: toggled, isDirty: true };
    }

    case 'CLEAR_NODE_RESPONSIVE_OVERRIDE': {
      if (!state.nodeTree) return state;
      const bp = state.activeBreakpoint;
      if (bp === 'desktop') return state;   // nothing to clear on the base breakpoint
      const cleared = updateNode(state.nodeTree, action.nodeId, (node) => {
        if (!node.responsive?.[bp]) return node;
        const responsive    = { ...node.responsive };
        const bpOverrides   = { ...responsive[bp] };
        delete bpOverrides[action.key];
        responsive[bp]      = bpOverrides;
        return { ...node, responsive };
      });
      return { ...state, nodeTree: cleared, isDirty: true };
    }

    case 'UPDATE_NODE_VISIBILITY': {
      if (!state.nodeTree) return state;
      const updated = updateNode(state.nodeTree, action.nodeId, (node) => ({
        ...node,
        visibility: {
          ...(node.visibility ?? {}),
          [action.bp]: action.visible,
        },
      }));
      return { ...state, nodeTree: updated, isDirty: true };
    }

    case 'SET_NODE_DOCUMENT_VERSION':
      return { ...state, nodeDocumentVersion: action.version };

    default:
      return state;
  }
}

// ─── Context ───────────────────────────────────────────────────────────────────

interface EditorContextValue {
  state:    EditorState;
  dispatch: React.Dispatch<EditorAction>;
  // ── Legacy convenience helpers (unchanged) ────────────────────────────────
  selectSection: (sectionId: string, groupHandle?: string) => void;
  selectBlock:   (sectionId: string, blockId: string, groupHandle?: string) => void;
  deselect:      () => void;
  updateSectionSetting: (sectionId: string, key: string, value: any) => void;
  updateBlockSetting:   (sectionId: string, blockId: string, key: string, value: any) => void;
  removeBlock:   (sectionId: string, blockId: string) => void;
  removeSection: (sectionId: string) => void;
  /**
   * Re-fetch sections (or node tree) from the database and rebuild editor state.
   * Called after Publish and after Discard so the tree reflects the DB truth.
   */
  reloadFromApi: () => Promise<void>;
  // ── Legacy derived values (unchanged) ────────────────────────────────────
  selectedSection: SectionDoc | null;
  selectedBlock:   BlockDoc   | null;
  allSections:     SectionDoc[];
  // ── Phase 1: ContentNode convenience helpers ──────────────────────────────
  selectNode: (nodeId: string) => void;
  hoverNode:  (nodeId: string | null) => void;
  // ── Phase 1: ContentNode derived values ──────────────────────────────────
  selectedNode: Node | null;
}

const EditorContext = createContext<EditorContextValue | null>(null);

// ─── Build PageDoc from API sections response ─────────────────────────────────

function buildPageDocFromApiSections(apiSections: any[], pageId: string): PageDoc {
  const sections: SectionDoc[] = apiSections
    .filter((s: any) => s.isVisible !== false || true)  // include all, renderer handles visibility
    .sort((a: any, b: any) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0))
    .map((s: any): SectionDoc => ({
      id:          s.id,
      type:        s.sectionDefId ?? s.type ?? 'unknown',
      label:       s.label ?? s.definition?.name ?? s.sectionDefId ?? 'Section',
      settings:    (s.settings as Record<string, any>) ?? {},
      isVisible:   s.isVisible ?? true,
      groupHandle: undefined,
      blocks:      ((s.blocks ?? []) as any[])
        .sort((a: any, b: any) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0))
        .map((b: any): BlockDoc => ({
          id:         b.id,
          type:       b.type,
          settings:   (b.settings as Record<string, any>) ?? {},
          isVisible:  b.isVisible ?? true,
          isRequired: false,
          sortOrder:  Number(b.sortOrder ?? 0),
        })),
    }));

  // Stamp the real pageId/title. Global header/footer groups are shared across
  // all pages (they come from header_configs/footer_configs, not ThemePageSection).
  return {
    ...MOCK_PAGE_DOC,
    pageId,
    pageTitle: PAGE_TITLES[pageId] ?? pageId,
    sections,
  };
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function EditorProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [state, dispatch] = useReducer(editorReducer, INITIAL_STATE);

  // ── Refs: latest values for use in loadPage without recreating the callback ──
  // Pattern matches the existing activePageRef approach.
  const activePageRef  = useRef(state.activePage);
  const storeIdRef     = useRef(user?.storeId ?? '');
  const activeThemeRef = useRef(state.activeTheme);

  useEffect(() => { activePageRef.current  = state.activePage;    }, [state.activePage]);
  useEffect(() => { storeIdRef.current     = user?.storeId ?? ''; }, [user?.storeId]);
  useEffect(() => { activeThemeRef.current = state.activeTheme;   }, [state.activeTheme]);

  // ── Core page-loading logic ───────────────────────────────────────────────────
  // `loadPage` always takes an explicit pageId so it is never ambiguous about
  // which page it is loading. It has no dependency on `state` to avoid stale
  // closures and unnecessary recreations.
  //
  // Phase 6 Step 3 load flow:
  //
  //   Step A: Try loadPageDocument() first.
  //           • Returns full PageDocumentData (tree + version) when the
  //             PageDocument exists and CONTENT_NODE_ENABLED is ON.
  //           • Returns null when the flag is OFF or document doesn't exist.
  //           • Errors are caught and treated as null (best-effort).
  //
  //   Step B: Only when A returns null — call getDraftPageData().
  //           • Returns nodeTree when CONTENT_NODE_ENABLED is ON but no
  //             PageDocument exists yet (tree built from ThemePageSection).
  //           • Returns null nodeTree when the flag is OFF (legacy path).
  //
  //   resolveNodeLoadDecision() maps (doc, nodeTree, sections) to one of:
  //     node_from_document  → SET_NODE_TREE + SET_NODE_DOCUMENT_VERSION(N)
  //     node_from_sections  → SET_NODE_TREE + SET_NODE_DOCUMENT_VERSION(0)
  //     legacy              → existing SectionDoc path (unchanged)

  const loadPage = useCallback(async (pageId: string): Promise<void> => {
    const storeId = storeIdRef.current;
    const themeId = activeThemeRef.current;

    try {
      // ── Step A: Load PageDocument directly (node mode, gets version) ─────────
      // Best-effort — any network / auth error is treated as "not available".
      const doc = storeId
        ? await themeEngineService.loadPageDocument(storeId, themeId, pageId).catch(() => null)
        : null;

      // ── Step B: getDraftPageData() — only when we don't have a PageDocument ──
      // This is the CONTENT_NODE_ENABLED signal from the backend.
      // Skipped when doc is non-null (avoids a redundant API call).
      let apiSections: any[] = [];
      let nodeTree: Record<string, unknown> | null = null;

      if (!doc) {
        const draftData = await themeEngineService.getDraftPageData(pageId);
        apiSections = draftData.sections;
        nodeTree    = draftData.nodeTree;
      }

      // ── Apply decision ────────────────────────────────────────────────────────
      const decision = resolveNodeLoadDecision(doc, nodeTree, apiSections);

      if (decision.mode === 'node_from_document') {
        dispatch({ type: 'SET_NODE_TREE',             tree:    decision.tree as unknown as Node });
        dispatch({ type: 'SET_NODE_DOCUMENT_VERSION', version: decision.version });
        return;
      }

      if (decision.mode === 'node_from_sections') {
        dispatch({ type: 'SET_NODE_TREE',             tree:    decision.tree as unknown as Node });
        dispatch({ type: 'SET_NODE_DOCUMENT_VERSION', version: 0 });
        return;
      }

      // ── Legacy SectionDoc path (unchanged) ─────────────────────────────────
      const legacySections = decision.sections;

      if (legacySections.length === 0) {
        // No sections in DB yet for this page. Show an empty editor shell.
        // For the home page only, silently seed starter sections so new stores
        // get a usable starting point without any manual work.
        if (pageId === 'home') {
          dispatch({ type: 'SET_PAGE_DOC', payload: MOCK_PAGE_DOC });
          themeEngineService.savePageSections(
            'home',
            MOCK_PAGE_DOC.sections.map((s, idx) => ({
              type:      s.type,
              label:     s.label,
              settings:  s.settings,
              isVisible: s.isVisible,
              sortOrder: (idx + 1) * 1.0,
              blocks:    s.blocks.map((b, bi) => ({
                type:      b.type,
                settings:  b.settings,
                isVisible: b.isVisible,
                sortOrder: b.sortOrder ?? (bi + 1) * 1.0,
              })),
            })),
          ).catch((err) => console.warn('[EditorContext] bootstrap save failed:', err));
        } else {
          // Other pages start empty — merchant builds from scratch or uses a template.
          dispatch({ type: 'SET_PAGE_DOC', payload: buildEmptyPageDoc(pageId) });
        }
      } else {
        dispatch({ type: 'SET_PAGE_DOC', payload: buildPageDocFromApiSections(legacySections, pageId) });
      }
    } catch (err) {
      console.warn(`[EditorContext] could not load page "${pageId}", using fallback:`, err);
      dispatch({ type: 'SET_PAGE_DOC', payload: buildEmptyPageDoc(pageId) });
    }
  }, [dispatch]);

  // ── Reactive reload on page switch ───────────────────────────────────────────
  // Fires on mount (initial load) and whenever activePage changes.
  useEffect(() => {
    loadPage(state.activePage);
  }, [state.activePage, loadPage]);

  /** Reload current page from the database. Called after Publish and Discard. */
  const reloadFromApi = useCallback(async (): Promise<void> => {
    await loadPage(activePageRef.current);
    dispatch({ type: 'MARK_SAVED' });
    dispatch({ type: 'DESELECT' });
  }, [loadPage]);

  // ── Phase 1: ContentNode convenience helpers ──────────────────────────────

  const selectNode = useCallback((nodeId: string) => {
    dispatch({ type: 'SELECT_NODE', nodeId });
  }, []);

  const hoverNode = useCallback((nodeId: string | null) => {
    dispatch({ type: 'HOVER_NODE', nodeId });
  }, []);

  // ── Legacy helpers (unchanged) ────────────────────────────────────────────

  const selectSection = useCallback((sectionId: string, groupHandle?: string) => {
    dispatch({ type: 'SELECT_SECTION', sectionId, groupHandle });
  }, []);

  const selectBlock = useCallback((sectionId: string, blockId: string, groupHandle?: string) => {
    dispatch({ type: 'SELECT_BLOCK', sectionId, blockId, groupHandle });
  }, []);

  const deselect = useCallback(() => dispatch({ type: 'DESELECT' }), []);

  const updateSectionSetting = useCallback((sectionId: string, key: string, value: any) => {
    dispatch({ type: 'UPDATE_SECTION_SETTINGS', sectionId, key, value });
  }, []);

  const updateBlockSetting = useCallback((sectionId: string, blockId: string, key: string, value: any) => {
    dispatch({ type: 'UPDATE_BLOCK_SETTINGS', sectionId, blockId, key, value });
  }, []);

  const removeBlock = useCallback((sectionId: string, blockId: string) => {
    dispatch({ type: 'REMOVE_BLOCK', sectionId, blockId });
  }, []);

  const removeSection = useCallback((sectionId: string) => {
    dispatch({ type: 'REMOVE_SECTION', sectionId });
  }, []);

  // Derived selectors
  const allSections = useMemo<SectionDoc[]>(() => {
    if (!state.pageDoc) return [];
    return [
      ...(state.pageDoc.groups.header?.sections ?? []),
      ...state.pageDoc.sections,
      ...(state.pageDoc.groups.footer?.sections ?? []),
    ];
  }, [state.pageDoc]);

  const selectedSection = useMemo(() => {
    if (state.selection.type === 'none') return null;
    return allSections.find((s) => s.id === state.selection.sectionId) ?? null;
  }, [state.selection, allSections]);

  const selectedBlock = useMemo(() => {
    if (state.selection.type !== 'block' || !selectedSection) return null;
    return selectedSection.blocks.find((b) => b.id === state.selection.blockId) ?? null;
  }, [state.selection, selectedSection]);

  // Phase 1: selectedNode — finds the selected Node in the node tree.
  // Returns null in legacy mode (nodeMode: false) or when nothing is selected.
  const { findNode: findNodeHelper } = useMemo(() => ({
    findNode: (id: string | null): Node | null => {
      if (!id || !state.nodeTree) return null;
      // Inline depth-first search to avoid importing findNode into the closure
      // (tree helpers are already imported at the module level for the reducer).
      function dfs(root: Node): Node | null {
        if (root.id === id) return root;
        for (const c of root.children ?? []) {
          const found = dfs(c);
          if (found) return found;
        }
        return null;
      }
      return dfs(state.nodeTree);
    },
  }), [state.nodeTree]);

  const selectedNode = useMemo(
    () => findNodeHelper(state.selectedNodeId),
    [findNodeHelper, state.selectedNodeId],
  );

  const value = useMemo<EditorContextValue>(() => ({
    state, dispatch,
    // Legacy helpers
    selectSection, selectBlock, deselect,
    updateSectionSetting, updateBlockSetting,
    removeBlock, removeSection,
    reloadFromApi,
    // Legacy derived
    selectedSection, selectedBlock, allSections,
    // Phase 1: ContentNode helpers and derived
    selectNode, hoverNode,
    selectedNode,
  }), [
    state, dispatch,
    selectSection, selectBlock, deselect,
    updateSectionSetting, updateBlockSetting,
    removeBlock, removeSection,
    reloadFromApi,
    selectedSection, selectedBlock, allSections,
    selectNode, hoverNode,
    selectedNode,
  ]);

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
}

export function useEditor(): EditorContextValue {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error('useEditor must be used within EditorProvider');
  return ctx;
}
