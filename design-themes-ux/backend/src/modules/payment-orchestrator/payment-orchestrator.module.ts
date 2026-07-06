import { Module } from '@nestjs/common';
import { PaymentOrchestratorService }             from './payment-orchestrator.service';
import { PaymentOrchestratorNotificationService } from './payment-orchestrator-notification.service';

// PrismaService, ConfigService, and EventEmitter2 are @Global — no explicit imports needed.
@Module({
  providers: [PaymentOrchestratorService, PaymentOrchestratorNotificationService],
  exports:   [PaymentOrchestratorService],
})
export class PaymentOrchestratorModule {}
