import { Module } from '@nestjs/common';
import { PaymentOrchestratorService }             from './payment-orchestrator.service';
import { OrderConfirmationEmailService } from './order-confirmation-email.service';
import { PaymentOrchestratorNotificationService } from './payment-orchestrator-notification.service';
import { VendorsModule } from '../vendors/vendors.module';

// PrismaService, ConfigService, and EventEmitter2 are @Global — no explicit imports needed.
// VendorsModule provides VendorOrderNotificationService (vendor order emails).
@Module({
  imports:   [VendorsModule],
  providers: [PaymentOrchestratorService, PaymentOrchestratorNotificationService, OrderConfirmationEmailService],
  exports:   [PaymentOrchestratorService],
})
export class PaymentOrchestratorModule {}
