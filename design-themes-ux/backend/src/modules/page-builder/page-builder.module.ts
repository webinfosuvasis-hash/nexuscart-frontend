import { Module } from '@nestjs/common';
import { PageBuilderService } from './page-builder.service';
import { PageBuilderController } from './page-builder.controller';
import { BuilderEventsService } from './page-builder-events.service';

@Module({
  controllers: [PageBuilderController],
  providers:   [PageBuilderService, BuilderEventsService],
  exports:     [PageBuilderService, BuilderEventsService],
})
export class PageBuilderModule {}
