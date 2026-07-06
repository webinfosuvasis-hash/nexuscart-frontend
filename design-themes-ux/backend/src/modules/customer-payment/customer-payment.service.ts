import {
  BadRequestException, GoneException, Injectable, NotFoundException,
} from '@nestjs/common';
import { Request } from 'express';
import { randomUUID } from 'crypto';
import { CheckoutSession, CheckoutStatus, PaymentTransaction, PaymentTxStatus } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { CheckoutService } from '@/modules/checkout/checkout.service';
import { PaymentService } from '@/modules/payment/payment.service';
import { PaymentOrchestratorService } from '@/modules/payment-orchestrator/payment-orchestrator.service';
import { PaymentGatewayRegistry } from '@/modules/payment/gateways/payment-gateway-registry.service';
import { StartPaymentResult } from '@/modules/payment/dto/payment-service.types';
import { AuthenticatedCustomer } from '@/modules/customer-auth/types/customer-auth.types';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import {
  PaymentDetailResponseDto, PaymentInitiationResponseDto, PaymentStatusResponseDto,
} from './dto/payment-response.dto';
import { mapPaymentException } from './customer-payment-exception.mapper';

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
  ) {}

  async initiatePayment(
    checkoutId: string,
    customer: AuthenticatedCustomer,
    dto: InitiatePaymentDto,
    req: Request,
  ): Promise<PaymentInitiationResponseDto> {
    const checkout = await this.claimAndAssertOwnership(checkoutId, customer);
    this.assertPayable(checkout);

    // Live-recomputed by CheckoutEngineService via CheckoutService — never
    // re-derived here, so pricing/validation logic is never duplicated.
    const summary = await this.checkoutService.getSummary(checkoutId, req);
    if (!summary.validation.isValid) {
      throw new BadRequestException({
        message: 'Checkout is not valid for payment',
        issues: summary.validation.issues,
      });
    }

    const gatewayCode = dto.gatewayCode ?? await this.resolveDefaultGateway(customer.storeId);
    const method = await this.prisma.storePaymentMethod.findFirst({
      where: { storeId: customer.storeId, gatewayCode, isActive: true },
    });
    if (!method) {
      throw new BadRequestException(`Payment method '${gatewayCode}' is not available for this store`);
    }

    const amountInPaise = Math.round(summary.totals.grandTotal * 100);

    let startResult: StartPaymentResult;
    try {
      const tx = await this.paymentService.createPaymentAttempt({
        checkoutSessionId: checkoutId,
        storeId: customer.storeId,
        gatewayCode,
        amountInPaise,
        currency: summary.totals.currencyCode,
        paymentMethodId: method.id,
        idempotencyKey: INITIATE_IDEMPOTENCY_KEY,
      });

      startResult = await this.paymentService.startPayment(
        tx.id,
        customer.storeId,
        randomUUID(),
        { email: customer.email, name: customer.name },
      );
    } catch (err) {
      throw mapPaymentException(err);
    }

    await this.markPaymentInitiated(checkoutId);
    const finalTx = await this.driveDirectCaptureIfApplicable(startResult, customer.storeId);

    return this.toInitiationResponse(finalTx, startResult);
  }

  async retryPayment(paymentId: string, customer: AuthenticatedCustomer): Promise<PaymentInitiationResponseDto> {
    const tx = await this.loadOwnedTransaction(paymentId, customer);

    let result: StartPaymentResult;
    try {
      result = await this.paymentService.retryPayment({
        transactionId: tx.id,
        storeId: customer.storeId,
        idempotencyKey: randomUUID(),
        customerInfo: { email: customer.email, name: customer.name },
      });
    } catch (err) {
      throw mapPaymentException(err);
    }

    const finalTx = await this.driveDirectCaptureIfApplicable(result, customer.storeId);
    return this.toInitiationResponse(finalTx, result);
  }

  async getPaymentStatus(paymentId: string, customer: AuthenticatedCustomer): Promise<PaymentStatusResponseDto> {
    const tx = await this.loadOwnedTransaction(paymentId, customer);
    return { id: tx.id, status: tx.status, orderId: tx.orderId };
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
   */
  private async claimAndAssertOwnership(checkoutId: string, customer: AuthenticatedCustomer): Promise<CheckoutSession> {
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

  private toInitiationResponse(tx: PaymentTransaction, startResult: StartPaymentResult): PaymentInitiationResponseDto {
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
    };
  }
}
