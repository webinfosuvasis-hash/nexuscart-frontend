import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { OrderStatus, PaymentStatus } from '@prisma/client';
import type { OrderItem } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService }       from '@/prisma/prisma.service';
import { OutboxHelperService } from '@/shared/outbox/outbox-helper.service';
import { CacheService }        from '@/shared/cache/cache.service';
import {
  SHIPMENT_STATUS,
  type CreateShipmentInput,
  type MarkDeliveredInput,
  type ShipmentItemInput,
  type ShipmentWithItems,
  type UpdateShipmentInput,
} from './types/fulfillment.types';

// Order statuses that permit shipment creation (payment captured or COD pending)
const SHIPPABLE_STATUSES = [OrderStatus.PENDING, OrderStatus.PROCESSING] as const;

@Injectable()
export class FulfillmentService {
  private readonly logger = new Logger(FulfillmentService.name);

  constructor(
    private readonly prisma:       PrismaService,
    private readonly outboxHelper: OutboxHelperService,
    private readonly cache:        CacheService,
  ) {}

  // ---------------------------------------------------------------------------
  // createShipment — M9 Steps 0–5
  // ---------------------------------------------------------------------------

  async createShipment(input: CreateShipmentInput): Promise<ShipmentWithItems> {
    const {
      orderId, storeId, actorId,
      trackingNumber, carrier, carrierUrl,
      note, items: itemsInput,
    } = input;

    // ── Step 0: Acquire distributed lock ─────────────────────────────────────
    // Shared among createShipment / updateShipment / markDelivered — serialises
    // all FulfillmentService mutations on the same order.
    // OrderCancellationService and PaymentRecoveryService rely on the DB-level
    // optimistic lock (order.updateMany WHERE status) and do NOT acquire this key.
    const lockKey   = `order-lock:${orderId}`;
    const lockToken = uuidv4();

    const acquired = await this.cache.acquireLock(lockKey, lockToken, 30_000, 30, 200);
    if (!acquired) {
      throw new ServiceUnavailableException(
        `Order ${orderId} is currently being processed — please retry shortly`,
      );
    }

    try {

      // ── Step 1: Load and validate order ──────────────────────────────────
      const order = await this.prisma.order.findFirst({
        where:   { id: orderId, storeId },
        include: { items: true },
      });

      if (!order) {
        throw new NotFoundException(`Order ${orderId} not found`);
      }

      if (order.status === OrderStatus.CANCELLED) {
        throw new ConflictException(`Order ${orderId} is cancelled and cannot be shipped`);
      }
      if (order.status === OrderStatus.DELIVERED) {
        throw new ConflictException(`Order ${orderId} is already delivered`);
      }
      if (order.status === OrderStatus.SHIPPED) {
        // Idempotent path: a prior call already created the shipment.
        // Return the existing record so callers can retry safely.
        return this.findExistingShipment(orderId);
      }
      if (!(SHIPPABLE_STATUSES as readonly OrderStatus[]).includes(order.status)) {
        throw new ConflictException(
          `Order ${orderId} cannot be shipped: status is ${order.status}`,
        );
      }

      // Capture status now; the optimistic lock inside the transaction verifies
      // it has not changed by the time we commit.
      const lockedStatus = order.status;

      // ── Step 2: Validate shipment items ──────────────────────────────────
      // If caller specifies items: validate against order, check quantities & dupes.
      // If no items specified: include all order line items in the shipment.
      const shipItemsData = itemsInput?.length
        ? this.validateAndBuildShipmentItems(itemsInput, order.items, orderId)
        : order.items.map(oi => ({
            orderId,
            productId: oi.productId,
            variantId: oi.variantId ?? null,
            quantity:  oi.quantity,
          }));

      // ── Steps 3 + 4: Single atomic transaction ────────────────────────────
      const txResult = await this.prisma.$transaction(async (txClient) => {

        // Optimistic lock: only the caller that captured lockedStatus wins.
        // updateMany counts rows matched; count=0 means a concurrent operation
        // already transitioned the order away from lockedStatus.
        const lockResult = await txClient.order.updateMany({
          where: { id: orderId, status: lockedStatus },
          data:  { status: OrderStatus.SHIPPED },
        });

        if (lockResult.count === 0) {
          const freshOrder = await txClient.order.findFirst({ where: { id: orderId, storeId } });
          if (freshOrder?.status === OrderStatus.SHIPPED) {
            // A concurrent createShipment call just won the race.
            // Signal idempotent resolution to the outer scope.
            return { idempotent: true as const };
          }
          throw new ConflictException(
            `Order ${orderId} was concurrently modified ` +
            `(expected ${lockedStatus}, found ${freshOrder?.status ?? 'missing'})`,
          );
        }

        // Record the status transition
        await txClient.orderStatusHistory.create({
          data: {
            orderId,
            status: OrderStatus.SHIPPED,
            note:   note ?? 'Shipment created',
          },
        });

        // Create the Shipment record and its line items in one nested write
        const shipment = await txClient.shipment.create({
          data: {
            orderId,
            trackingNumber: trackingNumber ?? null,
            carrier:        carrier ?? null,
            status:         SHIPMENT_STATUS.SHIPPED,
            shippedAt:      new Date(),
            items:          { create: shipItemsData },
          },
          include: { items: true },
        });

        // Step 4: Write outbox events — carrierUrl goes in the payload so the
        // notifications module can include it in shipping emails without needing
        // a dedicated Shipment column (that column is added in a later migration).
        await this.outboxHelper.upsertOutboxEvent(txClient, storeId, {
          eventType:     'SHIPMENT_CREATED',
          aggregateId:   shipment.id,
          aggregateType: 'Shipment',
          payload: {
            shipmentId:     shipment.id,
            orderId,
            storeId,
            actorId,
            trackingNumber: trackingNumber ?? null,
            carrier:        carrier ?? null,
            carrierUrl:     carrierUrl ?? null,
          },
        });

        await this.outboxHelper.upsertOutboxEvent(txClient, storeId, {
          eventType:     'ORDER_SHIPPED',
          aggregateId:   orderId,
          aggregateType: 'Order',
          payload:       { orderId, storeId, shipmentId: shipment.id, actorId },
        });

        return { idempotent: false as const, shipment };
      });

      // ── Step 5: Return ────────────────────────────────────────────────────
      if (txResult.idempotent) {
        return this.findExistingShipment(orderId);
      }

      return txResult.shipment;

    } finally {
      // releaseLock MUST run even on exception; its own error must never
      // propagate — the 30-second TTL guarantees automatic cleanup on failure.
      try {
        await this.cache.releaseLock(lockKey, lockToken);
      } catch (err) {
        this.logger.warn(`releaseLock failed for order-lock:${orderId}: ${err}`);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // updateShipment — M9 Steps 0–5
  // ---------------------------------------------------------------------------

  async updateShipment(input: UpdateShipmentInput): Promise<ShipmentWithItems> {
    const { shipmentId, orderId, storeId, trackingNumber, carrier, carrierUrl, note } = input;

    // ── Step 0: Acquire distributed lock ─────────────────────────────────────
    // Shared among createShipment / updateShipment / markDelivered.
    // See createShipment for lock protocol notes.
    const lockKey   = `order-lock:${orderId}`;
    const lockToken = uuidv4();

    const acquired = await this.cache.acquireLock(lockKey, lockToken, 30_000, 30, 200);
    if (!acquired) {
      throw new ServiceUnavailableException(
        `Order ${orderId} is currently being processed — please retry shortly`,
      );
    }

    try {

      // ── Step 1: Load and validate ─────────────────────────────────────────
      const order = await this.prisma.order.findFirst({
        where: { id: orderId, storeId },
      });

      if (!order) throw new NotFoundException(`Order ${orderId} not found`);

      if (order.status === OrderStatus.CANCELLED) {
        throw new ConflictException(`Order ${orderId} is cancelled`);
      }
      if (order.status === OrderStatus.DELIVERED) {
        throw new ConflictException(`Order ${orderId} is already delivered`);
      }
      if (order.status === OrderStatus.RETURNED) {
        throw new ConflictException(`Order ${orderId} has been returned`);
      }
      if (order.status === OrderStatus.REFUNDED) {
        throw new ConflictException(`Order ${orderId} has been refunded`);
      }

      const shipment = await this.prisma.shipment.findFirst({
        where:   { id: shipmentId, orderId },
        include: { items: true },
      });

      if (!shipment) {
        throw new NotFoundException(`Shipment ${shipmentId} not found for order ${orderId}`);
      }
      if (shipment.status === SHIPMENT_STATUS.DELIVERED) {
        throw new ConflictException(
          `Shipment ${shipmentId} is already delivered and cannot be modified`,
        );
      }

      // Capture status for optimistic lock inside the transaction
      const lockedStatus = shipment.status;

      // ── Step 2: Validate request ──────────────────────────────────────────
      const hasAnyField =
        trackingNumber !== undefined ||
        carrier        !== undefined ||
        carrierUrl     !== undefined ||
        note           !== undefined;

      if (!hasAnyField) {
        throw new BadRequestException('At least one field must be provided for update');
      }

      // Build the schema-level payload (only fields that have a DB column).
      // carrierUrl and note have no column yet — they travel via outbox payload.
      const schemaUpdate: { trackingNumber?: string; carrier?: string } = {};
      if (trackingNumber !== undefined) schemaUpdate.trackingNumber = trackingNumber;
      if (carrier        !== undefined) schemaUpdate.carrier         = carrier;
      const hasSchemaUpdate = Object.keys(schemaUpdate).length > 0;

      // ── Steps 3 + 4: Single atomic transaction ────────────────────────────
      await this.prisma.$transaction(async (txClient) => {

        if (hasSchemaUpdate) {
          // Optimistic lock on shipment status: only commits when the shipment
          // has not been concurrently transitioned to a different state.
          const lockResult = await txClient.shipment.updateMany({
            where: { id: shipmentId, orderId, status: lockedStatus },
            data:  schemaUpdate,
          });

          if (lockResult.count === 0) {
            const fresh = await txClient.shipment.findFirst({ where: { id: shipmentId } });
            if (!fresh) {
              throw new NotFoundException(`Shipment ${shipmentId} not found`);
            }
            throw new ConflictException(
              `Shipment ${shipmentId} was concurrently modified ` +
              `(expected ${lockedStatus}, found ${fresh.status})`,
            );
          }
        }
        // When only non-schema fields are provided (carrierUrl / note) the Redis
        // lock acquired in Step 0 already prevents concurrent state changes, so
        // no additional DB read is needed here.

        // SHIPMENT_UPDATED is a repeatable-update event — an operator may correct
        // tracking info multiple times. skipDedup bypasses the lifecycle dedup
        // check so every update generates an independent outbox event and
        // downstream notification.
        await this.outboxHelper.upsertOutboxEvent(txClient, storeId, {
          eventType:     'SHIPMENT_UPDATED',
          aggregateId:   shipmentId,
          aggregateType: 'Shipment',
          payload: {
            shipmentId,
            orderId,
            storeId,
            trackingNumber: trackingNumber ?? null,
            carrier:        carrier        ?? null,
            carrierUrl:     carrierUrl     ?? null,
            note:           note           ?? null,
          },
        }, { skipDedup: true });
      });

      // ── Step 5: Return updated shipment ───────────────────────────────────
      const updated = await this.prisma.shipment.findFirst({
        where:   { id: shipmentId, orderId },
        include: { items: true },
      });
      if (!updated) {
        throw new NotFoundException(`Shipment ${shipmentId} not found after update`);
      }
      return updated;

    } finally {
      try {
        await this.cache.releaseLock(lockKey, lockToken);
      } catch (err) {
        this.logger.warn(`releaseLock failed for order-lock:${orderId}: ${err}`);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // markDelivered — M9 Steps 0–5
  // ---------------------------------------------------------------------------

  async markDelivered(input: MarkDeliveredInput): Promise<ShipmentWithItems> {
    const { shipmentId, orderId, storeId, actorId, deliveredAt } = input;

    // ── Step 0: Acquire distributed lock ─────────────────────────────────────
    // Shared among createShipment / updateShipment / markDelivered.
    // See createShipment for lock protocol notes.
    const lockKey   = `order-lock:${orderId}`;
    const lockToken = uuidv4();

    const acquired = await this.cache.acquireLock(lockKey, lockToken, 30_000, 30, 200);
    if (!acquired) {
      throw new ServiceUnavailableException(
        `Order ${orderId} is currently being processed — please retry shortly`,
      );
    }

    try {

      // ── Step 1: Load and validate ─────────────────────────────────────────
      const order = await this.prisma.order.findFirst({
        where: { id: orderId, storeId },
      });

      if (!order) throw new NotFoundException(`Order ${orderId} not found`);

      if (order.status === OrderStatus.CANCELLED) {
        throw new ConflictException(`Order ${orderId} is cancelled`);
      }
      if (order.status === OrderStatus.DELIVERED) {
        // Idempotent: delivery was already recorded — return the existing shipment.
        return this.findExistingShipment(orderId);
      }
      if (order.status !== OrderStatus.SHIPPED) {
        throw new ConflictException(
          `Order ${orderId} cannot be marked delivered: status is ${order.status}`,
        );
      }

      // lockedStatus is always SHIPPED at this point (validated above)
      const lockedStatus = order.status;

      const shipment = await this.prisma.shipment.findFirst({
        where:   { id: shipmentId, orderId },
        include: { items: true },
      });

      if (!shipment) {
        throw new NotFoundException(`Shipment ${shipmentId} not found for order ${orderId}`);
      }
      if (shipment.status === SHIPMENT_STATUS.DELIVERED) {
        throw new ConflictException(`Shipment ${shipmentId} is already delivered`);
      }

      // ── Step 2: Validate ──────────────────────────────────────────────────
      // Caller may provide an exact timestamp; default to now if omitted.
      const effectiveDeliveredAt = deliveredAt ?? new Date();

      // ── Steps 3 + 4: Atomic transaction ──────────────────────────────────
      const txResult = await this.prisma.$transaction(async (txClient) => {

        // Optimistic lock on order: only the caller that reads SHIPPED can commit.
        const lockResult = await txClient.order.updateMany({
          where: { id: orderId, status: lockedStatus },
          data:  { status: OrderStatus.DELIVERED },
        });

        if (lockResult.count === 0) {
          const freshOrder = await txClient.order.findFirst({ where: { id: orderId, storeId } });
          if (freshOrder?.status === OrderStatus.DELIVERED) {
            // Another concurrent markDelivered just committed — idempotent signal.
            return { idempotent: true as const };
          }
          throw new ConflictException(
            `Order ${orderId} was concurrently modified ` +
            `(expected ${lockedStatus}, found ${freshOrder?.status ?? 'missing'})`,
          );
        }

        // Transition shipment to DELIVERED within the same transaction.
        // The order optimistic lock guarantees no concurrent state change,
        // so we update the shipment unconditionally.
        await txClient.shipment.update({
          where: { id: shipmentId },
          data:  { status: SHIPMENT_STATUS.DELIVERED, deliveredAt: effectiveDeliveredAt },
        });

        // Cash on delivery is collected at the door: delivered means paid.
        // No-op for prepaid orders (already PAID) and anything not PENDING.
        await txClient.order.updateMany({
          where: { id: orderId, paymentGatewayCode: 'cod', paymentStatus: PaymentStatus.PENDING },
          data:  { paymentStatus: PaymentStatus.PAID },
        });

        // Record the status transition
        await txClient.orderStatusHistory.create({
          data: {
            orderId,
            status: OrderStatus.DELIVERED,
            note:   `Shipment ${shipmentId} marked delivered`,
          },
        });

        // Outbox events — consumed by the future NotificationsModule (IM-7)
        await this.outboxHelper.upsertOutboxEvent(txClient, storeId, {
          eventType:     'SHIPMENT_DELIVERED',
          aggregateId:   shipmentId,
          aggregateType: 'Shipment',
          payload: {
            shipmentId,
            orderId,
            storeId,
            actorId,
            deliveredAt: effectiveDeliveredAt.toISOString(),
          },
        });

        await this.outboxHelper.upsertOutboxEvent(txClient, storeId, {
          eventType:     'ORDER_DELIVERED',
          aggregateId:   orderId,
          aggregateType: 'Order',
          payload:       { orderId, storeId, shipmentId, actorId },
        });

        return { idempotent: false as const };
      });

      // ── Step 5: Return ────────────────────────────────────────────────────
      if (txResult.idempotent) {
        return this.findExistingShipment(orderId);
      }

      const updated = await this.prisma.shipment.findFirst({
        where:   { id: shipmentId, orderId },
        include: { items: true },
      });
      if (!updated) {
        throw new NotFoundException(`Shipment ${shipmentId} not found after delivery`);
      }
      return updated;

    } finally {
      try {
        await this.cache.releaseLock(lockKey, lockToken);
      } catch (err) {
        this.logger.warn(`releaseLock failed for order-lock:${orderId}: ${err}`);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async findExistingShipment(orderId: string): Promise<ShipmentWithItems> {
    const shipment = await this.prisma.shipment.findFirst({
      where:   { orderId },
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    });
    if (!shipment) {
      this.logger.error(`Order ${orderId} has no shipment record — data inconsistency`);
      throw new ConflictException(`No shipment found for order ${orderId}`);
    }
    return shipment;
  }

  private validateAndBuildShipmentItems(
    inputItems: ShipmentItemInput[],
    orderItems: OrderItem[],
    orderId:    string,
  ): Array<{ orderId: string; productId: string; variantId: string | null; quantity: number }> {
    // Guard against duplicate productId+variantId pairs in the same request
    const seen = new Set<string>();
    for (const item of inputItems) {
      const key = `${item.productId}:${item.variantId ?? 'null'}`;
      if (seen.has(key)) {
        throw new BadRequestException(
          `Duplicate item in shipment request: ` +
          `productId=${item.productId} variantId=${item.variantId ?? null}`,
        );
      }
      seen.add(key);
    }

    return inputItems.map(item => {
      const orderItem = orderItems.find(
        oi =>
          oi.productId === item.productId &&
          (oi.variantId ?? null) === (item.variantId ?? null),
      );
      if (!orderItem) {
        throw new BadRequestException(
          `Item productId=${item.productId} variantId=${item.variantId ?? null} ` +
          `not found in order ${orderId}`,
        );
      }
      if (item.quantity > orderItem.quantity) {
        throw new BadRequestException(
          `Shipment quantity ${item.quantity} exceeds ordered quantity ` +
          `${orderItem.quantity} for productId=${item.productId}`,
        );
      }
      return {
        orderId,
        productId: item.productId,
        variantId: item.variantId ?? null,
        quantity:  item.quantity,
      };
    });
  }
}
