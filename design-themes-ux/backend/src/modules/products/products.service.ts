import {
  Injectable, NotFoundException, ConflictException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { QueryProductDto } from './dto/query-product.dto';
import slugify from 'slugify';
import { v4 as uuid } from 'uuid';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(storeId: string, query: QueryProductDto) {
    const {
      page = 1, limit = 20, search, status, categoryId,
      sortBy = 'createdAt', sortOrder = 'desc', lowStock,
    } = query;

    const where: any = { storeId };
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { sku: { contains: search } },
        { description: { contains: search } },
      ];
    }
    if (status) where.status = status;
    if (categoryId) where.categoryId = categoryId;
    if (lowStock === 'true') {
      where.trackInventory = true;
      where.stock = { lte: 10 };
    }

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          category: { select: { id: true, name: true } },
          variants: { select: { id: true, name: true, sku: true, price: true, stock: true } },
          _count: { select: { orderItems: true } },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(storeId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, storeId },
      include: {
        category: true,
        variants: true,
        reviews: { take: 5, orderBy: { createdAt: 'desc' } },
        _count: { select: { orderItems: true, reviews: true } },
      },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async create(storeId: string, dto: CreateProductDto) {
    await this.checkPlanLimits(storeId);

    const slug = dto.slug || slugify(dto.name, { lower: true, strict: true });
    const sku = dto.sku || `SKU-${uuid().slice(0, 8).toUpperCase()}`;

    const existing = await this.prisma.product.findFirst({
      where: { storeId, OR: [{ slug }, { sku }] },
    });
    if (existing) throw new ConflictException('Product with this slug or SKU already exists');

    const { variants, ...productData } = dto;

    // Ensure every variant has a unique SKU
    const preparedVariants = variants?.map((v, i) => ({
      ...v,
      sku: v.sku?.trim() || `${sku}-V${i + 1}`,
    }));

    return this.prisma.product.create({
      data: {
        ...productData,
        slug,
        sku,
        storeId,
        tags: dto.tags ?? [],
        images: dto.images ?? [],
        seo: dto.seo ? JSON.stringify(dto.seo) : undefined,
        variants: preparedVariants?.length
          ? { create: preparedVariants }
          : undefined,
      } as any,
      include: { variants: true, category: true },
    });
  }

  async update(storeId: string, id: string, dto: Partial<CreateProductDto>) {
    const existing = await this.findOne(storeId, id);
    const { variants, ...productData } = dto;

    // Save a version snapshot before updating
    await this.saveVersion(id, existing, 'Admin');

    // Ensure every variant has a unique SKU (use existing product sku as base)
    const preparedVariants = variants?.map((v, i) => ({
      ...v,
      sku: v.sku?.trim() || `${existing.sku}-V${i + 1}`,
    }));

    const variantsWrite =
      preparedVariants !== undefined
        ? {
            deleteMany: {},
            ...(preparedVariants.length > 0 ? { create: preparedVariants } : {}),
          }
        : undefined;

    return this.prisma.product.update({
      where: { id, storeId },
      data: {
        ...productData,
        seo: productData.seo ? JSON.stringify(productData.seo) : undefined,
        updatedAt: new Date(),
        ...(variantsWrite ? { variants: variantsWrite } : {}),
      } as any,
      include: { variants: true, category: true },
    });
  }

  async remove(storeId: string, id: string) {
    await this.findOne(storeId, id);
    await this.prisma.product.update({
      where: { id, storeId },
      data: { deletedAt: new Date(), status: 'ARCHIVED' },
    });
    return { message: 'Product deleted' };
  }

  async bulkDelete(storeId: string, ids: string[]) {
    await this.prisma.product.updateMany({
      where: { id: { in: ids }, storeId },
      data: { deletedAt: new Date(), status: 'ARCHIVED' },
    });
    return { message: `${ids.length} products deleted` };
  }

  async bulkUpdateStatus(storeId: string, ids: string[], status: string) {
    await this.prisma.product.updateMany({
      where: { id: { in: ids }, storeId },
      data: { status: status as any },
    });
    return { message: `${ids.length} products updated` };
  }

  async duplicate(storeId: string, id: string) {
    const product = await this.findOne(storeId, id);
    const { id: _id, createdAt, updatedAt, variants, ...rest } = product as any;
    const newSlug = `${rest.slug}-copy-${Date.now()}`;
    const newSku = `${rest.sku}-COPY`;

    return this.prisma.product.create({
      data: {
        ...rest,
        slug: newSlug,
        sku: newSku,
        name: `${rest.name} (Copy)`,
        status: 'DRAFT',
        storeId,
        variants: variants?.length
          ? { create: variants.map(({ id: _vid, productId: _pid, ...v }: any) => v) }
          : undefined,
      },
      include: { variants: true },
    });
  }

  async getStats(storeId: string) {
    const [total, active, draft, lowStock, featured] = await Promise.all([
      this.prisma.product.count({ where: { storeId } }),
      this.prisma.product.count({ where: { storeId, status: 'ACTIVE' } }),
      this.prisma.product.count({ where: { storeId, status: 'DRAFT' } }),
      this.prisma.product.count({
        where: { storeId, trackInventory: true, stock: { lte: 10 } },
      }),
      this.prisma.product.count({ where: { storeId, isFeatured: true } }),
    ]);
    return { total, active, draft, lowStock, featured };
  }

  async getVersions(storeId: string, id: string) {
    await this.findOne(storeId, id);
    return this.prisma.productVersion.findMany({
      where: { productId: id },
      orderBy: { version: 'desc' },
      take: 20,
    });
  }

  async rollback(storeId: string, id: string, versionId: string) {
    await this.findOne(storeId, id);
    const version = await this.prisma.productVersion.findUnique({ where: { id: versionId } });
    if (!version || version.productId !== id) throw new Error('Version not found');

    const snapshot = version.snapshot as any;
    const { id: _id, storeId: _sid, createdAt: _ca, variants: _v, ...data } = snapshot;
    return this.prisma.product.update({ where: { id }, data: { ...data, updatedAt: new Date() } });
  }

  async updateApproval(storeId: string, id: string, approvalStatus: string, note?: string) {
    await this.findOne(storeId, id);
    const update: any = { approvalStatus };
    if (approvalStatus === 'APPROVED') update.status = 'ACTIVE';
    return this.prisma.product.update({ where: { id }, data: update });
  }

  async bulkEdit(storeId: string, ids: string[], data: Record<string, any>) {
    const allowed = ['price', 'comparePrice', 'categoryId', 'brandId', 'status', 'badges'];
    const filtered = Object.fromEntries(Object.entries(data).filter(([k]) => allowed.includes(k)));
    await this.prisma.product.updateMany({
      where: { id: { in: ids }, storeId },
      data: filtered,
    });
    return { updated: ids.length, message: `${ids.length} products updated` };
  }

  private async saveVersion(productId: string, snapshot: any, changedBy?: string, note?: string) {
    const count = await this.prisma.productVersion.count({ where: { productId } });
    await this.prisma.productVersion.create({
      data: {
        productId,
        version: count + 1,
        snapshot: snapshot as any,
        changedBy: changedBy ?? 'Admin',
        changeNote: note,
      },
    });
  }

  private async checkPlanLimits(storeId: string) {
    if (!storeId) return; // No store context — skip limit check
    const [store, count] = await Promise.all([
      this.prisma.store.findUnique({
        where: { id: storeId },
        select: { subscription: { select: { plan: { select: { maxProducts: true } } } } },
      }),
      this.prisma.product.count({ where: { storeId } }),
    ]);

    const limit = store?.subscription?.plan?.maxProducts ?? 100;
    if (count >= limit) {
      throw new BadRequestException(
        `Plan limit reached. Upgrade to add more than ${limit} products.`,
      );
    }
  }
}
