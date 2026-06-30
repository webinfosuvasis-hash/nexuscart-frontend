/**
 * Registry types — the foundational contracts for the NexusCart theme system.
 *
 * These types enable the Page Builder to be completely theme-agnostic:
 * the builder stores sectionType strings and JSON configs;
 * the Theme Registry resolves which visual implementation to use.
 *
 * Architecture:
 *   ThemeRegistry  (global singleton)
 *     └── ThemeEntry  (one per theme: aurus, classic, luxury, ...)
 *           └── SectionRegistry  (one per theme)
 *                 └── SectionRegistryEntry<TConfig, TData>  (one per section type)
 *                       ├── component    pure React renderer
 *                       ├── parseConfig  JSON → typed config
 *                       ├── validateConfig  guard + warnings
 *                       ├── resolveData  external data fetching
 *                       └── defaultConfig  fallback when nothing is saved
 */

import React from 'react';

// ─── Primitive types ──────────────────────────────────────────────────────────

export type Viewport = 'desktop' | 'tablet' | 'mobile';

export interface ValidationResult<T> {
  /** Whether all required fields pass validation */
  isValid:  boolean;
  /** Field-level error messages (field path → message) */
  errors:   Record<string, string>;
  /** Non-blocking warnings */
  warnings: Record<string, string>;
  /** The validated (and merged-with-defaults) config to use for rendering */
  config:   T;
}

// ─── Section component contract ───────────────────────────────────────────────

/**
 * Props passed to every section component — in every theme.
 * TConfig is the typed config for this section type.
 * TData is the resolved external data (products, categories, etc.).
 */
export interface SectionComponentProps<TConfig, TData = Record<string, never>> {
  /** Validated, fully-merged config from the Page Builder */
  config:     TConfig;
  /** Resolved external data (products, categories, etc.) */
  data:       TData;
  /**
   * true = admin editor preview mode:
   *   - cart/wishlist disabled
   *   - links use preventDefault
   *   - auto-rotate disabled
   *   - analytics events suppressed
   */
  isPreview?: boolean;
  /**
   * true = parent is still resolving data:
   *   - section may show a loading skeleton
   */
  isLoading?: boolean;
}

// ─── Demo asset provider contract ────────────────────────────────────────────

/**
 * DemoAssetProvider — abstracts fallback image data for data resolvers.
 *
 * Resolvers must NEVER import PRODUCTS.aurus or CATEGORIES.aurus directly.
 * Instead they use context.demoAssets to obtain fallback images.
 * This keeps resolvers decoupled from hardcoded theme data and testable.
 *
 * Two implementations are provided by the platform:
 *
 *   AurusDemoAssetProvider   — returns real Aurus CDN images.
 *                              Active in development / demo mode.
 *                              Produces pixel-identical output to V1.
 *
 *   PlaceholderAssetProvider — returns empty strings.
 *                              Active in production builds.
 *                              Components render with CSS overlay + text only.
 *
 * The orchestrator (AurusHomeV2) injects the correct provider via
 * ResolverContext.demoAssets based on the build environment.
 */
export interface DemoAssetProvider {
  /**
   * Fallback product images — used as collection card covers,
   * campaign grid thumbnails, etc. when no real product images are available.
   */
  getProductImages(count: number): Array<{ id: string; image: string }>;

  /**
   * Fallback category images — used for category icon strips,
   * category discovery cards, etc. when no real category images exist.
   */
  getCategoryImages(count: number): Array<{ img: string }>;

  /**
   * Full product fallback — used by sections that display name, price and
   * mrp alongside the image (e.g. FeaturedProductsSection).
   * Returns the same images as getProductImages but with realistic demo metadata.
   */
  getFullProducts(count: number): Array<{ id: string; name: string; price: number; mrp: number; image: string }>;
}

// ─── Data resolver contract ───────────────────────────────────────────────────

/**
 * Context passed to every data resolver.
 * Provides the API client, store context, shared data cache, and demo assets.
 */
export interface ResolverContext {
  storeId:     string;
  locale?:     string;
  isPreview?:  boolean;
  /**
   * Shared cache to prevent duplicate API calls when multiple sections
   * need the same product/category data.
   * Keyed by a canonical cache key (e.g. 'products:tag:Bestseller').
   */
  sharedCache: Map<string, unknown>;
  /**
   * Generic storefront API fetcher injected by the orchestrator (AurusHomeV2).
   * Resolvers call this with a path relative to the API base:
   *   context.fetchStorefront('/storefront/products?tag=Bestseller')
   *
   * The storeId header is automatically included by the implementation.
   * The return type T must match the backend response's `data` field.
   *
   * Phase S2: implemented as a direct public fetch.
   * Phase S5: can be swapped for a cache-aware implementation.
   */
  fetchStorefront: <T>(path: string) => Promise<T>;
  /**
   * Fallback image provider — injected by the orchestrator.
   *
   * Resolvers use this instead of importing PRODUCTS.aurus directly:
   *   const fallbackImgs = context.demoAssets.getProductImages(8);
   *
   * In dev:  returns real Aurus demo CDN images (pixel-identical to V1).
   * In prod: returns empty strings (graceful degraded state).
   *
   * Override via VITE_DEMO_ASSETS=true to force demo assets in non-dev builds.
   */
  demoAssets: DemoAssetProvider;
}

/**
 * Function signature for data resolvers.
 * Must never throw — errors are caught by the pipeline and return empty data.
 */
export type DataResolver<TConfig, TData> = (
  config:  TConfig,
  context: ResolverContext,
) => Promise<TData>;

// ─── Section registry entry ───────────────────────────────────────────────────

/**
 * A complete registry entry for one section type in one theme.
 * Adding a new section to a theme = adding one entry.
 * No other file changes are required.
 */
export interface SectionRegistryEntry<
  TConfig  extends object = Record<string, unknown>,
  TData    extends object = Record<string, never>,
> {
  /** Must match SECTION_TYPE enum values */
  sectionType:    string;

  /**
   * Pure React component — no side effects, no API calls.
   * Receives config + data + isPreview, returns JSX.
   * Used identically by the storefront and the admin editor preview.
   */
  component:      React.ComponentType<SectionComponentProps<TConfig, TData>>;

  /**
   * Parse raw JSON from BuilderSection.config into typed TConfig.
   * Must never throw — return defaultConfig on parse failure.
   */
  parseConfig:    (raw: unknown) => TConfig;

  /**
   * Deep-merge the parsed config with defaultConfig so no field is ever undefined.
   * Implemented by the pipeline (not per-entry) using the entry's defaultConfig.
   */
  defaultConfig:  TConfig;

  /**
   * Validate the merged config.
   * Returns errors (blocking) and warnings (non-blocking).
   * Validation failure never prevents rendering — the pipeline uses the merged config.
   */
  validateConfig: (config: TConfig) => ValidationResult<TConfig>;

  /**
   * Fetch external data needed to render this section.
   * Called in parallel with all other section resolvers via Promise.allSettled.
   * Must never throw — return empty data on API failure.
   */
  resolveData:    DataResolver<TConfig, TData>;

  /**
   * Safe empty data state used when resolveData fails or returns nothing.
   * Also used in admin editor preview when no API data is available.
   */
  defaultData:    TData;

  /** Metadata for tooling and debugging */
  meta: {
    label:               string;
    /** Whether this section appears in admin editor previews */
    supportsPreview:     boolean;
    /** External data needed — for documentation and future optimisations */
    dataRequirements:    string[];
  };
}

// ─── Theme entry ──────────────────────────────────────────────────────────────

/** One complete theme registered in the global ThemeRegistry */
export interface ThemeEntry {
  /** Must match the themeId returned by the storefront API */
  themeId:         string;
  themeName:       string;
  /** The section registry for this theme */
  sectionRegistry: import('./SectionRegistry').SectionRegistry;
}
