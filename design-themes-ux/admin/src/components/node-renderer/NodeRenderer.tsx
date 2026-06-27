/**
 * NodeRenderer — Sprint 10, Step 2
 *
 * Recursive renderer for the ContentNode tree (PageDocument.tree).
 *
 * Render flow per node:
 *   1. Depth guard          — max 32 levels; prevents stack overflow on malformed trees
 *   2. Visibility check     — node.visibility[breakpoint] !== false
 *   3. Binding resolution   — {{ path }} interpolation against pageContext
 *   4. Style resolution     — resolveStyle(settings, breakpoint) → CSSProperties
 *   5. Registry lookup      — resolve(node.type) → NodeComponent (never null)
 *   6. Context propagation  — DATA_BOUND nodes inject child context
 *   7. Recursive children   — renderNode() called for each child with child context
 *   8. ErrorBoundary wrap   — per-node isolation; crash in one node ≠ crash in page
 *
 * Invariants:
 *   - renderNode() never returns undefined (null for hidden/empty nodes)
 *   - Every rendered element has a stable key = node.id
 *   - styleResolver is the single source of CSS; primitives never hardcode styles
 *   - Symbol expansion happens BEFORE TreeRenderer; renderer only sees plain nodes
 */

import React from 'react';
import { resolve }                          from './registry';
import { withErrorBoundary, safeSettings } from './ErrorBoundary';
import { useRenderContext, bindContext }    from './RenderContext';
import { resolveStyle }                  from '@/admin/editor/styleResolver';
import { resolveSettings, getContextProvides } from './bindingResolver';
import type { Node, RenderContext, NodeProps } from './types';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum tree depth. Prevents stack overflow on accidental cycles. */
export const MAX_DEPTH = 32;

// ─── Visibility guard ─────────────────────────────────────────────────────────

export function isNodeVisible(node: Node, ctx: RenderContext): boolean {
  if (!node.visibility) return true;
  return node.visibility[ctx.breakpoint] !== false;
}

// ─── Core render function ─────────────────────────────────────────────────────

export function renderNode(
  node:  Node,
  ctx:   RenderContext,
  depth: number = 0,
): React.ReactElement | null {
  // 1. Depth guard
  if (depth > MAX_DEPTH) {
    if (ctx.isPreview) {
      return (
        <div
          key={node.id}
          data-node-error={node.id}
          style={{ padding: '4px 8px', color: '#F43F5E', fontSize: 11,
            fontFamily: 'monospace', border: '1px dashed #F43F5E', borderRadius: 4 }}
        >
          Max nesting depth ({MAX_DEPTH}) reached — check for cycles.
        </div>
      );
    }
    return null;
  }

  // 2. Visibility check
  if (!isNodeVisible(node, ctx)) return null;

  // 3. Settings safety guard + binding resolution
  const rawSettings = safeSettings(
    { ...node.settings, responsive: node.responsive } as Record<string, unknown>,
    node.id,
  );
  const resolvedSettings = resolveSettings(rawSettings, ctx) as Record<string, unknown>;

  // 4. Style resolution — styleResolver is the single source of CSS
  const style = resolveStyle(resolvedSettings, ctx.breakpoint);

  // 5. Registry lookup — returns Unknown component if type not registered
  const Component = resolve(node.type);

  // 6. Context propagation — DATA_BOUND nodes inject child context
  const provides  = getContextProvides(node);
  const childCtx  = provides
    ? bindContext(ctx, { [provides]: resolvedSettings })
    : ctx;

  // 7. Recursive children (always an array, never undefined)
  const children = (node.children ?? [])
    .map((child) => renderNode(child, childCtx, depth + 1))
    .filter((el): el is React.ReactElement => el !== null);

  const nodeProps: NodeProps = {
    node:     { ...node, settings: resolvedSettings },
    ctx,
    style,
    children,   // always ReactElement[] — never undefined
  };

  // 8. ErrorBoundary wrap — crash in one subtree ≠ crash in page
  const element = <Component key={node.id} {...nodeProps} />;
  return withErrorBoundary(
    node.id, node.type, ctx.isPreview, element,
  ) as React.ReactElement;
}

// ─── Public React component ───────────────────────────────────────────────────

interface NodeRendererProps {
  node:   Node;
  depth?: number;
}

export const NodeRenderer: React.FC<NodeRendererProps> = ({ node, depth = 0 }) => {
  const ctx = useRenderContext();
  return renderNode(node, ctx, depth) ?? null;
};

// ─── Tree entry-point ─────────────────────────────────────────────────────────

export const TreeRenderer: React.FC<{ tree: Node | null | undefined }> = ({ tree }) => {
  const ctx = useRenderContext();

  if (!tree) {
    if (ctx.isPreview) {
      return (
        <div style={{ padding: 32, textAlign: 'center', color: '#6B6B80', fontSize: 14 }}>
          Empty page — add layers to get started.
        </div>
      );
    }
    return null;
  }

  return renderNode(tree, ctx, 0) ?? null;
};
