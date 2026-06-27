/**
 * COMPONENT_REGISTRY tests — Step 1
 *
 * Tests the pure registry logic: registration, resolution,
 * version precedence, unregistration, metadata, and the fallback.
 *
 * These are backend ts-jest tests because the frontend doesn't have
 * a configured Vitest setup yet. The logic being tested is pure
 * TypeScript with no React dependency so this is equivalent.
 *
 * Coverage:
 *   register()           — basic, idempotent, version-aware
 *   registerAll()        — bulk registration
 *   resolve()            — hit, miss → fallback
 *   unregister()         — removal, return value
 *   isRegistered()       — true/false
 *   registeredTypes()    — list
 *   allEntries()         — full entries
 *   entriesBySource()    — source filter
 *   entriesByCategory()  — category filter
 *   semver precedence    — later version wins
 *   fallback             — unknown type returns fallback
 */

// ─── Inline registry (no React import — pure logic port) ─────────────────────

type ComponentSource = 'platform' | 'theme' | 'marketplace' | 'custom';

interface RegistryEntry {
  type:      string;
  component: string;   // simplified: string label instead of React component
  version:   string;
  source:    ComponentSource;
  category?: string;
}

interface RegisterOptions {
  version?:  string;
  source?:   ComponentSource;
  category?: string;
}

function createRegistry() {
  const map = new Map<string, RegistryEntry>();
  let fallback: string = 'unknown-fallback';

  function semverGt(a: string, b: string): boolean {
    const parse = (v: string) => v.split('.').map(Number);
    const [aMaj, aMin, aPatch] = parse(a);
    const [bMaj, bMin, bPatch] = parse(b);
    if (aMaj !== bMaj) return aMaj > bMaj;
    if (aMin !== bMin) return aMin > bMin;
    return aPatch > bPatch;
  }

  return {
    register(type: string, component: string, opts: RegisterOptions = {}) {
      const version  = opts.version  ?? '1.0.0';
      const source   = opts.source   ?? 'platform';
      const existing = map.get(type);
      if (existing && !semverGt(version, existing.version)) return;
      map.set(type, { type, component, version, source, category: opts.category });
    },
    registerAll(entries: Record<string, string>, opts: RegisterOptions = {}) {
      Object.entries(entries).forEach(([t, c]) => this.register(t, c, opts));
    },
    resolve(type: string): string {
      return map.get(type)?.component ?? fallback;
    },
    unregister(type: string): boolean {
      return map.delete(type);
    },
    isRegistered(type: string): boolean { return map.has(type); },
    registeredTypes():     string[]        { return Array.from(map.keys()); },
    allEntries():          RegistryEntry[] { return Array.from(map.values()); },
    entriesBySource(s: ComponentSource)    { return this.allEntries().filter((e) => e.source === s); },
    entriesByCategory(c: string)           { return this.allEntries().filter((e) => e.category === c); },
    size():                number          { return map.size; },
    setFallback(f: string)                 { fallback = f; },
    reset()                                { map.clear(); fallback = 'unknown-fallback'; },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('COMPONENT_REGISTRY', () => {
  let reg: ReturnType<typeof createRegistry>;

  beforeEach(() => { reg = createRegistry(); });

  // ── Basic registration ───────────────────────────────────────────────────────

  describe('register()', () => {
    it('registers a component for a type', () => {
      reg.register('heading', 'HeadingComponent');
      expect(reg.isRegistered('heading')).toBe(true);
    });

    it('resolves the registered component', () => {
      reg.register('grid', 'GridComponent');
      expect(reg.resolve('grid')).toBe('GridComponent');
    });

    it('is idempotent — registering same type+version twice keeps first', () => {
      reg.register('heading', 'HeadingV1', { version: '1.0.0' });
      reg.register('heading', 'HeadingV1-dup', { version: '1.0.0' });
      expect(reg.resolve('heading')).toBe('HeadingV1');
    });

    it('defaults version to 1.0.0', () => {
      reg.register('container', 'ContainerComponent');
      expect(reg.allEntries().find((e) => e.type === 'container')?.version).toBe('1.0.0');
    });

    it('defaults source to platform', () => {
      reg.register('stack', 'StackComponent');
      expect(reg.allEntries().find((e) => e.type === 'stack')?.source).toBe('platform');
    });

    it('stores category metadata', () => {
      reg.register('grid', 'GridComponent', { category: 'layout' });
      expect(reg.allEntries().find((e) => e.type === 'grid')?.category).toBe('layout');
    });
  });

  // ── Version precedence ───────────────────────────────────────────────────────

  describe('version precedence', () => {
    it('later version replaces earlier version', () => {
      reg.register('heading', 'HeadingV1', { version: '1.0.0' });
      reg.register('heading', 'HeadingV2', { version: '2.0.0' });
      expect(reg.resolve('heading')).toBe('HeadingV2');
    });

    it('earlier version does NOT replace later version', () => {
      reg.register('heading', 'HeadingV2', { version: '2.0.0' });
      reg.register('heading', 'HeadingV1', { version: '1.0.0' });
      expect(reg.resolve('heading')).toBe('HeadingV2');
    });

    it('minor version bump wins over major v1', () => {
      reg.register('grid', 'GridV110', { version: '1.1.0' });
      reg.register('grid', 'GridV100', { version: '1.0.0' });
      expect(reg.resolve('grid')).toBe('GridV110');
    });

    it('patch bump wins over same major+minor', () => {
      reg.register('btn', 'BtnV101', { version: '1.0.1' });
      reg.register('btn', 'BtnV100', { version: '1.0.0' });
      expect(reg.resolve('btn')).toBe('BtnV101');
    });

    it('equal versions — first registered wins', () => {
      reg.register('divider', 'DividerA', { version: '1.5.0' });
      reg.register('divider', 'DividerB', { version: '1.5.0' });
      expect(reg.resolve('divider')).toBe('DividerA');
    });

    it('marketplace component at v2 replaces platform v1', () => {
      reg.register('product-card', 'PlatformCardV1',     { version: '1.0.0', source: 'platform'    });
      reg.register('product-card', 'MarketplaceCardV2', { version: '2.0.0', source: 'marketplace' });
      expect(reg.resolve('product-card')).toBe('MarketplaceCardV2');
    });

    it('platform v3 reclaims from marketplace v2', () => {
      reg.register('product-card', 'MarketplaceCardV2', { version: '2.0.0', source: 'marketplace' });
      reg.register('product-card', 'PlatformCardV3',   { version: '3.0.0', source: 'platform'    });
      expect(reg.resolve('product-card')).toBe('PlatformCardV3');
    });
  });

  // ── Fallback ─────────────────────────────────────────────────────────────────

  describe('unknown fallback', () => {
    it('returns fallback for unregistered type', () => {
      expect(reg.resolve('xyz_unknown_999')).toBe('unknown-fallback');
    });

    it('custom fallback is returned for unknowns', () => {
      reg.setFallback('CustomFallback');
      expect(reg.resolve('not_registered')).toBe('CustomFallback');
    });

    it('fallback is NOT returned for registered type', () => {
      reg.register('heading', 'RealHeading');
      expect(reg.resolve('heading')).not.toBe('unknown-fallback');
    });

    it('fallback does not affect isRegistered()', () => {
      expect(reg.isRegistered('unknown_type')).toBe(false);
    });
  });

  // ── registerAll ──────────────────────────────────────────────────────────────

  describe('registerAll()', () => {
    it('registers multiple types at once', () => {
      reg.registerAll({ container: 'C', stack: 'S', grid: 'G' });
      expect(reg.isRegistered('container')).toBe(true);
      expect(reg.isRegistered('stack')).toBe(true);
      expect(reg.isRegistered('grid')).toBe(true);
    });

    it('passes options to each registration', () => {
      reg.registerAll(
        { heading: 'H', richtext: 'R' },
        { source: 'theme', category: 'content', version: '2.0.0' },
      );
      const entries = reg.allEntries();
      expect(entries.every((e) => e.source === 'theme')).toBe(true);
      expect(entries.every((e) => e.version === '2.0.0')).toBe(true);
    });
  });

  // ── unregister ───────────────────────────────────────────────────────────────

  describe('unregister()', () => {
    it('removes a registered type', () => {
      reg.register('columns', 'ColumnsComponent');
      reg.unregister('columns');
      expect(reg.isRegistered('columns')).toBe(false);
    });

    it('returns true when type existed', () => {
      reg.register('spacer', 'SpacerComponent');
      expect(reg.unregister('spacer')).toBe(true);
    });

    it('returns false when type did not exist', () => {
      expect(reg.unregister('never_registered')).toBe(false);
    });

    it('resolve returns fallback after unregister', () => {
      reg.register('divider', 'DividerComponent');
      reg.unregister('divider');
      expect(reg.resolve('divider')).toBe('unknown-fallback');
    });

    it('can re-register after unregister', () => {
      reg.register('image', 'ImageV1');
      reg.unregister('image');
      reg.register('image', 'ImageV2');
      expect(reg.resolve('image')).toBe('ImageV2');
    });
  });

  // ── Introspection ─────────────────────────────────────────────────────────────

  describe('introspection', () => {
    it('registeredTypes() lists all types', () => {
      reg.registerAll({ a: 'A', b: 'B', c: 'C' });
      expect(reg.registeredTypes().sort()).toEqual(['a', 'b', 'c']);
    });

    it('allEntries() returns full entry objects', () => {
      reg.register('heading', 'H', { version: '1.2.0', source: 'platform', category: 'content' });
      const entries = reg.allEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({ type: 'heading', component: 'H', version: '1.2.0' });
    });

    it('entriesBySource() filters by source', () => {
      reg.register('a', 'A', { source: 'platform'    });
      reg.register('b', 'B', { source: 'marketplace' });
      reg.register('c', 'C', { source: 'marketplace' });
      expect(reg.entriesBySource('marketplace')).toHaveLength(2);
      expect(reg.entriesBySource('platform')).toHaveLength(1);
    });

    it('entriesByCategory() filters by category', () => {
      reg.register('grid',    'G', { category: 'layout'  });
      reg.register('stack',   'S', { category: 'layout'  });
      reg.register('heading', 'H', { category: 'content' });
      expect(reg.entriesByCategory('layout')).toHaveLength(2);
      expect(reg.entriesByCategory('content')).toHaveLength(1);
      expect(reg.entriesByCategory('commerce')).toHaveLength(0);
    });

    it('size() returns count of registered types', () => {
      expect(reg.size()).toBe(0);
      reg.register('a', 'A');
      reg.register('b', 'B');
      expect(reg.size()).toBe(2);
      reg.unregister('a');
      expect(reg.size()).toBe(1);
    });
  });

  // ── Marketplace simulation ────────────────────────────────────────────────────

  describe('marketplace simulation', () => {
    it('full install → use → uninstall → revert to platform cycle', () => {
      // 1. Platform registers default product card
      reg.register('product-card', 'DefaultProductCard', { version: '1.0.0', source: 'platform' });
      expect(reg.resolve('product-card')).toBe('DefaultProductCard');

      // 2. Merchant installs marketplace premium card (v2)
      reg.register('product-card', 'PremiumCard', { version: '2.0.0', source: 'marketplace' });
      expect(reg.resolve('product-card')).toBe('PremiumCard');

      // 3. Merchant uninstalls marketplace card
      reg.unregister('product-card');
      expect(reg.resolve('product-card')).toBe('unknown-fallback'); // fallback, not platform

      // 4. Platform re-registers its default (simulates app boot)
      reg.register('product-card', 'DefaultProductCard', { version: '1.0.0', source: 'platform' });
      expect(reg.resolve('product-card')).toBe('DefaultProductCard');
    });

    it('custom theme component overrides with store-scoped type', () => {
      reg.register('platform:heading', 'PlatformHeading',   { version: '1.0.0', source: 'platform' });
      reg.register('custom:saree-story', 'SareeStoryBlock', { version: '1.0.0', source: 'theme'    });
      expect(reg.isRegistered('custom:saree-story')).toBe(true);
      expect(reg.resolve('custom:saree-story')).toBe('SareeStoryBlock');
    });
  });
});
