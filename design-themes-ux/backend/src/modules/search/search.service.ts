import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { buildProductWhere, buildOrderBy, SortOption } from '@/common/catalog/product-query.util';

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Full-text product search. Shares its filter/sort building blocks with
   * the storefront Product Listing API (`buildProductWhere`/`buildOrderBy`
   * in `@/common/catalog/product-query.util`) rather than duplicating Prisma
   * where-clause logic — keeps the two endpoints' filtering behavior
   * consistent as the catalog grows.
   */
  async search(storeId: string, query: any) {
    const {
      q, category, minPrice, maxPrice,
      sortBy = 'relevance', page = 1, limit = 24,
    } = query;

    const sortMap: Record<string, SortOption> = {
      price_asc: 'price_asc', price_desc: 'price_desc', name: 'alphabetical',
    };

    const where = await buildProductWhere(this.prisma, storeId, {
      q,
      categorySlug: undefined,
      ...(category ? { ids: undefined } : {}),
      priceMin: minPrice ? Number(minPrice) : undefined,
      priceMax: maxPrice ? Number(maxPrice) : undefined,
    });
    // `category` here is historically a category ID (not slug) — apply directly.
    const finalWhere = where && category ? { ...where, categoryId: category } : where;

    if (finalWhere === null) {
      await this.trackSearch(storeId, q, 0);
      return { items: [], pagination: { page: Number(page), limit: Number(limit), total: 0, totalPages: 0 }, query: q };
    }

    const orderBy = buildOrderBy(sortMap[sortBy]);

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where: finalWhere,
        skip: (page - 1) * limit,
        take: Number(limit),
        orderBy,
        include: { category: { select: { id: true, name: true } } },
      }),
      this.prisma.product.count({ where: finalWhere }),
    ]);

    await this.trackSearch(storeId, q, total);

    return {
      items,
      pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / limit) },
      query: q,
    };
  }

  async autocomplete(storeId: string, q: string) {
    if (!q || q.length < 2) return [];

    const products = await this.prisma.product.findMany({
      where: { storeId, status: 'ACTIVE', name: { contains: q } },
      take: 5,
      select: { id: true, name: true, thumbnail: true, price: true },
    });

    const categories = await this.prisma.category.findMany({
      where: { storeId, name: { contains: q } },
      take: 3,
      select: { id: true, name: true },
    });

    return { products, categories };
  }

  async getSearchConfig(storeId: string) {
    let config = await this.prisma.searchConfig.findUnique({ where: { storeId } });
    if (!config) {
      config = await this.prisma.searchConfig.create({
        data: {
          storeId,
          autocomplete: true,
          fuzzy: true,
          synonyms: true,
          spellcheck: false,
          recommendations: true,
          boost: false,
          resultLimit: 24,
        },
      });
    }
    return config;
  }

  async updateSearchConfig(storeId: string, dto: any) {
    return this.prisma.searchConfig.upsert({
      where: { storeId },
      create: { ...dto, storeId },
      update: dto,
    });
  }

  async listSynonyms(storeId: string) {
    return this.prisma.searchSynonym.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createSynonym(storeId: string, dto: { terms: string[] }) {
    return this.prisma.searchSynonym.create({ data: { ...dto, storeId } });
  }

  async removeSynonym(storeId: string, id: string) {
    const synonym = await this.prisma.searchSynonym.findFirst({ where: { id, storeId } });
    if (!synonym) throw new NotFoundException('Synonym not found');
    await this.prisma.searchSynonym.delete({ where: { id } });
    return { message: 'Synonym deleted' };
  }

  async listMerchandisingRules(storeId: string) {
    return this.prisma.merchandisingRule.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createMerchandisingRule(storeId: string, dto: any) {
    return this.prisma.merchandisingRule.create({ data: { ...dto, storeId } });
  }

  async updateMerchandisingRule(storeId: string, id: string, dto: any) {
    const rule = await this.prisma.merchandisingRule.findFirst({ where: { id, storeId } });
    if (!rule) throw new NotFoundException('Rule not found');
    return this.prisma.merchandisingRule.update({ where: { id }, data: dto });
  }

  async removeMerchandisingRule(storeId: string, id: string) {
    const rule = await this.prisma.merchandisingRule.findFirst({ where: { id, storeId } });
    if (!rule) throw new NotFoundException('Rule not found');
    await this.prisma.merchandisingRule.delete({ where: { id } });
    return { message: 'Rule deleted' };
  }

  async getSearchAnalytics(storeId: string, period = '30d') {
    const days = { '7d': 7, '30d': 30, '90d': 90 }[period] ?? 30;
    const since = new Date(Date.now() - days * 86400000);

    const [topQueries, zeroResults] = await Promise.all([
      this.prisma.searchQuery.groupBy({
        by: ['query'],
        where: { storeId, createdAt: { gte: since } },
        _count: { _all: true },
        _avg: { resultCount: true },
        orderBy: { _count: { query: 'desc' } },
        take: 20,
      }),
      this.prisma.searchQuery.findMany({
        where: { storeId, resultCount: 0, createdAt: { gte: since } },
        distinct: ['query'],
        take: 20,
        select: { query: true, createdAt: true },
      }),
    ]);

    return { topQueries, zeroResults };
  }

  private async trackSearch(storeId: string, query: string, resultCount: number) {
    if (!query) return;
    await this.prisma.searchQuery.create({
      data: { storeId, query, resultCount },
    }).catch(() => null);
  }
}
