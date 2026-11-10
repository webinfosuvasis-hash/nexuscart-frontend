import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InventoryReservationStatus, PaymentTxStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryReservationService } from '../../shared/inventory/inventory-reservation.service';

@Injectable()
export class InventoryCleanupService {
  private readonly logger = new Logger(InventoryCleanupService.name);
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly reservations: InventoryReservationService,
  ) {}

  // ---------------------------------------------------------------------------
  // Cron: every 5 minutes
  // ---------------------------------------------------------------------------

  @Cron(CronExpression.EVERY_5_MINUTES)
  async releaseExpiredReservations(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    const startMs = Date.now();
    let released = 0;
    let skipped  = 0;

    try {
      const expired = await this.prisma.inventoryReservation.findMany({
        where: {
          status:    InventoryReservationStatus.RESERVED,
          expiresAt: { lt: new Date() },
        },
        include: {
          items:   true,
          payment: { select: { id: true, status: true, orderId: true } },
        },
      });

      for (const reservation of expired) {
        const tx = reservation.payment;

        // Safety: never release a reservation linked to a completed order.
        // orderId being set means completePayment ran — inventory commit should have
        // already transitioned this reservation to COMMITTED.
        if (tx?.orderId) {
          this.logger.error(
            `Reservation ${reservation.id} is RESERVED but linked to order ${tx.orderId} — ` +
            `inventory may be inconsistent; skipping release`,
          );
          skipped++;
          continue;
        }

        // Safety: never release while the payment is still CAPTURED — the recovery
        // service may still be completing the order and will commit inventory.
        if (
          tx?.status === PaymentTxStatus.CAPTURED ||
          tx?.status === PaymentTxStatus.PARTIALLY_REFUNDED
        ) {
          this.logger.log(
            `Reservation ${reservation.id}: linked payment ${tx.id} is ${tx.status} — ` +
            `deferring release until order recovery completes`,
          );
          skipped++;
          continue;
        }

        // Release: status-guarded inside the service (RESERVED → EXPIRED) so
        // concurrent cron runs / a racing cancellation return the units once.
        // Per-reservation try/catch so one failure doesn't abort the batch.
        try {
          if (!(await this.reservations.expire(reservation.id))) {
            skipped++;
            continue;
          }

          released++;
          this.logger.log(
            `Released expired reservation ${reservation.id} ` +
            `(${reservation.items.length} item(s), storeId=${reservation.storeId})`,
          );
        } catch (txErr) {
          this.logger.error(
            `Failed to release reservation ${reservation.id}: ${(txErr as Error).message}`,
          );
        }
      }
    } catch (err) {
      this.logger.error(
        `InventoryCleanupService run failed: ${(err as Error).message}`,
        (err as Error).stack,
      );
    } finally {
      this.isRunning = false;
      const durationMs = Date.now() - startMs;
      if (released > 0 || skipped > 0) {
        this.logger.log(
          `Inventory cleanup: released=${released} skipped=${skipped} durationMs=${durationMs}`,
        );
      }
    }
  }
}
