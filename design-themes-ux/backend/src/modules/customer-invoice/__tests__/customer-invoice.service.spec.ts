import { NotFoundException } from '@nestjs/common';
import { CustomerInvoiceService } from '../customer-invoice.service';

const STORE_ID = 'store_1';
const CUSTOMER_ID = 'cust_1';
const ORDER_ID = 'order_1';

function makeOrder(overrides: Record<string, unknown> = {}) {
  return { id: ORDER_ID, storeId: STORE_ID, customerId: CUSTOMER_ID, orderNumber: 'ORD-1001', ...overrides } as any;
}

function makeDeps() {
  const ordersService = { findOne: jest.fn() } as any;
  const invoiceService = { composeFromOrder: jest.fn() } as any;
  return { ordersService, invoiceService };
}

function makeService(deps: ReturnType<typeof makeDeps>) {
  return new CustomerInvoiceService(deps.ordersService, deps.invoiceService);
}

describe('CustomerInvoiceService — getMyInvoiceData', () => {
  it('reuses OrdersService.findOne for the ownership check, then delegates composition to InvoiceService (no duplicate findOne)', async () => {
    const deps = makeDeps();
    const order = makeOrder();
    deps.ordersService.findOne.mockResolvedValue(order);
    const invoiceData = { invoiceNumber: 'INV-2026-000001' } as any;
    deps.invoiceService.composeFromOrder.mockResolvedValue(invoiceData);
    const service = makeService(deps);

    const result = await service.getMyInvoiceData(ORDER_ID, CUSTOMER_ID, STORE_ID);

    expect(deps.ordersService.findOne).toHaveBeenCalledWith(STORE_ID, ORDER_ID);
    expect(deps.ordersService.findOne).toHaveBeenCalledTimes(1);
    expect(deps.invoiceService.composeFromOrder).toHaveBeenCalledWith(order, STORE_ID);
    expect(result).toBe(invoiceData);
  });

  it('throws NotFoundException (never leaking the order, never calling composeFromOrder) when it belongs to a different customer', async () => {
    const deps = makeDeps();
    deps.ordersService.findOne.mockResolvedValue(makeOrder({ customerId: 'someone_else' }));
    const service = makeService(deps);

    await expect(service.getMyInvoiceData(ORDER_ID, CUSTOMER_ID, STORE_ID)).rejects.toBeInstanceOf(NotFoundException);
    expect(deps.invoiceService.composeFromOrder).not.toHaveBeenCalled();
  });

  it('propagates NotFoundException from OrdersService.findOne when the order does not exist in this store', async () => {
    const deps = makeDeps();
    deps.ordersService.findOne.mockRejectedValue(new NotFoundException('Order not found'));
    const service = makeService(deps);

    await expect(service.getMyInvoiceData(ORDER_ID, CUSTOMER_ID, STORE_ID)).rejects.toBeInstanceOf(NotFoundException);
    expect(deps.invoiceService.composeFromOrder).not.toHaveBeenCalled();
  });
});
