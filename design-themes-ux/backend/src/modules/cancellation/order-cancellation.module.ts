import { Module } from '@nestjs/common';
import { PaymentModule } from '@/modules/payment/payment.module';
import { OrderCancellationService }              from './order-cancellation.service';
import { OrderCancellationController }           from './order-cancellation.controller';
import { CancellationEventListenerService }      from './order-cancellation.event-listeners.service';
import { OrderCancellationNotificationService }  from './order-cancellation-notification.service';

// PrismaService, ConfigService, and EventEmitter2 are @Global — no explicit imports needed.
@Module({
  imports: [
    PaymentModule,   // provides PaymentService
  ],
  controllers: [OrderCancellationController],
  providers: [
    OrderCancellationService,
    CancellationEventListenerService,
    OrderCancellationNotificationService,
  ],
  exports: [OrderCancellationService],
})
export class OrderCancellationModule {}
