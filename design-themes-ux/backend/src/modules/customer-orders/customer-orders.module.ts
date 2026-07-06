import { Module } from '@nestjs/common';
import { OrdersModule } from '@/modules/orders/orders.module';
import { PaymentModule } from '@/modules/payment/payment.module';
import { CustomerOrdersController } from './customer-orders.controller';
import { CustomerOrdersService } from './customer-orders.service';

@Module({
  imports: [OrdersModule, PaymentModule],
  controllers: [CustomerOrdersController],
  providers: [CustomerOrdersService],
})
export class CustomerOrdersModule {}
