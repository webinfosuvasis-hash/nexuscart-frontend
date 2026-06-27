import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import slugify from 'slugify';

@Injectable()
export class AttributesService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Attributes ─────────────────────────────────────────────────────────────

  async findAll(storeId: string, query: any = {}) {
    const { search, type } = query;
    const where: any = { storeId };
    if (search) where.name = { contains: search };
    if (type) where.type = type;

    return this.prisma.attribute.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { values: { orderBy: { sortOrder: 'asc' } }, _count: { select: { sets: true } } },
    });
  }

  async findOne(storeId: string, id: string) {
    const attr = await this.prisma.attribute.findFirst({
      where: { id, storeId },
      include: { values: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!attr) throw new NotFoundException('Attribute not found');
    return attr;
  }

  async create(storeId: string, dto: any) {
    const slug = dto.slug || slugify(dto.name, { lower: true, strict: true });
    const existing = await this.prisma.attribute.findFirst({ where: { storeId, slug } });
    if (existing) throw new ConflictException('Attribute slug already exists');

    const { values, ...attrData } = dto;
    return this.prisma.attribute.create({
      data: {
        ...attrData,
        slug,
        storeId,
        values: values?.length
          ? { create: values.map((v: any, i: number) => ({ ...v, sortOrder: v.sortOrder ?? i })) }
          : undefined,
      },
      include: { values: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  async update(storeId: string, id: string, dto: any) {
    await this.findOne(storeId, id);
    const { values, ...attrData } = dto;
    return this.prisma.attribute.update({
      where: { id },
      data: { ...attrData, updatedAt: new Date() },
      include: { values: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  async remove(storeId: string, id: string) {
    await this.findOne(storeId, id);
    await this.prisma.attribute.delete({ where: { id } });
    return { message: 'Attribute deleted' };
  }

  // ─── Attribute Values ────────────────────────────────────────────────────────

  async addValue(storeId: string, attributeId: string, dto: any) {
    await this.findOne(storeId, attributeId);
    const count = await this.prisma.attributeValue.count({ where: { attributeId } });
    return this.prisma.attributeValue.create({
      data: { ...dto, attributeId, sortOrder: dto.sortOrder ?? count },
    });
  }

  async updateValue(storeId: string, attributeId: string, valueId: string, dto: any) {
    await this.findOne(storeId, attributeId);
    return this.prisma.attributeValue.update({ where: { id: valueId }, data: dto });
  }

  async removeValue(storeId: string, attributeId: string, valueId: string) {
    await this.findOne(storeId, attributeId);
    await this.prisma.attributeValue.delete({ where: { id: valueId } });
    return { message: 'Value deleted' };
  }

  async reorderValues(storeId: string, attributeId: string, orders: { id: string; sortOrder: number }[]) {
    await this.findOne(storeId, attributeId);
    await Promise.all(
      orders.map((o) => this.prisma.attributeValue.update({ where: { id: o.id }, data: { sortOrder: o.sortOrder } })),
    );
    return { message: 'Values reordered' };
  }

  // ─── Attribute Sets ──────────────────────────────────────────────────────────

  async findAllSets(storeId: string) {
    return this.prisma.attributeSet.findMany({
      where: { storeId },
      include: {
        attributes: {
          include: { attribute: { include: { values: { orderBy: { sortOrder: 'asc' } } } } },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
  }

  async createSet(storeId: string, dto: any) {
    const { attributeIds, ...setData } = dto;
    return this.prisma.attributeSet.create({
      data: {
        ...setData,
        storeId,
        attributes: attributeIds?.length
          ? {
              create: attributeIds.map((aid: string, i: number) => ({
                attributeId: aid,
                sortOrder: i,
              })),
            }
          : undefined,
      },
      include: { attributes: { include: { attribute: true }, orderBy: { sortOrder: 'asc' } } },
    });
  }

  async updateSet(storeId: string, id: string, dto: any) {
    const { attributeIds, ...setData } = dto;
    const existing = await this.prisma.attributeSet.findFirst({ where: { id, storeId } });
    if (!existing) throw new NotFoundException('Attribute set not found');

    if (attributeIds !== undefined) {
      await this.prisma.attributeSetItem.deleteMany({ where: { attributeSetId: id } });
      if (attributeIds.length > 0) {
        await this.prisma.attributeSetItem.createMany({
          data: attributeIds.map((aid: string, i: number) => ({
            attributeSetId: id,
            attributeId: aid,
            sortOrder: i,
          })),
        });
      }
    }

    return this.prisma.attributeSet.update({
      where: { id },
      data: setData,
      include: { attributes: { include: { attribute: true }, orderBy: { sortOrder: 'asc' } } },
    });
  }

  async removeSet(storeId: string, id: string) {
    const existing = await this.prisma.attributeSet.findFirst({ where: { id, storeId } });
    if (!existing) throw new NotFoundException('Attribute set not found');
    await this.prisma.attributeSet.delete({ where: { id } });
    return { message: 'Attribute set deleted' };
  }
}
