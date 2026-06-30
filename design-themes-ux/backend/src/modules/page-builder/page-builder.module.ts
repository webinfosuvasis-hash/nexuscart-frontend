import { Module } from '@nestjs/common';
import { PageBuilderService }    from './page-builder.service';
import { PageBuilderController } from './page-builder.controller';
import { BuilderEventsService }  from './page-builder-events.service';
import { PageBuilderCronService } from './page-builder-cron.service';

@Module({
  controllers: [PageBuilderController],
  providers:   [PageBuilderService, BuilderEventsService, PageBuilderCronService],
  exports:     [PageBuilderService, BuilderEventsService, PageBuilderCronService],
})
export class PageBuilderModule {}
