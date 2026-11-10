import { NotFoundException } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { OrderStatus, PaymentStatus } from '@prisma/client';
import { InvoiceService } from '../invoice.service';

const STORE_ID = 'store_1';
const ORDER_ID = 'order_1';

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: ORDER_ID,
    storeId: STORE_ID,
    customerId: 'cust_1',
    orderNumber: 'ORD-2026-000001',
    status: OrderStatus.DELIVERED,
    paymentStatus: PaymentStatus.PAID,
    paymentTransactionId: 'tx_1',
    subtotal: 1000, discount: 100, tax: 90, shippingCost: 0, total: 990, refundedAmount: 0,
    couponCode: null,
    createdAt: new Date('2026-01-01T10:00:00.000Z'),
    shippingAddress: JSON.stringify({
      firstName: 'Priya', lastName: 'Sharma', line1: '1 MG Road', line2: null,
      city: 'Bengaluru', state: 'KA', postalCode: '560001', country: 'India', phone: '9876543210',
    }),
    billingAddress: JSON.stringify({
      firstName: 'Priya', lastName: 'Sharma', line1: '1 MG Road', line2: null,
      city: 'Bengaluru', state: 'KA', postalCode: '560001', country: 'India', phone: '9876543210',
    }),
    customer: { id: 'cust_1', name: 'Priya Sharma', email: 'priya@example.com', phone: '9876543210' },
    items: [
      {
        productName: 'Silk Saree', variantName: 'Red', sku: 'SKU-1', hsn: '5007',
        quantity: 1, unitPrice: 1000, lineDiscount: 100, taxRate: 10, taxAmount: 90, total: 990,
      },
    ],
    shipments: [],
    ...overrides,
  } as any;
}

function makeDeps() {
  const prisma = {
    orderInvoice: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), create: jest.fn() },
    storeInvoiceCounter: { upsert: jest.fn(), findUnique: jest.fn() },
    storeSettings: { findFirst: jest.fn() },
    store: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  } as any;
  prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));
  prisma.store.findUnique.mockResolvedValue({ name: 'Shib\'s Store' });
  prisma.storeSettings.findFirst.mockResolvedValue({
    logo: null, legalBusinessName: 'Shib Retail Pvt Ltd', gstin: '29ABCDE1234F1Z5',
    registeredAddressLine1: '221B Commerce St', registeredAddressLine2: null,
    registeredCity: 'Bengaluru', registeredState: 'KA', registeredPostalCode: '560002', registeredCountry: 'India',
    businessPhone: '08012345678', businessEmail: 'billing@shibstore.example',
  });

  const ordersService = { findOne: jest.fn() } as any;
  const paymentService = {
    getPayment: jest.fn().mockResolvedValue({
      status: 'CAPTURED', gatewayCode: 'razorpay', gatewayPaymentId: 'pay_abc123',
      capturedAt: new Date('2026-01-01T10:05:00.000Z'),
    }),
  } as any;

  return { prisma, ordersService, paymentService };
}

function makeService(deps: ReturnType<typeof makeDeps>) {
  return new InvoiceService(deps.prisma, deps.ordersService, deps.paymentService);
}

describe('InvoiceService — getInvoiceData / composeFromOrder', () => {
  it('composes a full invoice from Order + PaymentTransaction + StoreSettings, assigning a new invoice number', async () => {
    const deps = makeDeps();
    deps.ordersService.findOne.mockResolvedValue(makeOrder());
    deps.prisma.orderInvoice.findUnique.mockResolvedValue(null);
    deps.prisma.storeInvoiceCounter.findUnique.mockResolvedValue({ counter: 1 });
    deps.prisma.orderInvoice.create.mockResolvedValue({ invoiceNumber: `INV-${new Date().getFullYear()}-000001`, issuedAt: new Date('2026-01-02T00:00:00.000Z') });
    const service = makeService(deps);

    const result = await service.getInvoiceData(ORDER_ID, STORE_ID);

    expect(deps.ordersService.findOne).toHaveBeenCalledWith(STORE_ID, ORDER_ID);
    expect(result.invoiceNumber).toBe(`INV-${new Date().getFullYear()}-000001`);
    expect(result.order).toEqual(expect.objectContaining({ id: ORDER_ID, orderNumber: 'ORD-2026-000001' }));
    expect(result.seller).toEqual(expect.objectContaining({
      storeName: "Shib's Store", legalBusinessName: 'Shib Retail Pvt Ltd', gstin: '29ABCDE1234F1Z5',
    }));
    expect(result.buyer.name).toBe('Priya Sharma');
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toEqual(expect.objectContaining({ sku: 'SKU-1', hsn: '5007', quantity: 1 }));
    expect(result.payment).toEqual(expect.objectContaining({ status: 'CAPTURED', transactionId: 'pay_abc123' }));
    expect(result.totals.total).toBe(990);
    expect(deps.prisma.storeInvoiceCounter.upsert).toHaveBeenCalledWith({
      where: { storeId_year: { storeId: STORE_ID, year: new Date().getFullYear() } },
      create: { storeId: STORE_ID, year: new Date().getFullYear(), counter: 1 },
      update: { counter: { increment: 1 } },
    });
  });

  it('reuses the existing invoice number on a repeat request — never re-increments the counter', async () => {
    const deps = makeDeps();
    deps.ordersService.findOne.mockResolvedValue(makeOrder());
    deps.prisma.orderInvoice.findUnique.mockResolvedValue({ invoiceNumber: 'INV-2026-000042', issuedAt: new Date('2026-01-02T00:00:00.000Z') });
    const service = makeService(deps);

    const result = await service.getInvoiceData(ORDER_ID, STORE_ID);

    expect(result.invoiceNumber).toBe('INV-2026-000042');
    expect(deps.prisma.storeInvoiceCounter.upsert).not.toHaveBeenCalled();
    expect(deps.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('falls back to the concurrent winner\'s invoice number when create() races into a P2002 (never duplicates a number)', async () => {
    const deps = makeDeps();
    deps.ordersService.findOne.mockResolvedValue(makeOrder());
    deps.prisma.orderInvoice.findUnique.mockResolvedValue(null); // no existing row, both outside and inside the tx
    deps.prisma.storeInvoiceCounter.findUnique.mockResolvedValue({ counter: 7 });
    deps.prisma.orderInvoice.create.mockRejectedValue(
      new PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: '5.22.0' } as any),
    );
    deps.prisma.orderInvoice.findUniqueOrThrow.mockResolvedValue({ invoiceNumber: 'INV-2026-000006', issuedAt: new Date('2026-01-02T00:00:00.000Z') });
    const service = makeService(deps);

    const result = await service.getInvoiceData(ORDER_ID, STORE_ID);

    expect(result.invoiceNumber).toBe('INV-2026-000006');
    expect(deps.prisma.orderInvoice.findUniqueOrThrow).toHaveBeenCalledWith({ where: { orderId: ORDER_ID } });
  });

  it('propagates a non-P2002 error from the invoice-number transaction rather than swallowing it', async () => {
    const deps = makeDeps();
    deps.ordersService.findOne.mockResolvedValue(makeOrder());
    deps.prisma.orderInvoice.findUnique.mockResolvedValue(null);
    deps.prisma.storeInvoiceCounter.findUnique.mockResolvedValue({ counter: 1 });
    deps.prisma.orderInvoice.create.mockRejectedValue(new Error('connection reset'));
    const service = makeService(deps);

    await expect(service.getInvoiceData(ORDER_ID, STORE_ID)).rejects.toThrow('connection reset');
  });
});

describe('InvoiceService — multi-tenant isolation (admin path)', () => {
  it('propagates NotFoundException from OrdersService.findOne when the order does not belong to the given store', async () => {
    const deps = makeDeps();
    deps.ordersService.findOne.mockRejectedValue(new NotFoundException('Order not found'));
    const service = makeService(deps);

    await expect(service.getInvoiceData(ORDER_ID, 'store_other')).rejects.toBeInstanceOf(NotFoundException);
    // InvoiceService never queries StoreSettings/PaymentTransaction for a store it couldn't load the order for.
    expect(deps.prisma.storeSettings.findFirst).not.toHaveBeenCalled();
    expect(deps.paymentService.getPayment).not.toHaveBeenCalled();
  });

  it('always passes the caller-supplied storeId through to OrdersService.findOne — never trusts anything from the order itself for scoping', async () => {
    const deps = makeDeps();
    deps.ordersService.findOne.mockResolvedValue(makeOrder());
    deps.prisma.orderInvoice.findUnique.mockResolvedValue({ invoiceNumber: 'INV-2026-000001', issuedAt: new Date() });
    const service = makeService(deps);

    await service.getInvoiceData(ORDER_ID, STORE_ID);

    expect(deps.ordersService.findOne).toHaveBeenCalledWith(STORE_ID, ORDER_ID);
  });
});

describe('InvoiceService — tax breakdown reconstruction', () => {
  function withOrder(deps: ReturnType<typeof makeDeps>, order: any) {
    deps.ordersService.findOne.mockResolvedValue(order);
    deps.prisma.orderInvoice.findUnique.mockResolvedValue({ invoiceNumber: 'INV-2026-000001', issuedAt: new Date() });
  }

  it('splits into CGST+SGST when delivery state matches the store\'s own registered state (intra-state)', async () => {
    const deps = makeDeps(); // registeredState: 'KA', delivery state in makeOrder() is also 'KA'
    withOrder(deps, makeOrder());
    const service = makeService(deps);

    const result = await service.getInvoiceData(ORDER_ID, STORE_ID);

    expect(result.taxBreakdown.taxType).toBe('INTRA_STATE');
    expect(result.taxBreakdown.cgst).toBe(45);
    expect(result.taxBreakdown.sgst).toBe(45);
    expect(result.taxBreakdown.igst).toBeNull();
    expect(result.taxBreakdown.totalTax).toBe(90);
  });

  it('reports IGST only when delivery state differs from the store\'s registered state (inter-state)', async () => {
    const deps = makeDeps();
    withOrder(deps, makeOrder({
      shippingAddress: JSON.stringify({
        firstName: 'Amit', lastName: 'Rao', line1: '2 Marine Dr', line2: null,
        city: 'Mumbai', state: 'MH', postalCode: '400001', country: 'India', phone: '9999999999',
      }),
    }));
    const service = makeService(deps);

    const result = await service.getInvoiceData(ORDER_ID, STORE_ID);

    expect(result.taxBreakdown.taxType).toBe('INTER_STATE');
    expect(result.taxBreakdown.igst).toBe(90);
    expect(result.taxBreakdown.cgst).toBeNull();
    expect(result.taxBreakdown.sgst).toBeNull();
  });

  it('falls back to UNKNOWN (no split, total only) when the store has no registered state configured', async () => {
    const deps = makeDeps();
    deps.prisma.storeSettings.findFirst.mockResolvedValue({
      logo: null, legalBusinessName: null, gstin: null,
      registeredAddressLine1: null, registeredState: null, businessPhone: null, businessEmail: null,
    });
    withOrder(deps, makeOrder());
    const service = makeService(deps);

    const result = await service.getInvoiceData(ORDER_ID, STORE_ID);

    expect(result.taxBreakdown.taxType).toBe('UNKNOWN');
    expect(result.taxBreakdown.cgst).toBeNull();
    expect(result.taxBreakdown.igst).toBeNull();
    expect(result.taxBreakdown.totalTax).toBe(90);
  });

  it('falls back to UNKNOWN when the order has no shipping address at all', async () => {
    const deps = makeDeps();
    withOrder(deps, makeOrder({ shippingAddress: null }));
    const service = makeService(deps);

    const result = await service.getInvoiceData(ORDER_ID, STORE_ID);

    expect(result.taxBreakdown.taxType).toBe('UNKNOWN');
  });
});

describe('InvoiceService — graceful degradation', () => {
  it('returns payment: null when the order has no paymentTransactionId', async () => {
    const deps = makeDeps();
    deps.ordersService.findOne.mockResolvedValue(makeOrder({ paymentTransactionId: null }));
    deps.prisma.orderInvoice.findUnique.mockResolvedValue({ invoiceNumber: 'INV-2026-000001', issuedAt: new Date() });
    const service = makeService(deps);

    const result = await service.getInvoiceData(ORDER_ID, STORE_ID);

    expect(result.payment).toBeNull();
    expect(deps.paymentService.getPayment).not.toHaveBeenCalled();
  });

  it('returns payment: null (never throws) when PaymentService.getPayment fails for a dangling transaction id', async () => {
    const deps = makeDeps();
    deps.paymentService.getPayment.mockRejectedValue(new Error('not found'));
    deps.ordersService.findOne.mockResolvedValue(makeOrder());
    deps.prisma.orderInvoice.findUnique.mockResolvedValue({ invoiceNumber: 'INV-2026-000001', issuedAt: new Date() });
    const service = makeService(deps);

    const result = await service.getInvoiceData(ORDER_ID, STORE_ID);

    expect(result.payment).toBeNull();
  });

  it('returns shipment: null when the order has no shipments', async () => {
    const deps = makeDeps();
    deps.ordersService.findOne.mockResolvedValue(makeOrder({ shipments: [] }));
    deps.prisma.orderInvoice.findUnique.mockResolvedValue({ invoiceNumber: 'INV-2026-000001', issuedAt: new Date() });
    const service = makeService(deps);

    const result = await service.getInvoiceData(ORDER_ID, STORE_ID);

    expect(result.shipment).toBeNull();
  });

  it('picks the most recently created shipment when an order has multiple', async () => {
    const deps = makeDeps();
    deps.ordersService.findOne.mockResolvedValue(makeOrder({
      shipments: [
        { trackingNumber: 'TRK-OLD', carrier: 'DHL', deliveredAt: null, createdAt: new Date('2026-01-01') },
        { trackingNumber: 'TRK-NEW', carrier: 'FedEx', deliveredAt: new Date('2026-01-05'), createdAt: new Date('2026-01-03') },
      ],
    }));
    deps.prisma.orderInvoice.findUnique.mockResolvedValue({ invoiceNumber: 'INV-2026-000001', issuedAt: new Date() });
    const service = makeService(deps);

    const result = await service.getInvoiceData(ORDER_ID, STORE_ID);

    expect(result.shipment).toEqual(expect.objectContaining({ trackingNumber: 'TRK-NEW', carrier: 'FedEx' }));
  });

  it('parses a malformed address snapshot as null rather than throwing', async () => {
    const deps = makeDeps();
    deps.ordersService.findOne.mockResolvedValue(makeOrder({ shippingAddress: '{not valid json', billingAddress: '{not valid json' }));
    deps.prisma.orderInvoice.findUnique.mockResolvedValue({ invoiceNumber: 'INV-2026-000001', issuedAt: new Date() });
    const service = makeService(deps);

    const result = await service.getInvoiceData(ORDER_ID, STORE_ID);

    expect(result.buyer.shippingAddress).toBeNull();
    expect(result.buyer.billingAddress).toBeNull();
    expect(result.taxBreakdown.taxType).toBe('UNKNOWN');
  });
});
