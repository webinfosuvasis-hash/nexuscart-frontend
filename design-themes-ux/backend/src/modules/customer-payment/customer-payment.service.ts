import {
  BadRequestException, GoneException, Injectable, NotFoundException,
} from '@nestjs/common';
import { Request } from 'express';
import { randomUUID } from 'crypto';
import { AddressType, CheckoutSession, CheckoutStatus, PaymentTransaction, PaymentTxStatus } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { CheckoutService } from '@/modules/checkout/checkout.service';
import { PaymentService } from '@/modules/payment/payment.service';
import { PaymentOrchestratorService } from '@/modules/payment-orchestrator/payment-orchestrator.service';
import { PaymentGatewayRegistry } from '@/modules/payment/gateways/payment-gateway-registry.service';
import { StartPaymentResult } from '@/modules/payment/dto/payment-service.types';
import { AuthenticatedCustomer } from '@/modules/customer-auth/types/customer-auth.types';
import { CUSTOMER_GATEWAY_CODES, InitiatePaymentDto } from './dto/initiate-payment.dto';
import {
  PaymentDetailResponseDto, PaymentInitiationResponseDto, PaymentStatusResponseDto,
} from './dto/payment-response.dto';
import { mapPaymentException } from './customer-payment-exception.mapper';
import { InventoryReservationService, StockLine } from '@/shared/inventory/inventory-reservation.service';

const NON_PAYABLE_CHECKOUT_STATUSES = new Set<CheckoutStatus>([
  CheckoutStatus.CANCELLED,
  CheckoutStatus.EXPIRED,
  CheckoutStatus.COMPLETED,
]);

// Deterministic, stable per checkout — deliberately not client-supplied, so
// PaymentService.createPaymentAttempt's own idempotency guard (keyed by
// `checkoutSessionId` + this string) is what makes double-clicking
// "Pay Now" and network retries collapse onto the same PaymentTransaction,
// without this controller needing to implement that itself.
const INITIATE_IDEMPOTENCY_KEY = 'initiate';

// A stock hold never lapses sooner than this after Pay is pressed, even when
// the checkout itself is about to expire — the payment needs time to settle.
const MIN_HOLD_MS = 15 * 60_000;

const holdExpiry = (checkoutExpiresAt: Date | string): Date =>
  new Date(Math.max(new Date(checkoutExpiresAt).getTime(), Date.now() + MIN_HOLD_MS));

const toStockLines = (items: { productId: string; variantId: string | null; quantity: number }[]): StockLine[] =>
  items.map((i) => ({ productId: i.productId, variantId: i.variantId ?? null, quantity: i.quantity }));

/** Who the gateway is told is paying — an account holder, or a guest's checkout address. */
interface PayerInfo {
  storeId: string;
  email: string;
  name: string;
}

/**
 * Customer Payment API — thin orchestration over CheckoutService,
 * PaymentService, PaymentOrchestratorService, and the existing gateway
 * registry. No payment/checkout business logic is duplicated here: pricing
 * comes from CheckoutService's live-recomputed summary, state transitions
 * and gateway calls come from PaymentService, and order creation comes from
 * PaymentOrchestratorService — this class only adds the customer-facing
 * ownership boundary and shapes the HTTP response.
 */
@Injectable()
export class CustomerPaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly checkoutService: CheckoutService,
    private readonly paymentService: PaymentService,
    private readonly orchestrator: PaymentOrchestratorService,
    private readonly gatewayRegistry: PaymentGatewayRegistry,
    private readonly reservations: InventoryReservationService,
  ) {}

  async initiatePayment(
    checkoutId: string,
    customer: AuthenticatedCustomer,
    dto: InitiatePaymentDto,
    req: Request,
  ): Promise<PaymentInitiationResponseDto> {
    const checkout = await this.claimAndAssertOwnership(checkoutId, customer, req);
    return this.startCheckoutPayment(checkout, {
      storeId: customer.storeId, email: customer.email, name: customer.name,
    }, dto);
  }

  async retryPayment(paymentId: string, customer: AuthenticatedCustomer): Promise<PaymentInitiationResponseDto> {
    const tx = await this.loadOwnedTransaction(paymentId, customer);
    return this.retryTransaction(tx, { storeId: customer.storeId, email: customer.email, name: customer.name });
  }

  async getPaymentStatus(paymentId: string, customer: AuthenticatedCustomer): Promise<PaymentStatusResponseDto> {
    const tx = await this.loadOwnedTransaction(paymentId, customer);
    return { id: tx.id, status: tx.status, orderId: tx.orderId, orderNumber: await this.orderNumberFor(tx) };
  }

  // ─── Guest checkout ─────────────────────────────────────────────────────
  //
  // Same payment pipeline, different ownership proof: a guest has no token,
  // so the checkout must belong to the caller's own cart-session cookie
  // (`req.cartSessionId`, set by CartSessionMiddleware, the same cookie the
  // checkout was started with) and must not already be claimed by an
  // account. Gateway customer details come from the checkout's shipping
  // address, which is why a guest address must carry an email.

  async initiateGuestPayment(checkoutId: string, dto: InitiatePaymentDto, req: Request): Promise<PaymentInitiationResponseDto> {
    const guest = this.guestContext(req);
    const checkout = await this.prisma.checkoutSession.findFirst({
      where: { id: checkoutId, storeId: guest.storeId, sessionId: guest.sessionId, customerId: null },
    });
    if (!checkout) {
      throw new NotFoundException('Checkout session not found');
    }
    const payer = await this.resolveGuestPayer(checkout.id, guest.storeId);
    return this.startCheckoutPayment(checkout, payer, dto);
  }

  async retryGuestPayment(paymentId: string, req: Request): Promise<PaymentInitiationResponseDto> {
    const guest = this.guestContext(req);
    const tx = await this.loadGuestTransaction(paymentId, guest);
    const payer = await this.resolveGuestPayer(tx.checkoutSessionId, guest.storeId);
    return this.retryTransaction(tx, payer);
  }

  async getGuestPaymentStatus(paymentId: string, req: Request): Promise<PaymentStatusResponseDto> {
    const tx = await this.loadGuestTransaction(paymentId, this.guestContext(req));
    return { id: tx.id, status: tx.status, orderId: tx.orderId, orderNumber: await this.orderNumberFor(tx) };
  }

  // ─── Shared payment pipeline ────────────────────────────────────────────

  private async startCheckoutPayment(
    checkout: CheckoutSession,
    payer: PayerInfo,
    dto: InitiatePaymentDto,
  ): Promise<PaymentInitiationResponseDto> {
    const checkoutId = checkout.id;
    this.assertPayable(checkout);

    // Live-recomputed by CheckoutEngineService via CheckoutService — never
    // re-derived here, so pricing/validation logic is never duplicated.
    const summary = await this.checkoutService.getSummaryForVerifiedOwner(checkoutId, payer.storeId);
    if (!summary.validation.isValid) {
      throw new BadRequestException({
        message: 'Checkout is not valid for payment',
        issues: summary.validation.issues,
      });
    }

    const gatewayCode = dto.gatewayCode ?? await this.resolveDefaultGateway(payer.storeId);
    // Re-checked after the store default is resolved: a store whose default is
    // the internal 'mock' gateway must not let shoppers create instantly-"paid" orders.
    if (!(CUSTOMER_GATEWAY_CODES as readonly string[]).includes(gatewayCode)) {
      throw new BadRequestException(`Payment method '${gatewayCode}' is not available for this store`);
    }
    const method = await this.prisma.storePaymentMethod.findFirst({
      where: { storeId: payer.storeId, gatewayCode, isActive: true },
    });
    if (!method) {
      throw new BadRequestException(`Payment method '${gatewayCode}' is not available for this store`);
    }

    const amountInPaise = Math.round(summary.totals.grandTotal * 100);

    let tx: PaymentTransaction;
    try {
      tx = await this.paymentService.createPaymentAttempt({
        checkoutSessionId: checkoutId,
        storeId: payer.storeId,
        gatewayCode,
        amountInPaise,
        currency: summary.totals.currencyCode,
        paymentMethodId: method.id,
        idempotencyKey: INITIATE_IDEMPOTENCY_KEY,
      });
    } catch (err) {
      throw mapPaymentException(err);
    }

    // Take the units out of stock before the gateway is involved — all lines
    // or none, 409 if another shopper got there first. Idempotent for the
    // same attempt (double-click / network retry). Deliberately not released
    // if the gateway start below fails: a concurrent duplicate request can
    // fail there while the first succeeds, so the hold is left to the retry
    // (which moves it) or to expiry (InventoryCleanupService).
    await this.reservations.reserveForPayment({
      storeId: payer.storeId,
      checkoutId,
      paymentTransactionId: tx.id,
      lines: toStockLines(summary.items),
      expiresAt: holdExpiry(checkout.expiresAt),
    });

    let startResult: StartPaymentResult;
    try {
      startResult = await this.paymentService.startPayment(
        tx.id,
        payer.storeId,
        randomUUID(),
        { email: payer.email, name: payer.name },
      );
    } catch (err) {
      throw mapPaymentException(err);
    }

    await this.markPaymentInitiated(checkoutId);
    const finalTx = await this.driveDirectCaptureIfApplicable(startResult, payer.storeId);

    return this.toInitiationResponse(finalTx, startResult, await this.orderNumberFor(finalTx));
  }

  private async retryTransaction(tx: PaymentTransaction, payer: PayerInfo): Promise<PaymentInitiationResponseDto> {
    // The failed attempt's hold may have lapsed meanwhile — re-take it (409
    // if the stock is gone) before asking the gateway for a new attempt.
    if (!(await this.reservations.hasLiveHold(tx.id))) {
      const summary = await this.checkoutService.getSummaryForVerifiedOwner(tx.checkoutSessionId, payer.storeId);
      await this.reservations.reserveForPayment({
        storeId: payer.storeId,
        checkoutId: tx.checkoutSessionId,
        paymentTransactionId: tx.id,
        lines: toStockLines(summary.items),
        expiresAt: holdExpiry(summary.expiresAt),
      });
    }

    let result: StartPaymentResult;
    try {
      result = await this.paymentService.retryPayment({
        transactionId: tx.id,
        storeId: payer.storeId,
        idempotencyKey: randomUUID(),
        customerInfo: { email: payer.email, name: payer.name },
      });
    } catch (err) {
      throw mapPaymentException(err);
    }

    // One hold per checkout: it follows the newest attempt rather than being taken twice.
    await this.reservations.transferToPayment(tx.id, result.transaction.id);

    const finalTx = await this.driveDirectCaptureIfApplicable(result, payer.storeId);
    return this.toInitiationResponse(finalTx, result, await this.orderNumberFor(finalTx));
  }

  async getPaymentDetails(paymentId: string, customer: AuthenticatedCustomer): Promise<PaymentDetailResponseDto> {
    const tx = await this.loadOwnedTransaction(paymentId, customer);
    return {
      id: tx.id,
      status: tx.status,
      gatewayCode: tx.gatewayCode,
      amountInPaise: tx.amountInPaise,
      currency: tx.currency,
      attemptNumber: tx.attemptNumber,
      orderId: tx.orderId,
      createdAt: tx.createdAt.toISOString(),
      authorizedAt: tx.authorizedAt?.toISOString() ?? null,
      capturedAt: tx.capturedAt?.toISOString() ?? null,
      failedAt: tx.failedAt?.toISOString() ?? null,
      cancelledAt: tx.cancelledAt?.toISOString() ?? null,
      refundedAt: tx.refundedAt?.toISOString() ?? null,
    };
  }

  // ─── Ownership boundary ─────────────────────────────────────────────────
  //
  // CheckoutSession/PaymentTransaction predate customer-scoped payment (both
  // were built guest-first — CheckoutService's own reads only ever scope by
  // storeId, never customerId). Every method below re-verifies (id, storeId,
  // customerId) itself rather than trusting the caller-supplied id, matching
  // the same defense-in-depth posture as CustomerProfileService/
  // CustomerAddressService.

  /**
   * A checkout with no customerId yet (started before login, or by a true
   * guest) is claimed for this customer on first payment attempt — the same
   * "attach to my account at checkout time" pattern most storefronts use.
   * A checkout already claimed by a *different* customer 404s (never a 403,
   * so cross-tenant existence is never revealed).
   *
   * Claiming requires the cart-session cookie the checkout was started with:
   * otherwise any signed-in customer who learned a guest's checkout id could
   * take it over (and lock the guest out of paying). The storefront sends
   * that cookie on this call (credentials: 'include').
   */
  private async claimAndAssertOwnership(
    checkoutId: string,
    customer: AuthenticatedCustomer,
    req: Request,
  ): Promise<CheckoutSession> {
    const checkout = await this.prisma.checkoutSession.findFirst({
      where: { id: checkoutId, storeId: customer.storeId },
    });
    if (!checkout) {
      throw new NotFoundException('Checkout session not found');
    }
    if (checkout.customerId && checkout.customerId !== customer.id) {
      throw new NotFoundException('Checkout session not found');
    }
    if (!checkout.customerId) {
      if (!req.cartSessionId || checkout.sessionId !== req.cartSessionId) {
        throw new NotFoundException('Checkout session not found');
      }
      return this.prisma.checkoutSession.update({
        where: { id: checkoutId },
        data: { customerId: customer.id },
      });
    }
    return checkout;
  }

  private assertPayable(checkout: CheckoutSession): void {
    if (NON_PAYABLE_CHECKOUT_STATUSES.has(checkout.status)) {
      throw new GoneException(`Checkout session is ${checkout.status.toLowerCase()}`);
    }
    if (checkout.expiresAt < new Date()) {
      throw new GoneException('Checkout session has expired');
    }
  }

  /** Never reveals whether a payment exists at all if it belongs to another customer — always 404, never 403. */
  private async loadOwnedTransaction(paymentId: string, customer: AuthenticatedCustomer): Promise<PaymentTransaction> {
    const tx = await this.prisma.paymentTransaction.findFirst({
      where: { id: paymentId, storeId: customer.storeId },
    });
    if (!tx) {
      throw new NotFoundException('Payment not found');
    }

    const ownedCheckout = await this.prisma.checkoutSession.findFirst({
      where: { id: tx.checkoutSessionId, storeId: customer.storeId, customerId: customer.id },
      select: { id: true },
    });
    if (!ownedCheckout) {
      throw new NotFoundException('Payment not found');
    }

    return tx;
  }

  /** A request with no cart-session cookie can't own any guest checkout — 404, same as a foreign one. */
  private guestContext(req: Request): { storeId: string; sessionId: string } {
    if (!req.cartSessionId) {
      throw new NotFoundException('Checkout session not found');
    }
    // Same store resolution CheckoutService uses, so a guest can only ever
    // pay a checkout their own requests could have started.
    return { storeId: req.storeId ?? 'default', sessionId: req.cartSessionId };
  }

  /** Guest counterpart of loadOwnedTransaction — owned via the cart-session cookie, never via an account. */
  private async loadGuestTransaction(
    paymentId: string,
    guest: { storeId: string; sessionId: string },
  ): Promise<PaymentTransaction> {
    const tx = await this.prisma.paymentTransaction.findFirst({
      where: { id: paymentId, storeId: guest.storeId },
    });
    if (!tx) {
      throw new NotFoundException('Payment not found');
    }

    const ownedCheckout = await this.prisma.checkoutSession.findFirst({
      where: { id: tx.checkoutSessionId, storeId: guest.storeId, sessionId: guest.sessionId, customerId: null },
      select: { id: true },
    });
    if (!ownedCheckout) {
      throw new NotFoundException('Payment not found');
    }

    return tx;
  }

  private async resolveGuestPayer(checkoutId: string, storeId: string): Promise<PayerInfo> {
    const address = await this.prisma.checkoutAddressSnapshot.findFirst({
      where: { checkoutId, type: AddressType.SHIPPING },
      orderBy: { updatedAt: 'desc' },
    });
    if (!address?.email) {
      throw new BadRequestException('An email address is required to check out as a guest');
    }
    return {
      storeId,
      email: address.email,
      name: `${address.firstName} ${address.lastName}`.trim(),
    };
  }

  // ─── Helpers ────────────────────────────────────────────────────────────

  private async resolveDefaultGateway(storeId: string): Promise<string> {
    const config = await this.prisma.storePaymentConfig.findUnique({ where: { storeId } });
    return config?.defaultGateway ?? 'cod';
  }

  private async markPaymentInitiated(checkoutId: string): Promise<void> {
    await this.prisma.checkoutSession.updateMany({
      where: { id: checkoutId, status: { notIn: [CheckoutStatus.COMPLETED, CheckoutStatus.CANCELLED, CheckoutStatus.EXPIRED] } },
      data: { status: CheckoutStatus.PAYMENT_INITIATED, paymentInitiatedAt: new Date() },
    });
  }

  /**
   * Gateways with `requiresWebhook: false` (COD, Mock) will never receive an
   * async gateway callback — nothing else in the system will ever call
   * capturePayment()/completePayment() for them. This request has to drive
   * that itself, synchronously, right after initiation. Webhook-driven
   * gateways (Razorpay, Stripe) are left exactly as GATEWAY_CREATED; their
   * capture + order creation happens later via WebhookService, unchanged.
   */
  private async driveDirectCaptureIfApplicable(
    result: StartPaymentResult,
    storeId: string,
  ): Promise<PaymentTransaction> {
    const tx = result.transaction;
    if (tx.status !== PaymentTxStatus.GATEWAY_CREATED) {
      return tx;
    }

    const gateway = this.gatewayRegistry.resolve(tx.gatewayCode);
    if (gateway.capabilities.requiresWebhook) {
      return tx;
    }

    try {
      const captured = await this.paymentService.capturePayment({
        transactionId: tx.id,
        storeId,
        idempotencyKey: randomUUID(),
      });
      if (captured.status !== PaymentTxStatus.CAPTURED) {
        // Gateway-side capture failure — surfaced as-is, nothing to complete.
        return captured;
      }
      await this.orchestrator.completePayment(captured.id, storeId);
      return this.paymentService.getPayment(captured.id, storeId);
    } catch (err) {
      throw mapPaymentException(err);
    }
  }

  /** The customer-facing number for the order this payment produced, if any. */
  private async orderNumberFor(tx: PaymentTransaction): Promise<string | null> {
    if (!tx.orderId) return null;
    const order = await this.prisma.order.findFirst({
      where:  { id: tx.orderId, storeId: tx.storeId },
      select: { orderNumber: true },
    });
    return order?.orderNumber ?? null;
  }

  private toInitiationResponse(
    tx: PaymentTransaction,
    startResult: StartPaymentResult,
    orderNumber: string | null,
  ): PaymentInitiationResponseDto {
    return {
      paymentId: tx.id,
      status: tx.status,
      gatewayCode: tx.gatewayCode,
      amountInPaise: tx.amountInPaise,
      currency: tx.currency,
      redirectUrl: startResult.redirectUrl,
      clientSecret: startResult.clientSecret,
      gatewayOrderId: tx.gatewayOrderId ?? undefined,
      orderId: tx.orderId,
      orderNumber,
    };
  }
}
