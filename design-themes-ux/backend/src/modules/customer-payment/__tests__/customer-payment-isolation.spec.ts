import { NotFoundException } from '@nestjs/common';
import { CheckoutStatus, PaymentTxStatus } from '@prisma/client';
import { CustomerJwtStrategy } from '@/modules/customer-auth/strategies/customer-jwt.strategy';
import { CustomerPaymentController } from '../customer-payment.controller';
import { CustomerPaymentService } from '../customer-payment.service';

// ---------------------------------------------------------------------------
// Integration test — proves cross-customer/cross-tenant isolation through the
// REAL chain: CustomerJwtStrategy.validate() (resolves the principal attached
// to the request by CustomerJwtAuthGuard) → CustomerPaymentController (real)
// → CustomerPaymentService (real). CheckoutService/PaymentService/
// PaymentOrchestratorService/PaymentGatewayRegistry and PrismaService are all
// test doubles, standing in for two customers in two different stores.
// ---------------------------------------------------------------------------

const STORE_A = 'store_a';
const STORE_B = 'store_b';

const CUSTOMER_A = { id: 'cust_a', storeId: STORE_A, email: 'alice@example.com', name: 'Alice', isActive: true };
const CUSTOMER_A2 = { id: 'cust_a2', storeId: STORE_A, email: 'amit@example.com', name: 'Amit', isActive: true };
const CUSTOMER_B = { id: 'cust_b', storeId: STORE_B, email: 'bob@example.com', name: 'Bob', isActive: true };

const CHECKOUT_A = 'checkout_a';
const CHECKOUT_A2 = 'checkout_a2';
const CHECKOUT_B = 'checkout_b';
const PAYMENT_A = 'pay_a';
const PAYMENT_A2 = 'pay_a2';
const PAYMENT_B = 'pay_b';

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
  return strategy.validate({
    sub: customerId, storeId, email: 'irrelevant@example.com', type: 'customer',
  });
}

function buildHarness() {
  const checkouts: Record<string, any> = {
    [CHECKOUT_A]: {
      id: CHECKOUT_A, storeId: STORE_A, customerId: null, status: CheckoutStatus.VALIDATED,
      expiresAt: new Date(Date.now() + 60 * 60_000),
    },
    [CHECKOUT_A2]: {
      id: CHECKOUT_A2, storeId: STORE_A, customerId: 'cust_a2', status: CheckoutStatus.VALIDATED,
      expiresAt: new Date(Date.now() + 60 * 60_000),
    },
    [CHECKOUT_B]: {
      id: CHECKOUT_B, storeId: STORE_B, customerId: 'cust_b', status: CheckoutStatus.VALIDATED,
      expiresAt: new Date(Date.now() + 60 * 60_000),
    },
  };
  const payments: Record<string, any> = {
    [PAYMENT_A]: {
      id: PAYMENT_A, storeId: STORE_A, checkoutSessionId: CHECKOUT_A, gatewayCode: 'razorpay',
      status: PaymentTxStatus.GATEWAY_CREATED, amountInPaise: 10000, currency: 'INR', attemptNumber: 1,
      orderId: null, createdAt: new Date(), authorizedAt: null, capturedAt: null, failedAt: null,
      cancelledAt: null, refundedAt: null,
    },
    [PAYMENT_A2]: {
      id: PAYMENT_A2, storeId: STORE_A, checkoutSessionId: CHECKOUT_A2, gatewayCode: 'razorpay',
      status: PaymentTxStatus.GATEWAY_CREATED, amountInPaise: 15000, currency: 'INR', attemptNumber: 1,
      orderId: null, createdAt: new Date(), authorizedAt: null, capturedAt: null, failedAt: null,
      cancelledAt: null, refundedAt: null,
    },
    [PAYMENT_B]: {
      id: PAYMENT_B, storeId: STORE_B, checkoutSessionId: CHECKOUT_B, gatewayCode: 'razorpay',
      status: PaymentTxStatus.GATEWAY_CREATED, amountInPaise: 20000, currency: 'INR', attemptNumber: 1,
      orderId: null, createdAt: new Date(), authorizedAt: null, capturedAt: null, failedAt: null,
      cancelledAt: null, refundedAt: null,
    },
  };
  // Keyed by (id, storeId) explicitly to mirror how the real Customer table can never
  // have the same id resolve under two different stores.
  const customersById: Record<string, any> = { cust_a: CUSTOMER_A, cust_a2: CUSTOMER_A2, cust_b: CUSTOMER_B };

  const prisma = {
    checkoutSession: {
      // Mirrors real Prisma's compound-where filtering: every key present on
      // `where` must match, including `customerId` — a mock that only checked
      // `id`/`storeId` would make every same-store cross-customer test below
      // pass for the wrong reason (storeId alone, never actually exercising
      // the customerId boundary the ownership check depends on).
      findFirst: jest.fn().mockImplementation(({ where }: any) => {
        const row = checkouts[where.id];
        if (!row) return Promise.resolve(null);
        if (where.storeId !== undefined && row.storeId !== where.storeId) return Promise.resolve(null);
        if (where.customerId !== undefined && row.customerId !== where.customerId) return Promise.resolve(null);
        return Promise.resolve(row);
      }),
      update: jest.fn().mockImplementation(({ where, data }: any) => {
        Object.assign(checkouts[where.id], data);
        return Promise.resolve(checkouts[where.id]);
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    paymentTransaction: {
      findFirst: jest.fn().mockImplementation(({ where }: any) => {
        const row = payments[where.id];
        if (!row || row.storeId !== where.storeId) return Promise.resolve(null);
        return Promise.resolve(row);
      }),
    },
    storePaymentMethod: { findFirst: jest.fn().mockResolvedValue({ id: 'method_1' }) },
    storePaymentConfig: { findUnique: jest.fn().mockResolvedValue({ defaultGateway: 'razorpay' }) },
  } as any;

  const checkoutService = {
    getSummary: jest.fn().mockResolvedValue({
      validation: { isValid: true, hasBlockers: false, issues: [] },
      totals: { grandTotal: 100, currencyCode: 'INR' },
    }),
  } as any;

  const paymentService = {
    createPaymentAttempt: jest.fn().mockResolvedValue(payments[PAYMENT_A]),
    startPayment: jest.fn().mockResolvedValue({ transaction: payments[PAYMENT_A] }),
    retryPayment: jest.fn(),
    capturePayment: jest.fn(),
    getPayment: jest.fn(),
  } as any;

  const orchestrator = { completePayment: jest.fn() } as any;
  const gatewayRegistry = { resolve: jest.fn().mockReturnValue({ capabilities: { requiresWebhook: true } }) } as any;

  const service = new CustomerPaymentService(prisma, checkoutService, paymentService, orchestrator, gatewayRegistry);
  const controller = new CustomerPaymentController(service);

  return {
    controller, prisma, checkoutService, paymentService, orchestrator, customersById, checkouts, payments,
  };
}

describe('Customer Payment API — cross-customer isolation (integration)', () => {
  it('customer A can initiate payment on their own unclaimed checkout in their own store', async () => {
    const h = buildHarness();
    const principalA = await resolvePrincipal(h.customersById, 'cust_a', STORE_A);

    const result = await h.controller.initiate(principalA, CHECKOUT_A, {}, {} as any);

    expect(result.paymentId).toBe(PAYMENT_A);
    expect(h.checkouts[CHECKOUT_A].customerId).toBe('cust_a');
  });

  it('customer B cannot initiate payment on customer A\'s checkout (different store) — 404', async () => {
    const h = buildHarness();
    const principalB = await resolvePrincipal(h.customersById, 'cust_b', STORE_B);

    await expect(h.controller.initiate(principalB, CHECKOUT_A, {}, {} as any)).rejects.toBeInstanceOf(NotFoundException);
    expect(h.checkoutService.getSummary).not.toHaveBeenCalled();
  });

  it('a forged principal (A\'s id under B\'s storeId) cannot reach A\'s checkout either', async () => {
    const h = buildHarness();
    const forged = { ...CUSTOMER_A, storeId: STORE_B };

    await expect(h.controller.initiate(forged, CHECKOUT_A, {}, {} as any)).rejects.toBeInstanceOf(NotFoundException);
  });

  // Same-store, different-customer — the subtler boundary: storeId alone
  // does NOT separate these two, only customerId does, since CheckoutSession/
  // PaymentTransaction share one store per multi-tenant design.
  it('customer A cannot view customer A2\'s payment status, even though they share a store', async () => {
    const h = buildHarness();
    const principalA = await resolvePrincipal(h.customersById, 'cust_a', STORE_A);

    await expect(h.controller.getStatus(principalA, PAYMENT_A2)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('customer A cannot view customer A2\'s payment details, even though they share a store', async () => {
    const h = buildHarness();
    const principalA = await resolvePrincipal(h.customersById, 'cust_a', STORE_A);

    await expect(h.controller.getDetails(principalA, PAYMENT_A2)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('customer A cannot retry customer A2\'s payment, even though they share a store', async () => {
    const h = buildHarness();
    const principalA = await resolvePrincipal(h.customersById, 'cust_a', STORE_A);

    await expect(h.controller.retry(principalA, PAYMENT_A2)).rejects.toBeInstanceOf(NotFoundException);
    expect(h.paymentService.retryPayment).not.toHaveBeenCalled();
  });

  it('customer A cannot initiate payment on customer A2\'s already-claimed checkout, even though they share a store', async () => {
    const h = buildHarness();
    const principalA = await resolvePrincipal(h.customersById, 'cust_a', STORE_A);

    await expect(h.controller.initiate(principalA, CHECKOUT_A2, {}, {} as any)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('customer A2 can view their own payment status without interference from A\'s data', async () => {
    const h = buildHarness();
    const principalA2 = await resolvePrincipal(h.customersById, 'cust_a2', STORE_A);

    const result = await h.controller.getStatus(principalA2, PAYMENT_A2);

    expect(result.id).toBe(PAYMENT_A2);
  });

  it('customer A cannot view customer B\'s payment status', async () => {
    const h = buildHarness();
    const principalA = await resolvePrincipal(h.customersById, 'cust_a', STORE_A);

    await expect(h.controller.getStatus(principalA, PAYMENT_B)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('customer A cannot view customer B\'s payment details', async () => {
    const h = buildHarness();
    const principalA = await resolvePrincipal(h.customersById, 'cust_a', STORE_A);

    await expect(h.controller.getDetails(principalA, PAYMENT_B)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('customer A cannot retry customer B\'s payment', async () => {
    const h = buildHarness();
    const principalA = await resolvePrincipal(h.customersById, 'cust_a', STORE_A);

    await expect(h.controller.retry(principalA, PAYMENT_B)).rejects.toBeInstanceOf(NotFoundException);
    expect(h.paymentService.retryPayment).not.toHaveBeenCalled();
  });

  it('customer B can fully manage their own already-claimed checkout/payment without interference from A\'s data', async () => {
    const h = buildHarness();
    h.paymentService.createPaymentAttempt.mockResolvedValue(h.payments[PAYMENT_B]);
    h.paymentService.startPayment.mockResolvedValue({ transaction: h.payments[PAYMENT_B] });
    const principalB = await resolvePrincipal(h.customersById, 'cust_b', STORE_B);

    const status = await h.controller.getStatus(principalB, PAYMENT_B);
    expect(status.id).toBe(PAYMENT_B);

    // customerId was already 'cust_b' — re-claiming must be a no-op (never touches A's row either).
    expect(h.checkouts[CHECKOUT_B].customerId).toBe('cust_b');
    expect(h.checkouts[CHECKOUT_A].customerId).toBeNull();
  });

  it('a checkout claimed by B can never be paid for by A, even after B has used it', async () => {
    const h = buildHarness();
    const principalA = await resolvePrincipal(h.customersById, 'cust_a', STORE_A);

    await expect(h.controller.initiate(principalA, CHECKOUT_B, {}, {} as any)).rejects.toBeInstanceOf(NotFoundException);
  });
});
