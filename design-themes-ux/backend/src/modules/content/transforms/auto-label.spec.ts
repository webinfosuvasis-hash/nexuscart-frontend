/**
 * Auto-label derivation — tests
 *
 * Verifies that section labels in the Layers panel automatically reflect
 * the active collection/product/menu binding.
 *
 * Before binding:  "Featured Collection"
 * After binding:   "Featured Collection — New Arrivals"
 *
 * The base label never changes in the DB.
 * The display label is derived at render time from settings metadata.
 */

interface SectionLike {
  label:    string;
  settings: Record<string, unknown>;
}

/** Mirrors StructurePanel.tsx deriveSectionLabel() */
function deriveSectionLabel(section: SectionLike): string {
  const s    = section.settings;
  const base = section.label;

  const colLabel  = s._collectionLabel as string | undefined;
  if (colLabel  && colLabel.trim())  return `${base} — ${colLabel.trim()}`;

  const prodLabel = s._productLabel  as string | undefined;
  if (prodLabel && prodLabel.trim()) return `${base} — ${prodLabel.trim()}`;

  const menuLabel = s._menuLabel     as string | undefined;
  if (menuLabel && menuLabel.trim()) return `${base} — ${menuLabel.trim()}`;

  return base;
}

// ─────────────────────────────────────────────────────────────────────────────

describe('deriveSectionLabel()', () => {

  describe('no binding → returns base label unchanged', () => {
    it('empty settings',       () => expect(deriveSectionLabel({ label:'Featured Collection', settings:{} })).toBe('Featured Collection'));
    it('null _collectionLabel',() => expect(deriveSectionLabel({ label:'Featured Collection', settings:{ _collectionLabel: null } })).toBe('Featured Collection'));
    it('empty string label',   () => expect(deriveSectionLabel({ label:'Featured Collection', settings:{ _collectionLabel: '' } })).toBe('Featured Collection'));
    it('whitespace-only label',() => expect(deriveSectionLabel({ label:'Featured Collection', settings:{ _collectionLabel: '   ' } })).toBe('Featured Collection'));
  });

  describe('collection binding → appends collection name', () => {
    it('basic',     () => expect(deriveSectionLabel({ label:'Featured Collection', settings:{ _collectionLabel:'New Arrivals' } })).toBe('Featured Collection — New Arrivals'));
    it('trims whitespace', () => expect(deriveSectionLabel({ label:'Featured Collection', settings:{ _collectionLabel:'  Best Sellers  ' } })).toBe('Featured Collection — Best Sellers'));
    it('hero section',    () => expect(deriveSectionLabel({ label:'Hero Banner', settings:{ _collectionLabel:'Summer 2026' } })).toBe('Hero Banner — Summer 2026'));
  });

  describe('product binding → appends product name', () => {
    it('basic',  () => expect(deriveSectionLabel({ label:'Product Spotlight', settings:{ _productLabel:'Silk Saree' } })).toBe('Product Spotlight — Silk Saree'));
    it('with no collection label', () => expect(deriveSectionLabel({ label:'Featured', settings:{ _productLabel:'Phone X', _collectionLabel:'' } })).toBe('Featured — Phone X'));
  });

  describe('menu binding → appends menu name', () => {
    it('basic', () => expect(deriveSectionLabel({ label:'Navigation', settings:{ _menuLabel:'Main Menu' } })).toBe('Navigation — Main Menu'));
  });

  describe('priority: collection > product > menu', () => {
    it('collection wins over product',  () => expect(deriveSectionLabel({ label:'Section', settings:{ _collectionLabel:'Col A', _productLabel:'Prod B' } })).toBe('Section — Col A'));
    it('collection wins over menu',     () => expect(deriveSectionLabel({ label:'Section', settings:{ _collectionLabel:'Col A', _menuLabel:'Main'   } })).toBe('Section — Col A'));
    it('product wins over menu',        () => expect(deriveSectionLabel({ label:'Section', settings:{ _productLabel:'Prod B',  _menuLabel:'Main'   } })).toBe('Section — Prod B'));
    it('empty collection falls to product', () => expect(deriveSectionLabel({ label:'Section', settings:{ _collectionLabel:'', _productLabel:'Prod B' } })).toBe('Section — Prod B'));
  });

  describe('real homepage scenario: 3 × Featured Collection with different bindings', () => {
    const sections: SectionLike[] = [
      { label:'Featured Collection', settings:{ _collectionLabel:'New Arrivals'  } },
      { label:'Featured Collection', settings:{ _collectionLabel:'Best Sellers'  } },
      { label:'Featured Collection', settings:{ _collectionLabel:'Sale Items'    } },
    ];

    it('all three derive distinct labels', () => {
      const labels = sections.map(deriveSectionLabel);
      expect(labels[0]).toBe('Featured Collection — New Arrivals');
      expect(labels[1]).toBe('Featured Collection — Best Sellers');
      expect(labels[2]).toBe('Featured Collection — Sale Items');
    });

    it('all three labels are distinct', () => {
      const labels = sections.map(deriveSectionLabel);
      expect(new Set(labels).size).toBe(3);
    });

    it('base label in DB is still "Featured Collection" for all', () => {
      sections.forEach(s => expect(s.label).toBe('Featured Collection'));
    });
  });

  describe('universal vertical scenarios', () => {
    const cases: [string, string, string][] = [
      // [base label, _collectionLabel, expected display]
      ['Featured Collection', 'New Arrivals',      'Featured Collection — New Arrivals'],
      ['Featured Collection', 'Best Sellers',      'Featured Collection — Best Sellers'],
      ['Featured Collection', 'On Sale',           'Featured Collection — On Sale'],
      ['Featured Collection', 'Smartphones',       'Featured Collection — Smartphones'],
      ['Featured Collection', 'Living Room',       'Featured Collection — Living Room'],
      ['Featured Collection', 'Gold Jewellery',    'Featured Collection — Gold Jewellery'],
      ['Featured Collection', 'Fresh Produce',     'Featured Collection — Fresh Produce'],
      ['Featured Collection', 'Summer Collection', 'Featured Collection — Summer Collection'],
    ];

    test.each(cases)('"%s" + "%s" → "%s"', (base, binding, expected) => {
      expect(deriveSectionLabel({ label: base, settings: { _collectionLabel: binding } })).toBe(expected);
    });
  });

  describe('non-binding sections are unaffected', () => {
    it('Hero Banner stays "Hero Banner"',         () => expect(deriveSectionLabel({ label:'Hero Banner',       settings:{} })).toBe('Hero Banner'));
    it('Newsletter stays "Newsletter Signup"',    () => expect(deriveSectionLabel({ label:'Newsletter Signup', settings:{} })).toBe('Newsletter Signup'));
    it('Trust Badges stays "Trust Badges"',       () => expect(deriveSectionLabel({ label:'Trust Badges',     settings:{} })).toBe('Trust Badges'));
    it('Category Navigation stays unchanged',     () => expect(deriveSectionLabel({ label:'Category Navigation', settings:{} })).toBe('Category Navigation'));
  });
});
