import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CacheService }  from '@/shared/cache/cache.service';
import { CACHE_KEYS, CACHE_TTL } from '@/shared/cache/cache.constants';
import { SectionCategory, SectionTier } from '@prisma/client';

@Injectable()
export class DefinitionsService {
  private readonly logger = new Logger(DefinitionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache:  CacheService,
  ) {}

  // ── Section Definitions ──────────────────────────────────────────────────────

  async listSectionDefinitions(
    storeId: string,
    filters: { category?: SectionCategory; tier?: SectionTier; search?: string } = {},
  ) {
    // Built-in (storeId = null) + tenant-custom sections
    const builtInKey = CACHE_KEYS.sectionDefs();
    const customKey  = CACHE_KEYS.sectionDefsCustom(storeId);

    let [builtIn, custom] = await Promise.all([
      this.cache.get<any[]>(builtInKey),
      this.cache.get<any[]>(customKey),
    ]);

    if (!builtIn) {
      builtIn = await this.prisma.sectionDefinition.findMany({
        where:   { storeId: null, isActive: true },
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
      });
      await this.cache.set(builtInKey, builtIn, CACHE_TTL.DEFINITIONS);
    }

    if (!custom) {
      custom = await this.prisma.sectionDefinition.findMany({
        where:   { storeId, isActive: true },
        orderBy: { createdAt: 'desc' },
      });
      await this.cache.set(customKey, custom, CACHE_TTL.DEFINITIONS);
    }

    let all = [...builtIn, ...custom];

    if (filters.category) all = all.filter((s) => s.category === filters.category);
    if (filters.tier)     all = all.filter((s) => s.tier     === filters.tier);
    if (filters.search) {
      const q = filters.search.toLowerCase();
      all = all.filter(
        (s) => s.name.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q),
      );
    }

    return all;
  }

  async getSectionDefinition(id: string) {
    const def = await this.prisma.sectionDefinition.findUnique({ where: { id } });
    if (!def || !def.isActive) throw new NotFoundException(`Section definition "${id}" not found`);
    return def;
  }

  // ── Block Definitions ────────────────────────────────────────────────────────

  async listBlockDefinitions(filters: { sectionType?: string } = {}) {
    const cacheKey = CACHE_KEYS.blockDefs();
    let defs = await this.cache.get<any[]>(cacheKey);

    if (!defs) {
      defs = await (this.prisma as any).blockDefinition.findMany({
        orderBy: { type: 'asc' },
      });
      await this.cache.set(cacheKey, defs, CACHE_TTL.DEFINITIONS);
    }

    if (filters.sectionType) {
      defs = defs.filter(
        (d: any) =>
          Array.isArray(d.allowedInSections) &&
          (d.allowedInSections.includes('*') ||
           d.allowedInSections.includes(filters.sectionType!)),
      );
    }

    return defs;
  }

  async getBlockDefinition(type: string) {
    const cacheKey = CACHE_KEYS.blockDef(type);
    const cached   = await this.cache.get<any>(cacheKey);
    if (cached) return cached;

    const def = await (this.prisma as any).blockDefinition.findUnique({ where: { type } });
    if (!def) throw new NotFoundException(`Block definition "${type}" not found`);

    await this.cache.set(cacheKey, def, CACHE_TTL.DEFINITIONS);
    return def;
  }

  /**
   * Returns a keyed map of all block definitions — used by StorefrontService
   * to include definitions in DraftPageData without N+1 lookups.
   */
  async getBlockDefinitionsMap(): Promise<Record<string, any>> {
    const defs  = await this.listBlockDefinitions();
    const map: Record<string, any> = {};
    for (const d of defs) map[d.type] = d;
    return map;
  }

  /** Same for section definitions. */
  async getSectionDefinitionsMap(storeId: string): Promise<Record<string, any>> {
    const defs  = await this.listSectionDefinitions(storeId);
    const map: Record<string, any> = {};
    for (const d of defs) map[d.id] = d;
    return map;
  }

  /** Invalidate all definition caches (e.g., after a custom section upload). */
  async invalidateDefinitionCaches(storeId: string) {
    await Promise.all([
      this.cache.del(CACHE_KEYS.sectionDefs()),
      this.cache.del(CACHE_KEYS.sectionDefsCustom(storeId)),
      this.cache.del(CACHE_KEYS.blockDefs()),
    ]);
  }
}
