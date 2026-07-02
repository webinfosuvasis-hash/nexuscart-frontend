import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CartDomainEvent } from './cart-domain-event.base';
import { CART_EVENT_TYPES } from './cart.events';

@Injectable()
export class CartEventLoggerHandler {
  private readonly logger = new Logger(CartEventLoggerHandler.name);

  @OnEvent('cart.*', { async: true })
  handleAll(event: CartDomainEvent): void {
    this.logger.log(
      `[${event.traceId ?? '-'}] ${event.eventType} cart=${event.cartId} store=${event.storeId}`,
    );
  }
}

export { CART_EVENT_TYPES };
