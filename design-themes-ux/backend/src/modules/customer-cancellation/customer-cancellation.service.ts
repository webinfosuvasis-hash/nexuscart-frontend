import { Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { OrdersService } from '@/modules/orders/orders.service';
import { OrderCancellationService } from '@/modules/cancellation/order-cancellation.service';
import {
  CustomerCancellationStatusDto, CustomerCancellationTimelineEntryDto, CustomerRefundStatusDto,
} from './dto/customer-cancellation-response.dto';

const CANCELLABLE_STATUSES: OrderStatus[] = [OrderStatus.PENDING, OrderStatus.PROCESSING];

/**
 * Customer Self-Service Phase 7 — thin orchestration over OrderCancellationService
 * (unmodified) and OrdersService (unmodified). All cancellation eligibility rules,
 * payment cancel/refund branching, inventory release, and outbox events live in
 * OrderCancellationService.cancelOrder() exactly as they do for the staff-facing
 * caller — this module only adds the customer-facing ownership boundary
 * (OrdersService.findOne only ever scopes by storeId, same precedent as every
 * other customer-* module) and reshapes results into a customer-safe projection.
 */
@Injectable()
export class CustomerCancellationService {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly cancellationSvc: OrderCancellationService,
  ) {}

  async requestCancellation(
    orderId: string,
    customerId: string,
    storeId: string,
    reason: string,
  ): Promise<CustomerCancellationStatusDto> {
    // Ownership check happens BEFORE calling into OrderCancellationService —
    // cancelOrder() itself only scopes by storeId, so this is the only thing
    // standing between a customer and cancelling someone else's order in the
    // same store.
    await this.loadOwnedOrder(orderId, customerId, storeId);

    const result = await this.cancellationSvc.cancelOrder({
      orderId,
      storeId,
      reason,
      actorId: customerId,
      // Deterministic per-order key — cancelOrder() itself is idempotent via
      // optimistic locking on order.status, so this only needs to be stable
      // across a single customer's retries of the same cancel request.
      idempotencyKey: `customer-cancel:${orderId}`,
    });

    // cancelOrder()'s own return is a bare Order (no statusHistory include) —
    // re-read via OrdersService for a response shaped the same as the GET view.
    const refreshed = await this.ordersService.findOne(storeId, orderId);
    return this.toStatusDto(refreshed, result.paymentAction, refreshed.statusHistory);
  }

  async getCancellationStatus(
    orderId: string,
    customerId: string,
    storeId: string,
  ): Promise<CustomerCancellationStatusDto> {
    const order = await this.loadOwnedOrder(orderId, customerId, storeId);
    return this.toStatusDto(order, undefined, order.statusHistory);
  }

  async getRefundStatus(
    orderId: string,
    customerId: string,
    storeId: string,
  ): Promise<CustomerRefundStatusDto> {
    const order = await this.loadOwnedOrder(orderId, customerId, storeId);

    const latestRefund = [...order.refunds].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    )[0] ?? null;

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      hasRefund: latestRefund !== null,
      refund: latestRefund && {
        amount: Number(latestRefund.amount),
        status: latestRefund.status,
        reason: latestRefund.reason ?? null,
        gatewayRefundId: latestRefund.gatewayRefundId ?? null,
        createdAt: latestRefund.createdAt.toISOString(),
      },
    };
  }

  private toStatusDto(
    order: {
      id: string; orderNumber: string; status: OrderStatus;
      cancelledAt?: Date | null; cancellationReason?: string | null;
    },
    paymentAction: string | undefined,
    statusHistory?: Array<{ id: string; status: OrderStatus; note: string | null; createdAt: Date }>,
  ): CustomerCancellationStatusDto {
    const timeline: CustomerCancellationTimelineEntryDto[] = (statusHistory ?? []).map((entry) => ({
      id: entry.id,
      status: entry.status,
      note: entry.note,
      createdAt: entry.createdAt.toISOString(),
    }));

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      orderStatus: order.status,
      canCancel: CANCELLABLE_STATUSES.includes(order.status),
      isCancelled: order.status === OrderStatus.CANCELLED,
      cancelledAt: order.cancelledAt?.toISOString() ?? null,
      cancellationReason: order.cancellationReason ?? null,
      ...(paymentAction !== undefined ? { paymentAction } : {}),
      timeline,
    };
  }

  /** Reuses OrdersService.findOne exactly as-is; the customerId check is this module's own addition (findOne only ever scopes by storeId). */
  private async loadOwnedOrder(orderId: string, customerId: string, storeId: string) {
    const order = await this.ordersService.findOne(storeId, orderId);
    if (order.customerId !== customerId) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }
}
