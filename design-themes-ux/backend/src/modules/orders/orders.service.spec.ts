import { OrdersService } from './orders.service';

// Cash on delivery is collected at the door, so marking a COD order DELIVERED
// also settles its payment. Prepaid orders are already PAID and untouched.

function setup(order: Record<string, unknown>) {
  const tx = {
    order:              { update: jest.fn().mockResolvedValue({ id: 'ord_1', status: 'DELIVERED' }) },
    orderStatusHistory: { create: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    order: { findFirst: jest.fn().mockResolvedValue({ id: 'ord_1', storeId: 'store_1', items: [], ...order }) },
    $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  } as any;
  return { service: new OrdersService(prisma), tx };
}

describe('OrdersService.updateStatus — cash on delivery', () => {
  it('delivering a pending COD order marks it PAID', async () => {
    const { service, tx } = setup({ status: 'SHIPPED', paymentGatewayCode: 'cod', paymentStatus: 'PENDING' });

    await service.updateStatus('store_1', 'ord_1', 'DELIVERED');

    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: 'ord_1' },
      data:  { status: 'DELIVERED', paymentStatus: 'PAID' },
    });
  });

  it.each([
    ['a prepaid order', { paymentGatewayCode: 'razorpay', paymentStatus: 'PAID' }],
    ['a COD order already settled', { paymentGatewayCode: 'cod', paymentStatus: 'PAID' }],
  ])('leaves the payment status of %s alone', async (_label, payment) => {
    const { service, tx } = setup({ status: 'SHIPPED', ...payment });

    await service.updateStatus('store_1', 'ord_1', 'DELIVERED');

    expect(tx.order.update).toHaveBeenCalledWith({ where: { id: 'ord_1' }, data: { status: 'DELIVERED' } });
  });

  it('other transitions never touch a COD payment status', async () => {
    const { service, tx } = setup({ status: 'SHIPPED', paymentGatewayCode: 'cod', paymentStatus: 'PENDING' });

    await service.updateStatus('store_1', 'ord_1', 'RETURNED');

    expect(tx.order.update).toHaveBeenCalledWith({ where: { id: 'ord_1' }, data: { status: 'RETURNED' } });
  });
});
