import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CartActorType, CartActivityType } from '@prisma/client';

import { CartDomainEvent } from '../events/cart-domain-event.base';
import { CartActivityService } from '../services/cart-activity.service';

const EVENT_TO_ACTIVITY: Record<string, CartActivityType> = {
  'cart.created':            CartActivityType.CART_CREATED,
  'cart.item.added':         CartActivityType.ITEM_ADDED,
  'cart.item.removed':       CartActivityType.ITEM_REMOVED,
  'cart.item.qty_updated':   CartActivityType.QTY_UPDATED,
  'cart.item.qty_adjusted':  CartActivityType.QTY_ADJUSTED,
  'cart.promotion.applied':  CartActivityType.PROMOTION_APPLIED,
  'cart.promotion.removed':  CartActivityType.PROMOTION_REMOVED,
  'cart.cleared':            CartActivityType.CART_CLEARED,
  'cart.merged':             CartActivityType.CART_MERGED,
  'cart.locked':             CartActivityType.CART_LOCKED,
  'cart.unlocked':           CartActivityType.CART_UNLOCKED,
  'cart.abandoned':          CartActivityType.CART_ABANDONED,
  'cart.expired':            CartActivityType.CART_EXPIRED,
  'cart.archived':           CartActivityType.CART_ARCHIVED,
};

@Injectable()
export class CartActivityEventHandler {
  private readonly logger = new Logger(CartActivityEventHandler.name);

  constructor(private readonly activityService: CartActivityService) {}

  @OnEvent('cart.**', { async: true })
  async handle(event: CartDomainEvent): Promise<void> {
    const activityType = EVENT_TO_ACTIVITY[event.eventType];
    if (!activityType) return;

    const payload = (event as CartDomainEvent & { payload?: Record<string, unknown> }).payload ?? {};

    try {
      await this.activityService.record({
        cartId:        event.cartId,
        storeId:       event.storeId,
        sessionId:     event.sessionId,
        activityType,
        actorType:     CartActorType.CUSTOMER,
        payload,
        ipAddress:     event.ipAddress,
        userAgent:     event.userAgent,
        traceId:       event.traceId,
        spanId:        event.spanId,
        correlationId: event.correlationId,
        requestId:     event.requestId,
      });
    } catch (err: unknown) {
      this.logger.error('Cart activity write failed — audit record lost', {
        eventType:     event.eventType,
        cartId:        event.cartId,
        storeId:       event.storeId,
        traceId:       event.traceId,
        requestId:     event.requestId,
        stack:         err instanceof Error ? err.stack : String(err),
      });
    }
  }
}
