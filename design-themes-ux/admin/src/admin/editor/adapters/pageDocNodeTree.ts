/**
 * Phase 0 — Bridge Adapter
 *
 * buildNodeTreeFromPageDoc  — PageDoc  → Root Node tree
 * buildPageDocFromNodeTree  — Root Node tree → PageDoc
 *
 * Pure TypeScript — zero React, zero DOM, zero Vite imports.
 *
 * ── Tree shape produced ──────────────────────────────────────────────────────
 *
 *   Node { type: 'page_root',  id: 'root_{pageId}' }
 *     ├── Node { type: 'page_group', settings.handle: 'header' }
 *     │     └── ... header SectionDoc nodes
 *     ├── Node { type: 'page_group', settings.handle: 'body' }
 *     │     └── ... page SectionDoc nodes
 *     └── Node { type: 'page_group', settings.handle: 'footer' }
 *           └── ... footer SectionDoc nodes
 *
 * All three group nodes are always present (children may be empty).
 * This guarantees predictable traversal without existence checks.
 *
 * ── Round-trip contract ───────────────────────────────────────────────────────
 *   buildPageDocFromNodeTree(buildNodeTreeFromPageDoc(doc)) deep-equals doc
 *   for any well-formed PageDoc.
 */

import type { Node } from '@/components/node-renderer/types';
import type { PageDoc, SectionDoc, SectionGroupDoc } from '@/admin/editor/types';
import { sectionToNode, nodeToSectionDoc } from './sectionNodeAdapter';

// ─── Stable ID helpers ────────────────────────────────────────────────────────

const ROOT_ID  = (pageId: string) => `root_${pageId}`;
const GROUP_ID = (pageId: string, handle: string) => `grp_${handle}_${pageId}`;

// Node types used in the group tree.
export const PAGE_ROOT_TYPE  = 'page_root'  as const;
export const PAGE_GROUP_TYPE = 'page_group' as const;
export type  PageGroupHandle = 'header' | 'body' | 'footer';

// ─── PageDoc → Node tree ──────────────────────────────────────────────────────

/**
 * Wrap a PageDoc into a canonical root Node tree.
 *
 * The original groupId values are preserved in group node settings so that
 * buildPageDocFromNodeTree can restore them exactly.
 *
 * @param doc  A well-formed PageDoc (from the editor or loaded from the API).
 * @returns    A 'page_root' Node whose children are three 'page_group' nodes.
 */
export function buildNodeTreeFromPageDoc(doc: PageDoc): Node {
  const headerSections = doc.groups.header?.sections ?? [];
  const footerSections = doc.groups.footer?.sections ?? [];

  const headerGroup: Node = {
    id:    doc.groups.header?.groupId ?? GROUP_ID(doc.pageId, 'header'),
    type:  PAGE_GROUP_TYPE,
    label: 'Header',
    settings: {
      handle:   'header'  as PageGroupHandle,
      isSystem: true,
      // Persist original groupId so round-trip restores it exactly.
      groupId:  doc.groups.header?.groupId,
    },
    children: headerSections.map(sectionToNode),
  };

  const bodyGroup: Node = {
    id:    GROUP_ID(doc.pageId, 'body'),
    type:  PAGE_GROUP_TYPE,
    label: doc.pageTitle,
    settings: {
      handle: 'body' as PageGroupHandle,
    },
    children: doc.sections.map(sectionToNode),
  };

  const footerGroup: Node = {
    id:    doc.groups.footer?.groupId ?? GROUP_ID(doc.pageId, 'footer'),
    type:  PAGE_GROUP_TYPE,
    label: 'Footer',
    settings: {
      handle:   'footer' as PageGroupHandle,
      isSystem: true,
      groupId:  doc.groups.footer?.groupId,
    },
    children: footerSections.map(sectionToNode),
  };

  return {
    id:    ROOT_ID(doc.pageId),
    type:  PAGE_ROOT_TYPE,
    label: doc.pageTitle,
    settings: {
      pageId:    doc.pageId,
      pageTitle: doc.pageTitle,
      themeId:   doc.themeId,
    },
    children: [headerGroup, bodyGroup, footerGroup],
  };
}

// ─── Node tree → PageDoc ──────────────────────────────────────────────────────

/**
 * Reconstruct a PageDoc from a root Node tree produced by buildNodeTreeFromPageDoc.
 *
 * @param root  A 'page_root' Node.
 * @returns     A PageDoc with the same structure and data as the original.
 * @throws      If root.type is not 'page_root'.
 */
export function buildPageDocFromNodeTree(root: Node): PageDoc {
  if (root.type !== PAGE_ROOT_TYPE) {
    throw new Error(
      `buildPageDocFromNodeTree: expected root.type '${PAGE_ROOT_TYPE}', got '${root.type}'`,
    );
  }

  const pageId    = root.settings.pageId    as string;
  const pageTitle = root.settings.pageTitle as string;
  const themeId   = root.settings.themeId   as string ?? '';

  const groups = root.children ?? [];
  const headerGroup = findGroup(groups, 'header');
  const bodyGroup   = findGroup(groups, 'body');
  const footerGroup = findGroup(groups, 'footer');

  // ── header group ────────────────────────────────────────────────────────────
  // Only included in groups{} when the original had a header group.
  // We detect this by the presence of a stored groupId OR any children.
  const headerSections = nodesToSections(headerGroup);
  const headerGroupDoc = buildSectionGroupDoc(headerGroup, 'header', headerSections);

  // ── footer group ────────────────────────────────────────────────────────────
  const footerSections = nodesToSections(footerGroup);
  const footerGroupDoc = buildSectionGroupDoc(footerGroup, 'footer', footerSections);

  return {
    pageId,
    pageTitle,
    themeId,
    groups: {
      ...(headerGroupDoc ? { header: headerGroupDoc } : {}),
      ...(footerGroupDoc ? { footer: footerGroupDoc } : {}),
    },
    sections: nodesToSections(bodyGroup),
  };
}

// ─── Utility accessors ────────────────────────────────────────────────────────

/** Return the direct child Nodes of the body group (the page sections). */
export function getBodySections(root: Node): Node[] {
  return findGroup(root.children ?? [], 'body')?.children ?? [];
}

/** Return the direct child Nodes of the header group. */
export function getHeaderSections(root: Node): Node[] {
  return findGroup(root.children ?? [], 'header')?.children ?? [];
}

/** Return the direct child Nodes of the footer group. */
export function getFooterSections(root: Node): Node[] {
  return findGroup(root.children ?? [], 'footer')?.children ?? [];
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function findGroup(children: Node[], handle: PageGroupHandle): Node | undefined {
  return children.find((c) => c.settings.handle === handle);
}

function nodesToSections(groupNode: Node | undefined): SectionDoc[] {
  return (groupNode?.children ?? []).map(nodeToSectionDoc);
}

/**
 * Build a SectionGroupDoc from a page_group node.
 * Returns null when the group is absent or has no children AND no stored groupId
 * — this reproduces the original PageDoc.groups shape for groups that never existed.
 */
function buildSectionGroupDoc(
  groupNode: Node | undefined,
  handle:    'header' | 'footer',
  sections:  SectionDoc[],
): SectionGroupDoc | null {
  if (!groupNode) return null;

  // A group that had no original counterpart (no stored groupId, no children)
  // should not appear in the output groups object.
  const storedGroupId = groupNode.settings.groupId as string | undefined;
  if (!storedGroupId && sections.length === 0) return null;

  return {
    groupId:  storedGroupId ?? groupNode.id,
    handle,
    sections,
  };
}
