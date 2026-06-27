import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import slugify from 'slugify';

@Injectable()
export class CollectionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(storeId: string, query: any = {}) {
    const { search, type, page = 1, limit = 20 } = query;
    const where: any = { storeId };
    if (search) where.name = { contains: search };
    if (type) where.type = type;

    const [items, total] = await Promise.all([
      this.prisma.collection.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { products: true } } },
      }),
      this.prisma.collection.count({ where }),
    ]);

    return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(storeId: string, id: string) {
    const col = await this.prisma.collection.findFirst({
      where: { id, storeId },
      include: {
        products: {
          include: {
            product: {
              select: { id: true, name: true, thumbnail: true, price: true, status: true, stock: true },
            },
          },
          orderBy: [{ isPinned: 'desc' }, { sortOrder: 'asc' }],
        },
        _count: { select: { products: true } },
      },
    });
    if (!col) throw new NotFoundException('Collection not found');
    return col;
  }

  async create(storeId: string, dto: any) {
    const slug = dto.slug || slugify(dto.name, { lower: true, strict: true });
    const existing = await this.prisma.collection.findFirst({ where: { storeId, slug } });
    if (existing) throw new ConflictException('Collection slug already exists');

    const { productIds, ...colData } = dto;
    const col = await this.prisma.collection.create({
      data: {
        ...colData,
        slug,
        storeId,
        products: productIds?.length
          ? { create: productIds.map((pid: string, i: number) => ({ productId: pid, sortOrder: i })) }
          : undefined,
      },
      include: { _count: { select: { products: true } } },
    });

    return col;
  }

  async update(storeId: string, id: string, dto: any) {
    await this.findOne(storeId, id);
    const { productIds, ...colData } = dto;
    return this.prisma.collection.update({
      where: { id },
      data: { ...colData, updatedAt: new Date() },
    });
  }

  async remove(storeId: string, id: string) {
    await this.findOne(storeId, id);
    await this.prisma.collection.delete({ where: { id } });
    return { message: 'Collection deleted' };
  }

  async addProduct(storeId: string, colId: string, productId: string, isPinned = false) {
    await this.findOne(storeId, colId);
    const count = await this.prisma.productCollection.count({ where: { collectionId: colId } });
    return this.prisma.productCollection.upsert({
      where: { productId_collectionId: { productId, collectionId: colId } },
      create: { productId, collectionId: colId, isPinned, sortOrder: count },
      update: { isPinned },
    });
  }

  async removeProduct(storeId: string, colId: string, productId: string) {
    await this.findOne(storeId, colId);
    await this.prisma.productCollection.deleteMany({ where: { collectionId: colId, productId } });
    return { message: 'Product removed from collection' };
  }

  async reorderProducts(
    storeId: string,
    colId: string,
    orders: { productId: string; sortOrder: number }[],
  ) {
    await this.findOne(storeId, colId);
    await Promise.all(
      orders.map((o) =>
        this.prisma.productCollection.updateMany({
          where: { collectionId: colId, productId: o.productId },
          data: { sortOrder: o.sortOrder },
        }),
      ),
    );
    return { message: 'Products reordered' };
  }

  async syncSmartCollection(storeId: string, id: string) {
    const col = await this.findOne(storeId, id);
    if (col.type === 'MANUAL') return { message: 'Not a smart/auto collection' };

    const rules: any[] = (col.rules as unknown as any[]) ?? [];
    const where: any = { storeId };

    for (const rule of rules) {
      const { field, operator, value } = rule;
      if (field === 'price') {
        where.price = operator === 'gt' ? { gt: value } : operator === 'lt' ? { lt: value } : { equals: value };
      } else if (field === 'brandId') {
        where.brandId = value;
      } else if (field === 'tags') {
        where.tags = { array_contains: value };
      } else if (field === 'status') {
        where.status = value;
      }
    }

    const matchingProducts = await this.prisma.product.findMany({ where, select: { id: true } });

    await this.prisma.productCollection.deleteMany({ where: { collectionId: id } });
    if (matchingProducts.length > 0) {
      await this.prisma.productCollection.createMany({
        data: matchingProducts.map((p, i) => ({ productId: p.id, collectionId: id, sortOrder: i })),
        skipDuplicates: true,
      });
    }

    return { synced: matchingProducts.length, message: 'Smart collection synced' };
  }
}
