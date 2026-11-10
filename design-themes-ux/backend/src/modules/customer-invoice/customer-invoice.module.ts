import { Module } from '@nestjs/common';
import { OrdersModule } from '@/modules/orders/orders.module';
import { InvoiceModule } from '@/modules/invoice/invoice.module';
import { CustomerInvoiceController } from './customer-invoice.controller';
import { CustomerInvoiceService } from './customer-invoice.service';

@Module({
  imports: [OrdersModule, InvoiceModule],
  controllers: [CustomerInvoiceController],
  providers: [CustomerInvoiceService],
})
export class CustomerInvoiceModule {}
