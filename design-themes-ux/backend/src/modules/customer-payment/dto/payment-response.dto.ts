import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentTxStatus } from '@prisma/client';

// Swagger-only response shapes. Deliberately narrower than the raw
// PaymentTransaction row — never exposes gatewaySignature, checkoutSnapshot,
// or gateway correlation ids the customer has no use for.

export class PaymentInitiationResponseDto {
  @ApiProperty()
  paymentId: string;

  @ApiProperty({ enum: PaymentTxStatus })
  status: PaymentTxStatus;

  @ApiProperty()
  gatewayCode: string;

  @ApiProperty()
  amountInPaise: number;

  @ApiProperty()
  currency: string;

  @ApiPropertyOptional({ description: 'Present for redirect-based gateways (e.g. Razorpay hosted checkout)' })
  redirectUrl?: string;

  @ApiPropertyOptional({ description: 'Present for intent-based gateways (e.g. Stripe)' })
  clientSecret?: string;

  @ApiPropertyOptional()
  gatewayOrderId?: string;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description: 'Set once order creation has completed — immediately for direct-capture gateways (COD/mock), asynchronously via webhook for others',
  })
  orderId?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description: 'Customer-facing order number (e.g. ORD-2026-000123), set alongside orderId — show this, never the internal id',
  })
  orderNumber?: string | null;
}

export class PaymentStatusResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: PaymentTxStatus })
  status: PaymentTxStatus;

  @ApiProperty({ nullable: true, type: String })
  orderId: string | null;

  @ApiProperty({ nullable: true, type: String, description: 'Customer-facing order number, once the order exists' })
  orderNumber: string | null;
}

export class PaymentDetailResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: PaymentTxStatus })
  status: PaymentTxStatus;

  @ApiProperty()
  gatewayCode: string;

  @ApiProperty()
  amountInPaise: number;

  @ApiProperty()
  currency: string;

  @ApiProperty()
  attemptNumber: number;

  @ApiProperty({ nullable: true, type: String })
  orderId: string | null;

  @ApiProperty()
  createdAt: string;

  @ApiProperty({ nullable: true, type: String })
  authorizedAt: string | null;

  @ApiProperty({ nullable: true, type: String })
  capturedAt: string | null;

  @ApiProperty({ nullable: true, type: String })
  failedAt: string | null;

  @ApiProperty({ nullable: true, type: String })
  cancelledAt: string | null;

  @ApiProperty({ nullable: true, type: String })
  refundedAt: string | null;
}
