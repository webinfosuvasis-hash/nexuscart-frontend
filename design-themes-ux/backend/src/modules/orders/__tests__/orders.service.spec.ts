import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';

import { PrismaService } from '@/prisma/prisma.service';
import { OrdersService } from '../orders.service';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const STORE_ID = 'store-1';
const ORDER_ID = 'order-1';
const USER_ID  = 'user-1';

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id:             ORDER_ID,
    storeId:        STORE_ID,
    status:         'PENDING',
    total:          new Prisma.Decimal('1000.00'),
    refundedAmount: new Prisma.Decimal('0.00'),
    customer:       null,
    items:          [],
    statusHistory:  [],
    notes:          [],
    shipments:      [],
    refunds:        [],
    snapshot:       null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Mock factory
// ---------------------------------------------------------------------------

function buildPrismaMock() {
  return {
    order: {
      findFirst:  jest.fn(),
      update:     jest.fn(),
    },
    orderStatusHistory: { create: jest.fn() },
    refund:             { create: jest.fn() },
    $transaction: jest.fn().mockImplementation(async (cb: any) => {
      if (typeof cb === 'function') return cb(buildPrismaMock());
      return Promise.all(cb);
    }),
  };
}

describe('OrdersService — A1 + A2 changes', () => {
  let service: OrdersService;
  let prisma:  ReturnType<typeof buildPrismaMock>;

  beforeEach(async () => {
    prisma = buildPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(OrdersService);
  });

  afterEach(() => jest.clearAllMocks());

  // -------------------------------------------------------------------------
  // TEST-17: STATUS_TRANSITIONS no longer allows PENDING → CANCELLED
  // -------------------------------------------------------------------------
  it('TEST-17: updateStatus rejects CANCELLED as a transition target from PENDING', async () => {
    prisma.order.findFirst.mockResolvedValue(makeOrder({ status: 'PENDING' }));

    await expect(
      service.updateStatus(STORE_ID, ORDER_ID, 'CANCELLED'),
    ).rejects.toThrow(BadRequestException);
  });

  it('TEST-17b: updateStatus rejects CANCELLED as a transition target from PROCESSING', async () => {
    prisma.order.findFirst.mockResolvedValue(makeOrder({ status: 'PROCESSING' }));

    await expect(
      service.updateStatus(STORE_ID, ORDER_ID, 'CANCELLED'),
    ).rejects.toThrow(BadRequestException);
  });

  // P1-2 regression: PROCESSING → SHIPPED must be rejected (only FulfillmentService may do this)
  it('TEST-17d: updateStatus rejects SHIPPED as a transition target from PROCESSING', async () => {
    prisma.order.findFirst.mockResolvedValue(makeOrder({ status: 'PROCESSING' }));

    await expect(
      service.updateStatus(STORE_ID, ORDER_ID, 'SHIPPED'),
    ).rejects.toThrow(BadRequestException);
  });

  it('TEST-17e: updateStatus rejects SHIPPED as a transition target from PENDING', async () => {
    prisma.order.findFirst.mockResolvedValue(makeOrder({ status: 'PENDING' }));

    await expect(
      service.updateStatus(STORE_ID, ORDER_ID, 'SHIPPED'),
    ).rejects.toThrow(BadRequestException);
  });

  it('TEST-17c: updateStatus still allows PENDING → PROCESSING', async () => {
    prisma.order.findFirst.mockResolvedValue(makeOrder({ status: 'PENDING' }));
    prisma.$transaction.mockImplementation(async (cb: any) => {
      const txClient = {
        order:              { update: jest.fn().mockResolvedValue({ id: ORDER_ID, status: 'PROCESSING' }) },
        orderStatusHistory: { create: jest.fn().mockResolvedValue({}) },
      };
      return cb(txClient);
    });

    await expect(
      service.updateStatus(STORE_ID, ORDER_ID, 'PROCESSING'),
    ).resolves.toBeDefined();
  });

  // -------------------------------------------------------------------------
  // TEST-18: recordManualRefund rejects amount > (total - refundedAmount)
  // -------------------------------------------------------------------------
  it('TEST-18: recordManualRefund rejects when amount exceeds remaining refundable', async () => {
    // total=1000, refundedAmount=800, remaining=200 — requesting 300 should fail
    prisma.order.findFirst.mockResolvedValue(
      makeOrder({ total: new Prisma.Decimal('1000.00'), refundedAmount: new Prisma.Decimal('800.00') }),
    );

    await expect(
      service.recordManualRefund(STORE_ID, ORDER_ID, 300, 'test', USER_ID),
    ).rejects.toThrow(BadRequestException);
  });

  it('TEST-18b: recordManualRefund accepts amount within remaining', async () => {
    prisma.order.findFirst.mockResolvedValue(
      makeOrder({ total: new Prisma.Decimal('1000.00'), refundedAmount: new Prisma.Decimal('800.00') }),
    );
    prisma.$transaction.mockImplementation(async (cb: any) => {
      const txClient = {
        refund: { create: jest.fn().mockResolvedValue({ id: 'r1' }) },
        order:  { update: jest.fn().mockResolvedValue({}) },
      };
      return cb(txClient);
    });

    await expect(
      service.recordManualRefund(STORE_ID, ORDER_ID, 200, 'test', USER_ID),
    ).resolves.toBeDefined();
  });

  // -------------------------------------------------------------------------
  // TEST-19: recordManualRefund rejects on CANCELLED order
  // -------------------------------------------------------------------------
  it('TEST-19: recordManualRefund rejects when order is CANCELLED', async () => {
    prisma.order.findFirst.mockResolvedValue(makeOrder({ status: 'CANCELLED' }));

    await expect(
      service.recordManualRefund(STORE_ID, ORDER_ID, 100, 'test', USER_ID),
    ).rejects.toThrow(BadRequestException);
  });
});
