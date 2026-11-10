import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth, ApiNotFoundResponse, ApiOperation, ApiResponse, ApiTags, ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Response } from 'express';
import { Public } from '@/common/decorators/public.decorator';
import { CustomerJwtAuthGuard } from '@/modules/customer-auth/guards/customer-jwt-auth.guard';
import { CurrentCustomer } from '@/modules/customer-auth/decorators/current-customer.decorator';
import { AuthenticatedCustomer } from '@/modules/customer-auth/types/customer-auth.types';
import { InvoicePdfService } from '@/modules/invoice/invoice-pdf.service';
import { CustomerInvoiceService } from './customer-invoice.service';
import { InvoiceDataResponseDto } from '@/modules/invoice/dto/invoice-response.dto';

// Customer Self-Service Phase 8 — thin REST surface over
// CustomerInvoiceService, which itself only orchestrates OrdersService and
// InvoiceService (both unmodified). `@Public()` bypasses the global merchant
// JwtAuthGuard (same pattern as every other customer-* controller) —
// CustomerJwtAuthGuard is what actually authenticates these routes. Mounted
// at the same `customer/orders` path prefix as every other Phase 5-7
// controller (separate controllers/modules, so those already-complete
// modules are never touched) — `:orderId/invoice` and `:orderId/invoice/data`
// don't collide with any of their existing routes.
@ApiTags('Customer Invoice')
@ApiBearerAuth()
@Public()
@UseGuards(CustomerJwtAuthGuard)
@Controller('customer/orders')
export class CustomerInvoiceController {
  constructor(
    private readonly customerInvoice: CustomerInvoiceService,
    private readonly invoicePdf: InvoicePdfService,
  ) {}

  @Get(':orderId/invoice/data')
  @ApiOperation({ summary: "Get the composed invoice data (JSON) for one of the current customer's own orders" })
  @ApiResponse({ status: 200, description: 'Invoice data', type: InvoiceDataResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid customer access token' })
  @ApiNotFoundResponse({ description: 'Order does not exist or does not belong to this customer' })
  async getInvoiceData(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Param('orderId') orderId: string,
  ): Promise<InvoiceDataResponseDto> {
    return this.customerInvoice.getMyInvoiceData(orderId, customer.id, customer.storeId);
  }

  @Get(':orderId/invoice')
  @ApiOperation({ summary: "Download the tax invoice PDF for one of the current customer's own orders" })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid customer access token' })
  @ApiNotFoundResponse({ description: 'Order does not exist or does not belong to this customer' })
  async downloadInvoice(
    @CurrentCustomer() customer: AuthenticatedCustomer,
    @Param('orderId') orderId: string,
    @Res() res: Response,
  ): Promise<void> {
    const data = await this.customerInvoice.getMyInvoiceData(orderId, customer.id, customer.storeId);
    const pdf = await this.invoicePdf.render(data);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="invoice-${data.invoiceNumber}.pdf"`);
    res.send(pdf);
  }
}
