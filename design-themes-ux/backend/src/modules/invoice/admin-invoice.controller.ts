import { Controller, Get, Param, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { CurrentStore } from '@/common/decorators/current-store.decorator';
import { Permissions } from '@/common/decorators/permissions.decorator';
import { InvoiceService } from './invoice.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { InvoiceDataResponseDto } from './dto/invoice-response.dto';

// Customer & Merchant Invoice Module (Phase 8) — merchant-facing surface,
// mounted at the same `/orders` prefix as OrdersController (a separate
// controller/module, so that already-complete module is never touched).
// Reuses InvoiceService/InvoicePdfService — no invoice composition or
// rendering logic is duplicated here.
@ApiTags('Invoices')
@ApiBearerAuth()
@Controller('orders')
export class AdminInvoiceController {
  constructor(
    private readonly invoiceService: InvoiceService,
    private readonly invoicePdf: InvoicePdfService,
  ) {}

  @Get(':id/invoice/data')
  @Permissions('orders:read')
  @ApiOperation({ summary: 'Get the composed invoice data (JSON) for an order in this store' })
  @ApiResponse({ status: 200, description: 'Invoice data', type: InvoiceDataResponseDto })
  async getInvoiceData(
    @CurrentStore() storeId: string,
    @Param('id') orderId: string,
  ): Promise<InvoiceDataResponseDto> {
    return this.invoiceService.getInvoiceData(orderId, storeId);
  }

  @Get(':id/invoice')
  @Permissions('orders:read')
  @ApiOperation({ summary: 'Download the tax invoice PDF for an order in this store' })
  async downloadInvoice(
    @CurrentStore() storeId: string,
    @Param('id') orderId: string,
    @Res() res: Response,
  ): Promise<void> {
    const data = await this.invoiceService.getInvoiceData(orderId, storeId);
    const pdf = await this.invoicePdf.render(data);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="invoice-${data.invoiceNumber}.pdf"`);
    res.send(pdf);
  }
}
