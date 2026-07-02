import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AddressType,
  CartStatus,
  CheckoutAddressSnapshot,
  CheckoutStatus,
  CouponType,
  InventoryReservationStatus,
  OrderStatus,
  OutboxEventStatus,
  PaymentStatus,
  PaymentTransaction,
  PaymentTxStatus,
  Prisma,
} from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../../prisma/prisma.service';
import {
  CompletePaymentResult,
  OrchestratorAddressSnapshot,
  OrchestratorCheckoutSnapshot,
  OrchestratorSnapshotItem,
} from './types/orchestrator.types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function mapAddress(a: CheckoutAddressSnapshot): OrchestratorAddressSnapshot {
  return {
    firstName:  a.firstName,
    lastName:   a.lastName,
    line1:      a.line1,
    line2:      a.line2,
    city:       a.city,
    state:      a.state,
    postalCode: a.postalCode,
    country:    a.country,
    phone:      a.phone,
    email:      a.email,
  };
}

const SHIPPING_BASE_COSTS: Record<string, number> = {
  standard: 99,
  express:  199,
  same_day: 299,
};

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class PaymentOrchestratorService {
  private readonly logger = new Logger(PaymentOrchestratorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configSvc: ConfigService,
  ) {}

  // ─── Main entry point ─────────────────────────────────────────────────────

  async completePayment(
    transactionId: string,
    storeId:       string,
  ): Promise<CompletePaymentResult> {
    // Step 1: Load and verify PaymentTransaction
    const tx = await this.prisma.paymentTransaction.findFirst({
      where: { id: transactionId, storeId },
    });
    if (!tx) {
      throw new NotFoundException(`Payment transaction ${transactionId} not found`);
    }
    if (tx.status !== PaymentTxStatus.CAPTURED) {
      throw new BadRequestException(
        `Payment must be CAPTURED to complete orchestration. Current status: ${tx.status}`,
      );
    }

    // Step 2: Idempotency — order already created on a prior run
    if (tx.orderId) {
      return this.handleAlreadyCompleted(tx, storeId);
    }

    // Step 3: Build + persist checkout snapshot (idempotent)
    const snapshot = await this.buildAndPersistSnapshot(tx);

    // Step 4: Commit inventory (idempotent — no-op if already committed or missing)
    await this.commitInventory(tx, storeId);

    // Step 5: Create order (idempotency via IdempotencyRecord; atomic via $transaction)
    const order = await this.createOrderWithIdempotency(tx, snapshot, storeId);

    // Step 6: Complete checkout + convert cart + persist outbox events (atomic)
    await this.completeCheckoutAndEmitEvents(tx, order, storeId);

    return { orderId: order.id, orderNumber: order.orderNumber, recovered: false };
  }

  // ─── Step 2: Already-completed recovery ───────────────────────────────────

  private async handleAlreadyCompleted(
    tx:      PaymentTransaction,
    storeId: string,
  ): Promise<CompletePaymentResult> {
    // P1-1: scope to storeId — multi-tenant isolation
    const order = await this.prisma.order.findFirst({
      where:  { id: tx.orderId!, storeId },
      select: { id: true, orderNumber: true },
    });
    if (!order) {
      throw new NotFoundException(
        `Order ${tx.orderId} linked to payment ${tx.id} not found — data integrity issue`,
      );
    }
    // Recovery: ensure outbox events were persisted (idempotent)
    await this.completeCheckoutAndEmitEvents(tx, order, storeId);
    return { orderId: order.id, orderNumber: order.orderNumber, recovered: true };
  }

  // ─── Step 3: Snapshot ─────────────────────────────────────────────────────

  private async buildAndPersistSnapshot(tx: PaymentTransaction): Promise<OrchestratorCheckoutSnapshot> {
    if (tx.checkoutSnapshot != null) {
      return tx.checkoutSnapshot as unknown as OrchestratorCheckoutSnapshot;
    }

    const snapshot = await this.buildSnapshot(tx);

    await this.prisma.paymentTransaction.update({
      where: { id: tx.id },
      data:  { checkoutSnapshot: snapshot as unknown as Prisma.InputJsonValue },
    });

    return snapshot;
  }

  private async buildSnapshot(tx: PaymentTransaction): Promise<OrchestratorCheckoutSnapshot> {
    const { storeId } = tx;

    const checkout = await this.prisma.checkoutSession.findFirst({
      where:   { id: tx.checkoutSessionId, storeId },
      include: { addresses: true },
    });
    if (!checkout) {
      throw new NotFoundException(`Checkout session ${tx.checkoutSessionId} not found`);
    }

    const cart = await this.prisma.cart.findFirst({
      where:   { id: checkout.cartId, storeId },
      include: { items: true },
    });
    if (!cart) {
      throw new NotFoundException(`Cart ${checkout.cartId} not found`);
    }

    // Build per-item snapshot from stored CartItem prices (never re-read from Product)
    const items: OrchestratorSnapshotItem[] = cart.items.map((item) => {
      const unitPrice    = Number(item.unitPrice);
      const lineDiscount = Number(item.lineDiscount);
      const lineTotal    = round2(unitPrice * item.quantity - lineDiscount);

      let variantOptions: Record<string, string> | null = null;
      if (item.variantOptions) {
        try { variantOptions = JSON.parse(item.variantOptions) as Record<string, string>; }
        catch { /* ignore malformed JSON */ }
      }

      return {
        cartItemId:     item.id,
        productId:      item.productId,
        variantId:      item.variantId,
        sku:            item.sku,
        name:           item.name,
        brand:          item.brand,
        thumbnail:      item.image,
        quantity:       item.quantity,
        unitPrice:      String(item.unitPrice),
        comparePrice:   item.comparePrice != null ? String(item.comparePrice) : null,
        lineDiscount:   String(item.lineDiscount),
        lineTotal:      String(lineTotal),
        taxCategory:    item.taxCategory,
        gstClass:       item.gstClass,
        hsn:            item.hsn,
        variantOptions,
        warehouseId:    item.warehouseId,
      };
    });

    // Subtotal = sum of item lineTotals (already net of per-line discounts)
    const subtotal = round2(items.reduce((sum, i) => sum + Number(i.lineTotal), 0));

    // Promotion discount from coupon (coupon metadata is not a product price)
    let promotionDiscount = 0;
    let freeShipping      = false;

    if (cart.couponCode) {
      // P1-2: no liveness gate (isActive / expiresAt) — snapshot records what was charged
      // at checkout time, not whether the coupon is still usable today.
      const coupon = await this.prisma.coupon.findFirst({
        where: { storeId, code: cart.couponCode },
      });
      if (coupon) {
        if (coupon.type === CouponType.PERCENTAGE) {
          let disc = (subtotal * Number(coupon.value)) / 100;
          if (coupon.maxDiscount != null) disc = Math.min(disc, Number(coupon.maxDiscount));
          promotionDiscount = round2(disc);
        } else if (coupon.type === CouponType.FIXED) {
          promotionDiscount = round2(Math.min(Number(coupon.value), subtotal));
        } else if (coupon.type === CouponType.FREE_SHIPPING) {
          freeShipping = true;
        }
      }
    }

    const subtotalAfterPromo = round2(Math.max(0, subtotal - promotionDiscount));

    // Shipping cost (stateless FlatShippingEngine logic)
    const shippingMethodId = checkout.selectedShippingMethodId ?? 'standard';
    const shippingCost     = freeShipping
      ? 0
      : this.resolveShippingCost(shippingMethodId, subtotalAfterPromo);

    // Tax: derived from amountInPaise (the ground truth) to avoid rounding divergence
    const grandTotal = round2(tx.amountInPaise / 100);
    const tax        = round2(Math.max(0, grandTotal - subtotalAfterPromo - shippingCost));

    const shippingAddr = checkout.addresses.find((a) => a.type === AddressType.SHIPPING);
    const billingAddr  = checkout.addresses.find((a) => a.type === AddressType.BILLING);

    return {
      checkoutSessionId:        checkout.id,
      cartId:                   cart.id,
      storeId,
      customerId:               checkout.customerId,
      sessionId:                checkout.sessionId,
      couponCode:               cart.couponCode,
      selectedShippingMethodId: checkout.selectedShippingMethodId,
      shippingAddress:          shippingAddr ? mapAddress(shippingAddr) : null,
      billingAddress:           billingAddr  ? mapAddress(billingAddr)  : null,
      items,
      subtotal:          String(subtotal),
      promotionDiscount: String(promotionDiscount),
      shippingCost:      String(shippingCost),
      tax:               String(tax),
      grandTotal:        String(grandTotal),
      currencyCode:      cart.currencyCode,
      snapshotAt:        new Date().toISOString(),
    };
  }

  private resolveShippingCost(methodId: string, subtotalAfterPromo: number): number {
    const threshold = this.configSvc.get<number>('CHECKOUT_FREE_SHIPPING_THRESHOLD', 999);
    const baseCost  = SHIPPING_BASE_COSTS[methodId] ?? 99;
    const isFree    = methodId === 'standard' && subtotalAfterPromo >= threshold;
    return isFree ? 0 : baseCost;
  }

  // ─── Step 4: Inventory commit ──────────────────────────────────────────────

  private async commitInventory(tx: PaymentTransaction, storeId: string): Promise<void> {
    const reservation = await this.prisma.inventoryReservation.findUnique({
      where:   { paymentTransactionId: tx.id },
      include: { items: true },
    });

    if (!reservation) {
      this.logger.warn(`No inventory reservation for payment ${tx.id} — skipping commit`);
      return;
    }

    if (reservation.status === InventoryReservationStatus.COMMITTED) {
      this.logger.log(`Inventory already committed for payment ${tx.id}`);
      return;
    }

    if (reservation.status !== InventoryReservationStatus.RESERVED) {
      this.logger.warn(
        `Reservation ${reservation.id} is ${reservation.status} — cannot commit; proceeding anyway`,
      );
      return;
    }

    await this.prisma.$transaction(async (txClient) => {
      // Optimistic lock on RESERVED status — prevents duplicate commit under concurrency
      const result = await txClient.inventoryReservation.updateMany({
        where: { id: reservation.id, status: InventoryReservationStatus.RESERVED },
        data:  { status: InventoryReservationStatus.COMMITTED, releasedAt: new Date() },
      });
      if (result.count === 0) return; // Concurrent call already committed — idempotent

      // RESERVED → COMMITTED: release the soft-lock, deduct from onHand, increment committed
      // P1-3: lower-bound guards prevent onHand / reserved from going negative
      for (const item of reservation.items) {
        const updated = await txClient.inventoryLevel.updateMany({
          where: {
            storeId,
            productId: item.productId,
            variantId: item.variantId ?? null,
            onHand:    { gte: item.quantity },
            reserved:  { gte: item.quantity },
          },
          data: {
            onHand:    { decrement: item.quantity },
            reserved:  { decrement: item.quantity },
            committed: { increment: item.quantity },
          },
        });
        if (updated.count === 0) {
          this.logger.error(
            `Inventory lower-bound guard prevented decrement for product ${item.productId} ` +
            `(qty ${item.quantity}) — inventory accounting may be inconsistent for payment ${tx.id}`,
          );
        }
      }
    });
  }

  // ─── Step 5: Order creation ────────────────────────────────────────────────

  private async createOrderWithIdempotency(
    tx:       PaymentTransaction,
    snapshot: OrchestratorCheckoutSnapshot,
    storeId:  string,
  ): Promise<{ id: string; orderNumber: string }> {
    // P0-1: idempotencyRecord.create is now the FIRST operation inside createOrder's $transaction.
    // If createOrder's $transaction fails for any reason, the idempotency record rolls back with it,
    // so the next retry can re-enter without hitting a permanent ConflictException.
    try {
      return await this.createOrder(tx, snapshot, storeId);
    } catch (err) {
      if (err instanceof PrismaClientKnownRequestError && err.code === 'P2002') {
        // idempotencyRecord.create inside the $transaction hit a unique constraint —
        // a concurrent call already committed the record (and thus the whole transaction).
        const freshTx = await this.prisma.paymentTransaction.findFirst({
          where: { id: tx.id, storeId },
        });
        if (freshTx?.orderId) {
          // P1-1: scope order lookup to storeId
          const order = await this.prisma.order.findFirst({
            where:  { id: freshTx.orderId, storeId },
            select: { id: true, orderNumber: true },
          });
          if (order) return order;
        }
        throw new ConflictException(
          `Concurrent order creation attempt for payment ${tx.id} — retry shortly`,
        );
      }
      throw err;
    }
  }

  private async createOrder(
    tx:       PaymentTransaction,
    snapshot: OrchestratorCheckoutSnapshot,
    storeId:  string,
  ): Promise<{ id: string; orderNumber: string }> {
    const idemKey = `orchestrator:order:${tx.id}`;
    const now  = new Date();
    const year = now.getFullYear();

    return this.prisma.$transaction(async (txClient) => {
      // P0-1: idempotency gate is the FIRST operation inside the transaction.
      // If anything below fails and the transaction rolls back, this row rolls back too —
      // so the next retry can re-enter without hitting a permanent P2002.
      await txClient.idempotencyRecord.create({
        data: {
          key:       idemKey,
          storeId,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      // Atomic counter increment — race-safe within transaction
      await txClient.storeOrderCounter.upsert({
        where:  { storeId_year: { storeId, year } },
        create: { storeId, year, counter: 1 },
        update: { counter: { increment: 1 } },
      });
      const counter = await txClient.storeOrderCounter.findUnique({
        where: { storeId_year: { storeId, year } },
      });
      const orderNumber = `ORD-${year}-${String(counter!.counter).padStart(6, '0')}`;

      // Create immutable Order record from snapshot (never from live product data)
      const order = await txClient.order.create({
        data: {
          storeId,
          customerId:          snapshot.customerId ?? undefined,
          orderNumber,
          status:              OrderStatus.PENDING,
          paymentStatus:       PaymentStatus.PAID,
          paymentMethod:       tx.gatewayCode,
          paymentGatewayCode:  tx.gatewayCode,
          subtotal:            new Prisma.Decimal(snapshot.subtotal),
          discount:            new Prisma.Decimal(snapshot.promotionDiscount),
          tax:                 new Prisma.Decimal(snapshot.tax),
          shippingCost:        new Prisma.Decimal(snapshot.shippingCost),
          total:               new Prisma.Decimal(snapshot.grandTotal),
          shippingAddress:     snapshot.shippingAddress
            ? JSON.stringify(snapshot.shippingAddress)
            : null,
          billingAddress:      snapshot.billingAddress
            ? JSON.stringify(snapshot.billingAddress)
            : null,
          couponCode:          snapshot.couponCode,
          checkoutSessionId:   snapshot.checkoutSessionId,
          paymentTransactionId: tx.id,
          confirmedAt:         now,
        },
        select: { id: true, orderNumber: true },
      });

      // Create OrderItems from snapshot — prices frozen at checkout time
      if (snapshot.items.length > 0) {
        await txClient.orderItem.createMany({
          data: snapshot.items.map((item) => ({
            orderId:     order.id,
            productId:   item.productId,
            variantId:   item.variantId ?? undefined,
            productName: item.name,
            sku:         item.sku,
            quantity:    item.quantity,
            unitPrice:   new Prisma.Decimal(item.unitPrice),
            total:       new Prisma.Decimal(item.lineTotal),
            brandName:   item.brand ?? undefined,
            thumbnail:   item.thumbnail,
            variantOptions: item.variantOptions as Prisma.InputJsonValue | undefined,
            comparePrice:   item.comparePrice != null
              ? new Prisma.Decimal(item.comparePrice)
              : undefined,
            lineDiscount: new Prisma.Decimal(item.lineDiscount),
            taxClass:     item.taxCategory ?? undefined,
            hsn:          item.hsn ?? undefined,
          })),
        });
      }

      // Initial order status history entry
      await txClient.orderStatusHistory.create({
        data: { orderId: order.id, status: OrderStatus.PENDING },
      });

      // Persist immutable order snapshot (payload = the full checkout snapshot)
      await txClient.orderSnapshot.create({
        data: {
          orderId:  order.id,
          storeId,
          payload:  snapshot as unknown as Prisma.InputJsonValue,
        },
      });

      // Link order back to payment transaction (single UPDATE — last step)
      await txClient.paymentTransaction.update({
        where: { id: tx.id },
        data:  { orderId: order.id },
      });

      return order;
    });
  }

  // ─── Step 6: Complete checkout + cart + outbox ─────────────────────────────

  private async completeCheckoutAndEmitEvents(
    tx:      PaymentTransaction,
    order:   { id: string; orderNumber: string },
    storeId: string,
  ): Promise<void> {
    const now = new Date();

    await this.prisma.$transaction(async (txClient) => {
      // Complete CheckoutSession (idempotent — skip if already COMPLETED)
      await txClient.checkoutSession.updateMany({
        where: {
          id:     tx.checkoutSessionId,
          storeId,
          status: { not: CheckoutStatus.COMPLETED },
        },
        data: { status: CheckoutStatus.COMPLETED, completedAt: now },
      });

      // Convert Cart (idempotent — skip if already CONVERTED)
      const checkout = await txClient.checkoutSession.findUnique({
        where:  { id: tx.checkoutSessionId },
        select: { cartId: true },
      });
      if (checkout) {
        await txClient.cart.updateMany({
          where: {
            id:      checkout.cartId,
            storeId,
            status:  { not: CartStatus.CONVERTED },
          },
          data: { status: CartStatus.CONVERTED, convertedAt: now },
        });
      }

      // Persist 4 required outbox events (idempotent — skip each if already present)
      const outboxDefs = [
        {
          eventType:     'ORDER_CREATED',
          aggregateId:   order.id,
          aggregateType: 'Order',
          payload: {
            orderId:              order.id,
            orderNumber:          order.orderNumber,
            paymentTransactionId: tx.id,
            storeId,
          },
        },
        {
          eventType:     'PAYMENT_CAPTURED',
          aggregateId:   tx.id,
          aggregateType: 'PaymentTransaction',
          payload: {
            paymentTransactionId: tx.id,
            orderId:              order.id,
            amountInPaise:        tx.amountInPaise,
            storeId,
          },
        },
        {
          eventType:     'CHECKOUT_COMPLETED',
          aggregateId:   tx.checkoutSessionId,
          aggregateType: 'CheckoutSession',
          payload: {
            checkoutSessionId: tx.checkoutSessionId,
            orderId:           order.id,
            storeId,
          },
        },
        {
          eventType:     'INVENTORY_COMMITTED',
          aggregateId:   tx.id,
          aggregateType: 'PaymentTransaction',
          payload: {
            paymentTransactionId: tx.id,
            orderId:              order.id,
            storeId,
          },
        },
      ];

      for (const ev of outboxDefs) {
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
    });
  }
}
