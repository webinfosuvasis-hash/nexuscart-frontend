import { Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma, PaymentStatus } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { OrdersService } from '@/modules/orders/orders.service';
import { PaymentService } from '@/modules/payment/payment.service';
import { ListCustomerOrdersDto, CustomerOrderStatusFilter } from './dto/list-customer-orders.dto';
import {
  CustomerOrderAddressDto, CustomerOrderDetailResponseDto, CustomerOrderListResponseDto, CustomerOrderTransactionDto,
} from './dto/customer-order-response.dto';

function parseAddress(raw: string | null): CustomerOrderAddressDto | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CustomerOrderAddressDto;
  } catch {
    // A malformed/legacy snapshot should never 500 the whole order-details
    // response — the rest of the order is still perfectly renderable.
    return null;
  }
}

/**
 * Customer Self-Service Phase 5 — read-only orchestration over OrdersService
 * and PaymentService (both unmodified). No order/payment business logic is
 * duplicated here: this class only adds the customer-facing ownership
 * boundary (OrdersService.findOne itself only ever scopes by storeId, same
 * as CheckoutService before it) and reshapes results into a customer-safe
 * projection — OrderNote (staff-internal) is never included.
 */
@Injectable()
export class CustomerOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
    private readonly paymentService: PaymentService,
  ) {}

  async listOrders(
    customerId: string,
    storeId: string,
    query: ListCustomerOrdersDto,
  ): Promise<CustomerOrderListResponseDto> {
    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 50);
    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'desc';

    const where: Prisma.OrderWhereInput = { storeId, customerId };
    if (query.status === CustomerOrderStatusFilter.PAID) {
      where.paymentStatus = PaymentStatus.PAID;
    } else if (query.status) {
      where.status = query.status as unknown as OrderStatus;
    }
    if (query.search) {
      where.orderNumber = { contains: query.search };
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          items: { take: 1, orderBy: { id: 'asc' }, select: { thumbnail: true } },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      items: orders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        total: Number(order.total),
        itemCount: order._count.items,
        thumbnail: order.items[0]?.thumbnail ?? null,
        createdAt: order.createdAt.toISOString(),
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getOrderDetails(
    orderId: string,
    customerId: string,
    storeId: string,
  ): Promise<CustomerOrderDetailResponseDto> {
    // Reuses OrdersService.findOne exactly as-is — it already eager-loads
    // items/statusHistory/shipments/refunds. Scoped by storeId only (same as
    // the merchant-facing caller), so the customerId check below is this
    // module's own addition, not something findOne does for us.
    const order = await this.ordersService.findOne(storeId, orderId);
    if (order.customerId !== customerId) {
      throw new NotFoundException('Order not found');
    }

    const transaction = await this.loadTransaction(order.paymentTransactionId, storeId);

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      createdAt: order.createdAt.toISOString(),
      confirmedAt: order.confirmedAt?.toISOString() ?? null,
      cancelledAt: order.cancelledAt?.toISOString() ?? null,
      cancellationReason: order.cancellationReason ?? null,
      items: order.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        variantId: item.variantId,
        productName: item.productName,
        variantName: item.variantName,
        sku: item.sku,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        total: Number(item.total),
        thumbnail: item.thumbnail,
        variantOptions: (item.variantOptions as Record<string, string> | null) ?? null,
        comparePrice: item.comparePrice != null ? Number(item.comparePrice) : null,
        lineDiscount: Number(item.lineDiscount),
        taxAmount: Number(item.taxAmount),
      })),
      totals: {
        subtotal: Number(order.subtotal),
        discount: Number(order.discount),
        tax: Number(order.tax),
        shippingCost: Number(order.shippingCost),
        total: Number(order.total),
        refundedAmount: Number(order.refundedAmount),
        couponCode: order.couponCode,
      },
      shippingAddress: parseAddress(order.shippingAddress),
      billingAddress: parseAddress(order.billingAddress),
      statusHistory: order.statusHistory.map((entry) => ({
        id: entry.id,
        status: entry.status,
        note: entry.note,
        createdAt: entry.createdAt.toISOString(),
      })),
      transaction,
      paymentMethod: order.paymentMethod,
      shipments: order.shipments.map((shipment) => ({
        id: shipment.id,
        trackingNumber: shipment.trackingNumber,
        carrier: shipment.carrier,
        // Not persisted anywhere retrievable — see CustomerOrderShipmentDto.
        carrierUrl: null,
        status: shipment.status,
        shippedAt: shipment.shippedAt?.toISOString() ?? null,
        deliveredAt: shipment.deliveredAt?.toISOString() ?? null,
        expectedDelivery: null,
      })),
    };
  }

  private async loadTransaction(
    paymentTransactionId: string | null,
    storeId: string,
  ): Promise<CustomerOrderTransactionDto | null> {
    if (!paymentTransactionId) return null;
    try {
      const tx = await this.paymentService.getPayment(paymentTransactionId, storeId);
      return {
        id: tx.id,
        gatewayCode: tx.gatewayCode,
        status: tx.status,
        amountInPaise: tx.amountInPaise,
        currency: tx.currency,
        gatewayPaymentId: tx.gatewayPaymentId,
        capturedAt: tx.capturedAt?.toISOString() ?? null,
      };
    } catch {
      // A dangling paymentTransactionId (e.g. pointing at a different store
      // due to a data anomaly) should never 500 the whole order — the order
      // itself still has its own paymentStatus/paymentMethod fields.
      return null;
    }
  }
}
