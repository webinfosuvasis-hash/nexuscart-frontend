import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';

// Swagger-only response shapes. Everything here is derived from
// OrdersService.findOne() (unmodified — already returns Order + statusHistory
// + refunds) plus OrderCancellationService.cancelOrder()'s own result (also
// unmodified). No cancellation/refund business logic is duplicated here.

export class CustomerCancellationTimelineEntryDto {
  @ApiProperty() id: string;
  @ApiProperty({ enum: OrderStatus }) status: OrderStatus;
  @ApiPropertyOptional({ nullable: true, type: String }) note: string | null;
  @ApiProperty() createdAt: string;
}

export class CustomerCancellationStatusDto {
  @ApiProperty() orderId: string;
  @ApiProperty() orderNumber: string;
  @ApiProperty({ enum: OrderStatus }) orderStatus: OrderStatus;
  @ApiProperty({ description: 'True only while the order is still PENDING or PROCESSING' })
  canCancel: boolean;
  @ApiProperty() isCancelled: boolean;
  @ApiPropertyOptional({ nullable: true, type: String }) cancelledAt: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) cancellationReason: string | null;
  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description: 'What happened to the payment as part of this cancellation call. Only present immediately after a successful POST /cancel — omitted on the plain GET status view.',
  })
  paymentAction?: string | null;
  @ApiProperty({
    type: [CustomerCancellationTimelineEntryDto],
    description: 'The order\'s real OrderStatusHistory, verbatim — never computed/fabricated on the frontend.',
  })
  timeline: CustomerCancellationTimelineEntryDto[];
}

export class CustomerRefundDto {
  @ApiProperty() amount: number;
  @ApiProperty({ description: 'PENDING (e.g. COD out-of-band refund) or COMPLETED' }) status: string;
  @ApiPropertyOptional({ nullable: true, type: String }) reason: string | null;
  @ApiPropertyOptional({ nullable: true, type: String, description: 'Gateway refund transaction id, if the gateway issued one' })
  gatewayRefundId: string | null;
  @ApiProperty() createdAt: string;
}

export class CustomerRefundStatusDto {
  @ApiProperty() orderId: string;
  @ApiProperty() orderNumber: string;
  @ApiProperty() hasRefund: boolean;
  @ApiPropertyOptional({ nullable: true, type: CustomerRefundDto }) refund: CustomerRefundDto | null;
}
