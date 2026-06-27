import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import slugify from 'slugify';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Build infinite-depth tree from flat list ────────────────────────────────
  private buildTree(flat: any[]): any[] {
    const map = new Map<string, any>();
    flat.forEach((c) => map.set(c.id, { ...c, children: [] }));
    const roots: any[] = [];
    map.forEach((node) => {
      if (node.parentId && map.has(node.parentId)) {
        map.get(node.parentId).children.push(node);
      } else {
        roots.push(node);
      }
    });
    return roots;
  }

  async findAll(storeId: string) {
    const flat = await this.prisma.category.findMany({
      where: { storeId, deletedAt: null },
      include: { _count: { select: { products: true } } },
      orderBy: { sortOrder: 'asc' },
    });
    return this.buildTree(flat);
  }

  async findFlat(storeId: string) {
    return this.prisma.category.findMany({
      where: { storeId, deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { products: true } } },
    });
  }

  async findOne(storeId: string, id: string) {
    const cat = await this.prisma.category.findFirst({
      where: { id, storeId, deletedAt: null },
      include: {
        parent: true,
        children: {
          where: { deletedAt: null },
          include: { _count: { select: { products: true } } },
          orderBy: { sortOrder: 'asc' },
        },
        _count: { select: { products: true } },
      },
    });
    if (!cat) throw new NotFoundException('Category not found');
    return cat;
  }

  async create(storeId: string, dto: any) {
    const slug = dto.slug || slugify(dto.name, { lower: true, strict: true });
    const existing = await this.prisma.category.findFirst({ where: { storeId, slug } });
    if (existing) throw new ConflictException('Category slug already exists');

    return this.prisma.category.create({
      data: { ...dto, slug, storeId },
    });
  }

  async update(storeId: string, id: string, dto: any) {
    await this.findOne(storeId, id);
    if (dto.name && !dto.slug) {
      dto.slug = slugify(dto.name, { lower: true, strict: true });
    }
    return this.prisma.category.update({ where: { id }, data: { ...dto, updatedAt: new Date() } });
  }

  async remove(storeId: string, id: string) {
    const cat = await this.findOne(storeId, id);
    if (cat.children.length > 0) {
      await this.prisma.category.updateMany({
        where: { parentId: id, storeId },
        data: { parentId: null },
      });
    }
    await this.prisma.category.update({ where: { id }, data: { deletedAt: new Date() } });
    return { message: 'Category deleted' };
  }

  async reorder(storeId: string, orders: { id: string; sortOrder: number }[]) {
    await Promise.all(
      orders.map((o) =>
        this.prisma.category.updateMany({
          where: { id: o.id, storeId },
          data: { sortOrder: o.sortOrder },
        }),
      ),
    );
    return { message: 'Categories reordered' };
  }

  // ─── Bulk Move ───────────────────────────────────────────────────────────────
  async bulkMove(storeId: string, ids: string[], newParentId: string | null) {
    if (newParentId) {
      const parent = await this.prisma.category.findFirst({ where: { id: newParentId, storeId } });
      if (!parent) throw new NotFoundException('Target parent category not found');
      if (ids.includes(newParentId)) {
        throw new BadRequestException('Cannot move a category into itself');
      }
    }
    await this.prisma.category.updateMany({
      where: { id: { in: ids }, storeId },
      data: { parentId: newParentId },
    });
    return { message: `${ids.length} categories moved` };
  }

  // ─── Merge ───────────────────────────────────────────────────────────────────
  async merge(storeId: string, sourceIds: string[], targetId: string) {
    const target = await this.prisma.category.findFirst({ where: { id: targetId, storeId } });
    if (!target) throw new NotFoundException('Target category not found');
    if (sourceIds.includes(targetId)) {
      throw new BadRequestException('Cannot merge a category into itself');
    }

    // Move all products from source categories to target
    await this.prisma.product.updateMany({
      where: { categoryId: { in: sourceIds }, storeId },
      data: { categoryId: targetId },
    });

    // Move children to target
    await this.prisma.category.updateMany({
      where: { parentId: { in: sourceIds }, storeId },
      data: { parentId: targetId },
    });

    // Soft delete source categories
    await this.prisma.category.updateMany({
      where: { id: { in: sourceIds }, storeId },
      data: { deletedAt: new Date() },
    });

    return { message: `${sourceIds.length} categories merged into "${target.name}"` };
  }

  // ─── Visibility ───────────────────────────────────────────────────────────────
  async updateVisibility(
    storeId: string,
    id: string,
    data: { isFeatured?: boolean; showOnHomepage?: boolean; menuVisibility?: string },
  ) {
    await this.findOne(storeId, id);
    return this.prisma.category.update({ where: { id }, data: data as any });
  }

  // ─── Auto-assign products by rules ───────────────────────────────────────────
  async applyRules(storeId: string, id: string) {
    const cat = await this.findOne(storeId, id);
    const rules: any[] = (cat.rules as unknown as any[]) ?? [];
    if (!rules.length) return { message: 'No rules defined', assigned: 0 };

    const where: any = { storeId };
    for (const rule of rules) {
      if (rule.field === 'brand') where.brandId = rule.value;
      else if (rule.field === 'tags') where.tags = { array_contains: rule.value };
      else if (rule.field === 'status') where.status = rule.value;
    }

    const products = await this.prisma.product.findMany({ where, select: { id: true } });
    if (products.length > 0) {
      await this.prisma.product.updateMany({
        where: { id: { in: products.map((p) => p.id) }, storeId },
        data: { categoryId: id },
      });
    }

    return { assigned: products.length, message: `${products.length} products assigned` };
  }
}
