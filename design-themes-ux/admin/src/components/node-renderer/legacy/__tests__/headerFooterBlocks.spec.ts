/**
 * Phase 8 — Header/Footer block registration tests
 *
 * Verifies all block types are registered after importing the public API.
 */

import { describe, it, expect } from 'vitest';
import { isRegistered, resolve } from '@/components/node-renderer/registry';
import Unknown from '@/components/node-renderer/primitives/Unknown';

// Trigger all registrations (platform + Phase 7 legacy sections + Phase 8 blocks)
import '@/components/node-renderer';

// ─── Types under test ─────────────────────────────────────────────────────────

const ANNOUNCEMENT_BLOCKS = ['announcement'] as const;

const HEADER_BLOCKS = [
  'logo', 'menu', 'search', 'cart', 'cart_icon', 'account',
] as const;

const FOOTER_BLOCKS = [
  'copyright', 'footer_column', 'brand_block',
  'nav_column', 'newsletter_form', 'payment_badges', 'social_links',
] as const;

const ALL_BLOCK_TYPES = [
  ...ANNOUNCEMENT_BLOCKS,
  ...HEADER_BLOCKS,
  ...FOOTER_BLOCKS,
] as const;

// ─── 1. Registry registration ─────────────────────────────────────────────────

describe('Header/Footer block registration — isRegistered', () => {
  for (const type of ALL_BLOCK_TYPES) {
    it(`${type} is registered`, () => {
      expect(isRegistered(type)).toBe(true);
    });
  }

  it('spacer is still registered (pre-existing layout primitive)', () => {
    expect(isRegistered('spacer')).toBe(true);
  });
});

// ─── 2. Fallback elimination ──────────────────────────────────────────────────

describe('Header/Footer block registration — Unknown fallback eliminated', () => {
  for (const type of ALL_BLOCK_TYPES) {
    it(`${type} resolves to a component other than Unknown`, () => {
      const component = resolve(type);
      expect(component).not.toBe(Unknown);
      expect(component).toBeDefined();
    });
  }
});

// ─── 3. Alias verification ────────────────────────────────────────────────────

describe('Header/Footer block registration — aliases', () => {
  it('cart and cart_icon resolve to the same component', () => {
    expect(resolve('cart')).toBe(resolve('cart_icon'));
  });
});

// ─── 4. Coverage summary ─────────────────────────────────────────────────────

describe('Phase 8 coverage', () => {
  it('all 14 header/footer block types are registered', () => {
    const registered = ALL_BLOCK_TYPES.filter(isRegistered);
    expect(registered).toHaveLength(ALL_BLOCK_TYPES.length);
    expect(registered).toHaveLength(14);
  });

  it('announcement bar blocks are registered', () => {
    for (const t of ANNOUNCEMENT_BLOCKS) expect(isRegistered(t)).toBe(true);
  });

  it('header blocks are registered', () => {
    for (const t of HEADER_BLOCKS) expect(isRegistered(t)).toBe(true);
  });

  it('footer blocks are registered', () => {
    for (const t of FOOTER_BLOCKS) expect(isRegistered(t)).toBe(true);
  });

  it('Phase 7 section types remain registered', () => {
    for (const t of ['page_root', 'page_group', 'hero', 'newsletter', 'brand_story']) {
      expect(isRegistered(t)).toBe(true);
    }
  });
});
