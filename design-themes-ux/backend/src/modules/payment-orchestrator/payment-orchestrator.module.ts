import { Module } from '@nestjs/common';
import { PaymentOrchestratorService } from './payment-orchestrator.service';

// PrismaService and ConfigService are @Global — no explicit import needed.
@Module({
  providers: [PaymentOrchestratorService],
  exports:   [PaymentOrchestratorService],
})
export class PaymentOrchestratorModule {}
