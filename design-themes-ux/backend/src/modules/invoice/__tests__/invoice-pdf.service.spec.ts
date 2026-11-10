import { InvoicePdfService } from '../invoice-pdf.service';
import { InvoiceData } from '../types/invoice-data.types';

function makeInvoiceData(overrides: Partial<InvoiceData> = {}): InvoiceData {
  return {
    invoiceNumber: 'INV-2026-000001',
    invoiceDate: '2026-01-02T00:00:00.000Z',
    order: {
      id: 'order_1', orderNumber: 'ORD-2026-000001', status: 'DELIVERED' as any, paymentStatus: 'PAID' as any,
      createdAt: '2026-01-01T10:00:00.000Z',
    },
    seller: {
      storeName: "Shib's Store", logo: null, legalBusinessName: 'Shib Retail Pvt Ltd', gstin: '29ABCDE1234F1Z5',
      address: { line1: '221B Commerce St', line2: null, city: 'Bengaluru', state: 'KA', postalCode: '560002', country: 'India' },
      phone: '08012345678', email: 'billing@shibstore.example',
    },
    buyer: {
      name: 'Priya Sharma', email: 'priya@example.com', phone: '9876543210',
      billingAddress: { firstName: 'Priya', lastName: 'Sharma', line1: '1 MG Road', line2: null, city: 'Bengaluru', state: 'KA', postalCode: '560001', country: 'India', phone: '9876543210' },
      shippingAddress: { firstName: 'Priya', lastName: 'Sharma', line1: '1 MG Road', line2: null, city: 'Bengaluru', state: 'KA', postalCode: '560001', country: 'India', phone: '9876543210' },
    },
    items: [
      { productName: 'Silk Saree', variantName: 'Red', sku: 'SKU-1', hsn: '5007', quantity: 1, unitPrice: 1000, discount: 100, taxRate: 10, taxAmount: 90, total: 990 },
    ],
    taxBreakdown: { taxType: 'INTRA_STATE', cgst: 45, sgst: 45, igst: null, totalTax: 90 },
    totals: { subtotal: 1000, discount: 100, tax: 90, shippingCost: 0, total: 990, refundedAmount: 0, couponCode: null },
    payment: { status: 'CAPTURED', gatewayCode: 'razorpay', transactionId: 'pay_abc123', paidAt: '2026-01-01T10:05:00.000Z' },
    shipment: { trackingNumber: 'TRK123', carrier: 'FedEx', deliveredAt: '2026-01-05T00:00:00.000Z' },
    ...overrides,
  };
}

describe('InvoicePdfService', () => {
  it('renders a valid PDF buffer for a complete invoice', async () => {
    const service = new InvoicePdfService();
    const buffer = await service.render(makeInvoiceData());

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(500);
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('renders a short invoice onto exactly one page — the footer must not overflow onto extra blank pages', async () => {
    const service = new InvoicePdfService();
    const buffer = await service.render(makeInvoiceData());

    const match = /\/Count\s+(\d+)/.exec(buffer.toString('latin1'));
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBe(1);
  });

  it('never throws when every optional field is null/empty (graceful degradation)', async () => {
    const service = new InvoicePdfService();
    const data = makeInvoiceData({
      seller: {
        storeName: 'Bare Store', logo: null, legalBusinessName: null, gstin: null, address: null, phone: null, email: null,
      },
      buyer: { name: 'Guest', email: null, phone: null, billingAddress: null, shippingAddress: null },
      payment: null,
      shipment: null,
      taxBreakdown: { taxType: 'UNKNOWN', cgst: null, sgst: null, igst: null, totalTax: 0 },
    });

    const buffer = await service.render(data);

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('paginates correctly for a large order with many line items', async () => {
    const service = new InvoicePdfService();
    const manyItems = Array.from({ length: 60 }, (_, i) => ({
      productName: `Product ${i + 1}`, variantName: null, sku: `SKU-${i + 1}`, hsn: '1234',
      quantity: 1, unitPrice: 100, discount: 0, taxRate: 5, taxAmount: 5, total: 105,
    }));
    const data = makeInvoiceData({ items: manyItems });

    const buffer = await service.render(data);

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');

    // 60 line items genuinely overflow one A4 page — confirm pagination
    // actually kicked in rather than silently truncating onto a single page.
    // (Page content streams are Flate-compressed by pdfkit by default, so
    // only structural markers like /Count are reliably byte-searchable here —
    // per-page footer placement itself is covered by the single-page test above.)
    const match = /\/Count\s+(\d+)/.exec(buffer.toString('latin1'));
    expect(Number(match![1])).toBeGreaterThan(1);
  });

  it('never fetches a remote URL for the seller logo (no SSRF surface) — only resolves paths under the local uploads directory', async () => {
    const service = new InvoicePdfService();
    const data = makeInvoiceData({
      seller: { ...makeInvoiceData().seller, logo: 'https://attacker.example/probe.png' },
    });

    // Should render without attempting any network fetch — if it tried, this
    // test environment has no network access and render() would hang/throw.
    const buffer = await service.render(data);
    expect(Buffer.isBuffer(buffer)).toBe(true);
  });
});
