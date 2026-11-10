import { Injectable } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '@/prisma/prisma.service';
import { OrdersService } from '@/modules/orders/orders.service';
import { PaymentService } from '@/modules/payment/payment.service';
import {
  InvoiceAddress, InvoiceBuyer, InvoiceData, InvoiceLineItem, InvoicePayment,
  InvoiceSeller, InvoiceShipment, InvoiceTaxBreakdown, InvoiceTaxType,
} from './types/invoice-data.types';

/**
 * Customer & Merchant Invoice Module (Phase 8) — the single composition used
 * by both the admin and customer invoice controllers, and by the PDF
 * renderer. Reuses OrdersService.findOne() and PaymentService.getPayment()
 * (both unmodified) for every order/payment fact; adds only:
 *   1. Invoice-number assignment (its own separate sequence — never reuses
 *      Order.orderNumber, per the Phase 8 requirement).
 *   2. A read-only CGST/SGST/IGST split of each line's *already-persisted*
 *      OrderItem.taxAmount — this re-partitions an existing number, it never
 *      recalculates tax (checkout's IndiaGSTEngine remains the only place
 *      tax amounts are computed).
 * No order/payment/shipment/cancellation business logic is duplicated here.
 */
@Injectable()
export class InvoiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
    private readonly paymentService: PaymentService,
  ) {}

  /** Admin/merchant entry point — storeId-scoped only, matching every other admin order route. */
  async getInvoiceData(orderId: string, storeId: string): Promise<InvoiceData> {
    const order = await this.ordersService.findOne(storeId, orderId);
    return this.composeFromOrder(order, storeId);
  }

  /**
   * Shared composition, called directly by CustomerInvoiceService after ITS
   * OWN ownership-checked findOne() — avoids fetching the order twice for
   * the customer path while still sharing every other step of composition.
   */
  async composeFromOrder(order: any, storeId: string): Promise<InvoiceData> {
    const [{ invoiceNumber, issuedAt }, storeSettings, transaction] = await Promise.all([
      this.getOrAssignInvoiceNumber(order.id, storeId),
      this.prisma.storeSettings.findFirst({ where: { storeId } }),
      this.loadTransaction(order.paymentTransactionId, storeId),
    ]);
    const store = await this.prisma.store.findUnique({ where: { id: storeId }, select: { name: true } });

    const shippingAddress = parseAddress(order.shippingAddress);
    const billingAddress = parseAddress(order.billingAddress);

    const items: InvoiceLineItem[] = order.items.map((item: any) => ({
      productName: item.productName,
      variantName: item.variantName,
      sku: item.sku,
      hsn: item.hsn ?? null,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      discount: Number(item.lineDiscount),
      taxRate: Number(item.taxRate),
      taxAmount: Number(item.taxAmount),
      total: Number(item.total),
    }));

    // Uses Order.tax (the same authoritative total already shown as
    // totals.tax) as the amount to split — not a re-sum of each line's own
    // OrderItem.taxAmount, which can legitimately be 0 on lines where the
    // per-item breakdown was never populated even though the order-level
    // total is correct. This keeps the invoice's CGST/SGST/IGST split always
    // reconciling to the same grand total the customer actually paid.
    const taxBreakdown = buildTaxBreakdown(
      Number(order.tax),
      shippingAddress?.state ?? null,
      storeSettings?.registeredState ?? null,
    );

    const seller: InvoiceSeller = {
      storeName: store?.name ?? '',
      logo: storeSettings?.logo ?? null,
      legalBusinessName: storeSettings?.legalBusinessName ?? null,
      gstin: storeSettings?.gstin ?? null,
      address: storeSettings?.registeredAddressLine1
        ? {
          line1: storeSettings.registeredAddressLine1,
          line2: storeSettings.registeredAddressLine2 ?? null,
          city: storeSettings.registeredCity ?? null,
          state: storeSettings.registeredState ?? null,
          postalCode: storeSettings.registeredPostalCode ?? null,
          country: storeSettings.registeredCountry ?? null,
        }
        : null,
      phone: storeSettings?.businessPhone ?? null,
      email: storeSettings?.businessEmail ?? null,
    };

    const buyer: InvoiceBuyer = {
      name: order.customer?.name ?? `${billingAddress?.firstName ?? ''} ${billingAddress?.lastName ?? ''}`.trim(),
      email: order.customer?.email ?? null,
      phone: order.customer?.phone ?? billingAddress?.phone ?? null,
      billingAddress,
      shippingAddress,
    };

    const shipment = buildShipment(order.shipments);

    return {
      invoiceNumber,
      invoiceDate: issuedAt.toISOString(),
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        createdAt: order.createdAt.toISOString(),
      },
      seller,
      buyer,
      items,
      taxBreakdown,
      totals: {
        subtotal: Number(order.subtotal),
        discount: Number(order.discount),
        tax: Number(order.tax),
        shippingCost: Number(order.shippingCost),
        total: Number(order.total),
        refundedAmount: Number(order.refundedAmount),
        couponCode: order.couponCode ?? null,
      },
      payment: transaction,
      shipment,
    };
  }

  /** Mirrors CustomerOrdersService.loadTransaction — never lets a dangling/cross-store paymentTransactionId 500 the invoice. */
  private async loadTransaction(paymentTransactionId: string | null, storeId: string): Promise<InvoicePayment | null> {
    if (!paymentTransactionId) return null;
    try {
      const tx = await this.paymentService.getPayment(paymentTransactionId, storeId);
      return {
        status: tx.status,
        gatewayCode: tx.gatewayCode,
        transactionId: tx.gatewayPaymentId ?? null,
        paidAt: tx.capturedAt?.toISOString() ?? null,
      };
    } catch {
      return null;
    }
  }

  /**
   * Assigns a stable, sequential invoice number the first time an invoice is
   * requested for an order (customer or merchant, whichever comes first) —
   * uses its own StoreInvoiceCounter, a separate sequence from
   * StoreOrderCounter (per Phase 8's "do not reuse Order Number" requirement).
   * Concurrency-safe: a unique constraint on (storeId, orderId) is the real
   * guard — under a genuine simultaneous first-request race, the losing
   * transaction's counter increment is not reclaimed (an occasional numbering
   * gap, never a duplicate), the same characteristic StoreOrderCounter's own
   * generation already has.
   */
  private async getOrAssignInvoiceNumber(orderId: string, storeId: string): Promise<{ invoiceNumber: string; issuedAt: Date }> {
    const existing = await this.prisma.orderInvoice.findUnique({ where: { orderId } });
    if (existing) return existing;

    const year = new Date().getFullYear();
    let lostRace = false;

    const result = await this.prisma.$transaction(async (tx) => {
      const raced = await tx.orderInvoice.findUnique({ where: { orderId } });
      if (raced) return raced;

      await tx.storeInvoiceCounter.upsert({
        where: { storeId_year: { storeId, year } },
        create: { storeId, year, counter: 1 },
        update: { counter: { increment: 1 } },
      });
      const counter = await tx.storeInvoiceCounter.findUnique({ where: { storeId_year: { storeId, year } } });
      const invoiceNumber = `INV-${year}-${String(counter!.counter).padStart(6, '0')}`;

      try {
        return await tx.orderInvoice.create({ data: { storeId, orderId, invoiceNumber } });
      } catch (err) {
        if (err instanceof PrismaClientKnownRequestError && err.code === 'P2002') {
          // A concurrent request for the same order won the race and has
          // already committed its row — but under this transaction's own
          // REPEATABLE READ snapshot (taken at the `raced` read above), that
          // commit isn't visible yet even though the unique-constraint check
          // itself (a real-time check, not snapshot-bound) already saw it.
          // Reading it back through `tx` here would incorrectly 404. Signal
          // the miss and re-read fresh, outside this transaction, below.
          lostRace = true;
          return null;
        }
        throw err;
      }
    });

    if (lostRace || !result) {
      return this.prisma.orderInvoice.findUniqueOrThrow({ where: { orderId } });
    }
    return result;
  }
}

function parseAddress(raw: string | null): InvoiceAddress | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as InvoiceAddress;
  } catch {
    // A malformed/legacy snapshot should never fail the whole invoice — the
    // rest of it (items, totals, payment) is still perfectly usable.
    return null;
  }
}

function buildShipment(shipments: any[] | undefined): InvoiceShipment | null {
  if (!shipments || shipments.length === 0) return null;
  // Most recent shipment (createdAt desc) is the one relevant to an invoice.
  const latest = [...shipments].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  return {
    trackingNumber: latest.trackingNumber ?? null,
    carrier: latest.carrier ?? null,
    deliveredAt: latest.deliveredAt ? new Date(latest.deliveredAt).toISOString() : null,
  };
}

/**
 * Splits Order.tax (the same already-persisted, authoritative total shown as
 * totals.tax) into CGST+SGST (intra-state) or IGST (inter-state) — the exact
 * same halving arithmetic IndiaGSTEngine itself uses at checkout (checkout/
 * engines/tax/india-gst.engine.ts), just replayed here on a number that's
 * already final. No tax amount is recalculated; only split for legal
 * presentation — and it's anchored to Order.tax rather than re-summed from
 * per-line OrderItem.taxAmount, so it always reconciles to the order's real
 * grand total even on lines where the per-item breakdown was never
 * populated. Falls back to 'UNKNOWN' (no split shown, only the total) when
 * either the delivery state or the store's own registered state is not
 * available — never guesses.
 */
function buildTaxBreakdown(
  totalTax: number,
  deliveryState: string | null,
  sellerState: string | null,
): InvoiceTaxBreakdown {
  totalTax = round2(totalTax);

  if (!deliveryState || !sellerState) {
    return { taxType: 'UNKNOWN', cgst: null, sgst: null, igst: null, totalTax };
  }

  const taxType: InvoiceTaxType = deliveryState.trim().toUpperCase() === sellerState.trim().toUpperCase()
    ? 'INTRA_STATE'
    : 'INTER_STATE';

  if (taxType === 'INTER_STATE') {
    return { taxType, cgst: null, sgst: null, igst: totalTax, totalTax };
  }

  const cgst = round2(totalTax / 2);
  const sgst = round2(totalTax - cgst);
  return { taxType, cgst, sgst, igst: null, totalTax };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
