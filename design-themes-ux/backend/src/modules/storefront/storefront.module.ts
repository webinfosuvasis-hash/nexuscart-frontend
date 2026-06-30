import { Module } from '@nestjs/common';
import { PrismaModule }      from '@/prisma/prisma.module';
import { CacheModule }       from '@/shared/cache/cache.module';
import { ThemeEngineModule } from '@/modules/theme-engine/theme-engine.module';
import { ContentModule }     from '@/modules/content/content.module';
import { StorefrontService }              from './storefront.service';
import { StorefrontController }           from './storefront.controller';
import { StorefrontGuard }                from './storefront.guard';
import { StorefrontPageBuilderService }   from './storefront-page-builder.service';
import { StorefrontPageBuilderController } from './storefront-page-builder.controller';
import { StorefrontProductsService }       from './storefront-products.service';
import { StorefrontProductsController }    from './storefront-products.controller';
import { StorefrontFacetsService }         from './storefront-facets.service';
import { StorefrontProductDetailService }  from './storefront-product-detail.service';
import { StorefrontReviewsService }        from './storefront-reviews.service';

@Module({
  imports: [
    PrismaModule,
    CacheModule,
    ThemeEngineModule,
    ContentModule,        // provides FeatureFlagService, DocumentService
  ],
  controllers: [StorefrontController, StorefrontPageBuilderController, StorefrontProductsController],
  providers:   [
    StorefrontService, StorefrontGuard, StorefrontPageBuilderService,
    StorefrontProductsService, StorefrontFacetsService,
    StorefrontProductDetailService, StorefrontReviewsService,
  ],
  exports: [
    StorefrontService, StorefrontPageBuilderService,
    StorefrontProductsService, StorefrontFacetsService,
    StorefrontProductDetailService, StorefrontReviewsService,
  ],
})
export class StorefrontModule {}
