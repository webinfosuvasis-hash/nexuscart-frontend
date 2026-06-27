/**
 * Phase 1 — Node tree helper functions
 *
 * Pure TypeScript — no React, no DOM, no Vite imports.
 * Every function is immutable: it returns a new tree and never mutates input.
 *
 * Referential equality is preserved when a subtree is untouched:
 * if updateNode(root, 'missing-id', fn) finds nothing, it returns `root` unchanged.
 * React's reconciler treats this as a no-op.
 *
 * These helpers are used exclusively by the editorReducer.
 * They are not exported from any component file.
 */

import type { Node } from '@/components/node-renderer/types';

// ─── findNode ─────────────────────────────────────────────────────────────────

/**
 * Depth-first search for a node by id.
 * Returns null if the id is not found anywhere in the tree.
 */
export function findNode(root: Node, id: string): Node | null {
  if (root.id === id) return root;
  for (const child of root.children ?? []) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

// ─── findParent ───────────────────────────────────────────────────────────────

/**
 * Return the direct parent of the node whose id is `childId`.
 * Returns null if `childId` is not found or is the root itself.
 */
export function findParent(root: Node, childId: string): Node | null {
  if (root.id === childId) return null;         // root has no parent
  for (const child of root.children ?? []) {
    if (child.id === childId) return root;      // found: root is the parent
    const found = findParent(child, childId);
    if (found) return found;
  }
  return null;
}

// ─── updateNode ──────────────────────────────────────────────────────────────

/**
 * Immutable update of a single node anywhere in the tree.
 *
 * @param root    The root node of the tree.
 * @param id      The id of the node to update.
 * @param updater A pure function that receives the current node and returns the new node.
 * @returns       A new tree with the target node replaced.
 *                Returns `root` unchanged (same reference) if `id` is not found.
 */
export function updateNode(
  root:    Node,
  id:      string,
  updater: (node: Node) => Node,
): Node {
  if (root.id === id) return updater(root);

  const children = root.children;
  if (!children || children.length === 0) return root;

  let changed = false;
  const newChildren = children.map((child) => {
    const updated = updateNode(child, id, updater);
    if (updated !== child) changed = true;
    return updated;
  });

  return changed ? { ...root, children: newChildren } : root;
}

// ─── removeNodeById ───────────────────────────────────────────────────────────

/**
 * Remove the node with the given id from anywhere in the tree.
 *
 * @param root  The root node.
 * @param id    The id of the node to remove.
 * @returns     A new tree without the target node.
 *              Returns `root` unchanged if `id` is not found.
 *
 * Note: removing a page_group or page_root node is structurally destructive.
 * The caller (editorReducer) is responsible for preventing this.
 */
export function removeNodeById(root: Node, id: string): Node {
  // Removing the root itself is a no-op (no parent to remove it from).
  if (root.id === id) return root;

  const children = root.children;
  if (!children || children.length === 0) return root;

  const newChildren = children.filter((c) => c.id !== id).map((c) => removeNodeById(c, id));
  const changed =
    newChildren.length !== children.length ||
    newChildren.some((c, i) => c !== children[i]);

  return changed ? { ...root, children: newChildren } : root;
}

// ─── insertChildNode ─────────────────────────────────────────────────────────

/**
 * Insert `node` as a direct child of the node whose id is `parentId`.
 *
 * @param root        The root node.
 * @param parentId    The id of the parent node that will receive the new child.
 * @param node        The new node to insert.
 * @param insertAfter Insert the new node after the sibling with this id.
 *                    Pass null to append at the end.
 * @returns           A new tree with the node inserted.
 * @throws            If `parentId` is not found in the tree.
 */
export function insertChildNode(
  root:        Node,
  parentId:    string,
  node:        Node,
  insertAfter: string | null,
): Node {
  let found = false;

  const result = updateNode(root, parentId, (parent) => {
    found = true;
    const children = parent.children ?? [];

    if (insertAfter === null) {
      return { ...parent, children: [...children, node] };
    }

    const afterIdx = children.findIndex((c) => c.id === insertAfter);
    if (afterIdx === -1) {
      // Sibling not found — append at end (graceful degradation)
      return { ...parent, children: [...children, node] };
    }

    const next = [...children];
    next.splice(afterIdx + 1, 0, node);
    return { ...parent, children: next };
  });

  if (!found) {
    throw new Error(`insertChildNode: parentId '${parentId}' not found in tree`);
  }

  return result;
}

// ─── reorderChildren ─────────────────────────────────────────────────────────

/**
 * Reorder the direct children of the node with id `parentId`.
 *
 * @param root       The root node.
 * @param parentId   The id of the node whose children will be reordered.
 * @param orderedIds The desired child order as an array of node ids.
 *                   Extra ids (not present in children) are silently ignored.
 *                   Children absent from orderedIds are dropped.
 * @returns          A new tree with the children reordered.
 *                   Returns `root` unchanged if `parentId` is not found.
 */
export function reorderChildren(
  root:       Node,
  parentId:   string,
  orderedIds: string[],
): Node {
  return updateNode(root, parentId, (parent) => {
    const childMap = new Map((parent.children ?? []).map((c) => [c.id, c]));
    const reordered = orderedIds
      .map((id) => childMap.get(id))
      .filter((c): c is Node => c !== undefined);

    // Skip the update if order didn't change (referential equality)
    const unchanged =
      reordered.length === (parent.children ?? []).length &&
      reordered.every((c, i) => c === parent.children![i]);

    return unchanged ? parent : { ...parent, children: reordered };
  });
}
