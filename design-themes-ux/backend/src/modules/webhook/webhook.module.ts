import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { paymentConfig } from '../payment/config/payment.config';
import { PaymentModule } from '../payment/payment.module';
import { PaymentOrchestratorModule } from '../payment-orchestrator/payment-orchestrator.module';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { WebhookSignatureService } from './webhook-signature.service';

@Module({
  imports: [
    ConfigModule.forFeature(paymentConfig),  // makes payment.* namespace available in this module
    PaymentModule,
    PaymentOrchestratorModule,
  ],
  controllers: [WebhookController],
  providers:   [WebhookService, WebhookSignatureService],
})
export class WebhookModule {}
