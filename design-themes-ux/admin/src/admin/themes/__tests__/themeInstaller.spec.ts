/**
 * Theme Installer tests — Phase 1 + enhancements
 *
 * Suites:
 *   1. ThemeRegistry
 *   2. buildSectionFromSeed / buildPageDocFromTheme
 *   3. Kaveri 1.0 definition
 *   4. Kaveri 1.1 definition
 *   5. semver helpers
 *   6. Install record helpers
 *   7. MigrationRegistry
 *   8. Kaveri 1.0 → 1.1 migration
 *   9. diffTokens
 *  10. Auto-registration (definitions/index side-effect)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { themeRegistry }           from '../registry';
import { migrationRegistry }       from '../migrations';
import { kaveri }                  from '../definitions/kaveri';
import { kaveriV1_1 }              from '../definitions/kaveri-v1.1';
import {
  buildSectionFromSeed,
  buildPageDocFromTheme,
}                                  from '../themePageDocBuilder';
import {
  semverGt, semverEq,
  buildInstallRecord, buildInstallSettings,
  THEME_INSTALL_KEY,
  canUpgrade,
  availableUpgrade,
}                                  from '../themeVersion';
import { diffTokens }              from '../themeTokens';
import type { ThemeDefinition }    from '../types';
import { buildNodeTreeFromPageDoc, buildPageDocFromNodeTree } from '@/admin/editor/adapters/pageDocNodeTree';
import type { Node } from '@/components/node-renderer/types';

// ─── Stub theme ───────────────────────────────────────────────────────────────

const STUB: ThemeDefinition = {
  meta: {
    id: 'stub', name: 'Stub', version: '1.0.0',
    category: 'lifestyle', description: 'Test', previewImage: '/stub.jpg',
    tags: [], vertical: 'Test', author: 'NexusCart', createdAt: '2026-01-01',
  },
  colors: { primary:'#000', secondary:'#fff', accent:'#ccc', background:'#fff', surface:'#f9f9f9', text:'#111', muted:'#888' },
  typography: { headingFont:'Inter', bodyFont:'Inter', baseSizeRem:1, lineHeight:1.5 },
  pages: {
    home: {
      pageId: 'home', title: 'Home page',
      sections: [
        {
          key: 'hero', type: 'hero', label: 'Hero',
          settings: { height: 'md', backgroundColor: '#000' },
          blocks: [
            { type: 'heading', settings: { text: 'Hello' } },
            { type: 'button',  settings: { label: 'Shop' } },
          ],
        },
        {
          key: 'newsletter', type: 'newsletter', label: 'Newsletter',
          settings: { placeholder: 'Email' }, blocks: [],
        },
      ],
    },
  },
};

// ─── 1. ThemeRegistry ─────────────────────────────────────────────────────────

describe('ThemeRegistry', () => {
  beforeEach(() => themeRegistry._reset());

  it('registers and retrieves a theme', () => {
    themeRegistry.register(STUB);
    expect(themeRegistry.get('stub').meta.id).toBe('stub');
  });

  it('throws on missing theme with helpful message', () => {
    themeRegistry.register(STUB);
    expect(() => themeRegistry.get('ghost')).toThrow(/ghost/);
  });

  it('has() + size()', () => {
    expect(themeRegistry.has('stub')).toBe(false);
    themeRegistry.register(STUB);
    expect(themeRegistry.has('stub')).toBe(true);
    expect(themeRegistry.size()).toBe(1);
  });

  it('list() returns all metas', () => {
    themeRegistry.register(STUB);
    expect(themeRegistry.list().map(m => m.id)).toContain('stub');
  });

  it('byCategory() filters', () => {
    themeRegistry.register(STUB);
    themeRegistry.register(kaveri);
    expect(themeRegistry.byCategory('fashion')).toHaveLength(1);
    expect(themeRegistry.byCategory('lifestyle')).toHaveLength(1);
    expect(themeRegistry.byCategory('jewelry')).toHaveLength(0);
  });

  it('re-registering replaces the entry', () => {
    themeRegistry.register(STUB);
    themeRegistry.register({ ...STUB, meta: { ...STUB.meta, version: '2.0.0' } });
    expect(themeRegistry.get('stub').meta.version).toBe('2.0.0');
    expect(themeRegistry.size()).toBe(1);
  });

  it('_reset() clears all', () => {
    themeRegistry.register(STUB);
    themeRegistry._reset();
    expect(themeRegistry.size()).toBe(0);
  });
});

// ─── 2. buildSectionFromSeed / buildPageDocFromTheme ─────────────────────────

describe('buildSectionFromSeed', () => {
  const seed = STUB.pages.home.sections[0];

  it('generates stable ID: {themeId}_{key}', () => {
    expect(buildSectionFromSeed('stub', seed).id).toBe('stub_hero');
  });

  it('preserves type, label, settings', () => {
    const s = buildSectionFromSeed('stub', seed);
    expect(s.type).toBe('hero');
    expect(s.label).toBe('Hero');
    expect(s.settings.height).toBe('md');
  });

  it('generates block IDs: {themeId}_{key}_blk_{idx}', () => {
    const s = buildSectionFromSeed('stub', seed);
    expect(s.blocks[0].id).toBe('stub_hero_blk_0');
    expect(s.blocks[1].id).toBe('stub_hero_blk_1');
  });

  it('assigns sortOrder 1.0, 2.0, …', () => {
    const s = buildSectionFromSeed('stub', seed);
    expect(s.blocks[0].sortOrder).toBe(1.0);
    expect(s.blocks[1].sortOrder).toBe(2.0);
  });
});

describe('buildPageDocFromTheme', () => {
  const doc = buildPageDocFromTheme(STUB, STUB.pages.home);

  it('sets pageId and pageTitle', () => {
    expect(doc.pageId).toBe('home');
    expect(doc.pageTitle).toBe('Home page');
  });

  it('sections count matches theme', () => {
    expect(doc.sections).toHaveLength(2);
  });

  it('includes default header/footer groups', () => {
    expect(doc.groups.header).toBeDefined();
    expect(doc.groups.footer).toBeDefined();
  });

  it('section IDs are namespaced', () => {
    expect(doc.sections[0].id).toBe('stub_hero');
  });
});

// ─── 3. Kaveri 1.0 definition ─────────────────────────────────────────────────

describe('Kaveri 1.0 definition', () => {
  it('has id kaveri, version 1.0.0, category fashion', () => {
    expect(kaveri.meta.id).toBe('kaveri');
    expect(kaveri.meta.version).toBe('1.0.0');
    expect(kaveri.meta.category).toBe('fashion');
  });

  it('has 11 body sections', () => {
    expect(kaveri.pages.home.sections).toHaveLength(11);
  });

  it('has 3 featured_collection sections', () => {
    const fc = kaveri.pages.home.sections.filter(s => s.type === 'featured_collection');
    expect(fc).toHaveLength(3);
  });

  it('collection pickers are unset', () => {
    kaveri.pages.home.sections
      .filter(s => s.type === 'featured_collection')
      .forEach(s => expect(s.settings.collection == null || s.settings.collection === '').toBe(true));
  });

  it('trust_badges_bar has 4 badges', () => {
    const trust = kaveri.pages.home.sections.find(s => s.type === 'trust_badges_bar')!;
    expect((trust.settings.badges as any[]).length).toBe(4);
  });

  it('collection_circles has 6 items', () => {
    const circles = kaveri.pages.home.sections.find(s => s.type === 'collection_circles')!;
    expect((circles.settings.items as any[]).length).toBe(6);
  });

  it('product_mosaic has 1 featured item', () => {
    const mosaic = kaveri.pages.home.sections.find(s => s.type === 'product_mosaic')!;
    expect((mosaic.settings.items as any[]).filter((i: any) => i.featured)).toHaveLength(1);
  });

  it('colors are valid hex', () => {
    for (const [k, v] of Object.entries(kaveri.colors)) {
      expect(v, `colors.${k}`).toMatch(/^#[0-9A-Fa-f]{3,8}$/);
    }
  });
});

// ─── 4. Kaveri 1.1 definition ─────────────────────────────────────────────────

describe('Kaveri 1.1 definition', () => {
  it('has version 1.1.0', () => {
    expect(kaveriV1_1.meta.version).toBe('1.1.0');
  });

  it('has 12 body sections (11 + editorial-2)', () => {
    expect(kaveriV1_1.pages.home.sections).toHaveLength(12);
  });

  it('includes editorial-2 section', () => {
    const keys = kaveriV1_1.pages.home.sections.map(s => s.key);
    expect(keys).toContain('editorial-2');
  });

  it('editorial-2 is between mosaic and sale', () => {
    const sections = kaveriV1_1.pages.home.sections;
    const mosaicIdx     = sections.findIndex(s => s.key === 'mosaic');
    const editorial2Idx = sections.findIndex(s => s.key === 'editorial-2');
    const saleIdx       = sections.findIndex(s => s.key === 'sale');
    expect(editorial2Idx).toBe(mosaicIdx + 1);
    expect(saleIdx).toBe(editorial2Idx + 1);
  });

  it('trust_badges_bar has 5 badges', () => {
    const trust = kaveriV1_1.pages.home.sections.find(s => s.type === 'trust_badges_bar')!;
    expect((trust.settings.badges as any[]).length).toBe(5);
  });

  it('brand story copy is updated', () => {
    const story = kaveriV1_1.pages.home.sections.find(s => s.key === 'brand-story')!;
    expect(story.settings.body).toContain('certified');
  });
});

// ─── 5. semver helpers ────────────────────────────────────────────────────────

describe('semverGt / semverEq', () => {
  it('1.1.0 > 1.0.0', ()  => expect(semverGt('1.1.0', '1.0.0')).toBe(true));
  it('2.0.0 > 1.9.9', ()  => expect(semverGt('2.0.0', '1.9.9')).toBe(true));
  it('1.0.0 not > 1.0.0', () => expect(semverGt('1.0.0', '1.0.0')).toBe(false));
  it('1.0.0 not > 1.0.1', () => expect(semverGt('1.0.0', '1.0.1')).toBe(false));
  it('1.0.0 eq 1.0.0',    () => expect(semverEq('1.0.0', '1.0.0')).toBe(true));
  it('1.0.0 not eq 1.0.1', () => expect(semverEq('1.0.0', '1.0.1')).toBe(false));
});

// ─── 6. Install record helpers ────────────────────────────────────────────────

describe('buildInstallRecord / buildInstallSettings', () => {
  it('buildInstallRecord has required fields', () => {
    const r = buildInstallRecord('kaveri', '1.0.0', 'home');
    expect(r.themeId).toBe('kaveri');
    expect(r.version).toBe('1.0.0');
    expect(r.pageId).toBe('home');
    expect(typeof r.installedAt).toBe('string');
  });

  it('buildInstallSettings wraps record under THEME_INSTALL_KEY', () => {
    const r   = buildInstallRecord('kaveri', '1.0.0', 'home');
    const s   = buildInstallSettings(r);
    expect(s[THEME_INSTALL_KEY]).toEqual(r);
  });

  it('buildInstallSettings merges with existing settings', () => {
    const r = buildInstallRecord('kaveri', '1.0.0', 'home');
    const s = buildInstallSettings(r, { _seo: { title: 'Home' } });
    expect(s._seo).toEqual({ title: 'Home' });
    expect(s[THEME_INSTALL_KEY]).toBeDefined();
  });

  it('canUpgrade: false when null installed', () => {
    themeRegistry._reset();
    themeRegistry.register(kaveriV1_1);
    expect(canUpgrade(null, themeRegistry)).toBe(false);
  });

  it('canUpgrade: false when already at latest', () => {
    themeRegistry._reset();
    themeRegistry.register(kaveriV1_1);
    const r = buildInstallRecord('kaveri', '1.1.0', 'home');
    expect(canUpgrade(r, themeRegistry)).toBe(false);
  });

  it('canUpgrade: true when newer version available', () => {
    themeRegistry._reset();
    themeRegistry.register(kaveriV1_1);
    const r = buildInstallRecord('kaveri', '1.0.0', 'home');
    expect(canUpgrade(r, themeRegistry)).toBe(true);
  });

  it('availableUpgrade: returns new version string', () => {
    themeRegistry._reset();
    themeRegistry.register(kaveriV1_1);
    const r = buildInstallRecord('kaveri', '1.0.0', 'home');
    expect(availableUpgrade(r, themeRegistry)).toBe('1.1.0');
  });

  it('availableUpgrade: null when up to date', () => {
    themeRegistry._reset();
    themeRegistry.register(kaveriV1_1);
    const r = buildInstallRecord('kaveri', '1.1.0', 'home');
    expect(availableUpgrade(r, themeRegistry)).toBeNull();
  });
});

// ─── 7. MigrationRegistry ─────────────────────────────────────────────────────
// Uses unique theme IDs ('reg-alpha', 'reg-beta') to avoid interfering with
// the kaveri migrations already registered from definitions/index.ts.
// No _reset() needed — isolated by themeId.

describe('MigrationRegistry', () => {
  const m1 = { themeId:'reg-alpha', fromVersion:'1.0.0', toVersion:'1.1.0', description:'m1', migrate: (d: any) => d };
  const m2 = { themeId:'reg-alpha', fromVersion:'1.1.0', toVersion:'1.2.0', description:'m2', migrate: (d: any) => d };

  it('registers and lists migrations', () => {
    migrationRegistry.register(m1);
    const found = migrationRegistry.list().filter(m => m.themeId === 'reg-alpha');
    expect(found.length).toBeGreaterThanOrEqual(1);
  });

  it('duplicate registration is ignored', () => {
    migrationRegistry.register(m1);
    migrationRegistry.register(m1);
    const found = migrationRegistry.list().filter(m => m.themeId === 'reg-alpha' && m.toVersion === '1.1.0');
    expect(found).toHaveLength(1);
  });

  it('findChain returns empty when versions equal', () => {
    migrationRegistry.register(m1);
    expect(migrationRegistry.findChain('reg-alpha', '1.0.0', '1.0.0')).toHaveLength(0);
  });

  it('findChain returns the migration for 1.0.0→1.1.0', () => {
    migrationRegistry.register(m1);
    const chain = migrationRegistry.findChain('reg-alpha', '1.0.0', '1.1.0');
    expect(chain).toHaveLength(1);
    expect(chain[0].toVersion).toBe('1.1.0');
  });

  it('findChain returns both migrations for 1.0.0→1.2.0', () => {
    migrationRegistry.register(m1);
    migrationRegistry.register(m2);
    const chain = migrationRegistry.findChain('reg-alpha', '1.0.0', '1.2.0');
    expect(chain).toHaveLength(2);
  });

  it('chain is sorted ascending by toVersion', () => {
    migrationRegistry.register(m2);
    migrationRegistry.register(m1);
    const chain = migrationRegistry.findChain('reg-alpha', '1.0.0', '1.2.0');
    expect(chain[0].toVersion).toBe('1.1.0');
    expect(chain[1].toVersion).toBe('1.2.0');
  });

  it('applyChain transforms the doc through each migration in order', () => {
    const addX = { themeId:'reg-beta', fromVersion:'1.0.0', toVersion:'1.1.0', description:'addX',
      migrate: (d: any) => ({ ...d, _x: true }) };
    const addY = { themeId:'reg-beta', fromVersion:'1.1.0', toVersion:'1.2.0', description:'addY',
      migrate: (d: any) => ({ ...d, _y: true }) };
    migrationRegistry.register(addX);
    migrationRegistry.register(addY);

    const chain  = migrationRegistry.findChain('reg-beta', '1.0.0', '1.2.0');
    const result = migrationRegistry.applyChain(
      { pageId:'home', pageTitle:'T', themeId:'reg-beta', groups:{}, sections:[] } as any,
      chain, kaveri,
    );
    expect((result as any)._x).toBe(true);
    expect((result as any)._y).toBe(true);
  });
});

// ─── 8. Kaveri 1.0 → 1.1 migration ───────────────────────────────────────────
// The migration is registered as a side-effect of definitions/index.ts.
// We load it once at module level and reference the singleton registries.
import '../definitions/index';

describe('Kaveri 1.0 → 1.1 migration', () => {
  // Build a 1.0.0 PageDoc to migrate (fresh per describe)
  const doc10 = buildPageDocFromTheme(kaveri, kaveri.pages.home);

  it('findChain returns exactly 1 migration for 1.0.0→1.1.0', () => {
    const chain = migrationRegistry.findChain('kaveri', '1.0.0', '1.1.0');
    expect(chain).toHaveLength(1);
  });

  it('adds editorial-2 after mosaic', () => {
    const chain = migrationRegistry.findChain('kaveri', '1.0.0', '1.1.0');
    const migrated = migrationRegistry.applyChain(doc10, chain, kaveriV1_1);
    const keys = migrated.sections.map(s => s.id);

    expect(keys).toContain('kaveri_editorial-2');
    const mosaicIdx     = keys.indexOf('kaveri_mosaic');
    const editorial2Idx = keys.indexOf('kaveri_editorial-2');
    expect(editorial2Idx).toBe(mosaicIdx + 1);
  });

  it('adds 5th trust badge', () => {
    const chain = migrationRegistry.findChain('kaveri', '1.0.0', '1.1.0');
    const migrated = migrationRegistry.applyChain(doc10, chain, kaveriV1_1);
    const trust = migrated.sections.find(s => s.id === 'kaveri_trust')!;
    expect((trust.settings.badges as any[]).length).toBe(5);
  });

  it('is idempotent: applying twice = applying once', () => {
    const chain = migrationRegistry.findChain('kaveri', '1.0.0', '1.1.0');
    const once  = migrationRegistry.applyChain(doc10, chain, kaveriV1_1);
    const twice = migrationRegistry.applyChain(once,  chain, kaveriV1_1);

    expect(twice.sections.map(s => s.id)).toEqual(once.sections.map(s => s.id));
    const trustOnce  = (once.sections.find(s => s.id === 'kaveri_trust')!.settings.badges as any[]).length;
    const trustTwice = (twice.sections.find(s => s.id === 'kaveri_trust')!.settings.badges as any[]).length;
    expect(trustTwice).toBe(trustOnce);
  });

  it('does NOT update brand story when merchant has customised it', () => {
    const chain = migrationRegistry.findChain('kaveri', '1.0.0', '1.1.0');
    const customised = {
      ...doc10,
      sections: doc10.sections.map(s =>
        s.id === 'kaveri_brand-story'
          ? { ...s, settings: { ...s.settings, body: 'Custom merchant copy.' } }
          : s,
      ),
    };
    const migrated = migrationRegistry.applyChain(customised, chain, kaveriV1_1);
    const story    = migrated.sections.find(s => s.id === 'kaveri_brand-story')!;
    expect(story.settings.body).toBe('Custom merchant copy.');
  });
});

// ─── 9. diffTokens ────────────────────────────────────────────────────────────

describe('diffTokens', () => {
  const v1 = { primary: '#000', accent: '#ccc', background: '#fff' };
  const v2 = { primary: '#111', accent: '#ccc', background: '#fff', surface: '#f9f9f9' };

  it('returns keys that changed', () => {
    const diff = diffTokens(v1, v2);
    expect(diff).toContain('primary');
    expect(diff).not.toContain('accent');
    expect(diff).not.toContain('background');
  });

  it('returns new keys added in v2', () => {
    expect(diffTokens(v1, v2)).toContain('surface');
  });

  it('returns empty array when no changes', () => {
    expect(diffTokens(v1, v1)).toHaveLength(0);
  });
});

// ─── 10. Auto-registration ────────────────────────────────────────────────────

describe('definitions/index auto-registration', () => {
  it('themes/index exports applyTheme and upgradeTheme', async () => {
    const mod = await import('../index');
    expect(typeof mod.applyTheme).toBe('function');
    expect(typeof mod.upgradeTheme).toBe('function');
  });

  it('themes/index exports themeRegistry and migrationRegistry', async () => {
    const mod = await import('../index');
    expect(typeof mod.themeRegistry).toBe('object');
    expect(typeof mod.migrationRegistry).toBe('object');
  });
});
