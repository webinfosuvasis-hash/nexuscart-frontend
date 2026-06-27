import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(storeId: string, query: any) {
    const {
      page = 1, limit = 20, search, segment,
      sortBy = 'createdAt', sortOrder = 'desc',
    } = query;

    const where: any = { storeId };
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
      ];
    }
    if (segment) where.segment = segment;

    const [items, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        skip: (page - 1) * limit,
        take: Number(limit),
        orderBy: { [sortBy]: sortOrder },
        include: {
          _count: { select: { orders: true } },
        },
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      items,
      pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / Number(limit)) },
    };
  }

  async findOne(storeId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, storeId },
      include: {
        orders: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true, orderNumber: true, total: true, status: true, createdAt: true,
          },
        },
        addresses: true,
        loyalty: true,
        _count: { select: { orders: true, reviews: true } },
      },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  async create(storeId: string, dto: any) {
    return this.prisma.customer.create({
      data: { ...dto, storeId, segment: 'NEW' },
    });
  }

  async update(storeId: string, id: string, dto: any) {
    await this.findOne(storeId, id);
    return this.prisma.customer.update({ where: { id }, data: dto });
  }

  async remove(storeId: string, id: string) {
    await this.findOne(storeId, id);
    await this.prisma.customer.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { message: 'Customer deleted' };
  }

  async getSegmentStats(storeId: string) {
    const segments = ['VIP', 'REGULAR', 'NEW', 'AT_RISK'];
    const stats = await Promise.all(
      segments.map(async (segment) => ({
        segment,
        count: await this.prisma.customer.count({ where: { storeId, segment: segment as any } }),
        revenue: (
          await this.prisma.order.aggregate({
            where: { storeId, customer: { segment: segment as any } },
            _sum: { total: true },
          })
        )._sum.total ?? 0,
      })),
    );
    return stats;
  }

  async awardPoints(storeId: string, customerId: string, points: number, reason: string) {
    await this.findOne(storeId, customerId);

    return this.prisma.$transaction(async (tx) => {
      const loyalty = await tx.loyaltyAccount.upsert({
        where: { customerId },
        create: { customerId, storeId, points, tier: 'BRONZE' },
        update: { points: { increment: points } },
      });

      await tx.loyaltyTransaction.create({
        data: { loyaltyAccountId: loyalty.id, points, type: 'EARN', description: reason },
      });

      return loyalty;
    });
  }

  async recomputeSegments(storeId: string) {
    const customers = await this.prisma.customer.findMany({
      where: { storeId },
      include: {
        _count: { select: { orders: true } },
        orders: {
          select: { total: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    for (const customer of customers) {
      const orderCount = customer._count.orders;
      const lastOrder = customer.orders[0];
      const daysSinceLast = lastOrder
        ? (Date.now() - lastOrder.createdAt.getTime()) / 86400000
        : 999;

      let segment: 'VIP' | 'REGULAR' | 'NEW' | 'AT_RISK' = 'NEW';
      if (orderCount >= 10 || Number(customer.totalSpent) > 50000) segment = 'VIP';
      else if (orderCount >= 3) segment = 'REGULAR';
      else if (daysSinceLast > 90 && orderCount > 0) segment = 'AT_RISK';

      await this.prisma.customer.update({ where: { id: customer.id }, data: { segment } });
    }

    return { message: 'Segments recalculated', count: customers.length };
  }
}
