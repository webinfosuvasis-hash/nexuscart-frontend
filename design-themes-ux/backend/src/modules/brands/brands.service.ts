import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import slugify from 'slugify';

@Injectable()
export class BrandsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(storeId: string, query: any = {}) {
    const { search, featured, page = 1, limit = 20 } = query;
    const where: any = { storeId };
    if (search) where.name = { contains: search };
    if (featured === 'true') where.isFeatured = true;

    const [items, total] = await Promise.all([
      this.prisma.brand.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        include: { _count: { select: { products: true } } },
      }),
      this.prisma.brand.count({ where }),
    ]);

    return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(storeId: string, id: string) {
    const brand = await this.prisma.brand.findFirst({
      where: { id, storeId },
      include: {
        products: {
          take: 8,
          select: { id: true, name: true, thumbnail: true, price: true, status: true },
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { products: true } },
      },
    });
    if (!brand) throw new NotFoundException('Brand not found');
    return brand;
  }

  async create(storeId: string, dto: any) {
    const slug = dto.slug || slugify(dto.name, { lower: true, strict: true });
    const existing = await this.prisma.brand.findFirst({ where: { storeId, slug } });
    if (existing) throw new ConflictException('Brand slug already exists');

    return this.prisma.brand.create({ data: { ...dto, slug, storeId } });
  }

  async update(storeId: string, id: string, dto: any) {
    await this.findOne(storeId, id);
    if (dto.name && !dto.slug) {
      dto.slug = slugify(dto.name, { lower: true, strict: true });
    }
    return this.prisma.brand.update({ where: { id }, data: dto });
  }

  async remove(storeId: string, id: string) {
    await this.findOne(storeId, id);
    // Unlink products before deleting
    await this.prisma.product.updateMany({ where: { brandId: id, storeId }, data: { brandId: null } });
    await this.prisma.brand.delete({ where: { id } });
    return { message: 'Brand deleted' };
  }

  async reorder(storeId: string, orders: { id: string; sortOrder: number }[]) {
    await Promise.all(
      orders.map((o) =>
        this.prisma.brand.updateMany({ where: { id: o.id, storeId }, data: { sortOrder: o.sortOrder } }),
      ),
    );
    return { message: 'Brands reordered' };
  }

  async toggleFeatured(storeId: string, id: string) {
    const brand = await this.findOne(storeId, id);
    return this.prisma.brand.update({ where: { id }, data: { isFeatured: !brand.isFeatured } });
  }
}
