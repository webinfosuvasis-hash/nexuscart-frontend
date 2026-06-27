import { Module } from '@nestjs/common';
import { PrismaModule }      from '@/prisma/prisma.module';
import { CacheModule }       from '@/shared/cache/cache.module';
import { ThemeEngineModule } from '@/modules/theme-engine/theme-engine.module';
import { ContentModule }     from '@/modules/content/content.module';
import { StorefrontService }    from './storefront.service';
import { StorefrontController } from './storefront.controller';
import { StorefrontGuard }      from './storefront.guard';

@Module({
  imports: [
    PrismaModule,
    CacheModule,
    ThemeEngineModule,
    ContentModule,        // provides FeatureFlagService, DocumentService
  ],
  controllers: [StorefrontController],
  providers:   [StorefrontService, StorefrontGuard],
  exports:     [StorefrontService],
})
export class StorefrontModule {}
