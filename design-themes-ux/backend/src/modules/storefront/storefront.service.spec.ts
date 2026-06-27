import { Test, TestingModule }   from '@nestjs/testing';
import { StorefrontService, DraftPageData } from './storefront.service';
import { PrismaService }       from '@/prisma/prisma.service';
import { CacheService }        from '@/shared/cache/cache.service';
import { ThemeConfigService }  from '@/modules/theme-engine/theme-config/theme-config.service';
import { HeaderConfigService } from '@/modules/theme-engine/header-config/header-config.service';
import { FooterConfigService } from '@/modules/theme-engine/footer-config/footer-config.service';
import { SectionsService }     from '@/modules/theme-engine/sections/sections.service';
import { DefinitionsService }  from '@/modules/theme-engine/definitions/definitions.service';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockPrisma = {
  store: { findUnique: jest.fn() },
  // P0-8: menu data added to buildDraftPageData
  menu:  { findMany:  jest.fn() },
};

const mockCache = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};

const STORE_ID = 'store_1';
const THEME_ID = 'fresh';
const PAGE_ID  = 'home';

const DRAFT_CONFIG_ROW = {
  config: {
    colors:     { primary: '#16a34a', secondary: '#f0fdf4', accent: '#fb923c', background: '#fff', text: '#111', surface: '#f9f' },
    typography: { headingFont: 'Nunito', bodyFont: 'Nunito', baseSizeRem: 1.0, lineHeight: 1.6 },
    layout:     { stickyHeader: true, sidebarCart: false, megaMenu: true, backToTop: true, cookieConsent: false },
  },
};

const DRAFT_HEADER = {
  zones:    [{ id: 'zone1', components: [{ id: 'ann-1', type: 'announcement', settings: { text: 'Welcome' } }] }],
  behavior: { stickyMode: 'scroll_up' },
};

const DRAFT_FOOTER = {
  columns:   [{ id: 'col-1', title: 'Brand', widthPercent: 40, widgets: [] }],
  bottomBar: { backgroundColor: '#1f2937', components: [] },
  settings:  { topBackground: '#111827', divider: true },
};

const SECTION_WITH_BLOCKS = {
  id:           'sec_hero_001',
  sectionDefId: 'hero',
  label:        'Hero',
  settings:     { backgroundColor: '#1a1a2e', height: 'md' },
  isVisible:    true,
  blocks: [
    { id: 'blk_h1', type: 'heading', settings: { text: 'Browse', textColor: '#fff' }, isVisible: true, sortOrder: 1.0 },
    { id: 'blk_b1', type: 'button',  settings: { label: 'Shop all' },                 isVisible: true, sortOrder: 2.0 },
  ],
  definition: { name: 'Hero banner', icon: 'Image', category: 'MEDIA' },
};

const mockThemeConfig  = { getDraft: jest.fn() };
const mockHeaderConfig = { getDraft: jest.fn() };
const mockFooterConfig = { getDraft: jest.fn() };
const mockSections     = { getPageSections: jest.fn() };
const mockDefinitions  = {
  listSectionDefinitions: jest.fn(),
  listBlockDefinitions:   jest.fn(),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('StorefrontService.buildDraftPageData()', () => {
  let service: StorefrontService;

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorefrontService,
        { provide: PrismaService,       useValue: mockPrisma       },
        { provide: CacheService,        useValue: mockCache        },
        { provide: ThemeConfigService,  useValue: mockThemeConfig  },
        { provide: HeaderConfigService, useValue: mockHeaderConfig },
        { provide: FooterConfigService, useValue: mockFooterConfig },
        { provide: SectionsService,     useValue: mockSections     },
        { provide: DefinitionsService,  useValue: mockDefinitions  },
      ],
    }).compile();

    service = module.get<StorefrontService>(StorefrontService);

    // Default happy-path mocks
    mockCache.get.mockResolvedValue(null);
    mockCache.set.mockResolvedValue(undefined);
    mockThemeConfig.getDraft.mockResolvedValue(DRAFT_CONFIG_ROW);
    mockHeaderConfig.getDraft.mockResolvedValue(DRAFT_HEADER);
    mockFooterConfig.getDraft.mockResolvedValue(DRAFT_FOOTER);
    mockSections.getPageSections.mockResolvedValue([SECTION_WITH_BLOCKS]);
    mockPrisma.store.findUnique.mockResolvedValue({ name: 'My Store', settings: { currency: 'USD', logo: null } });
    // P0-8: menu data mock
    mockPrisma.menu.findMany.mockResolvedValue([
      { handle: 'main-menu', items: [{ id: 'm1', label: 'Home', url: '/', sortOrder: 1 }] },
    ]);
    mockDefinitions.listSectionDefinitions.mockResolvedValue([
      { id: 'hero', name: 'Hero banner', icon: 'Image', category: 'MEDIA' },
    ]);
    mockDefinitions.listBlockDefinitions.mockResolvedValue([
      { type: 'heading', name: 'Heading', icon: 'Heading' },
      { type: 'button',  name: 'Button',  icon: 'MousePointerClick' },
    ]);
  });

  // ── Cache ──────────────────────────────────────────────────────────────────

  it('returns cached DraftPageData without DB queries on cache hit', async () => {
    const cached: Partial<DraftPageData> = {
      storeId: STORE_ID, themeId: THEME_ID, pageId: PAGE_ID,
      sections: [], generatedAt: new Date().toISOString(),
    };
    mockCache.get.mockResolvedValue(cached);

    const result = await service.buildDraftPageData(STORE_ID, THEME_ID, PAGE_ID);

    expect(result).toEqual(cached);
    expect(mockThemeConfig.getDraft).not.toHaveBeenCalled();
    expect(mockSections.getPageSections).not.toHaveBeenCalled();
  });

  it('assembles and caches DraftPageData on cache miss', async () => {
    await service.buildDraftPageData(STORE_ID, THEME_ID, PAGE_ID);
    expect(mockCache.set).toHaveBeenCalledWith(
      expect.stringContaining(STORE_ID),
      expect.any(Object),
      5,    // 5-second TTL (reduced from 30 to ensure preview freshness after save)
    );
  });

  // ── ThemeConfig ────────────────────────────────────────────────────────────

  it('includes draft colors in response', async () => {
    const result = await service.buildDraftPageData(STORE_ID, THEME_ID, PAGE_ID);
    expect(result.themeConfig.colors.primary).toBe('#16a34a');
    expect(result.themeConfig.typography.headingFont).toBe('Nunito');
    expect(result.themeConfig.layout.stickyHeader).toBe(true);
  });

  it('uses DEFAULT_CONFIG when no draft theme config exists', async () => {
    mockThemeConfig.getDraft.mockRejectedValue(new Error('no config'));
    const result = await service.buildDraftPageData(STORE_ID, THEME_ID, PAGE_ID);
    expect(result.themeConfig.colors.primary).toBe('#4f46e5');  // default
  });

  // ── Sections and blocks ────────────────────────────────────────────────────

  it('returns sections with embedded blocks in sorted order', async () => {
    const result = await service.buildDraftPageData(STORE_ID, THEME_ID, PAGE_ID);

    expect(result.sections).toHaveLength(1);
    const hero = result.sections[0];
    expect(hero.id).toBe('sec_hero_001');
    expect(hero.type).toBe('hero');
    expect(hero.blocks).toHaveLength(2);
    expect(hero.blocks[0].type).toBe('heading');
    expect(hero.blocks[0].sortOrder).toBe(1.0);
    expect(hero.blocks[1].type).toBe('button');
    expect(hero.blocks[1].sortOrder).toBe(2.0);
  });

  it('calls getPageSections with isDraft=true', async () => {
    await service.buildDraftPageData(STORE_ID, THEME_ID, PAGE_ID);
    expect(mockSections.getPageSections).toHaveBeenCalledWith(
      STORE_ID, THEME_ID, PAGE_ID, true,
    );
  });

  it('returns empty sections array when no draft sections exist', async () => {
    mockSections.getPageSections.mockResolvedValue([]);
    const result = await service.buildDraftPageData(STORE_ID, THEME_ID, PAGE_ID);
    expect(result.sections).toHaveLength(0);
  });

  it('filters hidden blocks but keeps hidden sections (renderer decides visibility)', async () => {
    const sectionWithHiddenBlock = {
      ...SECTION_WITH_BLOCKS,
      blocks: [
        { ...SECTION_WITH_BLOCKS.blocks[0], isVisible: false },
        { ...SECTION_WITH_BLOCKS.blocks[1], isVisible: true  },
      ],
    };
    mockSections.getPageSections.mockResolvedValue([sectionWithHiddenBlock]);

    const result = await service.buildDraftPageData(STORE_ID, THEME_ID, PAGE_ID);
    // Both blocks returned — visibility filtering is the renderer's job
    expect(result.sections[0].blocks).toHaveLength(2);
    expect(result.sections[0].blocks[0].isVisible).toBe(false);
  });

  // ── Header / Footer ────────────────────────────────────────────────────────

  it('includes headerConfig zones and behavior', async () => {
    const result = await service.buildDraftPageData(STORE_ID, THEME_ID, PAGE_ID);
    expect(result.headerConfig).not.toBeNull();
    expect(result.headerConfig!.zones).toHaveLength(1);
    expect(result.headerConfig!.behavior.stickyMode).toBe('scroll_up');
  });

  it('sets headerConfig to null when no header config exists', async () => {
    mockHeaderConfig.getDraft.mockRejectedValue(new Error('no header'));
    const result = await service.buildDraftPageData(STORE_ID, THEME_ID, PAGE_ID);
    expect(result.headerConfig).toBeNull();
  });

  it('includes footerConfig columns and bottomBar', async () => {
    const result = await service.buildDraftPageData(STORE_ID, THEME_ID, PAGE_ID);
    expect(result.footerConfig).not.toBeNull();
    expect(result.footerConfig!.columns).toHaveLength(1);
    expect(result.footerConfig!.bottomBar.backgroundColor).toBe('#1f2937');
  });

  // ── Store data ─────────────────────────────────────────────────────────────

  it('includes store name and currency', async () => {
    const result = await service.buildDraftPageData(STORE_ID, THEME_ID, PAGE_ID);
    expect(result.store.name).toBe('My Store');
    expect(result.store.currency).toBe('USD');
    expect(result.store.logo).toBeNull();
  });

  it('uses default store name when store not found', async () => {
    mockPrisma.store.findUnique.mockResolvedValue(null);
    const result = await service.buildDraftPageData(STORE_ID, THEME_ID, PAGE_ID);
    expect(result.store.name).toBe('My Store');
  });

  // ── Definitions ────────────────────────────────────────────────────────────

  it('includes lean section definitions (no settingsSchema)', async () => {
    const result = await service.buildDraftPageData(STORE_ID, THEME_ID, PAGE_ID);
    expect(result.sectionDefinitions['hero']).toEqual({ name: 'Hero banner', icon: 'Image', category: 'MEDIA' });
    // settingsSchema must NOT be present (lean format)
    expect((result.sectionDefinitions['hero'] as any).settingsSchema).toBeUndefined();
  });

  it('includes lean block definitions', async () => {
    const result = await service.buildDraftPageData(STORE_ID, THEME_ID, PAGE_ID);
    expect(result.blockDefinitions['heading']).toEqual({ name: 'Heading', icon: 'Heading' });
    expect(result.blockDefinitions['button']).toEqual({ name: 'Button', icon: 'MousePointerClick' });
  });

  it('includes menu items keyed by handle (P0-8)', async () => {
    const result = await service.buildDraftPageData(STORE_ID, THEME_ID, PAGE_ID);
    expect(result.menus).toBeDefined();
    expect(result.menus['main-menu']).toHaveLength(1);
    expect(result.menus['main-menu'][0].label).toBe('Home');
  });

  it('returns empty menus object when no menus exist', async () => {
    mockPrisma.menu.findMany.mockResolvedValue([]);
    const result = await service.buildDraftPageData(STORE_ID, THEME_ID, PAGE_ID);
    expect(result.menus).toEqual({});
  });

  // ── Page title ─────────────────────────────────────────────────────────────

  it.each([
    ['home',        'Home page'],
    ['collection',  'Collections'],
    ['product',     'Product'],
    ['cms:about',   'about'],
    ['my-page',     'My Page'],
  ])('maps pageId "%s" → pageTitle "%s"', async (pageId, expectedTitle) => {
    const result = await service.buildDraftPageData(STORE_ID, THEME_ID, pageId);
    expect(result.pageTitle).toBe(expectedTitle);
  });

  // ── Metadata ───────────────────────────────────────────────────────────────

  it('includes storeId, themeId, pageId and generatedAt in response', async () => {
    const result = await service.buildDraftPageData(STORE_ID, THEME_ID, PAGE_ID);
    expect(result.storeId).toBe(STORE_ID);
    expect(result.themeId).toBe(THEME_ID);
    expect(result.pageId).toBe(PAGE_ID);
    expect(result.generatedAt).toBeDefined();
    expect(new Date(result.generatedAt).getTime()).toBeLessThanOrEqual(Date.now());
  });
});
