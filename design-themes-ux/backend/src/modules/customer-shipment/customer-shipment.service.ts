import { Injectable, NotFoundException } from '@nestjs/common';
import { Shipment } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { OrdersService } from '@/modules/orders/orders.service';
import {
  CustomerShipmentDetailResponseDto, CustomerShipmentDto, CustomerShipmentItemDto, CustomerTrackingResponseDto,
} from './dto/customer-shipment-response.dto';

function toShipmentDto(shipment: Shipment): CustomerShipmentDto {
  return {
    id: shipment.id,
    status: shipment.status,
    trackingNumber: shipment.trackingNumber,
    carrier: shipment.carrier,
    // Not persisted anywhere retrievable — see CustomerShipmentDto's Swagger doc.
    carrierUrl: null,
    shippedAt: shipment.shippedAt?.toISOString() ?? null,
    deliveredAt: shipment.deliveredAt?.toISOString() ?? null,
    expectedDelivery: null,
  };
}

/**
 * Customer Self-Service Phase 6 — read-only orchestration over OrdersService
 * (unmodified). FulfillmentService itself is write-only (createShipment/
 * updateShipment/markDelivered) — there is nothing to "reuse" from it for a
 * read-only tracking view; the Shipment/ShipmentItem/OrderStatusHistory rows
 * it already writes are what this module reads back, via OrdersService and
 * a small supplementary ShipmentItem lookup (no fulfillment business logic
 * — status transitions, locking, outbox events — is duplicated here).
 */
@Injectable()
export class CustomerShipmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
  ) {}

  async getShipmentDetails(orderId: string, customerId: string, storeId: string): Promise<CustomerShipmentDetailResponseDto> {
    const order = await this.loadOwnedOrder(orderId, customerId, storeId);

    const shipmentIds = order.shipments.map((s) => s.id);
    // OrdersService.findOne()'s `shipments: true` is a shallow include — it
    // does not eager-load each shipment's items, so this module fetches
    // them itself rather than asking OrdersService to change its contract.
    const shipmentItems = shipmentIds.length > 0
      ? await this.prisma.shipmentItem.findMany({ where: { shipmentId: { in: shipmentIds } } })
      : [];

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      shipments: order.shipments.map((shipment) => ({
        ...toShipmentDto(shipment),
        items: shipmentItems
          .filter((si) => si.shipmentId === shipment.id)
          .map((si): CustomerShipmentItemDto => {
            // ShipmentItem carries no product name/thumbnail of its own —
            // matched against the same order's OrderItem rows, which do.
            const orderItem = order.items.find(
              (oi) => oi.productId === si.productId && oi.variantId === si.variantId,
            );
            return {
              productId: si.productId,
              variantId: si.variantId,
              productName: orderItem?.productName ?? null,
              variantName: orderItem?.variantName ?? null,
              thumbnail: orderItem?.thumbnail ?? null,
              sku: orderItem?.sku ?? null,
              quantity: si.quantity,
            };
          }),
      })),
    };
  }

  async getTracking(orderId: string, customerId: string, storeId: string): Promise<CustomerTrackingResponseDto> {
    const order = await this.loadOwnedOrder(orderId, customerId, storeId);

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      orderStatus: order.status,
      // The order's real OrderStatusHistory, verbatim — same data Phase 5's
      // Order Details timeline renders, never recomputed here.
      timeline: order.statusHistory.map((entry) => ({
        id: entry.id,
        status: entry.status,
        note: entry.note,
        createdAt: entry.createdAt.toISOString(),
      })),
      shipments: order.shipments.map(toShipmentDto),
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
