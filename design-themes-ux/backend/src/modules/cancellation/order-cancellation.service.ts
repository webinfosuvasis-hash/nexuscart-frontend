import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  InventoryReservationStatus,
  OrderStatus,
  OutboxEventStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { PaymentService } from '@/modules/payment/payment.service';
import {
  CancelOrderInput,
  CancellationResult,
  PaymentActionType,
} from './types/cancellation.types';

const PRE_CAPTURE_STATUSES  = ['PENDING', 'GATEWAY_CREATED', 'AUTHORIZED'] as const;
const POST_CAPTURE_STATUSES = ['CAPTURED', 'PARTIALLY_REFUNDED'] as const;
const TERMINAL_STATUSES     = ['CANCELLED', 'FAILED', 'REFUNDED', 'EXPIRED'] as const;

@Injectable()
export class OrderCancellationService {
  private readonly logger = new Logger(OrderCancellationService.name);

  constructor(
    private readonly prisma:      PrismaService,
    private readonly paymentSvc:  PaymentService,
  ) {}

  // ---------------------------------------------------------------------------
  // Main entry point
  // ---------------------------------------------------------------------------

  async cancelOrder(input: CancelOrderInput): Promise<CancellationResult> {
    const { orderId, storeId, reason, actorId } = input;

    // ─── Step 0: Load Order and assert cancellable ──────────────────────────

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, storeId },
    });

    if (!order) throw new NotFoundException(`Order ${orderId} not found`);

    if (order.status === OrderStatus.CANCELLED) {
      return this.buildIdempotentResult(orderId, storeId);
    }

    if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.PROCESSING) {
      throw new ConflictException(
        `Order ${orderId} is in status ${order.status} and cannot be cancelled`,
      );
    }

    const lockedStatus = order.status;

    // ─── Step 1: Load PaymentTransaction ────────────────────────────────────

    let tx: any = null;
    if (order.paymentTransactionId) {
      tx = await this.prisma.paymentTransaction.findFirst({
        where:   { id: order.paymentTransactionId, storeId },
        include: { reservation: { include: { items: true } } },
      });
      if (!tx) {
        this.logger.error(
          `Order ${orderId}: paymentTransactionId ${order.paymentTransactionId} not found in store — treating as no-payment`,
        );
      }
    }

    // ─── Step 2: Payment action (branch on tx.status) ───────────────────────

    let paymentAction: PaymentActionType = 'NO_PAYMENT';
    let refundResult: { transaction: any; refund: any } | null = null;
    let remainingPaise = 0;

    if (tx) {
      if ((PRE_CAPTURE_STATUSES as readonly string[]).includes(tx.status)) {
        // Branch A — cancel before capture
        await this.paymentSvc.cancelPayment(tx.id, tx.storeId);
        paymentAction = 'CANCELLED';

      } else if ((POST_CAPTURE_STATUSES as readonly string[]).includes(tx.status)) {
        // Branch B — refund after capture (P1-1)
        const completedRefunds = await this.prisma.paymentRefund.findMany({
          where:  { paymentTransactionId: tx.id, status: 'COMPLETED' },
          select: { amountInPaise: true },
        });
        const totalAlreadyRefunded = completedRefunds.reduce(
          (sum: number, r: { amountInPaise: number }) => sum + r.amountInPaise,
          0,
        );
        const capturedAmount: number = tx.capturedPaise ?? tx.amountInPaise;
        remainingPaise = capturedAmount - totalAlreadyRefunded;

        if (remainingPaise <= 0) {
          paymentAction = 'ALREADY_REFUNDED';
        } else {
          // P0-3: deterministic idempotency key — stable across retries for same order
          const refundIdemKey = `cancellation:refund:${orderId}`;
          refundResult = await this.paymentSvc.refundPayment({
            transactionId:  tx.id,
            storeId:        tx.storeId,
            amountInPaise:  remainingPaise,
            reason:         `Order cancellation: ${reason}`,
            idempotencyKey: refundIdemKey,
          });
          paymentAction =
            refundResult.refund.status === 'COMPLETED' ? 'REFUNDED' : 'REFUND_FAILED';
        }

      } else if ((TERMINAL_STATUSES as readonly string[]).includes(tx.status)) {
        // Branch C — terminal/already-done
        paymentAction = 'SKIPPED';
      }
    }

    // ─── Step 3: Inventory release ───────────────────────────────────────────
    //
    // F1 — Error propagation contract:
    // If the $transaction below throws for ANY reason, the exception MUST
    // propagate out of cancelOrder. Step 4 MUST NOT execute. There is no
    // try/catch wrapping this block. Reservation stays in current status;
    // retry restarts from Step 0 with full idempotency.

    let inventoryReleased = false;
    const reservation = tx?.reservation ?? null;

    if (reservation) {
      if (
        reservation.status === InventoryReservationStatus.RELEASED ||
        reservation.status === InventoryReservationStatus.EXPIRED
      ) {
        // Already released by a prior run — idempotent
        inventoryReleased = true;

      } else if (reservation.status === InventoryReservationStatus.RESERVED) {
        // RESERVED → EXPIRED: reserved counter only; onHand was never decremented
        await this.prisma.$transaction(async (txClient) => {
          const result = await txClient.inventoryReservation.updateMany({
            where: { id: reservation.id, status: InventoryReservationStatus.RESERVED },
            data:  { status: InventoryReservationStatus.EXPIRED, releasedAt: new Date() },
          });
          if (result.count === 0) return; // concurrent release — idempotent

          for (const item of reservation.items) {
            const updated = await txClient.inventoryLevel.updateMany({
              where: {
                storeId:   reservation.storeId,
                productId: item.productId,
                variantId: item.variantId ?? null,
                reserved:  { gte: item.quantity },
              },
              data: { reserved: { decrement: item.quantity } },
            });
            if (updated.count === 0) {
              throw new Error(
                `Inventory lower-bound guard (reserved) blocked release: ` +
                `product=${item.productId} qty=${item.quantity} reservation=${reservation.id}`,
              );
            }
          }
        });
        inventoryReleased = true;

      } else if (reservation.status === InventoryReservationStatus.COMMITTED) {
        // COMMITTED → RELEASED: restore onHand AND decrement committed (P0-2 fix)
        await this.prisma.$transaction(async (txClient) => {
          const result = await txClient.inventoryReservation.updateMany({
            where: { id: reservation.id, status: InventoryReservationStatus.COMMITTED },
            data:  { status: InventoryReservationStatus.RELEASED, releasedAt: new Date() },
          });
          if (result.count === 0) return; // concurrent release — idempotent

          for (const item of reservation.items) {
            const updated = await txClient.inventoryLevel.updateMany({
              where: {
                storeId:   reservation.storeId,
                productId: item.productId,
                variantId: item.variantId ?? null,
                committed: { gte: item.quantity }, // lower-bound guard (P0-2)
              },
              data: {
                onHand:    { increment: item.quantity }, // restore physical stock (P0-2)
                committed: { decrement: item.quantity },
              },
            });
            if (updated.count === 0) {
              throw new Error(
                `Inventory lower-bound guard (committed) blocked release: ` +
                `product=${item.productId} qty=${item.quantity} reservation=${reservation.id}`,
              );
            }
          }
        });
        inventoryReleased = true;
      }
    }

    // ─── Step 4: Final atomic transaction (P0-4 + P0-5) ─────────────────────

    let orderRefund: any = null;

    const txResult = await this.prisma.$transaction(async (txClient) => {
      // P0-5: Optimistic lock — only one concurrent caller may commit
      const refundedAmountData =
        paymentAction === 'REFUNDED' && remainingPaise > 0
          ? { refundedAmount: { increment: new Prisma.Decimal(remainingPaise).dividedBy(100) } } // F2
          : {};

      const lockResult = await txClient.order.updateMany({
        where: { id: orderId, status: lockedStatus },
        data: {
          status:             OrderStatus.CANCELLED,
          cancelledAt:        new Date(),
          cancellationReason: reason,
          ...refundedAmountData,
        } as any,
      });

      if (lockResult.count === 0) {
        const freshOrder = await txClient.order.findFirst({ where: { id: orderId, storeId } });
        if (freshOrder?.status === OrderStatus.CANCELLED) {
          return { idempotent: true as const, createdRefund: null };
        }
        throw new ConflictException(
          `Order ${orderId} was concurrently modified ` +
          `(expected ${lockedStatus}, found ${freshOrder?.status})`,
        );
      }

      // OrderStatusHistory
      await txClient.orderStatusHistory.create({
        data: { orderId, status: OrderStatus.CANCELLED, note: reason },
      });

      // Refund record + PaymentRefund back-fill (only when gateway refund succeeded)
      let createdRefund: any = null;
      if (paymentAction === 'REFUNDED' && refundResult !== null) {
        const isCOD = tx.gatewayCode === 'cod';
        createdRefund = await txClient.refund.create({
          data: {
            orderId,
            paymentTransactionId: tx.id,
            gatewayRefundId:      refundResult.refund.gatewayRefundId ?? null,
            amount:               new Prisma.Decimal(remainingPaise).dividedBy(100), // F2
            amountInPaise:        remainingPaise,
            reason,
            // P2-1: COD refund is out-of-band bank transfer — PENDING until resolved manually
            status: isCOD ? 'PENDING' : 'COMPLETED',
          },
        });

        // P2-2: back-fill PaymentRefund.orderId (never set by PaymentService itself)
        await txClient.paymentRefund.update({
          where: { id: refundResult.refund.id },
          data:  { orderId },
        });
      }

      // Outbox events (UPPER_SNAKE_CASE — P1-4, idempotent create)
      await this.upsertOutboxEvent(txClient, storeId, {
        eventType:     'ORDER_CANCELLED',
        aggregateId:   orderId,
        aggregateType: 'Order',
        payload:       { orderId, storeId, reason, actorId, paymentAction },
      });

      if (inventoryReleased && reservation) {
        await this.upsertOutboxEvent(txClient, storeId, {
          eventType:     'INVENTORY_RELEASED',
          aggregateId:   reservation.id,
          aggregateType: 'InventoryReservation',
          payload:       { reservationId: reservation.id, orderId, storeId },
        });
      }

      if (paymentAction === 'REFUND_FAILED') {
        await this.upsertOutboxEvent(txClient, storeId, {
          eventType:     'REFUND_FAILED',
          aggregateId:   orderId,
          aggregateType: 'Order',
          payload: {
            orderId,
            storeId,
            paymentTransactionId: tx?.id ?? null,
            refundId:             refundResult?.refund?.id ?? null,
            reason:               'Cancellation refund gateway failure — manual action required',
          },
        });
      }

      return { idempotent: false as const, createdRefund };
    });

    if (txResult.idempotent) {
      return this.buildIdempotentResult(orderId, storeId);
    }

    orderRefund = txResult.createdRefund;

    const finalOrder = await this.prisma.order.findFirst({ where: { id: orderId, storeId } });

    return {
      order:             finalOrder!,
      paymentAction,
      paymentRefund:     refundResult?.refund ?? null,
      orderRefund,
      inventoryReleased,
    };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async buildIdempotentResult(orderId: string, storeId: string): Promise<CancellationResult> {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, storeId } });
    const orderRefund = await this.prisma.refund.findFirst({
      where:   { orderId },
      orderBy: { createdAt: 'desc' },
    });
    return {
      order:             order!,
      paymentAction:     'SKIPPED',
      paymentRefund:     null,
      orderRefund:       orderRefund ?? null,
      inventoryReleased: false,
    };
  }

  private async upsertOutboxEvent(
    txClient:  any,
    storeId:   string,
    ev: {
      eventType:     string;
      aggregateId:   string;
      aggregateType: string;
      payload:       Record<string, unknown>;
    },
  ): Promise<void> {
    const exists = await txClient.outboxEvent.findFirst({
      where: {
        storeId,
        eventType:   ev.eventType,
        aggregateId: ev.aggregateId,
        status:      { notIn: [OutboxEventStatus.FAILED, OutboxEventStatus.DEAD] },
      },
    });
    if (!exists) {
      await txClient.outboxEvent.create({
        data: {
          storeId,
          eventType:     ev.eventType,
          aggregateId:   ev.aggregateId,
          aggregateType: ev.aggregateType,
          payload:       ev.payload as Prisma.InputJsonValue,
          status:        OutboxEventStatus.PENDING,
        },
      });
    }
  }
}
