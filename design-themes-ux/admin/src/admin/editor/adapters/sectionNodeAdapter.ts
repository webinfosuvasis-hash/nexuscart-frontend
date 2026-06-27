/**
 * Phase 0 — Bridge Adapter
 *
 * sectionToNode / nodeToSectionDoc  (Section ↔ Node)
 * blockToNode   / nodeToBlockDoc    (Block   ↔ Node child)
 *
 * Pure TypeScript — zero React, zero DOM, zero Vite imports.
 * Safe to use in Node.js unit tests, SSR, and the browser.
 *
 * ── Metadata convention ─────────────────────────────────────────────────────
 * Fields present in SectionDoc/BlockDoc that have no equivalent on Node are
 * stored in node.settings under _nx_ prefixed keys.  They survive JSON
 * serialisation and are stripped automatically when converting back.
 *
 *   SectionDoc.isSystem     → node.settings._nx_isSystem
 *   SectionDoc.groupHandle  → node.settings._nx_groupHandle
 *   BlockDoc.sortOrder      → node.settings._nx_sortOrder
 *   BlockDoc.isRequired     → node.settings._nx_isRequired
 *
 * ── Visibility convention ────────────────────────────────────────────────────
 * SectionDoc.isVisible / BlockDoc.isVisible is a single boolean.
 * Node.visibility is per-breakpoint { desktop?, tablet?, mobile? }.
 *
 *   isVisible: true  → omit node.visibility  (undefined = visible in NodeRenderer)
 *   isVisible: false → node.visibility = { desktop: false, tablet: false, mobile: false }
 *
 * On the reverse pass, desktop !== false is used as the canonical source
 * (consistent with how NodeRenderer evaluates visibility).
 */

import type { Node } from '@/components/node-renderer/types';
import type { SectionDoc, BlockDoc } from '@/admin/editor/types';

// ─── Internal metadata key constants ────────────────────────────────────────

const META_IS_SYSTEM        = '_nx_isSystem'    as const;
const META_GROUP_HANDLE     = '_nx_groupHandle' as const;
const META_BLOCK_SORT_ORDER = '_nx_sortOrder'   as const;
const META_BLOCK_IS_REQUIRED= '_nx_isRequired'  as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Strip all keys that start with '_nx_' from a settings object.
 * Returns a new plain object — the input is not mutated.
 */
function stripNxKeys(settings: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(settings)) {
    if (!k.startsWith('_nx_')) out[k] = v;
  }
  return out;
}

// ─── Block ↔ Node ────────────────────────────────────────────────────────────

/**
 * Convert a BlockDoc to a leaf Node.
 *
 * - sortOrder and isRequired are encoded in node.settings under _nx_ keys.
 * - isVisible: false → node.visibility all-false; true → visibility omitted.
 * - children is always [] (blocks have no nested content in the SectionDoc model).
 */
export function blockToNode(block: BlockDoc): Node {
  const { id, type, settings, isVisible, isRequired, sortOrder } = block;

  const nodeSettings: Record<string, unknown> = {
    ...settings,
    [META_BLOCK_SORT_ORDER]: sortOrder,
  };
  if (isRequired !== undefined) {
    nodeSettings[META_BLOCK_IS_REQUIRED] = isRequired;
  }

  const node: Node = {
    id,
    type,
    settings: nodeSettings,
    children: [],
  };

  if (!isVisible) {
    node.visibility = { desktop: false, tablet: false, mobile: false };
  }

  return node;
}

/**
 * Convert a Node (produced by blockToNode) back to a BlockDoc.
 *
 * @param node             The node to convert.
 * @param fallbackSortOrder Index-based fallback if _nx_sortOrder is absent
 *                          (e.g. for nodes created directly in the node editor).
 */
export function nodeToBlockDoc(node: Node, fallbackSortOrder: number): BlockDoc {
  const { id, type, settings } = node;

  const sortOrder  = typeof settings[META_BLOCK_SORT_ORDER] === 'number'
    ? (settings[META_BLOCK_SORT_ORDER] as number)
    : fallbackSortOrder;

  const isRequired = settings[META_BLOCK_IS_REQUIRED] as boolean | undefined;

  // A node is visible unless ALL breakpoints are explicitly set to false.
  const isVisible =
    node.visibility?.desktop !== false ||
    node.visibility?.tablet  !== false ||
    node.visibility?.mobile  !== false;

  const block: BlockDoc = {
    id,
    type,
    settings: stripNxKeys(settings),
    isVisible,
    sortOrder,
  };

  if (isRequired !== undefined) block.isRequired = isRequired;

  return block;
}

// ─── Section ↔ Node ──────────────────────────────────────────────────────────

/**
 * Convert a SectionDoc (with its flat blocks array) into a Node tree.
 *
 * - Each block becomes a child Node (depth = 2).
 * - isSystem and groupHandle are encoded in node.settings under _nx_ keys.
 * - Children preserve block order (array order = canonical order).
 */
export function sectionToNode(section: SectionDoc): Node {
  const { id, type, label, settings, isVisible, isSystem, groupHandle, blocks } = section;

  const nodeSettings: Record<string, unknown> = { ...settings };
  if (isSystem    === true)      nodeSettings[META_IS_SYSTEM]    = true;
  if (groupHandle !== undefined) nodeSettings[META_GROUP_HANDLE] = groupHandle;

  const node: Node = {
    id,
    type,
    label,
    settings: nodeSettings,
    children: blocks.map(blockToNode),
  };

  if (!isVisible) {
    node.visibility = { desktop: false, tablet: false, mobile: false };
  }

  return node;
}

/**
 * Convert a Node (produced by sectionToNode) back to a SectionDoc.
 *
 * - _nx_ metadata is extracted from node.settings then stripped.
 * - Block sortOrder is restored from _nx_sortOrder; falls back to array index.
 * - The label field falls back to node.type when the node has no label.
 */
export function nodeToSectionDoc(node: Node): SectionDoc {
  const { id, type, label, settings } = node;

  const isSystem    = settings[META_IS_SYSTEM]    as boolean | undefined;
  const groupHandle = settings[META_GROUP_HANDLE] as string  | undefined;

  // Section visibility: use desktop as the canonical source.
  const isVisible = node.visibility?.desktop !== false;

  const section: SectionDoc = {
    id,
    type,
    label:    label ?? type,
    settings: stripNxKeys(settings),
    isVisible,
    blocks:   (node.children ?? []).map((child, idx) => nodeToBlockDoc(child, idx + 1)),
  };

  if (isSystem    !== undefined) section.isSystem    = isSystem;
  if (groupHandle !== undefined) section.groupHandle = groupHandle;

  return section;
}
