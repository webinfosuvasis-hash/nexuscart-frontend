import {
  Injectable, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

const STATUS_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'RETURNED'],
  DELIVERED: ['RETURNED', 'REFUNDED'],
  CANCELLED: [],
  RETURNED: ['REFUNDED'],
  REFUNDED: [],
};

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(storeId: string, query: any) {
    const {
      page = 1, limit = 20, search, status, startDate, endDate,
      sortBy = 'createdAt', sortOrder = 'desc',
    } = query;

    const where: any = { storeId };
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { orderNumber: { contains: search } },
        { customer: { name: { contains: search } } },
        { customer: { email: { contains: search } } },
      ];
    }
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip: (page - 1) * limit,
        take: Number(limit),
        orderBy: { [sortBy]: sortOrder },
        include: {
          customer: { select: { id: true, name: true, email: true, phone: true } },
          items: { include: { product: { select: { name: true, thumbnail: true } } } },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      items,
      pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / Number(limit)) },
    };
  }

  async findOne(storeId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, storeId },
      include: {
        customer: true,
        items: {
          include: {
            product: { select: { id: true, name: true, thumbnail: true, sku: true } },
            variant: { select: { id: true, name: true } },
          },
        },
        statusHistory: { orderBy: { createdAt: 'asc' } },
        notes: { orderBy: { createdAt: 'desc' } },
        shipments: true,
        refunds: true,
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async updateStatus(storeId: string, id: string, status: string, note?: string) {
    const order = await this.findOne(storeId, id);
    const allowed = STATUS_TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(status)) {
      throw new BadRequestException(
        `Cannot transition from ${order.status} to ${status}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id },
        data: { status: status as any },
      });
      await tx.orderStatusHistory.create({
        data: { orderId: id, status: status as any, note },
      });
      return updated;
    });
  }

  async addNote(storeId: string, id: string, content: string, userId: string) {
    await this.findOne(storeId, id);
    return this.prisma.orderNote.create({
      data: { orderId: id, content, userId, isInternal: true },
    });
  }

  async addShipment(storeId: string, id: string, shipmentData: any) {
    await this.findOne(storeId, id);
    const shipment = await this.prisma.shipment.create({
      data: { orderId: id, ...shipmentData },
    });
    await this.updateStatus(storeId, id, 'SHIPPED', `Shipped via ${shipmentData.carrier}`);
    return shipment;
  }

  async createRefund(storeId: string, id: string, amount: number, reason: string, userId: string) {
    const order = await this.findOne(storeId, id);
    if (amount > Number(order.total)) {
      throw new BadRequestException('Refund amount exceeds order total');
    }

    return this.prisma.$transaction(async (tx) => {
      const refund = await tx.refund.create({
        data: { orderId: id, amount, reason, processedById: userId, status: 'PENDING' },
      });
      await tx.order.update({
        where: { id },
        data: { refundedAmount: { increment: amount } },
      });
      return refund;
    });
  }

  async getStats(storeId: string) {
    const [total, pending, processing, shipped, delivered, cancelled, revenue] =
      await Promise.all([
        this.prisma.order.count({ where: { storeId } }),
        this.prisma.order.count({ where: { storeId, status: 'PENDING' } }),
        this.prisma.order.count({ where: { storeId, status: 'PROCESSING' } }),
        this.prisma.order.count({ where: { storeId, status: 'SHIPPED' } }),
        this.prisma.order.count({ where: { storeId, status: 'DELIVERED' } }),
        this.prisma.order.count({ where: { storeId, status: 'CANCELLED' } }),
        this.prisma.order.aggregate({
          where: { storeId, status: { notIn: ['CANCELLED', 'REFUNDED'] } },
          _sum: { total: true },
        }),
      ]);

    return { total, pending, processing, shipped, delivered, cancelled, revenue: revenue._sum.total ?? 0 };
  }
}
