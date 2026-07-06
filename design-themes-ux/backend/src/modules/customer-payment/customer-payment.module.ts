import { Module } from '@nestjs/common';
import { PaymentModule } from '@/modules/payment/payment.module';
import { PaymentOrchestratorModule } from '@/modules/payment-orchestrator/payment-orchestrator.module';
import { CheckoutModule } from '@/modules/checkout/checkout.module';
import { CustomerPaymentController } from './customer-payment.controller';
import { CustomerPaymentService } from './customer-payment.service';

@Module({
  imports: [PaymentModule, PaymentOrchestratorModule, CheckoutModule],
  controllers: [CustomerPaymentController],
  providers: [CustomerPaymentService],
})
export class CustomerPaymentModule {}
