import { CartDomainEvent } from './cart-domain-event.base';

type BaseArgs = ConstructorParameters<typeof CartDomainEvent> extends [string, ...infer R] ? R : never;

function make(eventType: string) {
  return class extends CartDomainEvent {
    constructor(
      public readonly payload: Record<string, unknown>,
      ...rest: BaseArgs
    ) {
      super(eventType, ...rest);
    }
  };
}

export class CartCreatedEvent       extends make('cart.created') {}
export class ItemAddedEvent         extends make('cart.item.added') {}
export class ItemRemovedEvent       extends make('cart.item.removed') {}
export class QtyUpdatedEvent        extends make('cart.item.qty_updated') {}
export class QtyAdjustedEvent       extends make('cart.item.qty_adjusted') {}
export class PromotionAppliedEvent  extends make('cart.promotion.applied') {}
export class PromotionRemovedEvent  extends make('cart.promotion.removed') {}
export class CartClearedEvent       extends make('cart.cleared') {}
export class CartMergedEvent        extends make('cart.merged') {}
export class CartLockedEvent        extends make('cart.locked') {}
export class CartUnlockedEvent      extends make('cart.unlocked') {}
export class CartAbandonedEvent     extends make('cart.abandoned') {}
export class CartExpiredEvent       extends make('cart.expired') {}
export class CartArchivedEvent      extends make('cart.archived') {}

export const CART_EVENT_TYPES = {
  CART_CREATED:       'cart.created',
  ITEM_ADDED:         'cart.item.added',
  ITEM_REMOVED:       'cart.item.removed',
  QTY_UPDATED:        'cart.item.qty_updated',
  QTY_ADJUSTED:       'cart.item.qty_adjusted',
  PROMOTION_APPLIED:  'cart.promotion.applied',
  PROMOTION_REMOVED:  'cart.promotion.removed',
  CART_CLEARED:       'cart.cleared',
  CART_MERGED:        'cart.merged',
  CART_LOCKED:        'cart.locked',
  CART_UNLOCKED:      'cart.unlocked',
  CART_ABANDONED:     'cart.abandoned',
  CART_EXPIRED:       'cart.expired',
  CART_ARCHIVED:      'cart.archived',
} as const;
