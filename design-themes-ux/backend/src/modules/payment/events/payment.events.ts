import { PaymentDomainEvent } from './payment-domain-event.base';

type BaseArgs = ConstructorParameters<typeof PaymentDomainEvent> extends [string, ...infer R]
  ? R
  : never;

function makePaymentEvent(eventType: string) {
  return class extends PaymentDomainEvent {
    readonly SCHEMA_VERSION = 1;
    constructor(
      public readonly payload: Record<string, unknown>,
      ...rest: BaseArgs
    ) {
      super(eventType, ...rest);
    }
  };
}

export class PaymentInitiatedEvent          extends makePaymentEvent('payment.initiated') {}
export class PaymentGatewayCreatedEvent     extends makePaymentEvent('payment.gateway_created') {}
export class PaymentAuthorizedEvent         extends makePaymentEvent('payment.authorized') {}
export class PaymentCapturedEvent           extends makePaymentEvent('payment.captured') {}
export class PaymentFailedEvent             extends makePaymentEvent('payment.failed') {}
export class PaymentCancelledEvent          extends makePaymentEvent('payment.cancelled') {}
export class PaymentExpiredEvent            extends makePaymentEvent('payment.expired') {}
export class PaymentRefundedEvent           extends makePaymentEvent('payment.refunded') {}
export class PaymentPartiallyRefundedEvent  extends makePaymentEvent('payment.partially_refunded') {}

export const PAYMENT_EVENT_TYPES = {
  INITIATED:          'payment.initiated',
  GATEWAY_CREATED:    'payment.gateway_created',
  AUTHORIZED:         'payment.authorized',
  CAPTURED:           'payment.captured',
  FAILED:             'payment.failed',
  CANCELLED:          'payment.cancelled',
  EXPIRED:            'payment.expired',
  REFUNDED:           'payment.refunded',
  PARTIALLY_REFUNDED: 'payment.partially_refunded',
} as const;
