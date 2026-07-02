import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { CartStatus } from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service';
import { CartEventBus } from '../events/cart-event-bus.service';
import {
  CartAbandonedEvent,
  CartExpiredEvent,
  CartArchivedEvent,
  CartUnlockedEvent,
} from '../events/cart.events';
import { CartConfig, CART_CONFIG_KEY } from '../cart.config';


@Injectable()
export class CartLifecycleService {
  private readonly logger = new Logger(CartLifecycleService.name);

  constructor(
    private readonly prisma:    PrismaService,
    private readonly eventBus:  CartEventBus,
    private readonly configSvc: ConfigService,
  ) {}

  private get cfg(): CartConfig {
    return this.configSvc.get<CartConfig>(CART_CONFIG_KEY)!;
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async unlockExpiredCarts(): Promise<void> {
    const now = new Date();
    const carts = await this.prisma.cart.findMany({
      where:  { status: CartStatus.LOCKED, lockedUntil: { lt: now } },
      select: { id: true, storeId: true, sessionId: true },
    });
    if (carts.length === 0) return;

    await this.prisma.cart.updateMany({
      where: { id: { in: carts.map((c) => c.id) } },
      data:  { status: CartStatus.ACTIVE, lockedAt: null, lockedUntil: null },
    });

    for (const cart of carts) {
      this.eventBus.emit(
        new CartUnlockedEvent({ reason: 'lock_expired' }, cart.id, cart.storeId, cart.sessionId, null, null, null, null, null, null),
      );
    }
    this.logger.log(`Auto-unlocked ${carts.length} expired LOCKED carts`);
  }

  @Cron(CronExpression.EVERY_HOUR)
  async markAbandonedCarts(): Promise<void> {
    const cutoff = new Date(Date.now() - this.cfg.abandonAfterHours * 60 * 60 * 1000);
    const batchSize = this.cfg.gcBatchSize;

    const carts = await this.prisma.cart.findMany({
      where:  { status: CartStatus.ACTIVE, lastActivityAt: { lt: cutoff } },
      select: { id: true, storeId: true, sessionId: true },
      take:   batchSize,
    });
    if (carts.length === 0) return;

    const now = new Date();
    await this.prisma.cart.updateMany({
      where: { id: { in: carts.map((c) => c.id) } },
      data:  { status: CartStatus.ABANDONED, abandonedAt: now },
    });

    for (const cart of carts) {
      this.eventBus.emit(
        new CartAbandonedEvent({ reason: 'inactivity' }, cart.id, cart.storeId, cart.sessionId, null, null, null, null, null, null),
      );
    }
    this.logger.log(`Marked ${carts.length} carts as ABANDONED`);
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async expireAbandonedCarts(): Promise<void> {
    const cutoff = new Date(Date.now() - this.cfg.expireAfterDays * 24 * 60 * 60 * 1000);
    const batchSize = this.cfg.gcBatchSize;

    const carts = await this.prisma.cart.findMany({
      where:  { status: CartStatus.ABANDONED, abandonedAt: { lt: cutoff } },
      select: { id: true, storeId: true, sessionId: true },
      take:   batchSize,
    });
    if (carts.length === 0) return;

    const now = new Date();
    await this.prisma.cart.updateMany({
      where: { id: { in: carts.map((c) => c.id) } },
      data:  { status: CartStatus.EXPIRED, expiredAt: now },
    });

    for (const cart of carts) {
      this.eventBus.emit(
        new CartExpiredEvent({ reason: 'abandon_timeout' }, cart.id, cart.storeId, cart.sessionId, null, null, null, null, null, null),
      );
    }
    this.logger.log(`Expired ${carts.length} abandoned carts`);
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async archiveExpiredCarts(): Promise<void> {
    const cutoff = new Date(Date.now() - this.cfg.archiveAfterDays * 24 * 60 * 60 * 1000);
    const batchSize = this.cfg.gcBatchSize;

    const carts = await this.prisma.cart.findMany({
      where:  { status: CartStatus.EXPIRED, expiredAt: { lt: cutoff } },
      select: { id: true, storeId: true, sessionId: true },
      take:   batchSize,
    });
    if (carts.length === 0) return;

    const now = new Date();
    await this.prisma.cart.updateMany({
      where: { id: { in: carts.map((c) => c.id) } },
      data:  { status: CartStatus.ARCHIVED, archivedAt: now },
    });

    for (const cart of carts) {
      this.eventBus.emit(
        new CartArchivedEvent({ reason: 'expired_cleanup' }, cart.id, cart.storeId, cart.sessionId, null, null, null, null, null, null),
      );
    }
    this.logger.log(`Archived ${carts.length} expired carts`);
  }
}
