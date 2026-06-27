/**
 * Binding resolver — Sprint 10
 *
 * Resolves {{ path.to.value }} template expressions against RenderContext.
 * Full dynamic binding (collection sources, repeaters) ships in Sprint 13.
 * This module handles the field-level interpolation that already exists in the
 * settings schema (e.g., headings that say {{ product.title }}).
 *
 * Architecture is designed for Sprint 13 expansion:
 *   - resolveSetting: resolves a single field value
 *   - resolveSettings: resolves all settings in a node
 *   - isBinding: checks if a value contains a binding expression
 */

import type { Node, RenderContext, CompiledBinding } from './types';

// ─── Field-level interpolation ────────────────────────────────────────────────

const BINDING_RE = /\{\{\s*([\w.]+)\s*\}\}/g;

/**
 * Resolves {{ path.to.value }} against ctx.pageContext.
 * Returns the original string if no binding expression is found.
 * Returns the original match if the path doesn't exist in context.
 */
export function resolveFieldBinding(
  value:   unknown,
  ctx:     RenderContext,
): unknown {
  if (typeof value !== 'string') return value;
  if (!value.includes('{{'))     return value;

  return value.replace(BINDING_RE, (match, path: string) => {
    const resolved = getPath(ctx.pageContext as Record<string, unknown>, path);
    return resolved !== undefined ? String(resolved) : match;
  });
}

/**
 * Resolves all string values in a settings object against the context.
 * Non-string values and values without {{ }} are returned unchanged.
 */
export function resolveSettings(
  settings: Record<string, unknown>,
  ctx:      RenderContext,
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(settings)) {
    resolved[key] = resolveFieldBinding(value, ctx);
  }
  return resolved;
}

/** True if the string contains at least one {{ }} binding expression. */
export function isBinding(value: unknown): boolean {
  return typeof value === 'string' && value.includes('{{');
}

// ─── Compiled binding resolution (Sprint 13 extension point) ─────────────────

/**
 * Returns true if this node's data should come from a bound list source.
 * The actual data fetching is handled by the compile pipeline (Sprint 15).
 * For now this just checks the binding shape.
 */
export function isListBinding(node: Node): boolean {
  return node.binding?.kind === 'list';
}

/**
 * Returns the context key injected for children of this node.
 * e.g., a ProductGrid with binding.contextProvides='product'
 * injects ctx.pageContext.product for each iteration.
 */
export function getContextProvides(node: Node): string | null {
  if (node.binding?.kind === 'list') return node.binding.contextProvides;
  return null;
}

// ─── Path access ──────────────────────────────────────────────────────────────

function getPath(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc == null || typeof acc !== 'object') return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
}
