import { BadRequestException, ConflictException, GoneException, NotFoundException } from '@nestjs/common';
import { InsufficientStockException } from '@/shared/inventory/inventory-reservation.service';
import { CheckoutStatus, PaymentTxStatus } from '@prisma/client';
import { CustomerPaymentService } from '../customer-payment.service';
import { InvalidPaymentTransitionException } from '@/modules/payment/exceptions/payment.exceptions';

const STORE_ID = 'store_1';
const CUSTOMER = {
  id: 'cust_1', storeId: STORE_ID, email: 'priya@example.com', name: 'Priya Sharma', isActive: true,
};
const CHECKOUT_ID = 'checkout_1';
const CART_SESSION = 'c'.repeat(32);
const PAYMENT_ID = 'pay_1';

function makeCheckout(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: CHECKOUT_ID,
    storeId: STORE_ID,
    sessionId: CART_SESSION,
    customerId: null,
    status: CheckoutStatus.VALIDATED,
    expiresAt: new Date(Date.now() + 60 * 60_000),
    ...overrides,
  };
}

function makeSummary(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    validation: { isValid: true, hasBlockers: false, issues: [] },
    totals: { grandTotal: 999.5, currencyCode: 'INR' },
    items: [{ productId: 'prod_1', variantId: null, quantity: 2 }],
    expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(),
    ...overrides,
  } as any;
}

function makeTx(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: PAYMENT_ID,
    storeId: STORE_ID,
    checkoutSessionId: CHECKOUT_ID,
    gatewayCode: 'razorpay',
    status: PaymentTxStatus.GATEWAY_CREATED,
    amountInPaise: 99950,
    currency: 'INR',
    attemptNumber: 1,
    gatewayOrderId: 'order_abc',
    orderId: null,
    createdAt: new Date(),
    authorizedAt: null,
    capturedAt: null,
    failedAt: null,
    cancelledAt: null,
    refundedAt: null,
    ...overrides,
  } as any;
}

function makeDeps() {
  const prisma = {
    checkoutSession: {
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    paymentTransaction: {
      findFirst: jest.fn(),
    },
    storePaymentMethod: {
      findFirst: jest.fn().mockResolvedValue({ id: 'method_1' }),
    },
    storePaymentConfig: {
      findUnique: jest.fn().mockResolvedValue({ defaultGateway: 'razorpay' }),
    },
    order: {
      findFirst: jest.fn().mockResolvedValue({ orderNumber: 'ORD-2026-000001' }),
    },
  } as any;

  const checkoutService = {
    getSummaryForVerifiedOwner: jest.fn().mockResolvedValue(makeSummary()),
  } as any;

  const paymentService = {
    createPaymentAttempt: jest.fn(),
    startPayment: jest.fn(),
    retryPayment: jest.fn(),
    capturePayment: jest.fn(),
    getPayment: jest.fn(),
  } as any;

  const orchestrator = {
    completePayment: jest.fn().mockResolvedValue({ orderId: 'order_1', orderNumber: 'ORD-1', recovered: false }),
  } as any;

  const webhookGateway = { capabilities: { requiresWebhook: true } };
  const directGateway = { capabilities: { requiresWebhook: false } };
  const gatewayRegistry = {
    resolve: jest.fn().mockReturnValue(webhookGateway),
  } as any;

  const reservations = {
    reserveForPayment: jest.fn().mockResolvedValue(undefined),
    hasLiveHold: jest.fn().mockResolvedValue(true),
    transferToPayment: jest.fn().mockResolvedValue(true),
  } as any;

  return {
    prisma, checkoutService, paymentService, orchestrator, gatewayRegistry, webhookGateway, directGateway, reservations,
  };
}

function makeService(deps: ReturnType<typeof makeDeps>) {
  return new CustomerPaymentService(
    deps.prisma, deps.checkoutService, deps.paymentService, deps.orchestrator, deps.gatewayRegistry, deps.reservations,
  );
}

// The cart session the checkout was started with — required to claim it.
const FAKE_REQ = { cartSessionId: CART_SESSION } as any;

describe('CustomerPaymentService — initiatePayment', () => {
  it('claims an unclaimed checkout for the paying customer', async () => {
    const deps = makeDeps();
    deps.prisma.checkoutSession.findFirst.mockResolvedValue(makeCheckout({ customerId: null }));
    deps.prisma.checkoutSession.update.mockResolvedValue(makeCheckout({ customerId: CUSTOMER.id }));
    deps.paymentService.createPaymentAttempt.mockResolvedValue(makeTx({ status: PaymentTxStatus.PENDING }));
    deps.paymentService.startPayment.mockResolvedValue({ transaction: makeTx(), redirectUrl: 'https://pay.example/redirect' });
    const service = makeService(deps);

    await service.initiatePayment(CHECKOUT_ID, CUSTOMER, {}, FAKE_REQ);

    expect(deps.prisma.checkoutSession.update).toHaveBeenCalledWith({
      where: { id: CHECKOUT_ID },
      data: { customerId: CUSTOMER.id },
    });
  });

  it('rejects when the checkout does not exist in this store', async () => {
    const deps = makeDeps();
    deps.prisma.checkoutSession.findFirst.mockResolvedValue(null);
    const service = makeService(deps);

    await expect(service.initiatePayment(CHECKOUT_ID, CUSTOMER, {}, FAKE_REQ)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects (404, never 403) when the checkout already belongs to a different customer', async () => {
    const deps = makeDeps();
    deps.prisma.checkoutSession.findFirst.mockResolvedValue(makeCheckout({ customerId: 'someone_else' }));
    const service = makeService(deps);

    await expect(service.initiatePayment(CHECKOUT_ID, CUSTOMER, {}, FAKE_REQ)).rejects.toBeInstanceOf(NotFoundException);
    expect(deps.checkoutService.getSummaryForVerifiedOwner).not.toHaveBeenCalled();
  });

  it('does not re-claim (no write) a checkout already owned by this same customer', async () => {
    const deps = makeDeps();
    deps.prisma.checkoutSession.findFirst.mockResolvedValue(makeCheckout({ customerId: CUSTOMER.id }));
    deps.paymentService.createPaymentAttempt.mockResolvedValue(makeTx({ status: PaymentTxStatus.PENDING }));
    deps.paymentService.startPayment.mockResolvedValue({ transaction: makeTx() });
    const service = makeService(deps);

    await service.initiatePayment(CHECKOUT_ID, CUSTOMER, {}, FAKE_REQ);

    expect(deps.prisma.checkoutSession.update).not.toHaveBeenCalled();
  });

  it.each([CheckoutStatus.CANCELLED, CheckoutStatus.EXPIRED, CheckoutStatus.COMPLETED])(
    'rejects a %s checkout with GoneException',
    async (status) => {
      const deps = makeDeps();
      deps.prisma.checkoutSession.findFirst.mockResolvedValue(makeCheckout({ customerId: CUSTOMER.id, status }));
      const service = makeService(deps);

      await expect(service.initiatePayment(CHECKOUT_ID, CUSTOMER, {}, FAKE_REQ)).rejects.toBeInstanceOf(GoneException);
    },
  );

  it('rejects a checkout past its expiresAt even if status has not caught up yet', async () => {
    const deps = makeDeps();
    deps.prisma.checkoutSession.findFirst.mockResolvedValue(
      makeCheckout({ customerId: CUSTOMER.id, status: CheckoutStatus.VALIDATED, expiresAt: new Date(Date.now() - 1000) }),
    );
    const service = makeService(deps);

    await expect(service.initiatePayment(CHECKOUT_ID, CUSTOMER, {}, FAKE_REQ)).rejects.toBeInstanceOf(GoneException);
  });

  it('rejects when the live-recomputed checkout summary is not valid', async () => {
    const deps = makeDeps();
    deps.prisma.checkoutSession.findFirst.mockResolvedValue(makeCheckout({ customerId: CUSTOMER.id }));
    deps.checkoutService.getSummaryForVerifiedOwner.mockResolvedValue(makeSummary({
      validation: { isValid: false, hasBlockers: true, issues: [{ code: 'OUT_OF_STOCK', severity: 'error', message: 'Item out of stock' }] },
    }));
    const service = makeService(deps);

    await expect(service.initiatePayment(CHECKOUT_ID, CUSTOMER, {}, FAKE_REQ)).rejects.toBeInstanceOf(BadRequestException);
    expect(deps.paymentService.createPaymentAttempt).not.toHaveBeenCalled();
  });

  it('rejects when the requested gateway has no active StorePaymentMethod for this store', async () => {
    const deps = makeDeps();
    deps.prisma.checkoutSession.findFirst.mockResolvedValue(makeCheckout({ customerId: CUSTOMER.id }));
    deps.prisma.storePaymentMethod.findFirst.mockResolvedValue(null);
    const service = makeService(deps);

    await expect(service.initiatePayment(CHECKOUT_ID, CUSTOMER, { gatewayCode: 'stripe' }, FAKE_REQ))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(deps.paymentService.createPaymentAttempt).not.toHaveBeenCalled();
  });

  it('never lets a shopper pay through the internal mock gateway, even if the store has it active', async () => {
    const deps = makeDeps();
    deps.prisma.checkoutSession.findFirst.mockResolvedValue(makeCheckout({ customerId: CUSTOMER.id }));
    deps.prisma.storePaymentMethod.findFirst.mockResolvedValue({ id: 'pm_mock', gatewayCode: 'mock', isActive: true });
    const service = makeService(deps);

    await expect(service.initiatePayment(CHECKOUT_ID, CUSTOMER, { gatewayCode: 'mock' }, FAKE_REQ))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(deps.paymentService.createPaymentAttempt).not.toHaveBeenCalled();
    expect(deps.paymentService.startPayment).not.toHaveBeenCalled();
  });

  it('refuses a store whose default gateway is mock when the request names none', async () => {
    const deps = makeDeps();
    deps.prisma.checkoutSession.findFirst.mockResolvedValue(makeCheckout({ customerId: CUSTOMER.id }));
    deps.prisma.storePaymentConfig.findUnique.mockResolvedValue({ defaultGateway: 'mock' });
    deps.prisma.storePaymentMethod.findFirst.mockResolvedValue({ id: 'pm_mock', gatewayCode: 'mock', isActive: true });
    const service = makeService(deps);

    await expect(service.initiatePayment(CHECKOUT_ID, CUSTOMER, {}, FAKE_REQ)).rejects.toBeInstanceOf(BadRequestException);
    expect(deps.paymentService.createPaymentAttempt).not.toHaveBeenCalled();
    expect(deps.paymentService.startPayment).not.toHaveBeenCalled();
  });

  it('resolves the store default gateway when none is specified in the request', async () => {
    const deps = makeDeps();
    deps.prisma.checkoutSession.findFirst.mockResolvedValue(makeCheckout({ customerId: CUSTOMER.id }));
    deps.prisma.storePaymentConfig.findUnique.mockResolvedValue({ defaultGateway: 'cod' });
    deps.paymentService.createPaymentAttempt.mockResolvedValue(makeTx({ gatewayCode: 'cod', status: PaymentTxStatus.PENDING }));
    deps.paymentService.startPayment.mockResolvedValue({ transaction: makeTx({ gatewayCode: 'cod' }) });
    const service = makeService(deps);

    await service.initiatePayment(CHECKOUT_ID, CUSTOMER, {}, FAKE_REQ);

    expect(deps.prisma.storePaymentMethod.findFirst).toHaveBeenCalledWith({
      where: { storeId: STORE_ID, gatewayCode: 'cod', isActive: true },
    });
  });

  it('converts the rupee grandTotal to integer paise for the payment amount', async () => {
    const deps = makeDeps();
    deps.prisma.checkoutSession.findFirst.mockResolvedValue(makeCheckout({ customerId: CUSTOMER.id }));
    deps.checkoutService.getSummaryForVerifiedOwner.mockResolvedValue(makeSummary({ totals: { grandTotal: 1234.56, currencyCode: 'INR' } }));
    deps.paymentService.createPaymentAttempt.mockResolvedValue(makeTx({ status: PaymentTxStatus.PENDING }));
    deps.paymentService.startPayment.mockResolvedValue({ transaction: makeTx() });
    const service = makeService(deps);

    await service.initiatePayment(CHECKOUT_ID, CUSTOMER, {}, FAKE_REQ);

    expect(deps.paymentService.createPaymentAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ amountInPaise: 123456, currency: 'INR' }),
    );
  });

  it('marks the checkout PAYMENT_INITIATED after a successful attempt', async () => {
    const deps = makeDeps();
    deps.prisma.checkoutSession.findFirst.mockResolvedValue(makeCheckout({ customerId: CUSTOMER.id }));
    deps.paymentService.createPaymentAttempt.mockResolvedValue(makeTx({ status: PaymentTxStatus.PENDING }));
    deps.paymentService.startPayment.mockResolvedValue({ transaction: makeTx() });
    const service = makeService(deps);

    await service.initiatePayment(CHECKOUT_ID, CUSTOMER, {}, FAKE_REQ);

    expect(deps.prisma.checkoutSession.updateMany).toHaveBeenCalledWith({
      where: { id: CHECKOUT_ID, status: { notIn: [CheckoutStatus.COMPLETED, CheckoutStatus.CANCELLED, CheckoutStatus.EXPIRED] } },
      data: { status: CheckoutStatus.PAYMENT_INITIATED, paymentInitiatedAt: expect.any(Date) },
    });
  });

  it('leaves a webhook-driven gateway (e.g. razorpay) at GATEWAY_CREATED — never calls capturePayment/completePayment', async () => {
    const deps = makeDeps();
    deps.gatewayRegistry.resolve.mockReturnValue(deps.webhookGateway);
    deps.prisma.checkoutSession.findFirst.mockResolvedValue(makeCheckout({ customerId: CUSTOMER.id }));
    deps.paymentService.createPaymentAttempt.mockResolvedValue(makeTx({ status: PaymentTxStatus.PENDING }));
    deps.paymentService.startPayment.mockResolvedValue({
      transaction: makeTx({ status: PaymentTxStatus.GATEWAY_CREATED }),
      redirectUrl: 'https://razorpay.example/checkout/abc',
    });
    const service = makeService(deps);

    const result = await service.initiatePayment(CHECKOUT_ID, CUSTOMER, {}, FAKE_REQ);

    expect(deps.paymentService.capturePayment).not.toHaveBeenCalled();
    expect(deps.orchestrator.completePayment).not.toHaveBeenCalled();
    expect(result.status).toBe(PaymentTxStatus.GATEWAY_CREATED);
    expect(result.redirectUrl).toBe('https://razorpay.example/checkout/abc');
    expect(result.orderId).toBeNull();
  });

  it('for a direct-capture gateway (e.g. cod), synchronously captures and completes the order', async () => {
    const deps = makeDeps();
    deps.gatewayRegistry.resolve.mockReturnValue(deps.directGateway);
    deps.prisma.checkoutSession.findFirst.mockResolvedValue(makeCheckout({ customerId: CUSTOMER.id }));
    deps.paymentService.createPaymentAttempt.mockResolvedValue(makeTx({ gatewayCode: 'cod', status: PaymentTxStatus.PENDING }));
    deps.paymentService.startPayment.mockResolvedValue({
      transaction: makeTx({ gatewayCode: 'cod', status: PaymentTxStatus.GATEWAY_CREATED }),
    });
    deps.paymentService.capturePayment.mockResolvedValue(makeTx({ gatewayCode: 'cod', status: PaymentTxStatus.CAPTURED }));
    deps.paymentService.getPayment.mockResolvedValue(
      makeTx({ gatewayCode: 'cod', status: PaymentTxStatus.CAPTURED, orderId: 'order_1' }),
    );
    const service = makeService(deps);

    const result = await service.initiatePayment(CHECKOUT_ID, CUSTOMER, { gatewayCode: 'cod' }, FAKE_REQ);

    expect(deps.paymentService.capturePayment).toHaveBeenCalledWith(
      expect.objectContaining({ transactionId: PAYMENT_ID, storeId: STORE_ID }),
    );
    expect(deps.orchestrator.completePayment).toHaveBeenCalledWith(PAYMENT_ID, STORE_ID);
    expect(result.status).toBe(PaymentTxStatus.CAPTURED);
    expect(result.orderId).toBe('order_1');
    // The confirmation shows the customer-facing number, scoped to the payment's store.
    expect(result.orderNumber).toBe('ORD-2026-000001');
    expect(deps.prisma.order.findFirst).toHaveBeenCalledWith({ where: { id: 'order_1', storeId: STORE_ID }, select: { orderNumber: true } });
  });

  it('maps a PaymentException thrown by startPayment into a proper HTTP exception', async () => {
    const deps = makeDeps();
    deps.prisma.checkoutSession.findFirst.mockResolvedValue(makeCheckout({ customerId: CUSTOMER.id }));
    deps.paymentService.createPaymentAttempt.mockResolvedValue(makeTx({ status: PaymentTxStatus.PENDING }));
    deps.paymentService.startPayment.mockRejectedValue(
      new InvalidPaymentTransitionException(PaymentTxStatus.CAPTURED, PaymentTxStatus.GATEWAY_CREATED, PAYMENT_ID),
    );
    const service = makeService(deps);

    await expect(service.initiatePayment(CHECKOUT_ID, CUSTOMER, {}, FAKE_REQ)).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('CustomerPaymentService — retryPayment', () => {
  it('retries an owned payment and returns the new attempt', async () => {
    const deps = makeDeps();
    deps.prisma.paymentTransaction.findFirst.mockResolvedValue(makeTx({ status: PaymentTxStatus.FAILED }));
    deps.prisma.checkoutSession.findFirst.mockResolvedValue({ id: CHECKOUT_ID });
    deps.paymentService.retryPayment.mockResolvedValue({
      transaction: makeTx({ id: 'pay_2', status: PaymentTxStatus.GATEWAY_CREATED, attemptNumber: 2 }),
    });
    const service = makeService(deps);

    const result = await service.retryPayment(PAYMENT_ID, CUSTOMER);

    expect(deps.paymentService.retryPayment).toHaveBeenCalledWith(
      expect.objectContaining({ transactionId: PAYMENT_ID, storeId: STORE_ID }),
    );
    expect(result.paymentId).toBe('pay_2');
  });

  it('rejects retrying a payment that does not belong to this customer (404, never 403)', async () => {
    const deps = makeDeps();
    deps.prisma.paymentTransaction.findFirst.mockResolvedValue(makeTx());
    deps.prisma.checkoutSession.findFirst.mockResolvedValue(null); // owned-by-check fails
    const service = makeService(deps);

    await expect(service.retryPayment(PAYMENT_ID, CUSTOMER)).rejects.toBeInstanceOf(NotFoundException);
    expect(deps.paymentService.retryPayment).not.toHaveBeenCalled();
  });

  it('rejects retrying a payment that does not exist in this store', async () => {
    const deps = makeDeps();
    deps.prisma.paymentTransaction.findFirst.mockResolvedValue(null);
    const service = makeService(deps);

    await expect(service.retryPayment(PAYMENT_ID, CUSTOMER)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('maps InvalidPaymentTransitionException (retrying a non-terminal payment) to BadRequestException', async () => {
    const deps = makeDeps();
    deps.prisma.paymentTransaction.findFirst.mockResolvedValue(makeTx({ status: PaymentTxStatus.GATEWAY_CREATED }));
    deps.prisma.checkoutSession.findFirst.mockResolvedValue({ id: CHECKOUT_ID });
    deps.paymentService.retryPayment.mockRejectedValue(
      new InvalidPaymentTransitionException(PaymentTxStatus.GATEWAY_CREATED, PaymentTxStatus.PENDING, PAYMENT_ID),
    );
    const service = makeService(deps);

    await expect(service.retryPayment(PAYMENT_ID, CUSTOMER)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('drives capture + completion when the retried attempt lands on a direct-capture gateway', async () => {
    const deps = makeDeps();
    deps.gatewayRegistry.resolve.mockReturnValue(deps.directGateway);
    deps.prisma.paymentTransaction.findFirst.mockResolvedValue(makeTx({ gatewayCode: 'cod', status: PaymentTxStatus.FAILED }));
    deps.prisma.checkoutSession.findFirst.mockResolvedValue({ id: CHECKOUT_ID });
    deps.paymentService.retryPayment.mockResolvedValue({
      transaction: makeTx({ id: 'pay_2', gatewayCode: 'cod', status: PaymentTxStatus.GATEWAY_CREATED }),
    });
    deps.paymentService.capturePayment.mockResolvedValue(makeTx({ id: 'pay_2', gatewayCode: 'cod', status: PaymentTxStatus.CAPTURED }));
    deps.paymentService.getPayment.mockResolvedValue(
      makeTx({ id: 'pay_2', gatewayCode: 'cod', status: PaymentTxStatus.CAPTURED, orderId: 'order_2' }),
    );
    const service = makeService(deps);

    const result = await service.retryPayment(PAYMENT_ID, CUSTOMER);

    expect(deps.orchestrator.completePayment).toHaveBeenCalledWith('pay_2', STORE_ID);
    expect(result.orderId).toBe('order_2');
  });
});

describe('CustomerPaymentService — getPaymentStatus / getPaymentDetails', () => {
  it('getPaymentStatus returns the minimal polling shape for an owned payment', async () => {
    const deps = makeDeps();
    deps.prisma.paymentTransaction.findFirst.mockResolvedValue(makeTx({ status: PaymentTxStatus.CAPTURED, orderId: 'order_1' }));
    deps.prisma.checkoutSession.findFirst.mockResolvedValue({ id: CHECKOUT_ID });
    const service = makeService(deps);

    const result = await service.getPaymentStatus(PAYMENT_ID, CUSTOMER);

    expect(result).toEqual({ id: PAYMENT_ID, status: PaymentTxStatus.CAPTURED, orderId: 'order_1', orderNumber: 'ORD-2026-000001' });
  });

  it('getPaymentDetails never leaks gatewaySignature/checkoutSnapshot-style internals', async () => {
    const deps = makeDeps();
    deps.prisma.paymentTransaction.findFirst.mockResolvedValue(makeTx());
    deps.prisma.checkoutSession.findFirst.mockResolvedValue({ id: CHECKOUT_ID });
    const service = makeService(deps);

    const result: any = await service.getPaymentDetails(PAYMENT_ID, CUSTOMER);

    expect(result).not.toHaveProperty('gatewaySignature');
    expect(result).not.toHaveProperty('checkoutSnapshot');
    expect(result).not.toHaveProperty('gatewayPaymentId');
  });

  it('getPaymentStatus 404s (never 403) for a payment belonging to another customer', async () => {
    const deps = makeDeps();
    deps.prisma.paymentTransaction.findFirst.mockResolvedValue(makeTx());
    deps.prisma.checkoutSession.findFirst.mockResolvedValue(null);
    const service = makeService(deps);

    await expect(service.getPaymentStatus(PAYMENT_ID, CUSTOMER)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('getPaymentDetails 404s for a payment in a different store entirely', async () => {
    const deps = makeDeps();
    deps.prisma.paymentTransaction.findFirst.mockResolvedValue(null);
    const service = makeService(deps);

    await expect(service.getPaymentDetails(PAYMENT_ID, CUSTOMER)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('CustomerPaymentService — guest checkout', () => {
  const SESSION_ID = 'a'.repeat(32);
  const GUEST_REQ = { storeId: STORE_ID, cartSessionId: SESSION_ID } as any;
  const GUEST_ADDRESS = { firstName: 'Asha', lastName: 'Rao', email: 'asha@example.com' };

  function makeGuestDeps() {
    const deps = makeDeps();
    deps.prisma.checkoutAddressSnapshot = { findFirst: jest.fn().mockResolvedValue(GUEST_ADDRESS) };
    return deps;
  }

  it('pays a checkout owned by this cart session, using the shipping address as the payer', async () => {
    const deps = makeGuestDeps();
    deps.prisma.checkoutSession.findFirst.mockResolvedValue(makeCheckout({ sessionId: SESSION_ID }));
    deps.paymentService.createPaymentAttempt.mockResolvedValue(makeTx({ status: PaymentTxStatus.PENDING }));
    deps.paymentService.startPayment.mockResolvedValue({ transaction: makeTx() });
    const service = makeService(deps);

    const result = await service.initiateGuestPayment(CHECKOUT_ID, {}, GUEST_REQ);

    expect(deps.prisma.checkoutSession.findFirst).toHaveBeenCalledWith({
      where: { id: CHECKOUT_ID, storeId: STORE_ID, sessionId: SESSION_ID, customerId: null },
    });
    expect(deps.paymentService.startPayment).toHaveBeenCalledWith(
      PAYMENT_ID, STORE_ID, expect.any(String), { email: 'asha@example.com', name: 'Asha Rao' },
    );
    // A guest payment never claims the checkout for anyone.
    expect(deps.prisma.checkoutSession.update).not.toHaveBeenCalled();
    expect(result.paymentId).toBe(PAYMENT_ID);
  });

  it('404s when the checkout belongs to another session or is already claimed by an account', async () => {
    const deps = makeGuestDeps();
    deps.prisma.checkoutSession.findFirst.mockResolvedValue(null);
    const service = makeService(deps);

    await expect(service.initiateGuestPayment(CHECKOUT_ID, {}, GUEST_REQ)).rejects.toBeInstanceOf(NotFoundException);
    expect(deps.paymentService.createPaymentAttempt).not.toHaveBeenCalled();
  });

  it('404s without touching the database when the request has no cart session', async () => {
    const deps = makeGuestDeps();
    const service = makeService(deps);

    await expect(service.initiateGuestPayment(CHECKOUT_ID, {}, { storeId: STORE_ID } as any))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(deps.prisma.checkoutSession.findFirst).not.toHaveBeenCalled();
  });

  it('rejects a guest checkout whose shipping address has no email', async () => {
    const deps = makeGuestDeps();
    deps.prisma.checkoutSession.findFirst.mockResolvedValue(makeCheckout({ sessionId: SESSION_ID }));
    deps.prisma.checkoutAddressSnapshot.findFirst.mockResolvedValue({ ...GUEST_ADDRESS, email: null });
    const service = makeService(deps);

    await expect(service.initiateGuestPayment(CHECKOUT_ID, {}, GUEST_REQ)).rejects.toBeInstanceOf(BadRequestException);
    expect(deps.paymentService.createPaymentAttempt).not.toHaveBeenCalled();
  });

  it('still enforces payability (expired checkout) on the guest path', async () => {
    const deps = makeGuestDeps();
    deps.prisma.checkoutSession.findFirst.mockResolvedValue(
      makeCheckout({ sessionId: SESSION_ID, expiresAt: new Date(Date.now() - 1000) }),
    );
    const service = makeService(deps);

    await expect(service.initiateGuestPayment(CHECKOUT_ID, {}, GUEST_REQ)).rejects.toBeInstanceOf(GoneException);
  });

  it('getGuestPaymentStatus only resolves payments whose checkout is owned by this session', async () => {
    const deps = makeGuestDeps();
    deps.prisma.paymentTransaction.findFirst.mockResolvedValue(makeTx({ status: PaymentTxStatus.CAPTURED, orderId: 'order_1' }));
    deps.prisma.checkoutSession.findFirst.mockResolvedValue({ id: CHECKOUT_ID });
    const service = makeService(deps);

    const result = await service.getGuestPaymentStatus(PAYMENT_ID, GUEST_REQ);

    expect(deps.prisma.checkoutSession.findFirst).toHaveBeenCalledWith({
      where: { id: CHECKOUT_ID, storeId: STORE_ID, sessionId: SESSION_ID, customerId: null },
      select: { id: true },
    });
    expect(result).toEqual({ id: PAYMENT_ID, status: PaymentTxStatus.CAPTURED, orderId: 'order_1', orderNumber: 'ORD-2026-000001' });
  });

  it('retryGuestPayment 404s for a payment from another session', async () => {
    const deps = makeGuestDeps();
    deps.prisma.paymentTransaction.findFirst.mockResolvedValue(makeTx());
    deps.prisma.checkoutSession.findFirst.mockResolvedValue(null);
    const service = makeService(deps);

    await expect(service.retryGuestPayment(PAYMENT_ID, GUEST_REQ)).rejects.toBeInstanceOf(NotFoundException);
    expect(deps.paymentService.retryPayment).not.toHaveBeenCalled();
  });

  it('retryGuestPayment retries with the guest payer details', async () => {
    const deps = makeGuestDeps();
    deps.prisma.paymentTransaction.findFirst.mockResolvedValue(makeTx({ status: PaymentTxStatus.FAILED }));
    deps.prisma.checkoutSession.findFirst.mockResolvedValue({ id: CHECKOUT_ID });
    deps.paymentService.retryPayment.mockResolvedValue({ transaction: makeTx({ id: 'pay_2' }) });
    const service = makeService(deps);

    const result = await service.retryGuestPayment(PAYMENT_ID, GUEST_REQ);

    expect(deps.paymentService.retryPayment).toHaveBeenCalledWith(expect.objectContaining({
      transactionId: PAYMENT_ID,
      customerInfo: { email: 'asha@example.com', name: 'Asha Rao' },
    }));
    expect(result.paymentId).toBe('pay_2');
  });
});

describe('CustomerPaymentService — stock holds and claim ownership', () => {
  it('holds stock for the payment attempt before the gateway is started', async () => {
    const deps = makeDeps();
    deps.prisma.checkoutSession.findFirst.mockResolvedValue(makeCheckout({ customerId: CUSTOMER.id }));
    deps.paymentService.createPaymentAttempt.mockResolvedValue(makeTx({ status: PaymentTxStatus.PENDING }));
    deps.paymentService.startPayment.mockResolvedValue({ transaction: makeTx() });
    const service = makeService(deps);

    await service.initiatePayment(CHECKOUT_ID, CUSTOMER, {}, FAKE_REQ);

    expect(deps.reservations.reserveForPayment).toHaveBeenCalledWith(expect.objectContaining({
      storeId: STORE_ID,
      checkoutId: CHECKOUT_ID,
      paymentTransactionId: PAYMENT_ID,
      lines: [{ productId: 'prod_1', variantId: null, quantity: 2 }],
    }));
    expect(deps.reservations.reserveForPayment.mock.invocationCallOrder[0])
      .toBeLessThan(deps.paymentService.startPayment.mock.invocationCallOrder[0]);
  });

  it('never reaches the gateway when the stock is gone (409 from the hold)', async () => {
    const deps = makeDeps();
    deps.prisma.checkoutSession.findFirst.mockResolvedValue(makeCheckout({ customerId: CUSTOMER.id }));
    deps.paymentService.createPaymentAttempt.mockResolvedValue(makeTx({ status: PaymentTxStatus.PENDING }));
    deps.reservations.reserveForPayment.mockRejectedValue(new InsufficientStockException(['prod_1']));
    const service = makeService(deps);

    await expect(service.initiatePayment(CHECKOUT_ID, CUSTOMER, {}, FAKE_REQ)).rejects.toBeInstanceOf(ConflictException);
    expect(deps.paymentService.startPayment).not.toHaveBeenCalled();
    expect(deps.prisma.checkoutSession.updateMany).not.toHaveBeenCalled(); // not marked PAYMENT_INITIATED
  });

  it('retry moves the live hold to the new attempt instead of taking stock twice', async () => {
    const deps = makeDeps();
    deps.prisma.paymentTransaction.findFirst.mockResolvedValue(makeTx({ status: PaymentTxStatus.FAILED }));
    deps.prisma.checkoutSession.findFirst.mockResolvedValue({ id: CHECKOUT_ID });
    deps.paymentService.retryPayment.mockResolvedValue({ transaction: makeTx({ id: 'pay_2' }) });
    const service = makeService(deps);

    await service.retryPayment(PAYMENT_ID, CUSTOMER);

    expect(deps.reservations.reserveForPayment).not.toHaveBeenCalled();
    expect(deps.reservations.transferToPayment).toHaveBeenCalledWith(PAYMENT_ID, 'pay_2');
  });

  it('retry after the hold lapsed re-takes the stock first, then moves it to the new attempt', async () => {
    const deps = makeDeps();
    deps.prisma.paymentTransaction.findFirst.mockResolvedValue(makeTx({ status: PaymentTxStatus.FAILED }));
    deps.prisma.checkoutSession.findFirst.mockResolvedValue({ id: CHECKOUT_ID });
    deps.reservations.hasLiveHold.mockResolvedValue(false);
    deps.paymentService.retryPayment.mockResolvedValue({ transaction: makeTx({ id: 'pay_2' }) });
    const service = makeService(deps);

    await service.retryPayment(PAYMENT_ID, CUSTOMER);

    expect(deps.reservations.reserveForPayment).toHaveBeenCalledWith(expect.objectContaining({
      paymentTransactionId: PAYMENT_ID, checkoutId: CHECKOUT_ID,
    }));
    expect(deps.reservations.reserveForPayment.mock.invocationCallOrder[0])
      .toBeLessThan(deps.paymentService.retryPayment.mock.invocationCallOrder[0]);
    expect(deps.reservations.transferToPayment).toHaveBeenCalledWith(PAYMENT_ID, 'pay_2');
  });

  it('retry is refused (409) without contacting the gateway when the lapsed stock was sold meanwhile', async () => {
    const deps = makeDeps();
    deps.prisma.paymentTransaction.findFirst.mockResolvedValue(makeTx({ status: PaymentTxStatus.FAILED }));
    deps.prisma.checkoutSession.findFirst.mockResolvedValue({ id: CHECKOUT_ID });
    deps.reservations.hasLiveHold.mockResolvedValue(false);
    deps.reservations.reserveForPayment.mockRejectedValue(new InsufficientStockException(['prod_1']));
    const service = makeService(deps);

    await expect(service.retryPayment(PAYMENT_ID, CUSTOMER)).rejects.toBeInstanceOf(ConflictException);
    expect(deps.paymentService.retryPayment).not.toHaveBeenCalled();
  });

  it('a signed-in customer cannot claim an unclaimed checkout from a different cart session', async () => {
    const deps = makeDeps();
    deps.prisma.checkoutSession.findFirst.mockResolvedValue(makeCheckout({ customerId: null }));
    const service = makeService(deps);

    await expect(service.initiatePayment(CHECKOUT_ID, CUSTOMER, {}, { cartSessionId: 'f'.repeat(32) } as any))
      .rejects.toBeInstanceOf(NotFoundException);
    await expect(service.initiatePayment(CHECKOUT_ID, CUSTOMER, {}, {} as any))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(deps.prisma.checkoutSession.update).not.toHaveBeenCalled();
    expect(deps.reservations.reserveForPayment).not.toHaveBeenCalled();
  });

  it('a checkout this customer already owns stays payable from any session (unchanged behaviour)', async () => {
    const deps = makeDeps();
    deps.prisma.checkoutSession.findFirst.mockResolvedValue(makeCheckout({ customerId: CUSTOMER.id }));
    deps.paymentService.createPaymentAttempt.mockResolvedValue(makeTx({ status: PaymentTxStatus.PENDING }));
    deps.paymentService.startPayment.mockResolvedValue({ transaction: makeTx() });
    const service = makeService(deps);

    const result = await service.initiatePayment(CHECKOUT_ID, CUSTOMER, {}, {} as any);
    expect(result.paymentId).toBe(PAYMENT_ID);
  });
});
