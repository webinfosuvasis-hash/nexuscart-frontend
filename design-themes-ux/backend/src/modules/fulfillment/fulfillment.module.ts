import { Module } from '@nestjs/common';
import { FulfillmentController }          from './fulfillment.controller';
import { FulfillmentService }             from './fulfillment.service';
import { FulfillmentNotificationService } from './fulfillment-notification.service';

// PrismaService, OutboxHelperService, CacheService, and ConfigService are
// provided by their respective @Global() modules — no imports required here.
// EventEmitter2 is global via EventEmitterModule.forRoot({ global: true }).
@Module({
  controllers: [FulfillmentController],
  providers:   [FulfillmentService, FulfillmentNotificationService],
  exports:     [FulfillmentService],
})
export class FulfillmentModule {}
