import { Injectable, NotFoundException } from '@nestjs/common';
import { OrdersService } from '@/modules/orders/orders.service';
import { InvoiceService } from '@/modules/invoice/invoice.service';
import { InvoiceData } from '@/modules/invoice/types/invoice-data.types';

/**
 * Customer Self-Service Phase 8 — read-only orchestration over
 * OrdersService (unmodified) and InvoiceService (unmodified). This module
 * adds only the customer-facing ownership boundary (OrdersService.findOne
 * only ever scopes by storeId, same precedent as every other customer-*
 * module) before delegating to InvoiceService.composeFromOrder — no
 * invoice-number assignment, tax-breakdown, or PDF-rendering logic is
 * duplicated here.
 */
@Injectable()
export class CustomerInvoiceService {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly invoiceService: InvoiceService,
  ) {}

  async getMyInvoiceData(orderId: string, customerId: string, storeId: string): Promise<InvoiceData> {
    const order = await this.loadOwnedOrder(orderId, customerId, storeId);
    return this.invoiceService.composeFromOrder(order, storeId);
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
