import { Test, TestingModule } from '@nestjs/testing';
import { ThemeConfigService }  from './theme-config.service';
import { PrismaService }       from '@/prisma/prisma.service';
import { CacheService }        from '@/shared/cache/cache.service';
import { ConfigStatus }        from '@prisma/client';

const mockPrisma = {
  themeConfig: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), upsert: jest.fn() },
  storeTheme:  { findFirst: jest.fn() },
};

const mockCache = {
  get: jest.fn(), set: jest.fn(), del: jest.fn(), invalidatePattern: jest.fn(),
};

const STORE_ID = 'store_abc';
const THEME_ID = 'fresh';

const DRAFT_ROW = {
  id: 'cfg_1', storeId: STORE_ID, themeId: THEME_ID, status: ConfigStatus.DRAFT, version: 0,
  config: {
    colors:     { primary: '#16a34a', secondary: '#f0fdf4', accent: '#fb923c', background: '#fff', text: '#111', surface: '#f9f' },
    typography: { headingFont: 'Nunito', bodyFont: 'Nunito', baseSizeRem: 1.0, lineHeight: 1.6 },
    layout:     { stickyHeader: true, sidebarCart: false, megaMenu: true, backToTop: true, cookieConsent: false },
  },
};

const PUB_ROW = { ...DRAFT_ROW, status: ConfigStatus.PUBLISHED, version: 3 };

describe('ThemeConfigService — Sprint 4.5 (themeId-scoped)', () => {
  let service: ThemeConfigService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ThemeConfigService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CacheService,  useValue: mockCache  },
      ],
    }).compile();
    service = module.get<ThemeConfigService>(ThemeConfigService);
  });

  // ── resolveActiveThemeId ────────────────────────────────────────────────────

  describe('resolveActiveThemeId', () => {
    it('returns cached active themeId', async () => {
      mockCache.get.mockResolvedValue('dawn');
      const result = await service.resolveActiveThemeId(STORE_ID);
      expect(result).toBe('dawn');
      expect(mockPrisma.storeTheme.findFirst).not.toHaveBeenCalled();
    });

    it('queries DB and caches when cache misses', async () => {
      mockCache.get.mockResolvedValue(null);
      mockPrisma.storeTheme.findFirst.mockResolvedValue({ themeId: THEME_ID });
      const result = await service.resolveActiveThemeId(STORE_ID);
      expect(result).toBe(THEME_ID);
      expect(mockCache.set).toHaveBeenCalled();
    });

    it('returns "default" when store has no active theme and no existing config', async () => {
      mockCache.get.mockResolvedValue(null);
      mockPrisma.storeTheme.findFirst.mockResolvedValue(null);
      // New fallback: also checks theme_configs; mock returns null too
      mockPrisma.themeConfig.findFirst.mockResolvedValue(null);
      const result = await service.resolveActiveThemeId(STORE_ID);
      expect(result).toBe('default');
    });

    it('falls back to existing theme_configs themeId when no StoreTheme is active', async () => {
      mockCache.get.mockResolvedValue(null);
      mockPrisma.storeTheme.findFirst.mockResolvedValue(null);
      mockPrisma.themeConfig.findFirst.mockResolvedValue({ themeId: 'dawn' });
      const result = await service.resolveActiveThemeId(STORE_ID);
      expect(result).toBe('dawn');
    });
  });

  // ── getDraft ────────────────────────────────────────────────────────────────

  describe('getDraft', () => {
    it('uses storeId_themeId_status composite key in query', async () => {
      mockCache.get.mockResolvedValue(null);
      mockPrisma.themeConfig.findUnique.mockResolvedValue(DRAFT_ROW);
      await service.getDraft(STORE_ID, THEME_ID);
      expect(mockPrisma.themeConfig.findUnique).toHaveBeenCalledWith({
        where: { storeId_themeId_status: { storeId: STORE_ID, themeId: THEME_ID, status: ConfigStatus.DRAFT } },
      });
    });

    it('returns cached value without DB hit', async () => {
      mockCache.get.mockResolvedValue(DRAFT_ROW);
      const result = await service.getDraft(STORE_ID, THEME_ID);
      expect(result).toEqual(DRAFT_ROW);
      expect(mockPrisma.themeConfig.findUnique).not.toHaveBeenCalled();
    });

    it('creates draft from published when no draft exists for this themeId', async () => {
      mockCache.get.mockResolvedValue(null);
      mockPrisma.themeConfig.findUnique
        .mockResolvedValueOnce(null)     // draft not found
        .mockResolvedValueOnce(PUB_ROW); // published found
      mockPrisma.themeConfig.create.mockResolvedValue(DRAFT_ROW);

      await service.getDraft(STORE_ID, THEME_ID);
      expect(mockPrisma.themeConfig.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ themeId: THEME_ID, status: ConfigStatus.DRAFT }),
        }),
      );
    });

    it('two different themes have isolated draft configs', async () => {
      const THEME_B = 'dawn';
      const DRAFT_B = { ...DRAFT_ROW, themeId: THEME_B, config: { ...DRAFT_ROW.config, colors: { ...DRAFT_ROW.config.colors, primary: '#000000' } } };

      mockCache.get
        .mockResolvedValueOnce(DRAFT_ROW)  // fresh draft — from cache
        .mockResolvedValueOnce(null);       // dawn draft — cache miss

      mockPrisma.themeConfig.findUnique.mockResolvedValue(DRAFT_B);

      const resultA = await service.getDraft(STORE_ID, THEME_ID);
      const resultB = await service.getDraft(STORE_ID, THEME_B);

      expect(resultA.config.colors.primary).toBe('#16a34a');
      expect(resultB.themeId).toBe(THEME_B);
    });
  });

  // ── updateDraft ──────────────────────────────────────────────────────────────

  describe('updateDraft', () => {
    it('uses themeId-scoped unique where clause on update', async () => {
      mockCache.get.mockResolvedValue(DRAFT_ROW);
      mockPrisma.themeConfig.update.mockResolvedValue(DRAFT_ROW);
      await service.updateDraft(STORE_ID, THEME_ID, { colors: { primary: '#dc2626' } as any });
      expect(mockPrisma.themeConfig.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { storeId_themeId_status: { storeId: STORE_ID, themeId: THEME_ID, status: ConfigStatus.DRAFT } },
        }),
      );
    });

    it('merges colors without overwriting typography or layout', async () => {
      mockCache.get.mockResolvedValue(DRAFT_ROW);
      mockPrisma.themeConfig.update.mockImplementation(({ data }) =>
        Promise.resolve({ ...DRAFT_ROW, config: data.config }),
      );

      await service.updateDraft(STORE_ID, THEME_ID, { colors: { primary: '#dc2626' } as any });

      const updatedConfig = mockPrisma.themeConfig.update.mock.calls[0][0].data.config;
      expect(updatedConfig.colors.primary).toBe('#dc2626');
      expect(updatedConfig.typography.headingFont).toBe('Nunito'); // unchanged
      expect(updatedConfig.layout.stickyHeader).toBe(true);         // unchanged
    });

    it('invalidates themeId-scoped draft cache key after update', async () => {
      mockCache.get.mockResolvedValue(DRAFT_ROW);
      mockPrisma.themeConfig.update.mockResolvedValue(DRAFT_ROW);
      await service.updateDraft(STORE_ID, THEME_ID, { layout: { backToTop: false } as any });
      expect(mockCache.del).toHaveBeenCalledWith(
        expect.stringContaining(THEME_ID),
      );
    });
  });
});
