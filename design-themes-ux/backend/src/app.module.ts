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
import { CacheModule } from './shared/cache/cache.module';
import { CdnModule }   from './shared/cdn/cdn.module';

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
        REDIS_HOST:              Joi.string().default('localhost'),
        REDIS_PORT:              Joi.number().default(6379),
        CORS_ORIGIN:             Joi.string().optional(),
      }),
      validationOptions: { allowUnknown: true, abortEarly: false },
    }),
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 20 },
      { name: 'medium', ttl: 60000, limit: 200 },
    ]),
    PrismaModule,
    CacheModule,      // @Global — provides CacheService to all modules
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
