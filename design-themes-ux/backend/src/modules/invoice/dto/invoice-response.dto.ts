import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus, PaymentStatus } from '@prisma/client';

// Swagger-only response shapes mirroring InvoiceData (types/invoice-data.types.ts)
// — the JSON twin of the PDF, used by the frontend's on-page invoice preview.

export class InvoiceAddressDto {
  @ApiProperty() firstName: string;
  @ApiProperty() lastName: string;
  @ApiProperty() line1: string;
  @ApiPropertyOptional({ nullable: true, type: String }) line2: string | null;
  @ApiProperty() city: string;
  @ApiProperty() state: string;
  @ApiProperty() postalCode: string;
  @ApiProperty() country: string;
  @ApiPropertyOptional({ nullable: true, type: String }) phone: string | null;
}

export class InvoiceSellerAddressDto {
  @ApiPropertyOptional({ nullable: true, type: String }) line1: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) line2: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) city: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) state: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) postalCode: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) country: string | null;
}

export class InvoiceSellerDto {
  @ApiProperty() storeName: string;
  @ApiPropertyOptional({ nullable: true, type: String }) logo: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) legalBusinessName: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) gstin: string | null;
  @ApiPropertyOptional({ nullable: true, type: InvoiceSellerAddressDto }) address: InvoiceSellerAddressDto | null;
  @ApiPropertyOptional({ nullable: true, type: String }) phone: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) email: string | null;
}

export class InvoiceBuyerDto {
  @ApiProperty() name: string;
  @ApiPropertyOptional({ nullable: true, type: String }) email: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) phone: string | null;
  @ApiPropertyOptional({ nullable: true, type: InvoiceAddressDto }) billingAddress: InvoiceAddressDto | null;
  @ApiPropertyOptional({ nullable: true, type: InvoiceAddressDto }) shippingAddress: InvoiceAddressDto | null;
}

export class InvoiceLineItemDto {
  @ApiProperty() productName: string;
  @ApiPropertyOptional({ nullable: true, type: String }) variantName: string | null;
  @ApiProperty() sku: string;
  @ApiPropertyOptional({ nullable: true, type: String }) hsn: string | null;
  @ApiProperty() quantity: number;
  @ApiProperty() unitPrice: number;
  @ApiProperty() discount: number;
  @ApiProperty() taxRate: number;
  @ApiProperty() taxAmount: number;
  @ApiProperty() total: number;
}

export class InvoiceTaxBreakdownDto {
  @ApiProperty({ enum: ['INTRA_STATE', 'INTER_STATE', 'UNKNOWN'] }) taxType: string;
  @ApiPropertyOptional({ nullable: true, type: Number }) cgst: number | null;
  @ApiPropertyOptional({ nullable: true, type: Number }) sgst: number | null;
  @ApiPropertyOptional({ nullable: true, type: Number }) igst: number | null;
  @ApiProperty() totalTax: number;
}

export class InvoiceTotalsDto {
  @ApiProperty() subtotal: number;
  @ApiProperty() discount: number;
  @ApiProperty() tax: number;
  @ApiProperty() shippingCost: number;
  @ApiProperty() total: number;
  @ApiProperty() refundedAmount: number;
  @ApiPropertyOptional({ nullable: true, type: String }) couponCode: string | null;
}

export class InvoicePaymentDto {
  @ApiProperty() status: string;
  @ApiProperty() gatewayCode: string;
  @ApiPropertyOptional({ nullable: true, type: String }) transactionId: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) paidAt: string | null;
}

export class InvoiceShipmentDto {
  @ApiPropertyOptional({ nullable: true, type: String }) trackingNumber: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) carrier: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) deliveredAt: string | null;
}

export class InvoiceOrderSummaryDto {
  @ApiProperty() id: string;
  @ApiProperty() orderNumber: string;
  @ApiProperty({ enum: OrderStatus }) status: OrderStatus;
  @ApiProperty({ enum: PaymentStatus }) paymentStatus: PaymentStatus;
  @ApiProperty() createdAt: string;
}

export class InvoiceDataResponseDto {
  @ApiProperty() invoiceNumber: string;
  @ApiProperty() invoiceDate: string;
  @ApiProperty() order: InvoiceOrderSummaryDto;
  @ApiProperty() seller: InvoiceSellerDto;
  @ApiProperty() buyer: InvoiceBuyerDto;
  @ApiProperty({ type: [InvoiceLineItemDto] }) items: InvoiceLineItemDto[];
  @ApiProperty() taxBreakdown: InvoiceTaxBreakdownDto;
  @ApiProperty() totals: InvoiceTotalsDto;
  @ApiPropertyOptional({ nullable: true, type: InvoicePaymentDto }) payment: InvoicePaymentDto | null;
  @ApiPropertyOptional({ nullable: true, type: InvoiceShipmentDto }) shipment: InvoiceShipmentDto | null;
}
