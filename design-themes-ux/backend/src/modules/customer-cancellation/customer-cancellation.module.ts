import { Module } from '@nestjs/common';
import { OrdersModule } from '@/modules/orders/orders.module';
import { OrderCancellationModule } from '@/modules/cancellation/order-cancellation.module';
import { CustomerCancellationController } from './customer-cancellation.controller';
import { CustomerCancellationService } from './customer-cancellation.service';

@Module({
  imports: [OrdersModule, OrderCancellationModule],
  controllers: [CustomerCancellationController],
  providers: [CustomerCancellationService],
})
export class CustomerCancellationModule {}
