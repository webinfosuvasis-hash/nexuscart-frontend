/**
 * Universal Homepage Templates
 *
 * RULES:
 *   - No collection names, no product names, no brand names
 *   - No industry-specific labels ("Sarees", "Electronics", "Furniture")
 *   - All content uses empty strings — merchant fills via inspector
 *   - Section types are the only thing that varies between templates
 *   - Layout structure is the differentiator, not content
 *
 * Templates define STRUCTURE. Merchants provide CONTENT.
 */

export interface TemplateSectionSeed {
  type:      string;
  label:     string;
  settings:  Record<string, unknown>;
  blocks:    { type: string; settings: Record<string, unknown> }[];
}

export interface PageTemplate {
  id:          string;
  name:        string;
  vertical:    string;
  description: string;
  thumbnail:   string;
  tags:        string[];
  sections:    TemplateSectionSeed[];
}

// ─── Shared section factories ─────────────────────────────────────────────────

const announcementBar = (): TemplateSectionSeed => ({
  type: 'announcement_bar', label: 'Announcement Bar',
  settings: { background: '#000000', textColor: '#ffffff', paddingVertical: 8 },
  blocks:   [{ type: 'announcement', settings: { text: '', fontSize: 13 } }],
});

const heroBanner = (): TemplateSectionSeed => ({
  type: 'image_banner', label: 'Hero Banner',
  settings: { heading: '', subheading: '', ctaLabel: '', ctaUrl: '/collections/all', height: 'large', overlayOpacity: 30, contentAlign: 'center' },
  blocks:   [
    { type: 'heading',   settings: { text: '' } },
    { type: 'paragraph', settings: { text: '' } },
    { type: 'button',    settings: { label: '', link: '/collections/all', style: 'primary' } },
  ],
});

const collectionCircles = (label = 'Category Navigation'): TemplateSectionSeed => ({
  type: 'collection_circles', label,
  settings: { circleSize: 100, showLabels: true, paddingTop: 32, paddingBottom: 32, items: [] },
  blocks: [],
});

const productMosaic = (label = 'Featured Categories'): TemplateSectionSeed => ({
  type: 'product_mosaic', label,
  settings: { paddingTop: 16, paddingBottom: 24, items: [] },
  blocks: [],
});

const editorialBanner = (): TemplateSectionSeed => ({
  type: 'editorial_banner', label: 'Editorial Banner',
  settings: { scriptText: '', subtitle: '', paddingTop: 20, paddingBottom: 20 },
  blocks: [],
});

const featuredCollection = (_slot?: string): TemplateSectionSeed => ({
  type: 'featured_collection', label: 'Featured Collection',
  settings: { title: '', collectionId: '', productsToShow: 5, columnsDesktop: '5', columnsMobile: '2', showViewAll: true },
  blocks: [
    { type: 'collection_title', settings: { text: '' } },
    { type: 'view_all_button',  settings: { label: 'View All', link: '' } },
    { type: 'product_card',     settings: { showRating: true, showQuickAdd: true, imageRatio: '1/1' } },
  ],
});

const richText = (): TemplateSectionSeed => ({
  type: 'brand_story', label: 'Brand Story',
  settings: { title: '', body: '', paddingTop: 32, paddingBottom: 32 },
  blocks: [],
});

const trustBadges = (): TemplateSectionSeed => ({
  type: 'trust_badges_bar', label: 'Trust Badges',
  settings: {
    paddingTop: 20, paddingBottom: 20, columns: 4,
    badges: [
      { icon: 'shield',   title: '', description: '' },
      { icon: 'returns',  title: '', description: '' },
      { icon: 'shipping', title: '', description: '' },
      { icon: 'check',    title: '', description: '' },
    ],
  },
  blocks: [],
});

const newsletter = (): TemplateSectionSeed => ({
  type: 'newsletter', label: 'Newsletter Signup',
  settings: { paddingTop: 48, paddingBottom: 48 },
  blocks: [
    { type: 'heading',   settings: { text: '' } },
    { type: 'paragraph', settings: { text: '' } },
  ],
});

// ─── Template 1: Standard Grid Layout ────────────────────────────────────────
// Layout: Announcement → Hero → Circles → Mosaic → 2× Product Rows → Trust → Newsletter
// Best for: Fashion, Apparel, Accessories, Lifestyle

const STANDARD_GRID: PageTemplate = {
  id: 'standard-grid',
  name: 'Standard Grid',
  vertical: 'Universal',
  description: 'Clean grid layout. Hero, category navigation, 2 product carousels, trust bar, newsletter.',
  thumbnail: '⊞',
  tags: ['grid', 'standard', 'clean', 'general'],
  sections: [
    announcementBar(),
    heroBanner(),
    collectionCircles(),
    productMosaic(),
    editorialBanner(),
    featuredCollection(),
    featuredCollection(),
    richText(),
    trustBadges(),
    newsletter(),
  ],
};

// ─── Template 2: Editorial Layout ────────────────────────────────────────────
// Layout: Hero → Circles → Mosaic → Editorial Banner → 3× Collections → Brand Story → Trust → Newsletter
// Best for: Luxury, Lifestyle, Artisan, High-end brands

const EDITORIAL: PageTemplate = {
  id: 'editorial',
  name: 'Editorial',
  vertical: 'Universal',
  description: 'Editorial-first layout. Large hero, mosaic grid, editorial divider, story section.',
  thumbnail: '◰',
  tags: ['editorial', 'luxury', 'story', 'lifestyle'],
  sections: [
    announcementBar(),
    heroBanner(),
    collectionCircles(),
    productMosaic('Hero Mosaic'),
    editorialBanner(),
    featuredCollection(),
    featuredCollection(),
    collectionCircles('Category Navigation 2'),
    productMosaic('Spotlight Mosaic'),
    featuredCollection(),
    richText(),
    trustBadges(),
    newsletter(),
  ],
};

// ─── Template 3: Catalogue Layout ────────────────────────────────────────────
// Layout: Announcement → Hero → Circles → 4× Product Grids → Trust → Newsletter
// Best for: Large catalogs, Marketplace, Multi-category stores

const CATALOGUE: PageTemplate = {
  id: 'catalogue',
  name: 'Catalogue',
  vertical: 'Universal',
  description: 'Catalogue-first layout. Multiple product rows for stores with deep inventory.',
  thumbnail: '▦',
  tags: ['catalogue', 'marketplace', 'multi-category', 'grid'],
  sections: [
    announcementBar(),
    heroBanner(),
    collectionCircles(),
    {
      type: 'featured_collection', label: 'Featured Collection — A',
      settings: { title: '', collectionId: '', productsToShow: 4, columnsDesktop: '4', columnsMobile: '2', showViewAll: true },
      blocks: [
        { type: 'collection_title', settings: { text: '' } },
        { type: 'view_all_button',  settings: { label: 'View All', link: '' } },
        { type: 'product_card',     settings: { showRating: true, showQuickAdd: true, imageRatio: '1/1' } },
      ],
    },
    editorialBanner(),
    {
      type: 'featured_collection', label: 'Featured Collection — B',
      settings: { title: '', collectionId: '', productsToShow: 4, columnsDesktop: '4', columnsMobile: '2', showViewAll: true },
      blocks: [
        { type: 'collection_title', settings: { text: '' } },
        { type: 'view_all_button',  settings: { label: 'View All', link: '' } },
        { type: 'product_card',     settings: { showRating: true, showQuickAdd: true, imageRatio: '1/1' } },
      ],
    },
    collectionCircles('Category Navigation 2'),
    {
      type: 'featured_collection', label: 'Featured Collection — C',
      settings: { title: '', collectionId: '', productsToShow: 4, columnsDesktop: '4', columnsMobile: '2', showViewAll: true },
      blocks: [
        { type: 'collection_title', settings: { text: '' } },
        { type: 'view_all_button',  settings: { label: 'View All', link: '' } },
        { type: 'product_card',     settings: { showRating: false, showQuickAdd: false, imageRatio: '1/1' } },
      ],
    },
    trustBadges(),
    newsletter(),
  ],
};

// ─── Template 4: Minimal Layout ──────────────────────────────────────────────
// Layout: Hero → 1 Collection → Rich Text → Trust → Newsletter
// Best for: New stores, Single-product brands, Minimalist design

const MINIMAL: PageTemplate = {
  id: 'minimal',
  name: 'Minimal',
  vertical: 'Universal',
  description: 'Clean minimal layout. Hero, one product collection, brand story, newsletter.',
  thumbnail: '○',
  tags: ['minimal', 'clean', 'simple', 'single-product'],
  sections: [
    heroBanner(),
    featuredCollection('A'),
    richText(),
    trustBadges(),
    newsletter(),
  ],
};

// ─── Template 5: Content-First Layout ────────────────────────────────────────
// Layout: Announcement → Hero → Circles → Mosaic → Editorial → Collections → Testimonials → Trust → Newsletter
// Best for: Stores where storytelling drives conversion (artisan, craft, D2C)

const CONTENT_FIRST: PageTemplate = {
  id: 'content-first',
  name: 'Content First',
  vertical: 'Universal',
  description: 'Story-driven layout. Visual mosaic, editorial sections, testimonials.',
  thumbnail: '◈',
  tags: ['content', 'story', 'D2C', 'artisan', 'brand'],
  sections: [
    announcementBar(),
    heroBanner(),
    collectionCircles(),
    productMosaic(),
    editorialBanner(),
    featuredCollection(),
    featuredCollection(),
    {
      type: 'testimonials', label: 'Testimonials',
      settings: {
        heading: '',
        layout: 'grid',
        columns: 3,
        items: [
          { quote: '', author: '', rating: 5 },
          { quote: '', author: '', rating: 5 },
          { quote: '', author: '', rating: 5 },
        ],
      },
      blocks: [],
    },
    richText(),
    trustBadges(),
    newsletter(),
  ],
};

// ─── Registry ──────────────────────────────────────────────────────────────────

export const PAGE_TEMPLATES: PageTemplate[] = [
  STANDARD_GRID,
  EDITORIAL,
  CATALOGUE,
  MINIMAL,
  CONTENT_FIRST,
];

export const TEMPLATE_BY_ID = Object.fromEntries(
  PAGE_TEMPLATES.map((t) => [t.id, t]),
);

// ─── Available pages ───────────────────────────────────────────────────────────

export const AVAILABLE_PAGES = [
  { id: 'home',       title: 'Home page',   slug: '/'                },
  { id: 'collection', title: 'Collections', slug: '/collections'     },
  { id: 'product',    title: 'Product',     slug: '/products/sample' },
  { id: 'cart',       title: 'Cart',        slug: '/cart'            },
  { id: 'search',     title: 'Search',      slug: '/search'          },
] as const;

export type PageId = typeof AVAILABLE_PAGES[number]['id'];

export const PAGE_TITLES: Record<string, string> = {
  home:       'Home page',
  collection: 'Collections',
  product:    'Product',
  cart:       'Cart',
  search:     'Search',
};

export function buildEmptyPageDoc(pageId: string): import('../types').PageDoc {
  const { MOCK_PAGE_DOC } = require('../editor-mock-data');
  return { ...MOCK_PAGE_DOC, pageId, pageTitle: PAGE_TITLES[pageId] ?? pageId, sections: [] };
}
