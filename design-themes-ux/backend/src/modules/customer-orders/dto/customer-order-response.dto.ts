import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus, PaymentStatus } from '@prisma/client';

// Swagger-only response shapes. Everything here is derived from Order/
// OrderItem/OrderStatusHistory/Shipment (via OrdersService, unmodified) plus
// PaymentTransaction (via PaymentService, unmodified) — no new business
// logic, just a customer-safe projection (never OrderNote, which is
// staff-internal).

export class CustomerOrderListItemDto {
  @ApiProperty() id: string;
  @ApiProperty() orderNumber: string;
  @ApiProperty({ enum: OrderStatus }) status: OrderStatus;
  @ApiProperty({ enum: PaymentStatus }) paymentStatus: PaymentStatus;
  @ApiProperty() total: number;
  @ApiProperty() itemCount: number;
  @ApiPropertyOptional({ nullable: true, type: String }) thumbnail: string | null;
  @ApiProperty() createdAt: string;
}

export class CustomerOrderListResponseDto {
  @ApiProperty({ type: [CustomerOrderListItemDto] }) items: CustomerOrderListItemDto[];
  @ApiProperty() pagination: { page: number; limit: number; total: number; totalPages: number };
}

export class CustomerOrderAddressDto {
  @ApiProperty() firstName: string;
  @ApiProperty() lastName: string;
  @ApiProperty() line1: string;
  @ApiPropertyOptional({ nullable: true, type: String }) line2: string | null;
  @ApiProperty() city: string;
  @ApiProperty() state: string;
  @ApiProperty() postalCode: string;
  @ApiProperty() country: string;
  @ApiPropertyOptional({ nullable: true, type: String }) phone: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) email: string | null;
}

export class CustomerOrderItemDto {
  @ApiProperty() id: string;
  @ApiProperty() productId: string;
  @ApiPropertyOptional({ nullable: true, type: String }) variantId: string | null;
  @ApiProperty() productName: string;
  @ApiPropertyOptional({ nullable: true, type: String }) variantName: string | null;
  @ApiProperty() sku: string;
  @ApiProperty() quantity: number;
  @ApiProperty() unitPrice: number;
  @ApiProperty() total: number;
  @ApiPropertyOptional({ nullable: true, type: String }) thumbnail: string | null;
  @ApiPropertyOptional({ nullable: true, type: Object }) variantOptions: Record<string, string> | null;
  @ApiPropertyOptional({ nullable: true, type: Number }) comparePrice: number | null;
  @ApiProperty() lineDiscount: number;
  @ApiProperty() taxAmount: number;
}

export class CustomerOrderTransactionDto {
  @ApiProperty() id: string;
  @ApiProperty() gatewayCode: string;
  @ApiProperty() status: string;
  @ApiProperty() amountInPaise: number;
  @ApiProperty() currency: string;
  @ApiPropertyOptional({ nullable: true, type: String }) gatewayPaymentId: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) capturedAt: string | null;
}

export class CustomerOrderShipmentDto {
  @ApiProperty() id: string;
  @ApiPropertyOptional({ nullable: true, type: String }) trackingNumber: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) carrier: string | null;
  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description: 'Not persisted on the Shipment model today (only travels transiently through the outbox event payload for notifications) — always null until a schema migration adds the column.',
  })
  carrierUrl: string | null;
  @ApiProperty() status: string;
  @ApiPropertyOptional({ nullable: true, type: String }) shippedAt: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) deliveredAt: string | null;
  @ApiPropertyOptional({ nullable: true, type: String, description: 'Not tracked anywhere in the current schema — always null.' })
  expectedDelivery: string | null;
}

export class CustomerOrderStatusHistoryEntryDto {
  @ApiProperty() id: string;
  @ApiProperty({ enum: OrderStatus }) status: OrderStatus;
  @ApiPropertyOptional({ nullable: true, type: String }) note: string | null;
  @ApiProperty() createdAt: string;
}

export class CustomerOrderTotalsDto {
  @ApiProperty() subtotal: number;
  @ApiProperty() discount: number;
  @ApiProperty() tax: number;
  @ApiProperty() shippingCost: number;
  @ApiProperty() total: number;
  @ApiProperty() refundedAmount: number;
  @ApiPropertyOptional({ nullable: true, type: String }) couponCode: string | null;
}

export class CustomerOrderDetailResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() orderNumber: string;
  @ApiProperty({ enum: OrderStatus }) status: OrderStatus;
  @ApiProperty({ enum: PaymentStatus }) paymentStatus: PaymentStatus;
  @ApiProperty() createdAt: string;
  @ApiPropertyOptional({ nullable: true, type: String }) confirmedAt: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) cancelledAt: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) cancellationReason: string | null;
  @ApiProperty({ type: [CustomerOrderItemDto] }) items: CustomerOrderItemDto[];
  @ApiProperty() totals: CustomerOrderTotalsDto;
  @ApiPropertyOptional({ nullable: true, type: CustomerOrderAddressDto }) shippingAddress: CustomerOrderAddressDto | null;
  @ApiPropertyOptional({ nullable: true, type: CustomerOrderAddressDto }) billingAddress: CustomerOrderAddressDto | null;
  @ApiProperty({ type: [CustomerOrderStatusHistoryEntryDto] }) statusHistory: CustomerOrderStatusHistoryEntryDto[];
  @ApiPropertyOptional({ nullable: true, type: CustomerOrderTransactionDto }) transaction: CustomerOrderTransactionDto | null;
  @ApiPropertyOptional({ nullable: true, type: String }) paymentMethod: string | null;
  @ApiProperty({ type: [CustomerOrderShipmentDto] }) shipments: CustomerOrderShipmentDto[];
}
