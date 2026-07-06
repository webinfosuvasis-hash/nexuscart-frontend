import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';

// Swagger-only response shapes. Everything here is derived from
// OrdersService.findOne() (unmodified — already returns Order + shipments +
// statusHistory) plus a supplementary ShipmentItem lookup this module adds
// itself. No fulfillment business logic is duplicated.

export class CustomerShipmentItemDto {
  @ApiProperty() productId: string;
  @ApiPropertyOptional({ nullable: true, type: String }) variantId: string | null;
  @ApiPropertyOptional({ nullable: true, type: String, description: 'null if no matching OrderItem was found (data anomaly)' })
  productName: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) variantName: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) thumbnail: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) sku: string | null;
  @ApiProperty() quantity: number;
}

export class CustomerShipmentDto {
  @ApiProperty() id: string;
  @ApiProperty() status: string;
  @ApiPropertyOptional({ nullable: true, type: String }) trackingNumber: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) carrier: string | null;
  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description: 'Not persisted on the Shipment model today (only travels transiently through the outbox event payload for notifications) — always null until a schema migration adds the column.',
  })
  carrierUrl: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) shippedAt: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) deliveredAt: string | null;
  @ApiPropertyOptional({ nullable: true, type: String, description: 'Not tracked anywhere in the current schema — always null.' })
  expectedDelivery: string | null;
}

export class CustomerShipmentWithItemsDto extends CustomerShipmentDto {
  @ApiProperty({ type: [CustomerShipmentItemDto] }) items: CustomerShipmentItemDto[];
}

export class CustomerShipmentDetailResponseDto {
  @ApiProperty() orderId: string;
  @ApiProperty() orderNumber: string;
  @ApiProperty({ type: [CustomerShipmentWithItemsDto] }) shipments: CustomerShipmentWithItemsDto[];
}

export class CustomerOrderTimelineEntryDto {
  @ApiProperty() id: string;
  @ApiProperty({ enum: OrderStatus }) status: OrderStatus;
  @ApiPropertyOptional({ nullable: true, type: String }) note: string | null;
  @ApiProperty() createdAt: string;
}

export class CustomerTrackingResponseDto {
  @ApiProperty() orderId: string;
  @ApiProperty() orderNumber: string;
  @ApiProperty({ enum: OrderStatus }) orderStatus: OrderStatus;
  @ApiProperty({
    type: [CustomerOrderTimelineEntryDto],
    description: 'The order\'s real OrderStatusHistory, verbatim — never computed/fabricated on the frontend.',
  })
  timeline: CustomerOrderTimelineEntryDto[];
  @ApiProperty({ type: [CustomerShipmentDto] }) shipments: CustomerShipmentDto[];
}
