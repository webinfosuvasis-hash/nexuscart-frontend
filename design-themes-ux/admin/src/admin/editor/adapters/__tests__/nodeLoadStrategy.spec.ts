import { describe, it, expect } from 'vitest';
import { resolveNodeLoadDecision } from '../nodeLoadStrategy';
import type { PageDocumentData } from '@/services/themeEngineService';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const TREE: Record<string, unknown> = {
  id:       'root_home',
  type:     'page_root',
  settings: { pageId: 'home' },
  children: [],
};

const DOC: PageDocumentData = {
  id:            'doc_001',
  storeId:       'store_abc',
  themeId:       'dawn',
  scope:         'PAGE',
  ownerKey:      'home',
  status:        'DRAFT',
  version:       5,
  schemaVersion: 1,
  tree:          TREE,
};

const SECTIONS = [
  { id: 's1', sectionDefId: 'hero', label: 'Hero', settings: {}, blocks: [], isVisible: true },
  { id: 's2', sectionDefId: 'newsletter', label: 'Newsletter', settings: {}, blocks: [], isVisible: true },
];

// ─── node_from_document path ──────────────────────────────────────────────────

describe('resolveNodeLoadDecision — node_from_document', () => {
  it('returns mode node_from_document when doc is present', () => {
    const d = resolveNodeLoadDecision(DOC, null, []);
    expect(d.mode).toBe('node_from_document');
  });

  it('uses the tree from the PageDocument', () => {
    const d = resolveNodeLoadDecision(DOC, null, []);
    expect(d.mode).toBe('node_from_document');
    if (d.mode === 'node_from_document') {
      expect(d.tree).toBe(TREE);
    }
  });

  it('uses the version from the PageDocument', () => {
    const d = resolveNodeLoadDecision(DOC, null, []);
    if (d.mode === 'node_from_document') {
      expect(d.version).toBe(5);
    }
  });

  it('doc takes priority over nodeTree', () => {
    const d = resolveNodeLoadDecision(DOC, TREE, SECTIONS);
    expect(d.mode).toBe('node_from_document');
  });

  it('doc takes priority over sections', () => {
    const d = resolveNodeLoadDecision(DOC, null, SECTIONS);
    expect(d.mode).toBe('node_from_document');
  });

  it('carries version=1 for a freshly created document', () => {
    const newDoc = { ...DOC, version: 1 };
    const d = resolveNodeLoadDecision(newDoc, null, []);
    if (d.mode === 'node_from_document') {
      expect(d.version).toBe(1);
    }
  });

  it('carries any positive version', () => {
    for (const v of [1, 3, 7, 100]) {
      const d = resolveNodeLoadDecision({ ...DOC, version: v }, null, []);
      if (d.mode === 'node_from_document') {
        expect(d.version).toBe(v);
      }
    }
  });
});

// ─── node_from_sections path ──────────────────────────────────────────────────

describe('resolveNodeLoadDecision — node_from_sections', () => {
  it('returns mode node_from_sections when doc is null but nodeTree is present', () => {
    const d = resolveNodeLoadDecision(null, TREE, []);
    expect(d.mode).toBe('node_from_sections');
  });

  it('uses the nodeTree from getDraftPageData', () => {
    const d = resolveNodeLoadDecision(null, TREE, []);
    if (d.mode === 'node_from_sections') {
      expect(d.tree).toBe(TREE);
    }
  });

  it('always has version 0 (document not yet created)', () => {
    const d = resolveNodeLoadDecision(null, TREE, SECTIONS);
    if (d.mode === 'node_from_sections') {
      expect(d.version).toBe(0);
    }
  });

  it('ignores sections when nodeTree is present', () => {
    const d = resolveNodeLoadDecision(null, TREE, SECTIONS);
    expect(d.mode).toBe('node_from_sections');
    // sections not exposed in this mode
    expect('sections' in d).toBe(false);
  });

  it('works with a complex nodeTree', () => {
    const complexTree = {
      ...TREE,
      children: [
        { id: 'grp_body', type: 'page_group', settings: { handle: 'body' }, children: [] },
      ],
    };
    const d = resolveNodeLoadDecision(null, complexTree, []);
    if (d.mode === 'node_from_sections') {
      expect(d.tree).toBe(complexTree);
    }
  });
});

// ─── legacy path ─────────────────────────────────────────────────────────────

describe('resolveNodeLoadDecision — legacy', () => {
  it('returns mode legacy when both doc and nodeTree are null', () => {
    const d = resolveNodeLoadDecision(null, null, SECTIONS);
    expect(d.mode).toBe('legacy');
  });

  it('passes sections through to the legacy decision', () => {
    const d = resolveNodeLoadDecision(null, null, SECTIONS);
    if (d.mode === 'legacy') {
      expect(d.sections).toBe(SECTIONS);
    }
  });

  it('legacy with empty sections array', () => {
    const d = resolveNodeLoadDecision(null, null, []);
    if (d.mode === 'legacy') {
      expect(d.sections).toEqual([]);
    }
  });

  it('no tree or version fields on legacy decision', () => {
    const d = resolveNodeLoadDecision(null, null, SECTIONS);
    expect('tree' in d).toBe(false);
    expect('version' in d).toBe(false);
  });
});

// ─── Priority invariants ──────────────────────────────────────────────────────

describe('resolveNodeLoadDecision — priority invariants', () => {
  it('doc always wins over nodeTree', () => {
    expect(resolveNodeLoadDecision(DOC, TREE, SECTIONS).mode).toBe('node_from_document');
  });

  it('doc always wins over sections', () => {
    expect(resolveNodeLoadDecision(DOC, null, SECTIONS).mode).toBe('node_from_document');
  });

  it('nodeTree wins over sections (not legacy)', () => {
    expect(resolveNodeLoadDecision(null, TREE, SECTIONS).mode).toBe('node_from_sections');
  });

  it('priority order: document > sections > legacy', () => {
    expect(resolveNodeLoadDecision(DOC, TREE, SECTIONS).mode).toBe('node_from_document');
    expect(resolveNodeLoadDecision(null, TREE, SECTIONS).mode).toBe('node_from_sections');
    expect(resolveNodeLoadDecision(null, null, SECTIONS).mode).toBe('legacy');
  });
});

// ─── First-time load scenarios ────────────────────────────────────────────────

describe('resolveNodeLoadDecision — first-time scenarios', () => {
  it('fresh store, flag OFF → legacy with empty sections', () => {
    const d = resolveNodeLoadDecision(null, null, []);
    expect(d.mode).toBe('legacy');
    if (d.mode === 'legacy') expect(d.sections).toEqual([]);
  });

  it('fresh store, flag ON, no PageDocument yet → node_from_sections with version 0', () => {
    // getDraftPageData returns nodeTree built from empty ThemePageSections
    const emptyTree = { id: 'root_home', type: 'page_root', settings: {}, children: [] };
    const d = resolveNodeLoadDecision(null, emptyTree, []);
    expect(d.mode).toBe('node_from_sections');
    if (d.mode === 'node_from_sections') expect(d.version).toBe(0);
  });

  it('existing store, flag ON, PageDocument exists → node_from_document with real version', () => {
    const d = resolveNodeLoadDecision(DOC, TREE, []);
    expect(d.mode).toBe('node_from_document');
    if (d.mode === 'node_from_document') expect(d.version).toBeGreaterThan(0);
  });
});
