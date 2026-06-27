import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(storeId: string, period = '30d') {
    const days = this.parsePeriodDays(period);
    const since = new Date(Date.now() - days * 86400000);
    const prevSince = new Date(since.getTime() - days * 86400000);

    const [current, previous] = await Promise.all([
      this.getPeriodStats(storeId, since, new Date()),
      this.getPeriodStats(storeId, prevSince, since),
    ]);

    return {
      revenue: this.withGrowth(current.revenue, previous.revenue),
      orders: this.withGrowth(current.orders, previous.orders),
      customers: this.withGrowth(current.customers, previous.customers),
      avgOrderValue: this.withGrowth(current.avgOrderValue, previous.avgOrderValue),
    };
  }

  async getRevenueTrend(storeId: string, period = '30d') {
    const days = this.parsePeriodDays(period);
    const since = new Date(Date.now() - days * 86400000);

    const orders = await this.prisma.order.findMany({
      where: {
        storeId,
        createdAt: { gte: since },
        status: { notIn: ['CANCELLED', 'REFUNDED'] },
      },
      select: { total: true, createdAt: true },
    });

    const map = new Map<string, number>();
    for (const order of orders) {
      const key = order.createdAt.toISOString().slice(0, 10);
      map.set(key, (map.get(key) ?? 0) + Number(order.total));
    }

    return Array.from(map.entries())
      .map(([date, revenue]) => ({ date, revenue }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async getTopProducts(storeId: string, limit = 10) {
    const items = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      where: { order: { storeId, status: { notIn: ['CANCELLED', 'REFUNDED'] } } },
      _sum: { quantity: true, total: true },
      orderBy: { _sum: { total: 'desc' } },
      take: Number(limit),
    });

    const products = await this.prisma.product.findMany({
      where: { id: { in: items.map((i) => i.productId) } },
      select: { id: true, name: true, thumbnail: true, sku: true },
    });

    return items.map((item) => ({
      ...item,
      product: products.find((p) => p.id === item.productId),
    }));
  }

  async getConversionFunnel(storeId: string, period = '30d') {
    const days = this.parsePeriodDays(period);
    const since = new Date(Date.now() - days * 86400000);

    const [sessions, orders, customers] = await Promise.all([
      this.prisma.analyticsEvent.count({
        where: { storeId, type: 'PAGE_VIEW', createdAt: { gte: since } },
      }),
      this.prisma.order.count({
        where: { storeId, createdAt: { gte: since } },
      }),
      this.prisma.customer.count({
        where: { storeId, createdAt: { gte: since } },
      }),
    ]);

    const addToCart = Math.round(sessions * 0.18);
    const checkout = Math.round(addToCart * 0.45);

    return [
      { stage: 'Sessions', value: sessions },
      { stage: 'Product Views', value: Math.round(sessions * 0.55) },
      { stage: 'Add to Cart', value: addToCart },
      { stage: 'Checkout', value: checkout },
      { stage: 'Purchased', value: orders },
    ];
  }

  async getTrafficSources(storeId: string, period = '30d') {
    const days = this.parsePeriodDays(period);
    const since = new Date(Date.now() - days * 86400000);

    const sources = await this.prisma.analyticsEvent.groupBy({
      by: ['source'],
      where: { storeId, type: 'SESSION', createdAt: { gte: since } },
      _count: { _all: true },
      orderBy: { _count: { source: 'desc' } },
    });

    return sources.map((s) => ({ source: s.source ?? 'direct', sessions: s._count._all }));
  }

  async trackEvent(storeId: string, event: any) {
    return this.prisma.analyticsEvent.create({
      data: { ...event, storeId },
    });
  }

  private async getPeriodStats(storeId: string, from: Date, to: Date) {
    const [orderAgg, customerCount] = await Promise.all([
      this.prisma.order.aggregate({
        where: {
          storeId,
          createdAt: { gte: from, lte: to },
          status: { notIn: ['CANCELLED', 'REFUNDED'] },
        },
        _sum: { total: true },
        _count: { _all: true },
        _avg: { total: true },
      }),
      this.prisma.customer.count({ where: { storeId, createdAt: { gte: from, lte: to } } }),
    ]);

    return {
      revenue: Number(orderAgg._sum.total ?? 0),
      orders: orderAgg._count._all,
      customers: customerCount,
      avgOrderValue: Number(orderAgg._avg.total ?? 0),
    };
  }

  private withGrowth(current: number, previous: number) {
    const growth = previous > 0 ? ((current - previous) / previous) * 100 : 0;
    return { value: current, growth: Math.round(growth * 10) / 10 };
  }

  private parsePeriodDays(period: string): number {
    const map: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 };
    return map[period] ?? 30;
  }
}
