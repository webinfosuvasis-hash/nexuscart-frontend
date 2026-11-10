import { Module } from '@nestjs/common';
import { CacheModule } from '@/shared/cache/cache.module';
import { CmsService } from './cms.service';
import { CmsController } from './cms.controller';

@Module({
  imports: [CacheModule],
  controllers: [CmsController],
  providers: [CmsService],
  exports: [CmsService],
})
export class CmsModule {}
