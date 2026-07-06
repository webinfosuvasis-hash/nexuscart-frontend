import { NotFoundException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { CustomerShipmentService } from '../customer-shipment.service';

const STORE_ID = 'store_1';
const CUSTOMER_ID = 'cust_1';
const ORDER_ID = 'order_1';

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: ORDER_ID,
    storeId: STORE_ID,
    customerId: CUSTOMER_ID,
    orderNumber: 'ORD-1001',
    status: OrderStatus.SHIPPED,
    items: [
      {
        id: 'item_1', productId: 'prod_1', variantId: null, productName: 'Ring', variantName: null,
        sku: 'SKU-1', thumbnail: 'https://img/1.jpg',
      },
      {
        id: 'item_2', productId: 'prod_2', variantId: 'var_2', productName: 'Necklace', variantName: 'Gold',
        sku: 'SKU-2', thumbnail: 'https://img/2.jpg',
      },
    ],
    statusHistory: [
      { id: 'hist_1', status: OrderStatus.PENDING, note: null, createdAt: new Date('2026-01-01') },
      { id: 'hist_2', status: OrderStatus.SHIPPED, note: 'Shipment created', createdAt: new Date('2026-01-02') },
    ],
    shipments: [
      {
        id: 'ship_1', orderId: ORDER_ID, trackingNumber: 'TRK123', carrier: 'FedEx', status: 'SHIPPED',
        shippedAt: new Date('2026-01-02'), deliveredAt: null, createdAt: new Date('2026-01-02'),
      },
    ],
    ...overrides,
  } as any;
}

function makeDeps() {
  const prisma = { shipmentItem: { findMany: jest.fn() } } as any;
  const ordersService = { findOne: jest.fn() } as any;
  return { prisma, ordersService };
}

function makeService(deps: ReturnType<typeof makeDeps>) {
  return new CustomerShipmentService(deps.prisma, deps.ordersService);
}

describe('CustomerShipmentService — getShipmentDetails', () => {
  it('reuses OrdersService.findOne and maps shipments + matched items', async () => {
    const deps = makeDeps();
    deps.ordersService.findOne.mockResolvedValue(makeOrder());
    deps.prisma.shipmentItem.findMany.mockResolvedValue([
      { id: 'si_1', shipmentId: 'ship_1', orderId: ORDER_ID, productId: 'prod_1', variantId: null, quantity: 1 },
      { id: 'si_2', shipmentId: 'ship_1', orderId: ORDER_ID, productId: 'prod_2', variantId: 'var_2', quantity: 2 },
    ]);
    const service = makeService(deps);

    const result = await service.getShipmentDetails(ORDER_ID, CUSTOMER_ID, STORE_ID);

    expect(deps.ordersService.findOne).toHaveBeenCalledWith(STORE_ID, ORDER_ID);
    expect(result.shipments).toHaveLength(1);
    expect(result.shipments[0]).toEqual(expect.objectContaining({
      id: 'ship_1', status: 'SHIPPED', trackingNumber: 'TRK123', carrier: 'FedEx', carrierUrl: null, expectedDelivery: null,
    }));
    expect(result.shipments[0].items).toEqual([
      { productId: 'prod_1', variantId: null, productName: 'Ring', variantName: null, thumbnail: 'https://img/1.jpg', sku: 'SKU-1', quantity: 1 },
      { productId: 'prod_2', variantId: 'var_2', productName: 'Necklace', variantName: 'Gold', thumbnail: 'https://img/2.jpg', sku: 'SKU-2', quantity: 2 },
    ]);
  });

  it('returns an empty shipments array (never throws) when nothing has shipped yet', async () => {
    const deps = makeDeps();
    deps.ordersService.findOne.mockResolvedValue(makeOrder({ shipments: [], status: OrderStatus.PENDING }));
    const service = makeService(deps);

    const result = await service.getShipmentDetails(ORDER_ID, CUSTOMER_ID, STORE_ID);

    expect(result.shipments).toEqual([]);
    expect(deps.prisma.shipmentItem.findMany).not.toHaveBeenCalled();
  });

  it('falls back to null product fields when a ShipmentItem has no matching OrderItem (data anomaly)', async () => {
    const deps = makeDeps();
    deps.ordersService.findOne.mockResolvedValue(makeOrder());
    deps.prisma.shipmentItem.findMany.mockResolvedValue([
      { id: 'si_orphan', shipmentId: 'ship_1', orderId: ORDER_ID, productId: 'prod_missing', variantId: null, quantity: 1 },
    ]);
    const service = makeService(deps);

    const result = await service.getShipmentDetails(ORDER_ID, CUSTOMER_ID, STORE_ID);

    expect(result.shipments[0].items).toEqual([
      { productId: 'prod_missing', variantId: null, productName: null, variantName: null, thumbnail: null, sku: null, quantity: 1 },
    ]);
  });

  it('throws NotFoundException (never leaking the order) when it belongs to a different customer', async () => {
    const deps = makeDeps();
    deps.ordersService.findOne.mockResolvedValue(makeOrder({ customerId: 'someone_else' }));
    const service = makeService(deps);

    await expect(service.getShipmentDetails(ORDER_ID, CUSTOMER_ID, STORE_ID)).rejects.toBeInstanceOf(NotFoundException);
    expect(deps.prisma.shipmentItem.findMany).not.toHaveBeenCalled();
  });

  it('propagates NotFoundException from OrdersService.findOne when the order does not exist in this store', async () => {
    const deps = makeDeps();
    deps.ordersService.findOne.mockRejectedValue(new NotFoundException('Order not found'));
    const service = makeService(deps);

    await expect(service.getShipmentDetails(ORDER_ID, CUSTOMER_ID, STORE_ID)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('handles multiple shipments (partial fulfillment) independently', async () => {
    const deps = makeDeps();
    deps.ordersService.findOne.mockResolvedValue(makeOrder({
      shipments: [
        { id: 'ship_1', orderId: ORDER_ID, trackingNumber: 'TRK1', carrier: 'FedEx', status: 'DELIVERED', shippedAt: new Date('2026-01-02'), deliveredAt: new Date('2026-01-05') },
        { id: 'ship_2', orderId: ORDER_ID, trackingNumber: 'TRK2', carrier: 'DHL', status: 'SHIPPED', shippedAt: new Date('2026-01-03'), deliveredAt: null },
      ],
    }));
    deps.prisma.shipmentItem.findMany.mockResolvedValue([
      { id: 'si_1', shipmentId: 'ship_1', orderId: ORDER_ID, productId: 'prod_1', variantId: null, quantity: 1 },
      { id: 'si_2', shipmentId: 'ship_2', orderId: ORDER_ID, productId: 'prod_2', variantId: 'var_2', quantity: 2 },
    ]);
    const service = makeService(deps);

    const result = await service.getShipmentDetails(ORDER_ID, CUSTOMER_ID, STORE_ID);

    expect(result.shipments).toHaveLength(2);
    expect(result.shipments[0].items).toHaveLength(1);
    expect(result.shipments[0].items[0].productId).toBe('prod_1');
    expect(result.shipments[1].items).toHaveLength(1);
    expect(result.shipments[1].items[0].productId).toBe('prod_2');
  });
});

describe('CustomerShipmentService — getTracking', () => {
  it('returns the order\'s real OrderStatusHistory verbatim as the timeline', async () => {
    const deps = makeDeps();
    deps.ordersService.findOne.mockResolvedValue(makeOrder());
    const service = makeService(deps);

    const result = await service.getTracking(ORDER_ID, CUSTOMER_ID, STORE_ID);

    expect(result.timeline).toEqual([
      { id: 'hist_1', status: OrderStatus.PENDING, note: null, createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 'hist_2', status: OrderStatus.SHIPPED, note: 'Shipment created', createdAt: '2026-01-02T00:00:00.000Z' },
    ]);
    expect(result.orderStatus).toBe(OrderStatus.SHIPPED);
  });

  it('never includes item details in the tracking shipments (that is getShipmentDetails\' job)', async () => {
    const deps = makeDeps();
    deps.ordersService.findOne.mockResolvedValue(makeOrder());
    const service = makeService(deps);

    const result: any = await service.getTracking(ORDER_ID, CUSTOMER_ID, STORE_ID);

    expect(result.shipments[0]).not.toHaveProperty('items');
    expect(deps.prisma.shipmentItem.findMany).not.toHaveBeenCalled();
  });

  it('returns an empty timeline and shipments array gracefully for a brand-new order', async () => {
    const deps = makeDeps();
    deps.ordersService.findOne.mockResolvedValue(makeOrder({ statusHistory: [], shipments: [], status: OrderStatus.PENDING }));
    const service = makeService(deps);

    const result = await service.getTracking(ORDER_ID, CUSTOMER_ID, STORE_ID);

    expect(result.timeline).toEqual([]);
    expect(result.shipments).toEqual([]);
  });

  it('throws NotFoundException (never leaking the order) when it belongs to a different customer', async () => {
    const deps = makeDeps();
    deps.ordersService.findOne.mockResolvedValue(makeOrder({ customerId: 'someone_else' }));
    const service = makeService(deps);

    await expect(service.getTracking(ORDER_ID, CUSTOMER_ID, STORE_ID)).rejects.toBeInstanceOf(NotFoundException);
  });
});
