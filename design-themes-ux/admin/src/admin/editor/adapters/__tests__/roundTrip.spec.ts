/**
 * Round-trip proof — Phase 0 requirement
 *
 * PageDoc → buildNodeTreeFromPageDoc → buildPageDocFromNodeTree → PageDoc
 * must produce deep-equal output for any well-formed PageDoc.
 *
 * This file uses MOCK_PAGE_DOC (the canonical editor fixture) as the primary
 * test subject.  Additional edge-case fixtures cover every optional field.
 */

import { describe, it, expect } from 'vitest';
import { buildNodeTreeFromPageDoc, buildPageDocFromNodeTree } from '../pageDocNodeTree';
import { MOCK_PAGE_DOC } from '@/admin/editor/editor-mock-data';
import type { PageDoc, BlockDoc, SectionDoc } from '@/admin/editor/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function roundTrip(doc: PageDoc): PageDoc {
  return buildPageDocFromNodeTree(buildNodeTreeFromPageDoc(doc));
}

// ─── Primary proof: MOCK_PAGE_DOC ─────────────────────────────────────────────

describe('MOCK_PAGE_DOC round-trip', () => {
  it('produces a result that deep-equals the original', () => {
    expect(roundTrip(MOCK_PAGE_DOC)).toEqual(MOCK_PAGE_DOC);
  });

  it('preserves pageId, pageTitle, themeId', () => {
    const restored = roundTrip(MOCK_PAGE_DOC);
    expect(restored.pageId).toBe(MOCK_PAGE_DOC.pageId);
    expect(restored.pageTitle).toBe(MOCK_PAGE_DOC.pageTitle);
    expect(restored.themeId).toBe(MOCK_PAGE_DOC.themeId);
  });

  it('preserves groups.header groupId and handle', () => {
    const restored = roundTrip(MOCK_PAGE_DOC);
    expect(restored.groups.header?.groupId).toBe(MOCK_PAGE_DOC.groups.header?.groupId);
    expect(restored.groups.header?.handle).toBe(MOCK_PAGE_DOC.groups.header?.handle);
  });

  it('preserves groups.footer groupId and handle', () => {
    const restored = roundTrip(MOCK_PAGE_DOC);
    expect(restored.groups.footer?.groupId).toBe(MOCK_PAGE_DOC.groups.footer?.groupId);
    expect(restored.groups.footer?.handle).toBe(MOCK_PAGE_DOC.groups.footer?.handle);
  });

  it('preserves the number of page sections', () => {
    const restored = roundTrip(MOCK_PAGE_DOC);
    expect(restored.sections.length).toBe(MOCK_PAGE_DOC.sections.length);
  });

  it('preserves the number of header sections', () => {
    const restored = roundTrip(MOCK_PAGE_DOC);
    expect(restored.groups.header?.sections.length)
      .toBe(MOCK_PAGE_DOC.groups.header?.sections.length);
  });

  // ── Section-level fidelity ─────────────────────────────────────────────────

  it('preserves every page section id, type, label, isVisible', () => {
    const restored = roundTrip(MOCK_PAGE_DOC);
    MOCK_PAGE_DOC.sections.forEach((orig, i) => {
      const got = restored.sections[i];
      expect(got.id).toBe(orig.id);
      expect(got.type).toBe(orig.type);
      expect(got.label).toBe(orig.label);
      expect(got.isVisible).toBe(orig.isVisible);
    });
  });

  it('preserves every page section settings (no pollution from _nx_ keys)', () => {
    const restored = roundTrip(MOCK_PAGE_DOC);
    MOCK_PAGE_DOC.sections.forEach((orig, i) => {
      const gotSettings = restored.sections[i].settings;
      expect(gotSettings).toEqual(orig.settings);
      for (const key of Object.keys(gotSettings)) {
        expect(key.startsWith('_nx_')).toBe(false);
      }
    });
  });

  it('preserves isSystem and groupHandle on header sections', () => {
    const restored = roundTrip(MOCK_PAGE_DOC);
    const origHeader   = MOCK_PAGE_DOC.groups.header!.sections;
    const restoredHeader = restored.groups.header!.sections;
    origHeader.forEach((orig, i) => {
      expect(restoredHeader[i].isSystem).toBe(orig.isSystem);
      expect(restoredHeader[i].groupHandle).toBe(orig.groupHandle);
    });
  });

  // ── Block-level fidelity ───────────────────────────────────────────────────

  it('preserves block count inside each page section', () => {
    const restored = roundTrip(MOCK_PAGE_DOC);
    MOCK_PAGE_DOC.sections.forEach((orig, i) => {
      expect(restored.sections[i].blocks.length).toBe(orig.blocks.length);
    });
  });

  it('preserves every block id, type, isVisible inside page sections', () => {
    const restored = roundTrip(MOCK_PAGE_DOC);
    MOCK_PAGE_DOC.sections.forEach((orig, i) => {
      orig.blocks.forEach((origBlock, j) => {
        const gotBlock = restored.sections[i].blocks[j];
        expect(gotBlock.id).toBe(origBlock.id);
        expect(gotBlock.type).toBe(origBlock.type);
        expect(gotBlock.isVisible).toBe(origBlock.isVisible);
      });
    });
  });

  it('preserves block sortOrder inside page sections', () => {
    const restored = roundTrip(MOCK_PAGE_DOC);
    MOCK_PAGE_DOC.sections.forEach((orig, i) => {
      orig.blocks.forEach((origBlock, j) => {
        expect(restored.sections[i].blocks[j].sortOrder).toBe(origBlock.sortOrder);
      });
    });
  });

  it('preserves block settings with no _nx_ pollution', () => {
    const restored = roundTrip(MOCK_PAGE_DOC);
    MOCK_PAGE_DOC.sections.forEach((orig, i) => {
      orig.blocks.forEach((origBlock, j) => {
        const gotSettings = restored.sections[i].blocks[j].settings;
        expect(gotSettings).toEqual(origBlock.settings);
        for (const key of Object.keys(gotSettings)) {
          expect(key.startsWith('_nx_')).toBe(false);
        }
      });
    });
  });

  it('preserves isRequired on header section blocks', () => {
    const restored = roundTrip(MOCK_PAGE_DOC);
    const origBlocks     = MOCK_PAGE_DOC.groups.header!.sections.flatMap(s => s.blocks);
    const restoredBlocks = restored.groups.header!.sections.flatMap(s => s.blocks);
    origBlocks.forEach((ob, i) => {
      expect(restoredBlocks[i].isRequired).toBe(ob.isRequired);
    });
  });
});

// ─── Edge case: doc with no header/footer groups ──────────────────────────────

describe('round-trip: PageDoc with no header/footer groups', () => {
  const MINIMAL: PageDoc = {
    pageId:    'faq',
    pageTitle: 'FAQ',
    themeId:   'dawn',
    groups:    {},
    sections: [
      { id: 's1', type: 'rich_text', label: 'FAQ text',
        settings: { alignment: 'left' }, isVisible: true, blocks: [] },
    ],
  };

  it('produces deep-equal output', () => {
    expect(roundTrip(MINIMAL)).toEqual(MINIMAL);
  });

  it('does not fabricate groups.header', () => {
    expect(roundTrip(MINIMAL).groups.header).toBeUndefined();
  });

  it('does not fabricate groups.footer', () => {
    expect(roundTrip(MINIMAL).groups.footer).toBeUndefined();
  });
});

// ─── Edge case: invisible sections and blocks ─────────────────────────────────

describe('round-trip: invisible sections and blocks', () => {
  const INVISIBLE_DOC: PageDoc = {
    pageId:    'hidden',
    pageTitle: 'Hidden Page',
    themeId:   'dawn',
    groups:    {},
    sections: [
      {
        id: 'sec_hidden', type: 'hero', label: 'Hidden Hero',
        settings: { height: 'sm' },
        isVisible: false,
        blocks: [
          { id: 'blk_h', type: 'heading', settings: { text: 'Invisible' },
            isVisible: false, isRequired: false, sortOrder: 1 },
        ],
      },
    ],
  };

  it('produces deep-equal output', () => {
    expect(roundTrip(INVISIBLE_DOC)).toEqual(INVISIBLE_DOC);
  });

  it('preserves section isVisible: false', () => {
    expect(roundTrip(INVISIBLE_DOC).sections[0].isVisible).toBe(false);
  });

  it('preserves block isVisible: false', () => {
    expect(roundTrip(INVISIBLE_DOC).sections[0].blocks[0].isVisible).toBe(false);
  });
});

// ─── Edge case: section with many blocks (sortOrder preserved in order) ───────

describe('round-trip: multiple blocks preserve order and sortOrder', () => {
  const blocks: BlockDoc[] = [1, 2, 3, 4, 5].map((n) => ({
    id:        `blk_${n}`,
    type:      'text',
    settings:  { content: `Block ${n}` },
    isVisible: true,
    isRequired:false,
    sortOrder: n * 1.0,
  }));

  const doc: PageDoc = {
    pageId: 'test', pageTitle: 'Test', themeId: 'dawn',
    groups: {},
    sections: [{ id: 's', type: 'stack', label: 'Stack', settings: {}, isVisible: true, blocks }],
  };

  it('produces deep-equal output', () => {
    expect(roundTrip(doc)).toEqual(doc);
  });

  it('preserves block order', () => {
    const restored = roundTrip(doc);
    restored.sections[0].blocks.forEach((b, i) => {
      expect(b.id).toBe(`blk_${i + 1}`);
    });
  });

  it('preserves sortOrder for each block', () => {
    const restored = roundTrip(doc);
    restored.sections[0].blocks.forEach((b, i) => {
      expect(b.sortOrder).toBe(i + 1);
    });
  });
});

// ─── Edge case: settings with nested objects ──────────────────────────────────

describe('round-trip: deep settings objects', () => {
  const DEEP_DOC: PageDoc = {
    pageId: 'deep', pageTitle: 'Deep', themeId: 'dawn',
    groups: {},
    sections: [
      {
        id: 's', type: 'hero', label: 'Hero',
        settings: {
          responsive: { tablet: { height: 'sm' }, mobile: { height: 'auto' } },
          nested:     { a: { b: { c: 42 } } },
          array:      [1, 2, 3],
        },
        isVisible: true,
        blocks: [],
      },
    ],
  };

  it('preserves nested settings objects', () => {
    expect(roundTrip(DEEP_DOC)).toEqual(DEEP_DOC);
  });
});

// ─── Idempotency: second round-trip equals first ──────────────────────────────

describe('idempotency', () => {
  it('round-trip of MOCK_PAGE_DOC is idempotent (RT² = RT¹)', () => {
    const first  = roundTrip(MOCK_PAGE_DOC);
    const second = roundTrip(first);
    expect(second).toEqual(first);
  });
});
