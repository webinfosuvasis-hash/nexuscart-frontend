import {
  Injectable, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async listPlans() {
    return this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { price: 'asc' },
    });
  }

  async getPlan(id: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException('Plan not found');
    return plan;
  }

  async getCurrentSubscription(storeId: string) {
    const sub = await this.prisma.subscription.findUnique({
      where: { storeId },
      include: { plan: true },
    });
    if (!sub) throw new NotFoundException('No subscription found');
    return sub;
  }

  async upgrade(storeId: string, planId: string, billingCycle: 'MONTHLY' | 'YEARLY') {
    const [plan, currentSub] = await Promise.all([
      this.getPlan(planId),
      this.prisma.subscription.findUnique({ where: { storeId }, include: { plan: true } }),
    ]);

    if (currentSub?.planId === planId) {
      throw new BadRequestException('Already on this plan');
    }

    const price = billingCycle === 'YEARLY' ? plan.yearlyPrice : plan.price;
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + (billingCycle === 'YEARLY' ? 12 : 1));

    return this.prisma.$transaction(async (tx) => {
      const sub = await tx.subscription.upsert({
        where: { storeId },
        create: {
          storeId,
          planId,
          status: 'ACTIVE',
          billingCycle,
          currentPeriodStart: new Date(),
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
        },
        update: {
          planId,
          status: 'ACTIVE',
          billingCycle,
          currentPeriodStart: new Date(),
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
        },
      });

      await tx.invoice.create({
        data: {
          storeId,
          subscriptionId: sub.id,
          amount: price,
          status: 'PAID',
          paidAt: new Date(),
          dueAt: new Date(),
          description: `${plan.name} - ${billingCycle}`,
        },
      });

      await tx.store.update({
        where: { id: storeId },
        data: { status: 'ACTIVE' },
      });

      return sub;
    });
  }

  async cancel(storeId: string, cancelImmediately = false) {
    const sub = await this.prisma.subscription.findUnique({ where: { storeId } });
    if (!sub) throw new NotFoundException('Subscription not found');

    if (cancelImmediately) {
      return this.prisma.subscription.update({
        where: { storeId },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      });
    }

    return this.prisma.subscription.update({
      where: { storeId },
      data: { cancelAtPeriodEnd: true },
    });
  }

  async listInvoices(storeId: string, query: any) {
    const { page = 1, limit = 20 } = query;

    const [items, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where: { storeId },
        skip: (page - 1) * limit,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: { subscription: { include: { plan: { select: { name: true } } } } },
      }),
      this.prisma.invoice.count({ where: { storeId } }),
    ]);

    return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getUsage(storeId: string) {
    const sub = await this.getCurrentSubscription(storeId);
    const plan = sub.plan;

    const [products, staff, orders] = await Promise.all([
      this.prisma.product.count({ where: { storeId } }),
      this.prisma.storeStaff.count({ where: { storeId } }),
      this.prisma.order.count({ where: { storeId } }),
    ]);

    return {
      products: { used: products, limit: plan.maxProducts },
      staff: { used: staff, limit: plan.maxStaff },
      orders: { used: orders, limit: plan.maxOrders ?? null },
      plan: plan.name,
      tier: plan.tier,
      status: sub.status,
      currentPeriodEnd: sub.currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    };
  }

  async seedDefaultPlans() {
    const plans = [
      {
        name: 'Starter',
        tier: 'STARTER',
        price: 499,
        yearlyPrice: 4990,
        maxProducts: 100,
        maxStaff: 2,
        maxOrders: 500,
        features: ['Basic themes', 'Email support', 'Analytics dashboard'],
      },
      {
        name: 'Growth',
        tier: 'GROWTH',
        price: 1499,
        yearlyPrice: 14990,
        maxProducts: 1000,
        maxStaff: 5,
        maxOrders: 5000,
        features: ['Premium themes', 'Priority support', 'Advanced analytics', 'Marketing tools'],
      },
      {
        name: 'Pro',
        tier: 'PRO',
        price: 3499,
        yearlyPrice: 34990,
        maxProducts: 10000,
        maxStaff: 20,
        maxOrders: null,
        features: ['All themes', '24/7 support', 'API access', 'Multi-warehouse', 'Custom domain'],
      },
      {
        name: 'Enterprise',
        tier: 'ENTERPRISE',
        price: 9999,
        yearlyPrice: 99990,
        maxProducts: null,
        maxStaff: null,
        maxOrders: null,
        features: ['Unlimited everything', 'Dedicated support', 'SLA', 'White label'],
      },
    ];

    for (const plan of plans) {
      await this.prisma.plan.upsert({
        where: { tier: plan.tier as any },
        create: { ...plan, isActive: true } as any,
        update: {},
      });
    }

    return { message: 'Default plans seeded' };
  }
}
