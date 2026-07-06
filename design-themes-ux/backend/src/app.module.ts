import {
  Module, MiddlewareConsumer, NestModule, RequestMethod,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { StoresModule } from './modules/stores/stores.module';
import { ProductsModule } from './modules/products/products.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { OrdersModule } from './modules/orders/orders.module';
import { CustomersModule } from './modules/customers/customers.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { MarketingModule } from './modules/marketing/marketing.module';
import { CmsModule } from './modules/cms/cms.module';
import { ThemesModule } from './modules/themes/themes.module';
import { SearchModule } from './modules/search/search.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { BrandsModule } from './modules/brands/brands.module';
import { CollectionsModule } from './modules/collections/collections.module';
import { AttributesModule } from './modules/attributes/attributes.module';
import { UploadModule } from './modules/upload/upload.module';
import { ThemeEngineModule } from './modules/theme-engine/theme-engine.module';
import { StorefrontModule }  from './modules/storefront/storefront.module';
import { ContentModule }     from './modules/content/content.module';
import { PageBuilderModule } from './modules/page-builder/page-builder.module';
import { CacheModule }       from './shared/cache/cache.module';
import { CdnModule }         from './shared/cdn/cdn.module';
import { OutboxHelperModule } from './shared/outbox/outbox-helper.module';
import { CartModule }     from './modules/cart/cart.module';
import { CheckoutModule } from './modules/checkout/checkout.module';
import { PaymentOrchestratorModule } from './modules/payment-orchestrator/payment-orchestrator.module';
import { WebhookModule } from './modules/webhook/webhook.module';
import { PaymentRecoveryModule }    from './modules/payment-recovery/payment-recovery.module';
import { OutboxProcessorModule }    from './modules/outbox/outbox-processor.module';
import { OrderCancellationModule }  from './modules/cancellation/order-cancellation.module';
import { FulfillmentModule }        from './modules/fulfillment/fulfillment.module';
import { CustomerAuthModule }       from './modules/customer-auth/customer-auth.module';
import { CustomerProfileModule }    from './modules/customer-profile/customer-profile.module';
import { CustomerAddressModule }    from './modules/customer-address/customer-address.module';
import { CustomerPaymentModule }    from './modules/customer-payment/customer-payment.module';
import { CustomerOrdersModule }     from './modules/customer-orders/customer-orders.module';
import { CustomerShipmentModule }   from './modules/customer-shipment/customer-shipment.module';
import { CustomerCancellationModule } from './modules/customer-cancellation/customer-cancellation.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule }     from '@nestjs/schedule';

import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { StoreContextMiddleware } from './common/middleware/store-context.middleware';
import { ThemeContextMiddleware } from './common/middleware/theme-context.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        NODE_ENV:                Joi.string().valid('development', 'local', 'staging', 'production').default('development'),
        PORT:                    Joi.number().default(3000),
        DATABASE_URL:            Joi.string().required(),
        JWT_SECRET:              Joi.string().min(32).required(),
        JWT_REFRESH_SECRET:      Joi.string().min(32).required(),
        PREVIEW_JWT_SECRET:      Joi.string().min(32).required(),
        JWT_EXPIRES_IN:          Joi.string().default('15m'),
        JWT_REFRESH_EXPIRES_DAYS:Joi.number().default(7),
        // Customer/storefront auth (FI-1) — isolated secrets, never shared with the merchant JWT_* keys above
        CUSTOMER_JWT_SECRET:              Joi.string().min(32).required(),
        CUSTOMER_JWT_REFRESH_SECRET:      Joi.string().min(32).required(),
        CUSTOMER_JWT_EXPIRES_IN:          Joi.string().default('15m'),
        CUSTOMER_JWT_REFRESH_EXPIRES_DAYS:Joi.number().default(30),
        CUSTOMER_PASSWORD_RESET_EXPIRES_MINUTES:    Joi.number().default(30),
        CUSTOMER_EMAIL_VERIFICATION_EXPIRES_HOURS:  Joi.number().default(48),
        REDIS_HOST:              Joi.string().default('localhost'),
        REDIS_PORT:              Joi.number().default(6379),
        CORS_ORIGIN:             Joi.string().optional(),
        CART_LOCK_TIMEOUT_MINUTES:   Joi.number().default(15),
        CART_DEBUG:                  Joi.boolean().default(false),
        CART_GC_BATCH_SIZE:          Joi.number().default(500),
        CART_ABANDON_AFTER_HOURS:    Joi.number().default(24),
        CART_EXPIRE_AFTER_DAYS:      Joi.number().default(30),
        CART_ARCHIVE_AFTER_DAYS:     Joi.number().default(60),
        CART_READ_THRESHOLD_MINUTES:          Joi.number().default(5),
        CHECKOUT_SESSION_TIMEOUT_MINUTES:     Joi.number().default(30),
        CHECKOUT_DEBUG:                       Joi.boolean().default(false),
        CHECKOUT_DEFAULT_CURRENCY:            Joi.string().default('INR'),
        STORE_STATE_CODE:                     Joi.string().default('KA'),
        CHECKOUT_FREE_SHIPPING_THRESHOLD:     Joi.number().default(999),
        RAZORPAY_WEBHOOK_SECRET:              Joi.string().min(1).required(),
        STRIPE_WEBHOOK_SECRET:                Joi.string().min(1).required(),
        RECOVERY_CAPTURED_MIN_AGE_SECONDS:    Joi.number().default(120),
        RECOVERY_AUTHORIZED_TIMEOUT_MINUTES:  Joi.number().default(30),
        RECOVERY_MAX_RETRIES:                 Joi.number().default(5),
        OUTBOX_BATCH_SIZE:                    Joi.number().default(50),
        OUTBOX_MAX_BACKOFF_MINUTES:           Joi.number().default(60),
        OPS_ALERT_WEBHOOK_URL:                Joi.string().uri().optional(),
      }),
      validationOptions: { allowUnknown: true, abortEarly: false },
    }),
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 20 },
      { name: 'medium', ttl: 60000, limit: 200 },
    ]),
    EventEmitterModule.forRoot({ wildcard: true, global: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    OutboxHelperModule, // @Global — provides OutboxHelperService to all modules
    CacheModule,        // @Global — provides CacheService to all modules
    CdnModule,        // @Global — provides CdnService to all modules
    AuthModule,
    UsersModule,
    StoresModule,
    ProductsModule,
    CategoriesModule,
    OrdersModule,
    CustomersModule,
    InventoryModule,
    MarketingModule,
    CmsModule,
    ThemesModule,
    SearchModule,
    AnalyticsModule,
    SubscriptionsModule,
    BrandsModule,
    CollectionsModule,
    AttributesModule,
    UploadModule,
    ThemeEngineModule,
    StorefrontModule,
    ContentModule,      // Universal Architecture v2 — Phase 0
    PageBuilderModule,  // Generic page builder — Phase 1B+
    CartModule,                  // Cart Engine — Phase P3A
    CheckoutModule,              // Checkout Foundation — Phase P4A
    PaymentOrchestratorModule,   // Payment Completion & Order Creation — Milestone 5
    WebhookModule,               // Webhook Processing Layer — Milestone 6
    PaymentRecoveryModule,       // Payment Recovery & Inventory Cleanup — Milestone 7
    OutboxProcessorModule,       // Transactional Outbox Processor — Milestone 7
    OrderCancellationModule,     // Order Cancellation + Refund — Milestone 8
    FulfillmentModule,           // Fulfillment + Notifications — Milestone 9
    CustomerAuthModule,          // Customer Identity Platform — FI-1
    CustomerProfileModule,       // Customer Self-Service Phase 2 — Profile
    CustomerAddressModule,       // Customer Self-Service Phase 3 — Address Book
    CustomerPaymentModule,       // Customer Payment API — completes Checkout → Payment → Order
    CustomerOrdersModule,        // Customer Self-Service Phase 5 — Order History & Order Details
    CustomerShipmentModule,      // Customer Self-Service Phase 6 — Shipment Tracking
    CustomerCancellationModule,  // Customer Self-Service Phase 7 — Order Cancellation & Refund Status
  ],
  providers: [
    // Global JWT guard — all routes protected unless @Public()
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // RBAC via @Permissions() and @Roles() decorators
    { provide: APP_GUARD, useClass: PermissionsGuard },
    // Rate limiting
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Wrap all responses in { success, data, timestamp }
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    // Global exception handler
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Extract X-Store-Id on all routes
    consumer
      .apply(StoreContextMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });

    // Resolve active themeId on all /theme/* and /storefront/* routes.
    // Checks X-Theme-Id header first, then falls back to active StoreTheme.
    consumer
      .apply(ThemeContextMiddleware)
      .forRoutes(
        { path: 'theme/*', method: RequestMethod.ALL },
        { path: 'storefront/*', method: RequestMethod.ALL },
      );
  }
}
