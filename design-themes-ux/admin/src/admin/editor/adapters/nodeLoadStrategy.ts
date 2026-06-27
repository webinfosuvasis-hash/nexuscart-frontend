/**
 * Phase 6 Step 3 — Node load strategy
 *
 * Pure TypeScript — no React, no DOM, no side effects.
 * Determines what the editor should display after page load, given the
 * results of the two API calls made by EditorContext.loadPage():
 *
 *   1. loadPageDocument(storeId, themeId, pageId)
 *      → PageDocumentData | null
 *
 *   2. getDraftPageData(pageId)  [called only when (1) returns null]
 *      → { sections, nodeTree }
 *
 * Decision matrix:
 *
 *   doc !== null                          → node_from_document
 *     (PageDocument exists; load its tree + version)
 *
 *   doc === null && nodeTree !== null     → node_from_sections
 *     (CONTENT_NODE_ENABLED is ON, PageDocument doesn't exist yet;
 *      use the tree built server-side from ThemePageSection back-compat shim;
 *      version starts at 0 — first save creates the PageDocument)
 *
 *   doc === null && nodeTree === null     → legacy
 *     (CONTENT_NODE_ENABLED is OFF; use ThemePageSection / SectionDoc model)
 */

import type { PageDocumentData } from '@/services/themeEngineService';

// ─── Decision types ───────────────────────────────────────────────────────────

/** The editor must dispatch SET_NODE_TREE + SET_NODE_DOCUMENT_VERSION(version) */
export interface NodeFromDocumentDecision {
  mode:    'node_from_document';
  tree:    Record<string, unknown>;
  version: number;
}

/**
 * CONTENT_NODE_ENABLED is ON but no PageDocument exists yet.
 * The editor must dispatch SET_NODE_TREE + SET_NODE_DOCUMENT_VERSION(0).
 * The first save will create the PageDocument.
 */
export interface NodeFromSectionsDecision {
  mode:    'node_from_sections';
  tree:    Record<string, unknown>;
  version: 0;
}

/**
 * CONTENT_NODE_ENABLED is OFF.
 * The editor must use the SectionDoc / PageDoc model (unchanged legacy path).
 */
export interface LegacyDecision {
  mode:     'legacy';
  sections: any[];
}

export type NodeLoadDecision =
  | NodeFromDocumentDecision
  | NodeFromSectionsDecision
  | LegacyDecision;

// ─── Decision function ────────────────────────────────────────────────────────

/**
 * Resolve the editor load decision from two API call results.
 *
 * @param doc       Result of loadPageDocument() — null if no PageDocument exists.
 * @param nodeTree  nodeTree field from getDraftPageData() response — null when flag is OFF.
 * @param sections  sections array from getDraftPageData() response — used in legacy mode.
 *
 * @returns  A discriminated union describing what the editor should display.
 */
export function resolveNodeLoadDecision(
  doc:      PageDocumentData | null,
  nodeTree: Record<string, unknown> | null,
  sections: any[],
): NodeLoadDecision {
  // Primary: PageDocument exists → use it as the authoritative source.
  // This gives us both the tree AND the version number.
  if (doc !== null) {
    return {
      mode:    'node_from_document',
      tree:    doc.tree,
      version: doc.version,
    };
  }

  // Secondary: CONTENT_NODE_ENABLED is ON but no PageDocument yet.
  // getDraftPageData() built the tree server-side from ThemePageSection
  // via the back-compat shim in buildFromPageDocument().
  if (nodeTree !== null) {
    return {
      mode:    'node_from_sections',
      tree:    nodeTree,
      version: 0,
    };
  }

  // Tertiary: CONTENT_NODE_ENABLED is OFF — use legacy SectionDoc model.
  return {
    mode:     'legacy',
    sections,
  };
}
