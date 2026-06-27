import { describe, it, expect } from 'vitest';
import {
  buildNodeTreeFromPageDoc,
  buildPageDocFromNodeTree,
  getBodySections,
  getHeaderSections,
  getFooterSections,
  PAGE_ROOT_TYPE,
  PAGE_GROUP_TYPE,
} from '../pageDocNodeTree';
import type { PageDoc } from '@/admin/editor/types';
import type { Node } from '@/components/node-renderer/types';

// ─── Minimal fixture (no header/footer groups) ────────────────────────────────

const MINIMAL_DOC: PageDoc = {
  pageId:    'about',
  pageTitle: 'About Us',
  themeId:   'dawn',
  groups:    {},
  sections: [
    {
      id: 'sec_a', type: 'rich_text', label: 'About text',
      settings: { alignment: 'center' },
      isVisible: true, blocks: [],
    },
  ],
};

// ─── Full fixture (header + footer + body sections) ───────────────────────────

const FULL_DOC: PageDoc = {
  pageId:    'home',
  pageTitle: 'Home page',
  themeId:   'midnight',
  groups: {
    header: {
      groupId:  'grp_hdr_001',
      handle:   'header',
      sections: [
        {
          id: 'sec_ann_001', type: 'announcement_bar', label: 'Announcement bar',
          settings: { background: '#4f46e5' },
          isVisible: true, isSystem: true, groupHandle: 'header',
          blocks: [
            { id: 'blk_ann_001', type: 'announcement', settings: { text: 'Sale!' },
              isVisible: true, isRequired: false, sortOrder: 1.0 },
          ],
        },
      ],
    },
    footer: {
      groupId:  'grp_ftr_001',
      handle:   'footer',
      sections: [
        {
          id: 'sec_ftr_001', type: 'footer', label: 'Footer',
          settings: { background: '#111827' },
          isVisible: true, isSystem: true, groupHandle: 'footer',
          blocks: [
            { id: 'blk_copy_001', type: 'copyright',
              settings: { text: '© 2026 My Store' },
              isVisible: true, isRequired: false, sortOrder: 1.0 },
          ],
        },
      ],
    },
  },
  sections: [
    {
      id: 'sec_hero_001', type: 'hero', label: 'Hero',
      settings: { height: 'md', backgroundColor: '#1a1a2e' },
      isVisible: true,
      blocks: [
        { id: 'blk_h1', type: 'heading', settings: { text: 'Welcome' },
          isVisible: true, isRequired: false, sortOrder: 1.0 },
      ],
    },
    {
      id: 'sec_nl_001', type: 'newsletter', label: 'Newsletter',
      settings: { buttonLabel: 'Subscribe' },
      isVisible: true, blocks: [],
    },
  ],
};

// ─── buildNodeTreeFromPageDoc ─────────────────────────────────────────────────

describe('buildNodeTreeFromPageDoc', () => {
  describe('root node', () => {
    it('has type page_root', () => {
      expect(buildNodeTreeFromPageDoc(FULL_DOC).type).toBe(PAGE_ROOT_TYPE);
    });

    it('has stable id root_{pageId}', () => {
      expect(buildNodeTreeFromPageDoc(FULL_DOC).id).toBe('root_home');
    });

    it('stores pageId, pageTitle, themeId in settings', () => {
      const root = buildNodeTreeFromPageDoc(FULL_DOC);
      expect(root.settings.pageId).toBe('home');
      expect(root.settings.pageTitle).toBe('Home page');
      expect(root.settings.themeId).toBe('midnight');
    });

    it('always has exactly three children (header, body, footer)', () => {
      expect(buildNodeTreeFromPageDoc(FULL_DOC).children).toHaveLength(3);
      expect(buildNodeTreeFromPageDoc(MINIMAL_DOC).children).toHaveLength(3);
    });
  });

  describe('header group node', () => {
    it('has type page_group', () => {
      const root = buildNodeTreeFromPageDoc(FULL_DOC);
      const header = root.children![0];
      expect(header.type).toBe(PAGE_GROUP_TYPE);
    });

    it('uses original groupId as node id', () => {
      const root = buildNodeTreeFromPageDoc(FULL_DOC);
      expect(root.children![0].id).toBe('grp_hdr_001');
    });

    it('stores handle: header, isSystem: true, groupId in settings', () => {
      const header = buildNodeTreeFromPageDoc(FULL_DOC).children![0];
      expect(header.settings.handle).toBe('header');
      expect(header.settings.isSystem).toBe(true);
      expect(header.settings.groupId).toBe('grp_hdr_001');
    });

    it('maps header sections to children', () => {
      const header = buildNodeTreeFromPageDoc(FULL_DOC).children![0];
      expect(header.children).toHaveLength(1);
      expect(header.children![0].id).toBe('sec_ann_001');
    });

    it('produces empty children when doc has no header group', () => {
      const header = buildNodeTreeFromPageDoc(MINIMAL_DOC).children![0];
      expect(header.children).toHaveLength(0);
    });
  });

  describe('body group node', () => {
    it('has stable id grp_body_{pageId}', () => {
      expect(buildNodeTreeFromPageDoc(FULL_DOC).children![1].id).toBe('grp_body_home');
    });

    it('maps page sections to children in order', () => {
      const body = buildNodeTreeFromPageDoc(FULL_DOC).children![1];
      expect(body.children).toHaveLength(2);
      expect(body.children![0].id).toBe('sec_hero_001');
      expect(body.children![1].id).toBe('sec_nl_001');
    });

    it('has empty children for doc with no sections', () => {
      const emptyDoc: PageDoc = { ...FULL_DOC, sections: [] };
      const body = buildNodeTreeFromPageDoc(emptyDoc).children![1];
      expect(body.children).toHaveLength(0);
    });
  });

  describe('footer group node', () => {
    it('uses original groupId as node id', () => {
      const root = buildNodeTreeFromPageDoc(FULL_DOC);
      expect(root.children![2].id).toBe('grp_ftr_001');
    });

    it('maps footer sections to children', () => {
      const footer = buildNodeTreeFromPageDoc(FULL_DOC).children![2];
      expect(footer.children).toHaveLength(1);
      expect(footer.children![0].id).toBe('sec_ftr_001');
    });
  });
});

// ─── buildPageDocFromNodeTree ─────────────────────────────────────────────────

describe('buildPageDocFromNodeTree', () => {
  it('throws when root.type is not page_root', () => {
    const badRoot: Node = { id: 'x', type: 'hero', settings: {}, children: [] };
    expect(() => buildPageDocFromNodeTree(badRoot)).toThrow(/page_root/);
  });

  it('restores pageId, pageTitle, themeId', () => {
    const doc = buildPageDocFromNodeTree(buildNodeTreeFromPageDoc(FULL_DOC));
    expect(doc.pageId).toBe('home');
    expect(doc.pageTitle).toBe('Home page');
    expect(doc.themeId).toBe('midnight');
  });

  it('restores groups.header with correct groupId and handle', () => {
    const doc = buildPageDocFromNodeTree(buildNodeTreeFromPageDoc(FULL_DOC));
    expect(doc.groups.header?.groupId).toBe('grp_hdr_001');
    expect(doc.groups.header?.handle).toBe('header');
  });

  it('restores groups.footer with correct groupId and handle', () => {
    const doc = buildPageDocFromNodeTree(buildNodeTreeFromPageDoc(FULL_DOC));
    expect(doc.groups.footer?.groupId).toBe('grp_ftr_001');
    expect(doc.groups.footer?.handle).toBe('footer');
  });

  it('restores page sections in order', () => {
    const doc = buildPageDocFromNodeTree(buildNodeTreeFromPageDoc(FULL_DOC));
    expect(doc.sections).toHaveLength(2);
    expect(doc.sections[0].id).toBe('sec_hero_001');
    expect(doc.sections[1].id).toBe('sec_nl_001');
  });

  it('omits groups.header when the original had none', () => {
    const doc = buildPageDocFromNodeTree(buildNodeTreeFromPageDoc(MINIMAL_DOC));
    expect(doc.groups.header).toBeUndefined();
  });

  it('omits groups.footer when the original had none', () => {
    const doc = buildPageDocFromNodeTree(buildNodeTreeFromPageDoc(MINIMAL_DOC));
    expect(doc.groups.footer).toBeUndefined();
  });
});

// ─── Utility accessor tests ───────────────────────────────────────────────────

describe('getBodySections / getHeaderSections / getFooterSections', () => {
  const root = buildNodeTreeFromPageDoc(FULL_DOC);

  it('getBodySections returns body group children', () => {
    const sections = getBodySections(root);
    expect(sections).toHaveLength(2);
    expect(sections[0].id).toBe('sec_hero_001');
  });

  it('getHeaderSections returns header group children', () => {
    const sections = getHeaderSections(root);
    expect(sections).toHaveLength(1);
    expect(sections[0].id).toBe('sec_ann_001');
  });

  it('getFooterSections returns footer group children', () => {
    const sections = getFooterSections(root);
    expect(sections).toHaveLength(1);
    expect(sections[0].id).toBe('sec_ftr_001');
  });

  it('getBodySections returns [] for empty body', () => {
    const emptyRoot = buildNodeTreeFromPageDoc({ ...FULL_DOC, sections: [] });
    expect(getBodySections(emptyRoot)).toEqual([]);
  });
});
