import { Module } from '@nestjs/common';
import { PrismaModule }          from '@/prisma/prisma.module';
import { CacheModule }           from '@/shared/cache/cache.module';
import { DocumentService }       from './document.service';
import { DocumentController }    from './document.controller';
import { DefinitionsController }  from './definitions.controller';
import { FeatureFlagService }    from './feature-flag.service';
import { FeatureFlagController } from './feature-flag.controller';
import { NodeRefService }        from './node-ref.service';
import { ShadowRenderService }   from './shadow-render.service';

@Module({
  imports:     [PrismaModule, CacheModule],
  controllers: [DocumentController, DefinitionsController, FeatureFlagController],
  providers:   [DocumentService, NodeRefService, ShadowRenderService, FeatureFlagService],
  exports:     [DocumentService, NodeRefService, ShadowRenderService, FeatureFlagService],
})
export class ContentModule {}
