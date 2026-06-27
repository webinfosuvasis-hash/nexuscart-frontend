import { Test, TestingModule }  from '@nestjs/testing';
import {
  BadRequestException, ForbiddenException, NotFoundException,
} from '@nestjs/common';
import { SectionsService }  from './sections.service';
import { PrismaService }    from '@/prisma/prisma.service';
import { CacheService }     from '@/shared/cache/cache.service';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockPrisma = {
  // ── Catalog ──────────────────────────────────────────────────────────────
  sectionDefinition: {
    findUnique: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(),
    create:     jest.fn(), update:  jest.fn(),
  },
  blockDefinition: {
    findUnique: jest.fn(), findMany: jest.fn(),
  },
  // ── Page sections + blocks ────────────────────────────────────────────────
  themePageSection: {
    findFirst: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(),
    aggregate: jest.fn(), create:  jest.fn(), createMany: jest.fn(),
    update:    jest.fn(), delete:  jest.fn(), deleteMany: jest.fn(),
    count:     jest.fn(),
  },
  themePageBlock: {
    findFirst: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(),
    aggregate: jest.fn(), create:  jest.fn(), createMany: jest.fn(),
    update:    jest.fn(), delete:  jest.fn(), deleteMany: jest.fn(),
    count:     jest.fn(), groupBy: jest.fn(),
  },
  // ── Theme config (needed by PublishService) ───────────────────────────────
  themeConfig:  { findUnique: jest.fn(), upsert: jest.fn() },
  headerConfig: { findUnique: jest.fn(), upsert: jest.fn() },
  footerConfig: { findUnique: jest.fn(), upsert: jest.fn() },
  theme:        { findUnique: jest.fn() },
  themePreset:  { create:     jest.fn() },
  storeTheme:   { findFirst:  jest.fn() },
  $transaction: jest.fn((fn: any) => fn(mockPrisma)),
};

const mockCache = {
  get:               jest.fn(),
  set:               jest.fn(),
  del:               jest.fn(),
  invalidatePattern: jest.fn(),
};

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const STORE_ID  = 'store_1';
const THEME_ID  = 'fresh';
const PAGE_ID   = 'home';
const SEC_ID    = 'sec_hero_001';
const BLK_ID    = 'blk_heading_001';

const MOCK_SECTION = {
  id:           SEC_ID,
  storeId:      STORE_ID,
  themeId:      THEME_ID,
  pageId:       PAGE_ID,
  sectionDefId: 'hero',
  settings:     {},
  sortOrder:    1.0,
  isVisible:    true,
  isDraft:      true,
  definition:   {
    id:                'hero',
    allowedBlockTypes: ['heading', 'paragraph', 'button', 'image'],
  },
};

const MOCK_BLOCK = {
  id:        BLK_ID,
  storeId:   STORE_ID,
  themeId:   THEME_ID,
  sectionId: SEC_ID,
  type:      'heading',
  settings:  { text: 'Welcome', typographyPreset: 'h1', textColor: '#ffffff' },
  sortOrder: 1.0,
  isVisible: true,
  isDraft:   true,
};

const MOCK_SECTION_DEF = {
  id:                'hero',
  isActive:          true,
  allowedBlockTypes: ['heading', 'paragraph', 'button'],
  defaultBlocks: [
    { type: 'heading', settings: { text: 'Browse our latest products', typographyPreset: 'h1', textColor: '#ffffff' }, sortOrder: 1.0 },
    { type: 'button',  settings: { label: 'Shop all', style: 'outline' }, sortOrder: 2.0 },
  ],
};

const MOCK_BLOCK_DEF_HEADING = {
  type:              'heading',
  isRequired:        false,
  allowedInSections: ['*'],
};

const MOCK_BLOCK_DEF_LOGO = {
  type:              'logo',
  isRequired:        true,       // ← required — cannot be deleted
  allowedInSections: ['header'],
};

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('SectionsService — Block methods (Sprint 4.5.1)', () => {
  let service: SectionsService;

  beforeEach(async () => {
    jest.resetAllMocks();
    // $transaction handles both:
    //   (1) interactive: fn => fn(tx)    — used by publish, upsert, etc.
    //   (2) batch array: [p1, p2, ...]   — used by reorderBlocks
    mockPrisma.$transaction.mockImplementation((fnOrArray: any) => {
      if (Array.isArray(fnOrArray)) return Promise.all(fnOrArray);
      return fnOrArray(mockPrisma);
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SectionsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CacheService,  useValue: mockCache  },
      ],
    }).compile();

    service = module.get<SectionsService>(SectionsService);
  });

  // ── getPageSections includes blocks ──────────────────────────────────────────

  describe('getPageSections — includes blocks', () => {
    it('returns sections with blocks[] embedded from DB', async () => {
      mockCache.get.mockResolvedValue(null);
      const sectionWithBlocks = { ...MOCK_SECTION, blocks: [MOCK_BLOCK], definition: MOCK_SECTION.definition };
      mockPrisma.themePageSection.findMany.mockResolvedValue([sectionWithBlocks]);

      const result = await service.getPageSections(STORE_ID, THEME_ID, PAGE_ID, true);

      expect(result).toHaveLength(1);
      expect(result[0].blocks).toBeDefined();
      expect(result[0].blocks).toHaveLength(1);
      expect(result[0].blocks[0].type).toBe('heading');
    });

    it('returns cached sections (with embedded blocks) without DB hit', async () => {
      const cachedSections = [{ ...MOCK_SECTION, blocks: [MOCK_BLOCK] }];
      mockCache.get.mockResolvedValue(cachedSections);

      const result = await service.getPageSections(STORE_ID, THEME_ID, PAGE_ID, true);

      expect(result[0].blocks).toHaveLength(1);
      expect(mockPrisma.themePageSection.findMany).not.toHaveBeenCalled();
    });

    it('queries blocks with matching isDraft filter', async () => {
      mockCache.get.mockResolvedValue(null);
      mockPrisma.themePageSection.findMany.mockResolvedValue([]);

      await service.getPageSections(STORE_ID, THEME_ID, PAGE_ID, true);

      const call = mockPrisma.themePageSection.findMany.mock.calls[0][0];
      expect(call.include.blocks.where.isDraft).toBe(true);
      expect(call.include.blocks.orderBy.sortOrder).toBe('asc');
    });
  });

  // ── addBlock ─────────────────────────────────────────────────────────────────

  describe('addBlock', () => {
    beforeEach(() => {
      mockPrisma.themePageSection.findFirst.mockResolvedValue(MOCK_SECTION);
      mockPrisma.blockDefinition.findUnique.mockResolvedValue(MOCK_BLOCK_DEF_HEADING);
      mockPrisma.themePageBlock.aggregate.mockResolvedValue({ _max: { sortOrder: 1.0 } });
      mockPrisma.themePageBlock.create.mockResolvedValue({ ...MOCK_BLOCK, id: 'blk_new' });
    });

    it('creates a block and returns it', async () => {
      const result = await service.addBlock(STORE_ID, THEME_ID, SEC_ID, {
        type: 'heading', settings: { text: 'Test' },
      });
      expect(result).toBeDefined();
      expect(mockPrisma.themePageBlock.create).toHaveBeenCalled();
    });

    it('assigns sortOrder = maxExisting + 1.0 when not provided', async () => {
      mockPrisma.themePageBlock.aggregate.mockResolvedValue({ _max: { sortOrder: 3.0 } });
      await service.addBlock(STORE_ID, THEME_ID, SEC_ID, { type: 'heading' });
      const createCall = mockPrisma.themePageBlock.create.mock.calls[0][0];
      expect(Number(createCall.data.sortOrder)).toBe(4.0);
    });

    it('uses explicit sortOrder when provided', async () => {
      await service.addBlock(STORE_ID, THEME_ID, SEC_ID, { type: 'heading', sortOrder: 7.5 });
      const createCall = mockPrisma.themePageBlock.create.mock.calls[0][0];
      expect(createCall.data.sortOrder).toBe(7.5);
    });

    it('throws BadRequestException when block type is not in SectionDefinition.allowedBlockTypes', async () => {
      mockPrisma.themePageSection.findFirst.mockResolvedValue({
        ...MOCK_SECTION,
        definition: { id: 'hero', allowedBlockTypes: ['heading', 'button'] }, // 'logo' NOT allowed
      });
      mockPrisma.blockDefinition.findUnique.mockResolvedValue({
        ...MOCK_BLOCK_DEF_HEADING,
        type: 'logo',
        allowedInSections: ['header'],  // 'hero' NOT in allowedInSections
      });

      await expect(
        service.addBlock(STORE_ID, THEME_ID, SEC_ID, { type: 'logo' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when section is not found', async () => {
      mockPrisma.themePageSection.findFirst.mockResolvedValue(null);
      await expect(
        service.addBlock(STORE_ID, THEME_ID, 'nonexistent_section', { type: 'heading' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('invalidates page sections cache and section blocks cache after add', async () => {
      await service.addBlock(STORE_ID, THEME_ID, SEC_ID, { type: 'heading' });
      expect(mockCache.del).toHaveBeenCalled();
    });
  });

  // ── updateBlock ──────────────────────────────────────────────────────────────

  describe('updateBlock', () => {
    beforeEach(() => {
      mockPrisma.themePageBlock.findFirst.mockResolvedValue(MOCK_BLOCK);
      mockPrisma.themePageSection.findUnique.mockResolvedValue({
        pageId: PAGE_ID, themeId: THEME_ID, isDraft: true,
      });
      mockPrisma.themePageBlock.update.mockResolvedValue({ ...MOCK_BLOCK, settings: { text: 'Updated' } });
    });

    it('updates block settings and returns updated block', async () => {
      const result = await service.updateBlock(STORE_ID, SEC_ID, BLK_ID, {
        settings: { text: 'Updated heading' },
      });
      expect(result.settings).toEqual({ text: 'Updated' });
      expect(mockPrisma.themePageBlock.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: BLK_ID },
          data:  expect.objectContaining({ settings: { text: 'Updated heading' } }),
        }),
      );
    });

    it('throws NotFoundException when block does not belong to section', async () => {
      mockPrisma.themePageBlock.findFirst.mockResolvedValue(null);
      await expect(
        service.updateBlock(STORE_ID, SEC_ID, 'wrong_block', { settings: {} }),
      ).rejects.toThrow(NotFoundException);
    });

    it('invalidates caches after update', async () => {
      await service.updateBlock(STORE_ID, SEC_ID, BLK_ID, { isVisible: false });
      expect(mockCache.del).toHaveBeenCalled();
    });
  });

  // ── deleteBlock ──────────────────────────────────────────────────────────────

  describe('deleteBlock', () => {
    beforeEach(() => {
      mockPrisma.themePageSection.findUnique.mockResolvedValue({
        pageId: PAGE_ID, themeId: THEME_ID, isDraft: true,
      });
    });

    it('deletes a non-required block', async () => {
      mockPrisma.themePageBlock.findFirst.mockResolvedValue(MOCK_BLOCK);
      mockPrisma.blockDefinition.findUnique.mockResolvedValue(MOCK_BLOCK_DEF_HEADING); // isRequired: false
      mockPrisma.themePageBlock.delete.mockResolvedValue(MOCK_BLOCK);

      await service.deleteBlock(STORE_ID, SEC_ID, BLK_ID);
      expect(mockPrisma.themePageBlock.delete).toHaveBeenCalledWith({ where: { id: BLK_ID } });
    });

    it('throws ForbiddenException when block type is isRequired', async () => {
      const logoBlock = { ...MOCK_BLOCK, type: 'logo', id: 'blk_logo' };
      mockPrisma.themePageBlock.findFirst.mockResolvedValue(logoBlock);
      mockPrisma.blockDefinition.findUnique.mockResolvedValue(MOCK_BLOCK_DEF_LOGO); // isRequired: true

      await expect(
        service.deleteBlock(STORE_ID, SEC_ID, 'blk_logo'),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.themePageBlock.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when block does not exist', async () => {
      mockPrisma.themePageBlock.findFirst.mockResolvedValue(null);
      await expect(
        service.deleteBlock(STORE_ID, SEC_ID, 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('still deletes if block type has no BlockDefinition (unknown/custom type)', async () => {
      const customBlock = { ...MOCK_BLOCK, type: 'custom_widget' };
      mockPrisma.themePageBlock.findFirst.mockResolvedValue(customBlock);
      mockPrisma.blockDefinition.findUnique.mockResolvedValue(null); // no definition
      mockPrisma.themePageBlock.delete.mockResolvedValue(customBlock);

      await service.deleteBlock(STORE_ID, SEC_ID, BLK_ID);
      expect(mockPrisma.themePageBlock.delete).toHaveBeenCalled();
    });
  });

  // ── reorderBlocks ─────────────────────────────────────────────────────────────

  describe('reorderBlocks', () => {
    const BLOCK_IDS = ['blk_a', 'blk_b', 'blk_c'];

    beforeEach(() => {
      mockPrisma.themePageBlock.findMany
        .mockResolvedValueOnce(BLOCK_IDS.map((id) => ({ id })))  // validation query
        .mockResolvedValueOnce(                                    // getBlocksForSection
          BLOCK_IDS.map((id, i) => ({ ...MOCK_BLOCK, id, sortOrder: i + 1 })),
        );
      mockPrisma.themePageSection.findUnique.mockResolvedValue({
        pageId: PAGE_ID, themeId: THEME_ID, isDraft: true,
      });
      mockCache.get.mockResolvedValue(null);
    });

    it('assigns sortOrder 1.0, 2.0, 3.0 in submitted order', async () => {
      mockPrisma.themePageBlock.update.mockResolvedValue({});

      await service.reorderBlocks(STORE_ID, SEC_ID, { orderedIds: BLOCK_IDS });

      // $transaction is called with an array of update promises (batch form)
      expect(mockPrisma.$transaction).toHaveBeenCalledWith(
        expect.arrayContaining([expect.any(Object)]),
      );
      // One update per block ID, each with incremental sortOrder
      expect(mockPrisma.themePageBlock.update).toHaveBeenCalledTimes(BLOCK_IDS.length);
      // Verify each block gets sortOrder 1.0, 2.0, 3.0
      const calls = mockPrisma.themePageBlock.update.mock.calls;
      expect(calls[0][0].data.sortOrder).toBe(1.0);
      expect(calls[1][0].data.sortOrder).toBe(2.0);
      expect(calls[2][0].data.sortOrder).toBe(3.0);
    });

    it('throws BadRequestException when an ID does not belong to the section', async () => {
      mockPrisma.themePageBlock.findMany.mockResolvedValueOnce([{ id: 'blk_a' }, { id: 'blk_b' }]);
      await expect(
        service.reorderBlocks(STORE_ID, SEC_ID, { orderedIds: ['blk_a', 'blk_b', 'blk_unknown'] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('invalidates cache after reorder', async () => {
      await service.reorderBlocks(STORE_ID, SEC_ID, { orderedIds: BLOCK_IDS });
      expect(mockCache.del).toHaveBeenCalled();
    });
  });

  // ── seedDefaultBlocks ─────────────────────────────────────────────────────────

  describe('seedDefaultBlocks', () => {
    it('creates blocks from SectionDefinition.defaultBlocks', async () => {
      mockPrisma.themePageBlock.count.mockResolvedValue(0);  // no existing blocks
      mockPrisma.sectionDefinition.findUnique.mockResolvedValue(MOCK_SECTION_DEF);
      mockPrisma.themePageBlock.createMany.mockResolvedValue({ count: 2 });

      await service.seedDefaultBlocks(SEC_ID, 'hero', true, THEME_ID, STORE_ID);

      expect(mockPrisma.themePageBlock.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ type: 'heading', sectionId: SEC_ID, isDraft: true }),
            expect.objectContaining({ type: 'button',  sectionId: SEC_ID, isDraft: true }),
          ]),
        }),
      );
    });

    it('is idempotent — does nothing when blocks already exist', async () => {
      mockPrisma.themePageBlock.count.mockResolvedValue(2);  // blocks already exist

      await service.seedDefaultBlocks(SEC_ID, 'hero', true, THEME_ID, STORE_ID);

      expect(mockPrisma.themePageBlock.createMany).not.toHaveBeenCalled();
      expect(mockPrisma.sectionDefinition.findUnique).not.toHaveBeenCalled();
    });

    it('does nothing when SectionDefinition has no defaultBlocks', async () => {
      mockPrisma.themePageBlock.count.mockResolvedValue(0);
      mockPrisma.sectionDefinition.findUnique.mockResolvedValue({ ...MOCK_SECTION_DEF, defaultBlocks: [] });

      await service.seedDefaultBlocks(SEC_ID, 'hero', true, THEME_ID, STORE_ID);

      expect(mockPrisma.themePageBlock.createMany).not.toHaveBeenCalled();
    });

    it('does nothing when SectionDefinition.defaultBlocks is null', async () => {
      mockPrisma.themePageBlock.count.mockResolvedValue(0);
      mockPrisma.sectionDefinition.findUnique.mockResolvedValue({ ...MOCK_SECTION_DEF, defaultBlocks: null });

      await service.seedDefaultBlocks(SEC_ID, 'hero', true, THEME_ID, STORE_ID);

      expect(mockPrisma.themePageBlock.createMany).not.toHaveBeenCalled();
    });

    it('sets themeId, storeId, isDraft correctly on created blocks', async () => {
      mockPrisma.themePageBlock.count.mockResolvedValue(0);
      mockPrisma.sectionDefinition.findUnique.mockResolvedValue(MOCK_SECTION_DEF);
      mockPrisma.themePageBlock.createMany.mockResolvedValue({ count: 2 });

      await service.seedDefaultBlocks(SEC_ID, 'hero', false, THEME_ID, STORE_ID);

      const createCall = mockPrisma.themePageBlock.createMany.mock.calls[0][0];
      expect(createCall.data[0].storeId).toBe(STORE_ID);
      expect(createCall.data[0].themeId).toBe(THEME_ID);
      expect(createCall.data[0].isDraft).toBe(false);   // published section → published blocks
    });
  });
});

// ─── PublishService block tests ───────────────────────────────────────────────

import { PublishService } from '../publish/publish.service';
import { CdnService }     from '@/shared/cdn/cdn.service';
import { ConfigStatus }   from '@prisma/client';

const mockCdn = { purge: jest.fn().mockResolvedValue({ success: true }) };

const DRAFT_THEME_ROW = {
  id: 'cfg_1', storeId: STORE_ID, themeId: THEME_ID, status: ConfigStatus.DRAFT,
  version: 2, config: { colors: {}, typography: {}, layout: {} },
};
const PUB_THEME_ROW = { ...DRAFT_THEME_ROW, status: ConfigStatus.PUBLISHED };

describe('PublishService — block promotion (Sprint 4.5.1)', () => {
  let service: PublishService;

  beforeEach(async () => {
    // resetAllMocks clears queued mockResolvedValueOnce values in addition to call history
    jest.resetAllMocks();
    mockPrisma.$transaction.mockImplementation((fnOrArray: any) => {
      if (Array.isArray(fnOrArray)) return Promise.all(fnOrArray);
      return fnOrArray(mockPrisma);
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PublishService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CacheService,  useValue: mockCache  },
        { provide: CdnService,    useValue: mockCdn    },
      ],
    }).compile();
    service = module.get<PublishService>(PublishService);
  });

  const setupPublishMocks = () => {
    mockPrisma.themeConfig.findUnique.mockImplementation(({ where }: any) =>
      where.storeId_themeId_status.status === ConfigStatus.DRAFT
        ? Promise.resolve(DRAFT_THEME_ROW)
        : Promise.resolve(PUB_THEME_ROW),
    );
    mockPrisma.headerConfig.findUnique.mockResolvedValue(null);
    mockPrisma.footerConfig.findUnique.mockResolvedValue(null);
    mockPrisma.theme.findUnique.mockResolvedValue({ version: '1.8.0' });
    mockPrisma.themePreset.create.mockResolvedValue({ id: 'snap_001' });
    mockPrisma.themeConfig.upsert.mockResolvedValue({ ...PUB_THEME_ROW, version: 3 });
    mockPrisma.themePageSection.findMany.mockResolvedValue([]);
    mockPrisma.themePageSection.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.themePageSection.createMany.mockResolvedValue({ count: 0 });
    mockPrisma.themePageBlock.findMany.mockResolvedValue([]);
    mockPrisma.themePageBlock.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.themePageBlock.createMany.mockResolvedValue({ count: 0 });
    mockCache.invalidatePattern.mockResolvedValue(3);
    mockCache.del.mockResolvedValue(undefined);
    // cdn.purge must return a Promise so .catch() works
    mockCdn.purge.mockResolvedValue({ success: true });
  };

  describe('publish()', () => {
    it('promotes draft blocks to published atomically', async () => {
      const draftBlockStubs = [
        { id: 'blk_d1', sectionId: SEC_ID },
        { id: 'blk_d2', sectionId: SEC_ID },
      ];
      const fullDraftBlocks = draftBlockStubs.map((s) => ({ ...MOCK_BLOCK, ...s }));

      setupPublishMocks();
      // First findMany (select: {id, sectionId}) → stubs
      // Second findMany (full data for createMany) → full blocks
      mockPrisma.themePageBlock.findMany
        .mockResolvedValueOnce(draftBlockStubs)
        .mockResolvedValueOnce(fullDraftBlocks);
      mockPrisma.themePageBlock.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.themePageBlock.createMany.mockResolvedValue({ count: 2 });

      await service.publish(STORE_ID, THEME_ID);

      // Verify published blocks were deleted then re-created
      expect(mockPrisma.themePageBlock.deleteMany).toHaveBeenCalled();
      expect(mockPrisma.themePageBlock.createMany).toHaveBeenCalled();
    });

    it('skips block promotion when no draft blocks exist', async () => {
      setupPublishMocks();
      // findMany for blocks returns empty
      mockPrisma.themePageBlock.findMany.mockResolvedValue([]);

      await service.publish(STORE_ID, THEME_ID);

      expect(mockPrisma.themePageBlock.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.themePageBlock.createMany).not.toHaveBeenCalled();
    });
  });

  describe('discardDraft()', () => {
    it('deletes all draft blocks for (storeId, themeId) during discard', async () => {
      mockPrisma.themeConfig.findUnique.mockResolvedValue(PUB_THEME_ROW);
      mockPrisma.headerConfig.findUnique.mockResolvedValue(null);
      mockPrisma.footerConfig.findUnique.mockResolvedValue(null);
      mockPrisma.themeConfig.upsert.mockResolvedValue({});
      mockPrisma.themePageSection.deleteMany.mockResolvedValue({ count: 2 });
      mockPrisma.themePageBlock.deleteMany.mockResolvedValue({ count: 5 });

      await service.discardDraft(STORE_ID, THEME_ID);

      expect(mockPrisma.themePageBlock.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ storeId: STORE_ID, isDraft: true }),
        }),
      );
    });
  });
});
