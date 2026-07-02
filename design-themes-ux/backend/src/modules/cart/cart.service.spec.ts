import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { CartService } from './cart.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CartEngineService } from './engine/cart-engine.service';
import { CartEventBus } from './events/cart-event-bus.service';
import { ConfigService } from '@nestjs/config';
import { CartStatus } from '@prisma/client';

const mockPrisma = () => ({
  cart: {
    findFirst:  jest.fn(),
    create:     jest.fn(),
    update:     jest.fn(),
    updateMany: jest.fn(),
  },
  cartItem: {
    findMany:   jest.fn(),
    findFirst:  jest.fn(),
    create:     jest.fn(),
    update:     jest.fn(),
    delete:     jest.fn(),
    deleteMany: jest.fn(),
  },
  cartActivity: {
    findMany: jest.fn(),
  },
  product: {
    findFirst: jest.fn(),
  },
});

const mockEngine = () => ({
  run: jest.fn().mockResolvedValue({
    items: [], totals: { subtotal: 0, totalDiscount: 0, shippingCost: 0, taxAmount: 0, grandTotal: 0, currencyCode: 'INR' },
    shipping: { available: false, methods: [] },
    validation: { issues: [], hasBlockers: false, isValid: true },
    pipelineDurationMs: 10,
  }),
});

const mockEventBus = () => ({ emit: jest.fn() });

const mockConfig = () => ({
  get: jest.fn().mockReturnValue({ lockTimeoutMinutes: 15, debugMode: false, gcBatchSize: 500 }),
});

const baseCart = {
  id: 'cart-1', storeId: 'store-1', sessionId: 'sess-1', customerId: null,
  status: CartStatus.ACTIVE, version: 1, currencyCode: 'INR', locale: 'en-IN',
  couponCode: null, lockedAt: null, lockedUntil: null, lastActivityAt: new Date(),
  abandonedAt: null, expiredAt: null, archivedAt: null, checkoutStartedAt: null,
  convertedAt: null, mergedIntoCartId: null, exchangeRate: null,
  createdAt: new Date(), updatedAt: new Date(),
};

const baseReq: any = {
  storeId: 'store-1', cartSessionId: 'sess-1', ip: '127.0.0.1',
  headers: { 'user-agent': 'jest' },
  traceId: 'a'.repeat(32), spanId: 'b'.repeat(16),
  correlationId: null, requestId: null,
};

describe('CartService — optimistic concurrency', () => {
  let service: CartService;
  let prisma: ReturnType<typeof mockPrisma>;

  beforeEach(async () => {
    prisma = mockPrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartService,
        { provide: PrismaService,    useValue: prisma },
        { provide: CartEngineService, useValue: mockEngine() },
        { provide: CartEventBus,     useValue: mockEventBus() },
        { provide: ConfigService,    useValue: mockConfig() },
      ],
    }).compile();
    service = module.get(CartService);
  });

  describe('lockCart', () => {
    it('throws 409 when version mismatch (concurrent modification)', async () => {
      prisma.cart.findFirst.mockResolvedValue({ ...baseCart, status: CartStatus.ACTIVE });
      prisma.cart.updateMany.mockResolvedValue({ count: 0 }); // version bumped by another request
      prisma.cart.update.mockResolvedValue(baseCart);
      prisma.cartItem.findMany.mockResolvedValue([]);

      await expect(service.lockCart(baseReq)).rejects.toThrow(ConflictException);
    });

    it('succeeds when version matches', async () => {
      prisma.cart.findFirst
        .mockResolvedValueOnce({ ...baseCart, status: CartStatus.ACTIVE })  // requireActiveCart
        .mockResolvedValueOnce({ ...baseCart, status: CartStatus.LOCKED }); // getCart → findOrCreate
      prisma.cart.updateMany.mockResolvedValue({ count: 1 });
      prisma.cart.update.mockResolvedValue({ ...baseCart, version: 2 });
      prisma.cartItem.findMany.mockResolvedValue([]);

      await expect(service.lockCart(baseReq)).resolves.toBeDefined();
    });
  });

  describe('mergeCarts', () => {
    const guestCart = {
      ...baseCart, id: 'guest-1', sessionId: 'guest-sess',
      version: 1, items: [],
    };

    it('throws 409 when guest cart version mismatch during merge', async () => {
      prisma.cart.findFirst
        .mockResolvedValueOnce(baseCart)   // findOrCreate (dest)
        .mockResolvedValueOnce(guestCart); // guest cart lookup
      prisma.cart.update.mockResolvedValue(baseCart);
      prisma.cart.updateMany.mockResolvedValue({ count: 0 }); // version conflict on guest
      prisma.cartItem.findMany.mockResolvedValue([]);

      await expect(service.mergeCarts('guest-1', baseReq)).rejects.toThrow(ConflictException);
    });
  });

  describe('unlockCart', () => {
    it('throws 409 when version mismatch during unlock', async () => {
      prisma.cart.findFirst.mockResolvedValue({ ...baseCart, status: CartStatus.LOCKED });
      prisma.cart.updateMany.mockResolvedValue({ count: 0 });
      prisma.cartItem.findMany.mockResolvedValue([]);

      await expect(service.unlockCart(baseReq)).rejects.toThrow(ConflictException);
    });
  });
});
