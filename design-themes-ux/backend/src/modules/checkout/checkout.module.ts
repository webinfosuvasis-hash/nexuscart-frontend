import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { checkoutConfig } from './checkout.config';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';
import { CheckoutEngineService } from './engine/checkout-engine.service';
import { CheckoutEventBus } from './events/checkout-event-bus.service';
import { CheckoutActivityEventHandler } from './handlers/checkout-activity-event.handler';
import { CheckoutActivityService } from './services/checkout-activity.service';
import { CheckoutTracingMiddleware } from './middleware/checkout-tracing.middleware';
import { CartSessionMiddleware } from '../cart/middleware/cart-session.middleware';

import { DefaultCheckoutInventoryEngine } from './engines/inventory/checkout-inventory.default';
import { DefaultCheckoutPromotionEngine } from './engines/promotion/checkout-promotion.default';
import { FlatShippingEngine } from './engines/shipping/flat-shipping.engine';
import { IndiaGSTEngine } from './engines/tax/india-gst.engine';
import { DefaultCheckoutAddressValidator } from './engines/address/address-validator.default';

import {
  CHECKOUT_INVENTORY_ENGINE,
  CHECKOUT_PROMOTION_ENGINE,
  CHECKOUT_SHIPPING_ENGINE,
  CHECKOUT_TAX_ENGINE,
  CHECKOUT_ADDRESS_VALIDATOR,
} from './engines/checkout-engine-tokens';

@Module({
  imports: [ConfigModule.forFeature(checkoutConfig)],
  controllers: [CheckoutController],
  providers: [
    CheckoutService,
    CheckoutEngineService,
    CheckoutEventBus,
    CheckoutActivityEventHandler,
    CheckoutActivityService,

    { provide: CHECKOUT_INVENTORY_ENGINE, useClass: DefaultCheckoutInventoryEngine },
    { provide: CHECKOUT_PROMOTION_ENGINE, useClass: DefaultCheckoutPromotionEngine },
    { provide: CHECKOUT_SHIPPING_ENGINE,  useClass: FlatShippingEngine },
    { provide: CHECKOUT_TAX_ENGINE,       useClass: IndiaGSTEngine },
    { provide: CHECKOUT_ADDRESS_VALIDATOR, useClass: DefaultCheckoutAddressValidator },
  ],
  exports: [CheckoutService, CheckoutActivityService],
})
export class CheckoutModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(CartSessionMiddleware, CheckoutTracingMiddleware)
      .forRoutes(
        { path: 'checkout',       method: RequestMethod.ALL },
        { path: 'checkout/*path', method: RequestMethod.ALL },
      );
  }
}
