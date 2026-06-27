/**
 * Phase 9 — Compatibility shadow tests
 *
 * Four test groups matching the Phase 9 requirements:
 *
 *   1. save shadow generation  — buildSectionShadow() produces correct payload
 *   2. rollback recovery       — shadow matches what legacy would need
 *   3. node → legacy conversion — types, settings, visibility, sort order
 *   4. structural parity       — MOCK_PAGE_DOC round-trip through shadow
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildSectionShadow, writeSectionShadow } from '../nodeShadowStrategy';
import { buildNodeTreeFromPageDoc }              from '../pageDocNodeTree';
import { MOCK_PAGE_DOC }                         from '@/admin/editor/editor-mock-data';
import type { Node }                             from '@/components/node-renderer/types';
import type { PageDoc }                          from '@/admin/editor/types';

// ─── Mock service ─────────────────────────────────────────────────────────────

vi.mock('@/services/themeEngineService', async () => {
  const actual = await vi.importActual<typeof import('@/services/themeEngineService')>(
    '@/services/themeEngineService',
  );
  return {
    ...actual,
    themeEngineService: {
      ...actual.themeEngineService,
      savePageSections: vi.fn(),
    },
  };
});

import { themeEngineService } from '@/services/themeEngineService';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const TREE = buildNodeTreeFromPageDoc(MOCK_PAGE_DOC);

// A minimal custom doc for targeted tests
const CUSTOM_DOC: PageDoc = {
  pageId:    'test',
  pageTitle: 'Test',
  themeId:   'dawn',
  groups:    {},
  sections: [
    {
      id: 'sec_a', type: 'hero', label: 'Hero',
      settings: { height: 'md', bg: '#1a1a2e' },
      isVisible: true,
      blocks: [
        { id: 'blk_a1', type: 'heading', settings: { text: 'Hello' }, isVisible: true, isRequired: false, sortOrder: 1.0 },
        { id: 'blk_a2', type: 'button',  settings: { label: 'Shop' }, isVisible: true, isRequired: false, sortOrder: 2.0 },
      ],
    },
    {
      id: 'sec_b', type: 'newsletter', label: 'Newsletter',
      settings: { placeholder: 'Email' },
      isVisible: false,    // hidden section
      blocks:   [],
    },
  ],
};

const CUSTOM_TREE = buildNodeTreeFromPageDoc(CUSTOM_DOC);

// ─── 1. Save shadow generation ────────────────────────────────────────────────

describe('buildSectionShadow — shadow generation', () => {
  it('returns an array with one entry per body section', () => {
    const shadow = buildSectionShadow(CUSTOM_TREE);
    expect(shadow).toHaveLength(2);
  });

  it('preserves section type', () => {
    const shadow = buildSectionShadow(CUSTOM_TREE);
    expect(shadow[0].type).toBe('hero');
    expect(shadow[1].type).toBe('newsletter');
  });

  it('preserves section label', () => {
    const shadow = buildSectionShadow(CUSTOM_TREE);
    expect(shadow[0].label).toBe('Hero');
    expect(shadow[1].label).toBe('Newsletter');
  });

  it('preserves section settings', () => {
    const shadow = buildSectionShadow(CUSTOM_TREE);
    expect(shadow[0].settings.height).toBe('md');
    expect(shadow[0].settings.bg).toBe('#1a1a2e');
  });

  it('preserves section visibility', () => {
    const shadow = buildSectionShadow(CUSTOM_TREE);
    expect(shadow[0].isVisible).toBe(true);
    expect(shadow[1].isVisible).toBe(false);
  });

  it('assigns positional sortOrder (1.0, 2.0, …) to sections', () => {
    const shadow = buildSectionShadow(CUSTOM_TREE);
    expect(shadow[0].sortOrder).toBe(1.0);
    expect(shadow[1].sortOrder).toBe(2.0);
  });

  it('preserves block count per section', () => {
    const shadow = buildSectionShadow(CUSTOM_TREE);
    expect(shadow[0].blocks).toHaveLength(2);
    expect(shadow[1].blocks).toHaveLength(0);
  });

  it('returns empty array for a nodeTree with no body sections', () => {
    const emptyDoc: PageDoc = { ...CUSTOM_DOC, sections: [] };
    const shadow = buildSectionShadow(buildNodeTreeFromPageDoc(emptyDoc));
    expect(shadow).toEqual([]);
  });
});

// ─── 2. Rollback recovery ─────────────────────────────────────────────────────

describe('buildSectionShadow — rollback recovery', () => {
  it('shadow sections can be used to restore the legacy ThemePageSection path', () => {
    const shadow = buildSectionShadow(CUSTOM_TREE);
    // Each entry has the four fields savePageSections() requires
    for (const s of shadow) {
      expect(s.type).toBeDefined();
      expect(s.settings).toBeDefined();
      expect(typeof s.isVisible).toBe('boolean');
      expect(typeof s.sortOrder).toBe('number');
      expect(Array.isArray(s.blocks)).toBe(true);
    }
  });

  it('blocks have all required fields for savePageSections', () => {
    const shadow = buildSectionShadow(CUSTOM_TREE);
    const blocks = shadow[0].blocks;
    for (const b of blocks) {
      expect(b.type).toBeDefined();
      expect(b.settings).toBeDefined();
      expect(typeof b.isVisible).toBe('boolean');
      expect(typeof b.sortOrder).toBe('number');
    }
  });

  it('shadow sortOrders are integers × 1.0 (backend expects float)', () => {
    const shadow = buildSectionShadow(CUSTOM_TREE);
    for (let i = 0; i < shadow.length; i++) {
      expect(shadow[i].sortOrder).toBe((i + 1) * 1.0);
    }
  });
});

// ─── 3. Node → legacy conversion ─────────────────────────────────────────────

describe('buildSectionShadow — node-to-legacy conversion', () => {
  it('does NOT include _nx_* metadata keys in section settings', () => {
    const shadow = buildSectionShadow(TREE);
    for (const s of shadow) {
      for (const key of Object.keys(s.settings)) {
        expect(key.startsWith('_nx_')).toBe(false);
      }
    }
  });

  it('does NOT include _nx_* metadata keys in block settings', () => {
    const shadow = buildSectionShadow(TREE);
    for (const s of shadow) {
      for (const b of s.blocks) {
        for (const key of Object.keys(b.settings)) {
          expect(key.startsWith('_nx_')).toBe(false);
        }
      }
    }
  });

  it('preserves block sortOrder from the original _nx_sortOrder metadata', () => {
    const shadow = buildSectionShadow(CUSTOM_TREE);
    const heroBlocks = shadow[0].blocks;
    expect(heroBlocks[0].sortOrder).toBe(1.0);
    expect(heroBlocks[1].sortOrder).toBe(2.0);
  });

  it('preserves block types', () => {
    const shadow = buildSectionShadow(CUSTOM_TREE);
    expect(shadow[0].blocks[0].type).toBe('heading');
    expect(shadow[0].blocks[1].type).toBe('button');
  });

  it('preserves block settings', () => {
    const shadow = buildSectionShadow(CUSTOM_TREE);
    expect(shadow[0].blocks[0].settings.text).toBe('Hello');
    expect(shadow[0].blocks[1].settings.label).toBe('Shop');
  });

  it('preserves block visibility', () => {
    const docWithHiddenBlock: PageDoc = {
      ...CUSTOM_DOC,
      sections: [{
        ...CUSTOM_DOC.sections[0],
        blocks: [{
          id: 'b1', type: 'heading', settings: {}, isVisible: false, sortOrder: 1,
        }],
      }],
    };
    const shadow = buildSectionShadow(buildNodeTreeFromPageDoc(docWithHiddenBlock));
    expect(shadow[0].blocks[0].isVisible).toBe(false);
  });
});

// ─── 4. Structural parity — MOCK_PAGE_DOC round-trip ────────────────────────

describe('buildSectionShadow — structural parity with MOCK_PAGE_DOC', () => {
  const shadow = buildSectionShadow(TREE);

  it('produces the same number of sections as MOCK_PAGE_DOC', () => {
    expect(shadow.length).toBe(MOCK_PAGE_DOC.sections.length);
  });

  it('section types match in order', () => {
    MOCK_PAGE_DOC.sections.forEach((orig, i) => {
      expect(shadow[i].type).toBe(orig.type);
    });
  });

  it('section labels match', () => {
    MOCK_PAGE_DOC.sections.forEach((orig, i) => {
      expect(shadow[i].label).toBe(orig.label);
    });
  });

  it('section visibility matches', () => {
    MOCK_PAGE_DOC.sections.forEach((orig, i) => {
      expect(shadow[i].isVisible).toBe(orig.isVisible);
    });
  });

  it('section settings match (excluding _nx_* keys)', () => {
    MOCK_PAGE_DOC.sections.forEach((orig, i) => {
      // The shadow settings should equal the original settings
      // (original settings never had _nx_* keys)
      expect(shadow[i].settings).toEqual(orig.settings);
    });
  });

  it('block counts match per section', () => {
    MOCK_PAGE_DOC.sections.forEach((orig, i) => {
      expect(shadow[i].blocks.length).toBe(orig.blocks.length);
    });
  });

  it('block types match in order within each section', () => {
    MOCK_PAGE_DOC.sections.forEach((orig, i) => {
      orig.blocks.forEach((origBlock, j) => {
        expect(shadow[i].blocks[j].type).toBe(origBlock.type);
      });
    });
  });

  it('block settings match (no _nx_ pollution)', () => {
    MOCK_PAGE_DOC.sections.forEach((orig, i) => {
      orig.blocks.forEach((origBlock, j) => {
        expect(shadow[i].blocks[j].settings).toEqual(origBlock.settings);
      });
    });
  });

  it('block sortOrders match the original', () => {
    MOCK_PAGE_DOC.sections.forEach((orig, i) => {
      orig.blocks.forEach((origBlock, j) => {
        expect(shadow[i].blocks[j].sortOrder).toBe(origBlock.sortOrder);
      });
    });
  });

  it('shadow is idempotent: applying twice produces same result', () => {
    const first  = buildSectionShadow(TREE);
    const second = buildSectionShadow(TREE);
    expect(first).toEqual(second);
  });
});

// ─── writeSectionShadow ───────────────────────────────────────────────────────

describe('writeSectionShadow', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls savePageSections with the correct pageId', async () => {
    vi.mocked(themeEngineService.savePageSections).mockResolvedValueOnce(undefined);

    await writeSectionShadow('home', TREE);

    expect(themeEngineService.savePageSections).toHaveBeenCalledWith(
      'home',
      expect.any(Array),
      undefined,
    );
  });

  it('passes themeId to savePageSections when provided', async () => {
    vi.mocked(themeEngineService.savePageSections).mockResolvedValueOnce(undefined);

    await writeSectionShadow('home', TREE, 'dawn');

    const [, , themeId] = vi.mocked(themeEngineService.savePageSections).mock.calls[0];
    expect(themeId).toBe('dawn');
  });

  it('calls savePageSections with sections matching buildSectionShadow output', async () => {
    vi.mocked(themeEngineService.savePageSections).mockResolvedValueOnce(undefined);

    await writeSectionShadow('home', TREE);

    const [, sections] = vi.mocked(themeEngineService.savePageSections).mock.calls[0];
    const expected = buildSectionShadow(TREE);
    expect(sections).toEqual(expected);
  });

  it('resolves void on success', async () => {
    vi.mocked(themeEngineService.savePageSections).mockResolvedValueOnce(undefined);

    await expect(writeSectionShadow('home', TREE)).resolves.toBeUndefined();
  });

  it('rethrows errors from savePageSections (caller should .catch)', async () => {
    vi.mocked(themeEngineService.savePageSections).mockRejectedValueOnce(new Error('Network error'));

    await expect(writeSectionShadow('home', TREE)).rejects.toThrow('Network error');
  });
});
