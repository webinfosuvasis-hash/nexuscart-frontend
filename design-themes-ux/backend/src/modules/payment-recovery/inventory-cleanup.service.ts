import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InventoryReservationStatus, PaymentTxStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class InventoryCleanupService {
  private readonly logger = new Logger(InventoryCleanupService.name);
  private isRunning = false;

  constructor(private readonly prisma: PrismaService) {}

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

        // Release: optimistic-lock on RESERVED status to prevent double-release
        // under concurrent cron invocations. Wrapped in a per-reservation try/catch
        // so a single failure does not abort the rest of the batch.
        try {
          await this.prisma.$transaction(async (txClient) => {
            const result = await txClient.inventoryReservation.updateMany({
              where: { id: reservation.id, status: InventoryReservationStatus.RESERVED },
              data:  {
                status:     InventoryReservationStatus.EXPIRED,
                releasedAt: new Date(),
              },
            });
            if (result.count === 0) return; // Concurrently released — idempotent

            // Return the soft-held stock to the available pool.
            // Only `reserved` is decremented: onHand was never physically removed
            // (inventory was never shipped), and committed stays 0 (no fulfillment).
            for (const item of reservation.items) {
              const updated = await txClient.inventoryLevel.updateMany({
                where: {
                  storeId:   reservation.storeId,
                  productId: item.productId,
                  variantId: item.variantId ?? null,
                  reserved:  { gte: item.quantity }, // lower-bound guard
                },
                data: { reserved: { decrement: item.quantity } },
              });
              // Throw so the entire transaction rolls back — reservation stays RESERVED.
              // Partial release would permanently corrupt the reserved counter.
              if (updated.count === 0) {
                throw new Error(
                  `Inventory lower-bound guard blocked release for product ${item.productId} ` +
                  `qty=${item.quantity} in reservation ${reservation.id} — transaction rolled back`,
                );
              }
            }
          });

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
