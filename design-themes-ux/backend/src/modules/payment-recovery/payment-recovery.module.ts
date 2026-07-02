import { Module } from '@nestjs/common';
import { PaymentModule } from '../payment/payment.module';
import { PaymentOrchestratorModule } from '../payment-orchestrator/payment-orchestrator.module';
import { PaymentRecoveryService } from './payment-recovery.service';
import { InventoryCleanupService } from './inventory-cleanup.service';

// PrismaService and ConfigService are @Global — no explicit import needed.
@Module({
  imports: [PaymentModule, PaymentOrchestratorModule],
  providers: [PaymentRecoveryService, InventoryCleanupService],
  exports:   [PaymentRecoveryService, InventoryCleanupService],
})
export class PaymentRecoveryModule {}
