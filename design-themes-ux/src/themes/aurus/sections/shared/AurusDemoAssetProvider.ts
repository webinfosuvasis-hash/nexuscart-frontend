/**
 * AurusDemoAssetProvider.ts
 *
 * Concrete implementations of the DemoAssetProvider interface for the Aurus theme.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * ARCHITECTURE
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * This file is the ONLY place where PRODUCTS.aurus / CATEGORIES.aurus are
 * imported for use as resolver fallback data. Resolvers must never import
 * these constants directly — they receive a DemoAssetProvider via ResolverContext.
 *
 * Two implementations:
 *
 *   aurusDemoProvider      Active in development / VITE_DEMO_ASSETS=true
 *   ─────────────────────  Returns real Aurus Unsplash CDN images.
 *                          Produces pixel-identical output to V1 AurusHomeSections.
 *                          Used when a store has no products/category images yet.
 *
 *   placeholderProvider    Active in production builds
 *   ─────────────────────  Returns empty strings for all image fields.
 *                          Components render with CSS gradient + text (no broken imgs).
 *                          In production, merchants configure real images via the admin.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * SELECTION
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * The orchestrator (AurusHomeV2) selects the provider and injects it into every
 * ResolverContext. Resolvers access it as context.demoAssets — they never need
 * to know which implementation is active.
 */

import { PRODUCTS, CATEGORIES } from '@/data/products';
import type { DemoAssetProvider } from '@/themes/registry/types';

// ─── Development / demo implementation ───────────────────────────────────────

/**
 * Returns real Aurus CDN images (Unsplash URLs stored in @/data/products).
 * Identical to the images V1 AurusHomeSections uses from PRODUCTS.aurus.
 * Active in development builds and when VITE_DEMO_ASSETS=true.
 */
export const aurusDemoProvider: DemoAssetProvider = {
  getProductImages(count: number) {
    return PRODUCTS.aurus
      .slice(0, count)
      .map(p => ({ id: p.id, image: p.image }));
  },

  getCategoryImages(count: number) {
    return CATEGORIES.aurus
      .slice(0, count)
      .map(c => ({ img: c.img }));
  },

  getFullProducts(count: number) {
    return PRODUCTS.aurus
      .slice(0, count)
      .map(p => ({ id: p.id, name: p.name, price: p.price, mrp: p.mrp, image: p.image }));
  },
};

// ─── Production implementation ────────────────────────────────────────────────

/**
 * Returns empty strings for all image fields.
 * Components render using their CSS gradient overlay and text content only.
 * No demo images leak into production bundles.
 * Active in production builds (import.meta.env.DEV === false and VITE_DEMO_ASSETS unset).
 */
export const placeholderProvider: DemoAssetProvider = {
  getProductImages(count: number) {
    return Array.from({ length: count }, (_, i) => ({ id: `ph-${i}`, image: '' }));
  },

  getCategoryImages(count: number) {
    return Array.from({ length: count }, () => ({ img: '' }));
  },

  getFullProducts(count: number) {
    return Array.from({ length: count }, (_, i) => ({ id: `ph-${i}`, name: '', price: 0, mrp: 0, image: '' }));
  },
};

// ─── Active provider ──────────────────────────────────────────────────────────

/**
 * The provider injected into ResolverContext by AurusHomeV2.
 *
 * Selection logic:
 *   development build    → aurusDemoProvider  (import.meta.env.DEV === true)
 *   VITE_DEMO_ASSETS=true → aurusDemoProvider  (explicit demo mode override)
 *   production build     → placeholderProvider
 *
 * This is a module-level constant — resolved at build time by Vite.
 * In production, Vite's dead-code elimination removes the demo branch.
 */
export const activeDemoAssetProvider: DemoAssetProvider =
  import.meta.env.DEV || import.meta.env.VITE_DEMO_ASSETS === 'true'
    ? aurusDemoProvider
    : placeholderProvider;
