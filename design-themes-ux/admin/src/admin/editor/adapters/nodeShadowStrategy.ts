/**
 * Phase 9 — Compatibility shadow persistence
 *
 * After a successful PageDocument save (node mode), this module writes an
 * equivalent ThemePageSection snapshot so that merchants can safely roll
 * back CONTENT_NODE_ENABLED to false without losing their content.
 *
 * ── Why this exists ───────────────────────────────────────────────────────────
 *
 *   Node mode:  saves → PageDocument table     (CONTENT_NODE_ENABLED = true)
 *   Legacy mode: reads from ThemePageSection   (CONTENT_NODE_ENABLED = false)
 *
 *   Without a shadow, disabling the flag shows stale ThemePageSection data
 *   from before node mode was enabled.  The shadow keeps both tables in sync.
 *
 * ── Architecture ─────────────────────────────────────────────────────────────
 *
 *   buildSectionShadow(nodeTree: Node): SectionShadowEntry[]
 *     Pure function — converts a ContentNode tree into the format expected by
 *     savePageSections().  Uses the Phase 0 round-trip adapters:
 *       buildPageDocFromNodeTree() → nodeToSectionDoc() → payload
 *     _nx_* metadata keys are stripped by nodeToSectionDoc() automatically.
 *
 *   writeSectionShadow(pageId, nodeTree, themeId?)
 *     Async — calls savePageSections() with the shadow payload.
 *     Best-effort: callers .catch() errors; shadow failure does NOT block
 *     the primary PageDocument save.
 *
 * ── Scope ─────────────────────────────────────────────────────────────────────
 *
 *   Phase 9 covers BODY sections only (via savePageSections).
 *   Header/footer config shadow (updateHeaderDraft / updateFooterDraft) requires
 *   the extractHeaderFooter.ts adapter and is out of Phase 9 scope.
 *
 * ── Invariant ─────────────────────────────────────────────────────────────────
 *
 *   For any well-formed nodeTree produced by buildNodeTreeFromPageDoc():
 *     buildSectionShadow(nodeTree) ≈ originalPageDoc.sections
 *   (structurally equivalent — same types, settings, visibility, sort order)
 */

import type { Node }       from '@/components/node-renderer/types';
import { buildPageDocFromNodeTree } from './pageDocNodeTree';
import { themeEngineService }       from '@/services/themeEngineService';

// ─── Shadow entry type ────────────────────────────────────────────────────────

/** Single section entry for the savePageSections() payload. */
export interface SectionShadowEntry {
  type:      string;
  label:     string;
  settings:  Record<string, any>;
  isVisible: boolean;
  sortOrder: number;
  blocks:    BlockShadowEntry[];
}

/** Single block entry nested inside a SectionShadowEntry. */
export interface BlockShadowEntry {
  type:      string;
  settings:  Record<string, any>;
  isVisible: boolean;
  sortOrder: number;
}

// ─── buildSectionShadow ───────────────────────────────────────────────────────

/**
 * Convert a ContentNode tree into ThemePageSection shadow entries.
 *
 * Only the BODY page group (handle: 'body') is included — header and footer
 * groups are persisted separately via updateHeaderDraft / updateFooterDraft
 * (Phase 10+).
 *
 * Sort orders are assigned positionally (1, 2, 3, …) for sections.
 * Block sort orders are preserved from the _nx_sortOrder metadata stored
 * during the Phase 0 sectionToNode() conversion.
 *
 * This function is pure (no I/O) and fully covered by unit tests.
 *
 * @param nodeTree  A 'page_root' Node produced by buildNodeTreeFromPageDoc().
 * @returns         An array of section entries ready for savePageSections().
 */
export function buildSectionShadow(nodeTree: Node): SectionShadowEntry[] {
  // buildPageDocFromNodeTree() calls nodeToSectionDoc() which strips _nx_* keys
  // and restores sortOrder from _nx_sortOrder metadata.
  const pageDoc = buildPageDocFromNodeTree(nodeTree);

  return pageDoc.sections.map((section, idx): SectionShadowEntry => ({
    type:      section.type,
    label:     section.label,
    settings:  section.settings,      // _nx_* already stripped
    isVisible: section.isVisible,
    sortOrder: (idx + 1) * 1.0,       // positional: 1.0, 2.0, 3.0 …
    blocks:    section.blocks.map((block): BlockShadowEntry => ({
      type:      block.type,
      settings:  block.settings,      // _nx_* already stripped
      isVisible: block.isVisible,
      sortOrder: block.sortOrder,     // restored from _nx_sortOrder
    })),
  }));
}

// ─── writeSectionShadow ───────────────────────────────────────────────────────

/**
 * Write the ThemePageSection shadow for a page after a successful node save.
 *
 * Callers should use .catch() to suppress errors — shadow failure must not
 * block the primary PageDocument save or dispatch MARK_SAVED.
 *
 * Example usage in EditorTopBar.performSave():
 *   writeSectionShadow(activePage, nodeTree, activeTheme)
 *     .catch(err => console.warn('[Shadow] sync failed:', err));
 *
 * @param pageId   e.g. 'home', 'product'
 * @param nodeTree The ContentNode tree currently in editor state.
 * @param themeId  Optional theme identifier (passed as X-Theme-Id header).
 */
export async function writeSectionShadow(
  pageId:   string,
  nodeTree: Node,
  themeId?: string,
): Promise<void> {
  const sections = buildSectionShadow(nodeTree);
  await themeEngineService.savePageSections(pageId, sections, themeId);
}
