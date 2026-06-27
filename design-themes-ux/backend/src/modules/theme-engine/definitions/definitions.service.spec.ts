import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DefinitionsService } from './definitions.service';
import { PrismaService }      from '@/prisma/prisma.service';
import { CacheService }       from '@/shared/cache/cache.service';

const mockPrisma = {
  sectionDefinition: {
    findMany:  jest.fn(),
    findUnique: jest.fn(),
  },
  blockDefinition: {
    findMany:  jest.fn(),
    findUnique: jest.fn(),
  },
};

const mockCache = {
  get:  jest.fn(),
  set:  jest.fn(),
  del:  jest.fn(),
  invalidatePattern: jest.fn(),
};

const MOCK_SECTION_DEF = {
  id: 'hero', name: 'Hero banner', category: 'MEDIA', tier: 'FREE',
  isActive: true, settingsSchema: [], allowedBlockTypes: ['heading','button'], defaultBlocks: [],
};

const MOCK_BLOCK_DEF = {
  type: 'heading', name: 'Heading', tier: 'FREE', isRequired: false,
  allowedInSections: ['*'], settingsSchema: [],
};

describe('DefinitionsService', () => {
  let service: DefinitionsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DefinitionsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CacheService,  useValue: mockCache  },
      ],
    }).compile();

    service = module.get<DefinitionsService>(DefinitionsService);
  });

  // ── Section Definitions ───────────────────────────────────────────────────

  describe('listSectionDefinitions', () => {
    it('returns cached list on cache hit', async () => {
      mockCache.get.mockResolvedValueOnce([MOCK_SECTION_DEF]).mockResolvedValueOnce([]);
      const result = await service.listSectionDefinitions('store_1');
      expect(result).toHaveLength(1);
      expect(mockPrisma.sectionDefinition.findMany).not.toHaveBeenCalled();
    });

    it('queries DB and caches on cache miss', async () => {
      mockCache.get.mockResolvedValue(null);
      mockPrisma.sectionDefinition.findMany.mockResolvedValue([MOCK_SECTION_DEF]);
      const result = await service.listSectionDefinitions('store_1');
      expect(result.length).toBeGreaterThan(0);
      expect(mockCache.set).toHaveBeenCalled();
    });

    it('filters by category', async () => {
      mockCache.get.mockResolvedValueOnce([MOCK_SECTION_DEF, { ...MOCK_SECTION_DEF, id: 'newsletter', category: 'SOCIAL' }]).mockResolvedValueOnce([]);
      const result = await service.listSectionDefinitions('store_1', { category: 'MEDIA' as any });
      expect(result.every((s: any) => s.category === 'MEDIA')).toBe(true);
    });

    it('filters by search term', async () => {
      mockCache.get.mockResolvedValueOnce([MOCK_SECTION_DEF, { ...MOCK_SECTION_DEF, id: 'newsletter', name: 'Newsletter' }]).mockResolvedValueOnce([]);
      const result = await service.listSectionDefinitions('store_1', { search: 'hero' });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('hero');
    });
  });

  describe('getSectionDefinition', () => {
    it('returns section definition by id', async () => {
      mockPrisma.sectionDefinition.findUnique.mockResolvedValue(MOCK_SECTION_DEF);
      const result = await service.getSectionDefinition('hero');
      expect(result.id).toBe('hero');
    });

    it('throws NotFoundException for unknown type', async () => {
      mockPrisma.sectionDefinition.findUnique.mockResolvedValue(null);
      await expect(service.getSectionDefinition('unknown')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException for inactive section', async () => {
      mockPrisma.sectionDefinition.findUnique.mockResolvedValue({ ...MOCK_SECTION_DEF, isActive: false });
      await expect(service.getSectionDefinition('hero')).rejects.toThrow(NotFoundException);
    });
  });

  // ── Block Definitions ─────────────────────────────────────────────────────

  describe('listBlockDefinitions', () => {
    it('returns cached list on cache hit', async () => {
      mockCache.get.mockResolvedValue([MOCK_BLOCK_DEF]);
      const result = await service.listBlockDefinitions();
      expect(result).toHaveLength(1);
      expect((mockPrisma as any).blockDefinition.findMany).not.toHaveBeenCalled();
    });

    it('filters by sectionType using allowedInSections', async () => {
      const headerBlock = { ...MOCK_BLOCK_DEF, type: 'logo', allowedInSections: ['header'] };
      mockCache.get.mockResolvedValue([MOCK_BLOCK_DEF, headerBlock]);
      const result = await service.listBlockDefinitions({ sectionType: 'header' });
      // heading has ['*'] — matches all; logo has ['header'] — matches
      expect(result.length).toBe(2);
    });

    it('returns only wildcard blocks for non-header sectionType', async () => {
      const headerBlock = { ...MOCK_BLOCK_DEF, type: 'logo', allowedInSections: ['header'] };
      mockCache.get.mockResolvedValue([MOCK_BLOCK_DEF, headerBlock]);
      const result = await service.listBlockDefinitions({ sectionType: 'hero' });
      // heading has ['*'] — matches; logo has ['header'] — does NOT match hero
      expect(result.length).toBe(1);
      expect(result[0].type).toBe('heading');
    });
  });

  describe('getBlockDefinition', () => {
    it('returns block definition by type', async () => {
      mockCache.get.mockResolvedValue(null);
      (mockPrisma as any).blockDefinition.findUnique.mockResolvedValue(MOCK_BLOCK_DEF);
      const result = await service.getBlockDefinition('heading');
      expect(result.type).toBe('heading');
    });

    it('returns from cache without hitting DB', async () => {
      mockCache.get.mockResolvedValue(MOCK_BLOCK_DEF);
      const result = await service.getBlockDefinition('heading');
      expect(result.type).toBe('heading');
      expect((mockPrisma as any).blockDefinition.findUnique).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for unknown type', async () => {
      mockCache.get.mockResolvedValue(null);
      (mockPrisma as any).blockDefinition.findUnique.mockResolvedValue(null);
      await expect(service.getBlockDefinition('does_not_exist')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getBlockDefinitionsMap', () => {
    it('returns a Record keyed by block type', async () => {
      mockCache.get.mockResolvedValue([MOCK_BLOCK_DEF, { ...MOCK_BLOCK_DEF, type: 'button' }]);
      const map = await service.getBlockDefinitionsMap();
      expect(map['heading']).toBeDefined();
      expect(map['button']).toBeDefined();
    });
  });
});
