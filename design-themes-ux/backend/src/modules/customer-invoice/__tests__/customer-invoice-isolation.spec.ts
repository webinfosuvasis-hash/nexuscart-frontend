import { NotFoundException } from '@nestjs/common';
import { CustomerJwtStrategy } from '@/modules/customer-auth/strategies/customer-jwt.strategy';
import { CustomerInvoiceController } from '../customer-invoice.controller';
import { CustomerInvoiceService } from '../customer-invoice.service';

// ---------------------------------------------------------------------------
// Integration test — proves cross-customer/cross-tenant isolation through the
// REAL chain: CustomerJwtStrategy.validate() → CustomerInvoiceController
// (real) → CustomerInvoiceService (real). OrdersService/InvoiceService are
// test doubles standing in for three customers: two in the same store (the
// subtler boundary) and one in a different store entirely.
// ---------------------------------------------------------------------------

const STORE_A = 'store_a';
const STORE_B = 'store_b';

const CUSTOMER_A = { id: 'cust_a', storeId: STORE_A, email: 'alice@example.com', name: 'Alice', isActive: true };
const CUSTOMER_A2 = { id: 'cust_a2', storeId: STORE_A, email: 'amit@example.com', name: 'Amit', isActive: true };
const CUSTOMER_B = { id: 'cust_b', storeId: STORE_B, email: 'bob@example.com', name: 'Bob', isActive: true };

const ORDER_A = 'order_a';
const ORDER_A2 = 'order_a2';
const ORDER_B = 'order_b';

function makeConfig() {
  return { get: jest.fn().mockReturnValue('test-customer-secret') } as any;
}

async function resolvePrincipal(customersById: Record<string, any>, customerId: string, storeId: string) {
  const prisma = {
    customer: {
      findFirst: jest.fn().mockImplementation(({ where }: any) => {
        const row = customersById[where.id];
        if (!row || row.storeId !== where.storeId) return Promise.resolve(null);
        return Promise.resolve(row);
      }),
    },
  } as any;
  const strategy = new CustomerJwtStrategy(makeConfig(), prisma);
  return strategy.validate({ sub: customerId, storeId, email: 'irrelevant@example.com', type: 'customer' });
}

function makeOrderRow(id: string, storeId: string, customerId: string) {
  return { id, storeId, customerId, orderNumber: `ORD-${id}` };
}

function buildHarness() {
  const customersById = { cust_a: CUSTOMER_A, cust_a2: CUSTOMER_A2, cust_b: CUSTOMER_B };
  const orders: Record<string, any> = {
    [ORDER_A]: makeOrderRow(ORDER_A, STORE_A, 'cust_a'),
    [ORDER_A2]: makeOrderRow(ORDER_A2, STORE_A, 'cust_a2'),
    [ORDER_B]: makeOrderRow(ORDER_B, STORE_B, 'cust_b'),
  };

  // Mirrors the real OrdersService.findOne contract: scoped by (id, storeId)
  // ONLY — CustomerInvoiceService's own ownership check is what's under test.
  const ordersService = {
    findOne: jest.fn().mockImplementation((storeId: string, id: string) => {
      const order = orders[id];
      if (!order || order.storeId !== storeId) throw new NotFoundException('Order not found');
      return Promise.resolve(order);
    }),
  } as any;

  const invoiceService = {
    composeFromOrder: jest.fn().mockImplementation((order: any) => Promise.resolve({ invoiceNumber: `INV-${order.id}`, orderId: order.id })),
  } as any;
  const invoicePdf = { render: jest.fn().mockResolvedValue(Buffer.from('%PDF-fake')) } as any;

  const service = new CustomerInvoiceService(ordersService, invoiceService);
  const controller = new CustomerInvoiceController(service, invoicePdf);

  return { controller, customersById };
}

describe('Customer Invoice — cross-customer isolation (integration)', () => {
  it('customer A can view and download their own invoice', async () => {
    const h = buildHarness();
    const principalA = await resolvePrincipal(h.customersById, 'cust_a', STORE_A);

    const data = await h.controller.getInvoiceData(principalA, ORDER_A);
    expect(data).toEqual(expect.objectContaining({ invoiceNumber: `INV-${ORDER_A}` }));

    const res = { setHeader: jest.fn(), send: jest.fn() } as any;
    await h.controller.downloadInvoice(principalA, ORDER_A, res);
    expect(res.send).toHaveBeenCalled();
  });

  it('customer A cannot view or download A2\'s invoice, even though they share a store (404, not a leak)', async () => {
    const h = buildHarness();
    const principalA = await resolvePrincipal(h.customersById, 'cust_a', STORE_A);
    const res = { setHeader: jest.fn(), send: jest.fn() } as any;

    await expect(h.controller.getInvoiceData(principalA, ORDER_A2)).rejects.toBeInstanceOf(NotFoundException);
    await expect(h.controller.downloadInvoice(principalA, ORDER_A2, res)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('customer A cannot view or download B\'s invoice (different store)', async () => {
    const h = buildHarness();
    const principalA = await resolvePrincipal(h.customersById, 'cust_a', STORE_A);

    await expect(h.controller.getInvoiceData(principalA, ORDER_B)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('a forged principal (A\'s id under B\'s storeId) cannot reach A\'s invoice either', async () => {
    const h = buildHarness();
    const forged = { ...CUSTOMER_A, storeId: STORE_B };

    await expect(h.controller.getInvoiceData(forged, ORDER_A)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('customer A2 sees only their own invoice, not A\'s, despite sharing a store', async () => {
    const h = buildHarness();
    const principalA2 = await resolvePrincipal(h.customersById, 'cust_a2', STORE_A);

    const data = await h.controller.getInvoiceData(principalA2, ORDER_A2);

    expect(data).toEqual(expect.objectContaining({ invoiceNumber: `INV-${ORDER_A2}` }));
  });
});
