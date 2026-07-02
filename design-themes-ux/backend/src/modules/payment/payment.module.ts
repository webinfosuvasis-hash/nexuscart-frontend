import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { paymentConfig } from './config/payment.config';
import { CodPaymentGateway } from './gateways/cod/cod-payment.gateway';
import { MockPaymentGateway } from './gateways/mock/mock-payment.gateway';
import { RazorpayPaymentGateway } from './gateways/razorpay/razorpay-payment.gateway';
import { PaymentGatewayRegistry } from './gateways/payment-gateway-registry.service';
import { PaymentStateValidatorService } from './state/payment-state-validator.service';
import { PaymentService } from './payment.service';

@Module({
  imports: [ConfigModule.forFeature(paymentConfig)],
  providers: [
    PaymentStateValidatorService,
    PaymentGatewayRegistry,
    MockPaymentGateway,
    CodPaymentGateway,
    RazorpayPaymentGateway,
    PaymentService,
  ],
  exports: [
    PaymentStateValidatorService,
    PaymentGatewayRegistry,
    PaymentService,
  ],
})
export class PaymentModule implements OnModuleInit {
  constructor(
    private readonly registry: PaymentGatewayRegistry,
    private readonly mock: MockPaymentGateway,
    private readonly cod: CodPaymentGateway,
    private readonly razorpay: RazorpayPaymentGateway,
  ) {}

  onModuleInit(): void {
    this.registry.register(this.mock);
    this.registry.register(this.cod);
    this.registry.register(this.razorpay);
  }
}
