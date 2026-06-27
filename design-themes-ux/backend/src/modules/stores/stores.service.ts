import {
  Injectable, NotFoundException, ConflictException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import slugify from 'slugify';

@Injectable()
export class StoresService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: any) {
    const { page = 1, limit = 20, search, status, businessType } = query;
    const where: any = {};
    if (search) where.OR = [{ name: { contains: search } }, { domain: { contains: search } }];
    if (status) where.status = status;
    if (businessType) where.businessType = businessType;

    const [items, total] = await Promise.all([
      this.prisma.store.findMany({
        where,
        skip: (page - 1) * limit,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          owner: { select: { id: true, name: true, email: true } },
          subscription: { include: { plan: { select: { name: true, tier: true } } } },
          _count: { select: { products: true, orders: true, customers: true, staff: true } },
        },
      }),
      this.prisma.store.count({ where }),
    ]);

    return {
      items,
      pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / Number(limit)) },
    };
  }

  async findOne(id: string) {
    const store = await this.prisma.store.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        subscription: { include: { plan: true } },
        settings: true,
        _count: { select: { products: true, orders: true, customers: true, staff: true } },
      },
    });
    if (!store) throw new NotFoundException('Store not found');
    return store;
  }

  async findBySlug(slug: string) {
    const store = await this.prisma.store.findUnique({
      where: { slug },
      include: { settings: true },
    });
    if (!store) throw new NotFoundException('Store not found');
    return store;
  }

  async create(dto: any, ownerId: string) {
    const slug = dto.slug || slugify(dto.name, { lower: true, strict: true });
    const domain = dto.domain || `${slug}.nexuscart.com`;

    const existing = await this.prisma.store.findFirst({
      where: { OR: [{ slug }, { domain }] },
    });
    if (existing) throw new ConflictException('Store slug or domain already in use');

    return this.prisma.$transaction(async (tx) => {
      const store = await tx.store.create({
        data: {
          name: dto.name,
          slug,
          domain,
          businessType: dto.businessType ?? 'FASHION',
          status: 'TRIAL',
          ownerId,
          staff: { create: { userId: ownerId, role: 'OWNER' } },
        },
      });

      const starterPlan = await tx.plan.findFirst({ where: { tier: 'STARTER' } });
      if (starterPlan) {
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + 14);
        await tx.subscription.create({
          data: {
            storeId: store.id,
            planId: starterPlan.id,
            status: 'TRIAL',
            trialEndsAt: trialEnd,
            currentPeriodStart: new Date(),
            currentPeriodEnd: trialEnd,
          },
        });
      }

      return store;
    });
  }

  async update(id: string, dto: any) {
    await this.findOne(id);
    return this.prisma.store.update({ where: { id }, data: dto });
  }

  async suspend(id: string) {
    await this.findOne(id);
    return this.prisma.store.update({ where: { id }, data: { status: 'SUSPENDED' } });
  }

  async activate(id: string) {
    await this.findOne(id);
    return this.prisma.store.update({ where: { id }, data: { status: 'ACTIVE' } });
  }

  async getPlatformStats() {
    const [totalStores, activeStores, revenue, orders] = await Promise.all([
      this.prisma.store.count(),
      this.prisma.store.count({ where: { status: 'ACTIVE' } }),
      this.prisma.order.aggregate({
        where: { status: { notIn: ['CANCELLED', 'REFUNDED'] } },
        _sum: { total: true },
      }),
      this.prisma.order.count(),
    ]);

    return {
      totalStores,
      activeStores,
      totalRevenue: revenue._sum.total ?? 0,
      totalOrders: orders,
    };
  }

  async getStoreSettings(storeId: string) {
    let settings = await this.prisma.storeSettings.findUnique({ where: { storeId } });
    if (!settings) {
      settings = await this.prisma.storeSettings.create({
        data: { storeId, currency: 'INR', language: 'en', timezone: 'Asia/Kolkata' },
      });
    }
    return settings;
  }

  async updateStoreSettings(storeId: string, dto: any) {
    return this.prisma.storeSettings.upsert({
      where: { storeId },
      create: { ...dto, storeId },
      update: dto,
    });
  }
}
