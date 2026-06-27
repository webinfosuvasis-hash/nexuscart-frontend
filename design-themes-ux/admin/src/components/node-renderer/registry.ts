/**
 * COMPONENT_REGISTRY — Sprint 10
 *
 * Architecture
 * ────────────
 * A Map-based registry. No switch statements anywhere in the renderer.
 * Every node type resolves to a component through this single lookup.
 *
 * Key properties:
 *   O(1) lookup          — Map, not array scan or switch
 *   Lazy registration    — primitives self-register on import; no init required
 *   Marketplace support  — versioned entries with metadata; later versions win
 *   Unknown fallback     — never throws; renders a visible dev placeholder
 *   No circular imports  — registry holds zero component logic
 *   Idempotent register  — safe to call multiple times with the same type
 *
 * Registration patterns:
 *   Platform primitive  — register('grid', GridNode)
 *   Versioned theme     — register('saree-story', SareeStoryNode, { version: '2.0.0' })
 *   Marketplace plugin  — register('custom:review-stars', ReviewStars, { source: 'marketplace' })
 *   Override (upgrade)  — register('grid', GridNodeV2, { version: '2.0.0' }) — replaces v1
 */

import type { NodeComponent } from './types';

// ─── Registry entry ───────────────────────────────────────────────────────────

export type ComponentSource = 'platform' | 'theme' | 'marketplace' | 'custom';

export interface RegistryEntry {
  type:      string;
  component: NodeComponent;
  version:   string;           // semver — later versions win on re-register
  source:    ComponentSource;
  category?: string;           // 'layout' | 'content' | 'commerce' | 'marketing'
  label?:    string;           // human-readable display name
}

// ─── Registry state ───────────────────────────────────────────────────────────

const REGISTRY = new Map<string, RegistryEntry>();
let   _unknownFallback: NodeComponent | null = null;

// ─── Version comparison ───────────────────────────────────────────────────────

function semverGt(a: string, b: string): boolean {
  const parse = (v: string) => v.split('.').map(Number);
  const [aMaj, aMin, aPatch] = parse(a);
  const [bMaj, bMin, bPatch] = parse(b);
  if (aMaj !== bMaj) return aMaj > bMaj;
  if (aMin !== bMin) return aMin > bMin;
  return aPatch > bPatch;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface RegisterOptions {
  version?:  string;
  source?:   ComponentSource;
  category?: string;
  label?:    string;
}

/**
 * Register a component for a node type.
 *
 * If a component is already registered for this type, the new one wins only
 * if its version is greater. This allows marketplace components to be safely
 * "installed" without accidentally downgrading platform primitives.
 *
 * Idempotent: registering the same type+version twice is a no-op.
 */
export function register(
  type:      string,
  component: NodeComponent,
  opts:      RegisterOptions = {},
): void {
  const version = opts.version  ?? '1.0.0';
  const source  = opts.source   ?? 'platform';
  const existing = REGISTRY.get(type);

  // Already registered at a higher or equal version — skip
  if (existing && !semverGt(version, existing.version)) return;

  REGISTRY.set(type, {
    type, component, version, source,
    category: opts.category,
    label:    opts.label,
  });
}

/** Register multiple components at once. */
export function registerAll(
  map:  Record<string, NodeComponent>,
  opts: RegisterOptions = {},
): void {
  Object.entries(map).forEach(([type, comp]) => register(type, comp, opts));
}

/**
 * Remove a component from the registry.
 * Used when a marketplace component is uninstalled or replaced.
 * Returns true if the type existed, false if it was already absent.
 */
export function unregister(type: string): boolean {
  return REGISTRY.delete(type);
}

/**
 * Resolve a component by type.
 * Returns the UnknownNode fallback if the type is not registered.
 * Never throws, never returns null.
 */
export function resolve(type: string): NodeComponent {
  return REGISTRY.get(type)?.component ?? getUnknownFallback();
}

/** Returns the full registry entry for introspection and debugging. */
export function entry(type: string): RegistryEntry | undefined {
  return REGISTRY.get(type);
}

/** True if a component is registered for this type. */
export function isRegistered(type: string): boolean {
  return REGISTRY.has(type);
}

/** All registered type ids — useful for debugging and the Insert panel. */
export function registeredTypes(): string[] {
  return Array.from(REGISTRY.keys());
}

/** All registry entries — used by the marketplace browser and Insert panel. */
export function allEntries(): RegistryEntry[] {
  return Array.from(REGISTRY.values());
}

/** All entries for a specific source category. */
export function entriesBySource(source: ComponentSource): RegistryEntry[] {
  return allEntries().filter((e) => e.source === source);
}

/** All entries for a specific UI category (layout/content/commerce). */
export function entriesByCategory(category: string): RegistryEntry[] {
  return allEntries().filter((e) => e.category === category);
}

/** Snapshot of registry size — for diagnostics. */
export function registrySize(): number {
  return REGISTRY.size;
}

// ─── Unknown fallback ─────────────────────────────────────────────────────────

export function setUnknownFallback(component: NodeComponent): void {
  _unknownFallback = component;
}

function getUnknownFallback(): NodeComponent {
  if (_unknownFallback) return _unknownFallback;
  // Null fallback used only if resolve() is called before index.ts registers
  // Unknown.tsx via setUnknownFallback(). In normal app usage this never fires
  // because index.ts is imported at the app root before any render.
  // In production: silent null. In dev: null (Unknown.tsx will cover it once registered).
  const NullFallback: NodeComponent = () => null as any;
  return NullFallback;
}

// ─── Test helpers (never imported in production builds) ──────────────────────

/** Wipe the registry. Only for use in tests — never call in application code. */
export function _resetRegistryForTests(): void {
  REGISTRY.clear();
  _unknownFallback = null;
}
