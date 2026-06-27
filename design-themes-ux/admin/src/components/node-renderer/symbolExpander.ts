/**
 * Symbol expander — Sprint 10
 *
 * Expands symbol references in a node tree before rendering.
 * A node with type='symbol' and symbolRef.handle is replaced with the
 * symbol's tree, with instance overrides merged into settings.
 *
 * This runs once at render time (or at compile time in Sprint 15).
 * The renderer itself never fetches symbols — it only receives expanded trees.
 *
 * Sprint 12 wires this to the real SymbolDocument backend.
 * For now: resolves from the symbols Map in RenderContext (populated by
 * StorefrontService when it loads the page data).
 */

import type { Node, RenderContext } from './types';

/**
 * Walk the tree and replace symbol nodes with their expanded subtrees.
 * Returns a new tree (immutable — does not mutate the input).
 */
export function expandSymbols(node: Node, ctx: RenderContext): Node {
  // If this node IS a symbol instance, replace it with the symbol tree
  if (node.type === 'symbol' && node.symbolRef) {
    const symbolTree = ctx.symbols.get(node.symbolRef.handle);
    if (!symbolTree) {
      // Symbol not found — return a placeholder node
      return {
        ...node,
        type:     'unknown_symbol',
        settings: { missingHandle: node.symbolRef.handle, ...node.settings },
        children: [],
      };
    }
    // Merge instance overrides into the symbol root's settings
    const expanded: Node = {
      ...symbolTree,
      id:       node.id,           // keep instance id for stable keys
      settings: { ...symbolTree.settings, ...node.symbolRef.overrides },
      children: (symbolTree.children ?? []).map((c) => expandSymbols(c, ctx)),
    };
    return expanded;
  }

  // Recurse into children
  if (!node.children || node.children.length === 0) return node;
  const expandedChildren = node.children.map((c) => expandSymbols(c, ctx));
  // Avoid creating a new object if nothing changed (referential equality)
  const changed = expandedChildren.some((c, i) => c !== node.children![i]);
  if (!changed) return node;
  return { ...node, children: expandedChildren };
}
