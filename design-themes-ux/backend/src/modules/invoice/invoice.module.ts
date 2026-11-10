import { Module } from '@nestjs/common';
import { OrdersModule } from '@/modules/orders/orders.module';
import { PaymentModule } from '@/modules/payment/payment.module';
import { AdminInvoiceController } from './admin-invoice.controller';
import { InvoiceService } from './invoice.service';
import { InvoicePdfService } from './invoice-pdf.service';

@Module({
  imports: [OrdersModule, PaymentModule],
  controllers: [AdminInvoiceController],
  providers: [InvoiceService, InvoicePdfService],
  exports: [InvoiceService, InvoicePdfService],
})
export class InvoiceModule {}
