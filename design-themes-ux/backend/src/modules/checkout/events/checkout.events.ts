import { CheckoutDomainEvent } from './checkout-domain-event.base';

type BaseArgs = ConstructorParameters<typeof CheckoutDomainEvent> extends [string, ...infer R] ? R : never;

function make(eventType: string) {
  return class extends CheckoutDomainEvent {
    constructor(
      public readonly payload: Record<string, unknown>,
      ...rest: BaseArgs
    ) {
      super(eventType, ...rest);
    }
  };
}

export class CheckoutStartedEvent        extends make('checkout.started') {}
export class CheckoutAddressUpdatedEvent extends make('checkout.address_updated') {}
export class CheckoutShippingUpdatedEvent extends make('checkout.shipping_updated') {}
export class CheckoutValidatedEvent      extends make('checkout.validated') {}
export class CheckoutCancelledEvent      extends make('checkout.cancelled') {}
export class CheckoutCompletedEvent      extends make('checkout.completed') {}
export class CheckoutExpiredEvent        extends make('checkout.expired') {}

export const CHECKOUT_EVENT_TYPES = {
  STARTED:          'checkout.started',
  ADDRESS_UPDATED:  'checkout.address_updated',
  SHIPPING_UPDATED: 'checkout.shipping_updated',
  VALIDATED:        'checkout.validated',
  CANCELLED:        'checkout.cancelled',
  COMPLETED:        'checkout.completed',
  EXPIRED:          'checkout.expired',
} as const;
