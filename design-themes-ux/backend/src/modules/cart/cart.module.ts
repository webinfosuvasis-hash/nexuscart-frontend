import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { cartConfig } from './cart.config';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { CartEngineService } from './engine/cart-engine.service';
import { CartEventBus } from './events/cart-event-bus.service';
import { CartEventLoggerHandler } from './events/cart-event-logger.handler';
import { CartActivityEventHandler } from './handlers/cart-activity-event.handler';
import { CartActivityService } from './services/cart-activity.service';
import { CartLifecycleService } from './services/cart-lifecycle.service';
import { CartMutationGuard } from './guards/cart-mutation.guard';
import { CartTracingMiddleware } from './middleware/cart-tracing.middleware';
import { CartSessionMiddleware } from './middleware/cart-session.middleware';
import { CartIdempotencyMiddleware } from './middleware/cart-idempotency.middleware';

// Engine implementations
import { DefaultInventoryEngine } from './engines/inventory/inventory-engine.default';
import { DefaultPricingEngine } from './engines/pricing/pricing-engine.default';
import { NullPromotionEngine } from './engines/promotion/promotion-engine.null';
import { PlaceholderShippingEngine } from './engines/shipping/shipping-engine.placeholder';
import { PlaceholderTaxEngine } from './engines/tax/tax-engine.placeholder';
import { INVENTORY_ENGINE, PRICING_ENGINE, PROMOTION_ENGINE, SHIPPING_ENGINE, TAX_ENGINE } from './engines/engine-tokens';

// Resolver
import { MemoryEngineResolver } from './resolver/memory-engine-resolver';
import { ENGINE_RESOLVER } from './resolver/engine-resolver.interface';

@Module({
  imports: [
    ConfigModule.forFeature(cartConfig),
  ],
  controllers: [CartController],
  providers: [
    CartService,
    CartEngineService,
    CartEventBus,
    CartEventLoggerHandler,
    CartActivityEventHandler,
    CartActivityService,
    CartLifecycleService,
    CartMutationGuard,

    // Engine token bindings
    { provide: INVENTORY_ENGINE, useClass: DefaultInventoryEngine },
    { provide: PRICING_ENGINE,   useClass: DefaultPricingEngine },
    { provide: PROMOTION_ENGINE, useClass: NullPromotionEngine },
    { provide: SHIPPING_ENGINE,  useClass: PlaceholderShippingEngine },
    { provide: TAX_ENGINE,       useClass: PlaceholderTaxEngine },

    // Resolver
    { provide: ENGINE_RESOLVER, useClass: MemoryEngineResolver },
  ],
  exports: [CartService, CartActivityService],
})
export class CartModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(CartTracingMiddleware, CartSessionMiddleware, CartIdempotencyMiddleware)
      .forRoutes({ path: 'cart', method: RequestMethod.ALL }, { path: 'cart/*path', method: RequestMethod.ALL });
  }
}
