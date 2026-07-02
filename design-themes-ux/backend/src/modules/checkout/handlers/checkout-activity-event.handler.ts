import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CheckoutActorType, CheckoutActivityType } from '@prisma/client';

import { CheckoutDomainEvent } from '../events/checkout-domain-event.base';
import { CheckoutActivityService } from '../services/checkout-activity.service';

const EVENT_TO_ACTIVITY: Record<string, CheckoutActivityType> = {
  'checkout.started':          CheckoutActivityType.CHECKOUT_STARTED,
  'checkout.address_updated':  CheckoutActivityType.ADDRESS_UPDATED,
  'checkout.shipping_updated': CheckoutActivityType.SHIPPING_UPDATED,
  'checkout.cancelled':        CheckoutActivityType.CHECKOUT_CANCELLED,
  'checkout.completed':        CheckoutActivityType.CHECKOUT_COMPLETED,
  'checkout.expired':          CheckoutActivityType.CHECKOUT_EXPIRED,
};

@Injectable()
export class CheckoutActivityEventHandler {
  private readonly logger = new Logger(CheckoutActivityEventHandler.name);

  constructor(private readonly activityService: CheckoutActivityService) {}

  @OnEvent('checkout.**', { async: true })
  async handle(event: CheckoutDomainEvent): Promise<void> {
    let activityType = EVENT_TO_ACTIVITY[event.eventType];
    if (!activityType) {
      // checkout.validated maps to VALIDATION_PASSED or VALIDATION_FAILED based on payload
      if (event.eventType === 'checkout.validated') {
        const p = (event as CheckoutDomainEvent & { payload?: Record<string, unknown> }).payload ?? {};
        activityType = p['isValid'] === true
          ? CheckoutActivityType.VALIDATION_PASSED
          : CheckoutActivityType.VALIDATION_FAILED;
      } else {
        return;
      }
    }

    const payload = (event as CheckoutDomainEvent & { payload?: Record<string, unknown> }).payload ?? {};

    try {
      await this.activityService.record({
        checkoutId:    event.checkoutId,
        storeId:       event.storeId,
        sessionId:     event.sessionId,
        activityType,
        actorType:     CheckoutActorType.CUSTOMER,
        payload,
        ipAddress:     event.ipAddress,
        userAgent:     event.userAgent,
        traceId:       event.traceId,
        spanId:        event.spanId,
        correlationId: event.correlationId,
        requestId:     event.requestId,
      });
    } catch (err: unknown) {
      this.logger.error('Checkout activity write failed — audit record lost', {
        eventType:   event.eventType,
        checkoutId:  event.checkoutId,
        storeId:     event.storeId,
        traceId:     event.traceId,
        requestId:   event.requestId,
        stack:       err instanceof Error ? err.stack : String(err),
      });
    }
  }
}
