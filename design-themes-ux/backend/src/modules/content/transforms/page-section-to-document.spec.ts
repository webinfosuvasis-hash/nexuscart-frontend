import {
  transformSectionsToPageDocument,
  transformDocumentToSections,
} from './page-section-to-document';
import type { RawSection, Node } from './types';

// ─── Golden fixtures (mirror real seed data from page-sections.seed.ts) ──────

const STORE_ID  = 'store_test_001';
const THEME_ID  = 'dawn';
const PAGE_ID   = 'home';

const HERO_SECTION: RawSection = {
  id:           'sec_hero_001',
  sectionDefId: 'hero',
  label:        'Hero',
  sortOrder:    1.0,
  isVisible:    true,
  isDraft:      true,
  settings: {
    backgroundImage:  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1400&q=80',
    backgroundColor:  '#1a1a2e',
    overlayOpacity:   50,
    overlayColor:     '#000000',
    height:           'md',
    contentAlignment: 'center',
    contentWidth:     'normal',
  },
  blocks: [
    {
      id:        'blk_heading_001',
      type:      'heading',
      sortOrder: 1.0,
      isVisible: true,
      settings:  { text: 'Browse our latest products', typographyPreset: 'h1', textColor: '#ffffff' },
    },
    {
      id:        'blk_button_001',
      type:      'button',
      sortOrder: 2.0,
      isVisible: true,
      settings:  { label: 'Shop all', link: '/collections', style: 'outline', size: 'lg' },
    },
  ],
};

const FEATURED_COLLECTION_SECTION: RawSection = {
  id:           'sec_fc_001',
  sectionDefId: 'featured_collection',
  label:        'Featured collection',
  sortOrder:    2.0,
  isVisible:    true,
  isDraft:      true,
  settings: {
    productsToShow: 4,
    columnsDesktop: '4',
    columnsMobile:  '2',
    showViewAll:    true,
  },
  blocks: [
    {
      id:        'blk_col_title_001',
      type:      'collection_title',
      sortOrder: 1.0,
      isVisible: true,
      settings:  { text: 'Products', alignment: 'left', textColor: '#111827' },
    },
    {
      id:        'blk_view_all_001',
      type:      'view_all_button',
      sortOrder: 2.0,
      isVisible: true,
      settings:  { label: 'View all', link: '/collections', style: 'link' },
    },
    {
      id:        'blk_product_card_001',
      type:      'product_card',
      sortOrder: 3.0,
      isVisible: true,
      settings:  { showRating: true, showQuickAdd: true, imageRatio: '1/1' },
    },
  ],
};

const NEWSLETTER_SECTION: RawSection = {
  id:           'sec_nl_001',
  sectionDefId: 'newsletter',
  label:        'Newsletter',
  sortOrder:    3.0,
  isVisible:    true,
  isDraft:      true,
  settings: {
    placeholder: 'Email address',
    buttonLabel: 'Subscribe',
    successMsg:  'Thanks for subscribing!',
  },
  blocks: [
    {
      id:        'blk_nl_heading_001',
      type:      'heading',
      sortOrder: 1.0,
      isVisible: true,
      settings:  { text: 'Subscribe to our emails', typographyPreset: 'h2', textColor: '#111827' },
    },
    {
      id:        'blk_nl_para_001',
      type:      'paragraph',
      sortOrder: 2.0,
      isVisible: true,
      settings:  { text: 'Be the first to know about new collections and exclusive offers.', textColor: '#374151' },
    },
  ],
};

// ── Additional fixtures for all 17 known section types ────────────────────────

const makeSection = (
  id: string,
  defId: string,
  label: string,
  order: number,
  settings: Record<string, unknown> = {},
  blocks: RawSection['blocks'] = [],
): RawSection => ({
  id, sectionDefId: defId, label, sortOrder: order,
  isVisible: true, isDraft: true, settings, blocks,
});

const ANNOUNCEMENT_BAR = makeSection('sec_ann_001', 'announcement_bar', 'Announcement bar', 0,
  { background: '#4f46e5', textColor: '#ffffff', paddingVertical: 8 },
  [{ id: 'blk_ann_001', type: 'announcement', sortOrder: 1, isVisible: true,
     settings: { text: 'Free shipping on orders over ₹999', fontSize: 13 } }],
);

const RICH_TEXT = makeSection('sec_rt_001', 'rich_text', 'Rich Text', 4,
  { background: '#ffffff' },
  [{ id: 'blk_rt_001', type: 'heading', sortOrder: 1, isVisible: true, settings: { text: 'Our Story', typographyPreset: 'h2' } }],
);

const IMAGE_GALLERY = makeSection('sec_gallery_001', 'image_gallery', 'Image gallery', 5, { columns: 3 });
const COLLECTION_GRID = makeSection('sec_cg_001', 'collection_grid', 'Collection grid', 6, { columns: 3, limit: 6 });
const VIDEO = makeSection('sec_video_001', 'video', 'Video', 7, { videoUrl: 'https://youtube.com/watch?v=xxx', autoplay: false });
const TESTIMONIALS = makeSection('sec_test_001', 'testimonials', 'Testimonials', 8, { layout: 'grid', columns: 3 });
const COUNTDOWN = makeSection('sec_cd_001', 'countdown', 'Countdown', 9, { endsAt: '2026-12-31T00:00:00Z' });
const FAQ = makeSection('sec_faq_001', 'faq', 'FAQ', 10, {},
  [{ id: 'blk_faq_001', type: 'heading', sortOrder: 1, isVisible: true, settings: { text: 'Frequently asked questions', typographyPreset: 'h2' } }],
);
const BLOG = makeSection('sec_blog_001', 'blog', 'Blog', 11, { postsToShow: 3, layout: 'grid' });
const BRANDS = makeSection('sec_brands_001', 'brands', 'Brands', 12, { columns: 6 });
const PROMO_BAR = makeSection('sec_promo_001', 'promo_bar', 'Promo bar', 13,
  { background: '#f59e0b', textColor: '#000000' },
  [{ id: 'blk_promo_001', type: 'announcement', sortOrder: 1, isVisible: true, settings: { text: 'Sale ends Sunday!' } }],
);
const PRODUCT_GRID = makeSection('sec_pg_001', 'product_grid', 'Product grid', 14, { columnsDesktop: '4', productsToShow: 8 });

const ALL_SECTIONS: RawSection[] = [
  HERO_SECTION,
  FEATURED_COLLECTION_SECTION,
  NEWSLETTER_SECTION,
  ANNOUNCEMENT_BAR,
  RICH_TEXT,
  IMAGE_GALLERY,
  COLLECTION_GRID,
  VIDEO,
  TESTIMONIALS,
  COUNTDOWN,
  FAQ,
  BLOG,
  BRANDS,
  PROMO_BAR,
  PRODUCT_GRID,
];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('transformSectionsToPageDocument', () => {

  describe('document structure', () => {
    it('produces a PageDocument with correct metadata', () => {
      const doc = transformSectionsToPageDocument(STORE_ID, THEME_ID, PAGE_ID, [HERO_SECTION], 'DRAFT');
      expect(doc.storeId).toBe(STORE_ID);
      expect(doc.themeId).toBe(THEME_ID);
      expect(doc.ownerKey).toBe(PAGE_ID);
      expect(doc.status).toBe('DRAFT');
      expect(doc.scope).toBe('PAGE');
      expect(doc.version).toBe(1);
      expect(doc.schemaVersion).toBe(1);
    });

    it('wraps sections in a root node', () => {
      const doc = transformSectionsToPageDocument(STORE_ID, THEME_ID, PAGE_ID, [HERO_SECTION], 'DRAFT');
      expect(doc.tree.type).toBe('root');
      expect(doc.tree.id).toBeTruthy();
      expect(Array.isArray(doc.tree.children)).toBe(true);
    });

    it('handles empty section list — produces root with no children', () => {
      const doc = transformSectionsToPageDocument(STORE_ID, THEME_ID, PAGE_ID, [], 'DRAFT');
      expect(doc.tree.children).toHaveLength(0);
    });
  });

  describe('hero section transform', () => {
    let heroNode: Node;

    beforeEach(() => {
      const doc = transformSectionsToPageDocument(STORE_ID, THEME_ID, PAGE_ID, [HERO_SECTION], 'DRAFT');
      heroNode = doc.tree.children![0];
    });

    it('preserves section id', () => {
      expect(heroNode.id).toBe('sec_hero_001');
    });

    it('maps sectionDefId → node type', () => {
      expect(heroNode.type).toBe('hero');
    });

    it('preserves section label', () => {
      expect(heroNode.label).toBe('Hero');
    });

    it('preserves all section settings', () => {
      expect(heroNode.settings.backgroundImage).toBe(HERO_SECTION.settings.backgroundImage);
      expect(heroNode.settings.overlayOpacity).toBe(50);
      expect(heroNode.settings.height).toBe('md');
    });

    it('sets visibility from isVisible', () => {
      expect(heroNode.visibility?.desktop).toBe(true);
    });

    it('produces 2 child block nodes in sort order', () => {
      expect(heroNode.children).toHaveLength(2);
      expect(heroNode.children![0].type).toBe('heading');
      expect(heroNode.children![1].type).toBe('button');
    });

    it('preserves block ids', () => {
      expect(heroNode.children![0].id).toBe('blk_heading_001');
      expect(heroNode.children![1].id).toBe('blk_button_001');
    });

    it('preserves block settings', () => {
      const heading = heroNode.children![0];
      expect(heading.settings.text).toBe('Browse our latest products');
      expect(heading.settings.textColor).toBe('#ffffff');
    });
  });

  describe('featured_collection section transform', () => {
    let fcNode: Node;

    beforeEach(() => {
      const doc = transformSectionsToPageDocument(STORE_ID, THEME_ID, PAGE_ID, [FEATURED_COLLECTION_SECTION], 'DRAFT');
      fcNode = doc.tree.children![0];
    });

    it('maps type correctly', () => {
      expect(fcNode.type).toBe('featured_collection');
    });

    it('preserves all 3 blocks in order', () => {
      expect(fcNode.children).toHaveLength(3);
      expect(fcNode.children![0].type).toBe('collection_title');
      expect(fcNode.children![1].type).toBe('view_all_button');
      expect(fcNode.children![2].type).toBe('product_card');
    });

    it('preserves product_card settings', () => {
      const card = fcNode.children![2];
      expect(card.settings.showRating).toBe(true);
      expect(card.settings.imageRatio).toBe('1/1');
    });
  });

  describe('newsletter section transform', () => {
    let nlNode: Node;

    beforeEach(() => {
      const doc = transformSectionsToPageDocument(STORE_ID, THEME_ID, PAGE_ID, [NEWSLETTER_SECTION], 'DRAFT');
      nlNode = doc.tree.children![0];
    });

    it('maps type correctly', () => {
      expect(nlNode.type).toBe('newsletter');
    });

    it('preserves section settings', () => {
      expect(nlNode.settings.buttonLabel).toBe('Subscribe');
      expect(nlNode.settings.successMsg).toBe('Thanks for subscribing!');
    });

    it('preserves both block children in order', () => {
      expect(nlNode.children).toHaveLength(2);
      expect(nlNode.children![0].type).toBe('heading');
      expect(nlNode.children![1].type).toBe('paragraph');
    });
  });

  describe('sort order', () => {
    it('orders sections by sortOrder ascending', () => {
      const shuffled = [NEWSLETTER_SECTION, HERO_SECTION, FEATURED_COLLECTION_SECTION];
      const doc = transformSectionsToPageDocument(STORE_ID, THEME_ID, PAGE_ID, shuffled, 'DRAFT');
      const types = doc.tree.children!.map(n => n.type);
      expect(types).toEqual(['hero', 'featured_collection', 'newsletter']);
    });

    it('orders blocks by sortOrder ascending within each section', () => {
      const reversed: RawSection = {
        ...FEATURED_COLLECTION_SECTION,
        blocks: [...FEATURED_COLLECTION_SECTION.blocks].reverse(),
      };
      const doc = transformSectionsToPageDocument(STORE_ID, THEME_ID, PAGE_ID, [reversed], 'DRAFT');
      const blockTypes = doc.tree.children![0].children!.map(b => b.type);
      expect(blockTypes).toEqual(['collection_title', 'view_all_button', 'product_card']);
    });
  });

  describe('visibility', () => {
    it('hidden section produces visibility.desktop=false on all breakpoints', () => {
      const hidden: RawSection = { ...HERO_SECTION, isVisible: false };
      const doc = transformSectionsToPageDocument(STORE_ID, THEME_ID, PAGE_ID, [hidden], 'DRAFT');
      const node = doc.tree.children![0];
      expect(node.visibility?.desktop).toBe(false);
      expect(node.visibility?.tablet).toBe(false);
      expect(node.visibility?.mobile).toBe(false);
    });

    it('visible section produces visibility.desktop=true', () => {
      const doc = transformSectionsToPageDocument(STORE_ID, THEME_ID, PAGE_ID, [HERO_SECTION], 'DRAFT');
      expect(doc.tree.children![0].visibility?.desktop).toBe(true);
    });
  });

  describe('all 15 known section types produce valid nodes', () => {
    it.each(ALL_SECTIONS.map(s => [s.sectionDefId, s]))(
      '%s → valid node with correct type',
      (_defId, section) => {
        const doc = transformSectionsToPageDocument(STORE_ID, THEME_ID, PAGE_ID, [section as RawSection], 'DRAFT');
        const node = doc.tree.children![0];
        expect(node).toBeDefined();
        expect(node.type).toBe((section as RawSection).sectionDefId);
        expect(node.id).toBe((section as RawSection).id);
        expect(typeof node.settings).toBe('object');
        expect(Array.isArray(node.children)).toBe(true);
      },
    );
  });

  describe('PUBLISHED status', () => {
    it('sets status to PUBLISHED when requested', () => {
      const doc = transformSectionsToPageDocument(STORE_ID, THEME_ID, PAGE_ID, [HERO_SECTION], 'PUBLISHED');
      expect(doc.status).toBe('PUBLISHED');
    });
  });

  describe('settings safety', () => {
    it('null settings → empty object (does not throw)', () => {
      const section: RawSection = { ...HERO_SECTION, settings: null as any };
      expect(() =>
        transformSectionsToPageDocument(STORE_ID, THEME_ID, PAGE_ID, [section], 'DRAFT'),
      ).not.toThrow();
      const doc = transformSectionsToPageDocument(STORE_ID, THEME_ID, PAGE_ID, [section], 'DRAFT');
      expect(doc.tree.children![0].settings).toEqual({});
    });
  });
});

// ─── Round-trip tests ─────────────────────────────────────────────────────────

describe('round-trip: transform → reverse → same sections', () => {

  const FULL_PAGE = [HERO_SECTION, FEATURED_COLLECTION_SECTION, NEWSLETTER_SECTION];

  it('produces the same number of sections', () => {
    const doc = transformSectionsToPageDocument(STORE_ID, THEME_ID, PAGE_ID, FULL_PAGE, 'DRAFT');
    const reversed = transformDocumentToSections(doc);
    expect(reversed).toHaveLength(3);
  });

  it('preserves section ids', () => {
    const doc = transformSectionsToPageDocument(STORE_ID, THEME_ID, PAGE_ID, FULL_PAGE, 'DRAFT');
    const reversed = transformDocumentToSections(doc);
    expect(reversed.map(s => s.id)).toEqual(['sec_hero_001', 'sec_fc_001', 'sec_nl_001']);
  });

  it('preserves sectionDefIds (types)', () => {
    const doc = transformSectionsToPageDocument(STORE_ID, THEME_ID, PAGE_ID, FULL_PAGE, 'DRAFT');
    const reversed = transformDocumentToSections(doc);
    expect(reversed.map(s => s.sectionDefId)).toEqual(['hero', 'featured_collection', 'newsletter']);
  });

  it('preserves all section settings', () => {
    const doc = transformSectionsToPageDocument(STORE_ID, THEME_ID, PAGE_ID, [HERO_SECTION], 'DRAFT');
    const [reversed] = transformDocumentToSections(doc);
    expect(reversed.settings.backgroundImage).toBe(HERO_SECTION.settings.backgroundImage);
    expect(reversed.settings.overlayOpacity).toBe(50);
    expect(reversed.settings.height).toBe('md');
  });

  it('preserves all block ids', () => {
    const doc = transformSectionsToPageDocument(STORE_ID, THEME_ID, PAGE_ID, [HERO_SECTION], 'DRAFT');
    const [reversed] = transformDocumentToSections(doc);
    expect(reversed.blocks.map(b => b.id)).toEqual(['blk_heading_001', 'blk_button_001']);
  });

  it('preserves all block settings', () => {
    const doc = transformSectionsToPageDocument(STORE_ID, THEME_ID, PAGE_ID, [HERO_SECTION], 'DRAFT');
    const [reversed] = transformDocumentToSections(doc);
    expect(reversed.blocks[0].settings.text).toBe('Browse our latest products');
    expect(reversed.blocks[1].settings.label).toBe('Shop all');
  });

  it('preserves block count per section', () => {
    const doc = transformSectionsToPageDocument(STORE_ID, THEME_ID, PAGE_ID, FULL_PAGE, 'DRAFT');
    const reversed = transformDocumentToSections(doc);
    expect(reversed[0].blocks).toHaveLength(2); // hero: heading + button
    expect(reversed[1].blocks).toHaveLength(3); // featured_collection: title + view_all + product_card
    expect(reversed[2].blocks).toHaveLength(2); // newsletter: heading + paragraph
  });

  it('preserves isVisible on sections', () => {
    const hidden: RawSection = { ...HERO_SECTION, isVisible: false };
    const doc = transformSectionsToPageDocument(STORE_ID, THEME_ID, PAGE_ID, [hidden], 'DRAFT');
    const [reversed] = transformDocumentToSections(doc);
    expect(reversed.isVisible).toBe(false);
  });

  it('zero data loss across all 15 section types', () => {
    const doc = transformSectionsToPageDocument(STORE_ID, THEME_ID, PAGE_ID, ALL_SECTIONS, 'DRAFT');
    const reversed = transformDocumentToSections(doc);
    expect(reversed).toHaveLength(ALL_SECTIONS.length);

    // transform sorts by sortOrder — compare against sorted source, not raw array order
    const sorted = [...ALL_SECTIONS].sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder));

    for (let i = 0; i < sorted.length; i++) {
      expect(reversed[i].id).toBe(sorted[i].id);
      expect(reversed[i].sectionDefId).toBe(sorted[i].sectionDefId);
      for (const [k, v] of Object.entries(sorted[i].settings)) {
        expect(reversed[i].settings[k]).toEqual(v);
      }
    }
  });
});
