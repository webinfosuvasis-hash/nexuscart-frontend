import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { PresetsService } from './presets.service';
import { PrismaService } from '@/prisma/prisma.service';
import { CacheService }  from '@/shared/cache/cache.service';
import { ConfigStatus, PresetType } from '@prisma/client';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockPrisma = {
  themePreset: {
    findMany:  jest.fn(),
    findFirst: jest.fn(),
    create:    jest.fn(),
    update:    jest.fn(),
    delete:    jest.fn(),
  },
  themeConfig:  { findUnique: jest.fn() },
  headerConfig: { findUnique: jest.fn(), upsert: jest.fn() },
  footerConfig: { findUnique: jest.fn(), upsert: jest.fn() },
  storeTheme:   { findFirst: jest.fn() },
  $transaction: jest.fn((fn: any) => fn(mockPrisma)),
};

const mockCache = {
  get:  jest.fn(),
  set:  jest.fn(),
  del:  jest.fn(),
  invalidatePattern: jest.fn(),
};

const STORE_ID = 'store_xyz';

const SYSTEM_PRESET = {
  id: 'sys_1', storeId: null, type: PresetType.SYSTEM,
  themeId: 'fresh', themeVersion: '1.0.0',
  name: 'Grocery Light',
  config: { theme: { colors: { primary: '#16a34a' } } },
  isActive: false,
};

const CUSTOM_PRESET = {
  id: 'cus_1', storeId: STORE_ID, type: PresetType.CUSTOM,
  themeId: 'fresh', themeVersion: '1.0.0',
  name: 'Summer 2026',
  config: { theme: { colors: { primary: '#f97316' } } },
  isActive: false, expiresAt: null,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PresetsService', () => {
  let service: PresetsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PresetsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CacheService,  useValue: mockCache  },
      ],
    }).compile();

    service = module.get<PresetsService>(PresetsService);
  });

  // ── listPresets ─────────────────────────────────────────────────────────────

  describe('listPresets', () => {
    it('returns cached preset list without hitting MySQL', async () => {
      mockCache.get.mockResolvedValue({ system: [SYSTEM_PRESET], custom: [CUSTOM_PRESET] });
      const result = await service.listPresets(STORE_ID);
      expect(result.system).toHaveLength(1);
      expect(mockPrisma.themePreset.findMany).not.toHaveBeenCalled();
    });

    it('queries MySQL and caches on Redis miss', async () => {
      mockCache.get.mockResolvedValue(null);
      mockPrisma.themePreset.findMany
        .mockResolvedValueOnce([SYSTEM_PRESET])
        .mockResolvedValueOnce([CUSTOM_PRESET]);

      const result = await service.listPresets(STORE_ID);

      expect(result.system).toHaveLength(1);
      expect(result.custom).toHaveLength(1);
      expect(mockCache.set).toHaveBeenCalled();
    });
  });

  // ── createPreset ────────────────────────────────────────────────────────────

  describe('createPreset', () => {
    it('snapshots current draft config and creates CUSTOM preset', async () => {
      mockPrisma.themeConfig.findUnique.mockResolvedValue({
        config: CUSTOM_PRESET.config.theme, themeId: 'fresh',
      });
      mockPrisma.headerConfig.findUnique.mockResolvedValue(null);
      mockPrisma.footerConfig.findUnique.mockResolvedValue(null);
      mockPrisma.storeTheme.findFirst.mockResolvedValue({ themeId: 'fresh', theme: { id: 'fresh', version: '1.0.0' } });
      mockPrisma.themePreset.create.mockResolvedValue(CUSTOM_PRESET);

      const result = await service.createPreset(STORE_ID, { name: 'Summer 2026' });

      expect(mockPrisma.themePreset.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: PresetType.CUSTOM, name: 'Summer 2026' }),
        }),
      );
      expect(mockCache.del).toHaveBeenCalled();
    });

    it('throws BadRequestException when no draft theme config exists', async () => {
      mockPrisma.themeConfig.findUnique.mockResolvedValue(null);
      mockPrisma.headerConfig.findUnique.mockResolvedValue(null);
      mockPrisma.footerConfig.findUnique.mockResolvedValue(null);
      mockPrisma.storeTheme.findFirst.mockResolvedValue(null);

      await expect(
        service.createPreset(STORE_ID, { name: 'Test' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── deletePreset ────────────────────────────────────────────────────────────

  describe('deletePreset', () => {
    it('throws ForbiddenException for SYSTEM presets', async () => {
      mockPrisma.themePreset.findFirst.mockResolvedValue(SYSTEM_PRESET);
      await expect(service.deletePreset(STORE_ID, 'sys_1')).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when preset isActive', async () => {
      mockPrisma.themePreset.findFirst.mockResolvedValue({ ...CUSTOM_PRESET, isActive: true });
      await expect(service.deletePreset(STORE_ID, 'cus_1')).rejects.toThrow(ForbiddenException);
    });

    it('deletes and invalidates cache for valid CUSTOM preset', async () => {
      mockPrisma.themePreset.findFirst.mockResolvedValue(CUSTOM_PRESET);
      mockPrisma.themePreset.delete.mockResolvedValue(CUSTOM_PRESET);

      await service.deletePreset(STORE_ID, 'cus_1');

      expect(mockPrisma.themePreset.delete).toHaveBeenCalledWith({ where: { id: 'cus_1' } });
      expect(mockCache.del).toHaveBeenCalled();
    });
  });

  // ── importPreset ────────────────────────────────────────────────────────────

  describe('importPreset', () => {
    it('throws BadRequestException for invalid preset file format', async () => {
      await expect(
        service.importPreset(STORE_ID, {
          data: { _nexuscart: true, _version: '1.0' },   // wrong version
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when themeId does not match active theme', async () => {
      mockPrisma.storeTheme.findFirst.mockResolvedValue({
        themeId: 'dawn',
        theme: { id: 'dawn' },
      });

      await expect(
        service.importPreset(STORE_ID, {
          data: {
            _nexuscart:   true,
            _version:     '2.0',
            themeId:      'fresh',       // different from active theme 'dawn'
            themeVersion: '1.0.0',
            config:       { theme: {} },
          },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates preset from valid import data', async () => {
      mockPrisma.storeTheme.findFirst.mockResolvedValue({ themeId: 'fresh', theme: { id: 'fresh' } });
      mockPrisma.themePreset.create.mockResolvedValue(CUSTOM_PRESET);

      const result = await service.importPreset(STORE_ID, {
        name: 'Imported',
        data: {
          _nexuscart:   true,
          _version:     '2.0',
          themeId:      'fresh',
          themeVersion: '1.0.0',
          config:       { theme: { colors: {} } },
        },
      });

      expect(mockPrisma.themePreset.create).toHaveBeenCalled();
    });
  });

  // ── comparePresets ──────────────────────────────────────────────────────────

  describe('comparePresets', () => {
    it('returns empty array when two identical presets are compared', async () => {
      mockPrisma.themePreset.findFirst
        .mockResolvedValueOnce(CUSTOM_PRESET)
        .mockResolvedValueOnce(CUSTOM_PRESET);

      const diffs = await service.comparePresets(STORE_ID, 'cus_1', 'cus_1');
      expect(diffs).toHaveLength(0);
    });

    it('returns changed fields when colors differ between presets', async () => {
      const presetB = {
        ...CUSTOM_PRESET,
        id: 'cus_2',
        config: { theme: { colors: { primary: '#dc2626' } } },  // different primary
      };

      mockPrisma.themePreset.findFirst
        .mockResolvedValueOnce(CUSTOM_PRESET)
        .mockResolvedValueOnce(presetB);

      const diffs = await service.comparePresets(STORE_ID, 'cus_1', 'cus_2');

      expect(diffs.length).toBeGreaterThan(0);
      const primaryDiff = diffs.find((d) => d.field.includes('primary'));
      expect(primaryDiff).toBeDefined();
      expect(primaryDiff?.before).toBe('#f97316');
      expect(primaryDiff?.after).toBe('#dc2626');
    });

    it('throws NotFoundException when a preset does not belong to this store', async () => {
      mockPrisma.themePreset.findFirst.mockResolvedValue(null);
      await expect(
        service.comparePresets(STORE_ID, 'wrong_id', 'cus_1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── duplicatePreset ─────────────────────────────────────────────────────────

  describe('duplicatePreset', () => {
    it('creates a CUSTOM copy with "(Copy)" suffix', async () => {
      mockPrisma.themePreset.findFirst.mockResolvedValue(CUSTOM_PRESET);
      mockPrisma.themePreset.create.mockResolvedValue({
        ...CUSTOM_PRESET, id: 'cus_copy', name: 'Summer 2026 (Copy)',
      });

      const result = await service.duplicatePreset(STORE_ID, 'cus_1');

      expect(mockPrisma.themePreset.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Summer 2026 (Copy)',
            type: PresetType.CUSTOM,
          }),
        }),
      );
    });

    it('can duplicate a SYSTEM preset (creates tenant CUSTOM copy)', async () => {
      mockPrisma.themePreset.findFirst.mockResolvedValue(SYSTEM_PRESET);
      mockPrisma.themePreset.create.mockResolvedValue({
        ...SYSTEM_PRESET, id: 'cus_sys_copy', type: PresetType.CUSTOM, storeId: STORE_ID,
      });

      await service.duplicatePreset(STORE_ID, 'sys_1');

      const call = mockPrisma.themePreset.create.mock.calls[0][0];
      expect(call.data.type).toBe(PresetType.CUSTOM);
      expect(call.data.storeId).toBe(STORE_ID);
    });
  });
});
