import { Module } from '@nestjs/common';
import { OrdersModule } from '@/modules/orders/orders.module';
import { CustomerShipmentController } from './customer-shipment.controller';
import { CustomerShipmentService } from './customer-shipment.service';

@Module({
  imports: [OrdersModule],
  controllers: [CustomerShipmentController],
  providers: [CustomerShipmentService],
})
export class CustomerShipmentModule {}
