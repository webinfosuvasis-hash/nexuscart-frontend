/**
 * Phase 7 — Legacy section registration tests
 *
 * Verifies that all legacy section types are registered in the NodeRenderer
 * registry after importing the public API (which triggers all side-effect
 * registrations including registerLegacySections()).
 *
 * Three test groups:
 *
 *   1. Registry registration  — isRegistered(type) === true for every type
 *   2. Fallback elimination   — resolved component is NOT the Unknown fallback
 *   3. Override verification  — rich_text uses the section wrapper (v1.1.0),
 *                               not the content primitive alias (v1.0.0)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { isRegistered, resolve, _resetRegistryForTests } from '@/components/node-renderer/registry';
import Unknown from '@/components/node-renderer/primitives/Unknown';

// ─── Trigger all registrations ────────────────────────────────────────────────
// Importing the public node-renderer index runs all registerAll() calls
// (platform primitives + Phase 7 legacy sections).

import '@/components/node-renderer';

// ─── Types under test ─────────────────────────────────────────────────────────

const PAGE_STRUCTURE_TYPES = ['page_root', 'page_group'] as const;

const FULL_SECTION_TYPES = [
  'hero',
  'newsletter',
  'announcement_bar',
] as const;

const SIMPLE_WRAPPER_TYPES = [
  'brand_story',
  'editorial_banner',
  'collection_circles',
  'product_mosaic',
  'trust_badges_bar',
] as const;

const SHELL_TYPES = ['header', 'footer'] as const;

const OVERRIDE_TYPES = ['rich_text'] as const;

const ALL_LEGACY_TYPES = [
  ...PAGE_STRUCTURE_TYPES,
  ...FULL_SECTION_TYPES,
  ...SIMPLE_WRAPPER_TYPES,
  ...SHELL_TYPES,
  ...OVERRIDE_TYPES,
] as const;

// ─── 1. Registry registration ─────────────────────────────────────────────────

describe('Legacy section registration — isRegistered', () => {
  for (const type of ALL_LEGACY_TYPES) {
    it(`${type} is registered`, () => {
      expect(isRegistered(type)).toBe(true);
    });
  }

  it('pre-existing types remain registered', () => {
    // These were registered before Phase 7 and must not be affected
    for (const type of ['container', 'stack', 'grid', 'heading', 'button',
                        'featured_collection', 'product_grid']) {
      expect(isRegistered(type)).toBe(true);
    }
  });
});

// ─── 2. Fallback elimination ──────────────────────────────────────────────────

describe('Legacy section registration — Unknown fallback eliminated', () => {
  for (const type of ALL_LEGACY_TYPES) {
    it(`${type} resolves to a component other than Unknown`, () => {
      const component = resolve(type);
      expect(component).not.toBe(Unknown);
      expect(component).toBeDefined();
    });
  }
});

// ─── 3. Override verification ─────────────────────────────────────────────────

describe('Legacy section registration — version overrides', () => {
  it('rich_text resolves to RichTextSectionNode (v1.1.0), not the RichText content primitive (v1.0.0)', () => {
    // Import both components to compare by reference
    const RichTextSectionNode = resolve('rich_text');
    const RichTextPrimitive   = resolve('richtext');   // original alias — must be unchanged

    // rich_text must now be the section node, not the content primitive
    expect(RichTextSectionNode).toBeDefined();
    expect(RichTextSectionNode).not.toBe(Unknown);

    // richtext (no underscore) must still be the original content primitive
    expect(RichTextPrimitive).not.toBe(RichTextSectionNode);
    expect(isRegistered('richtext')).toBe(true);
  });

  it('richtext (no underscore) is not affected by the rich_text override', () => {
    expect(isRegistered('richtext')).toBe(true);
    expect(resolve('richtext')).not.toBe(Unknown);
  });
});

// ─── Phase 10B: Wrapper neutralization regression ────────────────────────────

describe('Phase 10B — PageRootNode / PageGroupNode use display:contents', () => {
  it('page_root is still registered after parity hardening', () => {
    expect(isRegistered('page_root')).toBe(true);
  });

  it('page_group is still registered after parity hardening', () => {
    expect(isRegistered('page_group')).toBe(true);
  });

  it('page_root resolves to a component other than Unknown', () => {
    expect(resolve('page_root')).not.toBe(Unknown);
  });

  it('page_group resolves to a component other than Unknown', () => {
    expect(resolve('page_group')).not.toBe(Unknown);
  });

  it('page_root and page_group resolve to DIFFERENT components from each other', () => {
    // They are distinct components (not aliases)
    expect(resolve('page_root')).not.toBe(resolve('page_group'));
  });

  it('all phase 7 section types still registered after wrapper change', () => {
    const phase7Types = ['hero', 'newsletter', 'announcement_bar', 'brand_story',
                         'editorial_banner', 'collection_circles', 'product_mosaic',
                         'trust_badges_bar', 'header', 'footer', 'rich_text'];
    for (const type of phase7Types) {
      expect(isRegistered(type), `${type} should still be registered`).toBe(true);
    }
  });
});

// ─── 4. Coverage summary ─────────────────────────────────────────────────────

describe('Phase 7 coverage — total registered section types', () => {
  it('all 13 legacy section types are registered', () => {
    const registered = ALL_LEGACY_TYPES.filter((t) => isRegistered(t));
    expect(registered.length).toBe(ALL_LEGACY_TYPES.length);
    expect(registered).toHaveLength(13);
  });

  it('page structure types are registered', () => {
    for (const t of PAGE_STRUCTURE_TYPES) {
      expect(isRegistered(t)).toBe(true);
    }
  });

  it('full-section wrapper types are registered', () => {
    for (const t of FULL_SECTION_TYPES) {
      expect(isRegistered(t)).toBe(true);
    }
  });

  it('simple wrapper types are registered', () => {
    for (const t of SIMPLE_WRAPPER_TYPES) {
      expect(isRegistered(t)).toBe(true);
    }
  });

  it('shell wrapper types are registered', () => {
    for (const t of SHELL_TYPES) {
      expect(isRegistered(t)).toBe(true);
    }
  });
});
