import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CartStatus, CheckoutStatus } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

import { CheckoutService } from './checkout.service';
import { CheckoutEngineService } from './engine/checkout-engine.service';
import { CheckoutEventBus } from './events/checkout-event-bus.service';
import { CHECKOUT_ADDRESS_VALIDATOR } from './engines/checkout-engine-tokens';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryReservationService } from '../../shared/inventory/inventory-reservation.service';

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockPrisma = () => ({
  cart: {
    findFirst:  jest.fn(),
    updateMany: jest.fn(),
  },
  checkoutSession: {
    findFirst: jest.fn(),
    create:    jest.fn(),
    update:    jest.fn(),
    findMany:  jest.fn(),
  },
  checkoutAddressSnapshot: {
    deleteMany: jest.fn(),
    create:     jest.fn(),
  },
  checkoutActivity: {
    findMany: jest.fn(),
  },
});

const engineOutput = {
  items:                    [],
  totals:                   { subtotal: 500, totalDiscount: 0, promotionDiscount: 0, shippingCost: 99, taxAmount: 45, grandTotal: 644, currencyCode: 'INR' },
  availableShippingMethods: [],
  selectedShippingMethod:   null,
  taxBreakdown:             [],
  appliedPromotion:         null,
  validation:               { isValid: true, hasBlockers: false, issues: [] },
  warnings:                 [],
  pipelineDurationMs:       8,
};

const mockEngine  = () => ({ run: jest.fn().mockResolvedValue(engineOutput) });
const mockBus     = () => ({ emit: jest.fn() });
const mockReservations = () => ({ releaseForCheckout: jest.fn().mockResolvedValue(0) });
let reservations: ReturnType<typeof mockReservations>;
const mockAddr    = () => ({ validate: jest.fn().mockResolvedValue({ isValid: true, errors: [] }) });
const mockConfig  = () => ({
  get: jest.fn().mockReturnValue({ sessionTimeoutMinutes: 30, debugMode: false, freeShippingThreshold: 999, storeStateCode: 'KA' }),
});

// ─── Fixtures ────────────────────────────────────────────────────────────────

const STORE   = 'store-1';
const SESSION = 'aaaabbbbccccddddaaaabbbbccccdddd';
const CART_ID = 'cart-1';
const CO_ID   = 'co-1';

const baseCart = (status: CartStatus = CartStatus.ACTIVE, id = CART_ID) => ({
  id, storeId: STORE, sessionId: SESSION, customerId: null, status,
  version: 1, currencyCode: 'INR', couponCode: null,
  lockedAt: null, lockedUntil: null, checkoutStartedAt: null,
  createdAt: new Date(), updatedAt: new Date(),
  items: [
    { id: 'item-1', productId: 'prod-1', variantId: null, quantity: 1, unitPrice: '500', lineDiscount: '0', lineTotal: '500', taxCategory: null, variantOptions: null, inventorySource: 'PRODUCT', sku: 'SKU1', name: 'Widget', brand: null, image: '/img.jpg', warehouseId: null, slug: 'widget', seoUrl: null, comparePrice: null, hsn: null, gstClass: null, weight: null, dimensions: null, appliedPromotions: null, createdAt: new Date(), updatedAt: new Date(), storeId: STORE, cartId: id },
  ],
});

const baseCheckout = (id = CO_ID) => ({
  id, storeId: STORE, cartId: CART_ID, cartVersion: 1, sessionId: SESSION,
  customerId: null, status: CheckoutStatus.PENDING, isValid: false,
  validatedAt: null, selectedShippingMethodId: null,
  expiresAt: new Date(Date.now() + 30 * 60_000),
  traceId: null, spanId: null, correlationId: null, requestId: null,
  ipAddress: null, userAgent: null, cancelledAt: null, completedAt: null,
  createdAt: new Date(), updatedAt: new Date(),
  addresses: [],
});

const baseReq = (overrides: Record<string, unknown> = {}): any => ({
  storeId:       STORE,
  cartSessionId: SESSION,
  ip:            '127.0.0.1',
  headers:       { 'user-agent': 'jest-test' },
  traceId:       'a'.repeat(32),
  spanId:        'b'.repeat(16),
  correlationId: 'corr-001',
  requestId:     'req-001',
  ...overrides,
});

// ─── Test suite ──────────────────────────────────────────────────────────────

describe('CheckoutService.startCheckout', () => {
  let service: CheckoutService;
  let prisma:  ReturnType<typeof mockPrisma>;
  let engine:  ReturnType<typeof mockEngine>;
  let bus:     ReturnType<typeof mockBus>;

  beforeEach(async () => {
    reservations = mockReservations();
    prisma = mockPrisma();
    engine = mockEngine();
    bus    = mockBus();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckoutService,
        { provide: PrismaService,            useValue: prisma },
        { provide: CheckoutEngineService,    useValue: engine },
        { provide: CheckoutEventBus,         useValue: bus },
        { provide: ConfigService,            useValue: mockConfig() },
        { provide: CHECKOUT_ADDRESS_VALIDATOR, useValue: mockAddr() },
        { provide: InventoryReservationService, useValue: reservations },
      ],
    }).compile();

    service = module.get(CheckoutService);
  });

  // ── 1. First checkout creation ────────────────────────────────────────────

  it('creates a new checkout session for an active cart', async () => {
    const cart = baseCart();
    const checkout = baseCheckout();

    prisma.cart.findFirst.mockResolvedValueOnce(cart);       // ACTIVE cart found
    prisma.cart.updateMany.mockResolvedValueOnce({ count: 1 });
    prisma.checkoutSession.create.mockResolvedValueOnce({ ...checkout, addresses: [] });

    const result = await service.startCheckout(baseReq());

    expect(prisma.checkoutSession.create).toHaveBeenCalledTimes(1);
    expect(prisma.cart.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: CART_ID, status: CartStatus.ACTIVE }),
        data:  expect.objectContaining({ status: CartStatus.LOCKED }),
      }),
    );
    expect(result.id).toBe(CO_ID);
    expect(result.status).toBe(CheckoutStatus.PENDING);
    expect(bus.emit).toHaveBeenCalledTimes(1);
  });

  it('throws BadRequestException when cart is empty', async () => {
    const emptyCart = { ...baseCart(), items: [] };
    prisma.cart.findFirst.mockResolvedValueOnce(emptyCart);

    await expect(service.startCheckout(baseReq())).rejects.toThrow(BadRequestException);
    expect(prisma.cart.updateMany).not.toHaveBeenCalled();
    expect(prisma.checkoutSession.create).not.toHaveBeenCalled();
  });

  // ── 2. Duplicate checkout request — 409 ──────────────────────────────────

  it('throws ConflictException (409) when cart is already locked with an active checkout', async () => {
    // No ACTIVE cart (cart is LOCKED)
    prisma.cart.findFirst
      .mockResolvedValueOnce(null)                                          // ACTIVE cart not found
      .mockResolvedValueOnce({ id: CART_ID });                             // LOCKED cart found

    prisma.checkoutSession.findFirst.mockResolvedValueOnce({ id: CO_ID }); // existing checkout

    await expect(service.startCheckout(baseReq())).rejects.toThrow(ConflictException);
    expect(prisma.checkoutSession.create).not.toHaveBeenCalled();
    expect(prisma.cart.updateMany).not.toHaveBeenCalled();
  });

  // ── 3. Resumed checkout response body ─────────────────────────────────────

  it('includes checkoutId and resume:true in the 409 ConflictException body', async () => {
    prisma.cart.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: CART_ID });
    prisma.checkoutSession.findFirst.mockResolvedValueOnce({ id: CO_ID });

    let caught: ConflictException | null = null;
    try {
      await service.startCheckout(baseReq());
    } catch (e) {
      caught = e as ConflictException;
    }

    expect(caught).toBeInstanceOf(ConflictException);
    const body = caught!.getResponse() as Record<string, unknown>;
    expect(body.error).toBe('CHECKOUT_ALREADY_ACTIVE');
    expect(body.message).toBe('A checkout session is already active for this cart.');
    expect(body.checkoutId).toBe(CO_ID);
    expect(body.resume).toBe(true);
  });

  it('does NOT lock the cart when returning 409 (cart stays in current state)', async () => {
    prisma.cart.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: CART_ID });
    prisma.checkoutSession.findFirst.mockResolvedValueOnce({ id: CO_ID });

    await expect(service.startCheckout(baseReq())).rejects.toThrow(ConflictException);
    expect(prisma.cart.updateMany).not.toHaveBeenCalled();
  });

  // ── 4. Concurrent requests ────────────────────────────────────────────────

  it('race condition: only one of two concurrent starts succeeds (optimistic lock)', async () => {
    const cart = baseCart();
    const checkout = baseCheckout();

    // Both requests find the ACTIVE cart simultaneously
    prisma.cart.findFirst
      .mockResolvedValue(cart);          // both calls get the same cart snapshot

    // First request wins the lock, second loses (count: 0)
    prisma.cart.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    prisma.checkoutSession.create.mockResolvedValueOnce({ ...checkout, addresses: [] });

    const [result1, result2] = await Promise.allSettled([
      service.startCheckout(baseReq()),
      service.startCheckout(baseReq()),
    ]);

    expect(result1.status).toBe('fulfilled');
    expect(result2.status).toBe('rejected');
    expect((result2 as PromiseRejectedResult).reason).toBeInstanceOf(ConflictException);
    expect(prisma.checkoutSession.create).toHaveBeenCalledTimes(1);
  });

  it('409 is NOT triggered when locked cart has no active checkout (stale lock)', async () => {
    // Cart is locked but checkout is cancelled/completed — no active checkout found
    prisma.cart.findFirst
      .mockResolvedValueOnce(null)         // no ACTIVE cart
      .mockResolvedValueOnce({ id: CART_ID }); // LOCKED cart exists

    prisma.checkoutSession.findFirst.mockResolvedValueOnce(null); // but no active checkout

    await expect(service.startCheckout(baseReq())).rejects.toThrow(NotFoundException);
    expect(prisma.checkoutSession.create).not.toHaveBeenCalled();
  });

  it('falls through to NotFoundException when no cart exists at all', async () => {
    // No ACTIVE cart, no LOCKED cart either
    prisma.cart.findFirst
      .mockResolvedValueOnce(null)   // no ACTIVE
      .mockResolvedValueOnce(null);  // no LOCKED

    await expect(service.startCheckout(baseReq())).rejects.toThrow(NotFoundException);
  });
});

// ─── Checkout ownership (cart session) ──────────────────────────────────────

describe('CheckoutService — a checkout id alone is not authorization', () => {
  let service: CheckoutService;
  let prisma:  ReturnType<typeof mockPrisma>;

  const OTHER_SESSION = 'ffffeeeeddddccccffffeeeeddddcccc';

  beforeEach(async () => {
    reservations = mockReservations();
    prisma = mockPrisma();
    // Behaves like the DB: the checkout matches only its own store + session.
    prisma.checkoutSession.findFirst.mockImplementation(async ({ where }: any) =>
      where.id === CO_ID && where.storeId === STORE && (where.sessionId === undefined || where.sessionId === SESSION)
        ? { ...baseCheckout(), addresses: [{ type: 'SHIPPING', email: 'asha@example.com' }] }
        : null);
    prisma.cart.findFirst.mockResolvedValue(baseCart(CartStatus.LOCKED));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckoutService,
        { provide: PrismaService,            useValue: prisma },
        { provide: CheckoutEngineService,    useValue: mockEngine() },
        { provide: CheckoutEventBus,         useValue: mockBus() },
        { provide: ConfigService,            useValue: mockConfig() },
        { provide: CHECKOUT_ADDRESS_VALIDATOR, useValue: mockAddr() },
        { provide: InventoryReservationService, useValue: reservations },
      ],
    }).compile();

    service = module.get(CheckoutService);
  });

  const foreignReq = () => baseReq({ cartSessionId: OTHER_SESSION });

  it('lets the owning session read its checkout', async () => {
    const res = await service.getCheckout(CO_ID, baseReq());
    expect(res.id).toBe(CO_ID);
    expect(prisma.checkoutSession.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: CO_ID, storeId: STORE, sessionId: SESSION },
    }));
  });

  it.each([
    ['read it (contact details + session id)', (s: CheckoutService) => s.getCheckout(CO_ID, foreignReq())],
    ['read its summary',                      (s: CheckoutService) => s.getSummary(CO_ID, foreignReq())],
    ['read its activity log',                 (s: CheckoutService) => s.getActivity(CO_ID, foreignReq())],
    ['validate it',                           (s: CheckoutService) => s.validateCheckout(CO_ID, foreignReq())],
    ['cancel it',                             (s: CheckoutService) => s.cancelCheckout(CO_ID, foreignReq())],
    ['change its shipping method',            (s: CheckoutService) => s.updateShipping(CO_ID, { shippingMethodId: 'standard' } as any, foreignReq())],
    ['change its delivery address',           (s: CheckoutService) => s.updateAddress(CO_ID, { shippingAddress: {} } as any, foreignReq())],
  ])('404s when another session tries to %s', async (_label, call) => {
    await expect(call(service)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.checkoutSession.update).not.toHaveBeenCalled();
    expect(reservations.releaseForCheckout).not.toHaveBeenCalled();
    expect(prisma.checkoutAddressSnapshot.create).not.toHaveBeenCalled();
    expect(prisma.cart.updateMany).not.toHaveBeenCalled();
  });

  it('cancel by the owning session returns the stock held for its payment attempts', async () => {
    prisma.checkoutSession.update.mockResolvedValue({ ...baseCheckout(), status: CheckoutStatus.CANCELLED });
    prisma.cart.updateMany.mockResolvedValue({ count: 1 });

    await service.cancelCheckout(CO_ID, baseReq());

    expect(reservations.releaseForCheckout).toHaveBeenCalledWith(CO_ID, STORE);
  });

  it('getSummaryForVerifiedOwner (payment service only) is store-scoped, not session-scoped', async () => {
    const res = await service.getSummaryForVerifiedOwner(CO_ID, STORE);
    expect(res.id).toBe(CO_ID);
    await expect(service.getSummaryForVerifiedOwner(CO_ID, 'other-store')).rejects.toBeInstanceOf(NotFoundException);
  });
});
