/**
 * NodeRenderer types — Sprint 10
 *
 * Shared between frontend (React renderer) and backend (document service).
 * Node is the canonical tree unit; NodeProps is what every primitive receives.
 */

import type { CSSProperties } from 'react';

// ─── Re-export from transform types (single source of truth) ─────────────────
// These mirror backend/src/modules/content/transforms/types.ts
// We duplicate here to avoid a cross-package import.

export type Breakpoint = 'desktop' | 'tablet' | 'mobile';

export interface Node {
  id:          string;
  type:        string;
  label?:      string;
  settings:    Record<string, unknown>;
  responsive?: {
    tablet?: Record<string, unknown>;
    mobile?: Record<string, unknown>;
  };
  visibility?: {
    desktop?: boolean;
    tablet?:  boolean;
    mobile?:  boolean;
  };
  binding?:    CompiledBinding;
  symbolRef?:  SymbolRef;
  children?:   Node[];
}

export type CompiledBinding =
  | {
      kind:            'list';
      source:          'collection' | 'products' | 'menu' | 'recommendations' | 'context';
      ref:             { mode: 'fixed'; id: string } | { mode: 'context' };
      sort?:           string;
      filters?:        { field: string; operator: string; value: unknown }[];
      limit:           number;
      contextProvides: string;
    }
  | { kind: 'field'; path: string[] };

export interface SymbolRef {
  handle:    string;
  overrides: Record<string, unknown>;
}

// ─── Render context ───────────────────────────────────────────────────────────
// Flows down the tree. DATA_BOUND nodes inject extra fields via bindContext().

export interface PageContext {
  product?:    Record<string, unknown>;
  collection?: Record<string, unknown>;
  cart?:       Record<string, unknown>;
  [key: string]:unknown;
}

export interface RenderContext {
  breakpoint:   Breakpoint;
  themeTokens:  Record<string, string>;
  storeId:      string;
  pageContext:  PageContext;
  // Resolved symbol trees — populated by the resolver before render
  symbols:      Map<string, Node>;
  // Preview mode: true in the editor, false in production
  isPreview:    boolean;
}

// ─── Component contract ───────────────────────────────────────────────────────
// Every primitive receives NodeProps; children are already recursed.

export interface NodeProps {
  node:     Node;
  ctx:      RenderContext;
  style:    CSSProperties;          // resolveStyle(node.settings, ctx.breakpoint)
  children: React.ReactNode;        // recursed subtree, ready to render
}

// ─── Registry ─────────────────────────────────────────────────────────────────

export type NodeComponent = React.ComponentType<NodeProps>;
